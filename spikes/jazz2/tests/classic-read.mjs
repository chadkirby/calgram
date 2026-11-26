import { chromium } from "@playwright/test";
const URL = "http://localhost:5287/";
const KEY = "calgram-migration-spike@example.com";
const b = await chromium.launch();
const errs = [];
const open = async (n) => { const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(`[${n}] ${e.message.slice(0, 300)}`)); p.on("console", (m) => { if (m.type() === "error") errs.push(`[${n}] ${m.text().slice(0, 300)}`); }); await p.goto(URL); await p.getByTestId("user").waitFor({ timeout: 30000 }); return p; };
try {
  const A = await open("A");
  const meals = [
    { timestamp: "2025-07-27T19:36:00.000-07:00", foodName: "Apple", totalCalories: 52 },
    { timestamp: "2025-07-27T19:36:00.000-07:00", foodName: "Apple", totalCalories: 52 },
    { timestamp: "2026-10-30", foodName: "Toast", totalCalories: 120 },
  ];
  const created = await A.evaluate(async ([k, m]) => (await window.__classicLab()).createClassic(k, m), [KEY, meals]);
  console.log("created Classic account", created.accountID, "seed bytes", created.seed.length, "meals", created.mealIds.length);
  const B = await open("B");
  const read = await B.evaluate(async ([k, a, s]) => (await window.__classicLab()).readClassic(k, a, s), [KEY, created.accountID, created.seed]);
  console.log("fresh profile read in", read.ms, "ms; root?", read.hasRoot, "meals", read.meals?.length, "weights", read.weights?.length, "IndexedDBs:", JSON.stringify(read.indexedDBs));
  const same = JSON.stringify(read.meals.map((m) => [m.timestamp, m.foodName, m.totalCalories])) === JSON.stringify(meals.map((m) => [m.timestamp, m.foodName, m.totalCalories]));
  console.log("timestamps and values byte-identical:", same, "ids match:", JSON.stringify(read.meals.map((m) => m.id)) === JSON.stringify(created.mealIds));
  // Jazz 2: derive key from the real seed bytes, open account, insert rows with UUIDs from (account, classicId)
  const migrate = (p) => p.evaluate(async ([seed, rows]) => {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", new Uint8Array(seed), "HKDF", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("calgram/jazz2-device-key/v1") }, k, 256));
    const key = "jazz-auth-v1:" + btoa(String.fromCharCode(...bits)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await window.__session.restoreDeviceAccount(key);
    const acct = window.__session.user.accountId;
    const uuid = async (src) => { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`calgram/rows/v1|${acct}|${src}`))).slice(0, 16); h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80; const x = [...h].map((b) => b.toString(16).padStart(2, "0")).join(""); return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`; };
    for (const r of rows) window.__db.upsert(window.__app.weightEntries, await uuid(r.id), { timestamp: r.timestamp, weightValue: r.totalCalories, notes: r.foodName });
    return acct;
  }, [created.seed, read.meals]);
  const count = (p, n) => p.waitForFunction((n) => document.querySelector('[data-testid=count]')?.textContent === String(n), n, { timeout: 30000 });
  const C = await open("C"); const accC = await migrate(C); await count(C, 3);
  console.log("Jazz 2 migration from real seed: account", accC, "rows 3 (two identical Apples kept apart by Classic ids)");
  const D = await open("D"); const accD = await migrate(D); await D.waitForTimeout(3000); await count(D, 3);
  console.log("second device re-run: same account?", accC === accD, "rows still 3");
  console.log("RESULT: PASS");
} catch (e) { console.log("RESULT: FAIL", e.message.split("\n")[0]); }
console.log(errs.slice(0, 12).join("\n"));
await b.close();
