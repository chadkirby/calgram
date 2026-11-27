# DataImporter Utility

## Overview

DataImporter validates and plans the import of an export file. It is pure: it reads no account and writes nothing. `importIntoAccount` in `src/lib/backup.ts` turns its plan into Jazz 2 writes for the DataCard component.

It accepts two kinds of export file, and every entry in either must carry its source `id`:

- v1.2: Classic exports. Each `id` is the entry's Classic CoValue id (`co_z…`).
- v1.3: Jazz 2 exports. Each `id` is the entry's Jazz 2 row id, and the top-level `accountId` names the exporting account.

Any other version (including v1.0 and v1.1, whose entries have no ids) fails validation with a single `version: Export version "1.1" isn't supported; …` error, and an entry without an `id` fails with `mealEntries.0.id: id is required`. Validation is strict: unknown keys are rejected.

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
static planImport(jsonData: unknown): ImportPlan

interface ImportPlan {
  accountId: string | undefined; // the exporting account (v1.3), when the file names one
  meals: { sourceId: string; row: MealRow }[];
  weights: { sourceId: string; row: WeightRow }[];
  profile: Partial<ProfileRow> | undefined; // from the file's `profile` block
  errors: string[]; // validation errors; when present, nothing is planned
}
```

Each row's `sourceId` is the entry's `id` from the file. Timestamps are kept verbatim.

### parseJsonFile

Parses file text as JSON and checks that it is an object. Throws `Failed to parse JSON file: …` otherwise.

```typescript
static parseJsonFile(fileContent: string): ExportedData
```

## Writing the plan (src/lib/backup.ts)

`importIntoAccount(db, accountId, jsonData, saveProfile)` imports a file into the signed-in Jazz 2 account:

- An invalid file throws `Invalid data format: …` and writes nothing.
- In this account's own export (the file's `accountId` is the importing account), each entry is inserted under its source `id` itself, so the server's guards stop it bringing back a row deleted since the export or duplicating one this device hasn't loaded yet. Otherwise its row id is `rowId(accountId, sourceId)` (`rowIds.ts`). Rows are inserted with that id, never upserted, and only when missing (plan KTD5): an entry is skipped when its source `id` or its row id already is one of this account's row ids.
- Inserts are local-first and don't wait for the server. The server rejects an insert whose id exists or was deleted; that counts as already present, not an error. The returned counts are local-first too: a row the server later rejects still counts as imported.
- Names and unit preferences from the `profile` block are saved to the profile row. `dateOfBirth` is dropped: Jazz 2 has no column for it.

It returns:

```typescript
interface ImportResult {
  mealCount: number; // meals inserted
  weightCount: number; // weigh-ins inserted
  duplicatesSkipped: number; // entries already present
}
```

## Related Components

- [DataCard](../components/DataCard.tsx) - Settings card with the Import and Export buttons
- [backup.ts](../lib/backup.ts) - Jazz 2 export and import
- [DataExporter](./DataExporter.ts) - Builds export files
