import { defineConfig, devices } from "@playwright/test";

// Startup timing on a production build in WebKit. See tests/perf/meal-load.perf.ts.
const port = 4174;

export default defineConfig({
  testDir: "./tests/perf",
  testMatch: "**/*.perf.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}/` },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: `pnpm build && pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    timeout: 300_000,
    reuseExistingServer: false,
  },
});
