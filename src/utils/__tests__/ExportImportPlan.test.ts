import { describe, it, expect } from "vitest";
import { DataExporter } from "../DataExporter";
import { DataImporter } from "../DataImporter";
import type { MealRow, WeightRow } from "../../schema";

const offsetMeal: MealRow & { id: string } = {
  id: "co_zMealOffset",
  timestamp: "2025-07-27T19:36:00.000-07:00",
  foodName: "Pizza",
  foodCategory: "Dinner",
  caloriesPerGram: 2.66,
  caloriesPerDisplayUnit: "oz",
  weightInGrams: 250,
  displayUnit: "oz",
  totalCalories: 665,
  notes: "two slices",
};

const dateOnlyWeight: WeightRow & { id: string } = {
  id: "co_zWeightDateOnly",
  timestamp: "2025-07-28",
  weightValue: 180.4,
  unit: "lbs",
};

const profile = {
  name: "Sam Example",
  firstName: "Sam",
  dateOfBirth: "1990-01-01T00:00:00.000-08:00",
  mealWeightUnit: "oz" as const,
  bodyWeightUnit: "kg" as const,
};

const snack = {
  id: "co_zSnack",
  timestamp: "2025-07-27T15:02:00.000-07:00",
  foodName: "Almonds",
  foodCategory: "Snack",
  caloriesPerGram: 5.79,
  weightInGrams: 28,
  totalCalories: 162.12,
};

describe("buildExport", () => {
  it("writes v1.3 with the exporting account and each entry's source id", () => {
    const data = DataExporter.buildExport({
      accountId: "account-a",
      profile,
      meals: [offsetMeal],
      weights: [dateOnlyWeight],
    });
    expect(data.version).toBe("1.3");
    expect(data.accountId).toBe("account-a");
    expect(data.mealEntries[0].id).toBe("co_zMealOffset");
    expect(data.weightEntries[0].id).toBe("co_zWeightDateOnly");
    expect(DataImporter.validateImportData(JSON.parse(JSON.stringify(data))).errors).toEqual([]);
  });
});

describe("planImport", () => {
  it("round-trips buildExport output with timestamps unchanged", async () => {
    const file = JSON.parse(
      JSON.stringify(
        DataExporter.buildExport({ profile, meals: [offsetMeal], weights: [dateOnlyWeight] }),
      ),
    );
    const plan = DataImporter.planImport(file);

    expect(plan.errors).toEqual([]);
    expect(plan.profile).toEqual(profile);
    const { id: mealId, ...mealRow } = offsetMeal;
    const { id: weightId, ...weightRow } = dateOnlyWeight;
    expect(plan.meals).toEqual([{ sourceId: mealId, row: mealRow }]);
    expect(plan.weights).toEqual([{ sourceId: weightId, row: weightRow }]);
    expect(plan.meals[0].row.timestamp).toBe("2025-07-27T19:36:00.000-07:00");
    expect(plan.weights[0].row.timestamp).toBe("2025-07-28");
  });

  it("returns a profile patch from the profile block, with only the fields present", () => {
    const plan = DataImporter.planImport({
      version: "1.2",
      exportDate: "2025-07-28T00:00:00.000Z",
      profile: { firstName: "Sam", bodyWeightUnit: "kg" },
      mealEntries: [],
      weightEntries: [],
    });
    expect(plan.profile).toEqual({ firstName: "Sam", bodyWeightUnit: "kg" });
  });

  it("accepts the owner's data shape (date-only, offset and Z timestamps mixed)", () => {
    const plan = DataImporter.planImport({
      version: "1.2",
      exportDate: "2025-07-28T06:00:00.000Z",
      profile: { name: "Sam Example", firstName: "Sam", dateOfBirth: "1990-01-01T00:00:00.000Z" },
      mealEntries: [
        snack,
        { ...snack, id: "co_zSnack2", timestamp: "2025-07-26T18:00:00.000Z", notes: "" },
        { ...snack, id: "co_zSnack3", timestamp: "2025-07-25" },
      ],
      weightEntries: [
        { id: "co_zW1", timestamp: "2025-07-28", weightValue: 180.4, unit: "lbs" },
        {
          id: "co_zW2",
          timestamp: "2025-07-20T07:12:00.000-07:00",
          weightValue: 181,
          notes: "run",
        },
        { id: "co_zW3", timestamp: "2025-07-10T15:00:00.000Z", weightValue: 82.1, unit: "kg" },
      ],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.meals).toHaveLength(3);
    expect(plan.weights).toHaveLength(3);
  });

  it("reports validation errors and plans no rows for an invalid file", () => {
    const plan = DataImporter.planImport({
      version: "1.2",
      exportDate: "not-a-date",
      mealEntries: [snack],
      weightEntries: [],
    });
    expect(plan.errors.some((e) => e.includes("exportDate"))).toBe(true);
    expect(plan.meals).toEqual([]);
  });

  it.each([
    ["1.0", 'version: Export version "1.0" isn\'t supported'],
    ["1.1", 'version: Export version "1.1" isn\'t supported'],
    ["1.2", "mealEntries.0.id: id is required"],
  ])("rejects a v%s file whose entries have no ids", (version, error) => {
    const { id: _id, ...idless } = snack;
    const plan = DataImporter.planImport({
      version,
      exportDate: "2025-07-28T00:00:00.000Z",
      mealEntries: [idless],
      weightEntries: [],
    });
    expect(plan.errors).toEqual([expect.stringContaining(error)]);
    expect(plan.meals).toEqual([]);
  });
});
