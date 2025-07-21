import { Group, type Loaded } from "jazz-tools";
import { MealEntry, WeightEntry, FoodIntelligence, FoodMetadata } from "../schema";
import type { JazzAccount } from "../schema";

// Types for the exported data format
interface ExportedMealEntry {
  id: number;
  food: string;
  weight: number;
  calories_per_gram: number;
  total_calories: number;
  category: string;
  date: string;
}

interface ExportedWeightEntry {
  id: number;
  weight: number;
  date: string;
  notes: string | null;
}

interface ExportedData {
  meal_entries: ExportedMealEntry[];
  weight_entries: ExportedWeightEntry[];
}

export class DataImporter {
  /**
   * Import data from exported JSON file
   */
  static async importData(jsonData: ExportedData, account: Loaded<typeof JazzAccount>): Promise<{
    mealCount: number;
    weightCount: number;
  }> {
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

    // Import meal entries
    if (jsonData.meal_entries && Array.isArray(jsonData.meal_entries) && loadedAccount.root.mealEntries) {
      for (const exportedMeal of jsonData.meal_entries) {
        try {
          const mealEntry = MealEntry.create({
            timestamp: new Date(exportedMeal.date).toISOString(),
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
        }
      }
    }

    // Import weight entries
    if (jsonData.weight_entries && Array.isArray(jsonData.weight_entries) && loadedAccount.root.weightEntries) {
      for (const exportedWeight of jsonData.weight_entries) {
        try {
          const weightEntry = WeightEntry.create({
            timestamp: new Date(exportedWeight.date).toISOString(),
            weightValue: exportedWeight.weight,
            notes: exportedWeight.notes || undefined,
          }, group);

          loadedAccount.root.weightEntries.push(weightEntry);
          weightCount++;
        } catch (error) {
          console.warn("Failed to import weight entry:", exportedWeight, error);
        }
      }
    }

    return { mealCount, weightCount };
  }

  /**
   * Update food intelligence with imported meal data
   */
  private static updateFoodIntelligence(
    foodIntelligence: Loaded<typeof FoodIntelligence>,
    meal: ExportedMealEntry
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
          existingMetadata.lastUsed = new Date(meal.date).toISOString();
        } else {
          // Create new metadata
          const group = Group.create();
          const metadata = FoodMetadata.create({
            lastUsedCPG: meal.calories_per_gram,
            lastUsedCategory: meal.category,
            usageCount: 1,
            lastUsed: new Date(meal.date).toISOString(),
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

      // Ensure arrays exist (even if empty)
      if (!Array.isArray(data.meal_entries)) {
        data.meal_entries = [];
      }

      if (!Array.isArray(data.weight_entries)) {
        data.weight_entries = [];
      }

      return data as ExportedData;
    } catch (error) {
      throw new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
