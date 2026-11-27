import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { ClassicAccount, ClassicSeed } from "./harness/classic-harness";
import {
  addMeal,
  exportFile,
  importFile,
  launchRecord,
  openDataCard,
  openWithAuthenticator,
  startNewAccount,
  watchLaunch,
} from "./support/app";

// U9: automatic migration from Classic. These tests create real Classic accounts on
// Jazz Cloud v1 (under a test key), so they need it to be up.
test.describe.configure({ timeout: 180_000 });

const meal = (foodName: string, timestamp: string, extra: Record<string, unknown> = {}) => ({
  timestamp,
  foodName,
  foodCategory: "Dry food",
  caloriesPerGram: 3.5,
  weightInGrams: 100,
  totalCalories: 350,
  ...extra,
});

/** Entries across two dates: offset, `Z` and date-only timestamps, plus two identical meals. */
const seed: ClassicSeed = {
  profile: { name: "Sam Classic", firstName: "Sam", mealWeightUnit: "oz", bodyWeightUnit: "kg" },
  meals: [
    meal("Kibble", "2025-07-27T08:30:00.000-07:00", { displayUnit: "g", notes: "morning" }),
    meal("Kibble", "2025-07-27T08:30:00.000-07:00", { displayUnit: "g", notes: "morning" }),
    meal("Backdated treat", "2025-07-27T06:00:00.000Z", { caloriesPerDisplayUnit: "oz" }),
    meal("Toast", "2025-07-28"),
  ],
  weights: [
    { timestamp: "2025-07-27T07:00:00.000-07:00", weightValue: 10.5, unit: "kg" },
    { timestamp: "2025-07-28", weightValue: 10.4 },
  ],
};

type Harness = {
  create(data: ClassicSeed): Promise<ClassicAccount>;
  signIn(account: ClassicAccount, provider?: string): void;
  registerPasskey(account: ClassicAccount): Promise<void>;
  read(account: ClassicAccount): Promise<{ mealEntries: unknown[]; weightEntries: unknown[] }>;
};
declare const classicHarness: Harness;

async function openHarness(page: Page) {
  await page.goto("/tests/harness/classic.html");
  await page.waitForFunction(() => document.body.dataset.ready === "true");
}

async function createClassic(page: Page, data = seed) {
  await openHarness(page);
  return page.evaluate((d) => classicHarness.create(d), data);
}

async function signInToClassic(page: Page, account: ClassicAccount, provider = "passkey") {
  await openHarness(page);
  await page.evaluate(([a, p]) => classicHarness.signIn(a, p), [account, provider] as const);
}

async function readClassic(page: Page, account: ClassicAccount) {
  await openHarness(page);
  return page.evaluate((a) => classicHarness.read(a), account);
}

/** Record whether the welcome screen's Start button ever renders on this page. */
async function watchForWelcome(page: Page) {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      if (buttons.some((b) => b.textContent?.trim() === "Start")) {
        (window as unknown as { sawWelcome: boolean }).sawWelcome = true;
      }
    }).observe(document, { subtree: true, childList: true });
  });
}
const sawWelcome = (page: Page) =>
  page.evaluate(() => (window as unknown as { sawWelcome?: boolean }).sawWelcome ?? false);

async function expectMigrated(page: Page) {
  await expect(page).toHaveURL(/\/daily$/, { timeout: 90_000 });
  await expect(page.getByText("Welcome, Sam!")).toBeVisible();
}

const content = ({ id: _id, ...rest }: Record<string, unknown>) => rest;
const sorted = (entries: Record<string, unknown>[]) =>
  entries.map(content).toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

async function exportRows(page: Page) {
  await openDataCard(page);
  const data = await exportFile(page);
  await page.keyboard.press("Escape");
  return data;
}

