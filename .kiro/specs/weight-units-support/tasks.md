# Implementation Plan

- [x] 1. Create Weight Conversion Utilities
  - Implement WeightConverter class with accurate conversion factors for grams, ounces, pounds, and kilograms
  - Add conversion methods: toGrams(), fromGrams(), convert(), and formatDisplay()
  - Create comprehensive unit tests covering edge cases, precision, and all conversion combinations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Implement Unit Preference Management
  - Create UnitPreferenceManager class using localStorage for meal and body weight unit preferences
  - Add methods: getMealWeightUnit(), setMealWeightUnit(), getBodyWeightUnit(), setBodyWeightUnit()
  - Implement fallback defaults (grams for meals, pounds for body weight) when no preferences exist
  - Write unit tests for storage operations and fallback behavior
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. Extend Jazz Schemas for Unit Support
  - Add optional displayUnit field to MealEntry schema with enum validation for 'g', 'oz', 'lb', 'kg'
  - Add optional unit field to WeightEntry schema with enum validation for 'lbs', 'kg'
  - Ensure backward compatibility by making new fields optional
  - Test schema migration with existing data to verify no breaking changes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 4. Create Compact Weight Unit Selector Component
  - Build WeightUnitSelector component as inline dropdown with minimal width (40-50px)
  - Implement props for value, onChange, available units, and compact mode
  - Style component to match existing shadcn/ui form elements without layout shifts
  - Add proper ARIA labels and keyboard navigation for accessibility
  - Test component on mobile devices to ensure touch-friendly interaction
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Create Enhanced Weight Input Component
  - Build WeightInput component combining number input with inline unit selector
  - Implement automatic value conversion when unit changes while preserving user input flow
  - Ensure component maintains existing mobile form layout without requiring additional screen space
  - Add proper validation and error handling for weight values and unit combinations
  - Test component integration with existing form validation systems
  - _Requirements: 1.1, 1.4, 2.1, 2.3, 7.1, 7.2, 7.3_

- [ ] 6. Enhance MealPage with Unit Support
  - Replace existing weight input field with enhanced WeightInput component
  - Integrate unit selector for meal weight with options: grams, ounces, pounds, kilograms
  - Implement preference loading to default to user's most recently used meal weight unit
  - Update form submission to store both gram-converted weight and display unit
  - Ensure calorie calculations continue using gram values for accuracy
  - Test mobile layout to verify no form layout changes or scrolling issues
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 6.1, 6.3, 7.1, 7.3, 7.4_

- [ ] 7. Enhance WeightPage with Unit Support
  - Replace existing weight input field with enhanced WeightInput component
  - Integrate unit selector for body weight with options: pounds, kilograms
  - Implement preference loading to default to user's most recently used body weight unit
  - Update form submission to store weight value and selected unit
  - Test mobile layout preservation and ensure single-page form remains intact
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 6.2, 6.4, 7.1, 7.3, 7.4_

- [ ] 8. Update Daily Summary Display with Unit Conversion
  - Enhance CalorieCalculator with formatMealDisplay() method for unit-aware meal entry formatting
  - Modify daily summary meal list to display weights in user's current meal weight unit
  - Update meal entry format to show: "<food name> (<weight><unit> * <cpg> cal/g) <category> <total calories> cal"
  - Handle legacy meal entries without unit fields by defaulting to grams
  - Test display formatting with mixed legacy and new data entries
  - _Requirements: 3.1, 5.3, 5.6_

- [ ] 9. Update Trend Charts with Consistent Unit Display
  - Modify TrendAnalyzer to convert all weight entries to user's most recently used body weight unit
  - Update chart axis labels to show current display unit (e.g., "Weight (kg)" or "Weight (lbs)")
  - Enhance chart tooltips to display weight values in consistent units with proper labels
  - Handle legacy weight entries without unit fields by defaulting to pounds
  - Test chart display with historical data spanning different units
  - _Requirements: 3.2, 3.4, 5.4, 5.6_

- [ ] 10. Implement Form Validation and Error Handling
  - Add validation for reasonable weight ranges per unit type (e.g., 1-5000g, 0.1-11lbs for meals)
  - Implement error handling for unit conversion failures with user-friendly messages
  - Add validation warnings for extreme values with confirmation prompts
  - Handle localStorage failures by falling back to default units
  - Create error boundaries for unit conversion operations to prevent app crashes
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Add Unit Tests for Enhanced Components
  - Write comprehensive tests for WeightConverter covering all conversion scenarios
  - Test UnitPreferenceManager with localStorage mocking and fallback scenarios
  - Create tests for WeightUnitSelector component behavior and accessibility
  - Test enhanced CalorieCalculator methods for unit-aware display formatting
  - Add integration tests for form components with unit selection and conversion
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.5, 8.3, 8.4_

- [ ] 12. Mobile Layout Testing and Optimization
  - Test all enhanced forms on various mobile screen sizes to ensure no layout shifts
  - Verify touch interactions work smoothly for unit selectors on mobile devices
  - Confirm single-page form layout is preserved for both meal and weight entry
  - Test keyboard navigation and accessibility on mobile browsers
  - Optimize component rendering performance for smooth mobile experience
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 13. Integration Testing and Data Migration Verification
  - Test app behavior with existing Jazz CoValue data to ensure seamless migration
  - Verify legacy data displays correctly with default unit assumptions
  - Test real-time synchronization of new unit-enhanced entries across devices
  - Confirm mixed data scenarios (legacy + new entries) work correctly in all views
  - Test preference persistence across browser sessions and app restarts
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.5_