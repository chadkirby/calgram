import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { serviceWorker } from "./vite-plugins/service-worker.ts";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker()],
  server: {
    host: true, // Allow external connections
  },
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // Drop jazz-tools' bundled Inspector UI from the Worker (see the stub).
      {
        find: /^\.\/inspector-ui-files\.js$/,
        replacement: fileURLToPath(new URL("./stubs/inspector-ui-files.js", import.meta.url)),
      },
    ],
  },
  build: {
    rollupOptions: {
      external: (id) => {
        return id.includes("__tests__");
      },
      onwarn(warning, warn) {
        // Suppress warnings about comments that Rollup can't interpret
        if (warning.code === "INVALID_ANNOTATION") {
          return;
        }
        warn(warning);
      },
    },
  },
  // @ts-ignore - vitest config
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    exclude: ["tests/", "node_modules/", "dist/"],
  },
});
