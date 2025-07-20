# Requirements Document

## Introduction

This document outlines the requirements for converting the existing Jazz starter app into a comprehensive calorie tracker application. The application will enable users to log meals, track weight changes, and visualize their calorie consumption and weight trends over time through an intuitive tabbed interface.

## Requirements

### Requirement 1: Meal Entry Management

**User Story:** As a user, I want to log meal entries with detailed nutritional information, so that I can track my daily calorie intake accurately.

#### Acceptance Criteria

1. WHEN a user accesses the Meal tab THEN the system SHALL display a "Log Meal for <user name>" header
2. WHEN a user enters meal information THEN the system SHALL capture timestamp, food name, food category, calories per gram (CPG), weight in grams, and optional notes
3. WHEN a user selects a food item from the combo box THEN the system SHALL auto-populate the CPG field with the most recently used value for that food
4. WHEN a user selects a food item from the combo box THEN the system SHALL auto-populate the category field with the most recently used category for that food
5. WHEN a user enters weight and CPG values THEN the system SHALL reactively display the total calories (weight * CPG)
6. WHEN a user is entering a meal THEN the system SHALL display the total calories consumed so far today (excluding the current entry being worked on)
7. WHEN a user clicks "Log Meal" THEN the system SHALL save the meal entry and clear the form

### Requirement 2: Food Item Intelligence

**User Story:** As a user, I want the app to remember my frequently used foods and their nutritional information, so that I can quickly log similar meals without re-entering data.

#### Acceptance Criteria

1. WHEN a user opens the food item combo box THEN the system SHALL display the 12 most recently used food names
2. WHEN a user types in the food item combo box THEN the system SHALL allow entry of arbitrary food names not in the recent list
3. WHEN a user opens the category combo box THEN the system SHALL display the most recently used food categories
4. WHEN a food item is selected THEN the system SHALL retrieve and display the most recent CPG and category values associated with that food

### Requirement 3: Weight Tracking

**User Story:** As a user, I want to record my weight measurements over time, so that I can monitor my weight trends alongside my calorie intake.

#### Acceptance Criteria

1. WHEN a user accesses the Weight tab THEN the system SHALL display a "Record Weight for <username>" header
2. WHEN a user enters weight information THEN the system SHALL capture timestamp, weight value, and optional notes
3. WHEN a user clicks "Record Weight" THEN the system SHALL save the weight entry and clear the form
4. WHEN a weight entry is saved THEN the system SHALL make it available for trend analysis

### Requirement 4: Daily Calorie Summary

**User Story:** As a user, I want to view my daily calorie consumption broken down by food categories, so that I can understand my eating patterns and make informed dietary decisions.

#### Acceptance Criteria

1. WHEN a user accesses the Daily tab THEN the system SHALL display a "Daily Calorie Summary" header
2. WHEN the Daily tab loads THEN the system SHALL default to showing today's data with forward/back navigation controls
3. WHEN a user selects a date THEN the system SHALL display the total calories consumed for that day
4. WHEN a user views a day's summary THEN the system SHALL display a pie chart showing calories by food category
5. WHEN a user views a day's summary THEN the system SHALL display a list of meal entries in the format: "<food name> (<food_weight>g * <food_cpg> cal/g) <food_category> <total_calories> cal [delete control]"
6. WHEN a user clicks a delete control THEN the system SHALL remove that meal entry and update all calculations

### Requirement 5: Trend Analysis and Visualization

**User Story:** As a user, I want to see long-term trends in my calorie intake and weight changes, so that I can track my progress toward health goals.

#### Acceptance Criteria

1. WHEN a user accesses the Trend tab THEN the system SHALL display a "Calorie Trend" header
2. WHEN the Trend tab loads THEN the system SHALL default to showing the past 30 days of data
3. WHEN trend data is displayed THEN the system SHALL show greenish vertical bars for each day's total calories using the left axis
4. WHEN trend data is displayed THEN the system SHALL show blueish dots for each weight entry using the right axis
5. WHEN trend data is displayed THEN the system SHALL overlay LOWESS-smoothed trend lines for both daily calories (greenish) and weight (blueish)
6. WHEN insufficient data exists for trend analysis THEN the system SHALL display available data points without trend lines

### Requirement 6: User Interface and Navigation

**User Story:** As a user, I want to navigate easily between different functions of the calorie tracker, so that I can efficiently manage my health data.

#### Acceptance Criteria

1. WHEN a user accesses the application THEN the system SHALL display a tabbed interface with Meal, Weight, Daily, and Trend tabs
2. WHEN a user clicks on any tab THEN the system SHALL switch to that tab's content without losing unsaved data in other tabs
3. WHEN displaying user-specific information THEN the system SHALL show the user's name in headers and personalized messages
4. WHEN the application loads THEN the system SHALL default to the Meal tab for quick meal logging

### Requirement 7: Data Persistence and Synchronization

**User Story:** As a user, I want my calorie and weight data to be saved and synchronized across my devices, so that I can access my information anywhere.

#### Acceptance Criteria

1. WHEN a user logs a meal or weight entry THEN the system SHALL persist the data using Jazz CoValues
2. WHEN a user accesses the app from multiple devices THEN the system SHALL synchronize all meal and weight data in real-time
3. WHEN data is modified on one device THEN the system SHALL update the display on all other connected devices
4. WHEN calculations are performed THEN the system SHALL use the most current synchronized data

### Requirement 8: Data Validation and Error Handling

**User Story:** As a user, I want the app to validate my input and handle errors gracefully, so that I can trust the accuracy of my tracked data.

#### Acceptance Criteria

1. WHEN a user enters invalid data THEN the system SHALL display clear error messages and prevent submission
2. WHEN required fields are empty THEN the system SHALL highlight missing fields and prevent form submission
3. WHEN numeric fields receive non-numeric input THEN the system SHALL show validation errors
4. WHEN date fields receive invalid dates THEN the system SHALL show appropriate error messages
5. WHEN network connectivity is lost THEN the system SHALL continue to function with local data and sync when reconnected