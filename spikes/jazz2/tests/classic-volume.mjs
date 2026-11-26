import { chromium } from "@playwright/test";
const URL = "http://localhost:5287/";
const KEY = "calgram-migration-spike@example.com";
const b = await chromium.launch();
const open = async () => { const p = await (await b.newContext()).newPage(); await p.goto(URL); await p.getByTestId("user").waitFor({ timeout: 30000 }); return p; };
try {
  const N = 4700;
  const meals = Array.from({ length: N }, (_, i) => ({ timestamp: new Date(Date.UTC(2025, 0, 1) + i * 3600e3 * 3).toISOString().replace("Z", "-08:00"), foodName: `Food ${i % 300}`, totalCalories: 100 + (i % 50) }));
  const A = await open();
  let t = Date.now();
  const created = await A.evaluate(async ([k, m]) => (await window.__classicLab()).createClassic(k, m), [KEY, meals]);
  console.log(`created Classic account with ${created.mealIds.length} meals and synced in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  const B = await open();
  t = Date.now();
  const read = await B.evaluate(async ([k, a, s]) => { const r = await (await window.__classicLab()).readClassic(k, a, s); return { ms: r.ms, meals: r.meals?.length, weights: r.weights?.length }; }, [KEY, created.accountID, created.seed]);
  console.log(`fresh profile, no cache: loaded ${read.meals} meals + ${read.weights} weigh-ins in ${(read.ms / 1000).toFixed(1)}s (page total ${((Date.now() - t) / 1000).toFixed(1)}s)`);
} catch (e) { console.log("FAIL", e.message.split("\n")[0]); }
await b.close();
