import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addMeal, mealNames, startNewAccount } from "./support/app";

// U7: export and import in Settings → Data run on Jazz 2.

const kibble = {
  timestamp: "2025-07-27T08:30:00.000-07:00",
  foodName: "Kibble",
  foodCategory: "Dry food",
  caloriesPerGram: 3.5,
  caloriesPerDisplayUnit: "g",
  weightInGrams: 100,
  displayUnit: "g",
  totalCalories: 350,
};
const treat = {
  timestamp: "2025-07-27",
  foodName: "Treat",
  foodCategory: "Treats",
  caloriesPerGram: 4,
  weightInGrams: 5,
  totalCalories: 20,
  notes: "after the walk",
};

/** A Classic-era backup: CoValue ids on most entries, one id-less entry, one id repeated. */
const fixture = {
  version: "1.2",
  exportDate: "2025-07-28T00:00:00.000Z",
  profile: {
    name: "Sam Example",
    firstName: "Sam",
    dateOfBirth: "1990-01-01",
    mealWeightUnit: "oz",
    bodyWeightUnit: "kg",
  },
  mealEntries: [{ id: "co_zMealKibble", ...kibble }, { id: "co_zMealKibble", ...kibble }, treat],
  weightEntries: [
    {
      id: "co_zWeight1",
      timestamp: "2025-07-27T07:00:00.000-07:00",
      weightValue: 10.5,
      unit: "kg",
    },
    { id: "co_zWeight2", timestamp: "2025-07-28", weightValue: 10.4 },
  ],
};

async function openDataCard(page: Page) {
  await page.getByTitle("Application settings").filter({ visible: true }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

async function importFile(page: Page, data: unknown) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
  });
}

async function exportFile(page: Page) {
  const settings = page.getByRole("dialog", { name: "Settings" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    settings.getByRole("button", { name: "Export Data" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^calorie-tracker-export-[\dT-]+\.json$/);
  // The server's copy was read too, so the backup isn't flagged as possibly incomplete.
  await expect(settings.getByRole("alert")).toContainText("Data exported successfully!");
  return JSON.parse(await readFile(await download.path(), "utf8"));
}

/** An entry without its id, for comparing contents. */
const content = ({ id: _id, ...rest }: { id?: string }) => rest;
const byTimestamp = (a: { timestamp: string }, b: { timestamp: string }) =>
  a.timestamp.localeCompare(b.timestamp);

test("importing a backup twice adds its entries once, and export gives them back", async ({
  page,
}) => {
  const rejected: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("An imported row was rejected")) rejected.push(message.text());
  });
  await startNewAccount(page, "Tester");
  const settings = await openDataCard(page);
  const alert = settings.getByRole("alert");

  await importFile(page, fixture);
  await expect(alert).toContainText("Imported 2 meals and 2 weights");
  await expect(alert).toContainText("Skipped (already present): 1");

  await importFile(page, fixture);
  await expect(alert).toContainText("Imported 0 meals and 0 weights");
  await expect(alert).toContainText("Skipped (already present): 5");

  const exported = await exportFile(page);
  expect(exported.version).toBe("1.3");
  expect(exported.mealEntries.map(content).toSorted(byTimestamp)).toEqual(
    [kibble, treat].toSorted(byTimestamp),
  );
  expect(exported.weightEntries.map(content).toSorted(byTimestamp)).toEqual(
    fixture.weightEntries.map(content).toSorted(byTimestamp),
  );
  expect(exported.profile).toEqual({
    name: "Sam Example",
    firstName: "Sam",
    mealWeightUnit: "oz",
    bodyWeightUnit: "kg",
  });

  // Each exported entry carries its row id, so importing the export adds nothing.
  await importFile(page, exported);
  await expect(alert).toContainText("Imported 0 meals and 0 weights");
  await expect(alert).toContainText("Skipped (already present): 4");

  // Still there after a reload, still once each.
  await page.reload();
  await openDataCard(page);
  const reloaded = await exportFile(page);
  expect(reloaded.mealEntries).toHaveLength(2);
  expect(reloaded.weightEntries).toHaveLength(2);
  // The server accepted every row the import wrote.
  expect(rejected).toEqual([]);
});

