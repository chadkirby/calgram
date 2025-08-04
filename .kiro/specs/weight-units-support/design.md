# Design Document

## Overview

This design document outlines the implementation approach for adding weight unit support to the existing CalGram calorie tracker application. The primary design principle is to preserve the existing mobile-optimized layout and user experience while seamlessly integrating unit selection capabilities. The enhancement will add minimal UI elements and maintain backward compatibility with existing Jazz CoValue data structures.

The design emphasizes:
- **Minimal UI Changes**: Preserve existing mobile-optimized form layouts
- **Seamless Data Migration**: Extend existing schemas without breaking changes
- **Consistent Display**: Use most recently used units for all historical data display
- **Performance**: Efficient unit conversions and local storage for preferences

## Architecture

### High-Level Architecture Changes

The weight units feature will be implemented as an enhancement layer over the existing calorie tracker architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced CalGram App                     │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (Minimal Changes)                                 │
│  ├── MealPage (+ inline unit selector)                      │
│  ├── WeightPage (+ inline unit selector)                    │
│  ├── DailyPage (+ unit-aware display)                       │
│  └── TrendPage (+ unit-aware charts)                        │
├─────────────────────────────────────────────────────────────┤
│  New Components                                              │
│  ├── WeightUnitSelector (compact inline component)          │
│  └── UnitPreferenceManager (local storage utility)          │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Business Logic                                     │
│  ├── WeightConverter (conversion utilities)                 │
│  ├── UnitDisplayFormatter (display formatting)              │
│  └── Enhanced existing calculators                          │
├─────────────────────────────────────────────────────────────┤
│  Extended Data Layer (Backward Compatible)                  │
│  ├── MealEntry (+ optional unit field)                      │
│  ├── WeightEntry (+ optional unit field)                    │
│  └── Existing fields preserved                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Schema Extensions (Backward Compatible)

#### Enhanced MealEntry Schema
```typescript
export const MealEntry = co.map({
  // Existing fields (unchanged)
  timestamp: z.date(),
  foodName: z.string(),
  foodCategory: z.string(),
  caloriesPerGram: z.number(),
  weightInGrams: z.number(), // Preserved - always stores gram value
  notes: z.string().optional(),
  totalCalories: z.number(),
  
  // New optional field
  displayUnit: z.enum(['g', 'oz', 'lb', 'kg']).optional(), // For display purposes
});
```

#### Enhanced WeightEntry Schema
```typescript
export const WeightEntry = co.map({
  // Existing fields (unchanged)
  timestamp: z.date(),
  weightValue: z.number(), // Preserved - stores value in entered unit
  notes: z.string().optional(),
  
  // New optional field
  unit: z.enum(['lbs', 'kg']).optional(), // Defaults to 'lbs' for legacy data
});
```

### New UI Components

#### WeightUnitSelector Component
```typescript
interface WeightUnitSelectorProps {
  value: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  units: WeightUnit[];
  compact?: boolean; // For mobile optimization
  className?: string;
}

type MealWeightUnit = 'g' | 'oz' | 'lb' | 'kg';
type BodyWeightUnit = 'lbs' | 'kg';
```

**Design Specifications:**
- **Mobile-First**: Inline dropdown or toggle buttons (max 40px height)
- **Integration**: Positioned as suffix to existing weight input fields
- **Styling**: Matches existing shadcn/ui form components
- **Accessibility**: Proper ARIA labels and keyboard navigation

#### Enhanced Weight Input Component
```typescript
interface WeightInputProps {
  value: number;
  unit: WeightUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: WeightUnit) => void;
  availableUnits: WeightUnit[];
  placeholder?: string;
  className?: string;
}
```

**Layout Strategy:**
```
┌─────────────────────────────────────┐
│ [Weight Input Field] [Unit Selector] │  ← Single line, no layout shift
└─────────────────────────────────────┘
```

### Business Logic Components

#### WeightConverter Utility
```typescript
export class WeightConverter {
  // Conversion factors (grams as base unit)
  private static readonly CONVERSIONS = {
    g: 1,
    oz: 28.3495,
    lb: 453.592,
    kg: 1000,
  };

  static toGrams(value: number, unit: MealWeightUnit): number;
  static fromGrams(grams: number, unit: MealWeightUnit): number;
  static convert(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number;
  static formatDisplay(value: number, unit: WeightUnit): string;
}
```

#### UnitPreferenceManager Utility
```typescript
export class UnitPreferenceManager {
  private static readonly STORAGE_KEYS = {
    MEAL_UNIT: 'calgram_meal_weight_unit',
    BODY_UNIT: 'calgram_body_weight_unit',
  };

  static getMealWeightUnit(): MealWeightUnit;
  static setMealWeightUnit(unit: MealWeightUnit): void;
  static getBodyWeightUnit(): BodyWeightUnit;
  static setBodyWeightUnit(unit: BodyWeightUnit): void;
}
```

#### Enhanced CalorieCalculator
```typescript
export class CalorieCalculator {
  // Existing methods preserved
  static calculateMealCalories(weightInGrams: number, caloriesPerGram: number): number;
  static calculateDailyTotal(meals: MealEntry[], date: Date): number;
  static calculateCategoryBreakdown(meals: MealEntry[], date: Date): Record<string, number>;
  
  // New methods for unit-aware display
  static formatMealDisplay(meal: MealEntry, displayUnit?: MealWeightUnit): string;
  static getDisplayWeight(meal: MealEntry, displayUnit: MealWeightUnit): number;
}
```

