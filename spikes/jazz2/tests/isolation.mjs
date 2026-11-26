import { chromium } from "@playwright/test";
const PROD = "https://jazz-vite-spike.chad-kirby.workers.dev/", PREV = "https://spike-check-jazz-vite-spike.chad-kirby.workers.dev/";
const b = await chromium.launch();
const errs = [];
const open = async (u) => { const p = await (await b.newContext()).newPage(); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text().slice(0, 200)); }); p.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 200))); await p.goto(u); await p.getByTestId("user").waitFor({ timeout: 30000 }); return p; };
const count = (p, n) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: 20000 });
try {
  const a = await open(PROD);
  await a.getByRole("button", { name: "add" }).click(); await a.getByRole("button", { name: "add" }).click(); await count(a, 2);
  await a.getByRole("button", { name: "export key" }).click(); const key = (await a.getByTestId("key").textContent()).trim();
  const user = await a.getByTestId("user").textContent();
  await a.waitForTimeout(3000);
  const p = await open(PREV);
  await p.getByTestId("restore-input").first().fill(key); await p.getByRole("button", { name: "restore", exact: true }).first().click();
  await p.waitForFunction((u) => document.querySelector('[data-testid=user]')?.textContent === u, user, { timeout: 30000 });
  await p.waitForTimeout(4000); await count(p, 0);
  console.log("same account on Preview sees 0 of production's 2 rows: Preview data is isolated. RESULT: PASS");
} catch (e) { console.log("RESULT: FAIL", e.message.split("\n")[0]); for (const pg of b.contexts().flatMap((c) => c.pages())) console.log("page", pg.url(), "status:", await pg.getByTestId("status").first().textContent().catch(() => "?"), "user:", await pg.getByTestId("user").first().textContent().catch(() => "?")); console.log(errs.slice(0, 10).join("\n")); }
await b.close();
