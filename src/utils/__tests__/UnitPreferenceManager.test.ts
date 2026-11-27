import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnitPreferenceManager } from "../UnitPreferenceManager";
import type { MealWeightUnit, BodyWeightUnit, ProfileRow } from "@/schema";

// Mock profile for testing
const createMockProfile = (
  mealWeightUnit?: MealWeightUnit,
  bodyWeightUnit?: BodyWeightUnit,
): ProfileRow => {
  return {
    name: "Test User",
    firstName: "Test",
    mealWeightUnit,
    bodyWeightUnit,
  };
};

describe("UnitPreferenceManager", () => {
  beforeEach(() => {
    // Clear any console warnings
    vi.clearAllMocks();
  });

  describe("getMealWeightUnit", () => {
    it("should return default unit (grams) when profile is undefined", () => {
      const result = UnitPreferenceManager.getMealWeightUnit(undefined);
      expect(result).toBe("g");
    });

    it("should return default unit (grams) when mealWeightUnit is not set", () => {
      const profile = createMockProfile();
      const result = UnitPreferenceManager.getMealWeightUnit(profile);
      expect(result).toBe("g");
    });

    it("should return stored meal weight unit when set", () => {
      const profile = createMockProfile("oz");
      const result = UnitPreferenceManager.getMealWeightUnit(profile);
      expect(result).toBe("oz");
    });

    it("should handle all valid meal weight units", () => {
      const units: MealWeightUnit[] = ["g", "oz", "lb", "kg"];

      units.forEach((unit) => {
        const profile = createMockProfile(unit);
        const result = UnitPreferenceManager.getMealWeightUnit(profile);
        expect(result).toBe(unit);
      });
    });
  });

  describe("getBodyWeightUnit", () => {
    it("should return default unit (pounds) when profile is undefined", () => {
      const result = UnitPreferenceManager.getBodyWeightUnit(undefined);
      expect(result).toBe("lbs");
    });

    it("should return default unit (pounds) when bodyWeightUnit is not set", () => {
      const profile = createMockProfile();
      const result = UnitPreferenceManager.getBodyWeightUnit(profile);
      expect(result).toBe("lbs");
    });

    it("should return stored body weight unit when set", () => {
      const profile = createMockProfile(undefined, "kg");
      const result = UnitPreferenceManager.getBodyWeightUnit(profile);
      expect(result).toBe("kg");
    });

    it("should handle all valid body weight units", () => {
      const units: BodyWeightUnit[] = ["lbs", "kg"];

      units.forEach((unit) => {
        const profile = createMockProfile(undefined, unit);
        const result = UnitPreferenceManager.getBodyWeightUnit(profile);
        expect(result).toBe(unit);
      });
    });
  });

  describe("default unit getters", () => {
    it("should return correct default meal weight unit", () => {
      const result = UnitPreferenceManager.getDefaultMealWeightUnit();
      expect(result).toBe("g");
    });

    it("should return correct default body weight unit", () => {
      const result = UnitPreferenceManager.getDefaultBodyWeightUnit();
      expect(result).toBe("lbs");
    });
  });

  describe("fallback behavior", () => {
    it("should handle profile with mixed unit preferences", () => {
      const profile = createMockProfile("kg", "lbs");

      const mealUnit = UnitPreferenceManager.getMealWeightUnit(profile);
      const bodyUnit = UnitPreferenceManager.getBodyWeightUnit(profile);

      expect(mealUnit).toBe("kg");
      expect(bodyUnit).toBe("lbs");
    });
  });

  describe("edge cases", () => {
    it("should handle profile with null/undefined unit values gracefully", () => {
      const profile = createMockProfile(undefined, undefined);

      const mealUnit = UnitPreferenceManager.getMealWeightUnit(profile);
      const bodyUnit = UnitPreferenceManager.getBodyWeightUnit(profile);

      expect(mealUnit).toBe("g");
      expect(bodyUnit).toBe("lbs");
    });
  });
});
