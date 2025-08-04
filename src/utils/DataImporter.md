# DataImporter Utility

## Overview

The DataImporter utility provides functionality for importing meal and weight tracking data from JSON files into the Jazz account. This utility supports both legacy import format and the new export format, and is used by the DataCard component to enable users to restore their data.

## Features

### Data Import
- Imports meal entries and weight entries from JSON files
- Supports both legacy and new export formats
- Handles duplicate entries gracefully without creating duplicates
- Provides detailed import results and error reporting

### Format Detection
- Automatically detects the format of imported data
- Supports legacy format with `meal_entries` and `weight_entries` arrays
- Supports new format with `mealEntries` and `weightEntries` arrays

### Data Validation
- Validates the structure of imported data
- Provides detailed error messages for invalid data
- Handles malformed JSON gracefully

## Methods

### importData
Imports data from exported JSON file (supports both legacy and new formats).

```typescript
static async importData(jsonData: ExportedData, account: Loaded<typeof JazzAccount>): Promise<ImportResult>
```

**Parameters:**
- `jsonData`: The parsed JSON data to import
- `account`: The loaded Jazz account to import data into

**Returns:**
- `Promise<ImportResult>`: A promise that resolves to the import results

**Throws:**
- `Error`: If the account root is not available or fails to load

### detectDataFormat
Detects the format of the imported data.

```typescript
static detectDataFormat(jsonData: any): 'legacy' | 'current' | 'unknown'
```

**Parameters:**
- `jsonData`: The parsed JSON data to analyze

**Returns:**
- `'legacy' | 'current' | 'unknown'`: The detected format

### validateImportData
Validates the imported data structure.

```typescript
static validateImportData(jsonData: any): { isValid: boolean; errors: string[] }
```

**Parameters:**
- `jsonData`: The parsed JSON data to validate

**Returns:**
- `{ isValid: boolean; errors: string[] }`: Validation result with errors if any

### parseJsonFile
Parses and validates JSON file content.

```typescript
static parseJsonFile(fileContent: string): ExportedData
```

**Parameters:**
- `fileContent`: The raw file content as string

**Returns:**
- `ExportedData`: The parsed JSON data

**Throws:**
- `Error`: If the JSON parsing fails

## Data Structures

### ImportResult
Structure for import operation results.

```typescript
interface ImportResult {
  mealCount: number;
  weightCount: number;
  duplicatesSkipped: number;
  errors: string[];
}
```

### ExportedData (Union Type)
Union type for both legacy and new export formats.

```typescript
type ExportedData = LegacyExportedData | NewExportedData;
```

### LegacyExportedData
Structure for legacy export format.

```typescript
interface LegacyExportedData {
  meal_entries: LegacyExportedMealEntry[];
  weight_entries: LegacyExportedWeightEntry[];
}
```

### NewExportedData
Structure for new export format.

```typescript
interface NewExportedData {
  version: string;
  exportDate: string;
  mealEntries: NewExportedMealEntry[];
  weightEntries: NewExportedWeightEntry[];
}
```

## Usage

The DataImporter utility is used by the DataCard component:

```typescript
import { DataImporter } from "@/utils/DataImporter";

// Read file content
const fileContent = await file.text();

// Parse JSON data
const jsonData = DataImporter.parseJsonFile(fileContent);

// Validate data structure
const validation = DataImporter.validateImportData(jsonData);
if (!validation.isValid) {
  throw new Error(`Invalid data format: ${validation.errors.join(", ")}`);
}

// Import data
const result = await DataImporter.importData(jsonData, me);
```

## Error Handling

The utility provides comprehensive error handling:

### Import Errors
- Invalid file format
- Malformed JSON data
- Data validation errors
- Jazz synchronization errors
- Network errors

### Validation Errors
- Missing required fields
- Invalid data types
- Incorrect array structures

## Related Components

- [DataCard](../components/DataCard.tsx) - Component that uses this utility
- [SettingsDialog](../components/SettingsDialog.tsx) - Parent component that uses DataCard
- [DataExporter](./DataExporter.ts) - Utility for exporting data
