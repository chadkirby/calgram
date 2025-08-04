import { describe, it, expect } from 'vitest';
import { WeightConverter } from '../WeightConverter';

describe('WeightConverter', () => {
  describe('toGrams', () => {
    it('should convert grams to grams (identity)', () => {
      expect(WeightConverter.toGrams(100, 'g')).toBe(100);
      expect(WeightConverter.toGrams(0, 'g')).toBe(0);
      expect(WeightConverter.toGrams(1.5, 'g')).toBe(1.5);
    });

    it('should convert ounces to grams using factor 28.3495', () => {
      expect(WeightConverter.toGrams(1, 'oz')).toBe(28.3495);
      expect(WeightConverter.toGrams(2, 'oz')).toBe(56.699);
      expect(WeightConverter.toGrams(0.5, 'oz')).toBe(14.17475);
    });

    it('should convert pounds to grams using factor 453.592', () => {
      expect(WeightConverter.toGrams(1, 'lb')).toBe(453.592);
      expect(WeightConverter.toGrams(2, 'lb')).toBe(907.184);
      expect(WeightConverter.toGrams(0.5, 'lb')).toBe(226.796);
    });

    it('should convert kilograms to grams using factor 1000', () => {
      expect(WeightConverter.toGrams(1, 'kg')).toBe(1000);
      expect(WeightConverter.toGrams(2.5, 'kg')).toBe(2500);
      expect(WeightConverter.toGrams(0.1, 'kg')).toBe(100);
    });

    it('should convert lbs (body weight) to grams using same factor as lb', () => {
      expect(WeightConverter.toGrams(1, 'lbs')).toBe(453.592);
      expect(WeightConverter.toGrams(150, 'lbs')).toBe(68038.8);
    });

    it('should handle zero values', () => {
      expect(WeightConverter.toGrams(0, 'oz')).toBe(0);
      expect(WeightConverter.toGrams(0, 'lb')).toBe(0);
      expect(WeightConverter.toGrams(0, 'kg')).toBe(0);
      expect(WeightConverter.toGrams(0, 'lbs')).toBe(0);
    });

    it('should maintain precision to 6 decimal places', () => {
      const result = WeightConverter.toGrams(1/3, 'oz');
      expect(result).toBe(9.449833); // 28.3495 / 3 rounded to 6 decimals
    });

    it('should throw error for unsupported units', () => {
      expect(() => WeightConverter.toGrams(100, 'invalid' as any)).toThrow('Unsupported unit: invalid');
    });
  });

  describe('fromGrams', () => {
    it('should convert grams to grams (identity)', () => {
      expect(WeightConverter.fromGrams(100, 'g')).toBe(100);
      expect(WeightConverter.fromGrams(0, 'g')).toBe(0);
      expect(WeightConverter.fromGrams(1.5, 'g')).toBe(1.5);
    });

    it('should convert grams to ounces using inverse factor', () => {
      expect(WeightConverter.fromGrams(28.3495, 'oz')).toBe(1);
      expect(WeightConverter.fromGrams(56.699, 'oz')).toBe(2);
      expect(WeightConverter.fromGrams(100, 'oz')).toBeCloseTo(3.527396, 5);
    });

    it('should convert grams to pounds using inverse factor', () => {
      expect(WeightConverter.fromGrams(453.592, 'lb')).toBe(1);
      expect(WeightConverter.fromGrams(907.184, 'lb')).toBe(2);
      expect(WeightConverter.fromGrams(100, 'lb')).toBeCloseTo(0.220462, 5);
    });

    it('should convert grams to kilograms using inverse factor', () => {
      expect(WeightConverter.fromGrams(1000, 'kg')).toBe(1);
      expect(WeightConverter.fromGrams(2500, 'kg')).toBe(2.5);
      expect(WeightConverter.fromGrams(100, 'kg')).toBe(0.1);
    });

    it('should convert grams to lbs (body weight)', () => {
      expect(WeightConverter.fromGrams(68038.8, 'lbs')).toBeCloseTo(150, 5);
      expect(WeightConverter.fromGrams(453.592, 'lbs')).toBe(1);
    });

    it('should handle zero values', () => {
      expect(WeightConverter.fromGrams(0, 'oz')).toBe(0);
      expect(WeightConverter.fromGrams(0, 'lb')).toBe(0);
      expect(WeightConverter.fromGrams(0, 'kg')).toBe(0);
      expect(WeightConverter.fromGrams(0, 'lbs')).toBe(0);
    });

    it('should maintain precision to 6 decimal places', () => {
      const result = WeightConverter.fromGrams(100, 'oz');
      expect(result).toBeCloseTo(3.527396, 5); // 100 / 28.3495 with appropriate precision
    });

    it('should throw error for unsupported units', () => {
      expect(() => WeightConverter.fromGrams(100, 'invalid' as any)).toThrow('Unsupported unit: invalid');
    });
  });

  describe('convert', () => {
    it('should return same value when converting to same unit', () => {
      expect(WeightConverter.convert(100, 'g', 'g')).toBe(100);
      expect(WeightConverter.convert(5, 'oz', 'oz')).toBe(5);
      expect(WeightConverter.convert(2.5, 'kg', 'kg')).toBe(2.5);
    });

    it('should convert between all meal weight units correctly', () => {
      // 1 oz to other units
      expect(WeightConverter.convert(1, 'oz', 'g')).toBe(28.3495);
      expect(WeightConverter.convert(1, 'oz', 'lb')).toBeCloseTo(0.0625, 5);
      expect(WeightConverter.convert(1, 'oz', 'kg')).toBeCloseTo(0.0283495, 5);

      // 1 lb to other units
      expect(WeightConverter.convert(1, 'lb', 'g')).toBe(453.592);
      expect(WeightConverter.convert(1, 'lb', 'oz')).toBe(16);
      expect(WeightConverter.convert(1, 'lb', 'kg')).toBeCloseTo(0.453592, 5);

      // 1 kg to other units
      expect(WeightConverter.convert(1, 'kg', 'g')).toBe(1000);
      expect(WeightConverter.convert(1, 'kg', 'oz')).toBeCloseTo(35.274, 3);
      expect(WeightConverter.convert(1, 'kg', 'lb')).toBeCloseTo(2.20462, 5);
    });

    it('should convert between body weight units', () => {
      expect(WeightConverter.convert(1, 'lbs', 'kg')).toBeCloseTo(0.453592, 5);
      expect(WeightConverter.convert(1, 'kg', 'lbs')).toBeCloseTo(2.20462, 5);
      expect(WeightConverter.convert(150, 'lbs', 'kg')).toBeCloseTo(68.0388, 4);
      expect(WeightConverter.convert(70, 'kg', 'lbs')).toBeCloseTo(154.324, 3);
    });

    it('should handle zero values in conversions', () => {
      expect(WeightConverter.convert(0, 'g', 'oz')).toBe(0);
      expect(WeightConverter.convert(0, 'lb', 'kg')).toBe(0);
      expect(WeightConverter.convert(0, 'kg', 'lbs')).toBe(0);
    });

    it('should maintain precision through double conversion', () => {
      const original = 123.456;
      const converted = WeightConverter.convert(original, 'g', 'oz');
      const backConverted = WeightConverter.convert(converted, 'oz', 'g');
      expect(backConverted).toBeCloseTo(original, 4);
    });
  });

  describe('formatDisplay', () => {
    it('should format zero values correctly', () => {
      expect(WeightConverter.formatDisplay(0, 'g')).toBe('0g');
      expect(WeightConverter.formatDisplay(0, 'oz')).toBe('0oz');
      expect(WeightConverter.formatDisplay(0, 'lb')).toBe('0lb');
      expect(WeightConverter.formatDisplay(0, 'kg')).toBe('0kg');
      expect(WeightConverter.formatDisplay(0, 'lbs')).toBe('0lbs');
    });

    it('should format grams with appropriate precision', () => {
      expect(WeightConverter.formatDisplay(5.0, 'g')).toBe('5g');
      expect(WeightConverter.formatDisplay(5.5, 'g')).toBe('5.5g');
      expect(WeightConverter.formatDisplay(15.0, 'g')).toBe('15g');
      expect(WeightConverter.formatDisplay(15.7, 'g')).toBe('16g'); // Rounded
    });

    it('should format ounces with appropriate precision', () => {
      expect(WeightConverter.formatDisplay(0.5, 'oz')).toBe('0.5oz');
      expect(WeightConverter.formatDisplay(0.25, 'oz')).toBe('0.25oz');
      expect(WeightConverter.formatDisplay(1.0, 'oz')).toBe('1oz');
      expect(WeightConverter.formatDisplay(1.5, 'oz')).toBe('1.5oz');
      expect(WeightConverter.formatDisplay(2.0, 'oz')).toBe('2oz');
    });

    it('should format pounds with appropriate precision', () => {
      expect(WeightConverter.formatDisplay(0.5, 'lb')).toBe('0.5lb');
      expect(WeightConverter.formatDisplay(0.25, 'lb')).toBe('0.25lb');
      expect(WeightConverter.formatDisplay(1.0, 'lb')).toBe('1lb');
      expect(WeightConverter.formatDisplay(1.5, 'lb')).toBe('1.5lb');
      expect(WeightConverter.formatDisplay(2.0, 'lb')).toBe('2lb');
    });

    it('should format kilograms with appropriate precision', () => {
      expect(WeightConverter.formatDisplay(0.5, 'kg')).toBe('0.5kg');
      expect(WeightConverter.formatDisplay(0.25, 'kg')).toBe('0.25kg');
      expect(WeightConverter.formatDisplay(1.0, 'kg')).toBe('1kg');
      expect(WeightConverter.formatDisplay(1.5, 'kg')).toBe('1.5kg');
      expect(WeightConverter.formatDisplay(2.0, 'kg')).toBe('2kg');
    });

    it('should format body weight (lbs) with appropriate precision', () => {
      expect(WeightConverter.formatDisplay(150.0, 'lbs')).toBe('150lbs');
      expect(WeightConverter.formatDisplay(150.5, 'lbs')).toBe('150.5lbs');
      expect(WeightConverter.formatDisplay(0.75, 'lbs')).toBe('0.75lbs');
    });

    it('should remove trailing zeros', () => {
      expect(WeightConverter.formatDisplay(1.00, 'g')).toBe('1g');
      expect(WeightConverter.formatDisplay(2.50, 'oz')).toBe('2.5oz');
      expect(WeightConverter.formatDisplay(3.10, 'lb')).toBe('3.1lb');
    });
  });

  describe('utility methods', () => {
    it('should return correct meal weight units', () => {
      const units = WeightConverter.getMealWeightUnits();
      expect(units).toEqual(['g', 'oz', 'lb', 'kg']);
    });

    it('should return correct body weight units', () => {
      const units = WeightConverter.getBodyWeightUnits();
      expect(units).toEqual(['lbs', 'kg']);
    });

    it('should validate meal weight units correctly', () => {
      expect(WeightConverter.isMealWeightUnit('g')).toBe(true);
      expect(WeightConverter.isMealWeightUnit('oz')).toBe(true);
      expect(WeightConverter.isMealWeightUnit('lb')).toBe(true);
      expect(WeightConverter.isMealWeightUnit('kg')).toBe(true);
      expect(WeightConverter.isMealWeightUnit('lbs')).toBe(false);
      expect(WeightConverter.isMealWeightUnit('invalid')).toBe(false);
    });

    it('should validate body weight units correctly', () => {
      expect(WeightConverter.isBodyWeightUnit('lbs')).toBe(true);
      expect(WeightConverter.isBodyWeightUnit('kg')).toBe(true);
      expect(WeightConverter.isBodyWeightUnit('g')).toBe(false);
      expect(WeightConverter.isBodyWeightUnit('oz')).toBe(false);
      expect(WeightConverter.isBodyWeightUnit('lb')).toBe(false);
      expect(WeightConverter.isBodyWeightUnit('invalid')).toBe(false);
    });
  });

  describe('edge cases and precision', () => {
    it('should handle very small numbers', () => {
      const result = WeightConverter.convert(0.001, 'kg', 'g');
      expect(result).toBe(1);
      
      const formatted = WeightConverter.formatDisplay(0.01, 'oz');
      expect(formatted).toBe('0.01oz');
    });

    it('should handle very large numbers', () => {
      const result = WeightConverter.convert(1000, 'kg', 'g');
      expect(result).toBe(1000000);
      
      const backConverted = WeightConverter.convert(result, 'g', 'kg');
      expect(backConverted).toBe(1000);
    });

    it('should maintain precision through multiple conversions', () => {
      let value = 100; // Start with 100g
      
      // Convert through multiple units and back
      value = WeightConverter.convert(value, 'g', 'oz');
      value = WeightConverter.convert(value, 'oz', 'lb');
      value = WeightConverter.convert(value, 'lb', 'kg');
      value = WeightConverter.convert(value, 'kg', 'g');
      
      expect(value).toBeCloseTo(100, 3); // Should be close to original
    });

    it('should handle fractional conversions accurately', () => {
      // Test specific conversion that should be exact
      const ouncesToGrams = WeightConverter.convert(16, 'oz', 'lb');
      expect(ouncesToGrams).toBe(1); // 16 oz = 1 lb exactly
      
      const poundsToKg = WeightConverter.convert(2.20462, 'lbs', 'kg');
      expect(poundsToKg).toBeCloseTo(1, 4); // Should be very close to 1 kg
    });
  });
});