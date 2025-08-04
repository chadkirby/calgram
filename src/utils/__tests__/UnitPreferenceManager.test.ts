import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitPreferenceManager } from '../UnitPreferenceManager';
import type { Loaded } from 'jazz-tools';
import type { CalorieTrackerProfile, MealWeightUnit, BodyWeightUnit } from '@/schema';

// Mock profile for testing
const createMockProfile = (
  mealWeightUnit?: MealWeightUnit,
  bodyWeightUnit?: BodyWeightUnit
): Loaded<typeof CalorieTrackerProfile> => {
  return {
    name: 'Test User',
    firstName: 'Test',
    mealWeightUnit,
    bodyWeightUnit,
  } as Loaded<typeof CalorieTrackerProfile>;
};

describe('UnitPreferenceManager', () => {
  beforeEach(() => {
    // Clear any console warnings
    vi.clearAllMocks();
  });

  describe('getMealWeightUnit', () => {
    it('should return default unit (grams) when profile is undefined', () => {
      const result = UnitPreferenceManager.getMealWeightUnit(undefined);
      expect(result).toBe('g');
    });

    it('should return default unit (grams) when mealWeightUnit is not set', () => {
      const profile = createMockProfile();
      const result = UnitPreferenceManager.getMealWeightUnit(profile);
      expect(result).toBe('g');
    });

    it('should return stored meal weight unit when set', () => {
      const profile = createMockProfile('oz');
      const result = UnitPreferenceManager.getMealWeightUnit(profile);
      expect(result).toBe('oz');
    });

    it('should handle all valid meal weight units', () => {
      const units: MealWeightUnit[] = ['g', 'oz', 'lb', 'kg'];
      
      units.forEach(unit => {
        const profile = createMockProfile(unit);
        const result = UnitPreferenceManager.getMealWeightUnit(profile);
        expect(result).toBe(unit);
      });
    });
  });

  describe('setMealWeightUnit', () => {
    it('should set meal weight unit when profile is available', () => {
      const profile = createMockProfile();
      UnitPreferenceManager.setMealWeightUnit(profile, 'kg');
      expect(profile.mealWeightUnit).toBe('kg');
    });

    it('should update existing meal weight unit', () => {
      const profile = createMockProfile('g');
      UnitPreferenceManager.setMealWeightUnit(profile, 'lb');
      expect(profile.mealWeightUnit).toBe('lb');
    });

    it('should log warning when profile is undefined', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      UnitPreferenceManager.setMealWeightUnit(undefined, 'kg');
      expect(consoleSpy).toHaveBeenCalledWith('Cannot set meal weight unit: profile not available');
      consoleSpy.mockRestore();
    });

    it('should handle all valid meal weight units', () => {
      const units: MealWeightUnit[] = ['g', 'oz', 'lb', 'kg'];
      
      units.forEach(unit => {
        const profile = createMockProfile();
        UnitPreferenceManager.setMealWeightUnit(profile, unit);
        expect(profile.mealWeightUnit).toBe(unit);
      });
    });
  });

  describe('getBodyWeightUnit', () => {
    it('should return default unit (pounds) when profile is undefined', () => {
      const result = UnitPreferenceManager.getBodyWeightUnit(undefined);
      expect(result).toBe('lbs');
    });

    it('should return default unit (pounds) when bodyWeightUnit is not set', () => {
      const profile = createMockProfile();
      const result = UnitPreferenceManager.getBodyWeightUnit(profile);
      expect(result).toBe('lbs');
    });

    it('should return stored body weight unit when set', () => {
      const profile = createMockProfile(undefined, 'kg');
      const result = UnitPreferenceManager.getBodyWeightUnit(profile);
      expect(result).toBe('kg');
    });

    it('should handle all valid body weight units', () => {
      const units: BodyWeightUnit[] = ['lbs', 'kg'];
      
      units.forEach(unit => {
        const profile = createMockProfile(undefined, unit);
        const result = UnitPreferenceManager.getBodyWeightUnit(profile);
        expect(result).toBe(unit);
      });
    });
  });

  describe('setBodyWeightUnit', () => {
    it('should set body weight unit when profile is available', () => {
      const profile = createMockProfile();
      UnitPreferenceManager.setBodyWeightUnit(profile, 'kg');
      expect(profile.bodyWeightUnit).toBe('kg');
    });

    it('should update existing body weight unit', () => {
      const profile = createMockProfile(undefined, 'lbs');
      UnitPreferenceManager.setBodyWeightUnit(profile, 'kg');
      expect(profile.bodyWeightUnit).toBe('kg');
    });

    it('should log warning when profile is undefined', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      UnitPreferenceManager.setBodyWeightUnit(undefined, 'kg');
      expect(consoleSpy).toHaveBeenCalledWith('Cannot set body weight unit: profile not available');
      consoleSpy.mockRestore();
    });

    it('should handle all valid body weight units', () => {
      const units: BodyWeightUnit[] = ['lbs', 'kg'];
      
      units.forEach(unit => {
        const profile = createMockProfile();
        UnitPreferenceManager.setBodyWeightUnit(profile, unit);
        expect(profile.bodyWeightUnit).toBe(unit);
      });
    });
  });

  describe('default unit getters', () => {
    it('should return correct default meal weight unit', () => {
      const result = UnitPreferenceManager.getDefaultMealWeightUnit();
      expect(result).toBe('g');
    });

    it('should return correct default body weight unit', () => {
      const result = UnitPreferenceManager.getDefaultBodyWeightUnit();
      expect(result).toBe('lbs');
    });
  });

  describe('fallback behavior', () => {
    it('should handle profile with mixed unit preferences', () => {
      const profile = createMockProfile('kg', 'lbs');
      
      const mealUnit = UnitPreferenceManager.getMealWeightUnit(profile);
      const bodyUnit = UnitPreferenceManager.getBodyWeightUnit(profile);
      
      expect(mealUnit).toBe('kg');
      expect(bodyUnit).toBe('lbs');
    });

    it('should maintain independence between meal and body weight units', () => {
      const profile = createMockProfile();
      
      UnitPreferenceManager.setMealWeightUnit(profile, 'oz');
      UnitPreferenceManager.setBodyWeightUnit(profile, 'kg');
      
      expect(profile.mealWeightUnit).toBe('oz');
      expect(profile.bodyWeightUnit).toBe('kg');
      
      // Verify they don't affect each other
      UnitPreferenceManager.setMealWeightUnit(profile, 'lb');
      expect(profile.bodyWeightUnit).toBe('kg'); // Should remain unchanged
    });
  });

  describe('edge cases', () => {
    it('should handle profile with null/undefined unit values gracefully', () => {
      const profile = createMockProfile(undefined, undefined);
      
      const mealUnit = UnitPreferenceManager.getMealWeightUnit(profile);
      const bodyUnit = UnitPreferenceManager.getBodyWeightUnit(profile);
      
      expect(mealUnit).toBe('g');
      expect(bodyUnit).toBe('lbs');
    });

    it('should not throw when setting units on valid profile', () => {
      const profile = createMockProfile();
      
      expect(() => {
        UnitPreferenceManager.setMealWeightUnit(profile, 'kg');
        UnitPreferenceManager.setBodyWeightUnit(profile, 'kg');
      }).not.toThrow();
    });
  });
});