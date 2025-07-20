# Design Document

## Overview

The calorie tracker application will be built on the existing Jazz React starter app, transforming it into a comprehensive nutrition and weight tracking system. The design leverages Jazz's collaborative data structures (CoValues) to provide real-time synchronization across devices while maintaining a modern, accessible user interface built with shadcn/ui components and React Router for navigation.

The application architecture follows Jazz best practices with a clear separation between data schemas, UI components, and business logic. The design emphasizes user experience through intelligent auto-completion, reactive calculations, and visual data representation using professional-grade UI components.

## Technology Stack

### Core Technologies
- **Jazz Framework**: Real-time collaborative data synchronization
- **React 19**: Modern React with concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tooling and development server

### UI Framework
- **shadcn/ui**: Modern, accessible component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework (already configured)
- **Radix UI**: Unstyled, accessible UI primitives (via shadcn/ui)
- **Lucide React**: Icon library (via shadcn/ui)

### Navigation & Routing
- **React Router v7**: Client-side routing with nested routes
- **React Router DOM**: Browser-specific routing components

### Data Visualization
- **Recharts**: React charting library for trends and pie charts
- **LOWESS**: Statistical trend line calculations

### Form Management
- **React Hook Form**: Performant form handling (integrated with shadcn/ui)
- **Zod**: Schema validation (already used by Jazz)

### Development Tools
- **Biome**: Code formatting and linting (already configured)
- **Playwright**: End-to-end testing (already configured)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Jazz React App                           │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (React + shadcn/ui + React Router)                │
│  ├── App Router (React Router v7)                           │
│  ├── Layout Component (Navigation + Header)                 │
│  ├── MealPage (shadcn Forms + Combobox)                     │
│  ├── WeightPage (shadcn Forms)                              │
│  ├── DailyPage (shadcn Cards + Charts)                      │
│  └── TrendPage (shadcn Charts + Analytics)                  │
├─────────────────────────────────────────────────────────────┤
│  UI Components (shadcn/ui)                                  │
│  ├── Forms (Input, Button, Label, Textarea)                 │
│  ├── Navigation (Tabs, Breadcrumb)                          │
│  ├── Data Display (Card, Table, Badge)                      │
│  ├── Feedback (Alert, Toast, Dialog)                        │
│  └── Charts (Recharts integration)                          │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer                                       │
│  ├── Calculation Utils (calories, trends)                   │
│  ├── Data Aggregation (daily summaries, categories)         │
│  ├── Chart Data Preparation                                 │
│  └── Auto-completion Logic                                  │
├─────────────────────────────────────────────────────────────┤
│  Data Layer (Jazz CoValues)                                 │
│  ├── Account Schema (Profile + Root)                        │
│  ├── Meal Entries (CoList)                                  │
│  ├── Weight Entries (CoList)                                │
│  └── Food Intelligence (CoMap for recent foods/categories)  │
├─────────────────────────────────────────────────────────────┤
│  Jazz Infrastructure                                         │
│  ├── Real-time Sync                                         │
│  ├── Local Storage                                          │
│  └── Authentication                                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Input Flow**: User interactions → Form validation → CoValue updates → Real-time sync
2. **Display Flow**: CoValue changes → Reactive calculations → UI updates
3. **Intelligence Flow**: User selections → Historical data lookup → Auto-population

## Components and Interfaces

### Core Data Schemas

#### MealEntry Schema
```typescript
export const MealEntry = co.map({
  timestamp: z.date(),
  foodName: z.string(),
  foodCategory: z.string(),
  caloriesPerGram: z.number(),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(), // Calculated field for performance
});
```

#### WeightEntry Schema
```typescript
export const WeightEntry = co.map({
  timestamp: z.date(),
  weightValue: z.number(),
  notes: z.string().optional(),
});
```

#### FoodIntelligence Schema
```typescript
export const FoodIntelligence = co.map({
  recentFoods: co.list(z.string()), // Last 12 food names
  recentCategories: co.list(z.string()), // Recent categories
  foodData: co.record(z.string(), co.map({
    lastUsedCPG: z.number(),
    lastUsedCategory: z.string(),
    usageCount: z.number(),
    lastUsed: z.date(),
  })), // Food name -> metadata mapping
});
```

#### Updated Account Schema
```typescript
export const CalorieTrackerProfile = co.profile({
  name: z.string(),
});

export const CalorieTrackerRoot = co.map({
  dateOfBirth: z.date(),
  mealEntries: co.list(MealEntry),
  weightEntries: co.list(WeightEntry),
  foodIntelligence: FoodIntelligence,
});
```

