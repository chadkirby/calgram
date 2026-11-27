// Test-only: creates Classic accounts on Jazz Cloud v1 the way the Classic app stored
// them, signs this browser in to one, and registers its Classic passkey. Driven by
// tests/migration.spec.ts through `window.classicHarness`. Served by `vite dev`; not
// part of the app build.
import { co, z, Group, cojsonInternals, createJazzContextForNewAccount } from "jazz-classic";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createWebSocketPeer } from "cojson-transport-ws";
import { readClassicAccount } from "../../src/migration/classicReader";
import { CLASSIC_SESSION_KEY } from "../../src/migration/classicIdentity";

// A key of its own: test accounts don't count against the app's. Classic reads work
// across keys, which is how the app reads these.
const PEER_URL = "wss://cloud.jazz.tools/?key=calgram-e2e%40example.com";

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
const Root = co.map({
  dateOfBirth: z.string(),
  mealEntries: co.list(Meal),
  weightEntries: co.list(Weight),
});
const Account = co.account({ profile: Profile, root: Root });

export interface ClassicSeed {
  profile: { name: string; firstName: string; mealWeightUnit?: string; bodyWeightUnit?: string };
  meals: Record<string, unknown>[];
  weights: Record<string, unknown>[];
}

export interface ClassicAccount {
  accountID: string;
  seed: number[];
  accountSecret: string;
}

const peer = () =>
  createWebSocketPeer({ id: "jazz-cloud", websocket: new WebSocket(PEER_URL), role: "server" });

const harness = {
  async create(data: ClassicSeed): Promise<ClassicAccount> {
    const crypto = await WasmCrypto.create();
    const seed = crypto.newRandomSecretSeed();
    const context = await createJazzContextForNewAccount({
      creationProps: { name: data.profile.name },
      initialAgentSecret: crypto.agentSecretFromSecretSeed(seed),
      peersToLoadFrom: [peer()],
      crypto,
      AccountSchema: Account,
    });
    const me = context.account as any;
    const { profile } = await me.ensureLoaded({ resolve: { profile: true } });
    Object.assign(profile, { ...data.profile });
    const group = Group.create({ owner: me });
    me.root = Root.create(
      {
        dateOfBirth: "1990-01-01",
        mealEntries: co.list(Meal).create(
          data.meals.map((meal) => Meal.create(meal as never, group)),
          group,
        ),
        weightEntries: co.list(Weight).create(
          data.weights.map((weight) => Weight.create(weight as never, group)),
          group,
        ),
      },
      group,
    );
    await me.waitForAllCoValuesSync({ timeout: 60_000 });
    const account = {
      accountID: me.id as string,
      seed: Array.from(seed),
      accountSecret: crypto.agentSecretFromSecretSeed(seed),
    };
    context.done();
    return account;
  },

  signIn(account: ClassicAccount, provider = "passkey") {
    localStorage.setItem(
      CLASSIC_SESSION_KEY,
      JSON.stringify({
        accountID: account.accountID,
        secretSeed: account.seed,
        accountSecret: account.accountSecret,
        provider,
      }),
    );
  },

  async registerPasskey(account: ClassicAccount) {
    const handle = new Uint8Array(51);
    handle.set(account.seed);
    handle.set(cojsonInternals.rawCoIDtoBytes(account.accountID as never), 32);
    await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(20)),
        rp: { name: "Sammygram Calorie Tracker", id: location.hostname },
        user: { id: handle, name: "Classic tester", displayName: "Classic tester" },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
        timeout: 60_000,
        attestation: "none",
      },
    });
  },

  read: (account: ClassicAccount) =>
    readClassicAccount({ seed: Uint8Array.from(account.seed), accountId: account.accountID }),
};

(window as unknown as { classicHarness: typeof harness }).classicHarness = harness;
document.body.dataset.ready = "true";
