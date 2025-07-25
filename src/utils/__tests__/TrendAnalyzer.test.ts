import { describe, it, expect } from 'vitest';
import { TrendAnalyzer, type ChartDataPoint } from '../TrendAnalyzer';
import { type Loaded } from 'jazz-tools';
import { DateTime } from 'luxon';
import { MealEntry, WeightEntry } from '../../schema';

// Helper function to create mock meal entry
const createMockMealEntry = (
  timestamp: string,
  foodName: string,
  totalCalories: number
) => {
  return {
    timestamp,
    foodName,
    foodCategory: 'Test',
    caloriesPerGram: 1.0,
    weightInGrams: totalCalories,
    notes: '',
    totalCalories,
  } as Loaded<typeof MealEntry>;
};

// Helper function to create mock weight entry
const createMockWeightEntry = (
  timestamp: string,
  weightValue: number
) => {
  return {
    timestamp,
    weightValue,
    notes: '',
  } as Loaded<typeof WeightEntry>;
};

describe('TrendAnalyzer', () => {
  describe('calculateLOWESSTrend', () => {
    it('should return original data for arrays with less than 3 points', () => {
      expect(TrendAnalyzer.calculateLOWESSTrend([])).toEqual([]);
      expect(TrendAnalyzer.calculateLOWESSTrend([1])).toEqual([1]);
      expect(TrendAnalyzer.calculateLOWESSTrend([1, 2])).toEqual([1, 2]);
    });

    it('should smooth data for arrays with 3 or more points', () => {
      const data = [1, 5, 2, 8, 3, 7, 4];
      const smoothed = TrendAnalyzer.calculateLOWESSTrend(data);

      expect(smoothed).toHaveLength(data.length);
      expect(smoothed).not.toEqual(data); // Should be different from original

      // Smoothed values should be less extreme
      expect(Math.max(...smoothed)).toBeLessThanOrEqual(Math.max(...data));
      expect(Math.min(...smoothed)).toBeGreaterThanOrEqual(Math.min(...data));
    });

    it('should handle different bandwidth values', () => {
      const data = [1, 10, 2, 9, 3, 8, 4];

      const smoothed1 = TrendAnalyzer.calculateLOWESSTrend(data, 0.1);
      const smoothed2 = TrendAnalyzer.calculateLOWESSTrend(data, 0.5);

      expect(smoothed1).toHaveLength(data.length);
      expect(smoothed2).toHaveLength(data.length);
      expect(smoothed1).not.toEqual(smoothed2);
    });

    it('should handle constant data', () => {
      const data = [5, 5, 5, 5, 5];
      const smoothed = TrendAnalyzer.calculateLOWESSTrend(data);

      expect(smoothed).toEqual([5, 5, 5, 5, 5]);
    });
  });

  describe('prepareDailyCalorieData', () => {
    it('should return empty array for undefined or empty meals', () => {
      expect(TrendAnalyzer.prepareDailyCalorieData(undefined)).toEqual([]);
      expect(TrendAnalyzer.prepareDailyCalorieData([])).toEqual([]);
    });

    it('should prepare daily calorie data for the specified number of days', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const yesterday = DateTime.now().startOf('day').minus({ days: 1 }).toISO() || '';

      const meals = [
        createMockMealEntry(today, 'Breakfast', 300),
        createMockMealEntry(today, 'Lunch', 500),
        createMockMealEntry(yesterday, 'Dinner', 600),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 7);

      expect(result).toHaveLength(7);
      expect(result.every(point => point.date instanceof Date)).toBe(true);
      expect(result.every(point => typeof point.calories === 'number')).toBe(true);

      // Today should have 800 calories (300 + 500)
      const todayData = result.find(point =>
        DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(today).toISODate()
      );
      expect(todayData?.calories).toBe(800);

      // Yesterday should have 600 calories
      const yesterdayData = result.find(point =>
        DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(yesterday).toISODate()
      );
      expect(yesterdayData?.calories).toBe(600);
    });

    it('should include days with zero calories', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const meals = [
        createMockMealEntry(today, 'Breakfast', 300),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 3);

      expect(result).toHaveLength(3);

      // Should have one day with 300 calories and two days with 0 calories
      const totalCalories = result.reduce((sum, point) => sum + point.calories!, 0);
      expect(totalCalories).toBe(300);

      const zeroDays = result.filter(point => point.calories === 0);
      expect(zeroDays).toHaveLength(2);
    });

    it('should filter out meals outside the date range', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const oldDate = DateTime.now().startOf('day').minus({ days: 10 }).toISO() || '';

      const meals = [
        createMockMealEntry(today, 'Today', 300),
        createMockMealEntry(oldDate, 'Old', 500),
      ];

      const result = TrendAnalyzer.prepareDailyCalorieData(meals, 3);

      // Should only include today's meal
      const totalCalories = result.reduce((sum, point) => sum + point.calories!, 0);
      expect(totalCalories).toBe(300);
    });
  });

  describe('prepareWeightData', () => {
    it('should return empty array for undefined or empty weights', () => {
      expect(TrendAnalyzer.prepareWeightData(undefined)).toEqual([]);
      expect(TrendAnalyzer.prepareWeightData([])).toEqual([]);
    });

    it('should prepare weight data within the specified date range', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const yesterday = DateTime.now().startOf('day').minus({ days: 1 }).toISO() || '';
      const oldDate = DateTime.now().startOf('day').minus({ days: 10 }).toISO() || '';

      const weights = [
        createMockWeightEntry(today, 70.5),
        createMockWeightEntry(yesterday, 70.2),
        createMockWeightEntry(oldDate, 69.8), // Should be filtered out
      ];

      const result = TrendAnalyzer.prepareWeightData(weights, 7);

      expect(result).toHaveLength(2); // Only today and yesterday
      expect(result.every(point => point.date instanceof Date)).toBe(true);
      expect(result.every(point => typeof point.weight === 'number')).toBe(true);

      // Should be sorted by date
      expect(result[0].date.getTime()).toBeLessThanOrEqual(result[1].date.getTime());
    });

    it('should sort weight entries by date', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const yesterday = DateTime.now().startOf('day').minus({ days: 1 }).toISO() || '';

      // Add in reverse chronological order
      const weights = [
        createMockWeightEntry(today, 70.5),
        createMockWeightEntry(yesterday, 70.2),
      ];

      const result = TrendAnalyzer.prepareWeightData(weights, 7);

      expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
      expect(result[0].weight).toBe(70.2);
      expect(result[1].weight).toBe(70.5);
    });
  });

  describe('prepareCombinedData', () => {
    it('should combine calorie and weight data', () => {
      const today = DateTime.now().startOf('day').toISO() || '';
      const yesterday = DateTime.now().startOf('day').minus({ days: 1 }).toISO() || '';

      const meals = [
        createMockMealEntry(today, 'Breakfast', 300),
        createMockMealEntry(yesterday, 'Dinner', 600),
      ];

      const weights = [
        createMockWeightEntry(today, 70.5),
      ];

      const result = TrendAnalyzer.prepareCombinedData(meals, weights, 3);

      expect(result).toHaveLength(3);

      // Today should have both calories and weight
      const todayData = result.find(point =>
        DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(today).toISODate()
      );
      expect(todayData?.calories).toBe(300);
      expect(todayData?.weight).toBe(70.5);

      // Yesterday should have calories but no weight
      const yesterdayData = result.find(point =>
        DateTime.fromJSDate(point.date).toISODate() === DateTime.fromISO(yesterday).toISODate()
      );
      expect(yesterdayData?.calories).toBe(600);
      expect(yesterdayData?.weight).toBeUndefined();
    });

    it('should handle empty data arrays', () => {
      const result = TrendAnalyzer.prepareCombinedData([], [], 7);
      expect(result).toEqual([]);
    });
  });

  describe('calculateTrendLines', () => {
    it('should calculate trend lines for chart data', () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000, weight: 70.0 },
        { date: new Date(), calories: 2200, weight: 70.2 },
        { date: new Date(), calories: 1800, weight: 70.1 },
        { date: new Date(), calories: 2100, weight: 69.9 },
        { date: new Date(), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);
      expect(result.caloriesTrend.every(val => typeof val === 'number')).toBe(true);
      expect(result.weightTrend.every(val => typeof val === 'number')).toBe(true);
    });

    it('should handle data with missing weight values', () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000, weight: 70.0 },
        { date: new Date(), calories: 2200 }, // No weight
        { date: new Date(), calories: 1800, weight: 70.1 },
        { date: new Date(), calories: 2100 }, // No weight
        { date: new Date(), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);

      // With sufficient weight data (3+ points), missing values should be interpolated
      expect(result.weightTrend[0]).toBeDefined(); // Has weight data
      expect(result.weightTrend[1]).toBeDefined(); // Should be interpolated
      expect(result.weightTrend[2]).toBeDefined(); // Has weight data
      expect(result.weightTrend[3]).toBeDefined(); // Should be interpolated
      expect(result.weightTrend[4]).toBeDefined(); // Has weight data
    });

    it('should handle sparse weight data with temporal smoothing', () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000, weight: 70.0 },
        { date: new Date(), calories: 2200 }, // No weight
        { date: new Date(), calories: 1800 }, // No weight
        { date: new Date(), calories: 2100 }, // No weight
        { date: new Date(), calories: 1900, weight: 70.3 },
      ];

      const result = TrendAnalyzer.calculateTrendLines(data);

      expect(result.caloriesTrend).toHaveLength(5);
      expect(result.weightTrend).toHaveLength(5);

      // With temporal smoothing, values should be interpolated based on exponential kernel
      expect(result.weightTrend[0]).toBeDefined(); // Has weight data
      expect(result.weightTrend[1]).toBeDefined(); // Should be smoothed
      expect(result.weightTrend[2]).toBeDefined(); // Should be smoothed
      expect(result.weightTrend[3]).toBeDefined(); // Should be smoothed
      expect(result.weightTrend[4]).toBeDefined(); // Has weight data
    });

    it('should handle empty data', () => {
      const result = TrendAnalyzer.calculateTrendLines([]);

      expect(result.caloriesTrend).toEqual([]);
      expect(result.weightTrend).toEqual([]);
    });
  });

  describe('getSummaryStats', () => {
    it('should calculate summary statistics', () => {
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

    it('should handle data without weight values', () => {
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

    it('should handle empty data', () => {
      const result = TrendAnalyzer.getSummaryStats([]);

      expect(result.totalDays).toBe(0);
      expect(result.avgCalories).toBe(0);
      expect(result.maxCalories).toBe(0);
      expect(result.minCalories).toBe(0);
      expect(result.avgWeight).toBeUndefined();
      expect(result.weightChange).toBeUndefined();
    });

    it('should handle single weight entry', () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 2000, weight: 70.0 },
      ];

      const result = TrendAnalyzer.getSummaryStats(data);

      expect(result.avgWeight).toBe(70.0);
      expect(result.weightChange).toBeUndefined(); // Need at least 2 points for change
    });
  });

  describe('getDateRange', () => {
    it('should return correct date range', () => {
      const { startDate, endDate } = TrendAnalyzer.getDateRange(7);

      expect(startDate instanceof Date).toBe(true);
      expect(endDate instanceof Date).toBe(true);
      expect(startDate.getTime()).toBeLessThan(endDate.getTime());

      // Should be approximately 6 days difference (7 days inclusive)
      const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(6);
    });

    it('should handle single day range', () => {
      const { startDate, endDate } = TrendAnalyzer.getDateRange(1);

      // Start and end should be the same day
      expect(DateTime.fromJSDate(startDate).toISODate()).toBe(DateTime.fromJSDate(endDate).toISODate());
    });
  });

  describe('calculateCalorieAxisConfig', () => {
    it('should return default config for empty data', () => {
      const result = TrendAnalyzer.calculateCalorieAxisConfig([]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(500);
      expect(result.tickInterval).toBe(50);
    });

    it('should calculate config with 50-unit ticks when max < 500', () => {
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

    it('should calculate config with 100-unit ticks when max >= 500', () => {
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

    it('should handle edge case where max is exactly a multiple of 100', () => {
      const data: ChartDataPoint[] = [
        { date: new Date(), calories: 300 },
        { date: new Date(), calories: 500 },
      ];

      const result = TrendAnalyzer.calculateCalorieAxisConfig(data);

      expect(result.min).toBe(0);
      expect(result.max).toBe(500);
      expect(result.tickInterval).toBe(100); // 500 >= 500, so use 100-unit ticks
    });

    it('should handle zero calories', () => {
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
});
