import { chromium } from "@playwright/test";
const browser = await chromium.launch(); const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto((process.env.URL ?? "http://localhost:5287/"));
try { await page.getByTestId("user").waitFor({ timeout: 30000 }); } catch { console.log("no user; body:", (await page.textContent("body")).slice(0, 300)); }
try { console.log(JSON.stringify(await page.evaluate(() => window.__classicProbe()))); } catch (e) { console.log("probe failed:", e.message.split("\n")[0]); }
console.log("jazz2 status:", await page.getByTestId("status").first().textContent().catch(() => "?"));
console.log("errors:", errs.slice(0, 8));
await browser.close();
