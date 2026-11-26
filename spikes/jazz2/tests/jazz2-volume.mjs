import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage(); await p.goto("http://localhost:5287/"); await p.getByTestId("user").waitFor({ timeout: 30000 });
const r = await p.evaluate(async () => {
  const t = window.__app.weightEntries, t0 = Date.now(); let last;
  for (let i = 0; i < 4700; i++) { const hex = i.toString(16).padStart(12, "0"); last = window.__db.insert(t, { timestamp: "2025-01-01T08:00:00.000-08:00", weightValue: i, notes: "m" }, { id: `aaaaaaaa-0000-5000-8000-${hex}` }); }
  const queued = Date.now() - t0; await last.wait({ tier: "global" });
  return { queuedMs: queued, ackMs: Date.now() - t0 };
});
console.log(`4,700 inserts: written locally in ${(r.queuedMs/1000).toFixed(1)}s, last one acknowledged by server at ${(r.ackMs/1000).toFixed(1)}s`);
await p.reload(); await p.getByTestId("user").waitFor({ timeout: 30000 });
await p.waitForFunction(() => document.querySelector('[data-testid=count]')?.textContent === "4700", null, { timeout: 60000 }).then(() => console.log("after reload: 4700 rows")).catch(async () => console.log("after reload count:", await p.getByTestId("count").textContent()));
await b.close();
