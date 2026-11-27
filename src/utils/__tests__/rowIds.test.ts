import { describe, it, expect } from "vitest";
import { rowId } from "../rowIds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("rowId", () => {
  it("returns the same UUID for the same account and source key", async () => {
    expect(await rowId("co_zAccountA", "co_zMeal1")).toBe(await rowId("co_zAccountA", "co_zMeal1"));
  });

  it("gives a different UUID for a different account", async () => {
    expect(await rowId("co_zAccountA", "co_zMeal1")).not.toBe(
      await rowId("co_zAccountB", "co_zMeal1"),
    );
  });

  it("returns a valid UUID with version and variant bits set", async () => {
    expect(await rowId("co_zAccountA", "co_zMeal1")).toMatch(UUID);
  });

  it("is pinned to the spike's construction (stored ids must never change)", async () => {
    // SHA-256 of "calgram/rows/v1|co_zAccountA|co_zMeal1", first 16 bytes, version 5, variant 10.
    expect(await rowId("co_zAccountA", "co_zMeal1")).toBe("6bab7d9a-ad26-5dd3-8091-a2ee48a30ea5");
  });
});
