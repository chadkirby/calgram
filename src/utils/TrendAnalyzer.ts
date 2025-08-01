import { type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { MealEntry, WeightEntry, CalorieTrackerProfile } from "../schema";
import { WeightConverter } from "./WeightConverter";
import { UnitPreferenceManager } from "./UnitPreferenceManager";
import type { BodyWeightUnit } from "../schema";

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

    // Use getDateRange for consistency
    const { startDate, endDate } = this.getDateRange(days);
    const startDateLuxon = DateTime.fromJSDate(startDate);
    const endDateLuxon = DateTime.fromJSDate(endDate);

    // Group meals by date and calculate daily totals
    const dailyTotals = new Map<string, number>();

    meals.forEach(meal => {
      const mealDate = DateTime.fromISO(meal.timestamp);
      if (mealDate >= startDateLuxon && mealDate <= endDateLuxon) {
        const dateKey = mealDate.toISODate() || '';
        const currentTotal = dailyTotals.get(dateKey) || 0;
        dailyTotals.set(dateKey, currentTotal + meal.totalCalories);
      }
    });

    // Create data points for each day in the range
    const dataPoints: ChartDataPoint[] = [...dailyTotals.entries()].map(([dateKey, calories]) => ({
      date: DateTime.fromISO(dateKey).toJSDate(), // Convert to JS Date
      calories,
    }));

    return dataPoints;
  }

  /**
   * Prepare weight data for chart visualization with unit conversion
   * @param weights - Array of weight entries
   * @param profile - User profile for unit preferences
   * @param days - Number of days to include (default 30)
   * @returns Array of chart data points with date and weight in display unit
   */
  static prepareWeightData(
    weights: Loaded<typeof WeightEntry>[] | undefined,
    profile?: Loaded<typeof CalorieTrackerProfile>,
    days: number = 30
  ): ChartDataPoint[] {
    if (!weights || weights.length === 0) {
      return [];
    }

    // Get user's preferred display unit
    const displayUnit = UnitPreferenceManager.getBodyWeightUnit(profile);

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

    // Convert to chart data points with unit conversion
    return filteredWeights.map(weight => {
      // Get the stored unit (default to 'lbs' for legacy entries)
      const storedUnit = weight.unit || 'lbs';
      
      // Convert to display unit if different
      const convertedWeight = storedUnit === displayUnit 
        ? weight.weightValue 
        : WeightConverter.convert(weight.weightValue, storedUnit, displayUnit);

      return {
        date: DateTime.fromISO(weight.timestamp).toJSDate(), // Convert to JS Date for chart compatibility
        weight: convertedWeight,
      };
    });
  }

  /**
   * Prepare combined calorie and weight data for dual-axis charts
   * @param meals - Array of meal entries
   * @param weights - Array of weight entries
   * @param profile - User profile for unit preferences
   * @param days - Number of days to include (default 30)
   * @returns Array of chart data points with date, calories, and weight
   */
  static prepareCombinedData(
    meals: Loaded<typeof MealEntry>[] | undefined,
    weights: Loaded<typeof WeightEntry>[] | undefined,
    profile?: Loaded<typeof CalorieTrackerProfile>,
    days: number = 30
  ): ChartDataPoint[] {
    const calorieData = this.prepareDailyCalorieData(meals, days);
    const weightData = this.prepareWeightData(weights, profile, days);

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
   * Calculate temporal smoothing for weight data using exponential kernel
   * @param weightDataPoints - Array of weight data points with timestamps
   * @param allTimePoints - Array of all timestamps to smooth over
   * @param kernelWidth - Kernel width parameter (default 4)
   * @returns Array of smoothed weight values
   */
  static calculateTemporalWeightSmooth(
    weightDataPoints: { timestamp: number; value: number }[],
    allTimePoints: number[],
    kernelWidth: number = 4
  ): (number | undefined)[] {
    if (weightDataPoints.length === 0) {
      return new Array(allTimePoints.length).fill(undefined);
    }

    const smoothedValues: (number | undefined)[] = [];
    const sortedWeightData = [...weightDataPoints].sort((a, b) => a.timestamp - b.timestamp);

    for (const timePoint of allTimePoints) {
      let weightSum = 0;
      let valueSum = 0;

      sortedWeightData.forEach(point => {
        // Calculate temporal distance in days
        const distanceMs = Math.abs(timePoint - point.timestamp);
        const distanceDays = distanceMs / (24 * 60 * 60 * 1000);

        // Exponential kernel - gives more weight to closer points
        const weight = Math.exp(-0.5 * Math.pow(distanceDays / kernelWidth, 2));

        valueSum += weight * point.value;
        weightSum += weight;
      });

      // Only add a smoothed value if we have sufficient weight contribution
      if (weightSum > 0.01) {
        smoothedValues.push(valueSum / weightSum);
      } else {
        // Find nearest weight point as fallback
        const nearestPoint = sortedWeightData.reduce((nearest, current) => {
          const currentDistance = Math.abs(current.timestamp - timePoint);
          const nearestDistance = Math.abs(nearest.timestamp - timePoint);
          return currentDistance < nearestDistance ? current : nearest;
        });

        // Only use nearest point if it's within reasonable distance (e.g., 30 days)
        const nearestDistanceDays = Math.abs(nearestPoint.timestamp - timePoint) / (24 * 60 * 60 * 1000);
        if (nearestDistanceDays <= 30) {
          smoothedValues.push(nearestPoint.value);
        } else {
          smoothedValues.push(undefined);
        }
      }
    }

    return smoothedValues;
  }

  /**
   * Calculate trend lines for chart data
   * @param data - Array of chart data points
   * @param bandwidth - LOWESS bandwidth for calorie trend (default 0.3)
   * @returns Object with calorie and weight trend arrays
   */
  static calculateTrendLines(
    data: ChartDataPoint[],
    bandwidth: number = 0.3
  ): { caloriesTrend: number[]; weightTrend: (number | undefined)[] } {
    // Extract calorie values (replace undefined with 0) and calculate LOWESS trend
    const calorieValues = data.map(point => point.calories || 0);
    const caloriesTrend = this.calculateLOWESSTrend(calorieValues, bandwidth);

    // Extract weight data points with timestamps
    const weightDataPoints: { timestamp: number; value: number }[] = [];
    data.forEach(point => {
      if (point.weight !== undefined) {
        weightDataPoints.push({
          timestamp: point.date.getTime(),
          value: point.weight
        });
      }
    });

    // Get all timestamps for temporal smoothing
    const allTimePoints = data.map(point => point.date.getTime());

    // Calculate temporal weight trend using exponential kernel smoothing
    const weightTrend = this.calculateTemporalWeightSmooth(weightDataPoints, allTimePoints);

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
   * Calculate sensible axis configuration for calorie data
   * @param data - Array of chart data points
   * @returns Object with min, max, and tick interval for calorie axis
   */
  static calculateCalorieAxisConfig(data: ChartDataPoint[]): {
    min: number;
    max: number;
    tickInterval: number;
  } {
    if (data.length === 0) {
      return { min: 0, max: 500, tickInterval: 50 };
    }

    // Find the maximum calorie value
    const maxCalories = Math.max(...data.map(point => point.calories || 0));

    // Calculate appropriate maximum (rounded up to next multiple of 100)
    const max = Math.ceil(maxCalories / 100) * 100;

    // Determine tick interval based on max value
    const tickInterval = max < 500 ? 50 : 100;

    return {
      min: 0,
      max: Math.max(max, tickInterval), // Ensure max is at least one tick interval
      tickInterval
    };
  }

  /**
   * Calculate sensible axis configuration for weight data
   * @param data - Array of chart data points
   * @returns Object with min, max, and tick interval for weight axis
   */
  static calculateWeightAxisConfig(data: ChartDataPoint[]): {
    min: number;
    max: number;
    tickInterval: number;
  } {
    // Filter out undefined weight values
    const weightValues = data.filter(point => point.weight !== undefined).map(point => point.weight!);

    if (weightValues.length === 0) {
      // Default configuration for no weight data
      return {
        min: 0,
        max: 20,
        tickInterval: 2
      };
    }

    const minWeight = Math.min(...weightValues);
    const maxWeight = Math.max(...weightValues);
    const weightRange = maxWeight - minWeight;

    // Determine rounding value based on weight magnitude
    let roundingValue: number;
    if (maxWeight < 25) {
      roundingValue = 0.5;
    } else if (maxWeight < 100) {
      roundingValue = 1;
    } else if (maxWeight < 250) {
      roundingValue = 5;
    } else {
      roundingValue = 10;
    }

    // Calculate axis range - use the larger of:
    // 1. 10% of the highest weight value
    // 2. 120% of the delta between min/max values
    const rangeOption1 = Math.ceil((maxWeight * 0.1) / roundingValue) * roundingValue;
    const rangeOption2 = Math.ceil((weightRange * 1.2) / roundingValue) * roundingValue;
    const axisRange = Math.max(rangeOption1, rangeOption2, roundingValue * 2); // Ensure minimum range

    // Calculate center point of data
    const dataCenter = (minWeight + maxWeight) / 2;

    // Calculate axis min/max to center the data
    let axisMin = dataCenter - (axisRange / 2);
    let axisMax = dataCenter + (axisRange / 2);

    // Round to nice values
    axisMin = Math.floor(axisMin / roundingValue) * roundingValue;
    axisMax = Math.ceil(axisMax / roundingValue) * roundingValue;

    // Ensure the axis includes all data points with some padding
    while (axisMin > minWeight - roundingValue * 0.1) {
      axisMin -= roundingValue;
    }
    while (axisMax < maxWeight + roundingValue * 0.1) {
      axisMax += roundingValue;
    }

    // Determine tick interval based on axis range
    const totalRange = axisMax - axisMin;
    let tickInterval: number;

    if (totalRange <= roundingValue * 10) {
      tickInterval = roundingValue;
    } else if (totalRange <= roundingValue * 20) {
      tickInterval = roundingValue * 2;
    } else {
      tickInterval = roundingValue * 5;
    }

    // Ensure we don't have too many or too few ticks (aim for 4-10 ticks)
    const numTicks = totalRange / tickInterval;
    if (numTicks > 10) {
      tickInterval = roundingValue * Math.ceil(totalRange / (10 * roundingValue));
    } else if (numTicks < 4) {
      tickInterval = roundingValue * Math.max(1, Math.floor(totalRange / (4 * roundingValue)));
    }

    return {
      min: Math.max(0, axisMin), // Don't go below 0 for weights
      max: axisMax,
      tickInterval
    };
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
   * Get the weight axis label with current display unit
   * @param profile - User profile for unit preferences
   * @returns Formatted axis label string
   */
  static getWeightAxisLabel(profile?: Loaded<typeof CalorieTrackerProfile>): string {
    const displayUnit = UnitPreferenceManager.getBodyWeightUnit(profile);
    return `Weight (${displayUnit})`;
  }

  /**
   * Format weight value for tooltip display
   * @param value - Weight value
   * @param profile - User profile for unit preferences
   * @returns Formatted weight string with unit
   */
  static formatWeightTooltip(value: number, profile?: Loaded<typeof CalorieTrackerProfile>): string {
    const displayUnit = UnitPreferenceManager.getBodyWeightUnit(profile);
    return WeightConverter.formatDisplay(value, displayUnit);
  }

  /**
   * Get the current display unit for weight
   * @param profile - User profile for unit preferences
   * @returns Current body weight unit
   */
  static getWeightDisplayUnit(profile?: Loaded<typeof CalorieTrackerProfile>): BodyWeightUnit {
    return UnitPreferenceManager.getBodyWeightUnit(profile);
  }

  /**
   * Helper method to get date range for analysis
   * @param days - Number of days
   * @returns Object with start and end dates as JS Dates for compatibility
   */
  static getDateRange(days: number): { startDate: Date; endDate: Date } {
    // Use endOf('day') to include all entries for today
    const endDate = DateTime.now().endOf('day');
    const startDate = endDate.minus({ days: days - 1 });

    return {
      startDate: startDate.toJSDate(),
      endDate: endDate.toJSDate()
    };
  }
}
