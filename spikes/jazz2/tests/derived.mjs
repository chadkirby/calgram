import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5287/";
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const errs = [];
// Key derived from a fake "Classic seed": HKDF-SHA256(seed, info) -> 32 bytes -> jazz-auth-v1:<b64url>
const derive = async (seedText) => {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(seedText), "HKDF", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("calgram/jazz2-device-key/v1") }, k, 256));
  return "jazz-auth-v1:" + Buffer.from(bits).toString("base64url");
};
async function open(name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page.on("pageerror", (e) => errs.push(`[${name}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[${name}] ${m.text()}`); });
  await page.goto(URL); await page.getByTestId("user").waitFor({ timeout: 30000 });
  return page;
}
const restore = async (p, key) => {
  await p.getByTestId("restore-input").first().fill(key);
  await p.getByRole("button", { name: "restore", exact: true }).first().click();
};
const waitCount = (p, n, ms = 20000) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: ms });
const upsertTwo = (p) => p.evaluate(async () => {
  const db = window.__db, t = window.__app.weightEntries;
  const ids = ["7f3e1c2a-0b4d-5e6f-8a9b-0c1d2e3f4a5b", "7f3e1c2a-0b4d-5e6f-8a9b-0c1d2e3f4a5c"];
  for (const id of ids) db.upsert(t, id, { timestamp: "2026-10-30", weightValue: 80, unit: "kg", notes: "migrated" });
  return "ok";
});
try {
  const key = await derive(`classic-seed-${Date.now()}`);
  log("derived key", key.slice(0, 16) + "…", "len", key.length);
  const A = await open("A");
  await restore(A, key);
  await A.waitForFunction(() => document.querySelector('[data-testid=status]')?.textContent === "ready", null, { timeout: 30000 });
  const userA = await A.getByTestId("user").textContent();
  log("A: never-seen derived key accepted, user", userA);
  log("A first upsert:", await upsertTwo(A)); await waitCount(A, 2);
  log("A second upsert (retry):", await upsertTwo(A)); await A.waitForTimeout(1500); await waitCount(A, 2, 2000);
  log("A: retry kept 2 rows (idempotent)");
  const B = await open("B");
  await restore(B, key);
  await B.waitForFunction((u) => document.querySelector('[data-testid=user]')?.textContent === u, userA, { timeout: 30000 });
  await waitCount(B, 2, 30000);
  log("B: same derived key -> same account, sees 2 rows");
  log("B upsert again (second device re-running migration):", await upsertTwo(B)); await B.waitForTimeout(2000);
  await waitCount(B, 2, 2000); await waitCount(A, 2, 5000);
  log("RESULT: PASS");
} catch (e) { log("RESULT: FAIL", e.message.split("\n")[0]); }
log(errs.slice(0, 10).join("\n"));
await browser.close();
