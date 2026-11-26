import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../../jazz/jazz.generated";
import { exportAccount, importIntoAccount, planRowWrites } from "../backup";
import { rowId } from "@/utils/rowIds";

const ACCOUNT = "account-a";

const meal = (foodName: string, id?: string) => ({
  ...(id ? { id } : {}),
  timestamp: "2026-11-20T08:00:00.000-08:00",
  foodName,
  foodCategory: "Dry food",
  caloriesPerGram: 3.5,
  weightInGrams: 100,
  totalCalories: 350,
});

const weight = (weightValue: number, id?: string) => ({
  ...(id ? { id } : {}),
  timestamp: "2026-11-20T07:00:00.000-08:00",
  weightValue,
  unit: "lbs" as const,
});

const file = (mealEntries: object[], weightEntries: object[] = [], profile?: object) => ({
  version: "1.2",
  exportDate: "2026-11-26T00:00:00.000Z",
  ...(profile ? { profile } : {}),
  mealEntries,
  weightEntries,
});

/**
 * An in-memory stand-in for the Jazz 2 Db: `all` lists rows, `insert` stores the row
 * under its id, and `wait` settles with `rejectWith` when given.
 */
function fakeDb(rejectWith?: string) {
  const tables = new Map<unknown, Map<string, object>>([
    [app.mealEntries, new Map()],
    [app.weightEntries, new Map()],
  ]);
  const inserts: { table: unknown; id: string }[] = [];
  const db = {
    all: async (table: unknown) => [...tables.get(table)!.values()],
    insert: (table: unknown, row: object, { id }: { id: string }) => {
      inserts.push({ table, id });
      // Stored the way Jazz 2 returns it: with its id, and null for a missing optional.
      tables.get(table)!.set(id, { notes: null, ...row, id });
      return {
        wait: () => (rejectWith ? Promise.reject(new Error(rejectWith)) : Promise.resolve(row)),
      };
    },
  };
  return { db: db as unknown as Db, inserts, tables };
}

const planned = (sourceKey: string) => ({ sourceKey, row: meal(sourceKey) });

afterEach(() => vi.restoreAllMocks());

describe("planRowWrites", () => {
  it("writes an entry whose source id appears twice in the file once", async () => {
    const result = await planRowWrites(ACCOUNT, [planned("src-1"), planned("src-1")], new Set());
    expect(result.inserts).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("skips an entry whose source id is already one of this account's row ids", async () => {
    const result = await planRowWrites(ACCOUNT, [planned("row-1")], new Set(["row-1"]));
    expect(result.inserts).toEqual([]);
    expect(result.alreadyPresent).toBe(1);
  });

  it("inserts under rowId(account, sourceKey), and skips when that row exists", async () => {
    const id = await rowId(ACCOUNT, "co_zMeal1");
    const fresh = await planRowWrites(ACCOUNT, [planned("co_zMeal1")], new Set());
    expect(fresh.inserts.map((w) => w.id)).toEqual([id]);

    const again = await planRowWrites(ACCOUNT, [planned("co_zMeal1")], new Set([id]));
    expect(again.inserts).toEqual([]);
    expect(again.alreadyPresent).toBe(1);
  });
});

describe("importIntoAccount", () => {
  it("inserts each new row once, and a second import of the same file adds nothing", async () => {
    const { db, inserts } = fakeDb();
    const data = file(
      [meal("Kibble", "co_zMeal1"), meal("Kibble", "co_zMeal1"), meal("Treat"), meal("Treat")],
      [weight(10, "co_zWeight1"), weight(10.2)],
    );

    const first = await importIntoAccount(db, ACCOUNT, data, () => {});
    expect(first).toEqual({ mealCount: 3, weightCount: 2, duplicatesSkipped: 1 });
    expect(inserts[0]).toEqual({ table: app.mealEntries, id: await rowId(ACCOUNT, "co_zMeal1") });

    const second = await importIntoAccount(db, ACCOUNT, data, () => {});
    expect(second).toEqual({ mealCount: 0, weightCount: 0, duplicatesSkipped: 6 });
    expect(inserts).toHaveLength(5);
  });

  it("adds nothing when importing this account's own export", async () => {
    const { db, inserts } = fakeDb();
    await importIntoAccount(db, ACCOUNT, file([meal("Kibble"), meal("Treat")]), () => {});
    const exported = JSON.parse(JSON.stringify(await exportAccount(db, undefined)));

    const result = await importIntoAccount(db, ACCOUNT, exported, () => {});
    expect(result).toEqual({ mealCount: 0, weightCount: 0, duplicatesSkipped: 2 });
    expect(inserts).toHaveLength(2);
  });

  it("writes nothing for an invalid file and reports its validation errors", async () => {
    const { db, inserts } = fakeDb();
    const saveProfile = vi.fn<(patch: ProfileInsert) => void>();
    const invalid = file([{ ...meal("Kibble"), caloriesPerGram: -1 }], [], { firstName: "Sam" });

    await expect(importIntoAccount(db, ACCOUNT, invalid, saveProfile)).rejects.toThrow(
      /Invalid data format: mealEntries\.0\.caloriesPerGram/,
    );
    expect(inserts).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("saves names and unit preferences from the profile block, dropping date of birth", async () => {
    const { db } = fakeDb();
    const saveProfile = vi.fn<(patch: ProfileInsert) => void>();
    const profile = {
      name: "Sam Example",
      firstName: "Sam",
      dateOfBirth: "1990-01-01",
      mealWeightUnit: "oz",
      bodyWeightUnit: "kg",
    };

    await importIntoAccount(db, ACCOUNT, file([], [], profile), saveProfile);
    expect(saveProfile).toHaveBeenCalledWith({
      name: "Sam Example",
      firstName: "Sam",
      mealWeightUnit: "oz",
      bodyWeightUnit: "kg",
    });
  });

  it("doesn't save a profile patch that only had a date of birth", async () => {
    const { db } = fakeDb();
    const saveProfile = vi.fn<(patch: ProfileInsert) => void>();
    await importIntoAccount(db, ACCOUNT, file([], [], { dateOfBirth: "1990-01-01" }), saveProfile);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it.each(["object already exists: x", "row already deleted: x"])(
    "doesn't report a server rejection '%s' as an error",
    async (message) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { db } = fakeDb(message);
      await importIntoAccount(db, ACCOUNT, file([meal("Kibble")]), () => {});
      await new Promise((resolve) => setTimeout(resolve));
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("logs any other server rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb("permission denied");
    await importIntoAccount(db, ACCOUNT, file([meal("Kibble")]), () => {});
    await new Promise((resolve) => setTimeout(resolve));
    expect(error).toHaveBeenCalledWith("An imported row was rejected:", expect.any(Error));
  });
});
