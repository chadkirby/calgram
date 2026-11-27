import { describe, expect, it } from "vitest";
import { DataImporter } from "@/utils/DataImporter";
import { ClassicReadError, readClassicAccount, toClassicExport } from "../classicReader";

const meal = (id: string, timestamp: string) => ({
  id,
  timestamp,
  foodName: "Rice",
  foodCategory: "Dinner",
  caloriesPerGram: 1.3,
  weightInGrams: 200,
  totalCalories: 260,
});
const weight = { id: "co_zw1", timestamp: "2025-07-28", weightValue: 81.2, unit: "kg" };
const profile = { name: "Sam Smith", firstName: "Sam", bodyWeightUnit: "kg" };

describe("toClassicExport", () => {
  it("maps a loaded account to a v1.2 export with Classic ids and verbatim timestamps", () => {
    const timestamps = ["2025-07-27T19:36:00.000-07:00", "2025-07-27T19:36:00Z", "2026-10-30"];
    const data = toClassicExport({
      profile,
      root: {
        mealEntries: timestamps.map((t, i) => meal(`co_zm${i}`, t)),
        weightEntries: [weight],
      },
    });
    expect(data.version).toBe("1.2");
    expect(data.accountId).toBeUndefined();
    expect(data.mealEntries.map((m) => [m.id, m.timestamp])).toEqual(
      timestamps.map((t, i) => [`co_zm${i}`, t]),
    );
    expect(data.weightEntries).toEqual([weight]);
    expect(data.profile).toEqual(profile);
    expect(DataImporter.planImport(JSON.parse(JSON.stringify(data))).errors).toEqual([]);
  });

  it("returns empty lists for an account with no entries", () => {
    const data = toClassicExport({ profile, root: { mealEntries: [], weightEntries: [] } });
    expect([data.mealEntries, data.weightEntries]).toEqual([[], []]);
  });

  it("fails, rather than returning fewer meals, when one meal didn't load", () => {
    const root = { mealEntries: [meal("co_zm1", "2026-10-30"), null], weightEntries: [] };
    expect(() => toClassicExport({ profile, root })).toThrow(ClassicReadError);
  });

  it("fails when the root, a list or the profile didn't load", () => {
    const root = { mealEntries: [], weightEntries: [] };
    expect(() => toClassicExport({ profile, root: null })).toThrow(ClassicReadError);
    expect(() => toClassicExport({ profile, root: { ...root, weightEntries: null } })).toThrow(
      ClassicReadError,
    );
    expect(() => toClassicExport({ profile: null, root })).toThrow(ClassicReadError);
  });
});

describe("readClassicAccount", () => {
  it("fails when Jazz Cloud can't be reached", async () => {
    const identity = { seed: new Uint8Array(32).fill(9), accountId: "co_zunreachable" };
    await expect(
      readClassicAccount(identity, { peerUrl: "ws://127.0.0.1:9/", timeoutMs: 3000 }),
    ).rejects.toBeInstanceOf(ClassicReadError);
  });
});
