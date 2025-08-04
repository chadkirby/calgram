import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    host: true, // Allow external connections
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
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