test("a browser signed in to Classic is migrated silently, and Classic is left as it was", async ({
  page,
}) => {
  const account = await createClassic(page);
  const before = await readClassic(page, account);
  await signInToClassic(page, account);

  await watchForWelcome(page);
  await page.goto("/");
  await expectMigrated(page);
  expect(await sawWelcome(page)).toBe(false);

  const exported = await exportRows(page);
  expect(sorted(exported.mealEntries)).toEqual(sorted(seed.meals));
  expect(sorted(exported.weightEntries)).toEqual(sorted(seed.weights));
  expect(exported.profile).toEqual(seed.profile);

  // The next visit goes straight to the app, with nothing copied twice, and no
  // "Loading…" while the migration check confirms it's done.
  await watchLaunch(page);
  await page.reload();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByText("Welcome, Sam!")).toBeVisible();
  expect(await launchRecord(page)).toMatchObject({ sawLoading: false, tabsFirst: true });
  const again = await exportRows(page);
  expect(again.mealEntries).toHaveLength(seed.meals.length);

  // R9: migration only read Classic.
  const after = await readClassic(page, account);
  expect(sorted(after.mealEntries as never)).toEqual(sorted(before.mealEntries as never));
  expect(sorted(after.weightEntries as never)).toEqual(sorted(before.weightEntries as never));
});

test("a Classic passkey on another device opens the same account, with no duplicates", async ({
  browser,
}) => {
  const a = await openWithAuthenticator(browser);
  const account = await createClassic(a.page);
  await signInToClassic(a.page, account);
  await a.page.goto("/");
  await expectMigrated(a.page);
  const first = await exportRows(a.page);

  const b = await openWithAuthenticator(browser);
  await openHarness(b.page);
  await b.page.evaluate((acct) => classicHarness.registerPasskey(acct), account);
  await b.page.goto("/");
  await b.page.getByRole("button", { name: "I've used Sammygram before" }).click();
  await expectMigrated(b.page);

  const second = await exportRows(b.page);
  expect(second.accountId).toBe(first.accountId);
  expect(second.mealEntries).toHaveLength(seed.meals.length);
  expect(second.weightEntries).toHaveLength(seed.weights.length);
});

test("an edit made after migrating survives another device opening the account", async ({
  browser,
}) => {
  const one = await browser.newContext();
  const page = await one.newPage();
  const account = await createClassic(page);
  await signInToClassic(page, account);
  await page.goto("/");
  await expectMigrated(page);

  await page.getByRole("tab", { name: "Weight" }).click();
  const entries = page.getByTestId("weight-entry");
  await expect(entries).toHaveCount(2);
  await entries.first().getByTitle("Edit entry").click();
  const dialog = page.getByRole("dialog", { name: "Edit Weight Entry" });
  await dialog.getByLabel("Weight input with unit selector").click();
  await dialog.getByLabel("Weight input with unit selector").fill("12.5");
  await dialog.getByRole("button", { name: "Update Weight" }).click();
  await expect(dialog).toBeHidden();
  await expect(entries.first()).toContainText("12.5");
  const edited = await exportRows(page);

  const two = await browser.newContext();
  const other = await two.newPage();
  await signInToClassic(other, account);
  await other.goto("/");
  await expectMigrated(other);
  await expect(other.getByText("Moving your data")).toHaveCount(0);
  const seen = await exportRows(other);
  expect(sorted(seen.weightEntries)).toEqual(sorted(edited.weightEntries));
  expect(seen.weightEntries.some((w: { weightValue: number }) => w.weightValue === 12.5)).toBe(
    true,
  );
  expect(seen.mealEntries).toHaveLength(seed.meals.length);
});

test("reloading in the middle of a migration finishes it with no duplicates", async ({ page }) => {
  const many: ClassicSeed = {
    ...seed,
    meals: Array.from({ length: 150 }, (_, i) =>
      meal(`Meal ${i}`, `2025-07-${String(1 + (i % 28)).padStart(2, "0")}`),
    ),
  };
  const account = await createClassic(page, many);
  await signInToClassic(page, account);
  await page.goto("/");
  await expect(page.getByText("Moving your data")).toBeVisible({ timeout: 60_000 });
  await page.reload();

  await expectMigrated(page);
  const exported = await exportRows(page);
  expect(exported.mealEntries).toHaveLength(many.meals.length);
  expect(new Set(exported.mealEntries.map((m: { foodName: string }) => m.foodName)).size).toBe(
    many.meals.length,
  );
});

