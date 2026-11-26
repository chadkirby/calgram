import { type CoList, type Loaded } from "jazz-classic";
import { DateTime } from "luxon";
import { FoodIntelligence, FoodMetadata, MealEntry } from "../schema";

/**
 * Classic adapter for the stored `root.foodIntelligence`, kept only so the Classic
 * MealEntryForm behaves as it does today. Jazz 2 derives suggestions from meals instead
 * (`deriveFoodIntelligence` in ./foodIntelligence); delete this with Classic.
 */
export class FoodIntelligenceManager {
  /**
   * Update food intelligence data after a meal entry is logged
   * @param intelligence - The food intelligence CoMap
   * @param meal - The meal entry that was just logged
   */
  static updateFoodData(
    intelligence: Loaded<typeof FoodIntelligence>,
    meal: Loaded<typeof MealEntry>,
  ): void {
    const { foodName, foodCategory, caloriesPerGram } = meal;

    // Update recent foods list (keep last 12)
    if (intelligence.recentFoods) {
      this.updateRecentList(intelligence.recentFoods, foodName, 12);
    }

    // Update recent categories list (keep last 12)
    if (intelligence.recentCategories) {
      this.updateRecentList(intelligence.recentCategories, foodCategory, 12);
    }

    // Update food metadata
    if (intelligence.foodData) {
      const existingMetadata = intelligence.foodData[foodName];
      if (existingMetadata) {
        // Update existing food data
        existingMetadata.lastUsedCPG = caloriesPerGram;
        existingMetadata.lastUsedCategory = foodCategory;
        existingMetadata.usageCount = existingMetadata.usageCount + 1;
        existingMetadata.lastUsed = DateTime.now().toISO() || "";
      } else {
        // Create new food metadata
        try {
          const newMetadata = FoodMetadata.create(
            {
              lastUsedCPG: caloriesPerGram,
              lastUsedCategory: foodCategory,
              usageCount: 1,
              lastUsed: DateTime.now().toISO() || "",
            },
            intelligence._owner,
          );

          intelligence.foodData[foodName] = newMetadata;
        } catch {
          // Fallback for testing - create a plain object with the same structure
          intelligence.foodData[foodName] = {
            lastUsedCPG: caloriesPerGram,
            lastUsedCategory: foodCategory,
            usageCount: 1,
            lastUsed: DateTime.now().toISO() || "",
          } as any;
        }
      }
    }
  }

  /**
   * Get the 12 most recent food names
   * @param intelligence - The food intelligence CoMap
   * @returns Array of recent food names (up to 12)
   */
  static getRecentFoods(intelligence: Loaded<typeof FoodIntelligence> | undefined): string[] {
    if (!intelligence?.recentFoods) {
      return [];
    }

    // Return a copy of the recent foods array (reversed to show most recent first)
    return [...intelligence.recentFoods].toReversed();
  }

  /**
   * Get the most recent food categories
   * @param intelligence - The food intelligence CoMap
   * @returns Array of recent category names (up to 12)
   */
  static getRecentCategories(intelligence: Loaded<typeof FoodIntelligence> | undefined): string[] {
    if (!intelligence?.recentCategories) {
      return [];
    }

    // Return a copy of the recent categories array (reversed to show most recent first)
    return [...intelligence.recentCategories].toReversed();
  }

  /**
   * Helper method to update a recent list (foods or categories)
   * @param list - The CoList to update
   * @param item - The item to add
   * @param maxLength - Maximum length of the list
   */
  private static updateRecentList(list: CoList<string>, item: string, maxLength: number): void {
    // Remove the item if it already exists
    const existingIndex = list.findIndex((existing) => existing === item);
    if (existingIndex !== -1) {
      list.splice(existingIndex, 1);
    }

    // Add the item to the end
    list.push(item);

    // Keep only the last maxLength items
    while (list.length > maxLength) {
      list.shift();
    }
  }
}
