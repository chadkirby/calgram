import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// A simple build hash that changes every prod build to drive SW versioning
const BUILD_HASH = process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.CF_PAGES_COMMIT_SHA
  || process.env.GITHUB_SHA
  || Date.now().toString();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    host: true, // Allow external connections
    allowedHosts: ["ck.lion-solfege.ts.net"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  build: {
    rollupOptions: {
      external: (id) => {
        return id.includes('__tests__')
      },
      onwarn(warning, warn) {
        // Suppress warnings about comments that Rollup can't interpret
        if (warning.code === 'INVALID_ANNOTATION') {
          return;
        }
        warn(warning);
      },
      // Ensure the service worker is emitted to /sw.js
      output: {
        // keep default
      },
    },
  },
  // @ts-ignore - vitest config
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    exclude: ["tests/", "node_modules/", "dist/"],
  },
});
