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

  it("omits id for rows that have none", () => {
    const { id: _id, ...noId } = offsetMeal;
    const data = DataExporter.buildExport({ profile: undefined, meals: [noId], weights: [] });
    expect("id" in data.mealEntries[0]).toBe(false);
    expect("accountId" in data).toBe(false);
  });
});

describe("planImport", () => {
  it("round-trips buildExport output with timestamps unchanged", async () => {
    const file = JSON.parse(
      JSON.stringify(
        DataExporter.buildExport({ profile, meals: [offsetMeal], weights: [dateOnlyWeight] }),
      ),
    );
    const plan = await DataImporter.planImport(file);

    expect(plan.errors).toEqual([]);
    expect(plan.profile).toEqual(profile);
    const { id: mealId, ...mealRow } = offsetMeal;
    const { id: weightId, ...weightRow } = dateOnlyWeight;
    expect(plan.meals).toEqual([{ sourceKey: mealId, hasSourceId: true, row: mealRow }]);
    expect(plan.weights).toEqual([{ sourceKey: weightId, hasSourceId: true, row: weightRow }]);
    expect(plan.meals[0].row.timestamp).toBe("2025-07-27T19:36:00.000-07:00");
    expect(plan.weights[0].row.timestamp).toBe("2025-07-28");
  });

  it("returns a profile patch from the profile block, with only the fields present", async () => {
    const plan = await DataImporter.planImport({
      version: "1.1",
      exportDate: "2025-07-28T00:00:00.000Z",
      profile: { firstName: "Sam", bodyWeightUnit: "kg" },
      mealEntries: [],
      weightEntries: [],
    });
    expect(plan.profile).toEqual({ firstName: "Sam", bodyWeightUnit: "kg" });
  });

  it("returns no profile patch for a v1.0 file", async () => {
    const plan = await DataImporter.planImport({
      version: "1.0",
      exportDate: "2025-07-28T00:00:00.000Z",
      mealEntries: [snack],
      weightEntries: [],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.profile).toBeUndefined();
    expect(plan.meals).toHaveLength(1);
  });

  it("accepts the owner's data shape (date-only, offset and Z timestamps mixed)", async () => {
    const plan = await DataImporter.planImport({
      version: "1.1",
      exportDate: "2025-07-28T06:00:00.000Z",
      profile: { name: "Sam Example", firstName: "Sam", dateOfBirth: "1990-01-01T00:00:00.000Z" },
      mealEntries: [
        snack,
        { ...snack, timestamp: "2025-07-26T18:00:00.000Z", notes: "" },
        { ...snack, timestamp: "2025-07-25" },
      ],
      weightEntries: [
        { timestamp: "2025-07-28", weightValue: 180.4, unit: "lbs" },
        { timestamp: "2025-07-20T07:12:00.000-07:00", weightValue: 181, notes: "after run" },
        { timestamp: "2025-07-10T15:00:00.000Z", weightValue: 82.1, unit: "kg" },
      ],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.meals).toHaveLength(3);
    expect(plan.weights).toHaveLength(3);
  });

  it("keeps two identical snacks at the same minute as two rows with different source keys", async () => {
    const plan = await DataImporter.planImport({
      version: "1.1",
      exportDate: "2025-07-28T00:00:00.000Z",
      mealEntries: [snack, { ...snack }],
      weightEntries: [],
    });
    expect(plan.meals).toHaveLength(2);
    expect(plan.meals[0].sourceKey).not.toBe(plan.meals[1].sourceKey);
  });

  it("gives the same source keys when the same file is planned twice", async () => {
    const file = {
      version: "1.1",
      exportDate: "2025-07-28T00:00:00.000Z",
      mealEntries: [snack, { ...snack }],
      weightEntries: [{ timestamp: "2025-07-28", weightValue: 180.4 }],
    };
    const first = await DataImporter.planImport(file);
    const second = await DataImporter.planImport(structuredClone(file));
    expect(second.meals.map((m) => m.sourceKey)).toEqual(first.meals.map((m) => m.sourceKey));
    expect(second.weights.map((w) => w.sourceKey)).toEqual(first.weights.map((w) => w.sourceKey));
  });

  it("pins content source keys (stored ids depend on them) regardless of key order in the file", async () => {
    // Expected values: SHA-256 of the canonical JSON array (fixed field order, missing as null).
    const reordered = Object.fromEntries(Object.entries(snack).toReversed());
    const plan = await DataImporter.planImport({
      version: "1.1",
      exportDate: "2025-07-28T00:00:00.000Z",
      mealEntries: [reordered],
      weightEntries: [{ weightValue: 180.4, timestamp: "2025-07-28" }],
    });
    expect(plan.meals[0].sourceKey).toBe(
      "content:3a3095d4bbf22c83ca5dd436084ac9d900aa365e82e90d89db32895fba74cd5b:0",
    );
    expect(plan.weights[0].sourceKey).toBe(
      "content:8efe0759987345f0d9e5abe1360c693296610ffa56017c19728c2c3281dfda5f:0",
    );
  });

  it("reports validation errors and plans no rows for an invalid file", async () => {
    const plan = await DataImporter.planImport({
      version: "1.1",
      exportDate: "not-a-date",
      mealEntries: [snack],
      weightEntries: [],
    });
    expect(plan.errors.some((e) => e.includes("exportDate"))).toBe(true);
    expect(plan.meals).toEqual([]);
  });
});
