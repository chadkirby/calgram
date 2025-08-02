# DataExporter Utility

## Overview

The DataExporter utility provides functionality for exporting meal and weight tracking data from the Jazz account to a structured JSON format. This utility is used by the DataCard component to enable users to backup their data or transfer it to another system.

## Features

### Data Export
- Exports all meal entries and weight entries from the Jazz account
- Transforms data to a comprehensive JSON format
- Generates download files for user access
- Handles error conditions gracefully

## Methods

### exportUserData
Exports user data to a structured format.

```typescript
static async exportUserData(account: Loaded<typeof JazzAccount>): Promise<ExportedData>
```

**Parameters:**
- `account`: The loaded Jazz account containing meal and weight entries

**Returns:**
- `Promise<ExportedData>`: A promise that resolves to the exported data

**Throws:**
- `Error`: If the account root is not available or fails to load

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
  version: string;
  exportDate: string;
  mealEntries: ExportedMealEntry[];
  weightEntries: ExportedWeightEntry[];
}
```

### ExportedMealEntry
Structure for individual meal entries in the export.

```typescript
interface ExportedMealEntry {
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
  timestamp: string;
  weightValue: number;
  unit?: string;
  notes?: string;
}
```

## Usage

The DataExporter utility is used by the DataCard component:

```typescript
import { DataExporter } from "@/utils/DataExporter";

// Export user data
const exportData = await DataExporter.exportUserData(me);

// Generate filename with timestamp
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
const filename = `calorie-tracker-export-${timestamp}.json`;

// Download the file
DataExporter.downloadJsonFile(exportData, filename);
```

## Error Handling

The utility provides comprehensive error handling:

### Export Errors
- Account root not available
- Failed to load account root
- Data access errors

### Download Errors
- DOM errors during file creation
- File generation failures
- Download process failures

## Related Components

- [DataCard](../components/DataCard.tsx) - Component that uses this utility
- [SettingsDialog](../components/SettingsDialog.tsx) - Parent component that uses DataCard
- [DataImporter](./DataImporter.ts) - Utility for importing data
