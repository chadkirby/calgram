import { chromium } from "@playwright/test";
const URL = "http://localhost:5287/";
const b = await chromium.launch();
const open = async () => { const p = await (await b.newContext()).newPage(); await p.goto(URL); await p.getByTestId("user").waitFor({ timeout: 30000 }); return p; };
const KEY = "jazz-auth-v1:" + Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + Date.now()) % 256)).toString("base64url");
const X = "11111111-1111-5111-8111-111111111111", Y = "22222222-2222-5222-8222-222222222222";
try {
  const A = await open();
  await A.evaluate(async ([k, X, Y]) => {
    await window.__session.restoreDeviceAccount(k);
    const t = window.__app.weightEntries;
    await window.__db.insert(t, { timestamp: "2026-10-30", weightValue: 80, notes: "edited-newer" }, { id: X }).wait({ tier: "global" });
    await window.__db.insert(t, { timestamp: "2026-10-31", weightValue: 81, notes: "to-delete" }, { id: Y }).wait({ tier: "global" });
    await window.__db.delete(t, Y).wait({ tier: "global" });
  }, [KEY, X, Y]);
  console.log("A: wrote X (newer edit), wrote+deleted Y, all acknowledged by server");
  const B = await open();
  const r = await B.evaluate(async ([k, X, Y]) => {
    await window.__session.restoreDeviceAccount(k);
    const t = window.__app.weightEntries;
    const localNoWait = await window.__db.one(t.where({ id: X }), { tier: "local-first", firstLoadRemoteWaitMs: 0 });
    const remote = await window.__db.one(t.where({ id: X }), { tier: "remote" });
    const remoteY = await window.__db.one(t.where({ id: Y }), { tier: "remote" });
    let insertExisting;
    try { const h = window.__db.insert(t, { timestamp: "2026-10-30", weightValue: 70, notes: "stale-classic" }, { id: X }); await h.wait({ tier: "global" }); insertExisting = "accepted"; } catch (e) { insertExisting = "rejected: " + String(e).slice(0, 160); }
    let insertDeleted;
    try { const h = window.__db.insert(t, { timestamp: "2026-10-31", weightValue: 71, notes: "resurrected" }, { id: Y }); await h.wait({ tier: "global" }); insertDeleted = "accepted"; } catch (e) { insertDeleted = "rejected: " + String(e).slice(0, 160); }
    await new Promise((r) => setTimeout(r, 1500));
    const finalX = await window.__db.one(t.where({ id: X }), { tier: "remote" });
    const finalY = await window.__db.one(t.where({ id: Y }), { tier: "remote" });
    return { localNoWait: localNoWait?.notes ?? null, remote: remote?.notes ?? null, remoteY: remoteY?.notes ?? null, insertExisting, insertDeleted, finalX: finalX?.notes ?? null, finalY: finalY?.notes ?? null };
  }, [KEY, X, Y]);
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.log("FAIL", e.message.split("\n")[0]); }
await b.close();
