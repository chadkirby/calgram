import { describe, it, expect, beforeEach } from 'vitest';
import { FoodIntelligenceManager } from '../FoodIntelligenceManager';
import { co, type CoList } from 'jazz-tools';
import { FoodIntelligence, FoodMetadata, MealEntry } from '../../schema';

// Mock implementations for testing without full Jazz context
const createMockList = (items: string[] = []): CoList<string> => {
  const list = [...items] as any;
  list.push = (item: string) => {
    list[list.length] = item;
    return list.length;
  };
  list.splice = (start: number, deleteCount: number) => {
    return Array.prototype.splice.call(list, start, deleteCount);
  };
  list.shift = () => Array.prototype.shift.call(list);
  list.findIndex = (predicate: (item: string) => boolean) =>
    Array.prototype.findIndex.call(list, predicate);
  return list as CoList<string>;
};

const createMockRecord = (data: Record<string, co.loaded<typeof FoodMetadata>> = {}) => {
  return { ...data } as any;
};

// Helper function to create mock food intelligence
const createMockFoodIntelligence = () => {
  return {
    recentFoods: createMockList(),
    recentCategories: createMockList(),
    foodData: createMockRecord(),
    _owner: {} as any, // Mock owner for creating new metadata
  } as unknown as co.loaded<typeof FoodIntelligence>;
};

// Helper function to create mock meal entry
const createMockMealEntry = (
  foodName: string,
  foodCategory: string,
  caloriesPerGram: number,
  weightInGrams: number = 100
) => {
  return {
    timestamp: new Date(),
    foodName,
    foodCategory,
    caloriesPerGram,
    weightInGrams,
    notes: '',
    totalCalories: weightInGrams * caloriesPerGram,
  } as co.loaded<typeof MealEntry>;
};

