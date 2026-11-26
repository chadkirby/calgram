import { DateTime } from "luxon";
import { z as zod } from "zod";

export const mealWeightUnits = ["g", "oz", "lb", "kg"] as const;
export const bodyWeightUnits = ["lbs", "kg"] as const;
export const calorieUnits = ["g", "oz", "lb", "kg"] as const;

/** Weight unit types for meal and body weight preferences */
export type MealWeightUnit = (typeof mealWeightUnits)[number];
export type BodyWeightUnit = (typeof bodyWeightUnits)[number];
export type CalorieUnit = (typeof calorieUnits)[number];

/**
 * Plain row types that utilities and pages take. `src/lib/data.ts` converts Jazz 2
 * rows (null for a missing optional field) to these. Timestamps are verbatim ISO text: an offset datetime, a `Z` datetime or a
 * date-only `YYYY-MM-DD`.
 */
export interface MealRow {
  timestamp: string;
  foodName: string;
  foodCategory: string;
  caloriesPerGram: number;
  caloriesPerDisplayUnit?: CalorieUnit;
  weightInGrams: number;
  notes?: string;
  totalCalories: number;
  displayUnit?: MealWeightUnit;
}

export interface WeightRow {
  timestamp: string;
  weightValue: number;
  notes?: string;
  unit?: BodyWeightUnit;
}

/**
 * Profile fields as they appear in export files. `dateOfBirth` came from Classic's
 * account root; Jazz 2 has no column for it, so import drops it.
 */
export interface ProfileRow {
  name?: string;
  firstName?: string;
  dateOfBirth?: string;
  mealWeightUnit?: MealWeightUnit;
  bodyWeightUnit?: BodyWeightUnit;
}

/**
 * Export-friendly shapes (DTO validators) shared by DataImporter and DataExporter.
 * Timestamps are ISO strings that Luxon parses,
 * which includes date-only values.
 */
export const ExportIsoString = zod
  .string()
  .refine((s) => DateTime.fromISO(s).isValid, { message: "Invalid ISO date" });

/** Since v1.2 every entry may carry its source `id`. */
export const ExportMealShape = {
  id: zod.string().min(1).optional(),
  timestamp: ExportIsoString,
  foodName: zod.string().min(1, "Food name is required"),
  foodCategory: zod.string().min(1, "Food category is required"),
  caloriesPerGram: zod.number().nonnegative("Calories per gram cannot be negative"),
  caloriesPerDisplayUnit: zod.enum(calorieUnits).optional(),
  weightInGrams: zod.number(),
  notes: zod.string().optional(),
  totalCalories: zod.number(),
  displayUnit: zod.enum(mealWeightUnits).optional(),
} as const;

export const ExportWeightShape = {
  id: zod.string().min(1).optional(),
  timestamp: ExportIsoString,
  weightValue: zod.number().positive("Weight value must be positive"),
  notes: zod.string().optional(),
  unit: zod.enum(bodyWeightUnits).optional(),
} as const;

/** Profile and account settings, included in exports since version 1.1 */
export const ExportProfileShape = {
  name: zod.string().optional(),
  firstName: zod.string().optional(),
  dateOfBirth: ExportIsoString.optional(),
  mealWeightUnit: zod.enum(mealWeightUnits).optional(),
  bodyWeightUnit: zod.enum(bodyWeightUnits).optional(),
} as const;

/**
 * Strong TS DTO types derived from the export Zod shapes, so producers (DataExporter)
 * can assert with `satisfies` against exactly what consumers (DataImporter) validate.
 */
export const ExportProfileZod = zod.object(ExportProfileShape);
export type ExportProfileDTO = zod.infer<typeof ExportProfileZod>;

export const ExportMealZod = zod.object(ExportMealShape);
export type ExportMealDTO = zod.infer<typeof ExportMealZod>;

export const ExportWeightZod = zod.object(ExportWeightShape);
export type ExportWeightDTO = zod.infer<typeof ExportWeightZod>;
