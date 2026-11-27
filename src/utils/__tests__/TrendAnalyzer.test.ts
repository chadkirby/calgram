import { describe, it, expect } from "vitest";
import { TrendAnalyzer, type ChartDataPoint } from "../TrendAnalyzer";
import { DateTime } from "luxon";
import type { MealRow, ProfileRow, WeightRow } from "../../schema";

// Helper function to create mock meal entry
const createMockMealEntry = (timestamp: string, foodName: string, totalCalories: number) => {
  return {
    timestamp,
    foodName,
    foodCategory: "Test",
    caloriesPerGram: 1.0,
    weightInGrams: totalCalories,
    notes: "",
    totalCalories,
  } satisfies MealRow;
};

// Helper function to create mock weight entry
const createMockWeightEntry = (timestamp: string, weightValue: number, unit?: "lbs" | "kg") => {
  return {
    timestamp,
    weightValue,
    notes: "",
    unit,
  } satisfies WeightRow;
};

// Helper function to create mock profile
const createMockProfile = (bodyWeightUnit?: "lbs" | "kg") => {
  return {
    name: "Test User",
    firstName: "Test",
    bodyWeightUnit,
  } satisfies ProfileRow;
};

// Midnight n days ago, as an ISO string
const daysAgo = (n: number) => DateTime.now().startOf("day").minus({ days: n }).toISO() || "";

// Day n after a fixed start, as a ms timestamp
const day = (n: number) => DateTime.fromISO("2026-09-01").plus({ days: n }).toMillis();

