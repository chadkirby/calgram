/**
 * Read a returning user's whole Classic account from Jazz Cloud v1, read-only (R9).
 * Loaded lazily, so new visitors never download Classic.
 */
import {
  co,
  z,
  createJazzContextFromExistingCredentials,
  randomSessionProvider,
} from "jazz-classic";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createWebSocketPeer } from "cojson-transport-ws";
import { apiKey } from "@/apiKey";
import { DataExporter, type ExportedData } from "@/utils/DataExporter";
import { CLASSIC_SESSION_KEY, type ClassicIdentity } from "./classicIdentity";

// Read-side shapes only: plain strings and numbers, so reading never rejects a stored
// value. The import validation the rows go through afterwards checks them.
const Meal = co.map({
  timestamp: z.string(),
  foodName: z.string(),
  foodCategory: z.string(),
  caloriesPerGram: z.number(),
  caloriesPerDisplayUnit: z.string().optional(),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(),
  displayUnit: z.string().optional(),
});
const Weight = co.map({
  timestamp: z.string(),
  weightValue: z.number(),
  notes: z.string().optional(),
  unit: z.string().optional(),
});
const Profile = co.profile({
  name: z.string(),
  firstName: z.string().optional(),
  mealWeightUnit: z.string().optional(),
  bodyWeightUnit: z.string().optional(),
});
const Root = co.map({ mealEntries: co.list(Meal), weightEntries: co.list(Weight) });
// No withMigration: Classic's creates an empty root when it finds none, which would turn
// a failed load into an empty account (KTD6).
const Account = co.account({ profile: Profile, root: Root });

const CLASSIC_READ_TIMEOUT_MS = 30_000;

const CLASSIC_PEER_URL = `wss://cloud.jazz.tools/?key=${encodeURIComponent(apiKey)}`;

export interface ClassicReadOptions {
  peerUrl?: string;
  timeoutMs?: number;
}

/** Why a Classic read failed. Any failure means "can't migrate yet", never "empty". */
export class ClassicReadError extends Error {
  override name = "ClassicReadError";
}

type Loaded = {
  profile?: Record<string, unknown> | null;
  root?: {
    mealEntries?: readonly (Record<string, unknown> | null)[] | null;
    weightEntries?: readonly (Record<string, unknown> | null)[] | null;
  } | null;
};

/**
 * The loaded account as a v1.2 export: every meal and weigh-in with its Classic CoValue
 * id as its `id` (KTD5), and the profile's names and units. Throws `ClassicReadError`
 * when the root, either list, the profile, or any entry didn't load.
 */
export function toClassicExport(account: Loaded, now = new Date()): ExportedData {
  const { profile, root } = account;
  if (!profile) throw new ClassicReadError("The Classic profile didn't load");
  if (!root) throw new ClassicReadError("The Classic account root didn't load");
  const { mealEntries, weightEntries } = root;
  if (!mealEntries || !weightEntries) {
    throw new ClassicReadError("A Classic entry list didn't load");
  }
  if (mealEntries.some((meal) => !meal) || weightEntries.some((weight) => !weight)) {
    throw new ClassicReadError("Some Classic entries didn't load");
  }
  type Source = Parameters<typeof DataExporter.buildExport>[0];
  const data = DataExporter.buildExport(
    {
      profile: profile as Source["profile"],
      meals: mealEntries as unknown as Source["meals"],
      weights: weightEntries as unknown as Source["weights"],
    },
    now,
  );
  return { ...data, version: "1.2" };
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ClassicReadError(`Jazz Cloud didn't answer within ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Read the whole Classic account `identity` names, straight from Jazz Cloud v1 with no
 * local storage, so nothing comes from a stale browser cache. Writes nothing.
 */
export async function readClassicAccount(
  identity: ClassicIdentity,
  { peerUrl = CLASSIC_PEER_URL, timeoutMs = CLASSIC_READ_TIMEOUT_MS }: ClassicReadOptions = {},
): Promise<ExportedData> {
  const crypto = await WasmCrypto.create();
  const opening = createJazzContextFromExistingCredentials({
    credentials: {
      accountID: identity.accountId as never,
      secret: crypto.agentSecretFromSecretSeed(identity.seed),
    },
    peersToLoadFrom: [
      createWebSocketPeer({ id: "jazz-cloud", websocket: new WebSocket(peerUrl), role: "server" }),
    ],
    crypto,
    AccountSchema: Account,
    sessionProvider: randomSessionProvider,
  });
  // Whenever the context opens, even after a timeout, close it.
  const closed = opening.then((context) => context.done).catch(() => undefined);
  try {
    const loaded = await within(
      opening.then(({ account }) =>
        (account as unknown as { ensureLoaded(options: unknown): Promise<Loaded> }).ensureLoaded({
          resolve: {
            profile: true,
            root: { mealEntries: { $each: true }, weightEntries: { $each: true } },
          },
        }),
      ),
      timeoutMs,
    );
    return toClassicExport(loaded);
  } catch (error) {
    if (error instanceof ClassicReadError) throw error;
    throw new ClassicReadError("Couldn't read the Classic account", { cause: error });
  } finally {
    void closed.then((done) => done?.());
  }
}

/**
 * Keep `identity` as this browser's Classic session, in the format Classic's own passkey
 * log-in writes. A passkey migration interrupted by a reload then resumes from it. This
 * is the browser's copy of the session; Classic data on the server is untouched (R9).
 */
export async function rememberClassicSession(identity: ClassicIdentity) {
  const crypto = await WasmCrypto.create();
  localStorage.setItem(
    CLASSIC_SESSION_KEY,
    JSON.stringify({
      accountID: identity.accountId,
      secretSeed: Array.from(identity.seed),
      accountSecret: crypto.agentSecretFromSecretSeed(identity.seed),
      provider: "passkey",
    }),
  );
}
