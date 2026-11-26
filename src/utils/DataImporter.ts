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

export type { ExportedData } from "./DataExporter";

/** v1.2: Classic exports. v1.3: Jazz 2 exports, which also name the exporting account. */
const SUPPORTED_VERSIONS = ["1.2", "1.3"] as const;

// Strict Zod schema for the export format (rejects unknown keys).
const ExportedDataSchema = z
  .object({
    version: z.enum(SUPPORTED_VERSIONS),
    exportDate: ExportIsoString,
    accountId: z.string().optional(),
    profile: z.object(ExportProfileShape).strict().optional(),
    mealEntries: z.array(z.object(ExportMealShape).strict()),
    weightEntries: z.array(z.object(ExportWeightShape).strict()),
  })
  .strict();

/** A row to write, with its entry's source id from the file. */
export interface PlannedRow<T> {
  sourceId: string;
  row: T;
}

export interface ImportPlan {
  /** The Jazz 2 account the file was exported from (v1.3), when it names one. */
  accountId: string | undefined;
  meals: PlannedRow<MealRow>[];
  weights: PlannedRow<WeightRow>[];
  /** Fields from the file's `profile` block, or undefined when it has none. */
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

/**
 * Parse a file against the export format. An unsupported version is reported on its own,
 * so an older file gives one clear error instead of one per id-less entry.
 */
function parse(jsonData: unknown) {
  const version: unknown = (jsonData as { version?: unknown } | null)?.version;
  if (
    typeof jsonData === "object" &&
    !(SUPPORTED_VERSIONS as readonly unknown[]).includes(version)
  ) {
    return {
      errors: [
        `version: Export version ${JSON.stringify(version)} isn't supported; import takes ` +
          `version ${SUPPORTED_VERSIONS.join(" or ")} files, where every entry has an id`,
      ],
    };
  }
  const result = ExportedDataSchema.safeParse(jsonData);
  return result.success ? { data: result.data } : { errors: formatIssues(result.error) };
}

/** Copy only the keys whose value is defined. */
function definedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const planRows = <T>(entries: readonly (T & { id: string })[]): PlannedRow<T>[] =>
  entries.map(({ id, ...row }) => ({ sourceId: id, row: row as T }));

export class DataImporter {
  /**
   * Validate the imported data structure strictly
   */
  static validateImportData(jsonData: unknown): { isValid: boolean; errors: string[] } {
    const { errors = [] } = parse(jsonData);
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Plan an import without writing anything: validate the file, then return its rows
   * with their source ids and the profile patch from its `profile` block. Timestamps are
   * kept verbatim. Account-independent: the caller turns source ids into row ids.
   */
  static planImport(jsonData: unknown): ImportPlan {
    const { data, errors } = parse(jsonData);
    if (!data) {
      return { accountId: undefined, meals: [], weights: [], profile: undefined, errors };
    }
    return {
      accountId: data.accountId,
      meals: planRows<MealRow>(data.mealEntries),
      weights: planRows<WeightRow>(data.weightEntries),
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
