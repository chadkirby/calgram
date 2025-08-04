import { Group, type Loaded, z } from "jazz-tools";
import { DateTime } from "luxon";
import {
  MealEntry,
  WeightEntry,
  FoodIntelligence,
  FoodMetadata,
  ExportMealShape,
  ExportWeightShape,
  type MealEntryType,
  type WeightEntryType,
} from "../schema";
import type { JazzAccount } from "../schema";

// Export format (current only) using schema-derived types
export type CurrentExportedMealEntry = Pick<
  MealEntryType,
  | "timestamp"
  | "foodName"
  | "foodCategory"
  | "caloriesPerGram"
  | "caloriesPerDisplayUnit"
  | "weightInGrams"
  | "displayUnit"
  | "totalCalories"
  | "notes"
>;

export type CurrentExportedWeightEntry = Pick<
  WeightEntryType,
  | "timestamp"
  | "weightValue"
  | "unit"
  | "notes"
>;

export interface CurrentExportedData {
  version: string;
  exportDate: string;
  mealEntries: CurrentExportedMealEntry[];
  weightEntries: CurrentExportedWeightEntry[];
}

// Strict Zod schemas for current export format (reject unknown keys)
const ISODateString = z.string().refine((s) => DateTime.fromISO(s).isValid, {
  message: "Invalid ISO date",
});

/**
 * Build import schemas using exported DTO shapes from schema.ts to avoid duplication.
 * ExportMealShape/ExportWeightShape already encode the serialized constraints.
 */
const CurrentExportedMealEntrySchema = z.object(ExportMealShape).strict();
const CurrentExportedWeightEntrySchema = z.object(ExportWeightShape).strict();

const CurrentExportedDataSchema = z
  .object({
    version: z.string(),
    exportDate: ISODateString,
    mealEntries: z.array(CurrentExportedMealEntrySchema),
    weightEntries: z.array(CurrentExportedWeightEntrySchema),
  })
  .strict();

export type ExportedData = CurrentExportedData;

// Result interface for import operations
interface ImportResult {
  mealCount: number;
  weightCount: number;
  duplicatesSkipped: number;
  errors: string[];
}

export class DataImporter {
  /**
   * Validate the imported data structure strictly (current format only)
   */
  static validateImportData(jsonData: unknown): { isValid: boolean; errors: string[] } {
    const result = CurrentExportedDataSchema.safeParse(jsonData);
    if (result.success) {
      return { isValid: true, errors: [] };
    }
    // Normalize zod issues to deterministic strings our tests expect
    const errors = result.error.issues.map((i) => {
      const path = i.path.length ? i.path.join(".") : "(root)";
      // Ensure unknown key rejections include the canonical message
      if (i.code === "unrecognized_keys") {
        return `${path}: Unrecognized key(s) in object`;
      }
      return `${path}: ${i.message}`;
    });
    return { isValid: false, errors };
  }

