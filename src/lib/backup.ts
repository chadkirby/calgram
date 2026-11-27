import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../jazz/jazz.generated";
import { DataExporter, type ExportedData } from "@/utils/DataExporter";
import { DataImporter, type PlannedRow } from "@/utils/DataImporter";
import { rowId } from "@/utils/rowIds";
import type { Profile } from "./data";

/** How long export waits for the server's copy of the data before giving up on it. */
export const EXPORT_REMOTE_WAIT_MS = 10_000;

/**
 * Every row of `local`, then each row of `remote` whose id isn't in `local`. Local
 * wins, so pending local edits are what gets exported.
 */
export function unionById<T extends { id: string }>(
  local: readonly T[],
  remote: readonly T[],
): T[] {
  const ids = new Set(local.map((row) => row.id));
  return [...local, ...remote.filter((row) => !ids.has(row.id))];
}

/** Resolve with `promise`'s value, or reject once `ms` pass without it. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer from the server in ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface AccountExport {
  data: ExportedData;
  /**
   * False when the server's copy couldn't be read in time, so rows this device hasn't
   * loaded yet may be missing from `data`.
   */
  complete: boolean;
}

/**
 * Export this account's profile, meals and weigh-ins. Each entry's `id` is its row id,
 * and the file names the account, so importing it back can reuse those ids.
 *
 * A local read can be incomplete on a device that hasn't loaded everything yet, so the
 * rows are also read from the server (`tier: "remote"`, which waits while offline) for
 * at most `remoteWaitMs`, and the two are merged by id, local first. When that read
 * fails or times out, the local rows are still exported and `complete` is false.
 */
export async function exportAccount(
  db: Db,
  accountId: string,
  profile: Profile | undefined,
  { remoteWaitMs = EXPORT_REMOTE_WAIT_MS }: { remoteWaitMs?: number } = {},
): Promise<AccountExport> {
  const remoteRead = Promise.all([
    db.all(app.mealEntries, { tier: "remote" }),
    db.all(app.weightEntries, { tier: "remote" }),
  ]);
  // The remote read may settle after the timeout; don't let that rejection go unhandled.
  remoteRead.catch(() => {});
  const [local, remote] = await Promise.all([
    Promise.all([db.all(app.mealEntries), db.all(app.weightEntries)]),
    within(remoteRead, remoteWaitMs).catch((error: unknown) => {
      console.warn("Couldn't read this account's data from the server for export:", error);
      return undefined;
    }),
  ]);
  const [meals, weights] = remote
    ? [unionById(local[0], remote[0]), unionById(local[1], remote[1])]
    : local;
  return {
    data: DataExporter.buildExport({ accountId, profile, meals, weights }),
    complete: remote !== undefined,
  };
}

export interface RowWrites<T> {
  /** Rows to insert, each with its row id. */
  inserts: { id: string; row: T }[];
  /** Entries this account already has. */
  alreadyPresent: number;
  /** Row ids of those entries. */
  presentIds: string[];
}

/**
 * Decide which planned rows to insert (KTD5). With `ownExport` (the file names this
 * account), each entry is inserted under its source id itself, so the server's "object
 * already exists" and "row already deleted" guards apply: a row deleted since the
 * export, or one the server has but this device hasn't loaded, isn't added again.
 * Otherwise an entry gets `rowId(account, sourceId)`. An entry is skipped when its
 * source id or that row id already is one of this account's row ids.
 */
export async function planRowWrites<T>(
  accountId: string,
  planned: readonly PlannedRow<T>[],
  existingIds: ReadonlySet<string>,
  ownExport = false,
): Promise<RowWrites<T>> {
  const ids = await Promise.all(
    planned.map(({ sourceId }) => (ownExport ? sourceId : rowId(accountId, sourceId))),
  );
  const result: RowWrites<T> = { inserts: [], alreadyPresent: 0, presentIds: [] };
  for (const [i, { sourceId, row }] of planned.entries()) {
    const id = ids[i];
    const present = existingIds.has(id) ? id : existingIds.has(sourceId) ? sourceId : undefined;
    if (present) {
      result.alreadyPresent++;
      result.presentIds.push(present);
    } else {
      result.inserts.push({ id, row });
    }
  }
  return result;
}

export const idsOf = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id));

export interface ImportResult {
  mealCount: number;
  weightCount: number;
  /** Entries already in this account. */
  duplicatesSkipped: number;
}

/**
 * The server rejects an insert whose id exists or was deleted; for an import that means
 * the entry is already accounted for, so it isn't an error (KTD5).
 */
export const isAlreadyPresent = (error: unknown) =>
  /object already exists|row already deleted/.test(String(error));

function insertQuietly(write: { wait(options: { tier: "global" }): Promise<unknown> }) {
  write.wait({ tier: "global" }).catch((error: unknown) => {
    if (!isAlreadyPresent(error)) console.error("An imported row was rejected:", error);
  });
}

/**
 * Import a v1.2 or v1.3 export file into this account. Rows are inserted local-first
 * with deterministic ids (or, for this account's own export, their original ids), only
 * where missing. The counts are local-first: a row the server later rejects as
 * existing or deleted still counts as imported. The file's names and unit preferences are
 * written to the profile; its date of birth is dropped (no Jazz 2 column for it).
 * Throws, writing nothing, when the file doesn't validate.
 */
export async function importIntoAccount(
  db: Db,
  accountId: string,
  jsonData: unknown,
  saveProfile: (patch: ProfileInsert) => void,
): Promise<ImportResult> {
  const plan = DataImporter.planImport(jsonData);
  if (plan.errors.length > 0) {
    throw new Error(`Invalid data format: ${plan.errors.join(", ")}`);
  }

  const [meals, weights] = await Promise.all([db.all(app.mealEntries), db.all(app.weightEntries)]);
  const ownExport = plan.accountId === accountId;
  const mealWrites = await planRowWrites(accountId, plan.meals, idsOf(meals), ownExport);
  const weightWrites = await planRowWrites(accountId, plan.weights, idsOf(weights), ownExport);

  for (const { id, row } of mealWrites.inserts) {
    insertQuietly(db.insert(app.mealEntries, row, { id }));
  }
  for (const { id, row } of weightWrites.inserts) {
    insertQuietly(db.insert(app.weightEntries, row, { id }));
  }

  if (plan.profile) {
    const { dateOfBirth: _dropped, ...fields } = plan.profile;
    if (Object.keys(fields).length > 0) saveProfile(fields);
  }

  return {
    mealCount: mealWrites.inserts.length,
    weightCount: weightWrites.inserts.length,
    duplicatesSkipped: mealWrites.alreadyPresent + weightWrites.alreadyPresent,
  };
}
