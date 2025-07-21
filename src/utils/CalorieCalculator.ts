import { type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { MealEntry } from "../schema";

/**
 * Utility class for calorie-related calculations
 */
export class CalorieCalculator {
  /**
   * Calculate total calories for a meal entry
   * @param weightInGrams - Weight of the food in grams
   * @param caloriesPerGram - Calories per gram of the food
   * @returns Total calories (weight * CPG)
   */
  static calculateMealCalories(weightInGrams: number, caloriesPerGram: number): number {
    if (weightInGrams < 0 || caloriesPerGram < 0) {
      throw new Error("Weight and calories per gram must be non-negative");
    }
    return Math.round((weightInGrams * caloriesPerGram) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate total calories consumed for a specific date
   * @param meals - Array of meal entries
   * @param dateIso - Target date as ISO string for calculation
   * @returns Total calories for the specified date
   */
  static calculateDailyTotal(
    meals: Loaded<typeof MealEntry>[] | undefined,
    dateIso: string
  ): number {
    if (!meals || meals.length === 0) {
      return 0;
    }

    const targetDateStr = this.getDateOnlyFromIso(dateIso);

    return meals
      .filter(meal => {
        const mealDateStr = this.getDateOnlyFromIso(meal.timestamp);
        return mealDateStr === targetDateStr;
      })
      .reduce((total, meal) => total + meal.totalCalories, 0);
  }

  /**
   * Calculate calorie breakdown by food category for a specific date
   * @param meals - Array of meal entries
   * @param dateIso - Target date as ISO string for calculation
   * @returns Object mapping category names to total calories
   */
  static calculateCategoryBreakdown(
    meals: Loaded<typeof MealEntry>[] | undefined,
    dateIso: string
  ): Record<string, number> {
    if (!meals || meals.length === 0) {
      return {};
    }

    const targetDateStr = this.getDateOnlyFromIso(dateIso);
    const breakdown: Record<string, number> = {};

    meals
      .filter(meal => {
        const mealDateStr = this.getDateOnlyFromIso(meal.timestamp);
        return mealDateStr === targetDateStr;
      })
      .forEach(meal => {
        const category = meal.foodCategory;
        breakdown[category] = (breakdown[category] || 0) + meal.totalCalories;
      });

    return breakdown;
  }

  /**
   * Helper function to extract date-only string from ISO timestamp for comparison
   * @param isoString - ISO date string
   * @returns Date string in YYYY-MM-DD format
   */
  private static getDateOnlyFromIso(isoString: string): string {
    return DateTime.fromISO(isoString, { zone: 'utc' }).toISODate() || '';
  }

  /**
   * Get today's date at midnight as ISO string for consistent date comparisons
   * @returns ISO string set to today at 00:00:00
   */
  static getTodayAtMidnight(): string {
    return DateTime.now().startOf('day').toISO() || '';
  }

  /**
   * Check if two ISO date strings are on the same day
   * @param date1 - First ISO date string
   * @param date2 - Second ISO date string
   * @returns True if dates are on the same day
   */
  static isSameDay(date1: string | undefined | null, date2: string | undefined | null): boolean {
    if (!date1 || !date2) return false;
    return this.getDateOnlyFromIso(date1) === this.getDateOnlyFromIso(date2);
  }

  /**
   * Add days to an ISO date string
   * @param isoString - ISO date string
   * @param days - Number of days to add (can be negative)
   * @returns New ISO string with days added
   */
  static addDays(isoString: string, days: number): string {
    return DateTime.fromISO(isoString).plus({ days }).toISO() || '';
  }

  /**
   * Format ISO date string for display
   * @param isoString - ISO date string
   * @returns Formatted date string
   */
  static formatDateForDisplay(isoString: string): string {
    return DateTime.fromISO(isoString).toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format ISO date string for HTML date input (YYYY-MM-DD)
   * @param isoString - ISO date string
   * @returns Date string in YYYY-MM-DD format
   */
  static formatDateForInput(isoString: string): string {
    return DateTime.fromISO(isoString).toISODate() || '';
  }

  /**
   * Format ISO date string for time display
   * @param isoString - ISO date string
   * @returns Formatted time string
   */
  static formatTimeForDisplay(isoString: string): string {
    return DateTime.fromISO(isoString).toLocaleString(DateTime.TIME_SIMPLE);
  }

  /**
   * Create ISO string from HTML date input value
   * @param dateInputValue - Date string from HTML input (YYYY-MM-DD)
   * @returns ISO string at start of day
   */
  static createIsoFromDateInput(dateInputValue: string): string {
    return DateTime.fromISO(dateInputValue).startOf('day').toISO() || '';
  }
}
