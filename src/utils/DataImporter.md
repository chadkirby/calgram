# DataImporter Utility

## Overview

DataImporter validates and plans the import of an export file. It is pure: it reads no account and writes nothing. `importIntoAccount` in `src/lib/backup.ts` turns its plan into Jazz 2 writes for the DataCard component.

It accepts export files v1.0 (no profile), v1.1 (profile block) v1.2 (optional source `id` on each entry) and v1.3 (optional top-level `accountId`). Validation is strict: unknown keys are rejected.

## Methods

### validateImportData

Validates a parsed file against the export format.

```typescript
static validateImportData(jsonData: unknown): { isValid: boolean; errors: string[] }
```

Each error is `path: message`, for example `mealEntries.0.caloriesPerGram: Calories per gram cannot be negative`.

### planImport

Validates a parsed file and plans its rows without writing anything.

```typescript
static async planImport(jsonData: unknown): Promise<ImportPlan>

interface ImportPlan {
  accountId: string | undefined; // the exporting account (v1.3), when the file names one
  meals: { sourceKey: string; hasSourceId: boolean; row: MealRow }[];
  weights: { sourceKey: string; hasSourceId: boolean; row: WeightRow }[];
  profile: Partial<ProfileRow> | undefined; // from the file's `profile` block
  errors: string[]; // validation errors; when present, nothing is planned
}
```

Each row's source key is its source `id` (v1.2) when present. Otherwise it is a hash of the entry's content plus its occurrence index among identical entries, so two identical entries stay two rows and planning the same file twice gives the same keys. Timestamps are kept verbatim.

### parseJsonFile

Parses file text as JSON and checks that it is an object. Throws `Failed to parse JSON file: …` otherwise.

```typescript
static parseJsonFile(fileContent: string): ExportedData
```

## Writing the plan (src/lib/backup.ts)

`importIntoAccount(db, accountId, jsonData, saveProfile)` imports a file into the signed-in Jazz 2 account:

- An invalid file throws `Invalid data format: …` and writes nothing.
- Each entry's row id is `rowId(accountId, sourceKey)` (`rowIds.ts`), except in this account's own export (the file's `accountId` is the importing account): there an entry whose source `id` is a Jazz 2 row id (a UUID) is inserted under that id itself, so the server's guards stop it bringing back a row deleted since the export or duplicating one this device hasn't loaded yet. Classic ids and id-less entries keep the derived id. Rows are inserted with that id, never upserted, and only when missing (plan KTD5). An entry is skipped when:
  - its source `id` already is one of this account's row ids (re-importing a Jazz 2 export),
  - its derived row id already exists (re-importing any other file), or
  - an earlier entry in the same file had the same source key (a concatenated export).
- Inserts are local-first and don't wait for the server. The server rejects an insert whose id exists or was deleted; that counts as already present, not an error. The returned counts are local-first too: a row the server later rejects still counts as imported.
- Names and unit preferences from the `profile` block are saved to the profile row. `dateOfBirth` is dropped: Jazz 2 has no column for it.

It returns:

```typescript
interface ImportResult {
  mealCount: number; // meals inserted
  weightCount: number; // weigh-ins inserted
  duplicatesSkipped: number; // entries already present, plus repeats in the file
}
```

## Related Components

- [DataCard](../components/DataCard.tsx) - Settings card with the Import and Export buttons
- [backup.ts](../lib/backup.ts) - Jazz 2 export and import
- [DataExporter](./DataExporter.ts) - Builds export files
