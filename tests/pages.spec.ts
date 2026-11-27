import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import {
  addMeal,
  chooseUnit,
  importFile,
  mealNames,
  openAddMeal,
  openDataCard,
  startNewAccount,
} from "./support/app";

// U5: every page reads and writes Jazz 2.

test("a logged meal survives a reload and counts toward the day's total", async ({ page }) => {
  await startNewAccount(page);
  await addMeal(page, { food: "Kibble", category: "Dry food", grams: 100, caloriesPerUnit: 3.5 });

  await expect(mealNames(page)).toHaveText(["Kibble"]);
  await expect(page.getByTestId("daily-total")).toHaveText("350.0");

  await page.reload();
  await expect(mealNames(page)).toHaveText(["Kibble"]);
  await expect(page.getByTestId("daily-total")).toHaveText("350.0");

  await page.getByTestId("meal-entry").getByRole("button").first().click();
  const edit = page.getByRole("dialog", { name: "Edit Meal Entry" });
  // Focusing the field rewrites it, so focus first, then replace the value.
  await edit.getByLabel("Calorie density input").click();
  await edit.getByLabel("Calorie density input").fill("4");
  await edit.getByRole("button", { name: "Update Meal" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByTestId("daily-total")).toHaveText("400.0");

  await page.getByTestId("meal-entry").getByRole("button").nth(1).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("meal-entry")).toHaveCount(0);
  await expect(page.getByTestId("daily-total")).toHaveText("0.0");
  await page.reload();
  await expect(page.getByTestId("daily-total")).toHaveText("0.0");
});

test("a meal backdated to earlier in the day is listed in time order", async ({ page }) => {
  await startNewAccount(page);
  await addMeal(page, {
    food: "Dinner",
    category: "Wet food",
    time: "6:30 PM",
    caloriesPerUnit: 1,
  });
  await addMeal(page, {
    food: "Breakfast",
    category: "Dry food",
    time: "7:05 AM",
    caloriesPerUnit: 1,
  });
  await addMeal(page, {
    food: "Lunch",
    category: "Dry food",
    time: "12:15 PM",
    caloriesPerUnit: 1,
  });

  await expect(mealNames(page)).toHaveText(["Breakfast", "Lunch", "Dinner"]);
  await page.reload();
  await expect(mealNames(page)).toHaveText(["Breakfast", "Lunch", "Dinner"]);
});

test("choosing oz for a meal is remembered across reloads", async ({ page }) => {
  await startNewAccount(page);
  await addMeal(page, {
    food: "Treat",
    category: "Treats",
    unit: "oz",
    grams: 2,
    caloriesPerUnit: 1,
  });

  await page.reload();
  const dialog = await openAddMeal(page);
  await expect(dialog.getByRole("combobox", { name: /weight unit/i })).toHaveText("oz");
});

test("a food logged before prefills its calories per gram and category", async ({ page }) => {
  await startNewAccount(page);
  await addMeal(page, { food: "Salmon", category: "People food", caloriesPerUnit: 2.08 });
  await addMeal(page, { food: "Kibble", category: "Dry food", caloriesPerUnit: 3.5 });

  const dialog = await openAddMeal(page);
  await dialog.getByRole("group", { name: "Food Name" }).getByRole("button").click();
  await page.getByPlaceholder("Enter or select food name...").fill("Salmon");
  await page.getByRole("option", { name: "Salmon" }).click();

  await expect(dialog.getByLabel("Calorie density input")).toHaveValue("2.08");
  await expect(dialog.getByRole("group", { name: "Food Category" })).toContainText("People food");
});

test("after a reload, other days' meals and food suggestions are there from the start", async ({
  page,
}) => {
  await startNewAccount(page);
  await page.getByRole("button", { name: "Previous day" }).click();
  await addMeal(page, { food: "Salmon", category: "People food", caloriesPerUnit: 2.08 });
  await page.getByRole("button", { name: "Next day" }).click();
  await addMeal(page, { food: "Kibble", category: "Dry food", caloriesPerUnit: 3.5 });

  // Launch shows only today's meals at first and loads the rest after.
  await page.reload();
  await expect(mealNames(page)).toHaveText(["Kibble"]);
  const dialog = await openAddMeal(page);
  await dialog.getByLabel("Meal weight input").fill("123");
  await dialog.getByRole("group", { name: "Food Name" }).getByRole("button").click();
  await page.getByPlaceholder("Enter or select food name...").fill("Salmon");
  await page.getByRole("option", { name: "Salmon" }).click();
  await expect(dialog.getByLabel("Calorie density input")).toHaveValue("2.08");
  await expect(dialog.getByLabel("Meal weight input")).toHaveValue("123");
  await page.keyboard.press("Escape");

  await page.reload();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(mealNames(page)).toHaveText(["Salmon"]);
});

/** An imported meal named after its id. */
const importedMeal = (id: string, timestamp: string) => ({
  id,
  timestamp,
  foodName: id,
  foodCategory: "Dry food",
  caloriesPerGram: 1,
  weightInGrams: 100,
  totalCalories: 100,
});