  /**
   * Import data from exported JSON file (current format only)
   */
  static async importData(jsonData: ExportedData, account: Loaded<typeof JazzAccount>): Promise<ImportResult> {
    if (!account.root) {
      throw new Error("Account root not available");
    }

    // Strictly parse to ensure structure is correct and narrow the type
    const parsed = CurrentExportedDataSchema.parse(jsonData);

    // Ensure the account root is loaded first
    const loadedAccount = await account.ensureLoaded({
      resolve: {
        root: {
          mealEntries: true,
          weightEntries: true,
          foodIntelligence: {
            recentFoods: true,
            recentCategories: true,
            foodData: true,
          },
        },
      },
    });

    if (!loadedAccount.root) {
      throw new Error("Failed to load account root");
    }

    if (!loadedAccount.root.mealEntries || !loadedAccount.root.weightEntries) {
      throw new Error("Account root does not have mealEntries or weightEntries");
    }

    const group = Group.create();
    let mealCount = 0;
    let weightCount = 0;
    let duplicatesSkipped = 0;
    const errors: string[] = [];

    // Import meal entries
    if (Array.isArray(parsed.mealEntries) && loadedAccount.root.mealEntries) {
      for (const exportedMeal of parsed.mealEntries) {
        try {
          const mealEntry = MealEntry.create(
            {
              timestamp: exportedMeal.timestamp,
              foodName: exportedMeal.foodName,
              foodCategory: exportedMeal.foodCategory,
              caloriesPerGram: exportedMeal.caloriesPerGram,
              caloriesPerDisplayUnit: exportedMeal.caloriesPerDisplayUnit,
              weightInGrams: exportedMeal.weightInGrams,
              displayUnit: exportedMeal.displayUnit,
              notes: exportedMeal.notes,
              totalCalories: exportedMeal.totalCalories,
            },
            group
          );

          loadedAccount.root.mealEntries.push(mealEntry);
          mealCount++;

          // Update food intelligence with imported data
          if (loadedAccount.root.foodIntelligence) {
            // exportedMeal is validated by schema, but keep type-safety explicit
            this.updateFoodIntelligenceNewFormat(
              loadedAccount.root.foodIntelligence,
              exportedMeal as CurrentExportedMealEntry
            );
          }
        } catch (error) {
          console.warn("Failed to import meal entry:", exportedMeal, error);
          errors.push(`Failed to import meal entry: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    }

    // Import weight entries
    if (Array.isArray(parsed.weightEntries) && loadedAccount.root.weightEntries) {
      for (const exportedWeight of parsed.weightEntries) {
        try {
          const weightEntry = WeightEntry.create(
            {
              timestamp: exportedWeight.timestamp,
              weightValue: exportedWeight.weightValue,
              unit: exportedWeight.unit,
              notes: exportedWeight.notes,
            },
            group
          );

          loadedAccount.root.weightEntries.push(weightEntry);
          weightCount++;
        } catch (error) {
          console.warn("Failed to import weight entry:", exportedWeight, error);
          errors.push(`Failed to import weight entry: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }
    }

    return { mealCount, weightCount, duplicatesSkipped, errors };
  }

  /**
   * Update food intelligence with imported meal data (current format)
   */
  private static updateFoodIntelligenceNewFormat(
    foodIntelligence: Loaded<typeof FoodIntelligence>,
    meal: CurrentExportedMealEntry
  ) {
    try {
      // Add to recent foods if not already present
      if (foodIntelligence.recentFoods && !foodIntelligence.recentFoods.includes(meal.foodName)) {
        foodIntelligence.recentFoods.push(meal.foodName);
      }

      // Add to recent categories if not already present
      if (foodIntelligence.recentCategories && !foodIntelligence.recentCategories.includes(meal.foodCategory)) {
        foodIntelligence.recentCategories.push(meal.foodCategory);
      }

      // Update or create food metadata
      if (foodIntelligence.foodData) {
        const existingMetadata = foodIntelligence.foodData[meal.foodName];
        if (existingMetadata) {
          // Update existing metadata
          existingMetadata.lastUsedCPG = meal.caloriesPerGram;
          existingMetadata.lastUsedCategory = meal.foodCategory;
          existingMetadata.usageCount = existingMetadata.usageCount + 1;
          existingMetadata.lastUsed = meal.timestamp;
        } else {
          // Create new metadata
          const group = Group.create();
          const metadata = FoodMetadata.create(
            {
              lastUsedCPG: meal.caloriesPerGram,
              lastUsedCategory: meal.foodCategory,
              usageCount: 1,
              lastUsed: meal.timestamp,
            },
            group
          );

          foodIntelligence.foodData[meal.foodName] = metadata;
        }
      }
    } catch (error) {
      console.warn("Failed to update food intelligence for:", meal.foodName, error);
    }
  }

  /**
   * Parse and validate JSON file content (parsing only, validation elsewhere)
   */
  static parseJsonFile(fileContent: string): ExportedData {
    try {
      const data = JSON.parse(fileContent);

      // Basic structure validation: must be object
      if (!data || typeof data !== "object") {
        throw new Error("Invalid JSON structure");
      }

      return data as ExportedData;
    } catch (error) {
      throw new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}
