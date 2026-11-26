import { test, expect, type Page } from "@playwright/test";
import { startNewAccount } from "./support/app";

/**
 * In this app, Radix Tabs set:
 * - Active tab: [role="tab"][data-state="active"][aria-selected="true"]
 * Assert using those stable attributes instead of panel id.
 */
async function expectActiveTab(page: Page, tabName: string) {
  const tab = page.getByRole("tab", { name: tabName }).first();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toHaveAttribute("data-state", "active");
}

test.describe("Pages", () => {
  for (const [path, tab] of [
    ["/daily", "Daily"],
    ["/weight", "Weight"],
    ["/trends", "Trends"],
  ] as const) {
    test(`${path} shows the ${tab} tab once signed in`, async ({ page }) => {
      await startNewAccount(page);
      await page.goto(path);
      await expectActiveTab(page, tab);
    });
  }

  test("signed out, an app page sends you to the welcome screen", async ({ page }) => {
    await page.goto("/trends");
    await expect(page).toHaveURL(/\/\?redirect=%2Ftrends$/);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    await expect(page.getByTestId("main-tabs")).toHaveCount(0);
  });
});

test.describe("Navigation", () => {
  test("should navigate between pages using tabs", async ({ page }) => {
    await startNewAccount(page);
    const tab = (name: string) => page.getByTestId("main-tabs").getByRole("tab", { name });

    await tab("Daily").click();
    await expect(page).toHaveURL(/\/daily\/?$/);
    await expectActiveTab(page, "Daily");

    await tab("Weight").click();
    await expect(page).toHaveURL(/\/weight\/?$/);
    await expectActiveTab(page, "Weight");

    await tab("Trends").click();
    await expect(page).toHaveURL(/\/trends\/?$/);
    await expectActiveTab(page, "Trends");
  });
});
