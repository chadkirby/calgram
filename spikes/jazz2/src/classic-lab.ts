// Spike: create a Classic account on Jazz Cloud v1, then read it back with no local storage.
import {
  co,
  z,
  Group,
  createJazzContextForNewAccount,
  createJazzContextFromExistingCredentials,
  randomSessionProvider,
} from "jazz-classic";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createWebSocketPeer } from "cojson-transport-ws";

const Meal = co.map({ timestamp: z.string(), foodName: z.string(), totalCalories: z.number() });
const Weight = co.map({ timestamp: z.string(), weightValue: z.number() });
const Root = co.map({ mealEntries: co.list(Meal), weightEntries: co.list(Weight) });
// No withMigration: a missing root must stay missing (a failed load), not be created empty.
const Acct = co.account({ profile: co.profile(), root: Root });

const peer = (key: string) =>
  createWebSocketPeer({
    id: "jazz-cloud",
    websocket: new WebSocket(`wss://cloud.jazz.tools/?key=${encodeURIComponent(key)}`),
    role: "server",
  });

export async function createClassic(key: string, meals: { timestamp: string; foodName: string; totalCalories: number }[]) {
  const crypto = await WasmCrypto.create();
  const seed = crypto.newRandomSecretSeed();
  const ctx = await createJazzContextForNewAccount({
    creationProps: { name: "spike" },
    initialAgentSecret: crypto.agentSecretFromSecretSeed(seed),
    peersToLoadFrom: [peer(key)],
    crypto,
    AccountSchema: Acct,
  });
  const me: any = ctx.account;
  const owner = Group.create({ owner: me });
  const root = Root.create(
    {
      mealEntries: co.list(Meal).create(meals.map((m) => Meal.create(m, owner)), owner),
      weightEntries: co.list(Weight).create([Weight.create({ timestamp: "2026-10-30", weightValue: 80 }, owner)], owner),
    },
    owner,
  );
  me.root = root;
  await me.waitForAllCoValuesSync({ timeout: 20000 });
  const out = { accountID: me.id as string, seed: Array.from(seed), mealIds: root.mealEntries!.map((m: any) => m.id) };
  ctx.done();
  return out;
}

export async function readClassic(key: string, accountID: string, seed: number[]) {
  const crypto = await WasmCrypto.create();
  const ctx = await createJazzContextFromExistingCredentials({
    credentials: { accountID: accountID as any, secret: crypto.agentSecretFromSecretSeed(new Uint8Array(seed)) },
    peersToLoadFrom: [peer(key)],
    crypto,
    AccountSchema: Acct,
    sessionProvider: randomSessionProvider,
  });
  const t = Date.now();
  const me: any = await (ctx.account as any).ensureLoaded({
    resolve: { profile: true, root: { mealEntries: { $each: true }, weightEntries: { $each: true } } },
  });
  const res = {
    ms: Date.now() - t,
    hasRoot: !!me.root,
    meals: me.root?.mealEntries?.map((m: any) => ({ id: m.id, timestamp: m.timestamp, foodName: m.foodName, totalCalories: m.totalCalories })),
    weights: me.root?.weightEntries?.map((w: any) => ({ id: w.id, timestamp: w.timestamp, weightValue: w.weightValue })),
    indexedDBs: (await indexedDB.databases()).map((d) => d.name),
  };
  ctx.done();
  return res;
}