### UI Component Architecture

#### App Router Structure (React Router v7)
```typescript
// Route configuration
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/meals" replace /> },
      { path: "meals", element: <MealPage /> },
      { path: "weight", element: <WeightPage /> },
      { path: "daily", element: <DailyPage /> },
      { path: "trends", element: <TrendPage /> },
    ],
  },
]);
```

#### Layout Component
```typescript
interface LayoutProps {
  children: React.ReactNode;
}
```
Features:
- shadcn/ui navigation with Tabs component
- Responsive header with user information
- Consistent page structure and styling
- Outlet for nested routes

#### MealPage Component
```typescript
interface MealPageProps {
  // Uses Jazz useAccount hook internally
}

interface MealFormData {
  date: Date;
  foodName: string;
  category: string;
  weightInGrams: number;
  caloriesPerGram: number;
  notes: string;
}
```

shadcn/ui Components Used:
- `Card` for form container
- `Form` with react-hook-form integration
- `Input` for numeric fields
- `Combobox` for food name and category selection
- `Button` for form submission
- `Badge` for calorie display
- `Alert` for today's total calories

Key features:
- Auto-completing Combobox for food names and categories
- Reactive total calorie calculation using shadcn Badge
- Today's calorie summary in Alert component
- Form validation with shadcn form components

#### WeightPage Component
```typescript
interface WeightPageProps {
  // Uses Jazz useAccount hook internally
}

interface WeightFormData {
  date: Date;
  weight: number;
  notes: string;
}
```

shadcn/ui Components Used:
- `Card` for form container
- `Form` with validation
- `Input` for weight and date
- `Textarea` for notes
- `Button` for submission

#### DailyPage Component
```typescript
interface DailyPageProps {
  // Uses Jazz useAccount hook internally
}

interface DailyPageState {
  selectedDate: Date;
  mealEntries: MealEntry[];
  totalCalories: number;
  categoryBreakdown: Record<string, number>;
}
```

shadcn/ui Components Used:
- `Card` for summary containers
- `Button` for date navigation
- `Table` for meal entry list
- `Badge` for category tags
- `AlertDialog` for delete confirmations
- `PieChart` from Recharts (integrated with shadcn)

Features:
- Date navigation with shadcn Button components
- Pie chart for category breakdown using Recharts
- Detailed meal entry list in shadcn Table
- Delete functionality with AlertDialog confirmation
- Real-time calculation updates

#### TrendPage Component
```typescript
interface TrendPageProps {
  // Uses Jazz useAccount hook internally
}

interface TrendData {
  dailyCalories: Array<{ date: Date; calories: number }>;
  weightEntries: Array<{ date: Date; weight: number }>;
  caloriesTrend: number[];
  weightTrend: number[];
}
```

shadcn/ui Components Used:
- `Card` for chart containers
- `Select` for time range selection
- `ComposedChart` from Recharts
- `Badge` for data point indicators
- `Skeleton` for loading states

Features:
- 30-day default view with Select dropdown for range
- Dual-axis chart using Recharts ComposedChart
- LOWESS trend line calculations
- Responsive chart rendering with shadcn theming

### Business Logic Components

#### CalorieCalculator
```typescript
export class CalorieCalculator {
  static calculateMealCalories(weightInGrams: number, caloriesPerGram: number): number;
  static calculateDailyTotal(meals: MealEntry[], date: Date): number;
  static calculateCategoryBreakdown(meals: MealEntry[], date: Date): Record<string, number>;
}
```

#### FoodIntelligenceManager
```typescript
export class FoodIntelligenceManager {
  static updateFoodData(intelligence: FoodIntelligence, meal: MealEntry): void;
  static getRecentFoods(intelligence: FoodIntelligence): string[];
  static getRecentCategories(intelligence: FoodIntelligence): string[];
  static getFoodSuggestions(intelligence: FoodIntelligence, foodName: string): {
    caloriesPerGram: number;
    category: string;
  } | null;
}
```

#### TrendAnalyzer
```typescript
export class TrendAnalyzer {
  static calculateLOWESSTrend(data: number[], bandwidth: number): number[];
  static prepareDailyCalorieData(meals: MealEntry[], days: number): Array<{ date: Date; calories: number }>;
  static prepareWeightData(weights: WeightEntry[], days: number): Array<{ date: Date; weight: number }>;
}
```

## Data Models

