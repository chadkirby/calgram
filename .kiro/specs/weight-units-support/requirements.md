# Requirements Document

## Introduction

This document outlines the requirements for adding weight unit support to the existing CalGram calorie tracker application. The enhancement will allow users to enter weights in different units (grams, ounces, pounds, kilograms) for both meal items and body weight tracking, making the app more accessible to users who prefer different measurement systems while maintaining accurate calorie calculations.

## Requirements

### Requirement 1: Meal Weight Unit Selection

**User Story:** As a user, I want to enter meal weights in different units (grams, ounces, pounds, kilograms), so that I can use the measurement system I'm most comfortable with.

#### Acceptance Criteria

1. WHEN a user enters meal weight THEN the system SHALL provide a compact unit selector (dropdown or toggle) integrated with the weight input field
2. WHEN a user selects a weight unit THEN the system SHALL convert the value to grams internally for accurate calorie calculations
3. WHEN a user enters a weight value and unit THEN the system SHALL store the gram-converted weight in the existing weightInGrams field and add a separate unit field
4. WHEN a user changes the weight unit THEN the system SHALL automatically convert the displayed value to the new unit while preserving the internal gram value
5. WHEN calculating total calories THEN the system SHALL use the existing gram-based weight for CPG calculations
6. WHEN the form loads THEN the system SHALL default to the user's most recently used meal weight unit

### Requirement 2: Body Weight Unit Selection

**User Story:** As a user, I want to enter my body weight in different units (pounds, kilograms), so that I can track my weight using my preferred measurement system.

#### Acceptance Criteria

1. WHEN a user enters body weight THEN the system SHALL provide a compact unit selector integrated with the weight input field
2. WHEN a user selects a weight unit THEN the system SHALL store the weight value in the existing weightValue field and add a separate unit field
3. WHEN a user changes the weight unit THEN the system SHALL automatically convert the displayed value to the new unit
4. WHEN a user submits a weight entry THEN the system SHALL save the weight value and selected unit
5. WHEN the form loads THEN the system SHALL default to the user's most recently used body weight unit

### Requirement 3: Weight Unit Display and Formatting

**User Story:** As a user, I want to see weights displayed consistently in my most recently used units, so that I can easily understand trends and compare values.

#### Acceptance Criteria

1. WHEN displaying meal entries in the daily summary THEN the system SHALL show weights converted to the user's most recently used meal weight unit in the format: "<food name> (<weight><unit> * <cpg> cal/g) <category> <total calories> cal"
2. WHEN displaying weight trends in charts THEN the system SHALL convert all body weights to the user's most recently used body weight unit
3. WHEN showing weight values in forms THEN the system SHALL display a compact unit indicator integrated with the input field
4. WHEN displaying chart axes and labels THEN the system SHALL show the current display unit (e.g., "Weight (kg)" or "Weight (lbs)")
5. WHEN showing tooltips or hover information THEN the system SHALL display values in the current display unit with unit labels

### Requirement 4: Weight Conversion Utilities

**User Story:** As a developer, I want accurate weight conversion functions, so that the system can seamlessly convert between different weight units while maintaining precision.

#### Acceptance Criteria

1. WHEN converting from ounces to grams THEN the system SHALL use the conversion factor 28.3495 grams per ounce
2. WHEN converting from pounds to grams THEN the system SHALL use the conversion factor 453.592 grams per pound
3. WHEN converting from kilograms to grams THEN the system SHALL use the conversion factor 1000 grams per kilogram
4. WHEN converting between units THEN the system SHALL maintain precision to at least 2 decimal places
5. WHEN performing reverse conversions THEN the system SHALL use the inverse conversion factors accurately
6. WHEN handling edge cases THEN the system SHALL gracefully handle zero values and very small/large numbers

### Requirement 5: Data Migration and Backward Compatibility

**User Story:** As an existing user, I want my historical data to remain intact when weight units are added, so that I don't lose any of my tracking history.

#### Acceptance Criteria

1. WHEN the weight units feature is deployed THEN existing meal entries SHALL continue to use the existing weightInGrams field without modification
2. WHEN the weight units feature is deployed THEN existing weight entries SHALL continue to use the existing weightValue field without modification
3. WHEN displaying legacy meal data THEN the system SHALL treat entries without unit fields as grams and display them accordingly
4. WHEN displaying legacy weight data THEN the system SHALL treat entries without unit fields as pounds and display them accordingly
5. WHEN new entries are created THEN the system SHALL add unit fields while preserving existing data structure compatibility
6. WHEN calculating trends and summaries THEN the system SHALL seamlessly handle both legacy entries (without unit fields) and new entries (with unit fields)

### Requirement 6: User Preference Persistence

**User Story:** As a user, I want the app to remember my most recently used weight units, so that I don't have to select them every time I enter data.

#### Acceptance Criteria

1. WHEN a user submits a meal entry with a weight unit THEN the system SHALL remember this as their most recently used meal weight unit
2. WHEN a user submits a weight entry with a weight unit THEN the system SHALL remember this as their most recently used body weight unit
3. WHEN a user opens the meal form THEN the system SHALL default to their most recently used meal weight unit (or grams if none exists)
4. WHEN a user opens the weight form THEN the system SHALL default to their most recently used body weight unit (or pounds if none exists)
5. WHEN preferences are stored THEN the system SHALL persist them to local storage for simplicity and immediate availability

### Requirement 7: Mobile-Optimized Form Design

**User Story:** As a mobile user, I want the weight unit selection to be integrated seamlessly into the existing form layout, so that I can still enter data efficiently on a single screen.

#### Acceptance Criteria

1. WHEN viewing forms on mobile devices THEN the weight unit selector SHALL be integrated inline with the weight input field to maintain single-page layout
2. WHEN the unit selector is displayed THEN it SHALL use minimal screen space (e.g., suffix dropdown, toggle buttons, or compact select)
3. WHEN a user interacts with the unit selector THEN it SHALL not cause form layout shifts or require scrolling
4. WHEN the form is displayed THEN all existing fields SHALL remain visible and accessible on mobile screens
5. WHEN unit selection changes THEN the form SHALL maintain focus and cursor position for seamless data entry

### Requirement 8: Form Validation and Error Handling

**User Story:** As a user, I want the app to validate my weight entries and handle unit conversions gracefully, so that I can trust the accuracy of my data.

#### Acceptance Criteria

1. WHEN a user enters invalid weight values THEN the system SHALL display clear error messages
2. WHEN weight values are outside reasonable ranges THEN the system SHALL warn the user and request confirmation
3. WHEN unit conversions fail THEN the system SHALL display appropriate error messages and prevent data corruption
4. WHEN network issues occur during unit preference sync THEN the system SHALL use local preferences and sync when reconnected
5. WHEN displaying converted values THEN the system SHALL round appropriately to avoid confusing decimal precision