import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../jazz/jazz.generated";
import { DataExporter, type ExportedData } from "@/utils/DataExporter";
import { DataImporter, type PlannedRow } from "@/utils/DataImporter";
import { rowId } from "@/utils/rowIds";
import type { Profile } from "./data";

/**
 * Export this account's profile, meals and weigh-ins. Each entry's `id` is its row id,
 * and the file names the account, so importing it back can reuse those ids.
 */
export async function exportAccount(
  db: Db,
  accountId: string,
  profile: Profile | undefined,
): Promise<ExportedData> {
  const [meals, weights] = await Promise.all([db.all(app.mealEntries), db.all(app.weightEntries)]);
  return DataExporter.buildExport({ accountId, profile, meals, weights });
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
 * deterministic row id already exists (re-importing any other file), or when an earlier
 * entry in the file had the same source key (a concatenated export).
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
  for (const [i, { sourceKey, row }] of planned.entries()) {
    if (seen.has(sourceKey)) {
      result.duplicates++;
      continue;
    }
    seen.add(sourceKey);
    const id = ids[i];
    if (existingIds.has(sourceKey) || existingIds.has(id)) result.alreadyPresent++;
    else result.inserts.push({ id, row });
  }
  return result;
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
  );
  const weightWrites = await planRowWrites(
    accountId,
    plan.weights,
    new Set(weights.map((w) => w.id)),
    ownExport,
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
