import { useSyncExternalStore } from "react";
import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../jazz/jazz.generated";
import { exportAccount, isAlreadyPresent, planRowWrites } from "@/lib/backup";
import { toProfile } from "@/lib/data";
import { getJazzSession } from "@/lib/jazz";
import { DataImporter, type ImportPlan } from "@/utils/DataImporter";
import type { ExportedData } from "@/utils/DataExporter";
import { rowId } from "@/utils/rowIds";
import { deriveDeviceKey, findClassicSession, type ClassicIdentity } from "./classicIdentity";

/**
 * Where this browser's migration stands (plan's visit flowchart):
 * - `checking`: a Classic identity was found and it isn't known yet whether it needs
 *   migrating. Shows the same "Loading…" as the session.
 * - `moving`: copying Classic data ("Moving your data").
 * - `failed`: the guided screen, with retry and a download of the old data (R7).
 * - `idle`: nothing to do, or done. The app shows as usual.
 */
export type MigrationState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "moving"; copied: number; total: number }
  | { kind: "failed"; identity: ClassicIdentity };

let state: MigrationState = { kind: "idle" };
let running: Promise<void> | undefined;
const listeners = new Set<() => void>();

function setState(next: MigrationState) {
  state = next;
  for (const listener of listeners) listener();
}

export const getMigrationState = () => state;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useMigration = () => useSyncExternalStore(subscribe, getMigrationState);

/** Resolve once the session has settled: signed in, signed out, or failed. */
function settled(session = getJazzSession()) {
  return new Promise<void>((resolve) => {
    const check = () => {
      const { status } = session.getSnapshot();
      if (status === "starting" || status === "transitioning") return;
      unsubscribe();
      resolve();
    };
    const unsubscribe = session.subscribe(check);
    check();
  });
}

const idsOf = (rows: { id: string }[]) => new Set(rows.map((row) => row.id));

const setupStatusOf = (rows: Parameters<typeof toProfile>[0][]) =>
  rows.map(toProfile).find((row) => row.setupStatus)?.setupStatus;

/**
 * Insert each planned row that isn't there yet under its KTD5 id, and resolve once the
 * server has acknowledged every one. "Already exists" and "already deleted" count as
 * acknowledged. Any other rejection rejects.
 */
export async function copyRows(
  db: Pick<Db, "all" | "insert">,
  accountId: string,
  plan: ImportPlan,
  onCopied: () => void,
): Promise<void> {
  const [meals, weights] = await Promise.all([db.all(app.mealEntries), db.all(app.weightEntries)]);
  const mealWrites = await planRowWrites(accountId, plan.meals, idsOf(meals));
  const weightWrites = await planRowWrites(accountId, plan.weights, idsOf(weights));
  const acknowledged = async (write: { wait(options: { tier: "global" }): Promise<unknown> }) => {
    try {
      await write.wait({ tier: "global" });
    } catch (error) {
      if (!isAlreadyPresent(error)) throw error;
    }
    onCopied();
  };
  await Promise.all([
    ...mealWrites.inserts.map(({ id, row }) =>
      acknowledged(db.insert(app.mealEntries, row, { id })),
    ),
    ...weightWrites.inserts.map(({ id, row }) =>
      acknowledged(db.insert(app.weightEntries, row, { id })),
    ),
  ]);
}

function planOrThrow(data: ExportedData): ImportPlan {
  const plan = DataImporter.planImport(data);
  if (plan.errors.length > 0) {
    throw new Error(`Classic data didn't validate: ${plan.errors.slice(0, 5).join(", ")}`);
  }
  return plan;
}

/** The fixed id of a migrated account's profile row, so two devices write one row. */
export const migratedProfileId = (accountId: string) => rowId(accountId, "calgram:profile");

/** The profile row migration writes last (KTD6): the Classic names and units, `migrated`. */
export function migratedProfile(plan: ImportPlan, identity: ClassicIdentity): ProfileInsert {
  const { dateOfBirth: _dropped, ...fields } = plan.profile ?? {};
  return { ...fields, classicAccountId: identity.accountId, setupStatus: "migrated" };
}

/**
 * Where rows carried from a "Start" account wait until the derived account has them, so
 * a failed read or a reload after switching accounts doesn't lose them. Tagged with the
 * Classic account they're carried into.
 */
export const CARRIED_ROWS_KEY = "calgram-migration-carried-rows";

interface StoredCarry {
  classicAccountId: string;
  data: ExportedData;
}