describe("TrendAnalyzer", () => {
  describe("calculateLOWESSTrend", () => {
    it("should return original data for arrays with less than 3 points", () => {
      expect(TrendAnalyzer.calculateLOWESSTrend([])).toEqual([]);
      expect(TrendAnalyzer.calculateLOWESSTrend([1])).toEqual([1]);
      expect(TrendAnalyzer.calculateLOWESSTrend([1, 2])).toEqual([1, 2]);
    });

    it("should smooth data for arrays with 3 or more points", () => {
      const data = [1, 5, 2, 8, 3, 7, 4];
      const smoothed = TrendAnalyzer.calculateLOWESSTrend(data);

      expect(smoothed).toHaveLength(data.length);
      expect(smoothed).not.toEqual(data); // Should be different from original

      // Smoothed values should be less extreme
      expect(Math.max(...smoothed)).toBeLessThanOrEqual(Math.max(...data));
      expect(Math.min(...smoothed)).toBeGreaterThanOrEqual(Math.min(...data));
    });

    it("should handle different bandwidth values", () => {
      const data = [1, 10, 2, 9, 3, 8, 4];

      const smoothed1 = TrendAnalyzer.calculateLOWESSTrend(data, 0.1);
      const smoothed2 = TrendAnalyzer.calculateLOWESSTrend(data, 0.5);

      expect(smoothed1).toHaveLength(data.length);
      expect(smoothed2).toHaveLength(data.length);
      expect(smoothed1).not.toEqual(smoothed2);
    });

    it("should handle constant data", () => {
      const data = [5, 5, 5, 5, 5];
      const smoothed = TrendAnalyzer.calculateLOWESSTrend(data);

      expect(smoothed).toEqual([5, 5, 5, 5, 5]);
    });
  });

  describe("prepareDailyCalorieData", () => {
    it("should return empty array for undefined or empty meals", () => {
      expect(TrendAnalyzer.prepareDailyCalorieData(undefined)).toEqual([]);
      expect(TrendAnalyzer.prepareDailyCalorieData([])).toEqual([]);
    });

    it("should prepare daily calorie data for days with meals", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const yesterday = DateTime.now().startOf("day").minus({ days: 1 }).toISO() || "";

      const meals = [
        createMockMealEntry(today, "Breakfast", 300),
        createMockMealEntry(today, "Lunch", 500),
        createMockMealEntry(yesterday, "Dinner", 600),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 7);

      expect(result).toHaveLength(2); // Only days with meals
      expect(result.every((point) => point.date instanceof Date)).toBe(true);
      expect(result.every((point) => typeof point.calories === "number")).toBe(true);

      // Today should have 800 calories (300 + 500)
      const todayData = result.find(
        (point) =>
          DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(today).toISODate(),
      );
      expect(todayData?.calories).toBe(800);

      // Yesterday should have 600 calories
      const yesterdayData = result.find(
        (point) =>
          DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(yesterday).toISODate(),
      );
      expect(yesterdayData?.calories).toBe(600);
    });

    it("returns days oldest first even when meals arrive out of order", () => {
      const meals = [
        createMockMealEntry(daysAgo(3), "A", 100),
        createMockMealEntry(daysAgo(20), "B", 200),
        createMockMealEntry(daysAgo(0), "C", 300),
        createMockMealEntry(daysAgo(9), "D", 400),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 30);

      expect(result.map((point) => point.calories)).toEqual([200, 400, 100, 300]);
    });

    it("should only include days with meals (no zero-calorie days)", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const meals = [createMockMealEntry(today, "Breakfast", 300)];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 3);

      expect(result).toHaveLength(1); // Only days with meals

      // Should have one day with 300 calories
      const totalCalories = result.reduce((sum, point) => sum + point.calories!, 0);
      expect(totalCalories).toBe(300);

      expect(result[0].calories).toBe(300);
    });

    it("should filter out meals outside the date range", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const oldDate = DateTime.now().startOf("day").minus({ days: 10 }).toISO() || "";

      const meals = [
        createMockMealEntry(today, "Today", 300),
        createMockMealEntry(oldDate, "Old", 500),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 3);

      // Should only include today's meal
      const totalCalories = result.reduce((sum, point) => sum + point.calories!, 0);
      expect(totalCalories).toBe(300);
    });
  });

  describe("prepareWeightData", () => {
    it("should return empty array for undefined or empty weights", () => {
      expect(TrendAnalyzer.prepareWeightData(undefined)).toEqual([]);
      expect(TrendAnalyzer.prepareWeightData([])).toEqual([]);
    });

    it("should prepare weight data within the specified date range", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const yesterday = DateTime.now().startOf("day").minus({ days: 1 }).toISO() || "";
      const oldDate = DateTime.now().startOf("day").minus({ days: 10 }).toISO() || "";

      const weights = [
        createMockWeightEntry(today, 70.5),
        createMockWeightEntry(yesterday, 70.2),
        createMockWeightEntry(oldDate, 69.8), // Should be filtered out
      ];

      const result = TrendAnalyzer.prepareWeightData(weights, undefined, 7);

      expect(result).toHaveLength(2); // Only today and yesterday
      expect(result.every((point) => point.date instanceof Date)).toBe(true);
      expect(result.every((point) => typeof point.weight === "number")).toBe(true);

      // Should be sorted by date
      expect(result[0].date.getTime()).toBeLessThanOrEqual(result[1].date.getTime());
    });

    it("should sort weight entries by date", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const yesterday = DateTime.now().startOf("day").minus({ days: 1 }).toISO() || "";

      // Add in reverse chronological order
      const weights = [createMockWeightEntry(today, 70.5), createMockWeightEntry(yesterday, 70.2)];

      const result = TrendAnalyzer.prepareWeightData(weights, undefined, 7);

      expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
      expect(result[0].weight).toBe(70.2);
      expect(result[1].weight).toBe(70.5);
    });
  });

  describe("prepareWeightData with no range limit", () => {
    it("returns every weigh-in up to today when days is Infinity", () => {
      const weights = [
        createMockWeightEntry(daysAgo(400), 14.8),
        createMockWeightEntry(daysAgo(40), 15.0),
        createMockWeightEntry(daysAgo(5), 15.2),
      ];
      expect(
        TrendAnalyzer.prepareWeightData(weights, undefined, Infinity).map((p) => p.weight),
      ).toEqual([14.8, 15.0, 15.2]);
    });
  });

  describe("prepareCombinedData", () => {
    it("should combine calorie and weight data", () => {
      const today = DateTime.now().startOf("day").toISO() || "";
      const yesterday = DateTime.now().startOf("day").minus({ days: 1 }).toISO() || "";

      const meals = [
        createMockMealEntry(today, "Breakfast", 300),
        createMockMealEntry(yesterday, "Dinner", 600),
      ];

      const weights = [createMockWeightEntry(today, 70.5)];

      const result = TrendAnalyzer.prepareCombinedData(meals, weights, undefined, 3);

      expect(result).toHaveLength(2); // Only days with meals

      // Today should have both calories and weight
      const todayData = result.find(
        (point) =>
          DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(today).toISODate(),
      );
      expect(todayData?.calories).toBe(300);
      expect(todayData?.weight).toBe(70.5);

      // Yesterday should have calories but no weight
      const yesterdayData = result.find(
        (point) =>
          DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(yesterday).toISODate(),
      );
      expect(yesterdayData?.calories).toBe(600);
      expect(yesterdayData?.weight).toBeUndefined();
    });

    it("should handle empty data arrays", () => {
      const result = TrendAnalyzer.prepareCombinedData([], [], undefined, 7);
      expect(result).toEqual([]);
    });
  });

  describe("calculateTrendLines", () => {
    it("should calculate trend lines for chart data", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(day(0)), calories: 2000, weight: 70.0 },
        { date: new Date(day(1)), calories: 2200, weight: 70.2 },
        { date: new Date(day(2)), calories: 1800, weight: 70.1 },
        { date: new Date(day(3)), calories: 2100, weight: 69.9 },
        { date: new Date(day(4)), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);
      expect(result.caloriesTrend.every((val) => typeof val === "number")).toBe(true);
      expect(result.weightTrend.every((val) => typeof val === "number")).toBe(true);
    });

    it("should handle data with missing weight values", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(day(0)), calories: 2000, weight: 70.0 },
        { date: new Date(day(1)), calories: 2200 }, // No weight
        { date: new Date(day(2)), calories: 1800, weight: 70.1 },
        { date: new Date(day(3)), calories: 2100 }, // No weight
        { date: new Date(day(4)), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);

      // The trend spans every day from the first weigh-in to the last
      expect(result.weightTrend[0]).toBeDefined(); // Has weight data
      expect(result.weightTrend[1]).toBeDefined(); // Between weigh-ins
      expect(result.weightTrend[2]).toBeDefined(); // Has weight data
      expect(result.weightTrend[3]).toBeDefined(); // Between weigh-ins
      expect(result.weightTrend[4]).toBeDefined(); // Has weight data
    });

    it("fills the days between weigh-ins", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(day(0)), calories: 2000, weight: 70.0 },
        { date: new Date(day(1)), calories: 2200 }, // No weight
        { date: new Date(day(2)), calories: 1800 }, // No weight
        { date: new Date(day(3)), calories: 2100 }, // No weight
        { date: new Date(day(4)), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);

      // The trend line spans every day from the first weigh-in to the last
      expect(result.weightTrend[0]).toBeDefined(); // Has weight data
      expect(result.weightTrend[1]).toBeDefined(); // Between weigh-ins
      expect(result.weightTrend[2]).toBeDefined(); // Between weigh-ins
      expect(result.weightTrend[3]).toBeDefined(); // Between weigh-ins
      expect(result.weightTrend[4]).toBeDefined(); // Has weight data
    });

    it("fits the weight trend to the weigh-ins it is given, not just the chart's", () => {
      // Chart days have meals but no weigh-ins; the weigh-ins fall on other days,
      // one of them before the chart starts
      const data: ChartDataPoint[] = [10, 11, 12].map((d) => ({
        date: new Date(day(d)),
        calories: 250,
      }));
      const weighIns: ChartDataPoint[] = [
        { date: new Date(day(0)), weight: 15 },
        { date: new Date(day(13)), weight: 16 },
        { date: new Date(day(5)) }, // no weight: ignored
      ];

      expect(TrendAnalyzer.calculateTrendLines(data).weightTrend).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      const { weightTrend } = TrendAnalyzer.calculateTrendLines(data, 0.3, weighIns);
      weightTrend.forEach((value, i) => expect(value).toBeCloseTo(15 + (10 + i) / 13, 2));
    });

    it("should handle empty data", () => {
      const result = TrendAnalyzer.calculateTrendLines([]);

      expect(result.caloriesTrend).toEqual([]);
      expect(result.weightTrend).toEqual([]);
    });
  });

  describe("calculateWeightTrend", () => {
    // Sammy's last year: flat, a slow rise, a peak in August, then a decline
    const sammy = [
      [0, 14.6],
      [8, 14.6],
      [14, 14.7],
      [154, 15.0],
      [261, 15.5],
      [279, 15.3],
      [320, 15.24],
      [335, 15.08],
    ].map(([d, value]) => ({ timestamp: day(d), value }));
    const year = Array.from({ length: 336 }, (_, i) => day(i));

    it("is the line through two weigh-ins", () => {
      const trend = TrendAnalyzer.calculateWeightTrend(
        [
          { timestamp: day(0), value: 15 },
          { timestamp: day(30), value: 16 },
        ],
        [day(0), day(15), day(30)],
      );
      expect(trend[0]).toBeCloseTo(15);
      expect(trend[1]).toBeCloseTo(15.5);
      expect(trend[2]).toBeCloseTo(16);
    });

    it("turns where the weight turned, and ends near the latest weigh-ins", () => {
      const trend = TrendAnalyzer.calculateWeightTrend(sammy, year) as number[];
      const peakDay = trend.indexOf(Math.max(...trend));
      expect(peakDay).toBeGreaterThan(200);
      expect(peakDay).toBeLessThan(300);
      expect(Math.abs(trend[335] - 15.08)).toBeLessThan(0.1);
      expect(trend[335]).toBeLessThan(trend[peakDay]);
    });

    it("doesn't chase a single weigh-in", () => {
      const trend = TrendAnalyzer.calculateWeightTrend(sammy, year) as number[];
      // The one 15.5 reading in August pulls the curve up, but not all the way
      expect(trend[261]).toBeLessThan(15.45);
      expect(trend[261]).toBeGreaterThan(15.3);
    });

    it("has no jumps, even across months without weigh-ins", () => {
      const trend = TrendAnalyzer.calculateWeightTrend(sammy, year) as number[];
      for (let i = 1; i < trend.length; i++) {
        expect(Math.abs(trend[i] - trend[i - 1])).toBeLessThan(0.01);
      }
    });

    it("averages out noise in frequent weigh-ins", () => {
      const weighIns = Array.from({ length: 90 }, (_, i) => ({
        timestamp: day(i),
        value: 70 - 0.02 * i + (i % 2 === 0 ? 0.4 : -0.4),
      }));
      const trend = TrendAnalyzer.calculateWeightTrend(
        weighIns,
        weighIns.map((w) => w.timestamp),
      ) as number[];
      trend.forEach((value, i) => expect(Math.abs(value - (70 - 0.02 * i))).toBeLessThan(0.1));
    });

    it("covers the whole first and last day when weigh-ins carry a time of day", () => {
      const at7am = (d: number) => day(d) + 7 * 60 * 60 * 1000;
      const at8pm = (d: number) => day(d) + 20 * 60 * 60 * 1000;
      const trend = TrendAnalyzer.calculateWeightTrend(
        [
          { timestamp: at7am(0), value: 15 },
          { timestamp: at8pm(10), value: 16 },
        ],
        [day(0), day(10)], // chart points at midnight
      );
      expect(trend[0]).toBeDefined();
      expect(trend[1]).toBeDefined();
    });

    it("counts weigh-ins on consecutive days as two days, even under 24 hours apart", () => {
      const evening = day(0) + 20 * 60 * 60 * 1000;
      const nextMorning = day(1) + 7 * 60 * 60 * 1000;
      const trend = TrendAnalyzer.calculateWeightTrend(
        [
          { timestamp: evening, value: 15 },
          { timestamp: nextMorning, value: 15.2 },
        ],
        [day(0), day(1)],
      );
      expect(trend.every((value) => value !== undefined)).toBe(true);
    });

    it("gives no trend outside the weigh-ins or from fewer than two days of them", () => {
      const two = [
        { timestamp: day(5), value: 15 },
        { timestamp: day(10), value: 16 },
      ];
      expect(TrendAnalyzer.calculateWeightTrend(two, [day(0), day(20)])).toEqual([
        undefined,
        undefined,
      ]);
      expect(TrendAnalyzer.calculateWeightTrend([], [day(0)])).toEqual([undefined]);
      expect(
        TrendAnalyzer.calculateWeightTrend([{ timestamp: day(5), value: 15 }], [day(5)]),
      ).toEqual([undefined]);
      expect(
        TrendAnalyzer.calculateWeightTrend(
          [
            { timestamp: day(5), value: 15 },
            { timestamp: day(5), value: 15.2 },
          ],
          [day(5)],
        ),
      ).toEqual([undefined]);
    });
  });

  describe("getSummaryStats", () => {
    it("should calculate summary statistics", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000, weight: 70.0 },
        { date: new Date(), calories: 2200, weight: 70.2 },
        { date: new Date(), calories: 1800, weight: 70.1 },
        { date: new Date(), calories: 2100, weight: 69.9 },
        { date: new Date(), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.getSummaryStats(data);

      expect(result.totalDays).toBe(5);
      expect(result.avgCalories).toBe(2000); // (2000+2200+1800+2100+1900)/5
      expect(result.maxCalories).toBe(2200);
      expect(result.minCalories).toBe(1800);
      expect(result.avgWeight).toBe(70.1); // (70.0+70.2+70.1+69.9+70.3)/5
      expect(result.weightChange).toBe(0.3); // 70.3 - 70.0
    });

    it("should handle data without weight values", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000 },
        { date: new Date(), calories: 2200 },
        { date: new Date(), calories: 1800 },
      ];

      const result = TrendAnalyzer.getSummaryStats(data);

      expect(result.totalDays).toBe(3);
      expect(result.avgCalories).toBe(2000);
      expect(result.maxCalories).toBe(2200);
      expect(result.minCalories).toBe(1800);
      expect(result.avgWeight).toBeUndefined();
      expect(result.weightChange).toBeUndefined();
    });

    it("should handle empty data", () => {
      const result = TrendAnalyzer.getSummaryStats([]);

      expect(result.totalDays).toBe(0);
      expect(result.avgCalories).toBe(0);
      expect(result.maxCalories).toBe(0);
      expect(result.minCalories).toBe(0);
      expect(result.avgWeight).toBeUndefined();
      expect(result.weightChange).toBeUndefined();
    });

    it("should handle single weight entry", () => {
      const data: ChartDataPoint[] = [{ date: new Date(), calories: 2000, weight: 70.0 }];

      const result = TrendAnalyzer.getSummaryStats(data);

      expect(result.avgWeight).toBe(70.0);
      expect(result.weightChange).toBeUndefined(); // Need at least 2 points for change
    });
  });

  describe("getDateRange", () => {
    it("should return correct date range", () => {
      const { startDate, endDate } = TrendAnalyzer.getDateRange(7);

      expect(startDate instanceof Date).toBe(true);
      expect(endDate instanceof Date).toBe(true);
      expect(startDate.getTime()).toBeLessThan(endDate.getTime());

      // Should be approximately 6 days difference (7 days inclusive)
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(6);
    });

    it("should handle single day range", () => {
      const { startDate, endDate } = TrendAnalyzer.getDateRange(1);

      // Start and end should be the same day
      expect(DateTime.fromJSDate(startDate).toISODate()).toBe(
        DateTime.fromJSDate(endDate).toISODate(),
      );
    });
  });

  describe("calculateCalorieAxisConfig", () => {
    it("should return default config for empty data", () => {
      const result = TrendAnalyzer.calculateCalorieAxisConfig([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(500);
      expect(result.tickInterval).toBe(50);
    });

    it("should calculate config with 50-unit ticks when max < 500", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 150 },
        { date: new Date(), calories: 250 },
        { date: new Date(), calories: 320 },
      ];

      const result = TrendAnalyzer.calculateCalorieAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(400); // Rounded up from 320 to next 100
      expect(result.tickInterval).toBe(50);
    });

    it("should calculate config with 100-unit ticks when max >= 500", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 450 },
        { date: new Date(), calories: 650 },
        { date: new Date(), calories: 720 },
      ];

      const result = TrendAnalyzer.calculateCalorieAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(800); // Rounded up from 720 to next 100
      expect(result.tickInterval).toBe(100);
    });

    it("should handle edge case where max is exactly a multiple of 100", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 300 },
        { date: new Date(), calories: 500 },
      ];

      const result = TrendAnalyzer.calculateCalorieAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(500);
      expect(result.tickInterval).toBe(100); // 500 >= 500, so use 100-unit ticks
    });

    it("should handle zero calories", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 0 },
        { date: new Date(), calories: 0 },
      ];

      const result = TrendAnalyzer.calculateCalorieAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(50); // Ensure max is at least one tick interval
      expect(result.tickInterval).toBe(50);
    });
  });

  describe("calculateWeightAxisConfig", () => {
    it("should return default config for empty weight data", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200 }, // No weight
        { date: new Date(), calories: 300 }, // No weight
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(20);
      expect(result.tickInterval).toBe(2);
    });

    it("should handle small dog weights (< 25lbs) with 0.5 rounding", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200, weight: 14.2 },
        { date: new Date(), calories: 250, weight: 14.5 },
        { date: new Date(), calories: 180, weight: 14.8 },
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeGreaterThan(result.min);
      expect(result.tickInterval).toBe(0.5);

      // Check that data is roughly centered
      const dataMin = 14.2;
      const dataMax = 14.8;
      const axisCenter = (result.min + result.max) / 2;
      const dataCenter = (dataMin + dataMax) / 2;
      expect(Math.abs(axisCenter - dataCenter)).toBeLessThan(2);
    });

    it("should handle medium weights (25-100lbs) with 1.0 rounding", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200, weight: 68 },
        { date: new Date(), calories: 250, weight: 70 },
        { date: new Date(), calories: 180, weight: 72 },
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeGreaterThan(result.min);
      expect(result.tickInterval).toBe(1);

      // Values should be whole numbers
      expect(result.min % 1).toBe(0);
      expect(result.max % 1).toBe(0);
    });

    it("should handle large weights (100-250lbs) with 5.0 rounding", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200, weight: 180 },
        { date: new Date(), calories: 250, weight: 185 },
        { date: new Date(), calories: 180, weight: 190 },
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeGreaterThan(result.min);
      expect(result.tickInterval).toBe(5);

      // Values should be multiples of 5
      expect(result.min % 5).toBe(0);
      expect(result.max % 5).toBe(0);
    });

    it("should handle very large weights (>250lbs) with 10.0 rounding", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200, weight: 280 },
        { date: new Date(), calories: 250, weight: 290 },
        { date: new Date(), calories: 180, weight: 300 },
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeGreaterThanOrEqual(0);
      expect(result.max).toBeGreaterThan(result.min);
      expect(result.tickInterval).toBe(10);

      // Values should be multiples of 10
      expect(result.min % 10).toBe(0);
      expect(result.max % 10).toBe(0);
    });

    it("should ensure all data points are within the axis range", () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 200, weight: 14.1 },
        { date: new Date(), calories: 250, weight: 14.9 },
      ];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeLessThanOrEqual(14.1);
      expect(result.max).toBeGreaterThanOrEqual(14.9);
    });

    it("should handle single weight value", () => {
      const data: ChartDataPoint[] = [{ date: new Date(), calories: 200, weight: 15.0 }];

      const result = TrendAnalyzer.calculateWeightAxisConfig(data);

      expect(result.min).toBeLessThan(15.0);
      expect(result.max).toBeGreaterThan(15.0);
      expect(result.tickInterval).toBe(0.5); // Under 25lbs
    });
  });

  describe("Unit Conversion Support", () => {
    describe("prepareWeightData with unit conversion", () => {
      it("should convert weight data to user preferred unit", () => {
        const today = DateTime.now().startOf("day").toISO() || "";
        const profile = createMockProfile("kg");

        const weights = [
          createMockWeightEntry(today, 150, "lbs"), // 150 lbs = ~68.04 kg
        ];

        const result = TrendAnalyzer.prepareWeightData(weights, profile, 7);

        expect(result).toHaveLength(1);
        expect(result[0].weight).toBeCloseTo(68.04, 1); // Converted to kg
      });

      it("should handle legacy weight entries without unit field", () => {
        const today = DateTime.now().startOf("day").toISO() || "";
        const profile = createMockProfile("kg");

        const weights = [
          createMockWeightEntry(today, 150), // No unit, should default to lbs
        ];

        const result = TrendAnalyzer.prepareWeightData(weights, profile, 7);

        expect(result).toHaveLength(1);
        expect(result[0].weight).toBeCloseTo(68.04, 1); // Converted from lbs to kg
      });

      it("should not convert when stored unit matches display unit", () => {
        const today = DateTime.now().startOf("day").toISO() || "";
        const profile = createMockProfile("lbs");

        const weights = [createMockWeightEntry(today, 150, "lbs")];

        const result = TrendAnalyzer.prepareWeightData(weights, profile, 7);

        expect(result).toHaveLength(1);
        expect(result[0].weight).toBe(150); // No conversion needed
      });

      it("should use default unit when no profile provided", () => {
        const today = DateTime.now().startOf("day").toISO() || "";

        const weights = [
          createMockWeightEntry(today, 68, "kg"), // 68 kg = ~149.91 lbs
        ];

        const result = TrendAnalyzer.prepareWeightData(weights, undefined, 7);

        expect(result).toHaveLength(1);
        expect(result[0].weight).toBeCloseTo(149.91, 1); // Converted to default lbs
      });
    });

    describe("getWeightAxisLabel", () => {
      it("should return label with user preferred unit", () => {
        const profile = createMockProfile("kg");
        const label = TrendAnalyzer.getWeightAxisLabel(profile);
        expect(label).toBe("Weight (kg)");
      });

      it("should return default label when no profile provided", () => {
        const label = TrendAnalyzer.getWeightAxisLabel(undefined);
        expect(label).toBe("Weight (lbs)");
      });
    });

    describe("formatWeightTooltip", () => {
      it("should format weight with user preferred unit", () => {
        const profile = createMockProfile("kg");
        const formatted = TrendAnalyzer.formatWeightTooltip(68.5, profile);
        expect(formatted).toBe("68.5kg");
      });

      it("should format weight with default unit when no profile provided", () => {
        const formatted = TrendAnalyzer.formatWeightTooltip(150.5, undefined);
        expect(formatted).toBe("150.5lbs");
      });
    });

    describe("getWeightDisplayUnit", () => {
      it("should return user preferred unit", () => {
        const profile = createMockProfile("kg");
        const unit = TrendAnalyzer.getWeightDisplayUnit(profile);
        expect(unit).toBe("kg");
      });

      it("should return default unit when no profile provided", () => {
        const unit = TrendAnalyzer.getWeightDisplayUnit(undefined);
        expect(unit).toBe("lbs");
      });
    });
  });
});
