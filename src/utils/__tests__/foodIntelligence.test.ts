import { describe, it, expect } from "vitest";
import { deriveFoodIntelligence } from "../foodIntelligence";
import type { MealRow } from "../../schema";

const meal = (foodName: string, timestamp: string, overrides: Partial<MealRow> = {}): MealRow => ({
  timestamp,
  foodName,
  foodCategory: "Snack",
  caloriesPerGram: 1,
  weightInGrams: 100,
  totalCalories: 100,
  ...overrides,
});

describe("deriveFoodIntelligence", () => {
  it("counts every use of a food and keeps the latest meal's calories per gram and category", () => {
    const result = deriveFoodIntelligence([
      // Deliberately out of order: the latest meal by timestamp wins, not the last in the list.
      meal("Apple", "2025-07-27T08:00:00.000-07:00", {
        caloriesPerGram: 0.6,
        foodCategory: "Breakfast",
      }),
      meal("Apple", "2025-07-25T08:00:00.000-07:00", {
        caloriesPerGram: 0.5,
        foodCategory: "Fruit",
      }),
      meal("Apple", "2025-07-26T08:00:00.000-07:00", {
        caloriesPerGram: 0.4,
        foodCategory: "Fruit",
      }),
    ]);

    expect(result.foodData.Apple).toEqual({
      lastUsedCPG: 0.6,
      lastUsedCategory: "Breakfast",
      usageCount: 3,
      lastUsed: "2025-07-27T08:00:00.000-07:00",
    });
  });

  it("orders by the parsed instant, not the timestamp text", () => {
    // 01:00 at -07:00 is 08:00Z, later than 07:00Z.
    const result = deriveFoodIntelligence([
      meal("Late", "2025-07-27T01:00:00.000-07:00"),
      meal("Early", "2025-07-27T07:00:00.000Z"),
    ]);
    expect(result.recentFoods).toEqual(["Late", "Early"]);
  });

  it("drops a food from recents once its only meal is deleted", () => {
    const meals = [
      meal("Apple", "2025-07-26T08:00:00.000-07:00"),
      meal("Pizza", "2025-07-27T19:00:00.000-07:00", { foodCategory: "Dinner" }),
    ];
    expect(deriveFoodIntelligence(meals).recentFoods).toContain("Pizza");

    const afterDelete = deriveFoodIntelligence(meals.filter((m) => m.foodName !== "Pizza"));
    expect(afterDelete.recentFoods).toEqual(["Apple"]);
    expect(afterDelete.recentCategories).toEqual(["Snack"]);
    expect(afterDelete.foodData.Pizza).toBeUndefined();
  });

  it("keeps the 12 most recent distinct foods, newest first", () => {
    const meals = Array.from({ length: 15 }, (_, i) =>
      meal(`Food ${i}`, `2025-07-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`, {
        foodCategory: `Category ${i}`,
      }),
    );
    // A repeat of an old food makes it the newest.
    meals.push(meal("Food 0", "2025-07-20T12:00:00.000Z", { foodCategory: "Category 0" }));

    const result = deriveFoodIntelligence(meals);
    expect(result.recentFoods).toEqual([
      "Food 0",
      "Food 14",
      "Food 13",
      "Food 12",
      "Food 11",
      "Food 10",
      "Food 9",
      "Food 8",
      "Food 7",
      "Food 6",
      "Food 5",
      "Food 4",
    ]);
    expect(result.recentCategories).toHaveLength(12);
    expect(result.recentCategories[0]).toBe("Category 0");
  });

  it("returns empty data for no meals", () => {
    expect(deriveFoodIntelligence([])).toEqual({
      recentFoods: [],
      recentCategories: [],
      foodData: {},
    });
  });
});
