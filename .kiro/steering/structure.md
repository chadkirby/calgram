# Project Structure

## Root Level Organization

```
├── src/                    # Main application source code
├── tests/                  # E2E tests (Playwright)
├── worker/                 # Cloudflare Worker code
├── dist/                   # Build output
├── .kiro/                  # Kiro AI assistant configuration
├── .cursor/                # Cursor IDE configuration
└── node_modules/           # Dependencies
```

## Source Code Structure (`src/`)

```
src/
├── components/             # React components
│   ├── ui/                # shadcn/ui components (auto-generated)
│   └── *.tsx              # Custom application components
├── pages/                 # Route-level page components
├── utils/                 # Business logic utilities
│   └── __tests__/         # Unit tests for utilities
├── hooks/                 # Custom React hooks
├── lib/                   # Shared utility functions
├── schema.ts              # Jazz CoValue schemas and types
├── router.tsx             # React Router configuration
├── Main.tsx               # Application entry point
└── index.css              # Global styles and Tailwind imports
```

## Key Architectural Patterns

### Component Organization
- **Pages**: Top-level route components in `src/pages/`
- **Components**: Reusable UI components in `src/components/`
- **UI Components**: shadcn/ui primitives in `src/components/ui/`
- **Layout**: Main layout wrapper with navigation tabs

### Data Layer
- **Schema**: Jazz CoValue definitions in `src/schema.ts`
- **Business Logic**: Utility classes in `src/utils/` (CalorieCalculator, FoodIntelligenceManager, TrendAnalyzer)
- **Hooks**: Custom React hooks in `src/hooks/`

### Routing Structure
- `/` → redirects to `/daily`
- `/daily` → Daily calorie summary page
- `/weight` → Weight tracking page  
- `/trends` → Trend analysis and charts

### Testing Structure
- **Unit Tests**: Co-located with utilities in `src/utils/__tests__/`
- **E2E Tests**: Playwright tests in `tests/`
- **Test Config**: Vitest for unit tests, Playwright for E2E

## File Naming Conventions

- **Components**: PascalCase (e.g., `MealEntryForm.tsx`)
- **Pages**: PascalCase with "Page" suffix (e.g., `DailyPage.tsx`)
- **Utilities**: PascalCase classes (e.g., `CalorieCalculator.ts`)
- **Hooks**: camelCase with "use" prefix (e.g., `useNetworkStatus.ts`)
- **Types**: Export from schema.ts or co-locate with components

## Import Patterns

- **Absolute Imports**: Use `@/` alias for src/ directory
- **UI Components**: Import from `@/components/ui/`
- **Utilities**: Import from `@/utils/` or use barrel export from `@/utils/index.ts`
- **Schema**: Import types and schemas from `@/schema`

## Configuration Files

- **TypeScript**: Multi-project setup with separate configs for app, node, and worker
- **Vite**: Main config with React, Cloudflare, and alias setup
- **Tailwind**: v4 configuration with shadcn/ui integration
- **Biome**: Unified linting and formatting configuration