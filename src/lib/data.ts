import {
  createContext,
  createElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

interface AllMeals {
  meals: Meal[] | undefined;
  /** Start loading every meal, if it hasn't started. */
  load: () => void;
}

const AllMealsContext = createContext<AllMeals | null>(null);

/**
 * Holds one live list of every meal for the pages below it. The list loads only once
 * something asks for it, so a launch can show the Daily page from a narrower query first.
 */
export function MealsProvider({ children }: { children: ReactNode }) {
  const [wanted, setWanted] = useState(false);
  const { data } = useAll(wanted ? app.mealEntries : undefined);
  const meals = useMemo(() => data?.map(toMeal), [data]);
  const load = useCallback(() => setWanted(true), []);
  const value = useMemo(() => ({ meals, load }), [meals, load]);
  return createElement(AllMealsContext, { value }, children);
}

function useAllMeals(): AllMeals {
  const context = use(AllMealsContext);
  if (!context) throw new Error("useMeals needs a MealsProvider above it");
  return context;
}

/**
 * This account's meals, live, from the shared list. The array keeps its identity until
 * the rows change, since forms reset state during render when it changes.
 */
export function useMeals(): Meal[] | undefined {
  const { meals, load } = useAllMeals();
  useEffect(load, [load]);
  return meals;
}

/**
 * Meals that include every meal on `day` (YYYY-MM-DD), live, and maybe others: callers
 * filter by day. Until the shared list of every meal has loaded, this reads only that
 * day's meals, then starts the full load once they're in. A meal's day is the date in
 * its own written offset (`CalorieCalculator`), which is the date its timestamp string
 * starts with, so a substring match finds them.
 */
export function useMealsIncludingDay(day: string): Meal[] | undefined {
  const { meals, load } = useAllMeals();
  const dayQuery = useMemo(
    () => (meals ? undefined : app.mealEntries.where({ timestamp: { contains: day } })),
    [meals, day],
  );
  const { data, error } = useAll(dayQuery);
  const dayMeals = useMemo(() => data?.map(toMeal), [data]);
  // Once the day is in, or if its query fails, so the page never waits on it alone.
  const dayDone = dayMeals !== undefined || error != null;
  useEffect(() => {
    if (dayDone) load();
  }, [dayDone, load]);
  return meals ?? dayMeals;
}

/** This account's weigh-ins, live. */
export function useWeights(): Weight[] | undefined {
  const { data } = useAll(app.weightEntries);
  return useMemo(() => data?.map(toWeight), [data]);
}
