import { type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { MealEntry, type MealWeightUnit } from "../schema";
import { WeightConverter } from "./WeightConverter";

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
   *
   * Normal case:
   * - Timestamps with an explicit offset (e.g., 2025-07-27T19:36:00.000-07:00) are the standard format the app produces.
   *   We must preserve the embedded local timezone when computing the calendar day to ensure user-visible behavior is stable
   *   regardless of the host environment's system timezone (CI vs local). We do this by using { setZone: true }.
   *
   * Defensive cases (legacy/outliers):
   * - Z-terminated UTC timestamps (…Z) likely originate from older data or tests. Treat them deterministically as UTC.
   * - Naive timestamps (no Z and no explicit offset) are also considered legacy/input errors; we normalize them as UTC to avoid
   *   environment-dependent interpretation.
   *
   * @param isoString - ISO date string
   * @returns Date string in YYYY-MM-DD format
   */
  private static getDateOnlyFromIso(isoString: string): string {
    // Normal path: explicit offset; preserve its local zone for calendar-day calculations
    if (/[+-]\d{2}:\d{2}$/.test(isoString)) {
      return DateTime.fromISO(isoString, { setZone: true }).toISODate() || '';
    }

    // Defensive legacy path: explicit UTC (Z)
    if (isoString.endsWith('Z')) {
      return DateTime.fromISO(isoString, { zone: 'utc' }).toISODate() || '';
    }

    // Defensive legacy path: naive input => normalize as UTC
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
   *
   * Normal case:
   * - If the input includes an explicit offset, keep that zone while adding days so navigation is consistent
   *   with the user's local selection.
   *
   * Defensive cases (legacy/outliers):
   * - UTC (Z) and naive inputs are normalized to UTC to avoid environment-dependent shifts.
   *
   * @param isoString - ISO date string
   * @param days - Number of days to add (can be negative)
   * @returns New ISO string with days added
   */
  static addDays(isoString: string, days: number): string {
    const hasOffset = /[+-]\d{2}:\d{2}$/.test(isoString);
    const isUtc = isoString.endsWith('Z');
    const base = isUtc
      ? DateTime.fromISO(isoString, { zone: 'utc' })
      : hasOffset
        ? DateTime.fromISO(isoString, { setZone: true }) // normal case
        : DateTime.fromISO(isoString, { zone: 'utc' }); // defensive legacy normalization
    return base.plus({ days }).toISO() || '';
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
   *
   * Normal case:
   * - The date input (YYYY-MM-DD) reflects the user's local calendar selection. We construct a DateTime at local midnight
   *   by using { setZone: true }, preserving the user's intended local day.
   *
   * Defensive note:
   * - This function expects a naive YYYY-MM-DD value from a date input. If other formats are passed, they will be treated
   *   by Luxon with the system's local zone due to setZone: true, which is acceptable for UI-driven input but not
   *   intended for arbitrary ISO values (handled elsewhere).
   *
   * @param dateInputValue - Date string from HTML input (YYYY-MM-DD)
   * @returns ISO string at start of day
   */
  static createIsoFromDateInput(dateInputValue: string): string {
    return DateTime.fromISO(dateInputValue, { setZone: true }).startOf('day').toISO() || '';
  }



  /**
   * Get formatted weight for display in user's preferred unit
   * @param meal - The meal entry
   * @param preferredUnit - The user's preferred unit for display
   * @returns Formatted weight string with unit
   */
  static getFormattedWeight(meal: Loaded<typeof MealEntry>, preferredUnit: MealWeightUnit): string {
    // Use the meal's stored displayUnit if available, otherwise use the preferred unit
    const unitToUse = meal.displayUnit || preferredUnit;
    const displayWeight = WeightConverter.fromGrams(meal.weightInGrams, unitToUse);
    return WeightConverter.formatDisplay(displayWeight, unitToUse);
  }

  /**
   * Get display weight for a meal entry in the specified unit
   * @param meal - The meal entry
   * @param displayUnit - The unit to display the weight in
   * @returns Weight value in the specified unit
   */
  static getDisplayWeight(meal: Loaded<typeof MealEntry>, displayUnit: MealWeightUnit): number {
    return WeightConverter.fromGrams(meal.weightInGrams, displayUnit);
  }
}
