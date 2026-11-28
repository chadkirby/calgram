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

/**
 * Set the meal form's time picker to a 12-hour clock time. The picker has a 24-hour hour
 * column and 15-minute steps, so `time` must be on a quarter hour.
 */
async function setTime(page: Page, dialog: Locator, time: string) {
  const [, h, m, period] = /^(\d+):(\d+) (AM|PM)$/.exec(time)!;
  const hour = String((Number(h) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0");
  await dialog.getByRole("group", { name: "Time" }).getByRole("button").click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await popover
    .getByRole("listbox")
    .first()
    .getByRole("option", { name: hour, exact: true })
    .click();
  await popover.getByRole("listbox").last().getByRole("option", { name: m, exact: true }).click();
  await popover.getByRole("button", { name: "Done" }).click();
  await expect(popover).toBeHidden();
}

/** Type into the meal form's Combobox for `field` ("Food Name" or "Food Category"). */
async function fillCombobox(page: Page, dialog: Locator, field: string, value: string) {
  await dialog.getByRole("group", { name: field }).getByRole("button").click();
  // The search box of the list that just opened.
  const input = page.locator("[data-radix-popper-content-wrapper] [cmdk-input]");
  await input.fill(value);
  await input.press("Enter");
  await expect(input).toBeHidden();
}

export interface MealInput {
  food: string;
  category?: string;
  grams?: number;
  caloriesPerUnit?: number;
  time?: string; // "7:00 AM", on a quarter hour
  unit?: "g" | "oz" | "lb" | "kg";
  /** Log the weight as food thrown out rather than eaten. */
  thrownOut?: boolean;
}

/** Open Add Meal on the Daily page. */
export async function openAddMeal(page: Page) {
  await page.getByRole("button", { name: "Add Meal" }).click();
  return page.getByRole("dialog", { name: /^Log a meal for / });
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
  if (meal.thrownOut) await dialog.getByRole("tab", { name: "Thrown out" }).click();
  await dialog
    .getByRole("button", { name: meal.thrownOut ? "Log Thrown Out" : "Log Meal" })
    .click();
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

export async function openDataCard(page: Page) {
  await page.getByTitle("Application settings").filter({ visible: true }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

export async function importFile(page: Page, data: unknown) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
  });
}

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

export interface LaunchRecord {
  /** "Loading…" rendered at some point. */
  sawLoading: boolean;
  /** "Checking your account…" rendered at some point. */
  sawChecking: boolean;
  /** The first content in #root already had the main tabs. */
  tabsFirst: boolean | undefined;
}

/**
 * Record, from the first paint, what each later navigation in `page` shows on its way
 * to the app: the end state alone can't tell a direct launch from one with screens
 * in between.
 */
export async function watchLaunch(page: Page) {
  await page.addInitScript(() => {
    const record = { sawLoading: false, sawChecking: false, tabsFirst: undefined as unknown };
    (window as unknown as { launch: typeof record }).launch = record;
    new MutationObserver(() => {
      const root = document.getElementById("root");
      if (!root?.firstChild) return;
      record.tabsFirst ??= root.querySelector('[data-testid="main-tabs"]') !== null;
      const text = root.textContent ?? "";
      if (text.includes("Loading…")) record.sawLoading = true;
      if (text.includes("Checking your account…")) record.sawChecking = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

export const launchRecord = (page: Page) =>
  page.evaluate(() => (window as unknown as { launch: LaunchRecord }).launch);
