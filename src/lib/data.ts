import { useMemo } from "react";
import { useAll } from "jazz-tools/react";
import {
  app,
  type MealEntry as StoredMeal,
  type Profile as StoredProfile,
  type WeightEntry as StoredWeight,
} from "../../jazz/jazz.generated";
import type { MealRow, ProfileRow, WeightRow } from "@/schema";

// Jazz 2 rows store a missing optional field as null; the app's row types use
// undefined. Convert here, once, so pages and utilities keep their plain row types.

export type Meal = MealRow & { id: string };
export type Weight = WeightRow & { id: string };
export type Profile = Omit<ProfileRow, "dateOfBirth"> & {
  id: string;
  setupStatus?: "native" | "migrated";
};

export const toMeal = (row: StoredMeal): Meal => ({
  id: row.id,
  timestamp: row.timestamp,
  foodName: row.foodName,
  foodCategory: row.foodCategory,
  caloriesPerGram: row.caloriesPerGram,
  caloriesPerDisplayUnit: row.caloriesPerDisplayUnit ?? undefined,
  weightInGrams: row.weightInGrams,
  displayUnit: row.displayUnit ?? undefined,
  totalCalories: row.totalCalories,
  notes: row.notes ?? undefined,
});

export const toWeight = (row: StoredWeight): Weight => ({
  id: row.id,
  timestamp: row.timestamp,
  weightValue: row.weightValue,
  unit: row.unit ?? undefined,
  notes: row.notes ?? undefined,
});

export const toProfile = (row: StoredProfile): Profile => ({
  id: row.id,
  name: row.name ?? undefined,
  firstName: row.firstName ?? undefined,
  mealWeightUnit: row.mealWeightUnit ?? undefined,
  bodyWeightUnit: row.bodyWeightUnit ?? undefined,
  setupStatus: row.setupStatus ?? undefined,
});

/**
 * This account's meals, live. The array keeps its identity until the rows change,
 * since forms reset state during render when it changes.
 */
export function useMeals(): Meal[] | undefined {
  const { data } = useAll(app.mealEntries);
  return useMemo(() => data?.map(toMeal), [data]);
}

/** This account's weigh-ins, live. */
export function useWeights(): Weight[] | undefined {
  const { data } = useAll(app.weightEntries);
  return useMemo(() => data?.map(toWeight), [data]);
}
