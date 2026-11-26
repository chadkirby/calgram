# Jazz Classic → Jazz 2 migration

Status: Worker spike done (2026-11-25). It covers build size and startup only, and no client has synced yet. Nothing deployed. App code still on Classic (`jazz-tools@0.15.13`).

## Decisions

- **Hosting:** Jazz 2 core runs inside the `calgram` Worker (`jazzWorker` from `jazz-tools/cloudflare`) on Workers Paid. Two SQLite Durable Objects (`JazzCore`, `JazzBackend`). R2 (`JAZZ_BLOBS`) is not needed for this app's small rows, so it is skipped.
- **Auth:** local-first device accounts (`authenticate: acceptDeviceAccounts`), with the device key backed up to a passkey (`BrowserPasskeyBackup` from `jazz-tools/passkey-backup`).
- **Data:** no Classic→Jazz 2 tooling exists. Users export JSON from the Classic build, then import it into the Jazz 2 build. The export format is now v1.1 and includes `profile` (name, firstName, dateOfBirth, unit preferences). Food intelligence is rebuilt from meals on import.

## Spike findings (`jazz-tools@2.0.0-beta.5`, wrangler 4.168)

- The schema is TypeScript in a root-level `schema.ts`: `export const schema = s.defineSchema({...})`, which must be a named export. `npx jazz-tools generate` writes `jazz.app.json`, `jazz.permissions.json` and `jazz.generated.ts`. Commit all three.
- Owner-only permissions: `const mine = { $createdBy: session.user }`, giving `{ read: mine, insert: true, update: mine, delete: mine }`.
- **Bundle size:** the default bundle is **12.0 MB gzipped, which is over the 10 MB paid limit**. 15 MB of it is the bundled Inspector UI (`jazz-tools/dist/backend/inspector-ui-files.js`). Aliasing that module to a stub (`export const INSPECTOR_UI_FILES = {};`) brings the bundle to **6.0 MB gzipped**. Wrangler `alias` does this. With `@cloudflare/vite-plugin`, use a Vite `resolve.alias` instead.
- **Inspector:** the stub patches an internal file path. Re-measure the bundle on every jazz-tools bump. Inspector API calls need signed agent tokens (`InspectorOptions.tokenSecret`, `maxTokenTtlSeconds`), so check how it's gated before going to production.
- `wrangler dev` runs the Worker, and the Jazz core starts. Without a `JAZZ_CORE_SECRET`, the core warns and generates its own secret, which is expected.
- The Cloudflare integration is marked **experimental** and may change in any release. Pin an exact version.
- Names are permanent once data exists. Do not rename the `JazzCore`/`JazzBackend` classes, the `JAZZ`/`JAZZ_BACKEND` bindings, or the Worker.

## Not yet verified

- A browser client syncing through `/jazz` (`acceptDeviceAccounts` admission, WebSocket).
- `$createdBy` ownership surviving `restoreDeviceAccount` on a second browser profile.
- The inspector stub, and wasm loading, under `@cloudflare/vite-plugin` (only plain wrangler was tested).
- Startup validation on a real upload. Dry runs and `wrangler dev` don't enforce it.
- A real v1.1 export from the running Classic app. Only unit tests cover it so far, and the Classic importer accepts `profile` but does not apply it.

## Cutover (undecided)

Classic data and passkeys are tied to the current hostname. Jazz 2 data is tied to the Worker name, and its passkey backup to `appHostname`. Both builds therefore want one permanent address. Options:
- **New Worker name and URL for Jazz 2.** Classic stays untouched where it is.
- **Take over `calgram`.** Do this only after every user has exported, and keep a redeploy of the old build as the rollback.

## Remaining steps

1. Ship the export change to Classic production and export the data.
2. Decouple `src/utils/*` from `Loaded<typeof …>` so they use plain row types. Import `z` from `zod`.
3. Port the schema: tables `mealEntries`, `weightEntries`, `foodMetadata`, plus a `profile` row that holds DOB and units. Recent foods and categories can be derived from `mealEntries`.
4. Worker: merge `jazzWorker` into `worker/index.ts` and add the DO bindings, migrations and `nodejs_compat` to `wrangler.jsonc`. Add the inspector alias.
5. Client: `JazzProvider` with local-first, then replace `useAccount` with `useAll`/`useOne`/`useDb`. Replace passkey auth with device account plus passkey backup.
6. Run the importer against the Jazz 2 build, test end to end, then deploy.
