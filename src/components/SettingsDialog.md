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
<SettingsDialog isAuthenticated={isAuthenticated} />;
```

## Data Import/Export Formats

Export writes v1.3 files: the exporting `accountId`, and each entry with its Jazz 2 row `id`. Import takes v1.3 files and v1.2 Classic exports (each entry with its Classic CoValue `id`); any other version, or an entry without an `id`, is rejected. See [DataImporter.md](../utils/DataImporter.md) and [DataExporter.md](../utils/DataExporter.md) for the format.

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