### Meal Entry Data Model
- **Primary Key**: Auto-generated Jazz ID
- **Timestamp**: Date and time of meal consumption
- **Food Information**: Name, category, nutritional data
- **Quantity**: Weight in grams, calories per gram
- **Calculated Fields**: Total calories (weight × CPG)
- **Optional**: User notes

### Weight Entry Data Model
- **Primary Key**: Auto-generated Jazz ID
- **Timestamp**: Date and time of weight measurement
- **Weight Value**: Numeric weight measurement
- **Optional**: User notes for context

### Food Intelligence Data Model
- **Recent Foods List**: Ordered list of 12 most recent food names
- **Recent Categories List**: Ordered list of recent categories
- **Food Metadata Map**: 
  - Key: Food name (string)
  - Value: Object containing CPG, category, usage stats

### Chart Data Models
```typescript
interface PieChartData {
  category: string;
  calories: number;
  percentage: number;
  color: string;
}

interface TrendChartData {
  date: Date;
  calories?: number;
  weight?: number;
  caloriesTrend?: number;
  weightTrend?: number;
}
```

## Error Handling

### Input Validation Strategy
1. **Client-side Validation**: Immediate feedback using form validation
2. **Type Safety**: TypeScript and Zod schema validation
3. **Business Rule Validation**: Custom validation for nutritional data ranges
4. **User Feedback**: Clear error messages and field highlighting

### Error Categories
1. **Validation Errors**: Invalid input formats, missing required fields
2. **Calculation Errors**: Division by zero, negative values
3. **Data Consistency Errors**: Date conflicts, duplicate entries
4. **Network Errors**: Sync failures, offline scenarios

### Error Recovery
- **Graceful Degradation**: Continue functioning with cached data during network issues
- **Auto-retry**: Automatic retry for failed sync operations
- **User Notification**: Clear messaging about error states and recovery actions
- **Data Integrity**: Prevent data corruption through validation layers

## Testing Strategy

### Unit Testing
- **Calculation Functions**: Calorie calculations, trend analysis
- **Data Validation**: Schema validation, input sanitization
- **Business Logic**: Food intelligence, auto-completion logic
- **Utility Functions**: Date handling, data formatting
- **shadcn Component Integration**: Custom hooks and form validation

### Integration Testing
- **Jazz CoValue Operations**: CRUD operations on meal and weight entries
- **Real-time Sync**: Multi-device data synchronization
- **Form Interactions**: Complete user workflows with shadcn forms
- **Chart Rendering**: Data visualization accuracy with Recharts
- **React Router Navigation**: Route transitions and state preservation

### End-to-End Testing
- **User Workflows**: Complete meal logging and weight tracking flows
- **Route Navigation**: Seamless switching between application pages
- **Data Persistence**: Data survival across app restarts and route changes
- **Cross-device Sync**: Consistent data across multiple devices
- **Responsive Design**: shadcn component behavior across screen sizes

### Performance Testing
- **Large Dataset Handling**: Performance with extensive meal/weight history
- **Chart Rendering**: Smooth Recharts visualization with large datasets
- **Real-time Updates**: Responsive UI during data synchronization
- **Memory Usage**: Efficient memory management for long-running sessions
- **Route Transitions**: Fast navigation between pages

## Security and Privacy Considerations

### Data Privacy
- **Personal Health Data**: All meal and weight data remains private to the user
- **Jazz Permissions**: Proper group configuration for data access control
- **No Third-party Sharing**: Health data stays within Jazz ecosystem

### Authentication
- **Jazz Authentication**: Leverage existing Jazz auth mechanisms
- **Device Sync**: Secure synchronization across user's devices
- **Session Management**: Proper handling of user sessions

### Data Validation
- **Input Sanitization**: Prevent injection attacks through form inputs
- **Type Safety**: Strong typing to prevent data corruption
- **Business Rule Enforcement**: Validate nutritional data ranges

## Performance Optimization

### Data Loading Strategy
- **Lazy Loading**: Load historical data on-demand
- **Pagination**: Efficient handling of large meal/weight histories
- **Caching**: Cache calculated values for frequently accessed data
- **Indexing**: Efficient date-based queries for daily summaries

### UI Performance
- **Virtual Scrolling**: Handle large lists of meal entries efficiently
- **Debounced Calculations**: Optimize reactive calculations
- **Chart Optimization**: Efficient rendering of trend visualizations
- **Component Memoization**: Prevent unnecessary re-renders

### Memory Management
- **Data Cleanup**: Remove outdated cached calculations
- **Component Lifecycle**: Proper cleanup of event listeners and subscriptions
- **Chart Memory**: Efficient chart library usage to prevent memory leaks