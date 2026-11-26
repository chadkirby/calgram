import { expect, test, type Browser, type Page } from "@playwright/test";

// Each account's rows are private (plan R11, U4). Two browser contexts are two
// device accounts talking to the Worker's /jazz endpoint under `vite dev`.

type Harness = {
  user(): string | null;
  key(): string;
  restore(key: string): Promise<void>;
  addMeal(foodName: string): Promise<string>;
  serverMeals(): Promise<{ id: string; foodName: string }[]>;
  tryWrite(op: "update" | "delete", id: string): Promise<string>;
};

declare global {
  interface Window {
    jazzHarness: Harness;
  }
}

async function openAccount(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/tests/harness/jazz.html");
  await page.waitForFunction(() => document.body.dataset.ready === "true", null, {
    timeout: 30_000,
  });
  return page;
}

test("another account cannot read, change or delete my rows", async ({ browser }) => {
  const owner = await openAccount(browser);
  const mealId = await owner.evaluate(() => window.jazzHarness.addMeal("Owner's oats"));

  const other = await openAccount(browser);
  expect(await other.evaluate(() => window.jazzHarness.user())).not.toBe(
    await owner.evaluate(() => window.jazzHarness.user()),
  );
  expect(await other.evaluate(() => window.jazzHarness.serverMeals())).toEqual([]);

  const update = await other.evaluate((id) => window.jazzHarness.tryWrite("update", id), mealId);
  const remove = await other.evaluate((id) => window.jazzHarness.tryWrite("delete", id), mealId);
  expect(update).toMatch(/^rejected/);
  expect(remove).toMatch(/^rejected/);

  expect(await owner.evaluate(() => window.jazzHarness.serverMeals())).toEqual([
    { id: mealId, foodName: "Owner's oats" },
  ]);
});

test("the same key reaches the same account and rows from another browser", async ({ browser }) => {
  const first = await openAccount(browser);
  const mealId = await first.evaluate(() => window.jazzHarness.addMeal("Toast"));
  const key = await first.evaluate(() => window.jazzHarness.key());

  const second = await openAccount(browser);
  await second.evaluate((k) => window.jazzHarness.restore(k), key);
  expect(await second.evaluate(() => window.jazzHarness.user())).toBe(
    await first.evaluate(() => window.jazzHarness.user()),
  );
  expect(await second.evaluate(() => window.jazzHarness.serverMeals())).toEqual([
    { id: mealId, foodName: "Toast" },
  ]);
});
