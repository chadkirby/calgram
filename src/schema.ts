/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z, type Loaded } from "jazz-tools";
import { DateTime } from "luxon";

/** MealEntry schema for tracking individual meal entries */
export const MealEntry = co.map({
  timestamp: z.iso.date(),
  foodName: z.string().min(1, "Food name is required"),
  foodCategory: z.string().min(1, "Food category is required"),
  caloriesPerGram: z.number().nonnegative("Calories per gram cannot be negative"),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(),
});

export type MealEntryType = z.infer<typeof MealEntry>;

/** WeightEntry schema for tracking weight measurements */
export const WeightEntry = co.map({
  timestamp: z.iso.date(),
  weightValue: z.number().positive("Weight value must be positive"),
  notes: z.string().optional(),
});

export type WeightEntryType = z.infer<typeof WeightEntry>;

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
