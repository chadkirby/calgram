# DataExporter Utility

## Overview

The DataExporter utility provides functionality for exporting meal and weight tracking data to a structured JSON format. This utility is used by the DataCard component to enable users to backup their data or transfer it to another system.

## Features

### Data Export

- Exports the profile, meal entries and weight entries passed to it
- Transforms data to a comprehensive JSON format
- Generates download files for user access
- Handles error conditions gracefully

## Methods

### buildExport

Builds the export file (version `1.3`) from plain rows. Pure: no account access, no I/O. Fields are picked explicitly, so Jazz 2 rows (with `null` optional fields) can be passed as is. Timestamps are copied verbatim.

```typescript
static buildExport(
  source: { accountId?: string; profile: ProfileRow | undefined; meals: Iterable<MealRow & { id: string }>; weights: Iterable<WeightRow & { id: string }> },
  now?: Date,
): ExportedData
```

Each row's `id` is written as the entry's source `id`, so a re-import can recognise entries it already has; import rejects entries without one. `accountId`, when given, is written at the top level: the Jazz 2 account the file came from.

### downloadJsonFile

Downloads JSON file to the user's device.

```typescript
static downloadJsonFile(data: ExportedData, filename: string): void
```

**Parameters:**

- `data`: The exported data to be downloaded
- `filename`: The name of the file to be downloaded

**Throws:**

- `Error`: If the file generation or download fails

## Data Structures

### ExportedData

The main data structure for exported data.

```typescript
interface ExportedData {
  version: string; // "1.3"
  exportDate: string;
  accountId?: string; // exporting Jazz 2 account (v1.3; v1.2 Classic exports have none)
  profile?: ExportProfileDTO;
  mealEntries: ExportedMealEntry[];
  weightEntries: ExportedWeightEntry[];
}
```

### ExportedMealEntry

Structure for individual meal entries in the export.

```typescript
interface ExportedMealEntry {
  id: string; // source id: Classic CoValue id (v1.2) or Jazz 2 row id (v1.3)
  timestamp: string;
  foodName: string;
  foodCategory: string;
  caloriesPerGram: number;
  caloriesPerDisplayUnit?: string;
  weightInGrams: number;
  displayUnit?: string;
  totalCalories: number;
  notes?: string;
}
```

### ExportedWeightEntry

Structure for individual weight entries in the export.

```typescript
interface ExportedWeightEntry {
  id: string; // source id: Classic CoValue id (v1.2) or Jazz 2 row id (v1.3)
  timestamp: string;
  weightValue: number;
  unit?: string;
  notes?: string;
}
```

## Usage

The DataCard component exports the signed-in account through `exportAccount` in `src/lib/backup.ts`, which reads the account's Jazz 2 rows and calls `buildExport`. Each entry's `id` is its Jazz 2 row id.

```typescript
import { DataExporter } from "@/utils/DataExporter";
import { exportAccount } from "@/lib/backup";

const { data: exportData, complete } = await exportAccount(db, accountId, profile);
// complete is false when the server's copy couldn't be read in time.

// Generate filename with timestamp
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
const filename = `calorie-tracker-export-${timestamp}.json`;

// Download the file
DataExporter.downloadJsonFile(exportData, filename);
```

## Error Handling

The utility provides comprehensive error handling:

### Download Errors

- DOM errors during file creation
- File generation failures
- Download process failures

## Related Components

- [DataCard](../components/DataCard.tsx) - Component that uses this utility
- [SettingsDialog](../components/SettingsDialog.tsx) - Parent component that uses DataCard
- [DataImporter](./DataImporter.ts) - Utility for importing data
