import type { CalorieUnit } from '../schema';

/**
 * Calorie density conversion factors (relative to grams)
 * These represent how many grams are in each unit
 */
const CALORIE_CONVERSION_FACTORS = {
  g: 1,           // Base unit
  oz: 28.3495,    // 1 oz = 28.3495g
  lb: 453.592,    // 1 lb = 453.592g  
  kg: 1000,       // 1 kg = 1000g
} as const;

/**
 * Utility class for converting calorie density between different units
 * while maintaining precision and providing consistent formatting
 */
export class CalorieUnitConverter {
  /**
   * Convert calories per display unit to calories per gram
   * @param value - Calories per display unit
   * @param unit - The display unit (g, oz, lb, kg)
   * @returns Calories per gram
   */
  static toCaloriesPerGram(value: number, unit: CalorieUnit): number {
    if (value < 0) {
      throw new Error('Calorie value cannot be negative');
    }
    
    const factor = CALORIE_CONVERSION_FACTORS[unit];
    return value / factor;
  }

  /**
   * Convert calories per gram to calories per display unit
   * @param caloriesPerGram - Calories per gram (stored value)
   * @param unit - The target display unit (g, oz, lb, kg)
   * @returns Calories per display unit
   */
  static fromCaloriesPerGram(caloriesPerGram: number, unit: CalorieUnit): number {
    if (caloriesPerGram < 0) {
      throw new Error('Calories per gram cannot be negative');
    }
    
    const factor = CALORIE_CONVERSION_FACTORS[unit];
    return caloriesPerGram * factor;
  }

  /**
   * Format calorie density for display with appropriate precision
   * @param caloriesPerGram - Calories per gram (stored value)
   * @param unit - The display unit (defaults to 'g' if not provided)
   * @returns Formatted string with unit label
   */
  static formatCalorieDensity(caloriesPerGram: number, unit: CalorieUnit = 'g'): string {
    const displayValue = this.fromCaloriesPerGram(caloriesPerGram, unit);
    const unitLabel = this.getUnitLabel(unit);
    
    // Use appropriate decimal places based on the magnitude of the value
    const decimalPlaces = displayValue >= 10 ? 1 : 2;
    return `${displayValue.toFixed(decimalPlaces)} ${unitLabel}`;
  }

  /**
   * Get the unit label for display (e.g., "cal/g", "cal/oz")
   * @param unit - The calorie unit
   * @returns Unit label string
   */
  static getUnitLabel(unit: CalorieUnit): string {
    return `cal/${unit}`;
  }

  /**
   * Validate that a calorie unit is supported
   * @param unit - The unit to validate
   * @returns True if the unit is supported
   */
  static isValidUnit(unit: string): unit is CalorieUnit {
    return unit in CALORIE_CONVERSION_FACTORS;
  }

  /**
   * Get all supported calorie units
   * @returns Array of supported calorie units
   */
  static getSupportedUnits(): CalorieUnit[] {
    return Object.keys(CALORIE_CONVERSION_FACTORS) as CalorieUnit[];
  }

  /**
   * Get the conversion factor for a unit (how many grams in the unit)
   * @param unit - The calorie unit
   * @returns Conversion factor
   */
  static getConversionFactor(unit: CalorieUnit): number {
    return CALORIE_CONVERSION_FACTORS[unit];
  }
}