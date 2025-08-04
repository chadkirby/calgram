import fs from "node:fs";
import path from "node:path";
import process from "node:process";


// Target the built artifact that gets deployed
const swPath = path.resolve(import.meta.dirname, '..', "dist", "client", "sw.js");

if (!fs.existsSync(swPath)) {
  console.log(`[postbuild] ${swPath} not found; skipping hash injection. Did you run 'vite build' first?`);
  process.exit(0);
}

// Prefer CI-provided commit SHAs; fallback to ISO timestamp for readability.
const HASH =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  new Date().toISOString();

const content = fs.readFileSync(swPath, "utf8");

// Replace any existing VERSION assignment on that line with a fixed hash string.
// Use multiline flag to ensure we only match up to the line break.
const finalContent = content.replace(
  /^const VERSION\s*=.+$/m,
  `const VERSION = '${HASH}';`
);

fs.writeFileSync(swPath, finalContent);
console.log(`[postbuild] Injected BUILD_HASH into ${path.relative(process.cwd(), swPath)}: ${HASH}`);
