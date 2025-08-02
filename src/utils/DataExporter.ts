import { type Loaded } from "jazz-tools";
import { JazzAccount } from "../schema";

// Types for the exported data format
interface ExportedMealEntry {
  timestamp: string;
  foodName: string;
  foodCategory: string;
  caloriesPerGram: number;
  caloriesPerDisplayUnit?: string;
  weightInGrams: number;
  displayUnit?: string;
  totalCalories: number;
  notes?: string;
}

interface ExportedWeightEntry {
  timestamp: string;
  weightValue: number;
  unit?: string;
  notes?: string;
}

interface ExportedData {
  version: string;
  exportDate: string;
  mealEntries: ExportedMealEntry[];
  weightEntries: ExportedWeightEntry[];
}

export class DataExporter {
  /**
   * Export user data to a structured format
   */
  static async exportUserData(account: Loaded<typeof JazzAccount>): Promise<ExportedData> {
    if (!account.root) {
      throw new Error("Account root not available");
    }

    let loadedAccount = account;

    // Ensure the account root is loaded first, if ensureLoaded method exists
    if (typeof account.ensureLoaded === 'function') {
      loadedAccount = await account.ensureLoaded({
        resolve: {
          root: {
            mealEntries: true,
            weightEntries: true,
          },
        },
      });
    }

    if (!loadedAccount.root) {
      throw new Error("Failed to load account root");
    }

    // Export meal entries
    const mealEntries: ExportedMealEntry[] = [];
    if (loadedAccount.root.mealEntries) {
      for (const mealEntry of loadedAccount.root.mealEntries) {
        if (mealEntry) {
          mealEntries.push({
            timestamp: mealEntry.timestamp,
            foodName: mealEntry.foodName,
            foodCategory: mealEntry.foodCategory,
            caloriesPerGram: mealEntry.caloriesPerGram,
            caloriesPerDisplayUnit: mealEntry.caloriesPerDisplayUnit,
            weightInGrams: mealEntry.weightInGrams,
            displayUnit: mealEntry.displayUnit,
            totalCalories: mealEntry.totalCalories,
            notes: mealEntry.notes,
          });
        }
      }
    }

    // Export weight entries
    const weightEntries: ExportedWeightEntry[] = [];
    if (loadedAccount.root.weightEntries) {
      for (const weightEntry of loadedAccount.root.weightEntries) {
        if (weightEntry) {
          weightEntries.push({
            timestamp: weightEntry.timestamp,
            weightValue: weightEntry.weightValue,
            unit: weightEntry.unit,
            notes: weightEntry.notes,
          });
        }
      }
    }

    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      mealEntries,
      weightEntries,
    };
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
      if (typeof document !== 'undefined' && document.createElement) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;

        // Check if document.body exists and has the required methods
        if (document.body && typeof document.body.appendChild === 'function' && typeof document.body.removeChild === 'function') {
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
          console.warn("Document body not available or missing required methods, skipping download");
        }
      } else {
        // Fallback for non-browser environments (like tests)
        console.warn("Browser environment not detected, skipping download");
      }
    } catch (error) {
      console.error("Failed to trigger download:", error);
      throw new Error("Failed to trigger download");
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
      throw new Error("Failed to generate download file");
    }
  }
}




