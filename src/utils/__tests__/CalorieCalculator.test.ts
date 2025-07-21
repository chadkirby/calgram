import { describe, it, expect } from 'vitest';
import { CalorieCalculator } from '../CalorieCalculator';
import { type Loaded } from 'jazz-tools';
import { MealEntry } from '../../schema';

// Mock meal entry data for testing
const createMockMealEntry = (
  timestamp: Date,
  foodName: string,
  foodCategory: string,
  caloriesPerGram: number,
  weightInGrams: number,
  totalCalories: number
) => ({
  timestamp: timestamp.toISOString(),
  foodName,
  foodCategory,
  caloriesPerGram,
  weightInGrams,
  notes: '',
  totalCalories,
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
    const today = new Date('2024-01-15T10:00:00Z');
    const yesterday = new Date('2024-01-14T15:00:00Z');
    const tomorrow = new Date('2024-01-16T08:00:00Z');

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
      const emptyDate = new Date('2024-01-10T12:00:00Z');
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
        createMockMealEntry(new Date('2024-01-15T06:00:00Z'), 'Breakfast', 'Meal', 1.0, 100, 100),
        createMockMealEntry(new Date('2024-01-15T12:00:00Z'), 'Lunch', 'Meal', 1.0, 200, 200),
        createMockMealEntry(new Date('2024-01-15T18:00:00Z'), 'Dinner', 'Meal', 1.0, 300, 300),
      ];

      const total = CalorieCalculator.calculateDailyTotal(sameDay, new Date('2024-01-15'));
      expect(total).toBe(600);
    });
  });

  describe('calculateCategoryBreakdown', () => {
    const targetDate = new Date('2024-01-15T10:00:00Z');
    const otherDate = new Date('2024-01-14T10:00:00Z');

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
      const emptyDate = new Date('2024-01-10T12:00:00Z');
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
    it('should return today\'s date at midnight', () => {
      const today = CalorieCalculator.getTodayAtMidnight();
      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
      expect(today.getMilliseconds()).toBe(0);

      // Should be today's date
      const now = new Date();
      expect(today.getDate()).toBe(now.getDate());
      expect(today.getMonth()).toBe(now.getMonth());
      expect(today.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('isSameDay', () => {
    it('should return true for dates on the same day', () => {
      const date1 = new Date('2024-01-15T06:00:00Z');
      const date2 = new Date('2024-01-15T18:00:00Z');
      expect(CalorieCalculator.isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for dates on different days', () => {
      const date1 = new Date('2024-01-15T23:59:59Z');
      const date2 = new Date('2024-01-16T00:00:01Z');
      expect(CalorieCalculator.isSameDay(date1, date2)).toBe(false);
    });

    it('should handle same date objects', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(CalorieCalculator.isSameDay(date, date)).toBe(true);
    });
  });
});