describe('FoodIntelligenceManager', () => {
  let intelligence: co.loaded<typeof FoodIntelligence>;

  beforeEach(() => {
    intelligence = createMockFoodIntelligence();
  });

  describe('updateFoodData', () => {
    it('should add new food data when food is logged for the first time', () => {
      const meal = createMockMealEntry('Apple', 'Fruit', 0.52);

      FoodIntelligenceManager.updateFoodData(intelligence, meal);

      // Check recent foods
      expect(intelligence.recentFoods).toHaveLength(1);
      expect(intelligence.recentFoods?.[0]).toBe('Apple');

      // Check recent categories
      expect(intelligence.recentCategories).toHaveLength(1);
      expect(intelligence.recentCategories?.[0]).toBe('Fruit');

      // Check food data
      expect(intelligence.foodData?.['Apple']).toBeDefined();
      expect(intelligence.foodData?.['Apple']?.lastUsedCPG).toBe(0.52);
      expect(intelligence.foodData?.['Apple']?.lastUsedCategory).toBe('Fruit');
      expect(intelligence.foodData?.['Apple']?.usageCount).toBe(1);
    });

    it('should update existing food data when food is logged again', () => {
      // First meal
      const meal1 = createMockMealEntry('Apple', 'Fruit', 0.52);
      FoodIntelligenceManager.updateFoodData(intelligence, meal1);

      // Second meal with different CPG and category
      const meal2 = createMockMealEntry('Apple', 'Snack', 0.60);
      FoodIntelligenceManager.updateFoodData(intelligence, meal2);

      // Check that data was updated
      expect(intelligence.foodData?.['Apple']?.lastUsedCPG).toBe(0.60);
      expect(intelligence.foodData?.['Apple']?.lastUsedCategory).toBe('Snack');
      expect(intelligence.foodData?.['Apple']?.usageCount).toBe(2);

      // Check that recent lists don't have duplicates
      expect(intelligence.recentFoods).toHaveLength(1);
      expect(intelligence.recentCategories).toHaveLength(2); // Fruit and Snack
    });

    it('should maintain recent foods list with maximum of 12 items', () => {
      // Add 15 different foods
      for (let i = 1; i <= 15; i++) {
        const meal = createMockMealEntry(`Food${i}`, 'Category', 1.0);
        FoodIntelligenceManager.updateFoodData(intelligence, meal);
      }

      // Should only keep the last 12
      expect(intelligence.recentFoods).toHaveLength(12);
      expect(intelligence.recentFoods?.[0]).toBe('Food4'); // First item should be Food4
      expect(intelligence.recentFoods?.[11]).toBe('Food15'); // Last item should be Food15
    });

    it('should maintain recent categories list with maximum of 12 items', () => {
      // Add 15 different categories
      for (let i = 1; i <= 15; i++) {
        const meal = createMockMealEntry('Food', `Category${i}`, 1.0);
        FoodIntelligenceManager.updateFoodData(intelligence, meal);
      }

      // Should only keep the last 12
      expect(intelligence.recentCategories).toHaveLength(12);
      expect(intelligence.recentCategories?.[0]).toBe('Category4');
      expect(intelligence.recentCategories?.[11]).toBe('Category15');
    });

    it('should move existing items to end of recent lists', () => {
      // Add initial foods
      const meal1 = createMockMealEntry('Apple', 'Fruit', 0.52);
      const meal2 = createMockMealEntry('Banana', 'Fruit', 0.89);
      const meal3 = createMockMealEntry('Chicken', 'Protein', 2.39);

      FoodIntelligenceManager.updateFoodData(intelligence, meal1);
      FoodIntelligenceManager.updateFoodData(intelligence, meal2);
      FoodIntelligenceManager.updateFoodData(intelligence, meal3);

      // Log Apple again
      FoodIntelligenceManager.updateFoodData(intelligence, meal1);

      // Apple should now be at the end, check the length and last item
      expect(intelligence.recentFoods?.length).toBe(3);
      expect(intelligence.recentFoods?.[intelligence.recentFoods.length - 1]).toBe('Apple');

      // Check that categories were updated properly - Fruit should be moved to end
      expect(intelligence.recentCategories?.length).toBe(2); // Protein and Fruit (Fruit was moved to end)
    });
  });

  describe('getRecentFoods', () => {
    it('should return empty array for undefined intelligence', () => {
      const result = FoodIntelligenceManager.getRecentFoods(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty recent foods', () => {
      const result = FoodIntelligenceManager.getRecentFoods(intelligence);
      expect(result).toEqual([]);
    });

    it('should return recent foods in reverse order (most recent first)', () => {
      // Add some foods directly to the list
      intelligence.recentFoods?.push('Apple');
      intelligence.recentFoods?.push('Banana');
      intelligence.recentFoods?.push('Chicken');

      const result = FoodIntelligenceManager.getRecentFoods(intelligence);
      expect(result).toEqual(['Chicken', 'Banana', 'Apple']);
    });
  });

  describe('getRecentCategories', () => {
    it('should return empty array for undefined intelligence', () => {
      const result = FoodIntelligenceManager.getRecentCategories(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty recent categories', () => {
      const result = FoodIntelligenceManager.getRecentCategories(intelligence);
      expect(result).toEqual([]);
    });

    it('should return recent categories in reverse order (most recent first)', () => {
      // Add some categories directly to the list
      intelligence.recentCategories?.push('Fruit');
      intelligence.recentCategories?.push('Protein');
      intelligence.recentCategories?.push('Grain');

      const result = FoodIntelligenceManager.getRecentCategories(intelligence);
      expect(result).toEqual(['Grain', 'Protein', 'Fruit']);
    });
  });

  describe('getFoodSuggestions', () => {
    it('should return null for undefined intelligence', () => {
      const result = FoodIntelligenceManager.getFoodSuggestions(undefined, 'Apple');
      expect(result).toBeNull();
    });

    it('should return null for empty food name', () => {
      const result = FoodIntelligenceManager.getFoodSuggestions(intelligence, '');
      expect(result).toBeNull();

      const result2 = FoodIntelligenceManager.getFoodSuggestions(intelligence, '   ');
      expect(result2).toBeNull();
    });

    it('should return null for unknown food', () => {
      const result = FoodIntelligenceManager.getFoodSuggestions(intelligence, 'UnknownFood');
      expect(result).toBeNull();
    });

    it('should return suggestions for known food', () => {
      // Add food data
      const meal = createMockMealEntry('Apple', 'Fruit', 0.52);
      FoodIntelligenceManager.updateFoodData(intelligence, meal);

      const result = FoodIntelligenceManager.getFoodSuggestions(intelligence, 'Apple');
      expect(result).toEqual({
        caloriesPerGram: 0.52,
        category: 'Fruit',
      });
    });

    it('should handle food names with whitespace', () => {
      const meal = createMockMealEntry('Apple', 'Fruit', 0.52);
      FoodIntelligenceManager.updateFoodData(intelligence, meal);

      const result = FoodIntelligenceManager.getFoodSuggestions(intelligence, '  Apple  ');
      expect(result).toEqual({
        caloriesPerGram: 0.52,
        category: 'Fruit',
      });
    });
  });

  describe('getAllFoodsSortedByRelevance', () => {
    it('should return empty array for undefined intelligence', () => {
      const result = FoodIntelligenceManager.getAllFoodsSortedByRelevance(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty food data', () => {
      const result = FoodIntelligenceManager.getAllFoodsSortedByRelevance(intelligence);
      expect(result).toEqual([]);
    });

    it('should sort foods by usage count (descending)', () => {
      // Add foods with different usage counts
      const apple = createMockMealEntry('Apple', 'Fruit', 0.52);
      const banana = createMockMealEntry('Banana', 'Fruit', 0.89);
      const chicken = createMockMealEntry('Chicken', 'Protein', 2.39);

      // Apple: 3 times, Banana: 1 time, Chicken: 2 times
      FoodIntelligenceManager.updateFoodData(intelligence, apple);
      FoodIntelligenceManager.updateFoodData(intelligence, apple);
      FoodIntelligenceManager.updateFoodData(intelligence, apple);
      FoodIntelligenceManager.updateFoodData(intelligence, banana);
      FoodIntelligenceManager.updateFoodData(intelligence, chicken);
      FoodIntelligenceManager.updateFoodData(intelligence, chicken);

      const result = FoodIntelligenceManager.getAllFoodsSortedByRelevance(intelligence);
      expect(result).toEqual(['Apple', 'Chicken', 'Banana']);
    });

    it('should sort by last used date when usage counts are equal', async () => {
      const apple = createMockMealEntry('Apple', 'Fruit', 0.52);

      // Add apple first
      FoodIntelligenceManager.updateFoodData(intelligence, apple);

      // Wait a bit and add banana
      await new Promise(resolve => setTimeout(resolve, 10));
      const banana = createMockMealEntry('Banana', 'Fruit', 0.89);
      FoodIntelligenceManager.updateFoodData(intelligence, banana);

      const result = FoodIntelligenceManager.getAllFoodsSortedByRelevance(intelligence);
      // Banana should come first as it was used more recently
      expect(result[0]).toBe('Banana');
      expect(result[1]).toBe('Apple');
    });
  });

  describe('searchFoods', () => {
    beforeEach(() => {
      // Set up some test data
      const foods = [
        { name: 'Apple', category: 'Fruit', cpg: 0.52 },
        { name: 'Green Apple', category: 'Fruit', cpg: 0.50 },
        { name: 'Apple Pie', category: 'Dessert', cpg: 2.37 },
        { name: 'Banana', category: 'Fruit', cpg: 0.89 },
        { name: 'Chicken Breast', category: 'Protein', cpg: 1.65 },
      ];

      foods.forEach(food => {
        const meal = createMockMealEntry(food.name, food.category, food.cpg);
        FoodIntelligenceManager.updateFoodData(intelligence, meal);
      });
    });

    it('should return recent foods for empty query', () => {
      const result = FoodIntelligenceManager.searchFoods(intelligence, '');
      expect(result).toEqual(FoodIntelligenceManager.getRecentFoods(intelligence));
    });

    it('should return recent foods for whitespace query', () => {
      const result = FoodIntelligenceManager.searchFoods(intelligence, '   ');
      expect(result).toEqual(FoodIntelligenceManager.getRecentFoods(intelligence));
    });

    it('should return foods matching the search query', () => {
      const result = FoodIntelligenceManager.searchFoods(intelligence, 'apple');
      expect(result).toHaveLength(3);
      expect(result).toContain('Apple');
      expect(result).toContain('Green Apple');
      expect(result).toContain('Apple Pie');
    });

    it('should be case insensitive', () => {
      const result = FoodIntelligenceManager.searchFoods(intelligence, 'APPLE');
      expect(result).toHaveLength(3);
      expect(result).toContain('Apple');
      expect(result).toContain('Green Apple');
      expect(result).toContain('Apple Pie');
    });

    it('should limit results to 12 items', () => {
      // Add more foods to test the limit
      for (let i = 1; i <= 15; i++) {
        const meal = createMockMealEntry(`Test Food ${i}`, 'Test', 1.0);
        FoodIntelligenceManager.updateFoodData(intelligence, meal);
      }

      const result = FoodIntelligenceManager.searchFoods(intelligence, 'test');
      expect(result).toHaveLength(12);
    });

    it('should return foods sorted by relevance', () => {
      // Add Apple multiple times to increase its usage count
      const apple = createMockMealEntry('Apple', 'Fruit', 0.52);
      FoodIntelligenceManager.updateFoodData(intelligence, apple);
      FoodIntelligenceManager.updateFoodData(intelligence, apple);

      const result = FoodIntelligenceManager.searchFoods(intelligence, 'apple');
      // Apple should come first due to higher usage count
      expect(result[0]).toBe('Apple');
    });

    it('should return recent foods for undefined intelligence', () => {
      const result = FoodIntelligenceManager.searchFoods(undefined, 'apple');
      expect(result).toEqual([]);
    });
  });
});