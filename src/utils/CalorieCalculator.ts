import { co } from "jazz-tools";
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
   * @param date - Target date for calculation
   * @returns Total calories for the specified date
   */
  static calculateDailyTotal(
    meals: co.loaded<typeof MealEntry>[] | undefined,
    date: Date
  ): number {
    if (!meals || meals.length === 0) {
      return 0;
    }

    const targetDateStr = this.formatDateForComparison(date);
    
    return meals
      .filter(meal => {
        const mealDateStr = this.formatDateForComparison(meal.timestamp);
        return mealDateStr === targetDateStr;
      })
      .reduce((total, meal) => total + meal.totalCalories, 0);
  }

  /**
   * Calculate calorie breakdown by food category for a specific date
   * @param meals - Array of meal entries
   * @param date - Target date for calculation
   * @returns Object mapping category names to total calories
   */
  static calculateCategoryBreakdown(
    meals: co.loaded<typeof MealEntry>[] | undefined,
    date: Date
  ): Record<string, number> {
    if (!meals || meals.length === 0) {
      return {};
    }

    const targetDateStr = this.formatDateForComparison(date);
    const breakdown: Record<string, number> = {};
    
    meals
      .filter(meal => {
        const mealDateStr = this.formatDateForComparison(meal.timestamp);
        return mealDateStr === targetDateStr;
      })
      .forEach(meal => {
        const category = meal.foodCategory;
        breakdown[category] = (breakdown[category] || 0) + meal.totalCalories;
      });

    return breakdown;
  }

  /**
   * Helper function to format date for consistent comparison
   * @param date - Date to format
   * @returns Date string in YYYY-MM-DD format
   */
  private static formatDateForComparison(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get today's date at midnight for consistent date comparisons
   * @returns Date object set to today at 00:00:00
   */
  static getTodayAtMidnight(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Check if two dates are on the same day
   * @param date1 - First date
   * @param date2 - Second date
   * @returns True if dates are on the same day
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return this.formatDateForComparison(date1) === this.formatDateForComparison(date2);
  }
}