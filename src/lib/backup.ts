import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../jazz/jazz.generated";
import { DataExporter, type ExportedData } from "@/utils/DataExporter";
import {
  DataImporter,
  canonicalContent,
  canonicalMeal,
  canonicalWeight,
  type PlannedRow,
} from "@/utils/DataImporter";
import { contentSourceKey, rowId } from "@/utils/rowIds";
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
  /** Rows to insert, each with its deterministic id. */
  inserts: { id: string; row: T }[];
  /** Entries this account already has. */
  alreadyPresent: number;
  /** Entries that repeat an earlier entry's source id in the same file. */
  duplicates: number;
}

/** A Jazz 2 row id (a UUID), as opposed to a Classic CoValue id (`co_z…`). */
const ROW_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decide which planned rows to insert (KTD5). An entry is skipped when its source id
 * already is one of this account's row ids (re-importing a Jazz 2 export), when its
 * deterministic row id already exists (re-importing any other file), when an earlier
 * entry in the file had the same source key (a concatenated export), or, for an entry
 * without a source id, when its content key is in `existingContentKeys` (see
 * `contentKeysOf`).
 *
 * With `ownExport` (the file names this account), an entry whose source id is a Jazz 2
 * row id is inserted under that id itself, so the server's "object already exists" and
 * "row already deleted" guards apply: a row deleted since the export, or one the server
 * has but this device hasn't loaded, isn't added again. Everything else gets
 * `rowId(account, sourceKey)`.
 */
export async function planRowWrites<T>(
  accountId: string,
  planned: readonly PlannedRow<T>[],
  existingIds: ReadonlySet<string>,
  ownExport = false,
  existingContentKeys: ReadonlySet<string> = new Set(),
): Promise<RowWrites<T>> {
  const ids = await Promise.all(
    planned.map(({ sourceKey, hasSourceId }) =>
      ownExport && hasSourceId && ROW_ID_SHAPE.test(sourceKey)
        ? sourceKey
        : rowId(accountId, sourceKey),
    ),
  );
  const seen = new Set<string>();
  const result: RowWrites<T> = { inserts: [], alreadyPresent: 0, duplicates: 0 };
  for (const [i, { sourceKey, hasSourceId, row }] of planned.entries()) {
    if (seen.has(sourceKey)) {
      result.duplicates++;
      continue;
    }
    seen.add(sourceKey);
    const id = ids[i];
    if (
      existingIds.has(sourceKey) ||
      existingIds.has(id) ||
      (!hasSourceId && existingContentKeys.has(sourceKey))
    )
      result.alreadyPresent++;
    else result.inserts.push({ id, row });
  }
  return result;
}

/**
 * The content source keys of rows this account already has: with N rows of identical
 * canonical content, the keys for occurrences 0..N-1 of that content. A file's id-less
 * entries get the same keys (`DataImporter.planImport`), so a file with M identical
 * entries adds only the M-N the account is missing, whatever ids the existing rows have.
 */
export async function contentKeysOf<T>(
  rows: readonly T[],
  canonical: (row: T) => unknown[],
): Promise<Set<string>> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const content = canonicalContent(canonical(row));
    counts.set(content, (counts.get(content) ?? 0) + 1);
  }
  const keys = await Promise.all(
    [...counts].flatMap(([content, n]) =>
      Array.from({ length: n }, (_, occurrence) => contentSourceKey(content, occurrence)),
    ),
  );
  return new Set(keys);
}

export interface ImportResult {
  mealCount: number;
  weightCount: number;
  /** Entries already in this account, plus repeats within the file. */
  duplicatesSkipped: number;
}

/**
 * The server rejects an insert whose id exists or was deleted; for an import that means
 * the entry is already accounted for, so it isn't an error (KTD5).
 */
const isAlreadyPresent = (error: unknown) =>
  /object already exists|row already deleted/.test(String(error));

function insertQuietly(write: { wait(options: { tier: "global" }): Promise<unknown> }) {
  write.wait({ tier: "global" }).catch((error: unknown) => {
    if (!isAlreadyPresent(error)) console.error("An imported row was rejected:", error);
  });
}

/**
 * Import an export file into this account. Rows are inserted local-first with
 * deterministic ids (or, for this account's own export, their original ids), only
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
  const plan = await DataImporter.planImport(jsonData);
  if (plan.errors.length > 0) {
    throw new Error(`Invalid data format: ${plan.errors.join(", ")}`);
  }

  const [meals, weights] = await Promise.all([db.all(app.mealEntries), db.all(app.weightEntries)]);
  const ownExport = plan.accountId === accountId;
  const mealWrites = await planRowWrites(
    accountId,
    plan.meals,
    new Set(meals.map((m) => m.id)),
    ownExport,
    await contentKeysOf(meals, canonicalMeal),
  );
  const weightWrites = await planRowWrites(
    accountId,
    plan.weights,
    new Set(weights.map((w) => w.id)),
    ownExport,
    await contentKeysOf(weights, canonicalWeight),
  );

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
    duplicatesSkipped:
      mealWrites.alreadyPresent +
      mealWrites.duplicates +
      weightWrites.alreadyPresent +
      weightWrites.duplicates,
  };
}
