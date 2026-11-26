import { expect, test } from "@playwright/test";
import { addMeal, chooseUnit, mealNames, openAddMeal, startNewAccount } from "./support/app";

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
