# Jazz Classic → Jazz 2 migration

Status: spikes done (2026-11-25/26), including a real Cloudflare deploy, a Worker Preview, and a real Classic read. Nothing deployed to calgram. App code still on Classic (`jazz-tools@0.15.13`). A production v1.1 export from 2026-11-26 (4,627 meals, 69 weigh-ins) served as sample data only; it is not meant to be imported. Import takes v1.2 (Classic, with ids) and v1.3 (Jazz 2) files.

## Decisions

- **Hosting:** Jazz 2 core runs inside the `calgram` Worker (`jazzWorker` from `jazz-tools/cloudflare`) on Workers Paid. Two SQLite Durable Objects (`JazzCore`, `JazzBackend`). R2 (`JAZZ_BLOBS`) is not needed for this app's small rows, so it is skipped.
- **Auth:** local-first device accounts (`authenticate: acceptDeviceAccounts`), with the device key backed up to a passkey (`BrowserPasskeyBackup` from `jazz-tools/passkey-backup`).
- **Data:** no Classic→Jazz 2 tooling exists, so the new build reads each user's Classic account itself and copies it into Jazz 2 (see the plan). JSON export and import remain the manual backup. The export format is now v1.1 and includes `profile` (name, firstName, dateOfBirth, unit preferences). Food intelligence is rebuilt from meals on import.

## Spike findings (`jazz-tools@2.0.0-beta.5`, wrangler 4.168)

- The schema is TypeScript in a root-level `schema.ts`: `export const schema = s.defineSchema({...})`, which must be a named export. `npx jazz-tools generate` writes `jazz.app.json`, `jazz.permissions.json` and `jazz.generated.ts`. Commit all three.
- Owner-only permissions: `const mine = { $createdBy: session.user }`, giving `{ read: mine, insert: true, update: mine, delete: mine }`.
- **Bundle size:** the default bundle is **12.0 MB gzipped, which is over the 10 MB paid limit**. 15 MB of it is the bundled Inspector UI (`jazz-tools/dist/backend/inspector-ui-files.js`). Aliasing that module to a stub (`export const INSPECTOR_UI_FILES = {};`) brings the bundle to **6.0 MB gzipped**. Wrangler `alias` does this. With `@cloudflare/vite-plugin`, use a Vite `resolve.alias` instead.
- **Inspector:** the stub patches an internal file path. Re-measure the bundle on every jazz-tools bump. Inspector API calls need signed agent tokens (`InspectorOptions.tokenSecret`, `maxTokenTtlSeconds`), so check how it's gated before going to production.
- `wrangler dev` runs the Worker, and the Jazz core starts. Without a `JAZZ_CORE_SECRET`, the core warns and generates its own secret, which is expected.
- The Cloudflare integration is marked **experimental** and may change in any release. Pin an exact version.
- Names are permanent once data exists. Do not rename the `JazzCore`/`JazzBackend` classes, the `JAZZ`/`JAZZ_BACKEND` bindings, or the Worker.

## Browser sync spike (`@cloudflare/vite-plugin` 1.70, Vite 8.3, React 19.3)

This spike mirrors calgram's setup: a React app plus a Worker that runs `jazzWorker`. It was driven by Playwright, with each browser profile as its own context. Every check below passed both under `vite dev` and against the built output (`vite build && vite preview`, which runs the built Worker and client chunks locally).

- **Sync:** the client uses `<JazzProvider config={{ serverUrl: "/jazz", initial: "device", client: () => import("jazz-tools/local-first"), localFirst: "now" }}>`, with `useAll(app.weightEntries)`, `useDb().insert(...)` and `useJazzSession()`. It starts as a device account at once, the backend admits it through `acceptDeviceAccounts`, and the WASM engine loads from Vite without extra config. Writes in one profile show up live in another.
- **Permissions:** a second fresh profile gets its own account. It still sees none of the first account's rows 4 seconds after those rows reached the server. When it tries to `update` or `delete` them by id, the server rejects the write (`permission_denied`), and the owner's rows stay unchanged.
- **Persistence and offline:** a reload keeps the same account and rows. A write made offline shows locally, and once the browser is back online it reaches the server: a fresh profile restored from the key sees it.
- **Restore keeps ownership:**
  - `session.exportDeviceKey()` returns a 56-character key, and `restoreDeviceAccount(key)` in a fresh profile becomes the same account, loads its rows from the server and can write them.
  - `BrowserPasskeyBackup` stores that key as the passkey's `userHandle`, in a discoverable credential with `rpId` = hostname. It was tested with Chromium virtual authenticators: one profile backs up, the credential is copied to a second profile (standing in for passkey sync), and `restore()` there returns the same account.
- **Worker bundle under Vite:** the inspector stub works as a Vite `resolve.alias` (`{ find: /^\.\/inspector-ui-files\.js$/, replacement: <stub> }`). Without any wrangler `alias`, the Vite-built Worker is **6.0 MB gzipped**. The client's local-first WASM is a separate lazy asset (4.1 MB gzipped).
- **Classic and Jazz 2 in one app:**
  - `jazz-classic@npm:jazz-tools@0.15.13` installs next to `jazz-tools@2`.
  - Classic's internal `jazz-tools/...` imports still resolve to Classic, through package self-reference, because its `package.json` name is unchanged.
  - Both clients load in the same page: Classic in its own lazy chunk (278 kB gzipped) while the Jazz 2 session stays ready.
  - Not tested: reading real Classic data that way, which needs a Classic passkey on the production hostname.
- **Dev gotcha:** after adding a dependency, Vite's optimizer can leave `504 (Outdated Optimize Dep)` responses. Restart with `vite --force`.

## Not yet verified

- Passkey sync across real devices (iCloud Keychain or Google Password Manager). This should work because the key lives in `userHandle`, but only virtual authenticators were tested.
- A real user's production migration. Classic passkeys and sessions exist only on the production hostname, so Previews can only prove the mechanics, using seeded Classic accounts.

Verified on 2026-11-26 (formerly listed here):

- Startup validation on a real upload: a throwaway Worker deployed and started in 98 ms at 6.0 MB gzipped, and passed the sync tests, as did a Preview of it.
- Reading a real Classic account from a Jazz 2 page, with no local cache.
- Telling Classic and Jazz 2 passkeys apart: Classic handles are 51 bytes, Jazz 2 handles are 32 (see the plan's KTD7).

## Notes

- Production's Classic client connects to Jazz Cloud v1 with the key `fallback@example.com`. No Cloudflare build sets `VITE_JAZZ_API_KEY`; the real value lives only in a local `.env.local`. The key identifies the app and doesn't gate data: an account written under one key reads fine under another (`spikes/jazz2/tests/cross-key.mjs`). Left as is on purpose.

## Plan

Decisions about cutover, data migration and sequencing now live in `docs/plans/2026-11-26-0812-feat-jazz2-migration-plan.md`. In short, Jazz 2 takes over calgram's address, and each user is migrated automatically on their first visit. The spike code and test scripts are in `spikes/jazz2/`.
