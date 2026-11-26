# Jazz 2 spike (reference only)

A minimal calgram-shaped app used on 2026-11-25/26 to prove the Jazz 2 migration before planning. It is not part of the app build. See `docs/plans/2026-11-26-0812-feat-jazz2-migration-plan.md`.

- `wrangler.jsonc`, `vite.config.ts`, `worker/index.ts`, `stubs/`: Jazz 2 in a Worker under `@cloudflare/vite-plugin`, with the Inspector stub.
- `schema.ts` and the generated `jazz.*` files: a one-table schema with owner-only permissions.
- `src/main.tsx`: the React client (`JazzProvider`, device accounts, passkey backup).
- `src/classic-lab.ts`: creates a Classic account on Jazz Cloud v1, and reads one back with no local storage.
- `tests/*.mjs`: Playwright scripts. Run `npm install` here, then `npx vite --port 5287`, then `node tests/<name>.mjs`. Set `URL=` to test a deployed copy.

| Script | Proves |
| --- | --- |
| `sync.mjs` | live sync, isolation between accounts, server rejecting another account's edits and deletes |
| `offline.mjs` | offline writes reach the server after reconnecting |
| `passkey.mjs` | passkey backup and restore across browser profiles (virtual authenticator) |
| `derived.mjs` | an HKDF-derived key opens the same account on every device; re-running writes is safe |
| `classic.mjs` | Classic (`jazz-classic`) and Jazz 2 load in one page |
| `classic-read.mjs` | a real Classic account read with no local cache, fed into the derived key and row ids |
| `classic-volume.mjs` | Classic read of 4,700 meals (1.4 s) |
| `jazz2-volume.mjs` | 4,700 Jazz 2 inserts acknowledged by the server (9.9 s under `vite dev`) |
| `guards.mjs` | `tier: "remote"` reads see server truth; inserting an existing or deleted id is rejected |
| `redeploy.mjs`, `isolation.mjs` | accounts survive a redeploy; Preview data is separate from production |
