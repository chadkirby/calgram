import { expect, test } from "@playwright/test";

// The Worker hosts Jazz 2 at /jazz (plan U4). Until the app uses it, these
// checks cover what the Worker itself must guarantee.

test("the Jazz Inspector API refuses every request", async ({ request }) => {
  const response = await request.post("/jazz/inspect/api", {
    data: { op: "tables" },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: "unauthorized" });
});

test("/jazz is served by the Worker, not the app's HTML", async ({ request }) => {
  const response = await request.get("/jazz/inspect/api");
  expect(response.headers()["content-type"] ?? "").not.toContain("text/html");
});

test("the existing /api route still answers", async ({ request }) => {
  const response = await request.get("/api/anything");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ name: "Cloudflare" });
});
