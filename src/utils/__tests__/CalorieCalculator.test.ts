import { describe, it, expect } from 'vitest';
import { CalorieCalculator } from '../CalorieCalculator';
import { type Loaded } from 'jazz-tools';
import { MealEntry, type MealWeightUnit } from '../../schema';
import { DateTime } from 'luxon';

// Mock meal entry data for testing
const createMockMealEntry = (
  timestamp: string,
  foodName: string,
  foodCategory: string,
  caloriesPerGram: number,
  weightInGrams: number,
  totalCalories: number,
  displayUnit?: MealWeightUnit
) => ({
  timestamp,
  foodName,
  foodCategory,
  caloriesPerGram,
  weightInGrams,
  notes: '',
  totalCalories,
  displayUnit,
} as Loaded<typeof MealEntry>);

describe('CalorieCalculator', () => {
  describe('calculateMealCalories', () => {
    it('should calculate calories correctly for valid inputs', () => {
      expect(CalorieCalculator.calculateMealCalories(100, 2.5)).toBe(250);
      expect(CalorieCalculator.calculateMealCalories(50, 1.2)).toBe(60);
      expect(CalorieCalculator.calculateMealCalories(0, 2.5)).toBe(0);
      expect(CalorieCalculator.calculateMealCalories(100, 0)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(CalorieCalculator.calculateMealCalories(33.33, 1.234)).toBe(41.13);
      expect(CalorieCalculator.calculateMealCalories(100, 2.555)).toBe(255.5);
    });

    it('should throw error for negative inputs', () => {
      expect(() => CalorieCalculator.calculateMealCalories(-100, 2.5))
        .toThrow('Weight and calories per gram must be non-negative');
      expect(() => CalorieCalculator.calculateMealCalories(100, -2.5))
        .toThrow('Weight and calories per gram must be non-negative');
      expect(() => CalorieCalculator.calculateMealCalories(-100, -2.5))
        .toThrow('Weight and calories per gram must be non-negative');
    });
  });

  describe('calculateDailyTotal', () => {
    const today = '2024-01-15T10:00:00.000Z';
    const yesterday = '2024-01-14T15:00:00.000Z';
    const tomorrow = '2024-01-16T08:00:00.000Z';

    const mockMeals = [
      createMockMealEntry(today, 'Apple', 'Fruit', 0.52, 150, 78),
      createMockMealEntry(today, 'Chicken', 'Protein', 2.39, 200, 478),
      createMockMealEntry(yesterday, 'Banana', 'Fruit', 0.89, 120, 107),
      createMockMealEntry(tomorrow, 'Rice', 'Grain', 1.30, 100, 130),
    ];

    it('should calculate total calories for a specific date', () => {
      const todayTotal = CalorieCalculator.calculateDailyTotal(mockMeals, today);
      expect(todayTotal).toBe(556); // 78 + 478

      const yesterdayTotal = CalorieCalculator.calculateDailyTotal(mockMeals, yesterday);
      expect(yesterdayTotal).toBe(107);

      const tomorrowTotal = CalorieCalculator.calculateDailyTotal(mockMeals, tomorrow);
      expect(tomorrowTotal).toBe(130);
    });

    it('should return 0 for dates with no meals', () => {
      const emptyDate = '2024-01-10T12:00:00.000Z';
      const total = CalorieCalculator.calculateDailyTotal(mockMeals, emptyDate);
      expect(total).toBe(0);
    });

    it('should return 0 for empty meal array', () => {
      const total = CalorieCalculator.calculateDailyTotal([], today);
      expect(total).toBe(0);
    });

    it('should return 0 for undefined meal array', () => {
      const total = CalorieCalculator.calculateDailyTotal(undefined, today);
      expect(total).toBe(0);
    });

    it('should handle meals at different times on the same date', () => {
      const sameDay = [
        createMockMealEntry('2024-01-15T06:00:00.000Z', 'Breakfast', 'Meal', 1.0, 100, 100),
        createMockMealEntry('2024-01-15T12:00:00.000Z', 'Lunch', 'Meal', 1.0, 200, 200),
        createMockMealEntry('2024-01-15T18:00:00.000Z', 'Dinner', 'Meal', 1.0, 300, 300),
      ];

      const total = CalorieCalculator.calculateDailyTotal(sameDay, '2024-01-15T00:00:00.000Z');
      expect(total).toBe(600);
    });

    it('should handle meals with timezone offsets correctly', () => {
      const mealsWithTimezone = [
        createMockMealEntry('2025-07-27T19:36:00.000-07:00', 'Dinner', 'Meal', 1.0, 100, 100),
        createMockMealEntry('2025-07-27T08:30:00.000-07:00', 'Breakfast', 'Meal', 1.0, 200, 200),
        createMockMealEntry('2025-07-28T01:00:00.000-07:00', 'Late Snack', 'Meal', 1.0, 50, 50), // Next day
      ];

      // Should only include meals from July 27th local time
      const total = CalorieCalculator.calculateDailyTotal(mealsWithTimezone, '2025-07-27T00:00:00.000-07:00');
      expect(total).toBe(300); // 100 + 200 (excluding the July 28th meal)
    });
  });

  describe('calculateCategoryBreakdown', () => {
    const targetDate = '2024-01-15T10:00:00.000Z';
    const otherDate = '2024-01-14T10:00:00.000Z';

    const mockMeals = [
      createMockMealEntry(targetDate, 'Apple', 'Fruit', 0.52, 150, 78),
      createMockMealEntry(targetDate, 'Banana', 'Fruit', 0.89, 120, 107),
      createMockMealEntry(targetDate, 'Chicken', 'Protein', 2.39, 200, 478),
      createMockMealEntry(targetDate, 'Beef', 'Protein', 2.50, 100, 250),
      createMockMealEntry(targetDate, 'Rice', 'Grain', 1.30, 150, 195),
      createMockMealEntry(otherDate, 'Pasta', 'Grain', 1.31, 200, 262), // Different date
    ];

    it('should calculate category breakdown for a specific date', () => {
      const breakdown = CalorieCalculator.calculateCategoryBreakdown(mockMeals, targetDate);

      expect(breakdown).toEqual({
        'Fruit': 185,    // 78 + 107
        'Protein': 728,  // 478 + 250
        'Grain': 195,    // 195 (pasta is on different date)
      });
    });

    it('should return empty object for dates with no meals', () => {
      const emptyDate = '2024-01-10T12:00:00.000Z';
      const breakdown = CalorieCalculator.calculateCategoryBreakdown(mockMeals, emptyDate);
      expect(breakdown).toEqual({});
    });

    it('should return empty object for empty meal array', () => {
      const breakdown = CalorieCalculator.calculateCategoryBreakdown([], targetDate);
      expect(breakdown).toEqual({});
    });

    it('should return empty object for undefined meal array', () => {
      const breakdown = CalorieCalculator.calculateCategoryBreakdown(undefined, targetDate);
      expect(breakdown).toEqual({});
    });

    it('should handle single category', () => {
      const singleCategoryMeals = [
        createMockMealEntry(targetDate, 'Apple', 'Fruit', 0.52, 150, 78),
        createMockMealEntry(targetDate, 'Banana', 'Fruit', 0.89, 120, 107),
      ];

      const breakdown = CalorieCalculator.calculateCategoryBreakdown(singleCategoryMeals, targetDate);
      expect(breakdown).toEqual({
        'Fruit': 185,
      });
    });
  });

  describe('getTodayAtMidnight', () => {
    it('should return today\'s date at midnight as ISO string', () => {
      const today = CalorieCalculator.getTodayAtMidnight();
      expect(typeof today).toBe('string');

      // Parse the ISO string and check it's at midnight
      const todayDateTime = DateTime.fromISO(today);
      expect(todayDateTime.hour).toBe(0);
      expect(todayDateTime.minute).toBe(0);
      expect(todayDateTime.second).toBe(0);
      expect(todayDateTime.millisecond).toBe(0);

      // Should be today's date
      const now = DateTime.now();
      expect(todayDateTime.day).toBe(now.day);
      expect(todayDateTime.month).toBe(now.month);
      expect(todayDateTime.year).toBe(now.year);
    });
  });

  describe('isSameDay', () => {
    it('should return true for ISO strings on the same day', () => {
      const date1 = '2024-01-15T06:00:00.000Z';
      const date2 = '2024-01-15T18:00:00.000Z';
      expect(CalorieCalculator.isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for ISO strings on different days', () => {
      const date1 = '2024-01-15T23:59:59.000Z';
      const date2 = '2024-01-16T00:00:01.000Z';
      expect(CalorieCalculator.isSameDay(date1, date2)).toBe(false);
    });

    it('should handle same ISO strings', () => {
      const date = '2024-01-15T12:00:00.000Z';
      expect(CalorieCalculator.isSameDay(date, date)).toBe(true);
    });

    it('should return false for null or undefined values', () => {
      expect(CalorieCalculator.isSameDay(null, '2024-01-15T12:00:00.000Z')).toBe(false);
      expect(CalorieCalculator.isSameDay('2024-01-15T12:00:00.000Z', undefined)).toBe(false);
      expect(CalorieCalculator.isSameDay(null, undefined)).toBe(false);
    });

    it('should handle timezone offsets correctly', () => {
      // A meal entry with Pacific timezone should match a date picker selection for the same local date
      const mealWithTimezone = '2025-07-27T19:36:00.000-07:00'; // July 27, 7:36 PM Pacific
      const selectedDate = '2025-07-27T00:00:00.000-07:00'; // July 27 at midnight Pacific
      
      expect(CalorieCalculator.isSameDay(mealWithTimezone, selectedDate)).toBe(true);
    });

    it('should preserve local date across different timezones', () => {
      // Same local date but different timezones should match
      const pacificTime = '2025-07-27T19:36:00.000-07:00'; // July 27, 7:36 PM Pacific
      const easternTime = '2025-07-27T10:36:00.000-04:00'; // July 27, 10:36 AM Eastern
      
      expect(CalorieCalculator.isSameDay(pacificTime, easternTime)).toBe(true);
    });
  });

  describe('formatMealDisplay', () => {
    it('should format meal display with default grams unit for legacy entries', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Chicken Breast',
        'Protein',
        1.65,
        150,
        247.5
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal);
      expect(formatted).toBe('Chicken Breast (150g * 1.65 cal/g) Protein 247.5 cal');
    });

    it('should format meal display with stored displayUnit', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Chicken Breast',
        'Protein',
        1.65,
        150,
        247.5,
        'oz'
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal);
      expect(formatted).toBe('Chicken Breast (5.3oz * 1.65 cal/g) Protein 247.5 cal');
    });

    it('should format meal display with override displayUnit', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Chicken Breast',
        'Protein',
        1.65,
        150,
        247.5,
        'g'
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal, 'lb');
      expect(formatted).toBe('Chicken Breast (0.33lb * 1.65 cal/g) Protein 247.5 cal');
    });

    it('should handle different weight units correctly', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Apple',
        'Fruit',
        0.52,
        200,
        104
      );

      // Test with kilograms
      const kgFormatted = CalorieCalculator.formatMealDisplay(meal, 'kg');
      expect(kgFormatted).toBe('Apple (0.20kg * 0.52 cal/g) Fruit 104.0 cal');

      // Test with ounces
      const ozFormatted = CalorieCalculator.formatMealDisplay(meal, 'oz');
      expect(ozFormatted).toBe('Apple (7.1oz * 0.52 cal/g) Fruit 104.0 cal');

      // Test with pounds
      const lbFormatted = CalorieCalculator.formatMealDisplay(meal, 'lb');
      expect(lbFormatted).toBe('Apple (0.44lb * 0.52 cal/g) Fruit 104.0 cal');
    });

    it('should format calories per gram with 2 decimal places', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.234567,
        100,
        123.46
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal);
      expect(formatted).toBe('Test Food (100g * 1.23 cal/g) Test 123.5 cal');
    });

    it('should format total calories with 1 decimal place', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.5,
        100,
        150.123456
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal);
      expect(formatted).toBe('Test Food (100g * 1.50 cal/g) Test 150.1 cal');
    });

    it('should handle zero weight correctly', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.5,
        0,
        0
      );

      const formatted = CalorieCalculator.formatMealDisplay(meal);
      expect(formatted).toBe('Test Food (0g * 1.50 cal/g) Test 0.0 cal');
    });

    it('should handle mixed legacy and new data entries', () => {
      // Legacy entry without displayUnit
      const legacyMeal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Legacy Food',
        'Legacy',
        2.0,
        100,
        200
      );

      // New entry with displayUnit
      const newMeal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'New Food',
        'New',
        2.0,
        100,
        200,
        'oz'
      );

      const legacyFormatted = CalorieCalculator.formatMealDisplay(legacyMeal, 'oz');
      const newFormatted = CalorieCalculator.formatMealDisplay(newMeal, 'oz');

      // Both should display in ounces when requested
      expect(legacyFormatted).toBe('Legacy Food (3.5oz * 2.00 cal/g) Legacy 200.0 cal');
      expect(newFormatted).toBe('New Food (3.5oz * 2.00 cal/g) New 200.0 cal');
    });
  });

  describe('getDisplayWeight', () => {
    it('should return weight in specified unit', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.0,
        1000, // 1000 grams
        1000
      );

      expect(CalorieCalculator.getDisplayWeight(meal, 'g')).toBe(1000);
      expect(CalorieCalculator.getDisplayWeight(meal, 'kg')).toBe(1);
      expect(CalorieCalculator.getDisplayWeight(meal, 'lb')).toBeCloseTo(2.205, 3);
      expect(CalorieCalculator.getDisplayWeight(meal, 'oz')).toBeCloseTo(35.274, 3);
    });

    it('should handle zero weight', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.0,
        0,
        0
      );

      expect(CalorieCalculator.getDisplayWeight(meal, 'g')).toBe(0);
      expect(CalorieCalculator.getDisplayWeight(meal, 'kg')).toBe(0);
      expect(CalorieCalculator.getDisplayWeight(meal, 'lb')).toBe(0);
      expect(CalorieCalculator.getDisplayWeight(meal, 'oz')).toBe(0);
    });
  });

  describe('getFormattedWeight', () => {
    it('should use meal displayUnit when available', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.0,
        150, // 150 grams
        150,
        'oz' // Stored as ounces
      );

      // Should use the meal's stored displayUnit (oz) regardless of preferred unit
      const formatted = CalorieCalculator.getFormattedWeight(meal, 'g');
      expect(formatted).toBe('5.3oz');
    });

    it('should use preferred unit when meal has no displayUnit', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Legacy Food',
        'Test',
        1.0,
        150, // 150 grams
        150
        // No displayUnit (legacy entry)
      );

      // Should use the preferred unit for legacy entries
      const formattedOz = CalorieCalculator.getFormattedWeight(meal, 'oz');
      expect(formattedOz).toBe('5.3oz');

      const formattedG = CalorieCalculator.getFormattedWeight(meal, 'g');
      expect(formattedG).toBe('150g');
    });

    it('should handle different weight units correctly', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.0,
        1000, // 1000 grams
        1000
      );

      expect(CalorieCalculator.getFormattedWeight(meal, 'g')).toBe('1000g');
      expect(CalorieCalculator.getFormattedWeight(meal, 'kg')).toBe('1kg');
      expect(CalorieCalculator.getFormattedWeight(meal, 'lb')).toBe('2.2lb');
      expect(CalorieCalculator.getFormattedWeight(meal, 'oz')).toBe('35.3oz');
    });

    it('should handle zero weight', () => {
      const meal = createMockMealEntry(
        '2024-01-15T12:00:00.000Z',
        'Test Food',
        'Test',
        1.0,
        0,
        0
      );

      expect(CalorieCalculator.getFormattedWeight(meal, 'g')).toBe('0g');
      expect(CalorieCalculator.getFormattedWeight(meal, 'oz')).toBe('0oz');
    });
  });
});
