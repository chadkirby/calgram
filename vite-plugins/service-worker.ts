import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/** Public files the installed app shows: the home-screen manifest, its icons, the header logo. */
const PUBLIC_FILES = [
  "/manifest.webmanifest",
  "/logo-192-maskable.png",
  "/logo-512-maskable.png",
  "/logo.webp",
];

/** Chunks only the Classic migration loads. New visitors never fetch them, so don't precache. */
const SKIP_CHUNK = /^classicReader\b/;

/**
 * Writes `sw.js` into the client build: a service worker that precaches what the app
 * needs to start (the page, the entry chunk and everything it loads, including Jazz's
 * worker and wasm), so a launch needs no network. The cache name is a hash of those
 * files' contents, so any change installs a fresh cache.
 */
export function serviceWorker(): Plugin {
  const files = new Set<string>();
  return {
    name: "sammygram-service-worker",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",

    // After Vite emits index.html, which names the icons.
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        files.clear();
        const visit = (fileName: string) => {
          const item = bundle[fileName];
          if (!item || files.has(fileName)) return;
          if (item.type === "chunk" && SKIP_CHUNK.test(item.name)) return;
          files.add(fileName);
          if (item.type === "chunk") {
            for (const next of [
              ...item.imports,
              ...item.dynamicImports,
              ...(item.viteMetadata?.importedCss ?? []),
              ...(item.viteMetadata?.importedAssets ?? []),
            ]) {
              visit(next);
            }
          }
          // Workers and wasm (`new URL(..., import.meta.url)`) and the page's icons aren't
          // imports: pick up any emitted file this one's text names.
          const text = item.type === "chunk" ? item.code : item.source;
          if (typeof text !== "string") return;
          for (const other of Object.keys(bundle)) {
            if (!files.has(other) && text.includes(path.basename(other))) visit(other);
          }
        };
        visit("index.html");
        for (const item of Object.values(bundle)) {
          if (item.type === "chunk" && item.isEntry) visit(item.fileName);
        }
        // The page is precached as "/".
        files.delete("index.html");
      },
    },

    async writeBundle(options) {
      const outDir = options.dir!;
      // "/" is the page itself; every app route is served from it (an SPA).
      const urls = ["/", ...PUBLIC_FILES, ...[...files].toSorted().map((file) => `/${file}`)];
      const contents = await Promise.all(
        urls.map((url) => readFile(path.join(outDir, url === "/" ? "index.html" : url))),
      );
      const template = await readFile(new URL("./sw.js", import.meta.url), "utf8");
      // The worker's own code counts too, so a change to it alone still gets a fresh cache.
      const hash = createHash("sha256").update(template);
      for (const [i, url] of urls.entries()) hash.update(url).update(contents[i]);
      const build = { version: hash.digest("hex").slice(0, 16), files: urls };

      const placeholder = 'const BUILD = { version: "dev", files: [] };';
      if (!template.includes(placeholder)) throw new Error("sw.js lost its BUILD placeholder");
      await writeFile(
        path.join(outDir, "sw.js"),
        template.replace(placeholder, `const BUILD = ${JSON.stringify(build)};`),
      );
    },
  };
}
