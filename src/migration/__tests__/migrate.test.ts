import { describe, expect, it } from "vitest";
import { DataImporter } from "@/utils/DataImporter";
import { migratedProfile, migratedProfileId } from "../migrate";

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