test("re-importing this account's export doesn't bring back a meal deleted since", async ({
  page,
}) => {
  const rejected: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("An imported row was rejected")) rejected.push(message.text());
  });
  await startNewAccount(page, "Tester");
  await addMeal(page, { food: "Breakfast", category: "Dry food", caloriesPerUnit: 1 });
  await addMeal(page, { food: "Mistake", category: "Treats", caloriesPerUnit: 1 });
  await expect(mealNames(page)).toHaveCount(2);

  await openDataCard(page);
  const exported = await exportFile(page);
  expect(exported.mealEntries).toHaveLength(2);
  await page.keyboard.press("Escape");

  const mistake = page.getByTestId("meal-entry").filter({ hasText: "Mistake" });
  await mistake.getByRole("button").nth(1).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(mealNames(page)).toHaveText(["Breakfast"]);

  const settings = await openDataCard(page);
  await importFile(page, exported);
  // Counts are local-first: the deleted meal's insert counts, then the server rejects it.
  await expect(settings.getByRole("alert")).toContainText("Imported 1 meals and 0 weights");
  await page.keyboard.press("Escape");
  await expect(mealNames(page)).toHaveText(["Breakfast"]);

  await page.reload();
  await expect(mealNames(page)).toHaveText(["Breakfast"]);
  await openDataCard(page);
  const reexported = await exportFile(page);
  expect(reexported.mealEntries.map((m: { foodName: string }) => m.foodName)).toEqual([
    "Breakfast",
  ]);
  // The server's refusal of the deleted id counts as already present, not an error.
  expect(rejected).toEqual([]);
});

test("an invalid file shows the validation errors and writes nothing", async ({ page }) => {
  await startNewAccount(page, "Tester");
  const settings = await openDataCard(page);

  const invalid = {
    ...fixture,
    mealEntries: [{ ...kibble, caloriesPerGram: -1 }, treat],
  };
  await importFile(page, invalid);
  const alert = settings.getByRole("alert");
  await expect(alert).toContainText("Import failed: Invalid data format");
  await expect(alert).toContainText("mealEntries.0.caloriesPerGram");

  await importFile(page, "{ not json");
  await expect(alert).toContainText("Import failed: Failed to parse JSON file");

  const exported = await exportFile(page);
  expect(exported.mealEntries).toEqual([]);
  expect(exported.weightEntries).toEqual([]);
  expect(exported.profile).toEqual({ name: "Tester", firstName: "Tester" });
});

test("saving Settings after an import keeps the imported names", async ({ page }) => {
  await startNewAccount(page, "Tester");
  const settings = await openDataCard(page);
  await expect(settings.getByLabel("First Name")).toHaveValue("Tester");

  await importFile(page, fixture);
  await expect(settings.getByRole("alert")).toContainText("Imported 2 meals and 2 weights");
  await expect(page.getByText("Welcome, Sam!")).toBeAttached();

  // The form still shows the names from when it opened; nothing was edited.
  await settings.getByRole("button", { name: "Save Changes" }).click();
  await expect(settings).toBeHidden();
  await expect(page.getByText("Welcome, Sam!")).toBeVisible();

  const reopened = await openDataCard(page);
  await expect(reopened.getByLabel("Full Name")).toHaveValue("Sam Example");
  await expect(reopened.getByLabel("First Name")).toHaveValue("Sam");
});

test("Settings saves only the name the user changed", async ({ page }) => {
  await startNewAccount(page, "Tester");
  const settings = await openDataCard(page);
  await importFile(page, fixture);
  await expect(page.getByText("Welcome, Sam!")).toBeAttached();

  await settings.getByLabel("Full Name").fill("Samantha Example");
  await settings.getByRole("button", { name: "Save Changes" }).click();

  const reopened = await openDataCard(page);
  await expect(reopened.getByLabel("Full Name")).toHaveValue("Samantha Example");
  // First Name wasn't touched, so the imported "Sam" stays.
  await expect(reopened.getByLabel("First Name")).toHaveValue("Sam");
});