/** Keep `data` until it's copied. Throws when storage refuses, before anything switches. */
function storeCarried(identity: ClassicIdentity, data: ExportedData) {
  const stored: StoredCarry = { classicAccountId: identity.accountId, data };
  localStorage.setItem(CARRIED_ROWS_KEY, JSON.stringify(stored));
}

export function storedCarried(identity: ClassicIdentity): ExportedData | undefined {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CARRIED_ROWS_KEY) ?? "null",
    ) as StoredCarry | null;
    return stored?.classicAccountId === identity.accountId ? stored.data : undefined;
  } catch {
    return undefined;
  }
}

function forgetCarried() {
  try {
    localStorage.removeItem(CARRIED_ROWS_KEY);
  } catch {
    // Storage unavailable: nothing was kept.
  }
}

async function migrate(
  identity: ClassicIdentity,
  report: (state: MigrationState) => void,
): Promise<void> {
  const session = getJazzSession();
  const key = await deriveDeviceKey(identity.seed);
  await settled(session);

  // Another account signed in here: leave a migrated one alone, and carry a native
  // one's rows into the derived account, so nothing logged under "Start" is lost. The
  // rows are kept in storage before switching, and dropped only once they're copied.
  const current = session.getSnapshot().user;
  if (current && session.exportDeviceKey() !== key) {
    const status = setupStatusOf(await session.db.all(app.profile));
    if (status === "migrated") return;
    storeCarried(identity, (await exportAccount(session.db, current.accountId, undefined)).data);
    await session.restoreDeviceAccount(key);
  } else if (!current) {
    await session.restoreDeviceAccount(key);
  }
  await settled(session);
  const carried = storedCarried(identity);

  const db = session.db;
  const accountId = session.getSnapshot().user?.accountId;
  if (!accountId) throw new Error("The derived account didn't open");

  // A status in the local copy is trusted; a missing one is confirmed with the server.
  const local = setupStatusOf(await db.all(app.profile));
  const done = local ?? setupStatusOf(await db.all(app.profile, { tier: "remote" }));

  let copied = 0;
  let total = 0;
  const progress = () => report({ kind: "moving", copied, total });
  const onCopied = () => {
    copied++;
    progress();
  };

  if (!done) {
    progress();
    const { readClassicAccount } = await import("./classicReader");
    const plan = planOrThrow(await readClassicAccount(identity));
    const carriedPlan = carried && planOrThrow(carried);
    total = plan.meals.length + plan.weights.length;
    total += (carriedPlan?.meals.length ?? 0) + (carriedPlan?.weights.length ?? 0);
    progress();
    await copyRows(db, accountId, plan, onCopied);
    if (carriedPlan) await copyRows(db, accountId, carriedPlan, onCopied);
    forgetCarried();
    const profile = db.insert(app.profile, migratedProfile(plan, identity), {
      id: await migratedProfileId(accountId),
    });
    try {
      await profile.wait({ tier: "global" });
    } catch (error) {
      // Another device finished first and wrote the same row.
      if (!isAlreadyPresent(error)) throw error;
    }
  } else if (carried) {
    await copyRows(db, accountId, planOrThrow(carried), onCopied);
    forgetCarried();
  }
}

/**
 * Migrate `identity` into its derived Jazz 2 account, unless that already happened
 * (R4 to R6). Safe to call again: a run in progress is shared, and every write is
 * insert-if-missing (KTD5). Ends `idle`, or `failed` with the guided screen (R7).
 */
export function beginMigration(identity: ClassicIdentity): Promise<void> {
  running ??= (async () => {
    // Progress from a run that already ended (a write acknowledged after another was
    // rejected) must not replace the screen that run left behind.
    let live = true;
    const report = (next: MigrationState) => {
      if (live) setState(next);
    };
    if (state.kind !== "moving") setState({ kind: "checking" });
    try {
      await migrate(identity, report);
      live = false;
      setState({ kind: "idle" });
    } catch (error) {
      live = false;
      console.error("Migration failed:", error);
      setState({ kind: "failed", identity });
    } finally {
      running = undefined;
    }
  })();
  return running;
}

/** On load: migrate this browser's Classic session, if it has a real one (R4, KTD13). */
export function migrateClassicSession() {
  const identity = findClassicSession();
  if (identity) void beginMigration(identity);
}

/**
 * "I've used Sammygram before" with a Classic passkey (R5). The identity is kept as this
 * browser's Classic session first, so a reload mid-migration resumes it.
 */
export async function migrateFromPasskey(identity: ClassicIdentity) {
  const { rememberClassicSession } = await import("./classicReader");
  await rememberClassicSession(identity);
  await beginMigration(identity);
}
