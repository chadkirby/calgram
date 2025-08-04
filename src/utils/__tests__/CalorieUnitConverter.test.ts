import { describe, it, expect } from 'vitest';
import { CalorieUnitConverter } from '../CalorieUnitConverter';
import type { CalorieUnit } from '../../schema';

describe('CalorieUnitConverter', () => {
  describe('toCaloriesPerGram', () => {
    it('should convert grams correctly (base unit)', () => {
      expect(CalorieUnitConverter.toCaloriesPerGram(4.0, 'g')).toBe(4.0);
      expect(CalorieUnitConverter.toCaloriesPerGram(0, 'g')).toBe(0);
      expect(CalorieUnitConverter.toCaloriesPerGram(1.5, 'g')).toBe(1.5);
    });

    it('should convert ounces to calories per gram', () => {
      // 1 oz = 28.3495g, so 28.3495 cal/oz = 1 cal/g
      expect(CalorieUnitConverter.toCaloriesPerGram(28.3495, 'oz')).toBeCloseTo(1.0, 5);
      expect(CalorieUnitConverter.toCaloriesPerGram(113.398, 'oz')).toBeCloseTo(4.0, 5);
      expect(CalorieUnitConverter.toCaloriesPerGram(0, 'oz')).toBe(0);
    });

    it('should convert pounds to calories per gram', () => {
      // 1 lb = 453.592g, so 453.592 cal/lb = 1 cal/g
      expect(CalorieUnitConverter.toCaloriesPerGram(453.592, 'lb')).toBeCloseTo(1.0, 5);
      expect(CalorieUnitConverter.toCaloriesPerGram(1814.368, 'lb')).toBeCloseTo(4.0, 5);
      expect(CalorieUnitConverter.toCaloriesPerGram(0, 'lb')).toBe(0);
    });

    it('should convert kilograms to calories per gram', () => {
      // 1 kg = 1000g, so 1000 cal/kg = 1 cal/g
      expect(CalorieUnitConverter.toCaloriesPerGram(1000, 'kg')).toBe(1.0);
      expect(CalorieUnitConverter.toCaloriesPerGram(4000, 'kg')).toBe(4.0);
      expect(CalorieUnitConverter.toCaloriesPerGram(0, 'kg')).toBe(0);
    });

    it('should handle very small values', () => {
      expect(CalorieUnitConverter.toCaloriesPerGram(0.001, 'g')).toBe(0.001);
      expect(CalorieUnitConverter.toCaloriesPerGram(0.0283495, 'oz')).toBeCloseTo(0.001, 6);
    });

    it('should handle very large values', () => {
      expect(CalorieUnitConverter.toCaloriesPerGram(10000, 'g')).toBe(10000);
      expect(CalorieUnitConverter.toCaloriesPerGram(10000000, 'kg')).toBe(10000);
    });

    it('should throw error for negative values', () => {
      expect(() => CalorieUnitConverter.toCaloriesPerGram(-1, 'g')).toThrow('Calorie value cannot be negative');
      expect(() => CalorieUnitConverter.toCaloriesPerGram(-0.1, 'oz')).toThrow('Calorie value cannot be negative');
    });
  });

  describe('fromCaloriesPerGram', () => {
    it('should convert from calories per gram to grams (base unit)', () => {
      expect(CalorieUnitConverter.fromCaloriesPerGram(4.0, 'g')).toBe(4.0);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0, 'g')).toBe(0);
      expect(CalorieUnitConverter.fromCaloriesPerGram(1.5, 'g')).toBe(1.5);
    });

    it('should convert from calories per gram to ounces', () => {
      // 1 cal/g = 28.3495 cal/oz
      expect(CalorieUnitConverter.fromCaloriesPerGram(1.0, 'oz')).toBeCloseTo(28.3495, 5);
      expect(CalorieUnitConverter.fromCaloriesPerGram(4.0, 'oz')).toBeCloseTo(113.398, 5);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0, 'oz')).toBe(0);
    });

    it('should convert from calories per gram to pounds', () => {
      // 1 cal/g = 453.592 cal/lb
      expect(CalorieUnitConverter.fromCaloriesPerGram(1.0, 'lb')).toBeCloseTo(453.592, 5);
      expect(CalorieUnitConverter.fromCaloriesPerGram(4.0, 'lb')).toBeCloseTo(1814.368, 5);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0, 'lb')).toBe(0);
    });

    it('should convert from calories per gram to kilograms', () => {
      // 1 cal/g = 1000 cal/kg
      expect(CalorieUnitConverter.fromCaloriesPerGram(1.0, 'kg')).toBe(1000);
      expect(CalorieUnitConverter.fromCaloriesPerGram(4.0, 'kg')).toBe(4000);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0, 'kg')).toBe(0);
    });

    it('should handle very small values', () => {
      expect(CalorieUnitConverter.fromCaloriesPerGram(0.001, 'g')).toBe(0.001);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0.001, 'kg')).toBe(1);
    });

    it('should handle very large values', () => {
      expect(CalorieUnitConverter.fromCaloriesPerGram(10000, 'g')).toBe(10000);
      expect(CalorieUnitConverter.fromCaloriesPerGram(10, 'kg')).toBe(10000);
    });

    it('should throw error for negative values', () => {
      expect(() => CalorieUnitConverter.fromCaloriesPerGram(-1, 'g')).toThrow('Calories per gram cannot be negative');
      expect(() => CalorieUnitConverter.fromCaloriesPerGram(-0.1, 'oz')).toThrow('Calories per gram cannot be negative');
    });
  });

  describe('formatCalorieDensity', () => {
    it('should format with default unit (grams)', () => {
      expect(CalorieUnitConverter.formatCalorieDensity(4.0)).toBe('4.00 cal/g');
      expect(CalorieUnitConverter.formatCalorieDensity(1.5)).toBe('1.50 cal/g');
      expect(CalorieUnitConverter.formatCalorieDensity(0)).toBe('0.00 cal/g');
    });

    it('should format with specified units', () => {
      expect(CalorieUnitConverter.formatCalorieDensity(1.0, 'g')).toBe('1.00 cal/g');
      expect(CalorieUnitConverter.formatCalorieDensity(1.0, 'oz')).toBe('28.3 cal/oz');
      expect(CalorieUnitConverter.formatCalorieDensity(1.0, 'lb')).toBe('453.6 cal/lb');
      expect(CalorieUnitConverter.formatCalorieDensity(1.0, 'kg')).toBe('1000.0 cal/kg');
    });

    it('should use appropriate decimal places based on magnitude', () => {
      // Values >= 10 should use 1 decimal place
      expect(CalorieUnitConverter.formatCalorieDensity(0.1, 'kg')).toBe('100.0 cal/kg');
      expect(CalorieUnitConverter.formatCalorieDensity(0.01, 'kg')).toBe('10.0 cal/kg');
      
      // Values < 10 should use 2 decimal places
      expect(CalorieUnitConverter.formatCalorieDensity(0.001, 'kg')).toBe('1.00 cal/kg');
      expect(CalorieUnitConverter.formatCalorieDensity(0.005, 'kg')).toBe('5.00 cal/kg');
    });
  });

  describe('getUnitLabel', () => {
    it('should return correct unit labels', () => {
      expect(CalorieUnitConverter.getUnitLabel('g')).toBe('cal/g');
      expect(CalorieUnitConverter.getUnitLabel('oz')).toBe('cal/oz');
      expect(CalorieUnitConverter.getUnitLabel('lb')).toBe('cal/lb');
      expect(CalorieUnitConverter.getUnitLabel('kg')).toBe('cal/kg');
    });
  });

  describe('isValidUnit', () => {
    it('should validate supported units', () => {
      expect(CalorieUnitConverter.isValidUnit('g')).toBe(true);
      expect(CalorieUnitConverter.isValidUnit('oz')).toBe(true);
      expect(CalorieUnitConverter.isValidUnit('lb')).toBe(true);
      expect(CalorieUnitConverter.isValidUnit('kg')).toBe(true);
    });

    it('should reject unsupported units', () => {
      expect(CalorieUnitConverter.isValidUnit('mg')).toBe(false);
      expect(CalorieUnitConverter.isValidUnit('ton')).toBe(false);
      expect(CalorieUnitConverter.isValidUnit('')).toBe(false);
      expect(CalorieUnitConverter.isValidUnit('invalid')).toBe(false);
    });
  });

  describe('getSupportedUnits', () => {
    it('should return all supported units', () => {
      const units = CalorieUnitConverter.getSupportedUnits();
      expect(units).toEqual(['g', 'oz', 'lb', 'kg']);
      expect(units).toHaveLength(4);
    });
  });

  describe('getConversionFactor', () => {
    it('should return correct conversion factors', () => {
      expect(CalorieUnitConverter.getConversionFactor('g')).toBe(1);
      expect(CalorieUnitConverter.getConversionFactor('oz')).toBe(28.3495);
      expect(CalorieUnitConverter.getConversionFactor('lb')).toBe(453.592);
      expect(CalorieUnitConverter.getConversionFactor('kg')).toBe(1000);
    });
  });

  describe('round-trip conversions', () => {
    const testValues = [0, 0.001, 0.5, 1, 2.5, 10, 100];
    const units: CalorieUnit[] = ['g', 'oz', 'lb', 'kg'];

    it('should maintain precision in round-trip conversions', () => {
      testValues.forEach(originalValue => {
        units.forEach(unit => {
          if (originalValue === 0) {
            // Special case for zero
            const converted = CalorieUnitConverter.toCaloriesPerGram(originalValue, unit);
            const roundTrip = CalorieUnitConverter.fromCaloriesPerGram(converted, unit);
            expect(roundTrip).toBe(0);
          } else {
            const converted = CalorieUnitConverter.toCaloriesPerGram(originalValue, unit);
            const roundTrip = CalorieUnitConverter.fromCaloriesPerGram(converted, unit);
            expect(roundTrip).toBeCloseTo(originalValue, 10);
          }
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle zero values correctly', () => {
      expect(CalorieUnitConverter.toCaloriesPerGram(0, 'g')).toBe(0);
      expect(CalorieUnitConverter.fromCaloriesPerGram(0, 'g')).toBe(0);
      expect(CalorieUnitConverter.formatCalorieDensity(0, 'g')).toBe('0.00 cal/g');
    });

    it('should handle very precise decimal values', () => {
      const preciseValue = 1.23456789;
      const converted = CalorieUnitConverter.toCaloriesPerGram(preciseValue, 'g');
      expect(converted).toBe(preciseValue);
    });

    it('should handle floating point precision issues', () => {
      // Test a value that might cause floating point precision issues
      const problematicValue = 0.1 + 0.2; // This equals 0.30000000000000004 in JS
      expect(() => CalorieUnitConverter.toCaloriesPerGram(problematicValue, 'g')).not.toThrow();
      expect(() => CalorieUnitConverter.fromCaloriesPerGram(problematicValue, 'g')).not.toThrow();
    });
  });
});