test("when Jazz Cloud can't be reached, the guided screen retries and downloads the old data", async ({
  page,
}) => {
  const account = await createClassic(page);
  let reachable = false;
  await page.routeWebSocket(/cloud\.jazz\.tools/, (ws) => {
    if (reachable) ws.connectToServer();
    else ws.close();
  });
  await signInToClassic(page, account);
  await page.goto("/");
  await expect(page.getByText("We couldn't move your data yet")).toBeVisible({ timeout: 90_000 });

  reachable = true;
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: "Download my old data" }).click(),
  ]);
  const old = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(old.version).toBe("1.2");
  expect(old.mealEntries).toHaveLength(seed.meals.length);
  expect(old.mealEntries.every((m: { id?: string }) => m.id?.startsWith("co_z"))).toBe(true);

  await page.getByRole("button", { name: "Try again" }).click();
  await expectMigrated(page);

  // The downloaded file and the migration name the same rows, so importing it adds nothing.
  const settings = await openDataCard(page);
  await importFile(page, old);
  await expect(settings.getByRole("alert")).toContainText("Imported 0 meals and 0 weights");
});

test("a browser holding only an anonymous Classic session gets the welcome screen", async ({
  page,
}) => {
  const account = await createClassic(page);
  await signInToClassic(page, account, "anonymous");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I've used Sammygram before" })).toBeVisible();
  await expect(page.getByText("Moving your data")).toHaveCount(0);
});

test("meals logged under Start are kept when this browser's Classic account is migrated", async ({
  page,
}) => {
  await startNewAccount(page, "Fresh");
  await addMeal(page, { food: "New kibble", category: "Dry food", caloriesPerUnit: 1 });
  await addMeal(page, { food: "New treat", category: "Treats", caloriesPerUnit: 1 });

  const account = await createClassic(page);
  await signInToClassic(page, account);
  await page.goto("/");
  await expectMigrated(page);

  const exported = await exportRows(page);
  const foods = exported.mealEntries.map((m: { foodName: string }) => m.foodName);
  expect(foods).toHaveLength(seed.meals.length + 2);
  expect(foods).toEqual(expect.arrayContaining(["New kibble", "New treat"]));
});

test("meals logged under Start survive a failed migration, a reload, and Try again", async ({
  page,
}) => {
  await startNewAccount(page, "Fresh");
  await addMeal(page, { food: "New kibble", category: "Dry food", caloriesPerUnit: 1 });
  await addMeal(page, { food: "New treat", category: "Treats", caloriesPerUnit: 1 });

  const account = await createClassic(page);
  let reachable = false;
  await page.routeWebSocket(/cloud\.jazz\.tools/, (ws) => {
    if (reachable) ws.connectToServer();
    else ws.close();
  });
  await signInToClassic(page, account);
  await page.goto("/");
  const failed = page.getByText("We couldn't move your data yet");
  await expect(failed).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(failed).toBeVisible({ timeout: 90_000 });
  const carried = () => page.evaluate(() => localStorage.getItem("calgram-migration-carried-rows"));
  expect(await carried()).not.toBeNull();

  reachable = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expectMigrated(page);
  expect(await carried()).toBeNull();
  const foods = (await exportRows(page)).mealEntries.map((m: { foodName: string }) => m.foodName);
  expect(foods).toHaveLength(seed.meals.length + 2);
  expect(foods).toEqual(expect.arrayContaining(["New kibble", "New treat"]));
});

test("a migrated account is left alone when another person's Classic session appears", async ({
  page,
}) => {
  const mine = await createClassic(page);
  await signInToClassic(page, mine);
  await page.goto("/");
  await expectMigrated(page);
  const before = await exportRows(page);

  const theirs = await createClassic(page, {
    ...seed,
    profile: { ...seed.profile, firstName: "Other" },
    meals: [meal("Their meal", "2025-07-27")],
  });
  await signInToClassic(page, theirs);
  await page.goto("/");
  await expect(page).toHaveURL(/\/daily$/, { timeout: 60_000 });
  await expect(page.getByText("Welcome, Sam!")).toBeVisible();
  const after = await exportRows(page);
  expect(after.accountId).toBe(before.accountId);
  expect(after.mealEntries).toHaveLength(seed.meals.length);
});
