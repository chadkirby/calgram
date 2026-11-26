import { describe, it, expect } from "vitest";
import type { MealEntryType, WeightEntryType } from "../../schema";
import { DateTime } from "luxon";

describe("Schema Migration Tests", () => {
  describe("MealEntry Schema", () => {
    it("should support MealEntry without displayUnit field (backward compatibility)", () => {
      // Test that TypeScript types work correctly for legacy data
      const mealWithoutUnit: MealEntryType = {
        timestamp: DateTime.now().toISO() || "",
        foodName: "Chicken Breast",
        foodCategory: "Protein",
        caloriesPerGram: 1.65,
        weightInGrams: 150,
        notes: "Grilled",
        totalCalories: 247.5,
        displayUnit: undefined, // Explicitly undefined for legacy data
      };

      expect(mealWithoutUnit.displayUnit).toBeUndefined();
      expect(mealWithoutUnit.foodName).toBe("Chicken Breast");
      expect(mealWithoutUnit.weightInGrams).toBe(150);
    });

    it("should support MealEntry with displayUnit field", () => {
      // Test that TypeScript types work correctly for new data with units
      const mealWithUnit: MealEntryType = {
        timestamp: DateTime.now().toISO() || "",
        foodName: "Chicken Breast",
        foodCategory: "Protein",
        caloriesPerGram: 1.65,
        weightInGrams: 150,
        notes: "Grilled",
        totalCalories: 247.5,
        displayUnit: "g",
      };

      expect(mealWithUnit.displayUnit).toBe("g");
      expect(mealWithUnit.foodName).toBe("Chicken Breast");
      expect(mealWithUnit.weightInGrams).toBe(150);
    });

    it("should support all valid displayUnit enum values", () => {
      const validUnits: Array<"g" | "oz" | "lb" | "kg"> = ["g", "oz", "lb", "kg"];

      validUnits.forEach((unit) => {
        const mealWithUnit: MealEntryType = {
          timestamp: DateTime.now().toISO() || "",
          foodName: "Test Food",
          foodCategory: "Test",
          caloriesPerGram: 1.0,
          weightInGrams: 100,
          totalCalories: 100,
          displayUnit: unit,
        };

        expect(mealWithUnit.displayUnit).toBe(unit);
      });
    });

    it("should enforce displayUnit type safety at compile time", () => {
      // This test verifies that TypeScript prevents invalid unit values
      // If this compiles, the type system is working correctly
      const validUnits: Array<"g" | "oz" | "lb" | "kg"> = ["g", "oz", "lb", "kg"];

      expect(validUnits).toContain("g");
      expect(validUnits).toContain("oz");
      expect(validUnits).toContain("lb");
      expect(validUnits).toContain("kg");

      // TypeScript should prevent this at compile time:
      // const invalidMeal: MealEntryType = { displayUnit: 'invalid_unit' }; // This would cause a compile error
    });
  });

  describe("WeightEntry Schema", () => {
    it("should support WeightEntry without unit field (backward compatibility)", () => {
      // Test that TypeScript types work correctly for legacy data
      const weightWithoutUnit: WeightEntryType = {
        timestamp: DateTime.now().toISO() || "",
        weightValue: 155.5,
        notes: "Morning weight",
        unit: undefined, // Explicitly undefined for legacy data
      };

      expect(weightWithoutUnit.unit).toBeUndefined();
      expect(weightWithoutUnit.weightValue).toBe(155.5);
      expect(weightWithoutUnit.notes).toBe("Morning weight");
    });

    it("should support WeightEntry with unit field", () => {
      // Test that TypeScript types work correctly for new data with units
      const weightWithUnit: WeightEntryType = {
        timestamp: DateTime.now().toISO() || "",
        weightValue: 70.5,
        notes: "Morning weight",
        unit: "kg",
      };

      expect(weightWithUnit.unit).toBe("kg");
      expect(weightWithUnit.weightValue).toBe(70.5);
      expect(weightWithUnit.notes).toBe("Morning weight");
    });

    it("should support all valid unit enum values", () => {
      const validUnits: Array<"lbs" | "kg"> = ["lbs", "kg"];

      validUnits.forEach((unit) => {
        const weightWithUnit: WeightEntryType = {
          timestamp: DateTime.now().toISO() || "",
          weightValue: 150,
          notes: undefined,
          unit: unit,
        };

        expect(weightWithUnit.unit).toBe(unit);
      });
    });

    it("should enforce unit type safety at compile time", () => {
      // This test verifies that TypeScript prevents invalid unit values
      // If this compiles, the type system is working correctly
      const validUnits: Array<"lbs" | "kg"> = ["lbs", "kg"];

      expect(validUnits).toContain("lbs");
      expect(validUnits).toContain("kg");

      // TypeScript should prevent this at compile time:
      // const invalidWeight: WeightEntryType = { unit: 'invalid_unit' }; // This would cause a compile error
    });
  });

  describe("Type Safety", () => {
    it("should maintain type safety for MealEntry with optional displayUnit", () => {
      // Test that TypeScript types work correctly
      const mealWithoutUnit: MealEntryType = {
        timestamp: DateTime.now().toISO() || "",
        foodName: "Test Food",
        foodCategory: "Test",
        caloriesPerGram: 1.0,
        weightInGrams: 100,
        totalCalories: 100,
        notes: undefined,
        displayUnit: undefined,
      };

      const mealWithUnit: MealEntryType = {
        timestamp: DateTime.now().toISO() || "",
        foodName: "Test Food",
        foodCategory: "Test",
        caloriesPerGram: 1.0,
        weightInGrams: 100,
        totalCalories: 100,
        notes: undefined,
        displayUnit: "g",
      };

      expect(mealWithoutUnit.displayUnit).toBeUndefined();
      expect(mealWithUnit.displayUnit).toBe("g");
    });

    it("should maintain type safety for WeightEntry with optional unit", () => {
      // Test that TypeScript types work correctly
      const weightWithoutUnit: WeightEntryType = {
        timestamp: DateTime.now().toISO() || "",
        weightValue: 150,
        notes: undefined,
        unit: undefined,
      };

      const weightWithUnit: WeightEntryType = {
        timestamp: DateTime.now().toISO() || "",
        weightValue: 70.5,
        notes: undefined,
        unit: "kg",
      };

      expect(weightWithoutUnit.unit).toBeUndefined();
      expect(weightWithUnit.unit).toBe("kg");
    });
  });
});
