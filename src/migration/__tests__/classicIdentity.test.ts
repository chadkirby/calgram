import { cojsonInternals } from "jazz-classic";
import { describe, expect, it } from "vitest";
import { formatDeviceKey } from "@/lib/passkey";
import {
  CLASSIC_SESSION_KEY,
  classicIdentityFromHandle,
  deriveDeviceKey,
  readClassicSession,
} from "../classicIdentity";

const seed = (start: number) => Uint8Array.from({ length: 32 }, (_, i) => (start + i) % 256);
const ACCOUNT = "co_zabc123";

/** HMAC-SHA256, for checking HKDF by hand. */
const hmac = async (key: Uint8Array, data: Uint8Array) => {
  const k = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, Uint8Array.from(data)));
};

const storage = (value: unknown) => ({
  getItem: (key: string) =>
    key === CLASSIC_SESSION_KEY && value !== undefined
      ? typeof value === "string"
        ? value
        : JSON.stringify(value)
      : null,
});

describe("readClassicSession (KTD13)", () => {
  const session = { accountID: ACCOUNT, secretSeed: Array.from(seed(1)), accountSecret: "x" };

  it("counts a passkey sign-in", () => {
    expect(readClassicSession(storage({ ...session, provider: "passkey" }))).toEqual({
      seed: seed(1),
      accountId: ACCOUNT,
    });
  });

  it("doesn't count an anonymous visitor's session", () => {
    expect(readClassicSession(storage({ ...session, provider: "anonymous" }))).toBeUndefined();
  });

  it("doesn't count a missing, unparsable or seedless session", () => {
    expect(readClassicSession(storage(undefined))).toBeUndefined();
    expect(readClassicSession(storage("{not json"))).toBeUndefined();
    expect(
      readClassicSession(storage({ accountID: ACCOUNT, provider: "passkey" })),
    ).toBeUndefined();
    expect(
      readClassicSession(storage({ ...session, secretSeed: [1, 2, 3], provider: "passkey" })),
    ).toBeUndefined();
  });
});

describe("classicIdentityFromHandle (KTD7)", () => {
  it("splits a 51-byte handle into the seed and the account id Classic wrote", () => {
    const accountBytes = Uint8Array.from({ length: 19 }, (_, i) => (i === 0 ? 0 : i * 13));
    const handle = new Uint8Array(51);
    handle.set(seed(7));
    handle.set(accountBytes, 32);
    expect(classicIdentityFromHandle(handle)).toEqual({
      seed: seed(7),
      accountId: cojsonInternals.rawCoIDfromBytes(accountBytes),
    });
  });

  it("refuses any other length", () => {
    expect(() => classicIdentityFromHandle(new Uint8Array(32))).toThrow("51 bytes");
  });
});

describe("deriveDeviceKey (KTD4)", () => {
  it("is HKDF-SHA256 over the seed, empty salt, calgram info, 32 bytes", async () => {
    // RFC 5869 by hand: an empty salt is 32 zero bytes, and 32 bytes of output is one block.
    const prk = await hmac(new Uint8Array(32), seed(3));
    const info = new TextEncoder().encode("calgram/jazz2-device-key/v1");
    const expected = await hmac(prk, Uint8Array.from([...info, 1]));
    expect(await deriveDeviceKey(seed(3))).toBe(formatDeviceKey(expected));
  });

  it("gives the same key for the same seed, and another for another seed", async () => {
    expect(await deriveDeviceKey(seed(5))).toBe(await deriveDeviceKey(seed(5)));
    expect(await deriveDeviceKey(seed(5))).not.toBe(await deriveDeviceKey(seed(6)));
  });
});