## Data Models

### Migration Strategy

**Backward Compatibility Approach:**
1. **No Breaking Changes**: Existing fields remain unchanged
2. **Optional Extensions**: New unit fields are optional
3. **Default Behavior**: Legacy data assumes default units (grams for meals, pounds for body weight)
4. **Graceful Degradation**: App functions normally with or without unit fields

### Data Flow

#### Meal Entry Flow
```
User Input (value + unit) → Convert to grams → Store in weightInGrams
                         ↘ Store unit in displayUnit field
                         
Display: weightInGrams → Convert to current display unit → Show with unit label
```

#### Weight Entry Flow
```
User Input (value + unit) → Store value in weightValue
                         ↘ Store unit in unit field
                         
Display: weightValue + unit → Convert to current display unit → Show in charts
```

## UI Design Specifications

### Mobile-Optimized Form Layout

#### Meal Form Enhancement
```
Current Layout (Preserved):
┌─────────────────────────────────────┐
│ Date: [Input Field]                 │
│ Food: [Combobox]                    │
│ Category: [Combobox]                │
│ Weight: [Input] [g▼]  ← Added unit  │
│ Cal/g: [Input]                      │
│ Notes: [Textarea]                   │
│ [Log Meal Button]                   │
└─────────────────────────────────────┘
```

#### Weight Form Enhancement
```
Current Layout (Preserved):
┌─────────────────────────────────────┐
│ Date: [Input Field]                 │
│ Weight: [Input] [lbs▼] ← Added unit │
│ Notes: [Textarea]                   │
│ [Record Weight Button]              │
└─────────────────────────────────────┘
```

### Unit Selector Design Options

**Option 1: Inline Dropdown (Recommended)**
- Compact select element as input suffix
- Minimal width (40-50px)
- Consistent with existing form styling

**Option 2: Toggle Buttons (Alternative)**
- Small button group for 2-3 common units
- More touch-friendly on mobile
- Slightly wider but more accessible

### Display Formatting

#### Daily Summary Format
```
Before: "Chicken Breast (150g * 1.65 cal/g) Protein 248 cal"
After:  "Chicken Breast (5.3oz * 1.65 cal/g) Protein 248 cal"
         ↑ Converted to user's current display unit
```

#### Chart Labels
```
Y-axis labels: "Weight (kg)" or "Weight (lbs)"
Tooltips: "Jan 15: 70.5 kg" or "Jan 15: 155.4 lbs"
```

## Error Handling

### Validation Strategy
1. **Input Validation**: Reasonable ranges per unit type
2. **Conversion Safety**: Handle edge cases and precision
3. **Migration Safety**: Graceful handling of missing unit fields
4. **Storage Fallbacks**: Default units when preferences unavailable

### Error Scenarios
- **Invalid Conversions**: Display error and prevent submission
- **Missing Preferences**: Fall back to default units
- **Legacy Data**: Assume default units and display appropriately
- **Storage Failures**: Use in-memory preferences as fallback

## Testing Strategy

### Unit Testing
- **WeightConverter**: All conversion functions with edge cases
- **UnitPreferenceManager**: Local storage operations
- **Enhanced Calculators**: Unit-aware display formatting
- **Component Integration**: Unit selector behavior

### Integration Testing
- **Form Interactions**: Unit selection and value conversion
- **Data Migration**: Legacy data handling
- **Cross-Component**: Consistent unit display across pages
- **Preference Persistence**: Storage and retrieval

### Mobile Testing
- **Layout Preservation**: No form layout shifts
- **Touch Interactions**: Unit selector usability
- **Screen Sizes**: Responsive behavior across devices
- **Performance**: Smooth unit conversions

## Performance Considerations

### Optimization Strategies
1. **Lazy Conversion**: Convert only when displaying
2. **Memoization**: Cache conversion results
3. **Minimal Re-renders**: Efficient React state management
4. **Local Storage**: Fast preference retrieval

### Memory Management
- **Conversion Caching**: Limit cache size for frequently used conversions
- **Component Cleanup**: Proper cleanup of event listeners
- **Storage Efficiency**: Minimal local storage usage

## Security and Privacy

### Data Integrity
- **Conversion Accuracy**: Maintain precision in calculations
- **Input Sanitization**: Validate unit selections
- **Storage Security**: Secure local storage usage

### Migration Safety
- **Data Preservation**: Ensure no data loss during migration
- **Rollback Capability**: Ability to handle schema changes
- **Validation**: Verify data integrity after migration

## Implementation Phases

### Phase 1: Core Infrastructure
1. WeightConverter utility implementation
2. UnitPreferenceManager implementation
3. Schema extensions (optional fields)
4. Basic unit tests

### Phase 2: UI Integration
1. WeightUnitSelector component
2. Enhanced weight input components
3. Form integration (meal and weight pages)
4. Mobile layout testing

### Phase 3: Display Enhancement
1. Unit-aware display formatting
2. Chart axis and label updates
3. Daily summary formatting
4. Consistent unit display across app

### Phase 4: Polish and Testing
1. Comprehensive testing
2. Performance optimization
3. Error handling refinement
4. Final mobile optimization

This design ensures minimal disruption to the existing mobile-optimized experience while providing the requested weight unit functionality with seamless data migration and consistent display formatting.