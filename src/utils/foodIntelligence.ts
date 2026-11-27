import { DateTime } from "luxon";
import type { MealRow } from "../schema";

/** What the meal form knows about one food name, from the meals logged with it. */
export interface FoodMetadataRow {
  lastUsedCPG: number;
  lastUsedCategory: string;
  usageCount: number;
  /** Timestamp of the latest meal with this food, verbatim. */
  lastUsed: string;
}

/**
 * Food suggestions for the meal form, derived from the meals at read time.
 */
export interface FoodIntelligenceData {
  /** Up to 12 distinct food names, newest first. */
  recentFoods: string[];
  /** Up to 12 distinct categories, newest first. */
  recentCategories: string[];
  /** Keyed by exact food name. */
  foodData: Record<string, FoodMetadataRow>;
}

const RECENT_LIMIT = 12;

type FoodMeal = Pick<MealRow, "timestamp" | "foodName" | "foodCategory" | "caloriesPerGram">;

/**
 * Derive food suggestions from the meals themselves, so deletes and edits are
 * always reflected. Meals are ordered by their parsed instant; on a tie the one
 * later in the input counts as newer.
 */
export function deriveFoodIntelligence(meals: readonly FoodMeal[]): FoodIntelligenceData {
  const newestFirst = meals
    .map((meal, index) => ({ meal, index, ms: DateTime.fromISO(meal.timestamp).toMillis() }))
    .toSorted((a, b) => b.ms - a.ms || b.index - a.index)
    .map(({ meal }) => meal);

  const recentFoods = new Set<string>();
  const recentCategories = new Set<string>();
  // A Map, so food names like "constructor" don't collide with object prototype keys.
  const foodData = new Map<string, FoodMetadataRow>();

  for (const meal of newestFirst) {
    if (recentFoods.size < RECENT_LIMIT) recentFoods.add(meal.foodName);
    if (recentCategories.size < RECENT_LIMIT) recentCategories.add(meal.foodCategory);

    const existing = foodData.get(meal.foodName);
    if (existing) {
      existing.usageCount += 1;
    } else {
      foodData.set(meal.foodName, {
        lastUsedCPG: meal.caloriesPerGram,
        lastUsedCategory: meal.foodCategory,
        usageCount: 1,
        lastUsed: meal.timestamp,
      });
    }
  }

  return {
    recentFoods: [...recentFoods],
    recentCategories: [...recentCategories],
    foodData: Object.fromEntries(foodData),
  };
}
