import type { MealWeightUnit, BodyWeightUnit, ProfileRow } from "@/schema";

/** The profile fields this class reads and writes. */
type UnitProfile = Pick<ProfileRow, "mealWeightUnit" | "bodyWeightUnit">;

/**
 * UnitPreferenceManager handles user preferences for weight units
 * using Jazz profile storage for real-time sync across devices
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
   * Set the user's preferred meal weight unit
   * @param profile - The user's profile
   * @param unit - The meal weight unit to set
   */
  static setMealWeightUnit(profile: UnitProfile | undefined, unit: MealWeightUnit): void {
    if (!profile) {
      console.warn("Cannot set meal weight unit: profile not available");
      return;
    }
    profile.mealWeightUnit = unit;
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
   * Set the user's preferred body weight unit
   * @param profile - The user's profile
   * @param unit - The body weight unit to set
   */
  static setBodyWeightUnit(profile: UnitProfile | undefined, unit: BodyWeightUnit): void {
    if (!profile) {
      console.warn("Cannot set body weight unit: profile not available");
      return;
    }
    profile.bodyWeightUnit = unit;
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
