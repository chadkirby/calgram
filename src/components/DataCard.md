# DataCard Component

## Overview

The DataCard component provides import and export functionality for meal and weight tracking data. It is used within the SettingsDialog component to offer users the ability to backup their data or transfer it to another system.

## Features

### Data Export

- Exports all meal entries and weight entries to a JSON file
- Generates a comprehensive export format with detailed data
- Automatic download of the JSON file to the user's device
- Visual feedback during the export process

### Data Import

- Imports meal and weight entries from JSON files
- Supports both legacy import format and new export format
- Handles duplicate entries gracefully without creating duplicates
- Provides success/error feedback with detailed information

## Component Structure

```
DataCard
├── Import Button (Upload icon)
├── Export Button (Download icon)
├── File Input (hidden)
└── Status Feedback
    ├── Success Messages
    ├── Error Messages
    └── Loading Indicators
```

## Props

The DataCard component does not require any props and can be used as a self-contained component:

```tsx
import { DataCard } from "@/components/DataCard";

// In your component
<DataCard />;
```

## Functionality

### Export Process

1. User clicks the "Export Data" button
2. Component reads all meal and weight entries from the Jazz account
3. Data is transformed to the new export format
4. JSON file is generated and automatically downloaded
5. Success message is displayed to the user

### Import Process

1. User clicks the "Import Data" button
2. Hidden file input is triggered to open the file picker
3. User selects a JSON file
4. File is parsed and validated
5. Data is imported to the Jazz account
6. Success or error message is displayed with details

## Data Formats

Export writes v1.3 files: the exporting `accountId`, and each entry with its Jazz 2 row `id`. Import takes v1.3 files and v1.2 Classic exports (each entry with its Classic CoValue `id`); any other version, or an entry without an `id`, is rejected. See [DataImporter.md](../utils/DataImporter.md) and [DataExporter.md](../utils/DataExporter.md) for the format.

## Error Handling

The component provides comprehensive error handling:

### Export Errors

- No data available to export
- Jazz data access errors
- File generation or download failures

### Import Errors

- Invalid file format
- Malformed JSON data
- Data validation errors
- Jazz synchronization errors

## Status Feedback

The component provides visual feedback for all operations:

- **Loading**: Blue indicator during active operations
- **Success**: Green indicator with success message
- **Error**: Red indicator with error message

## Related Components

- [SettingsDialog](./SettingsDialog.tsx) - Parent component that uses DataCard
- [DataExporter](../utils/DataExporter.ts) - Utility class for exporting data
- [DataImporter](../utils/DataImporter.ts) - Utility class for importing data
