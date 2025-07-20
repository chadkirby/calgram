# Implementation Plan

- [x] 1. Setup Dependencies and Project Structure
  - Install and configure shadcn/ui, React Router, and Recharts dependencies
  - Initialize shadcn/ui configuration and components
  - Set up React Router with basic routing structure
  - Configure TypeScript types for new dependencies
  - _Requirements: 6.1, 6.2_

- [x] 2. Update Jazz Schema for Calorie Tracking
  - [x] 2.1 Create MealEntry schema with all required fields
    - Define MealEntry CoMap with timestamp, foodName, foodCategory, caloriesPerGram, weightInGrams, notes, and calculated totalCalories
    - Add proper Zod validation for all fields
    - _Requirements: 1.2_
  
  - [x] 2.2 Create WeightEntry schema
    - Define WeightEntry CoMap with timestamp, weightValue, and optional notes
    - Add Zod validation for weight measurements
    - _Requirements: 3.2_
  
  - [x] 2.3 Create FoodIntelligence schema for auto-completion
    - Define FoodIntelligence CoMap with recentFoods list, recentCategories list, and foodData record
    - Create nested schema for food metadata (CPG, category, usage stats)
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 2.4 Update CalorieTrackerRoot schema
    - Extend AccountRoot to include mealEntries CoList, weightEntries CoList, and foodIntelligence CoMap
    - Update CalorieTrackerProfile to include name and firstName fields
    - _Requirements: 1.2, 3.2, 7.1_
  
  - [x] 2.5 Update account migration logic
    - Modify JazzAccount migration to initialize new CoLists and CoMaps
    - Ensure proper Group creation and permissions for private data
    - Test migration with existing accounts
    - _Requirements: 7.1, 7.2_

- [x] 3. Create Business Logic and Utility Functions
  - [x] 3.1 Implement CalorieCalculator utility class
    - Create calculateMealCalories function (weight * CPG)
    - Create calculateDailyTotal function for date-based meal aggregation
    - Create calculateCategoryBreakdown function for pie chart data
    - Add comprehensive unit tests for all calculations
    - _Requirements: 1.5, 4.3, 4.4_
  
  - [x] 3.2 Implement FoodIntelligenceManager utility class
    - Create updateFoodData function to maintain recent foods and categories
    - Create getRecentFoods function returning 12 most recent food names
    - Create getRecentCategories function for category suggestions
    - Create getFoodSuggestions function for auto-populating CPG and category
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.3 Implement TrendAnalyzer utility class
    - Create calculateLOWESSTrend function for trend line smoothing
    - Create prepareDailyCalorieData function for chart data formatting
    - Create prepareWeightData function for weight trend visualization
    - Add data aggregation functions for 30-day periods
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 4. Set Up React Router and Layout Structure
  - [x] 4.1 Configure React Router with nested routes
    - Set up BrowserRouter with routes for /meals, /weight, /daily, /trends
    - Create route configuration with proper TypeScript typing
    - Implement redirect from root to /meals as default
    - _Requirements: 6.1, 6.4_
  
  - [x] 4.2 Create Layout component with navigation
    - Build Layout component using shadcn/ui Tabs for navigation
    - Add responsive header with user name display
    - Implement Outlet for nested route rendering
    - Style navigation with consistent theming
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 4.3 Update Main.tsx to use React Router
    - Wrap App with RouterProvider instead of direct App rendering
    - Maintain Jazz provider structure around router
    - Ensure proper provider nesting order
    - _Requirements: 6.1_

