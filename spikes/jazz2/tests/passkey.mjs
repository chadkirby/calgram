import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5287/";
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const errs = [];
async function open(name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(`[${name}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[${name}] ${m.text()}`); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", { options: {
    protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true } });
  await page.goto(URL); await page.getByTestId("user").waitFor({ timeout: 30000 });
  return { ctx, page, cdp, authenticatorId };
}
const waitCount = (p, n, ms = 20000) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: ms });
try {
  const A = await open("A");
  const userA = await A.page.getByTestId("user").textContent();
  await A.page.getByRole("button", { name: "add" }).click();
  await waitCount(A.page, 1);
  await A.page.getByRole("button", { name: "backup passkey" }).click();
  await A.page.waitForFunction(() => document.querySelector('[data-testid=key]')?.textContent === "backed-up", null, { timeout: 15000 });
  const { credentials } = await A.cdp.send("WebAuthn.getCredentials", { authenticatorId: A.authenticatorId });
  log("A backed up to passkey; credentials:", credentials.length, "rpId", credentials[0]?.rpId, "resident", credentials[0]?.isResidentCredential);

  // Simulate the passkey syncing (iCloud Keychain etc.) to a second device/profile.
  const B = await open("B");
  log("B fresh user differs:", (await B.page.getByTestId("user").textContent()) !== userA);
  await B.cdp.send("WebAuthn.addCredential", { authenticatorId: B.authenticatorId, credential: credentials[0] });
  await B.page.getByRole("button", { name: "restore passkey" }).click();
  await B.page.waitForFunction((u) => document.querySelector('[data-testid=user]')?.textContent === u, userA, { timeout: 30000 });
  await waitCount(B.page, 1, 30000);
  log("B restored from passkey as A and sees A's row");
  await B.page.getByRole("button", { name: "add" }).click();
  await waitCount(A.page, 2, 20000);
  log("B's write reaches A live; ownership intact");
  log("RESULT: PASS");
} catch (e) { log("RESULT: FAIL", e.message.split("\n")[0]); }
log(errs.slice(0, 20).join("\n"));
await browser.close();
