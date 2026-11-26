// Test-only Jazz 2 client, driven by tests/jazz-isolation.spec.ts through
// `window.jazzHarness`. Served by `vite dev`; not part of the app build.
import { createJazzClient } from "jazz-tools";
import { app } from "../../jazz/jazz.generated";

const session = await createJazzClient({
  serverUrl: "/jazz",
  initial: "device",
  client: () => import("jazz-tools/local-first"),
  localFirst: "now",
});
const db = () => session.db as any;

const meal = (foodName: string) => ({
  timestamp: "2026-11-26T08:00:00.000-08:00",
  foodName,
  foodCategory: "Test",
  caloriesPerGram: 1,
  weightInGrams: 100,
  totalCalories: 100,
});

const harness = {
  user: () => session.getSnapshot().user?.accountId ?? null,
  key: () => session.exportDeviceKey(),
  restore: (key: string) => session.restoreDeviceAccount(key),
  /** Insert a meal and wait until the server has it. Returns its id. */
  addMeal: async (foodName: string) => {
    const handle = db().insert(app.mealEntries, meal(foodName));
    await handle.wait({ tier: "global" });
    return handle.value.id as string;
  },
  /** What the server holds for this account, not the local cache. */
  serverMeals: async () =>
    (
      (await db().all(app.mealEntries, { tier: "remote" })) as { id: string; foodName: string }[]
    ).map((m) => ({ id: m.id, foodName: m.foodName })),
  /** Try to change or delete a row; return how the server answered. */
  tryWrite: async (op: "update" | "delete", id: string) => {
    try {
      const handle =
        op === "update"
          ? db().update(app.mealEntries, id, { foodName: "changed by another account" })
          : db().delete(app.mealEntries, id);
      await handle.wait({ tier: "global" });
      return "accepted";
    } catch (error) {
      return `rejected: ${String(error)}`;
    }
  },
};

(window as unknown as { jazzHarness: typeof harness }).jazzHarness = harness;
document.body.dataset.ready = "true";
