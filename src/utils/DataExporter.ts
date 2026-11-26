import { type Loaded } from "jazz-classic";
import type {
  JazzAccount,
  MealRow,
  ProfileRow,
  WeightRow,
  ExportMealDTO,
  ExportWeightDTO,
  ExportProfileDTO,
} from "../schema";

/** v1.2 adds an optional source `id` to each entry. */
export const EXPORT_VERSION = "1.2";

export interface ExportedData {
  version: string;
  exportDate: string;
  profile?: ExportProfileDTO;
  mealEntries: ExportMealDTO[];
  weightEntries: ExportWeightDTO[];
}

/** Rows to export. A row's `id`, when present, is written as its source id. */
export interface ExportSource {
  profile: ProfileRow | undefined;
  meals: Iterable<MealRow & { id?: string }>;
  weights: Iterable<WeightRow & { id?: string }>;
}

const present = <T>(item: T | null | undefined): item is T => item != null;

export class DataExporter {
  /**
   * Build the export file from plain rows. Pure: fields are picked explicitly, so a
   * Classic CoValue or a Jazz 2 row can be passed as is. Timestamps are copied verbatim.
   */
  static buildExport({ profile, meals, weights }: ExportSource, now = new Date()): ExportedData {
    const mealEntries = Array.from(
      meals,
      (meal) =>
        ({
          ...(meal.id ? { id: meal.id } : {}),
          timestamp: meal.timestamp,
          foodName: meal.foodName,
          foodCategory: meal.foodCategory,
          caloriesPerGram: meal.caloriesPerGram,
          caloriesPerDisplayUnit: meal.caloriesPerDisplayUnit,
          weightInGrams: meal.weightInGrams,
          displayUnit: meal.displayUnit,
          totalCalories: meal.totalCalories,
          notes: meal.notes,
        }) satisfies ExportMealDTO,
    );

    const weightEntries = Array.from(
      weights,
      (weight) =>
        ({
          ...(weight.id ? { id: weight.id } : {}),
          timestamp: weight.timestamp,
          weightValue: weight.weightValue,
          unit: weight.unit,
          notes: weight.notes,
        }) satisfies ExportWeightDTO,
    );

    const profileData = profile
      ? ({
          name: profile.name,
          firstName: profile.firstName,
          dateOfBirth: profile.dateOfBirth || undefined,
          mealWeightUnit: profile.mealWeightUnit,
          bodyWeightUnit: profile.bodyWeightUnit,
        } satisfies ExportProfileDTO)
      : undefined;

    return {
      version: EXPORT_VERSION,
      exportDate: now.toISOString(),
      ...(profileData ? { profile: profileData } : {}),
      mealEntries,
      weightEntries,
    };
  }

  /**
   * Classic adapter: load a Classic account and export it with `buildExport`. Each
   * entry's CoValue id becomes its source id, so a Jazz 2 import of the file won't
   * duplicate rows. The Classic importer ignores ids, as it always has.
   */
  static async exportUserData(account: Loaded<typeof JazzAccount>): Promise<ExportedData> {
    if (!account.root) {
      throw new Error("Account root not available");
    }

    let loadedAccount = account;

    // Ensure the account root is loaded first, if ensureLoaded method exists
    if (typeof account.ensureLoaded === "function") {
      loadedAccount = await account.ensureLoaded({
        resolve: {
          profile: true,
          root: {
            mealEntries: true,
            weightEntries: true,
          },
        },
      });
    }

    const root = loadedAccount.root;
    if (!root) {
      throw new Error("Failed to load account root");
    }

    const profile = loadedAccount.profile;

    return this.buildExport({
      profile: {
        name: profile?.name,
        firstName: profile?.firstName,
        dateOfBirth: root.dateOfBirth,
        mealWeightUnit: profile?.mealWeightUnit,
        bodyWeightUnit: profile?.bodyWeightUnit,
      },
      meals: [...(root.mealEntries ?? [])].filter(present),
      weights: [...(root.weightEntries ?? [])].filter(present),
    });
  }

  /**
   * Create JSON blob from export data
   */
  static createJsonBlob(data: ExportedData): Blob {
    const jsonData = JSON.stringify(data, null, 2);
    return new Blob([jsonData], { type: "application/json" });
  }

  /**
   * Trigger file download in browser environment
   */
  static triggerDownload(blob: Blob, filename: string): void {
    try {
      const url = URL.createObjectURL(blob);

      // Check if we're in a browser environment
      if (typeof document !== "undefined" && document.createElement) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;

        // Check if document.body exists and has the required methods
        if (
          document.body &&
          typeof document.body.appendChild === "function" &&
          typeof document.body.removeChild === "function"
        ) {
          document.body.appendChild(a);
          a.click();

          // Clean up
          setTimeout(() => {
            try {
              if (document.body.contains(a)) {
                document.body.removeChild(a);
              }
              URL.revokeObjectURL(url);
            } catch (cleanupError) {
              // Ignore cleanup errors
              console.debug("Failed to cleanup download elements:", cleanupError);
            }
          }, 100);
        } else {
          // Fallback for test environments or environments without document.body
          console.warn(
            "Document body not available or missing required methods, skipping download",
          );
        }
      } else {
        // Fallback for non-browser environments (like tests)
        console.warn("Browser environment not detected, skipping download");
      }
    } catch (error) {
      console.error("Failed to trigger download:", error);
      throw new Error("Failed to trigger download", { cause: error });
    }
  }

  /**
   * Download JSON file to user's device
   */
  static downloadJsonFile(data: ExportedData, filename: string): void {
    try {
      const blob = this.createJsonBlob(data);
      this.triggerDownload(blob, filename);
    } catch (error) {
      console.error("Failed to download JSON file:", error);
      throw new Error("Failed to generate download file", { cause: error });
    }
  }
}
