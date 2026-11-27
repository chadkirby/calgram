import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { importFile, openDataCard, startNewAccount } from "../support/app";

// Time from a reload until the Daily page shows today's meals, for an account
// with MEALS meals (default 4,600, four a day ending today). Run with
// `pnpm exec playwright test -c playwright.perf.config.ts`; not part of test:e2e.

const COUNT = Number(process.env.MEALS ?? 4600);
const RUNS = Number(process.env.RUNS ?? 5);

function backup(count: number) {
  const today = DateTime.now().startOf("day");
  const hours = [8, 12, 15, 19];
  const mealEntries = Array.from({ length: count }, (_, i) => {
    const at = today.minus({ days: Math.floor(i / 4) }).set({ hour: hours[i % 4] });
    return {
      id: `co_zPerf${i}`,
      timestamp: at.toISO(),
      foodName: `Food ${i % 60}`,
      foodCategory: `Category ${i % 7}`,
      caloriesPerGram: 1 + (i % 5) / 2,
      weightInGrams: 50 + (i % 9) * 10,
      totalCalories: 100 + (i % 13) * 10,
    };
  });
  return {
    version: "1.2",
    exportDate: DateTime.now().toISO(),
    profile: { firstName: "Perf" },
    mealEntries,
    weightEntries: [],
  };
}

test("time to meals on screen after a reload", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  await startNewAccount(page);
  const settings = await openDataCard(page);
  await importFile(page, backup(COUNT));
  await expect(settings.getByRole("alert")).toContainText(`Imported ${COUNT} meals`, {
    timeout: 10 * 60_000,
  });

  await page.keyboard.press("Escape");
  // Today's meals are on screen. A large import keeps saving after that, and a reload
  // in the meantime comes back without the meals, so let it finish first.
  await expect(page.getByTestId("meal-entry")).toHaveCount(Math.min(COUNT, 4));
  await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 20_000));

  // Record when the first meal row appears, measured from navigation start.
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (document.querySelector('[data-testid="meal-entry"]')) {
        document.documentElement.dataset.mealsAt = String(performance.now());
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });

  const times: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    // Runs are sequential on purpose: each is one cold reload.
    // oxlint-disable-next-line no-await-in-loop
    await page.reload();
    // oxlint-disable-next-line no-await-in-loop
    await expect(page.locator("html[data-meals-at]")).toBeAttached({ timeout: 60_000 });
    // oxlint-disable-next-line no-await-in-loop
    times.push(Number(await page.locator("html").getAttribute("data-meals-at")));
  }
  const sorted = times.toSorted((a, b) => a - b);
  console.log(
    `${COUNT} meals: median ${Math.round(sorted[Math.floor(RUNS / 2)])} ms; runs ${times.map(Math.round).join(", ")}`,
  );
});
