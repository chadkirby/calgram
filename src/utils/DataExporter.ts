import type {
  MealRow,
  ProfileRow,
  WeightRow,
  ExportMealDTO,
  ExportWeightDTO,
  ExportProfileDTO,
} from "../schema";

/**
 * v1.2 (Classic) gives each entry its source `id`; v1.3 (Jazz 2) adds the exporting
 * `accountId`, so importing into the same account can reuse those ids as row ids.
 */
export const EXPORT_VERSION = "1.3";

export interface ExportedData {
  version: string;
  exportDate: string;
  /** The Jazz 2 account the file was exported from (v1.3). */
  accountId?: string;
  profile?: ExportProfileDTO;
  mealEntries: ExportMealDTO[];
  weightEntries: ExportWeightDTO[];
}

/** A row whose optional fields may also be null, as Jazz 2 rows store them. */
type SourceRow<T> = { [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K] };

/** Rows to export. Each row's `id` is written as its source id. */
export interface ExportSource {
  /** The exporting Jazz 2 account, written to the file when given. */
  accountId?: string;
  profile: SourceRow<ProfileRow> | undefined;
  meals: Iterable<SourceRow<MealRow> & { id: string }>;
  weights: Iterable<SourceRow<WeightRow> & { id: string }>;
}

export class DataExporter {
  /**
   * Build the export file from plain rows. Pure: fields are picked explicitly, so a
   * Jazz 2 row can be passed as is. Timestamps are copied verbatim.
   */
  static buildExport(
    { accountId, profile, meals, weights }: ExportSource,
    now = new Date(),
  ): ExportedData {
    const mealEntries = Array.from(
      meals,
      (meal) =>
        ({
          id: meal.id,
          timestamp: meal.timestamp,
          foodName: meal.foodName,
          foodCategory: meal.foodCategory,
          caloriesPerGram: meal.caloriesPerGram,
          caloriesPerDisplayUnit: meal.caloriesPerDisplayUnit ?? undefined,
          weightInGrams: meal.weightInGrams,
          displayUnit: meal.displayUnit ?? undefined,
          totalCalories: meal.totalCalories,
          notes: meal.notes ?? undefined,
        }) satisfies ExportMealDTO,
    );

    const weightEntries = Array.from(
      weights,
      (weight) =>
        ({
          id: weight.id,
          timestamp: weight.timestamp,
          weightValue: weight.weightValue,
          unit: weight.unit ?? undefined,
          notes: weight.notes ?? undefined,
        }) satisfies ExportWeightDTO,
    );

    const profileData = profile
      ? ({
          name: profile.name ?? undefined,
          firstName: profile.firstName ?? undefined,
          dateOfBirth: profile.dateOfBirth || undefined,
          mealWeightUnit: profile.mealWeightUnit ?? undefined,
          bodyWeightUnit: profile.bodyWeightUnit ?? undefined,
        } satisfies ExportProfileDTO)
      : undefined;

    return {
      version: EXPORT_VERSION,
      exportDate: now.toISOString(),
      ...(accountId ? { accountId } : {}),
      ...(profileData ? { profile: profileData } : {}),
      mealEntries,
      weightEntries,
    };
  }

  /** The name a downloaded export gets: `calorie-tracker-export-<UTC time>.json`. */
  static exportFilename(now = new Date()): string {
    const timestamp = now.toISOString().slice(0, 19).replace(/[:]/g, "-");
    return `calorie-tracker-export-${timestamp}.json`;
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
