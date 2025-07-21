import { type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { MealEntry, WeightEntry } from "../schema";

/**
 * Data point interface for chart data
 */
export interface ChartDataPoint {
  date: Date; // Keep as Date for chart compatibility
  calories?: number;
  weight?: number;
}

/**
 * Utility class for trend analysis and chart data preparation
 */
export class TrendAnalyzer {
  /**
   * Calculate LOWESS (Locally Weighted Scatterplot Smoothing) trend line
   * @param data - Array of numeric values
   * @param bandwidth - Smoothing bandwidth (0-1, default 0.3)
   * @returns Array of smoothed values
   */
  static calculateLOWESSTrend(data: number[], bandwidth: number = 0.3): number[] {
    if (data.length < 3) {
      return [...data]; // Return original data if too few points
    }

    const n = data.length;
    const smoothed: number[] = new Array(n);
    const h = Math.max(1, Math.floor(bandwidth * n)); // Window size

    for (let i = 0; i < n; i++) {
      // Determine the range of points to consider
      const start = Math.max(0, i - h);
      const end = Math.min(n - 1, i + h);

      let weightedSum = 0;
      let totalWeight = 0;

      // Calculate weighted average using tricube weight function
      for (let j = start; j <= end; j++) {
        const distance = Math.abs(i - j) / h;
        const weight = distance <= 1 ? Math.pow(1 - Math.pow(distance, 3), 3) : 0;

        weightedSum += data[j] * weight;
        totalWeight += weight;
      }

      smoothed[i] = totalWeight > 0 ? weightedSum / totalWeight : data[i];
    }

    return smoothed;
  }

  /**
   * Prepare daily calorie data for chart visualization
   * @param meals - Array of meal entries
   * @param days - Number of days to include (default 30)
   * @returns Array of chart data points with date and calories
   */
  static prepareDailyCalorieData(
    meals: Loaded<typeof MealEntry>[] | undefined,
    days: number = 30
  ): ChartDataPoint[] {
    if (!meals || meals.length === 0) {
      return [];
    }

    // Calculate the date range using Luxon
    const endDate = DateTime.now().startOf('day');
    const startDate = endDate.minus({ days: days - 1 });

    // Group meals by date and calculate daily totals
    const dailyTotals = new Map<string, number>();

    meals.forEach(meal => {
      const mealDate = DateTime.fromISO(meal.timestamp);
      if (mealDate >= startDate && mealDate <= endDate) {
        const dateKey = mealDate.toISODate() || '';
        const currentTotal = dailyTotals.get(dateKey) || 0;
        dailyTotals.set(dateKey, currentTotal + meal.totalCalories);
      }
    });

    // Create data points for each day in the range
    const dataPoints: ChartDataPoint[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISODate() || '';
      const calories = dailyTotals.get(dateKey) || 0;

      dataPoints.push({
        date: currentDate.toJSDate(), // Convert to JS Date for chart compatibility
        calories,
      });

      currentDate = currentDate.plus({ days: 1 });
    }

    return dataPoints;
  }

  /**
   * Prepare weight data for chart visualization
   * @param weights - Array of weight entries
   * @param days - Number of days to include (default 30)
   * @returns Array of chart data points with date and weight
   */
  static prepareWeightData(
    weights: Loaded<typeof WeightEntry>[] | undefined,
    days: number = 30
  ): ChartDataPoint[] {
    if (!weights || weights.length === 0) {
      return [];
    }

    // Calculate the date range using Luxon
    const endDate = DateTime.now().startOf('day');
    const startDate = endDate.minus({ days: days - 1 });

    // Filter and sort weight entries within the date range
    const filteredWeights = weights
      .filter(weight => {
        const weightDate = DateTime.fromISO(weight.timestamp);
        return weightDate >= startDate && weightDate <= endDate;
      })
      .sort((a, b) => DateTime.fromISO(a.timestamp).toMillis() - DateTime.fromISO(b.timestamp).toMillis());

    // Convert to chart data points
    return filteredWeights.map(weight => ({
      date: DateTime.fromISO(weight.timestamp).toJSDate(), // Convert to JS Date for chart compatibility
      weight: weight.weightValue,
    }));
  }

  /**
   * Prepare combined calorie and weight data for dual-axis charts
   * @param meals - Array of meal entries
   * @param weights - Array of weight entries
   * @param days - Number of days to include (default 30)
   * @returns Array of chart data points with date, calories, and weight
   */
  static prepareCombinedData(
    meals: Loaded<typeof MealEntry>[] | undefined,
    weights: Loaded<typeof WeightEntry>[] | undefined,
    days: number = 30
  ): ChartDataPoint[] {
    const calorieData = this.prepareDailyCalorieData(meals, days);
    const weightData = this.prepareWeightData(weights, days);

    // Create a map of weight data by date for quick lookup
    const weightByDate = new Map<string, number>();
    weightData.forEach(point => {
      if (point.weight !== undefined) {
        weightByDate.set(this.formatDateKey(point.date), point.weight);
      }
    });

    // Combine the data
    return calorieData.map(point => ({
      date: point.date,
      calories: point.calories,
      weight: weightByDate.get(this.formatDateKey(point.date)),
    }));
  }

  /**
   * Calculate trend lines for chart data
   * @param data - Array of chart data points
   * @param bandwidth - LOWESS bandwidth (default 0.3)
   * @returns Object with calorie and weight trend arrays
   */
  static calculateTrendLines(
    data: ChartDataPoint[],
    bandwidth: number = 0.3
  ): { caloriesTrend: number[]; weightTrend: number[] } {
    // Extract calorie values (replace undefined with 0)
    const calorieValues = data.map(point => point.calories || 0);

    // Extract weight values, filtering out undefined values
    const weightValues: number[] = [];
    const weightIndices: number[] = [];

    data.forEach((point, index) => {
      if (point.weight !== undefined) {
        weightValues.push(point.weight);
        weightIndices.push(index);
      }
    });

    // Calculate trends
    const caloriesTrend = this.calculateLOWESSTrend(calorieValues, bandwidth);
    const rawWeightTrend = this.calculateLOWESSTrend(weightValues, bandwidth);

    // Map weight trend back to full data array
    const weightTrend: number[] = new Array(data.length);
    rawWeightTrend.forEach((value, index) => {
      if (index < weightIndices.length) {
        weightTrend[weightIndices[index]] = value;
      }
    });

    return { caloriesTrend, weightTrend };
  }

  /**
   * Get summary statistics for a dataset
   * @param data - Array of chart data points
   * @returns Object with summary statistics
   */
  static getSummaryStats(data: ChartDataPoint[]): {
    totalDays: number;
    avgCalories: number;
    maxCalories: number;
    minCalories: number;
    avgWeight?: number;
    weightChange?: number;
  } {
    if (data.length === 0) {
      return {
        totalDays: 0,
        avgCalories: 0,
        maxCalories: 0,
        minCalories: 0,
      };
    }

    const calorieValues = data.map(point => point.calories || 0);
    const weightValues = data.filter(point => point.weight !== undefined).map(point => point.weight!);

    const totalCalories = calorieValues.reduce((sum, cal) => sum + cal, 0);
    const avgCalories = totalCalories / calorieValues.length;
    const maxCalories = Math.max(...calorieValues);
    const minCalories = Math.min(...calorieValues);

    const result: any = {
      totalDays: data.length,
      avgCalories: Math.round(avgCalories),
      maxCalories,
      minCalories,
    };

    if (weightValues.length > 0) {
      const totalWeight = weightValues.reduce((sum, weight) => sum + weight, 0);
      result.avgWeight = Math.round((totalWeight / weightValues.length) * 10) / 10;

      if (weightValues.length > 1) {
        result.weightChange = Math.round((weightValues[weightValues.length - 1] - weightValues[0]) * 10) / 10;
      }
    }

    return result;
  }

  /**
   * Helper method to format date as a consistent key
   * @param date - Date to format
   * @returns Date string in YYYY-MM-DD format
   */
  private static formatDateKey(date: Date): string {
    return DateTime.fromJSDate(date).toISODate() || '';
  }

  /**
   * Helper method to get date range for analysis
   * @param days - Number of days
   * @returns Object with start and end dates as JS Dates for compatibility
   */
  static getDateRange(days: number): { startDate: Date; endDate: Date } {
    const endDate = DateTime.now().startOf('day');
    const startDate = endDate.minus({ days: days - 1 });

    return {
      startDate: startDate.toJSDate(),
      endDate: endDate.toJSDate()
    };
  }
}
