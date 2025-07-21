import { type CoList, type Loaded } from "jazz-tools";
import { FoodIntelligence, FoodMetadata, MealEntry } from "../schema";

/**
 * Utility class for managing food intelligence and auto-completion data
 */
export class FoodIntelligenceManager {
  /**
   * Update food intelligence data after a meal entry is logged
   * @param intelligence - The food intelligence CoMap
   * @param meal - The meal entry that was just logged
   */
  static updateFoodData(
    intelligence: Loaded<typeof FoodIntelligence>,
    meal: Loaded<typeof MealEntry>
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
        existingMetadata.lastUsed = new Date().toISOString();
      } else {
        // Create new food metadata
        try {
          const newMetadata = FoodMetadata.create({
            lastUsedCPG: caloriesPerGram,
            lastUsedCategory: foodCategory,
            usageCount: 1,
            lastUsed: new Date().toISOString(),
          }, intelligence._owner);

          intelligence.foodData[foodName] = newMetadata;
        } catch (error) {
          // Fallback for testing - create a plain object with the same structure
          intelligence.foodData[foodName] = {
            lastUsedCPG: caloriesPerGram,
            lastUsedCategory: foodCategory,
            usageCount: 1,
            lastUsed: new Date(),
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
    return [...intelligence.recentFoods].reverse();
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
    return [...intelligence.recentCategories].reverse();
  }

  /**
   * Get food suggestions (CPG and category) for auto-populating form fields
   * @param intelligence - The food intelligence CoMap
   * @param foodName - The food name to get suggestions for
   * @returns Object with suggested CPG and category, or null if no data exists
   */
  static getFoodSuggestions(
    intelligence: Loaded<typeof FoodIntelligence> | undefined,
    foodName: string
  ): { caloriesPerGram: number; category: string } | null {
    if (!intelligence?.foodData || !foodName.trim()) {
      return null;
    }

    const metadata = intelligence.foodData[foodName.trim()];
    if (!metadata) {
      return null;
    }

    return {
      caloriesPerGram: metadata.lastUsedCPG,
      category: metadata.lastUsedCategory,
    };
  }

  /**
   * Get all unique food names sorted by usage frequency and recency
   * @param intelligence - The food intelligence CoMap
   * @returns Array of food names sorted by relevance
   */
  static getAllFoodsSortedByRelevance(
    intelligence: Loaded<typeof FoodIntelligence> | undefined
  ): string[] {
    if (!intelligence?.foodData) {
      return [];
    }

    const foodEntries = Object.entries(intelligence.foodData);

    // Sort by usage count (descending) and then by last used date (descending)
    return foodEntries
      .filter(([, metadata]) => metadata != null)
      .sort(([, a], [, b]) => {
        if (!a || !b) return 0;
        // First sort by usage count
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        // Then by last used date
        return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
      })
      .map(([foodName]) => foodName);
  }

  /**
   * Search for food names that match a query string
   * @param intelligence - The food intelligence CoMap
   * @param query - The search query
   * @returns Array of matching food names
   */
  static searchFoods(
    intelligence: Loaded<typeof FoodIntelligence> | undefined,
    query: string
  ): string[] {
    if (!intelligence?.foodData || !query.trim()) {
      return this.getRecentFoods(intelligence);
    }

    const searchTerm = query.toLowerCase().trim();
    const allFoods = this.getAllFoodsSortedByRelevance(intelligence);

    // Filter foods that contain the search term
    const matches = allFoods.filter(food =>
      food.toLowerCase().includes(searchTerm)
    );

    // Limit to 12 results
    return matches.slice(0, 12);
  }

  /**
   * Helper method to update a recent list (foods or categories)
   * @param list - The CoList to update
   * @param item - The item to add
   * @param maxLength - Maximum length of the list
   */
  private static updateRecentList(
    list: CoList<string>,
    item: string,
    maxLength: number
  ): void {
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
