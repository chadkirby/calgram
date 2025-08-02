import { Group, type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { MealEntry, WeightEntry, FoodIntelligence, FoodMetadata } from "../schema";
import type { JazzAccount } from "../schema";

// Types for the legacy exported data format
interface LegacyExportedMealEntry {
  id: number;
  food: string;
  weight: number;
  calories_per_gram: number;
  total_calories: number;
  category: string;
  date: string;
}

interface LegacyExportedWeightEntry {
  id: number;
  weight: number;
  date: string;
  notes: string | null;
}

interface LegacyExportedData {
  meal_entries: LegacyExportedMealEntry[];
  weight_entries: LegacyExportedWeightEntry[];
}

// Types for the new exported data format
interface NewExportedMealEntry {
  timestamp: string;
  foodName: string;
  foodCategory: string;
  caloriesPerGram: number;
  caloriesPerDisplayUnit?: "g" | "oz" | "lb" | "kg";
  weightInGrams: number;
  displayUnit?: "g" | "oz" | "lb" | "kg";
  totalCalories: number;
  notes?: string;
}

interface NewExportedWeightEntry {
  timestamp: string;
  weightValue: number;
  unit?: "kg" | "lbs";
  notes?: string;
}

interface NewExportedData {
  version: string;
  exportDate: string;
  mealEntries: NewExportedMealEntry[];
  weightEntries: NewExportedWeightEntry[];
}

// Union type for both formats
type ExportedData = LegacyExportedData | NewExportedData;

// Result interface for import operations
interface ImportResult {
  mealCount: number;
  weightCount: number;
  duplicatesSkipped: number;
  errors: string[];
}

export class DataImporter {
  /**
   * Detect the format of the imported data
   */
  static detectDataFormat(jsonData: any): 'legacy' | 'current' | 'unknown' {
    // Check if jsonData is valid
    if (!jsonData || typeof jsonData !== 'object') {
      return 'unknown';
    }
    
    // Check for new format indicators
    if (jsonData.version && jsonData.exportDate && jsonData.mealEntries && jsonData.weightEntries) {
      return 'current';
    }

    // Check for legacy format indicators
    if (jsonData.meal_entries && jsonData.weight_entries) {
      return 'legacy';
    }

    return 'unknown';
  }

  /**
   * Validate the imported data structure
   */
  static validateImportData(jsonData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!jsonData || typeof jsonData !== 'object') {
      errors.push("Invalid JSON structure");
      return { isValid: false, errors };
    }

    const format = this.detectDataFormat(jsonData);

    switch (format) {
      case 'current':
        // Validate new format
        if (!Array.isArray((jsonData as NewExportedData).mealEntries)) {
          errors.push("mealEntries must be an array");
        }
        if (!Array.isArray((jsonData as NewExportedData).weightEntries)) {
          errors.push("weightEntries must be an array");
        }
        break;

      case 'legacy':
        // Validate legacy format
        if (!Array.isArray((jsonData as LegacyExportedData).meal_entries)) {
          errors.push("meal_entries must be an array");
        }
        if (!Array.isArray((jsonData as LegacyExportedData).weight_entries)) {
          errors.push("weight_entries must be an array");
        }
        break;

      default:
        errors.push("Unknown data format");
        break;
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Import data from exported JSON file (supports both legacy and new formats)
   */
  static async importData(jsonData: ExportedData, account: Loaded<typeof JazzAccount>): Promise<ImportResult> {
    if (!account.root) {
      throw new Error("Account root not available");
    }

    // Ensure the account root is loaded first
    const loadedAccount = await account.ensureLoaded({
      resolve: {
        root: {
          mealEntries: true,
          weightEntries: true,
          foodIntelligence: {
            recentFoods: true,
            recentCategories: true,
            foodData: true,
          },
        },
      },
    });

    if (!loadedAccount.root) {
      throw new Error("Failed to load account root");
    }

    if (!loadedAccount.root.mealEntries || !loadedAccount.root.weightEntries) {
      throw new Error("Account root does not have mealEntries or weightEntries");
    }

    const group = Group.create();
    let mealCount = 0;
    let weightCount = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];

    // Determine format and import accordingly
    const format = this.detectDataFormat(jsonData);

    switch (format) {
      case 'current':
        // Import new format data
        const newJsonData = jsonData as NewExportedData;

        // Import meal entries
        if (newJsonData.mealEntries && Array.isArray(newJsonData.mealEntries) && loadedAccount.root.mealEntries) {
          for (const exportedMeal of newJsonData.mealEntries) {
            try {
              const mealEntry = MealEntry.create({
                timestamp: exportedMeal.timestamp,
                foodName: exportedMeal.foodName,
                foodCategory: exportedMeal.foodCategory,
                caloriesPerGram: exportedMeal.caloriesPerGram,
                caloriesPerDisplayUnit: exportedMeal.caloriesPerDisplayUnit as "g" | "oz" | "lb" | "kg" | undefined,
                weightInGrams: exportedMeal.weightInGrams,
                displayUnit: exportedMeal.displayUnit as "g" | "oz" | "lb" | "kg" | undefined,
                notes: exportedMeal.notes,
                totalCalories: exportedMeal.totalCalories,
              }, group);

              loadedAccount.root.mealEntries.push(mealEntry);
              mealCount++;

              // Update food intelligence with imported data
              if (loadedAccount.root.foodIntelligence) {
                this.updateFoodIntelligenceNewFormat(loadedAccount.root.foodIntelligence, exportedMeal);
              }
            } catch (error) {
              console.warn("Failed to import meal entry:", exportedMeal, error);
              errors.push(`Failed to import meal entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }

        // Import weight entries
        if (newJsonData.weightEntries && Array.isArray(newJsonData.weightEntries) && loadedAccount.root.weightEntries) {
          for (const exportedWeight of newJsonData.weightEntries) {
            try {
              const weightEntry = WeightEntry.create({
                timestamp: exportedWeight.timestamp,
                weightValue: exportedWeight.weightValue,
                unit: exportedWeight.unit as "kg" | "lbs" | undefined,
                notes: exportedWeight.notes,
              }, group);

              loadedAccount.root.weightEntries.push(weightEntry);
              weightCount++;
            } catch (error) {
              console.warn("Failed to import weight entry:", exportedWeight, error);
              errors.push(`Failed to import weight entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
        break;

      case 'legacy':
        // Import legacy format data
        const legacyJsonData = jsonData as LegacyExportedData;

        // Import meal entries
        if (legacyJsonData.meal_entries && Array.isArray(legacyJsonData.meal_entries) && loadedAccount.root.mealEntries) {
          for (const exportedMeal of legacyJsonData.meal_entries) {
            try {
              const mealEntry = MealEntry.create({
                timestamp: DateTime.fromISO(exportedMeal.date).toISO() || exportedMeal.date,
                foodName: exportedMeal.food,
                foodCategory: exportedMeal.category,
                caloriesPerGram: exportedMeal.calories_per_gram,
                weightInGrams: exportedMeal.weight,
                totalCalories: exportedMeal.total_calories,
                notes: undefined, // Old format doesn't have notes
              }, group);

              loadedAccount.root.mealEntries.push(mealEntry);
              mealCount++;

              // Update food intelligence with imported data
              if (loadedAccount.root.foodIntelligence) {
                this.updateFoodIntelligence(loadedAccount.root.foodIntelligence, exportedMeal);
              }
            } catch (error) {
              console.warn("Failed to import meal entry:", exportedMeal, error);
              errors.push(`Failed to import meal entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }

        // Import weight entries
        if (legacyJsonData.weight_entries && Array.isArray(legacyJsonData.weight_entries) && loadedAccount.root.weightEntries) {
          for (const exportedWeight of legacyJsonData.weight_entries) {
            try {
              const weightEntry = WeightEntry.create({
                timestamp: DateTime.fromISO(exportedWeight.date).toISO() || exportedWeight.date,
                weightValue: exportedWeight.weight,
                notes: exportedWeight.notes || undefined,
              }, group);

              loadedAccount.root.weightEntries.push(weightEntry);
              weightCount++;
            } catch (error) {
              console.warn("Failed to import weight entry:", exportedWeight, error);
              errors.push(`Failed to import weight entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
        break;

      default:
        throw new Error("Unknown data format");
    }

    return { mealCount, weightCount, duplicatesSkipped, errors };
  }

  /**
   * Update food intelligence with imported meal data (new format)
   */
  private static updateFoodIntelligenceNewFormat(
    foodIntelligence: Loaded<typeof FoodIntelligence>,
    meal: NewExportedMealEntry
  ) {
    try {
      // Add to recent foods if not already present
      if (foodIntelligence.recentFoods && !foodIntelligence.recentFoods.includes(meal.foodName)) {
        foodIntelligence.recentFoods.push(meal.foodName);
      }

      // Add to recent categories if not already present
      if (foodIntelligence.recentCategories && !foodIntelligence.recentCategories.includes(meal.foodCategory)) {
        foodIntelligence.recentCategories.push(meal.foodCategory);
      }

      // Update or create food metadata
      if (foodIntelligence.foodData) {
        const existingMetadata = foodIntelligence.foodData[meal.foodName];
        if (existingMetadata) {
          // Update existing metadata
          existingMetadata.lastUsedCPG = meal.caloriesPerGram;
          existingMetadata.lastUsedCategory = meal.foodCategory;
          existingMetadata.usageCount = existingMetadata.usageCount + 1;
          existingMetadata.lastUsed = meal.timestamp;
        } else {
          // Create new metadata
          const group = Group.create();
          const metadata = FoodMetadata.create({
            lastUsedCPG: meal.caloriesPerGram,
            lastUsedCategory: meal.foodCategory,
            usageCount: 1,
            lastUsed: meal.timestamp,
          }, group);

          foodIntelligence.foodData[meal.foodName] = metadata;
        }
      }
    } catch (error) {
      console.warn("Failed to update food intelligence for:", meal.foodName, error);
    }
  }

  /**
   * Update food intelligence with imported meal data (legacy format)
   */
  private static updateFoodIntelligence(
    foodIntelligence: Loaded<typeof FoodIntelligence>,
    meal: LegacyExportedMealEntry
  ) {
    try {
      // Add to recent foods if not already present
      if (foodIntelligence.recentFoods && !foodIntelligence.recentFoods.includes(meal.food)) {
        foodIntelligence.recentFoods.push(meal.food);
      }

      // Add to recent categories if not already present
      if (foodIntelligence.recentCategories && !foodIntelligence.recentCategories.includes(meal.category)) {
        foodIntelligence.recentCategories.push(meal.category);
      }

      // Update or create food metadata
      if (foodIntelligence.foodData) {
        const existingMetadata = foodIntelligence.foodData[meal.food];
        if (existingMetadata) {
          // Update existing metadata
          existingMetadata.lastUsedCPG = meal.calories_per_gram;
          existingMetadata.lastUsedCategory = meal.category;
          existingMetadata.usageCount = existingMetadata.usageCount + 1;
          existingMetadata.lastUsed = DateTime.fromISO(meal.date).toISO() || meal.date;
        } else {
          // Create new metadata
          const group = Group.create();
          const metadata = FoodMetadata.create({
            lastUsedCPG: meal.calories_per_gram,
            lastUsedCategory: meal.category,
            usageCount: 1,
            lastUsed: DateTime.fromISO(meal.date).toISO() || meal.date,
          }, group);

          foodIntelligence.foodData[meal.food] = metadata;
        }
      }
    } catch (error) {
      console.warn("Failed to update food intelligence for:", meal.food, error);
    }
  }

  /**
   * Parse and validate JSON file content
   */
  static parseJsonFile(fileContent: string): ExportedData {
    try {
      const data = JSON.parse(fileContent);

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid JSON structure");
      }

      return data as ExportedData;
    } catch (error) {
      throw new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
