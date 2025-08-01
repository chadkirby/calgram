/**
 * WeightConverter - Utility class for converting between different weight units
 * Supports grams, ounces, pounds, and kilograms with high precision
 */

import type { MealWeightUnit, BodyWeightUnit } from '@/schema';

export type WeightUnit = MealWeightUnit | BodyWeightUnit;

export class WeightConverter {
  // Conversion factors to grams (base unit)
  private static readonly CONVERSIONS = {
    g: 1,
    oz: 28.3495,
    lb: 453.592,
    kg: 1000,
    lbs: 453.592, // Same as lb for body weight
  } as const;

  /**
   * Convert any weight unit to grams
   * @param value - The weight value to convert
   * @param unit - The source unit
   * @returns Weight in grams
   */
  static toGrams(value: number, unit: WeightUnit): number {
    if (value === 0) return 0;

    const factor = this.CONVERSIONS[unit];
    if (!factor) {
      throw new Error(`Unsupported unit: ${unit}`);
    }

    return Number((value * factor).toFixed(6));
  }

  /**
   * Convert grams to any weight unit
   * @param grams - The weight in grams
   * @param unit - The target unit
   * @returns Weight in the target unit
   */
  static fromGrams(grams: number, unit: WeightUnit): number {
    if (grams === 0) return 0;

    const factor = this.CONVERSIONS[unit];
    if (!factor) {
      throw new Error(`Unsupported unit: ${unit}`);
    }

    return Number((grams / factor).toFixed(6));
  }

  /**
   * Convert between any two weight units
   * @param value - The weight value to convert
   * @param fromUnit - The source unit
   * @param toUnit - The target unit
   * @returns Weight in the target unit
   */
  static convert(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
    if (fromUnit === toUnit) return value;

    const grams = this.toGrams(value, fromUnit);
    return this.fromGrams(grams, toUnit);
  }

  /**
   * Format weight value for display with appropriate precision
   * @param value - The weight value
   * @param unit - The weight unit
   * @returns Formatted string with value and unit
   */
  static formatDisplay(value: number, unit: WeightUnit): string {
    if (value === 0) return `0${unit}`;

    // Use appropriate decimal places based on unit and value size
    let decimals = 1;

    if (unit === 'g') {
      decimals = value < 10 ? 1 : 0;
    } else if (unit === 'oz') {
      decimals = value < 1 ? 2 : 1;
    } else if (unit === 'lb' || unit === 'lbs') {
      decimals = value < 1 ? 2 : 1;
    } else if (unit === 'kg') {
      decimals = value < 1 ? 2 : 1;
    }

    const formatted = value.toFixed(decimals);
    // Remove trailing zeros after decimal point only
    const cleaned = formatted.replace(/(?<=\.)0+$/, '').replace(/\.$/, '');

    return `${cleaned}${unit}`;
  }

  /**
   * Get all available meal weight units
   */
  static getMealWeightUnits(): MealWeightUnit[] {
    return ['g', 'oz', 'lb', 'kg'];
  }

  /**
   * Get all available body weight units
   */
  static getBodyWeightUnits(): BodyWeightUnit[] {
    return ['lbs', 'kg'];
  }

  /**
   * Check if a unit is valid for meal weights
   */
  static isMealWeightUnit(unit: string): unit is MealWeightUnit {
    return ['g', 'oz', 'lb', 'kg'].includes(unit);
  }

  /**
   * Check if a unit is valid for body weights
   */
  static isBodyWeightUnit(unit: string): unit is BodyWeightUnit {
    return ['lbs', 'kg'].includes(unit);
  }


}