- [x] 5. Build MealPage Component and Form
  - [x] 5.1 Create MealPage component structure
    - Set up page layout using shadcn/ui Card components
    - Add "Log Meal for <user name>" header with user's firstName
    - Create form container with proper spacing and responsive design
    - _Requirements: 1.1, 6.3_
  
  - [x] 5.2 Implement meal entry form with shadcn/ui components
    - Create date Input field with proper date handling
    - Build food name Combobox with search and selection functionality
    - Build category Combobox with recent categories
    - Add weight Input field with number validation
    - Add calories per gram Input field with decimal support
    - Add optional notes Textarea field
    - _Requirements: 1.2, 2.1, 2.2_
  
  - [x] 5.3 Implement auto-completion logic
    - Connect food name Combobox to FoodIntelligenceManager.getRecentFoods
    - Connect category Combobox to FoodIntelligenceManager.getRecentCategories
    - Implement food selection handler to auto-populate CPG and category
    - Add debounced search functionality for food names
    - _Requirements: 2.3, 2.4_
  
  - [x] 5.4 Add reactive calorie calculations and displays
    - Create reactive total calories Badge showing weight * CPG
    - Implement today's total calories Alert using CalorieCalculator.calculateDailyTotal
    - Update calculations in real-time as user types
    - Handle edge cases (zero values, invalid inputs)
    - _Requirements: 1.5, 1.6_
  
  - [x] 5.5 Implement form submission and validation
    - Add form validation using react-hook-form and Zod
    - Create "Log Meal" Button with proper loading states
    - Implement meal entry creation and CoList updates
    - Update FoodIntelligence data after successful submission
    - Clear form and show success feedback after logging
    - _Requirements: 1.7, 8.1, 8.2, 8.3_

- [x] 6. Build WeightPage Component and Form
  - [x] 6.1 Create WeightPage component structure
    - Set up page layout using shadcn/ui Card
    - Add "Record Weight for <username>" header
    - Create form container with proper styling
    - _Requirements: 3.1, 6.3_
  
  - [x] 6.2 Implement weight entry form
    - Create date Input field with current date default
    - Add weight Input field with number validation and proper units
    - Add optional notes Textarea field
    - Implement form validation with appropriate error messages
    - _Requirements: 3.2, 8.1, 8.2_
  
  - [x] 6.3 Implement weight entry submission
    - Create "Record Weight" Button with loading states
    - Implement weight entry creation and CoList updates
    - Clear form and show success feedback after recording
    - Handle validation errors and display user-friendly messages
    - _Requirements: 3.3, 8.3, 8.4_

- [x] 7. Build DailyPage Component with Summary and Charts
  - [x] 7.1 Create DailyPage component structure
    - Set up page layout with "Daily Calorie Summary" header
    - Create date navigation section with forward/back Button controls
    - Add summary cards for total calories and meal count
    - _Requirements: 4.1, 4.2_
  
  - [x] 7.2 Implement date navigation functionality
    - Create date state management with today as default
    - Implement forward/back navigation with proper date handling
    - Add date picker for direct date selection
    - Filter meal entries by selected date
    - _Requirements: 4.2_
  
  - [x] 7.3 Create pie chart for category breakdown
    - Integrate Recharts PieChart component with shadcn/ui theming
    - Use CalorieCalculator.calculateCategoryBreakdown for data
    - Add proper colors and labels for each category
    - Handle empty data states gracefully
    - Make chart responsive and accessible
    - _Requirements: 4.4_
  
  - [x] 7.4 Build meal entry list with delete functionality
    - Create Table component showing meal entries for selected date
    - Format entries as: "<food name> (<weight>g * <CPG> cal/g) <category> <total calories> cal [delete]"
    - Implement delete Button for each entry with AlertDialog confirmation
    - Update all calculations when entries are deleted
    - Handle empty states when no meals exist for selected date
    - _Requirements: 4.5, 4.6_

- [ ] 8. Build TrendPage Component with Analytics
  - [ ] 8.1 Create TrendPage component structure
    - Set up page layout with "Calorie Trend" header
    - Add time range selector using shadcn/ui Select (default 30 days)
    - Create chart container with proper responsive sizing
    - _Requirements: 5.1, 5.2_
  
  - [ ] 8.2 Implement dual-axis trend chart
    - Integrate Recharts ComposedChart with Bar and Line components
    - Configure left axis for calories (greenish bars) and right axis for weight (blueish dots)
    - Use TrendAnalyzer.prepareDailyCalorieData and prepareWeightData for chart data
    - Ensure proper scaling and labeling for both axes
    - _Requirements: 5.3, 5.4_
  
  - [ ] 8.3 Add LOWESS trend lines
    - Implement TrendAnalyzer.calculateLOWESSTrend for both calorie and weight data
    - Overlay smoothed trend lines on the chart (greenish for calories, blueish for weight)
    - Handle cases with insufficient data points for trend calculation
    - Make trend lines visually distinct from raw data points
    - _Requirements: 5.5_
  
  - [ ] 8.4 Add chart interactivity and responsiveness
    - Implement tooltip showing detailed information on hover
    - Add chart responsiveness for different screen sizes
    - Handle loading states while calculating trends
    - Provide fallback display when no data is available
    - _Requirements: 5.6_

