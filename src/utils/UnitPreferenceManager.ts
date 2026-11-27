import type { MealWeightUnit, BodyWeightUnit, ProfileRow } from "@/schema";

/** The profile fields this class reads. */
type UnitProfile = Pick<ProfileRow, "mealWeightUnit" | "bodyWeightUnit">;

/**
 * Reads the profile's weight-unit preferences, falling back to the defaults. Read-only:
 * preferences are saved by writing the profile row (`saveProfile` from `useAccount`).
 */
export class UnitPreferenceManager {
  private static readonly DEFAULT_MEAL_UNIT: MealWeightUnit = "g";
  private static readonly DEFAULT_BODY_UNIT: BodyWeightUnit = "lbs";

  /**
   * Get the user's preferred meal weight unit
   * @param profile - The user's profile
   * @returns The preferred meal weight unit or default (grams)
   */
  static getMealWeightUnit(profile: UnitProfile | undefined): MealWeightUnit {
    if (!profile || !profile.mealWeightUnit) {
      return this.DEFAULT_MEAL_UNIT;
    }
    return profile.mealWeightUnit;
  }

  /**
   * Get the user's preferred body weight unit
   * @param profile - The user's profile
   * @returns The preferred body weight unit or default (pounds)
   */
  static getBodyWeightUnit(profile: UnitProfile | undefined): BodyWeightUnit {
    if (!profile || !profile.bodyWeightUnit) {
      return this.DEFAULT_BODY_UNIT;
    }
    return profile.bodyWeightUnit;
  }

  /**
   * Get default meal weight unit (for fallback scenarios)
   */
  static getDefaultMealWeightUnit(): MealWeightUnit {
    return this.DEFAULT_MEAL_UNIT;
  }

  /**
   * Get default body weight unit (for fallback scenarios)
   */
  static getDefaultBodyWeightUnit(): BodyWeightUnit {
    return this.DEFAULT_BODY_UNIT;
  }
}
