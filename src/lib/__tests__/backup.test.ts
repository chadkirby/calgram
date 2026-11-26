import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "jazz-tools";
import { app, type ProfileInsert } from "../../../jazz/jazz.generated";
import { exportAccount, importIntoAccount, planRowWrites, unionById } from "../backup";
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
function fakeDb(rejectWith?: string, remote?: "same" | "reject" | "hang" | Map<unknown, object[]>) {
  const tables = new Map<unknown, Map<string, object>>([
    [app.mealEntries, new Map()],
    [app.weightEntries, new Map()],
  ]);
  const inserts: { table: unknown; id: string }[] = [];
  const db = {
    all: async (table: unknown, options?: { tier?: string }) => {
      if (options?.tier === "remote" && remote !== undefined && remote !== "same") {
        if (remote === "reject") throw new Error("offline");
        if (remote === "hang") return new Promise<never>(() => {});
        return remote.get(table) ?? [];
      }
      return [...tables.get(table)!.values()];
    },
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

/** A meal as Jazz 2 stores it: with its id, and null for a missing optional. */
const stored = (foodName: string, id: string) => ({ ...meal(foodName), notes: null, id });

const withoutIds = ({ id: _id, ...entry }: { id?: string }) => entry;

const planned = (sourceKey: string) => ({ sourceKey, hasSourceId: true, row: meal(sourceKey) });

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

describe("unionById", () => {
  it("keeps every local row, local first, and adds remote rows it doesn't have", () => {
    const local = [
      { id: "a", v: "local edit" },
      { id: "c", v: "pending insert" },
    ];
    const remote = [
      { id: "a", v: "server" },
      { id: "b", v: "server only" },
    ];
    expect(unionById(local, remote)).toEqual([
      { id: "a", v: "local edit" },
      { id: "c", v: "pending insert" },
      { id: "b", v: "server only" },
    ]);
  });
});

describe("exportAccount", () => {
  it("includes rows only the server has, and local edits over the server's copy", async () => {
    const remote = new Map<unknown, object[]>([
      [app.mealEntries, [stored("Kibble (old)", "m1"), stored("From another device", "m2")]],
      [app.weightEntries, [{ ...weight(10), notes: null, id: "w1" }]],
    ]);
    const { db, tables } = fakeDb(undefined, remote);
    tables.get(app.mealEntries)!.set("m1", stored("Kibble", "m1"));

    const { data, complete } = await exportAccount(db, ACCOUNT, undefined);
    expect(complete).toBe(true);
    expect(data.mealEntries.map((m) => [m.id, m.foodName])).toEqual([
      ["m1", "Kibble"],
      ["m2", "From another device"],
    ]);
    expect(data.weightEntries.map((w) => w.id)).toEqual(["w1"]);
    expect(data).not.toHaveProperty("complete");
  });

  it("exports local rows and flags the backup incomplete when the server read fails", async () => {
    const { db, tables } = fakeDb(undefined, "reject");
    tables.get(app.mealEntries)!.set("m1", stored("Kibble", "m1"));
    const { data, complete } = await exportAccount(db, ACCOUNT, undefined);
    expect(complete).toBe(false);
    expect(data.mealEntries.map((m) => m.id)).toEqual(["m1"]);
  });

  it("stops waiting for the server after the bound and flags the backup incomplete", async () => {
    const { db, tables } = fakeDb(undefined, "hang");
    tables.get(app.mealEntries)!.set("m1", stored("Kibble", "m1"));
    const { data, complete } = await exportAccount(db, ACCOUNT, undefined, { remoteWaitMs: 10 });
    expect(complete).toBe(false);
    expect(data.mealEntries.map((m) => m.id)).toEqual(["m1"]);
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
    const { data: exportData } = await exportAccount(db, ACCOUNT, undefined);
    const exported = JSON.parse(JSON.stringify(exportData));
    expect(exported).toMatchObject({ version: "1.3", accountId: ACCOUNT });

    const result = await importIntoAccount(db, ACCOUNT, exported, () => {});
    expect(result).toEqual({ mealCount: 0, weightCount: 0, duplicatesSkipped: 2 });
    expect(inserts).toHaveLength(2);
  });

  describe("entries without a source id", () => {
    it("add nothing when the same entries were imported before with Classic ids", async () => {
      const { db, inserts } = fakeDb();
      const classic = file(
        [meal("Kibble", "co_zMeal1"), meal("Treat", "co_zMeal2")],
        [weight(10, "co_zWeight1")],
      );
      await importIntoAccount(db, ACCOUNT, classic, () => {});
      expect(inserts).toHaveLength(3);

      const v11 = {
        ...classic,
        version: "1.1",
        mealEntries: classic.mealEntries.map(withoutIds),
        weightEntries: classic.weightEntries.map(withoutIds),
      };
      const result = await importIntoAccount(db, ACCOUNT, v11, () => {});
      expect(result).toEqual({ mealCount: 0, weightCount: 0, duplicatesSkipped: 3 });
      expect(inserts).toHaveLength(3);
    });

    it("add only the copies the account doesn't already have", async () => {
      const { db, inserts, tables } = fakeDb();
      // A snack logged by hand: a random row id, and null for missing optionals.
      tables.get(app.mealEntries)!.set("manual-1", {
        ...meal("Snack"),
        caloriesPerDisplayUnit: null,
        displayUnit: null,
        notes: null,
        id: "manual-1",
      });

      const result = await importIntoAccount(
        db,
        ACCOUNT,
        file([meal("Snack"), meal("Snack")]),
        () => {},
      );
      expect(result).toEqual({ mealCount: 1, weightCount: 0, duplicatesSkipped: 1 });
      expect(inserts).toHaveLength(1);
    });

    it("still add an entry whose content differs only in its timestamp text", async () => {
      const { db, tables } = fakeDb();
      tables.get(app.mealEntries)!.set("manual-1", { ...meal("Snack"), id: "manual-1" });
      const shifted = { ...meal("Snack"), timestamp: "2026-11-20T16:00:00.000Z" };
      const result = await importIntoAccount(db, ACCOUNT, file([shifted]), () => {});
      expect(result.mealCount).toBe(1);
    });
  });

  describe("a file's source ids", () => {
    const mealId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const weightId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const withIds = (accountId?: string) => ({
      ...file(
        [meal("Kibble", mealId), meal("Treat", "co_zClassicMeal"), meal("Snack")],
        [weight(10, weightId)],
      ),
      version: "1.3",
      ...(accountId ? { accountId } : {}),
    });

    it("are reused as row ids when the file is this account's own export", async () => {
      const { db, inserts } = fakeDb();
      const result = await importIntoAccount(db, ACCOUNT, withIds(ACCOUNT), () => {});
      expect(result).toEqual({ mealCount: 3, weightCount: 1, duplicatesSkipped: 0 });
      expect(inserts.map(({ id }) => id)).toEqual([
        mealId,
        // A Classic id and an id-less entry still get derived ids.
        await rowId(ACCOUNT, "co_zClassicMeal"),
        expect.not.stringMatching(new RegExp(`^(${mealId}|${weightId})$`)),
        weightId,
      ]);
    });

    it("are only a source key for another account's export", async () => {
      const { db, inserts } = fakeDb();
      await importIntoAccount(db, ACCOUNT, withIds("account-b"), () => {});
      expect(inserts.map(({ id }) => id)).toContain(await rowId(ACCOUNT, mealId));
      expect(inserts.map(({ id }) => id)).toContain(await rowId(ACCOUNT, weightId));
      expect(inserts.map(({ id }) => id)).not.toContain(mealId);
    });

    it("are only a source key in a v1.2 file, which names no account", async () => {
      const { db, inserts } = fakeDb();
      await importIntoAccount(db, ACCOUNT, { ...withIds(), version: "1.2" }, () => {});
      expect(inserts.map(({ id }) => id)).toContain(await rowId(ACCOUNT, mealId));
      expect(inserts.map(({ id }) => id)).not.toContain(mealId);
    });

    it("still count once when the same source id repeats in this account's export", async () => {
      const { db, inserts } = fakeDb();
      const data = { ...withIds(ACCOUNT), mealEntries: [meal("A", mealId), meal("A", mealId)] };
      const result = await importIntoAccount(db, ACCOUNT, data, () => {});
      expect(result.duplicatesSkipped).toBe(1);
      expect(inserts.filter(({ table }) => table === app.mealEntries)).toHaveLength(1);
    });
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