- [ ] 9. Implement Error Handling and Validation
  - [ ] 9.1 Add comprehensive form validation
    - Implement client-side validation for all numeric inputs (positive values, reasonable ranges)
    - Add date validation to prevent future dates where inappropriate
    - Create user-friendly error messages for all validation scenarios
    - Highlight invalid fields with shadcn/ui error styling
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 9.2 Implement error boundaries and fallback UI
    - Create React error boundaries for each major page component
    - Add fallback UI components using shadcn/ui Alert for error states
    - Implement retry mechanisms for failed operations
    - Log errors appropriately for debugging
    - _Requirements: 8.4_
  
  - [ ] 9.3 Add network error handling
    - Handle Jazz sync failures gracefully with user notifications
    - Implement offline functionality with local data caching
    - Show connection status and retry options
    - Ensure data integrity during network interruptions
    - _Requirements: 7.3, 8.5_

- [ ] 10. Add Data Persistence and Real-time Updates
  - [ ] 10.1 Implement real-time data synchronization
    - Ensure all components properly subscribe to Jazz CoValue changes
    - Update UI reactively when data changes from other devices/sessions
    - Test multi-device synchronization scenarios
    - _Requirements: 7.2, 7.3_
  
  - [ ] 10.2 Optimize data loading and caching
    - Implement efficient data loading strategies for large datasets
    - Add pagination or virtual scrolling for large meal/weight histories
    - Cache calculated values to improve performance
    - _Requirements: 7.1_

- [ ] 11. Polish UI and User Experience
  - [ ] 11.1 Add loading states and skeleton screens
    - Implement shadcn/ui Skeleton components for loading states
    - Add loading spinners for form submissions and data operations
    - Create smooth transitions between different states
    - _Requirements: 6.2_
  
  - [ ] 11.2 Implement toast notifications
    - Add shadcn/ui Toast components for success/error feedback
    - Show confirmation messages for successful meal/weight logging
    - Display error notifications for failed operations
    - _Requirements: 8.4_
  
  - [ ] 11.3 Enhance responsive design
    - Ensure all components work well on mobile devices
    - Optimize chart rendering for different screen sizes
    - Test and refine touch interactions for mobile users
    - _Requirements: 6.2_
  
  - [ ] 11.4 Add accessibility improvements
    - Ensure proper ARIA labels and keyboard navigation
    - Test with screen readers and improve accessibility
    - Add focus management for better keyboard navigation
    - Verify color contrast and visual accessibility
    - _Requirements: 6.2_

- [ ] 12. Testing and Quality Assurance
  - [ ] 12.1 Write unit tests for business logic
    - Test CalorieCalculator functions with various input scenarios
    - Test FoodIntelligenceManager with edge cases
    - Test TrendAnalyzer calculations and data preparation
    - Achieve high test coverage for utility functions
    - _Requirements: All calculation requirements_
  
  - [ ] 12.2 Write integration tests for Jazz operations
    - Test meal and weight entry CRUD operations
    - Test real-time synchronization between components
    - Test data migration and schema updates
    - Verify proper error handling in data operations
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 12.3 Add end-to-end tests for user workflows
    - Test complete meal logging workflow from form to display
    - Test weight tracking and trend visualization
    - Test navigation between pages and data persistence
    - Test multi-device synchronization scenarios
    - _Requirements: All user story requirements_

- [ ] 13. Performance Optimization and Final Polish
  - [ ] 13.1 Optimize chart rendering performance
    - Implement efficient data processing for large datasets
    - Add chart virtualization if needed for performance
    - Optimize re-rendering of charts when data updates
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [ ] 13.2 Final UI polish and bug fixes
    - Review and refine all UI components for consistency
    - Fix any remaining bugs found during testing
    - Optimize bundle size and loading performance
    - Add final touches to animations and transitions
    - _Requirements: 6.2_