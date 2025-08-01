# Technology Stack

## Core Framework & Build System

- **Build Tool**: Vite 7.0.5 with TypeScript support
- **Package Manager**: pnpm (required - enforced in package.json)
- **Node Version**: 22.17.1+ (managed via Volta)
- **Deployment**: Cloudflare Workers via Wrangler

## Frontend Stack

- **Framework**: React 19.1.0 with TypeScript
- **Routing**: React Router DOM v7
- **Styling**: TailwindCSS v4 with shadcn/ui components
- **State Management**: Jazz Tools (real-time collaborative data)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Date Handling**: Luxon for date/time operations

## Data & Sync

- **Real-time Sync**: Jazz Tools with Jazz Cloud (wss://cloud.jazz.tools)
- **Schema**: Jazz CoValues with Zod validation
- **Storage**: IndexedDB for local persistence
- **Authentication**: Passkey-based auth via Jazz

## Development Tools

- **Linting/Formatting**: Biome (replaces ESLint/Prettier)
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Type Checking**: TypeScript with strict configuration

## Common Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm preview               # Preview production build

# Deployment
pnpm deploy                # Build and deploy to Cloudflare

# Testing
pnpm test                  # Run unit tests in watch mode
pnpm test:run              # Run unit tests once
pnpm test:e2e              # Run E2E tests
pnpm test:e2e:ui           # Run E2E tests with UI

# Code Quality
pnpm format-and-lint       # Check formatting and linting
pnpm format-and-lint:fix   # Fix formatting and linting issues

# Cloudflare
pnpm cf-typegen           # Generate Cloudflare types
```

## Key Dependencies

- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Utilities**: clsx + tailwind-merge for conditional classes
- **Validation**: Zod schemas for runtime type checking
- **Real-time Data**: Jazz Tools for collaborative data structures