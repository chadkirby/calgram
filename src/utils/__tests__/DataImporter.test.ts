import { describe, it, expect } from 'vitest';
import { DataImporter, type ExportedData } from "../DataImporter";

describe("DataImporter (current format only, strict)", () => {
  describe("validateImportData", () => {
    it("should validate current format correctly", () => {
      const currentData: ExportedData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00.000Z",
        mealEntries: [],
        weightEntries: [],
      };

      const result = DataImporter.validateImportData(currentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject unknown keys at root (strict)", () => {
      const withUnknown = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00.000Z",
        mealEntries: [],
        weightEntries: [],
        extra: "nope",
      };

      const result = DataImporter.validateImportData(withUnknown);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("Unrecognized key(s) in object"))).toBe(true);
    });

    it("should reject unknown keys in mealEntries items (strict)", () => {
      const withUnknownMeal = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00.000Z",
        mealEntries: [
          {
            timestamp: "2023-01-01T12:00:00.000Z",
            foodName: "Apple",
            foodCategory: "Fruit",
            caloriesPerGram: 0.52,
            weightInGrams: 100,
            totalCalories: 52,
            extra: "nope",
          },
        ],
        weightEntries: [],
      };

      const result = DataImporter.validateImportData(withUnknownMeal);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("mealEntries") && e.includes("Unrecognized key(s) in object"))).toBe(true);
    });

    it("should reject invalid ISO date", () => {
      const invalidDate = {
        version: "1.0",
        exportDate: "not-a-date",
        mealEntries: [],
        weightEntries: [],
      };

      const result = DataImporter.validateImportData(invalidDate);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("exportDate") && e.includes("Invalid ISO date"))).toBe(true);
    });

    it("should reject non-object data", () => {
      const result = DataImporter.validateImportData("invalid");
      expect(result.isValid).toBe(false);
    });
  });

  describe("parseJsonFile", () => {
    it("should parse valid JSON", () => {
      const jsonData = '{"test": "data"}';
      const result = DataImporter.parseJsonFile(jsonData as unknown as string);
      expect(result).toEqual({ test: "data" });
    });

    it("should throw error for invalid JSON", () => {
      const invalidJson = '{"test": "data"';
      expect(() => DataImporter.parseJsonFile(invalidJson)).toThrow("Failed to parse JSON file");
    });

    it("should throw error for non-object JSON", () => {
      const jsonString = '"just a string"';
      expect(() => DataImporter.parseJsonFile(jsonString)).toThrow("Invalid JSON structure");
    });
  });
});
