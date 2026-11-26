import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: [
      // Drop jazz-tools' bundled Inspector UI (15 MB) from the Worker bundle.
      {
        find: /^\.\/inspector-ui-files\.js$/,
        replacement: fileURLToPath(new URL("./stubs/inspector-ui-files.js", import.meta.url)),
      },
    ],
  },
});
