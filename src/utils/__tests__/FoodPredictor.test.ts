import { DateTime } from "luxon";
import { describe, test, expect } from 'vitest';
import { FoodPredictor, getTimeOfDay, calculateDayRecencyScore, calculateTimeOfDayScore, type PredictionEntry } from "../FoodPredictor";

function buildEntriesFromSample(): PredictionEntry[] {
  const raw: PredictionEntry[] = [
  {
    foodName: "purina kibble",
    timestamp: "2025-07-28T10:41:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "stick",
    timestamp: "2025-07-28T10:40:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "Biscuits",
    timestamp: "2025-07-28T11:20:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "Dinner",
    timestamp: "2025-07-28T18:21:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-28T18:34:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "stick",
    timestamp: "2025-07-28T19:18:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-29T10:54:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "People food",
    timestamp: "2025-07-29T13:12:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "People food",
    timestamp: "2025-07-29T18:25:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "stick",
    timestamp: "2025-07-29T20:01:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "pup cup",
    timestamp: "2025-07-29T21:01:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-30T13:36:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "People food",
    timestamp: "2025-07-30T18:13:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-30T18:28:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "stick",
    timestamp: "2025-07-30T20:02:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "pup cup",
    timestamp: "2025-07-30T21:04:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-30T23:29:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-31T11:43:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "People food",
    timestamp: "2025-07-31T13:07:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "People food",
    timestamp: "2025-07-31T18:15:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "Fromm pork and applesauce",
    timestamp: "2025-07-31T18:32:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "stick",
    timestamp: "2025-07-31T20:01:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "pup cup",
    timestamp: "2025-07-31T21:03:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-07-31T21:54:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "Biscuits",
    timestamp: "2025-08-01T09:38:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "Fromm pork and applesauce",
    timestamp: "2025-08-01T09:50:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "Yak cheese",
    timestamp: "2025-08-01T12:56:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "People food",
    timestamp: "2025-08-01T13:06:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "People food",
    timestamp: "2025-08-01T18:14:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-08-01T18:27:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "stick",
    timestamp: "2025-08-01T20:02:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "pup cup",
    timestamp: "2025-08-01T21:03:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "Fromm pork and applesauce",
    timestamp: "2025-08-02T11:12:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "Fromm pork and applesauce",
    timestamp: "2025-08-02T16:35:00.000-07:00",
    foodCategory: "dry dog food",
  },
  {
    foodName: "People food",
    timestamp: "2025-08-02T18:22:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "People food",
    timestamp: "2025-08-02T18:31:00.000-07:00",
    foodCategory: "people food",
  },
  {
    foodName: "stick",
    timestamp: "2025-08-02T20:01:00.000-07:00",
    foodCategory: "treats",
  },
  {
    foodName: "purina kibble",
    timestamp: "2025-08-02T21:05:00.000-07:00",
    foodCategory: "dry dog food",
  },
];
// Adapt sample objects that use "category" -> "foodCategory" for the PredictionEntry type
return raw;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("FoodPredictor helpers", () => {
  test("getTimeOfDay uses Luxon and returns minutes since midnight", () => {
    const dt = DateTime.fromISO("2025-08-03T19:36:00.000-07:00");
    expect(getTimeOfDay(dt as unknown as Date)).toBe(dt.hour * 60 + dt.minute);
  });

  test("calculateDayRecencyScore decays with increasing day difference", () => {
    const now = DateTime.fromISO("2025-08-03T12:00:00.000-07:00");
    const sameDay = DateTime.fromISO("2025-08-03T00:00:00.000-07:00");
    const twoDaysAgo = DateTime.fromISO("2025-07-25T00:00:00.000-07:00");

    const s0 = calculateDayRecencyScore(sameDay as unknown as Date, now as unknown as Date);
    const s2 = calculateDayRecencyScore(twoDaysAgo as unknown as Date, now as unknown as Date);

    expect(s0).toBeGreaterThan(s2);
    expect(s0).toBeGreaterThan(0);
    expect(s2).toBeGreaterThan(0);
  });

  test("calculateTimeOfDayScore favors similar times, handles wrap-around", () => {
    const now = DateTime.fromISO("2025-08-03T23:00:00.000-07:00");
    const currentTod = getTimeOfDay(now as unknown as Date);

    const near = DateTime.fromISO("2025-08-03T23:10:00.000-07:00");
    const farWrap = DateTime.fromISO("2025-08-03T01:00:00.000-07:00"); // 2 hours away wrapping midnight

    const sNear = calculateTimeOfDayScore(near as unknown as Date, currentTod);
    const sFar = calculateTimeOfDayScore(farWrap as unknown as Date, currentTod);

    expect(sNear).toBeGreaterThan(sFar);
  });
});

describe("FoodPredictor with sample data", () => {
  const entries = buildEntriesFromSample();

  test("predictMostLikelyFood returns a top candidate within the window", () => {
    const current = new Date("2025-08-03T20:00:00.000-07:00");
    const predicted = FoodPredictor.predictMostLikelyFood(entries, current, 7);
    // Given multiple clustered 'stick' entries on 7/30 at ~20:02, expect "stick"
    expect(predicted).toBe("stick");
  });

  test("getTopFoodPredictions returns sorted list with scores", () => {
    const current = new Date("2025-08-03T20:00:00.000-07:00");
    const top = FoodPredictor.getTopFoodPredictions(entries, current, 7, 3);
    expect(top.length).toBeGreaterThan(0);
    // Ensure sorted by score descending
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
    }
    // Top should likely be "stick"
    expect(top[0].foodName.toLowerCase()).toBe("stick");
    // Each item should carry back its grouped entries
    expect(top[0].entries.length).toBeGreaterThan(0);
  });

  test("case-insensitive grouping: 'Food' and 'food' grouped but preserve recent display casing", () => {
    const mixed: PredictionEntry[] = [
      { foodName: "Food", foodCategory: "X", timestamp: "2025-07-26T12:00:00.000-07:00" },
      { foodName: "food", foodCategory: "X", timestamp: "2025-07-27T12:00:00.000-07:00" },
    ];
    const current = new Date("2025-08-03T12:00:00.000-07:00");
    const top = FoodPredictor.getTopFoodPredictions(mixed, current, 7, 1);
    // Most recent casing is "food"
    expect(top[0].foodName).toBe("food");
  });

  test("resolveCategoryForFood prefers FoodIntelligence lastUsedCategory else majority", () => {
    // Build a very small intelligence-like object. CoMap typing not required for runtime.
    const intelligence: any = {
      foodData: {
        "food": { lastUsedCPG: 2, lastUsedCategory: "pref", usageCount: 3, lastUsed: DateTime.now().toISO()! }
      }
    };

    const group: PredictionEntry[] = [
      { foodName: "food", foodCategory: "A", timestamp: "2025-07-27T10:00:00.000-07:00" },
      { foodName: "food", foodCategory: "B", timestamp: "2025-07-27T11:00:00.000-07:00" },
      { foodName: "food", foodCategory: "B", timestamp: "2025-07-27T12:00:00.000-07:00" },
    ];
    const chosen = FoodPredictor.resolveCategoryForFood(intelligence, "food", group as any);
    expect(chosen).toBe("pref");

    // If no intelligence for that food, expect majority "B"
    const chosen2 = FoodPredictor.resolveCategoryForFood(undefined, "food", group as any);
    expect(chosen2).toBe("B");
  });

  test("daysToConsider filters out entries older than the window", () => {
    // With current = 2025-08-03T12:00, a 1-day window should only include entries from 2025-08-02T12:00 onward.
    const now = new Date("2025-08-03T12:00:00.000-07:00");
    const oneDayOnly = FoodPredictor.getTopFoodPredictions(entries, now, 1, 50);

    // Expect there are NO entries from 2025-07-31 or earlier included (e.g., 'pup cup' at 2025-07-31T21:03 should be excluded)
    const containsJuly31 = oneDayOnly.some(s =>
      s.entries.some(e => e.timestamp.startsWith("2025-07-31"))
    );
    expect(containsJuly31).toBe(false);

    // Expect to include entries from late 2025-08-02 and 2025-08-03 morning (e.g., Fromm 2025-08-02T16:35 and purina 2025-08-02T21:05)
    const hasAug02Late = oneDayOnly.some(s =>
      s.entries.some(e => e.timestamp.startsWith("2025-08-02T16:")) ||
      s.entries.some(e => e.timestamp.startsWith("2025-08-02T21:"))
    );
    expect(hasAug02Late).toBe(true);

    // Sanity: in this narrow window, there should be no 'pup cup' yet (the next occurs 2025-08-01 and earlier),
    // while 'Fromm pork and applesauce' or 'purina kibble' should appear due to 8/2 entries.
    expect(oneDayOnly.find(f => f.foodName.toLowerCase() === "pup cup")).toBeFalsy();
    expect(
      oneDayOnly.find(f => f.foodName.toLowerCase() === "fromm pork and applesauce")
      || oneDayOnly.find(f => f.foodName.toLowerCase() === "purina kibble")
    ).toBeTruthy();
  });

  test("predicts 'pup cup' around 8:45pm PDT on 2025-07-30 due to nightly pattern", () => {
    const current = new Date("2025-08-03T20:45:00.000-07:00");
    // Use a 7-day window and ask for the single top prediction
    const top = FoodPredictor.getTopFoodPredictions(entries, current, 7, 1);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].foodName.toLowerCase()).toBe("pup cup");

    // Also verify the convenience API returns the same
    const predicted = FoodPredictor.predictMostLikelyFood(entries, current, 7);
    expect(predicted?.toLowerCase()).toBe("pup cup");
  });

  test("predicts 'pup cup' around 9pm PDT on 2025-07-30 due to nightly pattern", () => {
    const current = new Date("2025-08-03T21:00:00.000-07:00");
    // Use a 7-day window and ask for the single top prediction
    const top = FoodPredictor.getTopFoodPredictions(entries, current, 7, 1);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].foodName.toLowerCase()).toBe("pup cup");

    // Also verify the convenience API returns the same
    const predicted = FoodPredictor.predictMostLikelyFood(entries, current, 7);
    expect(predicted?.toLowerCase()).toBe("pup cup");
  });

  test.skip("hourly predictions from 9am to 9pm on 2025-08-03 follow expected pattern", () => {
    const hourlyEntries = buildEntriesFromSample();

    // Expected dominant items by hour derived from sample:
    // Morning (9–11): breakfast-y items appear on 8/1 ~09:38/09:50; expect dry dog food variants near late morning.
    // Noon-ish (12–13): "Yak cheese" at 12:56 on 8/1; "People food" at 13:06 on 8/1.
    // Evening cadence repeating daily:
    //   ~18:15: People food
    //   ~18:27–18:34: purina kibble
    //   ~20:00: stick
    //   ~21:00: pup cup
    //
    // We assert a small representative set across the 9–21 hours to validate TOD shaping.
    const expectations: Record<number, string> = {
      9:  "purina kibble",
      10: "purina kibble",
      11: "fromm pork and applesauce",
      12: "yak cheese",
      13: "people food",
      14: "people food",
      15: "people food",
      16: "fromm pork and applesauce",
      17: "people food",
      18: "people food",
      19: "stick",
      20: "stick",
      21: "pup cup"
    };

    for (let hour = 9; hour <= 21; hour++) {
      const current = new Date(`2025-08-03T${String(hour).padStart(2, "0")}:00:00.000-07:00`);
      const top = FoodPredictor.getTopFoodPredictions(hourlyEntries, current, 7, 1);
      expect(top.length).toBeGreaterThan(0);

      const predicted = top[0].foodName.toLowerCase();
      const expected = expectations[hour];
      if (expected) {
        expect(predicted, `Unexpected prediction for ${hour}:00`).toBe(expected);
      } else {
        expect(["people food","purina kibble","stick","pup cup","fromm pork and applesauce","yak cheese"]).toContain(predicted);
      }
    }
  });
});
