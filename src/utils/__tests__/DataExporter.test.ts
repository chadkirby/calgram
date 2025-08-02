import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataExporter } from "../DataExporter";
import { type Loaded } from "jazz-tools";
import { JazzAccount } from "@/schema";

// Mock data for testing
const mockMealEntries = [
  {
    timestamp: "2023-01-01T12:00:00Z",
    foodName: "Apple",
    foodCategory: "Fruit",
    caloriesPerGram: 0.52,
    caloriesPerDisplayUnit: "g",
    weightInGrams: 100,
    displayUnit: "g",
    totalCalories: 52,
    notes: "Red apple",
  },
  {
    timestamp: "2023-01-01T13:00:00Z",
    foodName: "Banana",
    foodCategory: "Fruit",
    caloriesPerGram: 0.89,
    caloriesPerDisplayUnit: "g",
    weightInGrams: 120,
    displayUnit: "g",
    totalCalories: 106.8,
    notes: "Yellow banana",
  },
];

const mockWeightEntries = [
  {
    timestamp: "2023-01-01T08:00:00Z",
    weightValue: 70.5,
    unit: "kg",
    notes: "Morning weight",
  },
  {
    timestamp: "2023-01-02T08:00:00Z",
    weightValue: 70.2,
    unit: "kg",
    notes: "Morning weight",
  },
];

// Mock account data
const mockAccount = {
  root: {
    mealEntries: mockMealEntries,
    weightEntries: mockWeightEntries,
  },
} as unknown as Loaded<typeof JazzAccount>;

describe("DataExporter", () => {
  describe("exportUserData", () => {
    it("should export user data in the correct format", async () => {
      const result = await DataExporter.exportUserData(mockAccount);

      expect(result).toHaveProperty("version", "1.0");
      expect(result).toHaveProperty("exportDate");
      expect(result).toHaveProperty("mealEntries");
      expect(result).toHaveProperty("weightEntries");

      // Check meal entries
      expect(result.mealEntries).toHaveLength(2);
      expect(result.mealEntries[0]).toEqual({
        timestamp: "2023-01-01T12:00:00Z",
        foodName: "Apple",
        foodCategory: "Fruit",
        caloriesPerGram: 0.52,
        caloriesPerDisplayUnit: "g",
        weightInGrams: 100,
        displayUnit: "g",
        totalCalories: 52,
        notes: "Red apple",
      });

      // Check weight entries
      expect(result.weightEntries).toHaveLength(2);
      expect(result.weightEntries[0]).toEqual({
        timestamp: "2023-01-01T08:00:00Z",
        weightValue: 70.5,
        unit: "kg",
        notes: "Morning weight",
      });
    });

    it("should handle empty meal and weight entries", async () => {
      const emptyAccount = {
        root: {
          mealEntries: [],
          weightEntries: [],
        },
      } as unknown as Loaded<typeof JazzAccount>;

      const result = await DataExporter.exportUserData(emptyAccount);

      expect(result.mealEntries).toHaveLength(0);
      expect(result.weightEntries).toHaveLength(0);
    });

    it("should throw error when account root is not available", async () => {
      const accountWithoutRoot = {
        root: undefined,
      } as unknown as Loaded<typeof JazzAccount>;

      await expect(DataExporter.exportUserData(accountWithoutRoot))
        .rejects
        .toThrow("Account root not available");
    });
  });

  describe("createJsonBlob", () => {
    it("should create a JSON blob from export data", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      const blob = DataExporter.createJsonBlob(mockData);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });
  });

  describe("triggerDownload", () => {
    // Mock browser APIs
    const mockCreateElement = vi.fn().mockImplementation(() => {
      return {
        href: "",
        download: "",
        click: vi.fn(),
      };
    });

    const mockCreateObjectURL = vi.fn().mockReturnValue("mock-url");
    const mockRevokeObjectURL = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();

    beforeEach(() => {
      // Reset mocks
      mockCreateElement.mockClear();
      mockCreateObjectURL.mockClear();
      mockRevokeObjectURL.mockClear();
      mockAppendChild.mockClear();
      mockRemoveChild.mockClear();

      // Mock document and URL
      global.document.createElement = mockCreateElement;
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.body methods (without directly setting document.body)
      if (global.document.body) {
        global.document.body.appendChild = mockAppendChild;
        global.document.body.removeChild = mockRemoveChild;
        global.document.body.contains = vi.fn().mockReturnValue(true);
      }
    });

    it("should create and click a download link", () => {
      const blob = new Blob(["test"], { type: "application/json" });

      DataExporter.triggerDownload(blob, "test-file.json");

      // Check that createElement was called
      expect(mockCreateElement).toHaveBeenCalledWith("a");

      // Check that the link was appended to body
      expect(mockAppendChild).toHaveBeenCalled();

      // Check that the link was clicked
      expect(mockCreateElement.mock.results[0].value.click).toHaveBeenCalled();
    });

    it("should handle errors during file download", () => {
      // Mock error in createElement
      global.document.createElement = vi.fn().mockImplementation(() => {
        throw new Error("DOM error");
      });

      const blob = new Blob(["test"], { type: "application/json" });

      expect(() => {
        DataExporter.triggerDownload(blob, "test-file.json");
      }).toThrow("Failed to trigger download");
    });
  });

  describe("downloadJsonFile", () => {
    it("should create and download JSON file", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      // Mock the triggerDownload method to avoid DOM issues
      const triggerDownloadSpy = vi.spyOn(DataExporter, "triggerDownload").mockImplementation(() => {});

      DataExporter.downloadJsonFile(mockData, "test-file.json");

      // Check that triggerDownload was called with correct parameters
      expect(triggerDownloadSpy).toHaveBeenCalled();

      // Restore the original method
      triggerDownloadSpy.mockRestore();
    });

    it("should handle errors during file download", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      // Mock error in triggerDownload
      const triggerDownloadSpy = vi.spyOn(DataExporter, "triggerDownload").mockImplementation(() => {
        throw new Error("Download error");
      });

      expect(() => {
        DataExporter.downloadJsonFile(mockData, "test-file.json");
      }).toThrow("Failed to generate download file");

      // Restore the original method
      triggerDownloadSpy.mockRestore();
    });
  });
});


