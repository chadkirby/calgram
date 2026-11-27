import { readFile } from "node:fs/promises";
import { expect, type Browser, type CDPSession, type Locator, type Page } from "@playwright/test";

/** A new visitor clicks Start and names themselves; resolves on the Daily page. */
export async function startNewAccount(page: Page, firstName = "Tester") {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel("First name").fill(firstName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByTestId("main-tabs")).toBeVisible();
}

/** Set a TimePicker (the button showing the current time) to a 12-hour clock time. */
async function setTime(page: Page, dialog: Locator, time: string) {
  const [, h, m, period] = /^(\d+):(\d+) (AM|PM)$/.exec(time)!;
  await dialog.getByRole("group", { name: "Time" }).getByRole("button").click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover.getByPlaceholder("HH").fill(h);
  await popover.getByPlaceholder("MM").fill(m);
  await popover.locator("select").selectOption(period);
  await popover.getByRole("button", { name: "Done" }).click();
}

/** Type into the meal form's Combobox for `field` ("Food Name" or "Food Category"). */
async function fillCombobox(page: Page, dialog: Locator, field: string, value: string) {
  await dialog.getByRole("group", { name: field }).getByRole("button").click();
  const input = page
    .locator("[cmdk-input]")
    .and(page.getByPlaceholder(new RegExp(field.split(" ").pop()!, "i")));
  await input.fill(value);
  await input.press("Enter");
  await expect(input).toBeHidden();
}

export interface MealInput {
  food: string;
  category?: string;
  grams?: number;
  caloriesPerUnit?: number;
  time?: string; // "7:05 AM"
  unit?: "g" | "oz" | "lb" | "kg";
}

/** Open Add Meal on the Daily page. */
export async function openAddMeal(page: Page) {
  await page.getByRole("button", { name: "Add Meal" }).click();
  return page.getByRole("dialog", { name: "Add New Meal Entry" });
}

export async function addMeal(page: Page, meal: MealInput) {
  const dialog = await openAddMeal(page);
  if (meal.time) await setTime(page, dialog, meal.time);
  await fillCombobox(page, dialog, "Food Name", meal.food);
  if (meal.category) {
    await fillCombobox(page, dialog, "Food Category", meal.category);
  }
  if (meal.unit)
    await chooseUnit(page, dialog.getByRole("combobox", { name: /weight unit/i }), meal.unit);
  await dialog.getByLabel("Meal weight input").fill(String(meal.grams ?? 100));
  if (meal.caloriesPerUnit !== undefined) {
    await dialog.getByLabel("Calorie density input").fill(String(meal.caloriesPerUnit));
  }
  await dialog.getByRole("button", { name: "Log Meal" }).click();
  await expect(dialog).toBeHidden();
}

export async function chooseUnit(page: Page, trigger: Locator, unit: string) {
  await trigger.click();
  await page.getByRole("option", { name: unit, exact: true }).click();
}

/** Food names of the Daily page's meal rows, top to bottom. */
export function mealNames(page: Page) {
  return page.getByTestId("meal-entry").getByTestId("meal-food");
}

/** A browser context with a Chromium virtual authenticator that verifies the user. */
export async function openWithAuthenticator(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp: CDPSession = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { context, page, cdp, authenticatorId };
}

/** Open Settings, where Data has export and import. */
export async function openDataCard(page: Page) {
  await page.getByTitle("Application settings").filter({ visible: true }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

/** Import `data` (an object, or raw text) as a backup file. */
export async function importFile(page: Page, data: unknown) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
  });
}

/** Export from the open Settings dialog; resolves with the parsed file. */
export async function exportFile(page: Page) {
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
