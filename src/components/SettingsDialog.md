# SettingsDialog Component

## Overview

The SettingsDialog component is a comprehensive settings and utilities dialog that provides users with profile management, data import/export capabilities, and other application settings. It replaces the previous UserProfileDialog component and consolidates various utility functions that were previously scattered across different components.

## Features

### Profile Management
- Users can update their full name and first name
- Changes are automatically synchronized with the Jazz account
- Real-time validation of input fields

### Data Import/Export
- Export all meal and weight entries to a JSON file
- Import data from JSON files (supports both legacy and new formats)
- Visual feedback during import/export operations
- Error handling and status reporting

## Component Structure

```
SettingsDialog
├── DialogTrigger (Gear icon button)
├── DialogContent
│   ├── ProfileCard (profile management functionality)
│   ├── DataCard (import/export functionality)
│   └── Status/Feedback Components
```

## Props

```typescript
interface SettingsDialogProps {
  isAuthenticated: boolean;
}
```

## Usage

The SettingsDialog is accessible via a gear icon in the Layout component header. It can be imported and used as follows:

```tsx
import { SettingsDialog } from "@/components/SettingsDialog";

// In your component
<SettingsDialog isAuthenticated={isAuthenticated} />
```

## Data Import/Export Formats

### Export Format
The new export format is more comprehensive and structured:

```json
{
  "version": "1.0",
  "exportDate": "2025-01-29T10:30:00Z",
  "mealEntries": [
    {
      "timestamp": "2025-01-29T08:00:00Z",
      "foodName": "Banana",
      "foodCategory": "Fruit",
      "caloriesPerGram": 0.89,
      "caloriesPerDisplayUnit": "g",
      "weightInGrams": 120,
      "displayUnit": "g",
      "totalCalories": 106.8,
      "notes": "Medium sized banana"
    }
  ],
  "weightEntries": [
    {
      "timestamp": "2025-01-29T07:00:00Z",
      "weightValue": 70.5,
      "unit": "kg",
      "notes": "Morning weight"
    }
  ]
}
```

### Legacy Format Support
The importer continues to support the existing legacy format:

```json
{
  "meal_entries": [
    {
      "id": 1,
      "food": "Banana",
      "weight": 120,
      "calories_per_gram": 0.89,
      "total_calories": 106.8,
      "category": "Fruit",
      "date": "2025-01-29T08:00:00Z"
    }
  ],
  "weight_entries": [
    {
      "id": 1,
      "weight": 70.5,
      "date": "2025-01-29T07:00:00Z",
      "notes": "Morning weight"
    }
  ]
}
```

## Error Handling

The component provides comprehensive error handling for various scenarios:

- Invalid file formats
- Malformed JSON data
- Data validation errors
- Network and synchronization errors
- File generation/download failures

## Accessibility

The component follows accessibility best practices:
- Full keyboard navigation support
- Proper ARIA labels and descriptions
- Appropriate focus management
- Screen reader compatibility

## Mobile Responsiveness

The component is optimized for mobile devices:
- Touch-friendly controls with adequate touch targets
- Responsive layout for different screen sizes
- Native file picker support on mobile devices

## Related Components

- [DataCard](./DataCard.tsx) - Handles import/export functionality
- [DataExporter](../utils/DataExporter.ts) - Utility class for exporting data
- [DataImporter](../utils/DataImporter.ts) - Utility class for importing data
