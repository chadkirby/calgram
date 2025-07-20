/**
 * Learn about schemas here:
 * https://jazz.tools/docs/react/schemas/covalues
 */

import { Group, co, z } from "jazz-tools";

/** MealEntry schema for tracking individual meal entries */
export const MealEntry = co.map({
  timestamp: z.date(),
  foodName: z.string().min(1, "Food name is required"),
  foodCategory: z.string().min(1, "Food category is required"),
  caloriesPerGram: z.number().positive("Calories per gram must be positive"),
  weightInGrams: z.number(),
  notes: z.string().optional(),
  totalCalories: z.number(),
});

export type MealEntryType = z.infer<typeof MealEntry>;

/** WeightEntry schema for tracking weight measurements */
export const WeightEntry = co.map({
  timestamp: z.date(),
  weightValue: z.number().positive("Weight value must be positive"),
  notes: z.string().optional(),
});

export type WeightEntryType = z.infer<typeof WeightEntry>;

/** Food metadata schema for storing food intelligence data */
export const FoodMetadata = co.map({
  lastUsedCPG: z.number().positive("Calories per gram must be positive"),
  lastUsedCategory: z.string().min(1, "Category is required"),
  usageCount: z.number().nonnegative("Usage count cannot be negative"),
  lastUsed: z.date(),
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
  dateOfBirth: z.date(),
  mealEntries: co.list(MealEntry),
  weightEntries: co.list(WeightEntry),
  foodIntelligence: FoodIntelligence,
});

export function getUserAge(root: co.loaded<typeof CalorieTrackerRoot> | undefined) {
  if (!root) return null;
  return new Date().getFullYear() - root.dateOfBirth.getFullYear();
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
          dateOfBirth: new Date("1/1/1990"),
          mealEntries,
          weightEntries,
          foodIntelligence,
        },
        group,
      );
    }

    if (account.profile === undefined) {
      const group = Group.create();
      group.addMember("everyone", "reader"); // The profile info is visible to everyone

      account.profile = CalorieTrackerProfile.create(
        {
          name: "Anonymous user",
          firstName: "",
        },
        group,
      );
    }
  });
