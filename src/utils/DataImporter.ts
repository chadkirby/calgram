import { Group, type Loaded } from "jazz-tools";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  MealEntry,
  WeightEntry,
  FoodMetadata,
  ExportMealShape,
  ExportWeightShape,
  ExportProfileShape,
  type FoodIntelligence,
  type JazzAccount,
  type MealRow,
  type ProfileRow,
  type WeightRow,
} from "../schema";
import type { ExportedData } from "./DataExporter";
import { contentSourceKey } from "./rowIds";

export type { ExportedData } from "./DataExporter";

// Strict Zod schemas for the export format (reject unknown keys). Accepts v1.0 (no
// profile), v1.1 (profile) and v1.2 (optional source `id` on each entry).
const ISODateString = z.string().refine((s) => DateTime.fromISO(s).isValid, {
  message: "Invalid ISO date",
});

const ExportedDataSchema = z
  .object({
    version: z.string(),
    exportDate: ISODateString,
    profile: z.object(ExportProfileShape).strict().optional(),
    mealEntries: z.array(z.object(ExportMealShape).strict()),
    weightEntries: z.array(z.object(ExportWeightShape).strict()),
  })
  .strict();

// Result interface for import operations
interface ImportResult {
  mealCount: number;
  weightCount: number;
  duplicatesSkipped: number;
  errors: string[];
}

/** A row to write, with the source key its KTD5 row id is derived from. */
export interface PlannedRow<T> {
  sourceKey: string;
  row: T;
}

export interface ImportPlan {
  meals: PlannedRow<MealRow>[];
  weights: PlannedRow<WeightRow>[];
  /** Fields from the file's `profile` block (v1.1+), or undefined when it has none. */
  profile: Partial<ProfileRow> | undefined;
  /** Validation errors. When present, nothing is planned. */
  errors: string[];
}

function formatIssues(error: z.ZodError): string[] {
  // Normalize zod issues to deterministic strings our tests expect
  return error.issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    // Ensure unknown key rejections include the canonical message
    if (i.code === "unrecognized_keys") {
      return `${path}: Unrecognized key(s) in object`;
    }
    return `${path}: ${i.message}`;
  });
}

/** Copy only the keys whose value is defined. */
function definedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Source keys for a file's entries (KTD5): the entry's source `id` when it has one,
 * otherwise a hash of its content plus its occurrence among identical entries, so two
 * identical snacks stay two rows and re-planning the same file gives the same keys.
 */
async function planRows<T>(
  entries: readonly (T & { id?: string })[],
  canonical: (row: T) => unknown[],
): Promise<PlannedRow<T>[]> {
  const seen = new Map<string, number>();
  return Promise.all(
    entries.map(async ({ id, ...rest }) => {
      const row = rest as T;
      if (id) return { sourceKey: id, row };
      const content = JSON.stringify(canonical(row));
      const occurrence = seen.get(content) ?? 0;
      seen.set(content, occurrence + 1);
      return { sourceKey: await contentSourceKey(content, occurrence), row };
    }),
  );
}

// Fixed field order, so key order in the file doesn't change the hash.
const canonicalMeal = (m: MealRow): unknown[] => [
  "meal",
  m.timestamp,
  m.foodName,
  m.foodCategory,
  m.caloriesPerGram,
  m.caloriesPerDisplayUnit,
  m.weightInGrams,
  m.displayUnit,
  m.totalCalories,
  m.notes,
];

const canonicalWeight = (w: WeightRow): unknown[] => [
  "weight",
  w.timestamp,
  w.weightValue,
  w.unit,
  w.notes,
];

export class DataImporter {
  /**
   * Validate the imported data structure strictly (current format only)
   */
  static validateImportData(jsonData: unknown): { isValid: boolean; errors: string[] } {
    const result = ExportedDataSchema.safeParse(jsonData);
    if (result.success) {
      return { isValid: true, errors: [] };
    }
    return { isValid: false, errors: formatIssues(result.error) };
  }

  /**
   * Plan an import without writing anything: validate the file, then return its rows
   * with source keys and the profile patch from its `profile` block. Timestamps are kept
   * verbatim. Account-independent: the caller turns source keys into row ids.
   */
  static async planImport(jsonData: unknown): Promise<ImportPlan> {
    const result = ExportedDataSchema.safeParse(jsonData);
    if (!result.success) {
      return { meals: [], weights: [], profile: undefined, errors: formatIssues(result.error) };
    }
    const data = result.data;
    return {
      meals: await planRows<MealRow>(data.mealEntries, canonicalMeal),
      weights: await planRows<WeightRow>(data.weightEntries, canonicalWeight),
      profile: data.profile ? definedFields(data.profile) : undefined,
      errors: [],
    };
  }

  /**
   * Classic adapter: import a file into a Classic account. Rows come from `planImport`;
   * the profile block is still ignored here, as it always was on Classic.
   */
  static async importData(
    jsonData: ExportedData,
    account: Loaded<typeof JazzAccount>,
  ): Promise<ImportResult> {
    if (!account.root) {
      throw new Error("Account root not available");
    }

    const plan = await this.planImport(jsonData);
    if (plan.errors.length > 0) {
      throw new Error(`Invalid import file: ${plan.errors.join("; ")}`);
    }

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
    if (loadedAccount.root.mealEntries) {
      for (const { row: exportedMeal } of plan.meals) {
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
            group,
          );

          loadedAccount.root.mealEntries.push(mealEntry);
          mealCount++;

          // Update food intelligence with imported data
          if (loadedAccount.root.foodIntelligence) {
            this.updateFoodIntelligenceNewFormat(loadedAccount.root.foodIntelligence, exportedMeal);
          }
        } catch (error) {
          console.warn("Failed to import meal entry:", exportedMeal, error);
          errors.push(
            `Failed to import meal entry: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    }

    // Import weight entries
    if (loadedAccount.root.weightEntries) {
      for (const { row: exportedWeight } of plan.weights) {
        try {
          const weightEntry = WeightEntry.create(
            {
              timestamp: exportedWeight.timestamp,
              weightValue: exportedWeight.weightValue,
              unit: exportedWeight.unit,
              notes: exportedWeight.notes,
            },
            group,
          );

          loadedAccount.root.weightEntries.push(weightEntry);
          weightCount++;
        } catch (error) {
          console.warn("Failed to import weight entry:", exportedWeight, error);
          errors.push(
            `Failed to import weight entry: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
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
    meal: MealRow,
  ) {
    try {
      // Add to recent foods if not already present
      if (foodIntelligence.recentFoods && !foodIntelligence.recentFoods.includes(meal.foodName)) {
        foodIntelligence.recentFoods.push(meal.foodName);
      }

      // Add to recent categories if not already present
      if (
        foodIntelligence.recentCategories &&
        !foodIntelligence.recentCategories.includes(meal.foodCategory)
      ) {
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
            group,
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
      throw new Error(
        `Failed to parse JSON file: ${error instanceof Error ? error.message : "Unknown error"}`,
        { cause: error },
      );
    }
  }
}
