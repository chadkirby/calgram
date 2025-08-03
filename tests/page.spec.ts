import { test, expect, Page } from "@playwright/test";

/**
 * Helpers
 */
async function gotoAndWaitForTabs(page: Page, path: string) {
  await page.goto(path);
  // Use the stable test id set in Layout.tsx
  const tablist = page.getByTestId("main-tabs");
  await tablist.waitFor({ state: "visible" });
  return {
    tablist,
    tab: (name: string) => tablist.getByRole("tab", { name }),
  };
}

/**
 * In this app, Radix Tabs set:
 * - Active tab: [role="tab"][data-state="active"][aria-selected="true"]
 * - Active panel: [data-state="active"] (no reliable id linkage from aria-controls)
 * Assert using those stable attributes instead of panel id.
 */
async function expectActiveTabAndAnyActivePanel(page: Page, tabName: string) {
  // Assert the intended tab is selected/active
  const tab = page.getByRole("tab", { name: tabName }).first();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toHaveAttribute("data-state", "active");

  // Assert there is exactly one active panel
  const activePanels = page.locator('[data-state="active"]');
  await expect(activePanels).toHaveCount(1);
}

/**
 * Page suites
 */
test.describe("Daily Page", () => {
  test("should display daily page", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/daily");
    await expectActiveTabAndAnyActivePanel(page, "Daily");
  });

  test("should have meal tracking functionality", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/daily");
    await expectActiveTabAndAnyActivePanel(page, "Daily");
  });
});

test.describe("Weight Page", () => {
  test("should display weight page", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/weight");
    await expectActiveTabAndAnyActivePanel(page, "Weight");
  });

  test("should have weight tracking functionality", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/weight");
    await expectActiveTabAndAnyActivePanel(page, "Weight");
  });
});

test.describe("Trends Page", () => {
  test("should display trends page", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/trends");
    await expectActiveTabAndAnyActivePanel(page, "Trends");
  });

  test("should have trends functionality", async ({ page }) => {
    await gotoAndWaitForTabs(page, "/trends");
    await expectActiveTabAndAnyActivePanel(page, "Trends");
  });
});

/**
 * Navigation flow
 */
test.describe("Navigation", () => {
  test("should navigate between pages using tabs", async ({ page }) => {
    const { tab } = await gotoAndWaitForTabs(page, "/daily");

    await tab("Daily").click();
    await expect(page).toHaveURL(/\/daily\/?$/);
    await expectActiveTabAndAnyActivePanel(page, "Daily");

    await tab("Weight").click();
    await expect(page).toHaveURL(/\/weight\/?$/);
    await expectActiveTabAndAnyActivePanel(page, "Weight");

    await tab("Trends").click();
    await expect(page).toHaveURL(/\/trends\/?$/);
    await expectActiveTabAndAnyActivePanel(page, "Trends");
  });
});
