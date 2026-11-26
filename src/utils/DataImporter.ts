import { z } from "zod";
import {
  ExportIsoString,
  ExportMealShape,
  ExportWeightShape,
  ExportProfileShape,
  type MealRow,
  type ProfileRow,
  type WeightRow,
} from "../schema";
import type { ExportedData } from "./DataExporter";
import { contentSourceKey } from "./rowIds";

export type { ExportedData } from "./DataExporter";

// Strict Zod schemas for the export format (reject unknown keys). Accepts v1.0 (no
// profile), v1.1 (profile), v1.2 (optional source `id` on each entry) and v1.3
// (optional exporting `accountId`).
const ExportedDataSchema = z
  .object({
    version: z.string(),
    exportDate: ExportIsoString,
    accountId: z.string().optional(),
    profile: z.object(ExportProfileShape).strict().optional(),
    mealEntries: z.array(z.object(ExportMealShape).strict()),
    weightEntries: z.array(z.object(ExportWeightShape).strict()),
  })
  .strict();

/** A row to write, with the source key its row id is derived from. */
export interface PlannedRow<T> {
  sourceKey: string;
  /** True when the source key is the entry's own `id` from the file. */
  hasSourceId: boolean;
  row: T;
}

export interface ImportPlan {
  /** The Jazz 2 account the file was exported from (v1.3+), when it names one. */
  accountId: string | undefined;
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

/** The text a content source key hashes. */
export const canonicalContent = (fields: unknown[]): string => JSON.stringify(fields);

/**
 * Source keys for a file's entries: the entry's source `id` when it has one,
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
      if (id) return { sourceKey: id, hasSourceId: true, row };
      const content = canonicalContent(canonical(row));
      const occurrence = seen.get(content) ?? 0;
      seen.set(content, occurrence + 1);
      return { sourceKey: await contentSourceKey(content, occurrence), hasSourceId: false, row };
    }),
  );
}

/** A row as stored or as read from a file: a missing optional field may be null. */
type Nullable<T> = { [K in keyof T]: undefined extends T[K] ? T[K] | null : T[K] };

// Fixed field order, so key order in the file doesn't change the hash. A missing
// optional field is null whether it was undefined (a file) or null (a stored row), so
// a stored row and the file entry it came from give the same content.
export const canonicalMeal = (m: Nullable<MealRow>): unknown[] =>
  [
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
  ].map((value) => value ?? null);

export const canonicalWeight = (w: Nullable<WeightRow>): unknown[] =>
  ["weight", w.timestamp, w.weightValue, w.unit, w.notes].map((value) => value ?? null);

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
      return {
        accountId: undefined,
        meals: [],
        weights: [],
        profile: undefined,
        errors: formatIssues(result.error),
      };
    }
    const data = result.data;
    return {
      accountId: data.accountId,
      meals: await planRows<MealRow>(data.mealEntries, canonicalMeal),
      weights: await planRows<WeightRow>(data.weightEntries, canonicalWeight),
      profile: data.profile ? definedFields(data.profile) : undefined,
      errors: [],
    };
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
