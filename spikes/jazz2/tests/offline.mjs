import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5287/";
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const reqs = [];
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("request", (r) => reqs.push(`${r.method()} ${r.url().replace(URL, "/")} [${r.resourceType()}]`));
page.on("websocket", (ws) => reqs.push(`WS ${ws.url()}`));
ctx.on("serviceworker", () => reqs.push("serviceworker"));
const waitCount = (p, n, ms = 20000) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: ms });
try {
  await page.goto(URL);
  await page.getByTestId("user").waitFor({ timeout: 30000 });
  await waitCount(page, 0);
  await page.getByRole("button", { name: "export key" }).click();
  const key = (await page.getByTestId("key").textContent()).trim();
  const user = await page.getByTestId("user").textContent();
  log("--- requests during startup:"); log([...new Set(reqs.filter(r => /jazz|wasm|WS|worker/i.test(r)))].join("\n"));

  await ctx.setOffline(true);
  await page.getByRole("button", { name: "add" }).click();
  await waitCount(page, 1);
  log("offline write shown locally: 1 row");
  await page.reload().catch(e => log("reload offline failed (expected, no SW):", e.message.split("\n")[0]));
  await ctx.setOffline(false);
  await page.goto(URL);
  await page.getByTestId("user").waitFor({ timeout: 30000 });
  await waitCount(page, 1);
  log("after coming back online + reload: still 1 row, same user:", (await page.getByTestId("user").textContent()) === user);

  // Did the offline write reach the server? Restore in a fresh profile.
  const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
  await p2.goto(URL); await p2.getByTestId("user").waitFor({ timeout: 30000 });
  await p2.getByTestId("restore-input").fill(key);
  await p2.getByRole("button", { name: "restore", exact: true }).click();
  await waitCount(p2, 1, 30000);
  log("fresh profile restored -> sees offline-written row: synced to server");
  log("RESULT: PASS");
} catch (e) { log("RESULT: FAIL", e.message.split("\n")[0]); }
await browser.close();