test("a meal is listed on the date its timestamp was written with, whatever the offset", async ({
  page,
}) => {
  const today = DateTime.now().toISODate()!;
  const yesterday = DateTime.now().minus({ days: 1 }).toISODate()!;
  await startNewAccount(page);
  const settings = await openDataCard(page);
  await importFile(page, {
    version: "1.2",
    exportDate: `${today}T00:00:00.000Z`,
    profile: {},
    mealEntries: [
      importedMeal("co_zLate", `${today}T23:30:00.000+14:00`),
      importedMeal("co_zEarly", `${today}T00:30:00.000-12:00`),
      importedMeal("co_zYesterday", `${yesterday}T23:30:00.000-12:00`),
    ],
    weightEntries: [],
  });
  await expect(settings.getByRole("alert")).toContainText("Imported 3 meals");
  await page.keyboard.press("Escape");

  await page.reload();
  // Listed by instant: 23:30 at +14:00 is earlier than 00:30 at -12:00.
  await expect(mealNames(page)).toHaveText(["co_zLate", "co_zEarly"]);
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(mealNames(page)).toHaveText(["co_zYesterday"]);
});

test("weigh-ins can be added, edited and deleted, and the list and chart follow", async ({
  page,
}) => {
  await startNewAccount(page);
  await page.getByRole("tab", { name: "Weight" }).click();
  await expect(page.getByText("No weight data available")).toBeVisible();

  await page.getByRole("button", { name: "Add Weight" }).click();
  let dialog = page.getByRole("dialog", { name: "Add Weight Entry" });
  await dialog.getByLabel("Weight input with unit selector").fill("20");
  await chooseUnit(page, dialog.getByRole("combobox", { name: /weight unit/i }), "lbs");
  await dialog.getByRole("button", { name: "Add Weight" }).click();
  await expect(dialog).toBeHidden();

  const entries = page.getByTestId("weight-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("20lbs");
  await expect(page.getByText("No weight data available")).toBeHidden();
  await expect(page.getByText(/^Avg:/)).toContainText("20lbs");

  await entries.first().getByTitle("Edit entry").click();
  dialog = page.getByRole("dialog", { name: "Edit Weight Entry" });
  await dialog.getByLabel("Weight input with unit selector").click();
  await dialog.getByLabel("Weight input with unit selector").fill("22");
  await dialog.getByRole("button", { name: "Update Weight" }).click();
  await expect(dialog).toBeHidden();
  await expect(entries.first()).toContainText("22lbs");
  await expect(page.getByText(/^Avg:/)).toContainText("22lbs");

  await page.reload();
  await expect(entries.first()).toContainText("22lbs");

  await entries.first().getByTitle("Delete entry").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(entries).toHaveCount(0);
  await expect(page.getByText("No weight data available")).toBeVisible();
});

test("an open weigh-in form keeps what was typed when the profile changes in another tab", async ({
  page,
  context,
}) => {
  await startNewAccount(page, "Tester");
  await page.getByRole("tab", { name: "Weight" }).click();
  await page.getByRole("button", { name: "Add Weight" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Weight Entry" });
  const input = dialog.getByLabel("Weight input with unit selector");
  await input.fill("20");
  await dialog.getByLabel(/notes/i).fill("before breakfast");

  // Same account in a second tab: rename it there.
  const other = await context.newPage();
  await other.goto("/daily");
  await other.getByTitle("Application settings").filter({ visible: true }).click();
  const settings = other.getByRole("dialog", { name: "Settings" });
  await settings.getByLabel("First Name").fill("Renamed");
  await settings.getByRole("button", { name: "Save Changes" }).click();

  // The first tab sees the new name, and its open form is untouched.
  await expect(page.getByText("(Renamed)")).toBeAttached();
  await expect(input).toHaveValue(/^20(\.0)?$/);
  await expect(dialog.getByLabel(/notes/i)).toHaveValue("before breakfast");
});

test("adding a weigh-in in a new unit keeps the success message until the form closes", async ({
  page,
}) => {
  await startNewAccount(page);
  await page.getByRole("tab", { name: "Weight" }).click();
  await page.getByRole("button", { name: "Add Weight" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Weight Entry" });
  const input = dialog.getByLabel("Weight input with unit selector");
  // Not the default (lbs), so saving also writes the profile's unit preference.
  await chooseUnit(page, dialog.getByRole("combobox", { name: /weight unit/i }), "kg");
  await input.fill("9");
  await dialog.getByRole("button", { name: "Add Weight" }).click();

  const success = dialog.getByText("Success!");
  await expect(success).toBeVisible();
  // Give the profile write time to come back through the subscription.
  await page.waitForTimeout(150);
  await expect(success).toBeVisible();
  await expect(input).toHaveValue(/^9(\.0+)?$/);
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("weight-entry").first()).toContainText("9kg");
});
