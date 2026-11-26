import { chromium } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
const PROD = "https://jazz-vite-spike.chad-kirby.workers.dev/";
const phase = process.argv[2];
const b = await chromium.launch();
const p = await (await b.newContext()).newPage(); await p.goto(PROD); await p.getByTestId("user").waitFor({ timeout: 30000 });
const count = (n) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: 30000 });
if (phase === "before") {
  await p.getByRole("button", { name: "add" }).click(); await p.getByRole("button", { name: "add" }).click(); await count(2);
  await p.getByRole("button", { name: "export key" }).click();
  const key = (await p.getByTestId("key").textContent()).trim(), user = await p.getByTestId("user").textContent();
  await p.waitForTimeout(3000);
  writeFileSync("/tmp/compound-engineering-501/redeploy.json", JSON.stringify({ key, user }));
  console.log("before: user", user, "rows 2");
} else {
  const { key, user } = JSON.parse(readFileSync("/tmp/compound-engineering-501/redeploy.json", "utf8"));
  const r = await p.evaluate(async (k) => { await window.__session.restoreDeviceAccount(k); return window.__session.user?.accountId; }, key);
  try { await count(2); console.log("after redeploy: user", r, r === user ? "SAME" : "DIFFERENT", "rows 2 -> RESULT: PASS"); }
  catch { console.log("after redeploy: user", r, r === user ? "SAME" : "DIFFERENT", "rows", await p.getByTestId("count").textContent(), "-> RESULT: FAIL"); }
}
await b.close();
