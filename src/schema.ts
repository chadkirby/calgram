/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z, type Loaded } from "jazz-tools";
import { DateTime } from "luxon";


export const MealShape = {
  timestamp: z.iso.date(),
  foodName: z.string().min(1, "Food name is required"),
  foodCategory: z.string().min(1, "Food category is required"),
  caloriesPerGram: z.number().nonnegative("Calories per gram cannot be negative"),
  caloriesPerDisplayUnit: z.enum(['g', 'oz', 'lb', 'kg']).optional(),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(),
  displayUnit: z.enum(['g', 'oz', 'lb', 'kg']).optional(),
};

/** MealEntry schema for tracking individual meal entries */
export const MealEntry = co.map(MealShape);

export type MealEntryType = z.infer<typeof MealEntry>;

/** Expose reusable Weight shape similar to MealShape to enable DRY validation reuse */
export const WeightShape = {
  timestamp: z.iso.date(),
  weightValue: z.number().positive("Weight value must be positive"),
  notes: z.string().optional(),
  unit: z.enum(['lbs', 'kg']).optional(),
};

/** WeightEntry schema for tracking weight measurements */
export const WeightEntry = co.map(WeightShape);

export type WeightEntryType = z.infer<typeof WeightEntry>;

/**
 * Export-friendly shapes (DTO validators) that consumers like DataImporter/DataExporter
 * can reuse without duplicating rules. These reuse our canonical shapes but keep timestamp
 * as ISO z.string() to match the serialized format we write/read in exports.
 */
export const ExportMealShape = {
  ...MealShape,
  timestamp: z.string().refine((s) => DateTime.fromISO(s).isValid, { message: "Invalid ISO date" }),
} as const;

export const ExportWeightShape = {
  ...WeightShape,
  timestamp: z.string().refine((s) => DateTime.fromISO(s).isValid, { message: "Invalid ISO date" }),
} as const;

/**
 * Strong TS DTO types derived from the export Zod shapes.
 * Export these so producers (DataExporter) can assert using `satisfies`
 * against exactly what consumers (DataImporter) validate.
 */
export const ExportMealZod = z.object(ExportMealShape);
export type ExportMealDTO = z.infer<typeof ExportMealZod>;

export const ExportWeightZod = z.object(ExportWeightShape);
export type ExportWeightDTO = z.infer<typeof ExportWeightZod>;

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

export const mealWeightUnits = ['g', 'oz', 'lb', 'kg'] as const;
export const bodyWeightUnits = ['lbs', 'kg'] as const;
export const calorieUnits = ['g', 'oz', 'lb', 'kg'] as const;

/** Weight unit types for meal and body weight preferences */
export type MealWeightUnit = typeof mealWeightUnits[number];
export type BodyWeightUnit = typeof bodyWeightUnits[number];
export type CalorieUnit = typeof calorieUnits[number];

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
          dateOfBirth: DateTime.fromJSDate(new Date("1/1/1990")).toISO() || '',
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
        resolve: { root: true }
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
