/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z, type Loaded } from "jazz-classic";
import { DateTime } from "luxon";
import { z as zod } from "zod";

export const mealWeightUnits = ["g", "oz", "lb", "kg"] as const;
export const bodyWeightUnits = ["lbs", "kg"] as const;
export const calorieUnits = ["g", "oz", "lb", "kg"] as const;

/** Weight unit types for meal and body weight preferences */
export type MealWeightUnit = (typeof mealWeightUnits)[number];
export type BodyWeightUnit = (typeof bodyWeightUnits)[number];
export type CalorieUnit = (typeof calorieUnits)[number];

export const MealShape = {
  timestamp: z.iso.date(),
  foodName: z.string().min(1, "Food name is required"),
  foodCategory: z.string().min(1, "Food category is required"),
  caloriesPerGram: z.number().nonnegative("Calories per gram cannot be negative"),
  caloriesPerDisplayUnit: z.enum(["g", "oz", "lb", "kg"]).optional(),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(),
  displayUnit: z.enum(["g", "oz", "lb", "kg"]).optional(),
};

/** MealEntry schema for tracking individual meal entries */
export const MealEntry = co.map(MealShape);

export type MealEntryType = z.infer<typeof MealEntry>;

/** Expose reusable Weight shape similar to MealShape to enable DRY validation reuse */
export const WeightShape = {
  timestamp: z.iso.date(),
  weightValue: z.number().positive("Weight value must be positive"),
  notes: z.string().optional(),
  unit: z.enum(["lbs", "kg"]).optional(),
};

/** WeightEntry schema for tracking weight measurements */
export const WeightEntry = co.map(WeightShape);

export type WeightEntryType = z.infer<typeof WeightEntry>;

/**
 * Plain row types (KTD12). Utilities take these instead of Classic CoValue types, so
 * Classic objects satisfy them structurally and Jazz 2 rows can replace them later.
 * Timestamps are verbatim ISO text (KTD10): an offset datetime, a `Z` datetime or a
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

/** Profile fields plus `dateOfBirth`, which Classic keeps on the account root. */
export interface ProfileRow {
  name?: string;
  firstName?: string;
  dateOfBirth?: string;
  mealWeightUnit?: MealWeightUnit;
  bodyWeightUnit?: BodyWeightUnit;
}

/**
 * Export-friendly shapes (DTO validators) shared by DataImporter and DataExporter.
 * They are built from the `zod` package, not the copy bundled with jazz-tools, so
 * validation doesn't depend on Classic. Timestamps are ISO strings that Luxon parses,
 * which includes date-only values.
 */
const ExportIsoString = zod
  .string()
  .refine((s) => DateTime.fromISO(s).isValid, { message: "Invalid ISO date" });

/** Since v1.2 every entry may carry its source `id` (KTD12). */
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

/** Food metadata schema for storing food intelligence data */
export const FoodMetadata = co.map({
  lastUsedCPG: z.number().nonnegative("Calories per gram cannot be negative"),
  lastUsedCategory: z.string().min(1, "Category is required"),
  usageCount: z.number().nonnegative("Usage count cannot be negative"),
  lastUsed: z.iso.date(),
});

export type FoodMetadataType = z.infer<typeof FoodMetadata>;

/** FoodIntelligence schema for auto-completion and food suggestions */
export const FoodIntelligence = co.map({
  recentFoods: co.list(z.string()),
  recentCategories: co.list(z.string()),
  foodData: co.record(z.string(), FoodMetadata),
});

export type FoodIntelligenceType = z.infer<typeof FoodIntelligence>;

/** The account profile is an app-specific per-user public `CoMap`
 *  where you can store top-level objects for that user */
export const CalorieTrackerProfile = co.profile({
  /**
   * Learn about CoValue field/item types here:
   * https://jazz.tools/docs/react/schemas/covalues#covalue-fielditem-types
   */
  name: z.string(),
  firstName: z.string(),

  // Unit preferences for weight measurements
  mealWeightUnit: z.enum(mealWeightUnits).optional(),
  bodyWeightUnit: z.enum(bodyWeightUnits).optional(),

  // Add public fields here
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const CalorieTrackerRoot = co.map({
  dateOfBirth: z.iso.date(),
  mealEntries: co.list(MealEntry),
  weightEntries: co.list(WeightEntry),
  foodIntelligence: FoodIntelligence,
});

export function getUserAge(root: Loaded<typeof CalorieTrackerRoot> | undefined) {
  if (!root) return null;
  const now = DateTime.now();
  const birthDate = DateTime.fromISO(root.dateOfBirth);
  return now.year - birthDate.year;
}

export const JazzAccount = co
  .account({
    profile: CalorieTrackerProfile,
    root: CalorieTrackerRoot,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (account.root === undefined) {
      const group = Group.create();

      // Initialize empty CoLists and CoMaps for calorie tracking
      const mealEntries = co.list(MealEntry).create([], group);
      const weightEntries = co.list(WeightEntry).create([], group);
      const foodIntelligence = FoodIntelligence.create(
        {
          recentFoods: co.list(z.string()).create([], group),
          recentCategories: co.list(z.string()).create([], group),
          foodData: co.record(z.string(), FoodMetadata).create({}, group),
        },
        group,
      );

      account.root = CalorieTrackerRoot.create(
        {
          dateOfBirth: DateTime.fromJSDate(new Date("1/1/1990")).toISO() || "",
          mealEntries,
          weightEntries,
          foodIntelligence,
        },
        group,
      );
    } else {
      // Only add missing collections if they're actually undefined (not just not loaded)
      // We need to ensure the root is loaded to check for missing fields
      const { root } = await account.ensureLoaded({
        resolve: { root: true },
      });

      const group = root._owner;

      // Add missing mealEntries if not present
      if (root.mealEntries === undefined) {
        root.mealEntries = co.list(MealEntry).create([], group);
      }

      // Add missing weightEntries if not present
      if (root.weightEntries === undefined) {
        root.weightEntries = co.list(WeightEntry).create([], group);
      }

      // Add missing foodIntelligence if not present
      if (root.foodIntelligence === undefined) {
        root.foodIntelligence = FoodIntelligence.create(
          {
            recentFoods: co.list(z.string()).create([], group),
            recentCategories: co.list(z.string()).create([], group),
            foodData: co.record(z.string(), FoodMetadata).create({}, group),
          },
          group,
        );
      }
    }

    if (account.profile === undefined) {
      const group = Group.create();
      group.addMember("everyone", "reader"); // The profile info is visible to everyone

      account.profile = CalorieTrackerProfile.create(
        {
          name: "Anonymous user",
          firstName: "Nobody",
        },
        group,
      );
    }
  });
