import { describe, it, expect } from "vitest";
import { DataExporter } from "../DataExporter";
import { DataImporter } from "../DataImporter";
import type { MealEntry, Profile, WeightEntry } from "../../../jazz/jazz.generated";

// Jazz 2 rows store an absent optional field as null, where the Classic rows
// used undefined. Exports must accept them and leave those fields out.
const meal: MealEntry = {
  id: "5f6b5b2e-3a3c-5b1e-9c4d-111111111111",
  timestamp: "2025-07-27T19:36:00.000-07:00",
  foodName: "Rice",
  foodCategory: "Dinner",
  caloriesPerGram: 1.3,
  caloriesPerDisplayUnit: null,
  weightInGrams: 200,
  displayUnit: null,
  totalCalories: 260,
  notes: null,
};

const weight: WeightEntry = {
  id: "5f6b5b2e-3a3c-5b1e-9c4d-222222222222",
  timestamp: "2025-07-28",
  weightValue: 81.2,
  unit: null,
  notes: null,
};

const profile: Profile = {
  id: "5f6b5b2e-3a3c-5b1e-9c4d-333333333333",
  name: null,
  firstName: "Sam",
  mealWeightUnit: null,
  bodyWeightUnit: "kg",
  classicAccountId: null,
  setupStatus: "native",
};

describe("DataExporter.buildExport with Jazz 2 rows", () => {
  it("omits null fields, and the file passes import validation", () => {
    const exported = DataExporter.buildExport({
      profile,
      meals: [meal],
      weights: [weight],
    });
    const json = JSON.parse(JSON.stringify(exported));

    expect(json.mealEntries[0]).toEqual({
      id: meal.id,
      timestamp: meal.timestamp,
      foodName: "Rice",
      foodCategory: "Dinner",
      caloriesPerGram: 1.3,
      weightInGrams: 200,
      totalCalories: 260,
    });
    expect(json.weightEntries[0]).toEqual({
      id: weight.id,
      timestamp: "2025-07-28",
      weightValue: 81.2,
    });
    expect(json.profile).toEqual({ firstName: "Sam", bodyWeightUnit: "kg" });

    expect(DataImporter.validateImportData(json).errors).toEqual([]);
    const plan = DataImporter.planImport(json);
    expect(plan.errors).toEqual([]);
    expect(plan.meals).toHaveLength(1);
    expect(plan.weights).toHaveLength(1);
  });
});
