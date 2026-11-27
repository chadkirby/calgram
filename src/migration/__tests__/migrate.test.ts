import { describe, expect, it } from "vitest";
import { DataImporter } from "@/utils/DataImporter";
import {
  CARRIED_ROWS_KEY,
  copyRows,
  migratedProfile,
  migratedProfileId,
  storedCarried,
} from "../migrate";

describe("migratedProfile", () => {
  it("keeps the Classic names and units, drops date of birth, and marks it migrated", () => {
    const plan = DataImporter.planImport({
      version: "1.2",
      exportDate: "2026-11-27T00:00:00.000Z",
      profile: { name: "Sam", firstName: "Sam", dateOfBirth: "1990-01-01", mealWeightUnit: "oz" },
      mealEntries: [],
      weightEntries: [],
    });
    expect(migratedProfile(plan, { seed: new Uint8Array(32), accountId: "co_zA" })).toEqual({
      name: "Sam",
      firstName: "Sam",
      mealWeightUnit: "oz",
      classicAccountId: "co_zA",
      setupStatus: "migrated",
    });
  });

  it("gives each account one fixed profile row id", async () => {
    expect(await migratedProfileId("a")).toBe(await migratedProfileId("a"));
    expect(await migratedProfileId("a")).not.toBe(await migratedProfileId("b"));
  });
});

/** A db whose writes settle as `outcome` says, by food name. */
function fakeDb(outcome: (foodName: string) => Promise<unknown>) {
  const inserted: string[] = [];
  const db = {
    all: async () => [],
    insert: (_table: unknown, row: { foodName: string }) => {
      inserted.push(row.foodName);
      return { wait: () => outcome(row.foodName) };
    },
  };
  return { db: db as unknown as Parameters<typeof copyRows>[0], inserted };
}

describe("copyRows", () => {
  const plan = DataImporter.planImport({
    version: "1.2",
    exportDate: "2026-11-27T00:00:00.000Z",
    mealEntries: ["co_zA", "co_zB", "co_zC"].map((id) => ({
      id,
      timestamp: "2026-11-27",
      foodName: id,
      foodCategory: "Test",
      caloriesPerGram: 1,
      weightInGrams: 1,
      totalCalories: 1,
    })),
    weightEntries: [],
  });

  it("counts rows the server already has, or deleted, as copied", async () => {
    const { db, inserted } = fakeDb(async (name) => {
      if (name === "co_zB") throw new Error("object already exists");
      if (name === "co_zC") throw new Error("row already deleted");
    });
    let copied = 0;
    await copyRows(db, "acct", plan, () => copied++);
    expect(inserted).toEqual(["co_zA", "co_zB", "co_zC"]);
    expect(copied).toBe(3);
  });

  it("rejects when the server refuses a row for any other reason", async () => {
    const { db } = fakeDb(async (name) => {
      if (name === "co_zB") throw new Error("permission denied");
    });
    await expect(copyRows(db, "acct", plan, () => {})).rejects.toThrow("permission denied");
  });
});

describe("storedCarried", () => {
  const data = { version: "1.3", exportDate: "x", mealEntries: [], weightEntries: [] };
  it("returns rows kept for this Classic account only", () => {
    localStorage.setItem(CARRIED_ROWS_KEY, JSON.stringify({ classicAccountId: "co_zA", data }));
    expect(storedCarried({ seed: new Uint8Array(32), accountId: "co_zA" })).toEqual(data);
    expect(storedCarried({ seed: new Uint8Array(32), accountId: "co_zB" })).toBeUndefined();
    localStorage.removeItem(CARRIED_ROWS_KEY);
  });
});
