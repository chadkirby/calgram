import { describe, it, expect } from 'vitest';
import { DataImporter } from "../DataImporter";

describe("DataImporter", () => {
  describe("detectDataFormat", () => {
    it("should detect legacy format", () => {
      const legacyData = {
        meal_entries: [],
        weight_entries: []
      };

      expect(DataImporter.detectDataFormat(legacyData)).toBe("legacy");
    });

    it("should detect current format", () => {
      const currentData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: []
      };

      expect(DataImporter.detectDataFormat(currentData)).toBe("current");
    });

    it("should return unknown for invalid format", () => {
      const invalidData = {
        some: "random",
        data: "structure"
      };

      expect(DataImporter.detectDataFormat(invalidData)).toBe("unknown");
    });

    it("should return unknown for non-object data", () => {
      expect(DataImporter.detectDataFormat(null)).toBe("unknown");
      expect(DataImporter.detectDataFormat(undefined)).toBe("unknown");
      expect(DataImporter.detectDataFormat("string")).toBe("unknown");
      expect(DataImporter.detectDataFormat(123)).toBe("unknown");
    });
  });

  describe("validateImportData", () => {
    it("should validate legacy format correctly", () => {
      const legacyData = {
        meal_entries: [],
        weight_entries: []
      };

      const result = DataImporter.validateImportData(legacyData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate current format correctly", () => {
      const currentData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: []
      };

      const result = DataImporter.validateImportData(currentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject invalid legacy format", () => {
      const invalidLegacyData = {
        meal_entries: "not an array",
        weight_entries: []
      };

      const result = DataImporter.validateImportData(invalidLegacyData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("meal_entries must be an array");
    });

    it("should reject invalid current format", () => {
      const invalidCurrentData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: "not an array",
        weightEntries: []
      };

      const result = DataImporter.validateImportData(invalidCurrentData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("mealEntries must be an array");
    });

    it("should reject non-object data", () => {
      const result = DataImporter.validateImportData("invalid");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid JSON structure");
    });
  });

  describe("parseJsonFile", () => {
    it("should parse valid JSON", () => {
      const jsonData = '{"test": "data"}';
      const result = DataImporter.parseJsonFile(jsonData);
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
