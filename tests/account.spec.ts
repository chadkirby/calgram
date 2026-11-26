import { expect, test } from "@playwright/test";
import { addMeal, mealNames, openWithAuthenticator, startNewAccount } from "./support/app";

// U6: accounts without Classic.

test("a brand-new visitor reaches the Daily page without a migration prompt, and stays", async ({
  page,
}) => {
  await startNewAccount(page, "Sam");
  await expect(page.getByText(/migrat/i)).toHaveCount(0);
  await expect(page.getByText("Welcome, Sam!")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByTestId("main-tabs")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/daily$/);
});

test("a passkey saved on one device restores the account and its rows on another", async ({
  browser,
}) => {
  const a = await openWithAuthenticator(browser);
  await startNewAccount(a.page, "Alex");
  await addMeal(a.page, { food: "Oatmeal", category: "Breakfast", caloriesPerUnit: 1 });

  await a.page.getByTitle("Application settings").filter({ visible: true }).click();
  const settings = a.page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("button", { name: "Save a passkey" }).click();
  await expect(settings.getByText("Passkey saved")).toBeVisible();
  const { credentials } = await a.cdp.send("WebAuthn.getCredentials", {
    authenticatorId: a.authenticatorId,
  });
  expect(credentials).toHaveLength(1);

  // The passkey syncs to a second device (iCloud Keychain and the like).
  const b = await openWithAuthenticator(browser);
  await b.cdp.send("WebAuthn.addCredential", {
    authenticatorId: b.authenticatorId,
    credential: credentials[0],
  });
  await b.page.goto("/");
  await b.page.getByRole("button", { name: "I've used calgram before" }).click();

  await expect(b.page).toHaveURL(/\/daily$/, { timeout: 30_000 });
  await expect(mealNames(b.page)).toHaveText(["Oatmeal"], { timeout: 30_000 });
  await expect(b.page.getByText("Welcome, Alex!")).toBeVisible();

  // A saved its passkey, so logging out there asks nothing.
  await a.page.keyboard.press("Escape");
  await a.page.getByTitle("Log out").filter({ visible: true }).click();
  await expect(a.page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(a.page.getByRole("alertdialog")).toHaveCount(0);
});

test("saving a passkey from Settings hides the offer banner right away", async ({ browser }) => {
  const { page } = await openWithAuthenticator(browser);
  await startNewAccount(page, "Pat");
  // Behind the open Settings dialog the banner is aria-hidden, so find it by CSS.
  const offer = page.locator('section[aria-label="Save a passkey"]');
  await expect(offer).toBeVisible();

  await page.getByTitle("Application settings").filter({ visible: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(offer).toBeAttached();
  await settings.getByRole("button", { name: "Save a passkey" }).click();
  await expect(settings.getByText("Passkey saved")).toBeVisible();
  await expect(offer).toHaveCount(0);
  await expect(settings).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(offer).toHaveCount(0);
});

test("a signed-in account the server confirms has no setup status gets the name step", async ({
  page,
}) => {
  // The test harness signs this browser in as a device account with no profile row.
  await page.goto("/tests/harness/jazz.html");
  await page.waitForFunction(() => document.body.dataset.ready === "true");

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I've used calgram before" })).toHaveCount(0);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel("First name").fill("Lee");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByText("Welcome, Lee!")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/daily$/);
});

test("after logging out and reloading, the welcome screen shows, not the last user's data", async ({
  page,
}) => {
  await startNewAccount(page, "Robin");
  await addMeal(page, { food: "Secret snack", category: "Treats", caloriesPerUnit: 1 });

  await page.getByTitle("Log out").filter({ visible: true }).click();
  await page.getByRole("button", { name: "Log out without a passkey" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByTestId("main-tabs")).toHaveCount(0);
  await expect(page.getByText("Secret snack")).toHaveCount(0);
  await expect(page.getByText("Welcome, Robin!")).toHaveCount(0);

  await page.goto("/daily");
  await expect(page).toHaveURL(/\/\?redirect=/);
  await expect(page.getByText("Secret snack")).toHaveCount(0);
});

test("logging out of an account with no saved passkey offers one first, and cancel keeps you in", async ({
  page,
}) => {
  await startNewAccount(page);
  await addMeal(page, { food: "Kibble", category: "Dry food", caloriesPerUnit: 1 });

  await page.getByTitle("Log out").filter({ visible: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("passkey");
  await expect(confirm.getByRole("button", { name: "Save a passkey" })).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();

  await expect(mealNames(page)).toHaveText(["Kibble"]);
  await page.reload();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(mealNames(page)).toHaveText(["Kibble"]);
});

test("a redirect survives Start: a new visitor sent from /weight lands on /weight", async ({
  page,
}) => {
  await page.goto("/weight");
  await expect(page).toHaveURL(/\/\?redirect=%2Fweight$/);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel("First name").fill("Kim");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/weight$/);
});
