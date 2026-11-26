import { chromium } from "@playwright/test";
const URL = process.env.URL ?? "http://localhost:5287/";
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const browser = await chromium.launch();
const errs = [];
async function open(name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errs.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(URL);
  await page.getByTestId("user").waitFor({ timeout: 30000 });
  return { ctx, page };
}
const text = (p, id) => p.getByTestId(id).first().textContent();
const waitCount = (p, n, ms = 20000) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: ms });
const sync = async (p) => p.evaluate(() => (window.__sync ?? null));

try {
  const A = await open("A");
  const userA = await text(A.page, "user");
  log("A status", await text(A.page, "status"), "user", userA);
  await waitCount(A.page, 0);
  await A.page.getByRole("button", { name: "add" }).click();
  await A.page.getByRole("button", { name: "add" }).click();
  await waitCount(A.page, 2);
  log("A wrote 2 rows");

  const B = await open("B");
  const userB = await text(B.page, "user");
  log("B (fresh profile) user", userB, "same as A?", userA === userB);
  await waitCount(B.page, 0, 10000);
  log("B sees 0 rows of A's (permissions isolate)");

  // Persistence across reload of A
  await A.page.reload();
  await A.page.getByTestId("user").waitFor();
  await waitCount(A.page, 2);
  log("A reload: same user?", (await text(A.page, "user")) === userA, "rows 2");

  // Export A's key, wipe nothing; restore it into a third fresh profile
  await A.page.getByRole("button", { name: "export key" }).click();
  const key = (await text(A.page, "key")).trim();
  log("A key length", key.length);

  const C = await open("C");
  log("C initial user", await text(C.page, "user"));
  await C.page.getByTestId("restore-input").fill(key);
  await C.page.getByRole("button", { name: "restore", exact: true }).click();
  await C.page.waitForFunction((u) => document.querySelector('[data-testid=user]')?.textContent === u, userA, { timeout: 30000 });
  log("C restored as A");
  await waitCount(C.page, 2, 30000);
  log("C sees A's 2 rows (fetched from server)");

  // C edits; A sees it live
  await C.page.getByRole("button", { name: "add" }).click();
  await waitCount(C.page, 3);
  await waitCount(A.page, 3, 20000);
  log("A sees C's new row live -> 3");

  // B, a different account, waits long enough for any sync, then tries to write A's rows.
  await B.page.waitForTimeout(4000);
  await waitCount(B.page, 0, 1000);
  log("B still sees 0 rows 4s after A's rows reached the server");
  const ids = await A.page.evaluate(() => window.__ids);
  const attempt = await B.page.evaluate(async (ids) => {
    const out = [];
    for (const [op, fn] of [["update", (id) => window.__db.update(window.__app.weightEntries, id, { notes: "hacked" })],
                            ["delete", (id) => window.__db.delete(window.__app.weightEntries, id)]]) {
      try { const r = fn(ids[0]); if (r?.wait) await r.wait({ tier: "global" }).catch((e) => { throw e; }); out.push(`${op}: no error`); }
      catch (e) { out.push(`${op}: ${String(e).slice(0, 120)}`); }
    }
    return out;
  }, ids);
  log("B write attempts on A's row:", JSON.stringify(attempt));
  await A.page.waitForTimeout(4000);
  const notesA = await A.page.$$eval("[data-testid=rows] li", (ls) => ls.map((l) => l.dataset.notes));
  log("A after B's attempts: rows", notesA.length, "notes", JSON.stringify(notesA));
  if (notesA.length !== 3 || notesA.some((n) => n !== "spike")) throw new Error("B changed A's data");
  // B still isolated
  await B.page.reload(); await B.page.getByTestId("user").waitFor();
  await waitCount(B.page, 0, 10000);
  log("B still 0 rows, user", (await text(B.page, "user")) === userB ? "unchanged" : "CHANGED");
  log("RESULT: PASS");
} catch (e) {
  log("RESULT: FAIL", e.message.split("\n")[0]);
} finally {
  console.log("console errors/warnings:\n" + errs.slice(0, 30).join("\n"));
  await browser.close();
}
