import { formatDeviceKey } from "@/lib/passkey";

/**
 * Who a returning user was on Classic, and the Jazz 2 key that identity opens (KTD4).
 * Nothing here imports Classic code: PR D removes the Classic reader but keeps this,
 * because a Classic passkey stays the recovery key for the derived Jazz 2 account.
 */
export interface ClassicIdentity {
  /** The 32-byte Classic secret seed: the root of both accounts. */
  seed: Uint8Array;
  accountId: string;
}

/** Where Classic keeps its signed-in session in `localStorage`. */
export const CLASSIC_SESSION_KEY = "jazz-logged-in-secret";

const SEED_BYTES = 32;
const ACCOUNT_ID_BYTES = 19;

/**
 * The Classic session in `storage`, when it is a real sign-in (KTD13). Classic writes a
 * session for every visitor, anonymous ones included, so it only counts when it parses,
 * names an account, holds a 32-byte seed, and its provider isn't `anonymous`.
 */
export function readClassicSession(storage: Pick<Storage, "getItem"> = localStorage) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(CLASSIC_SESSION_KEY) ?? "null");
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const { accountID, secretSeed, provider } = parsed as Record<string, unknown>;
  if (provider === "anonymous" || typeof accountID !== "string" || !accountID.startsWith("co_z")) {
    return undefined;
  }
  if (
    !Array.isArray(secretSeed) ||
    secretSeed.length !== SEED_BYTES ||
    !secretSeed.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    return undefined;
  }
  return { seed: Uint8Array.from(secretSeed as number[]), accountId: accountID };
}

export function findClassicSession(): ClassicIdentity | undefined {
  try {
    return readClassicSession();
  } catch {
    return undefined;
  }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += BASE58[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58[digits[i]];
  return out;
}

/**
 * The identity in a 51-byte Classic passkey handle: the 32-byte seed, then the 19 raw
 * bytes of the account id, which Classic writes as `co_z` plus their base58 (KTD7).
 */
export function classicIdentityFromHandle(handle: Uint8Array): ClassicIdentity {
  if (handle.byteLength !== SEED_BYTES + ACCOUNT_ID_BYTES) {
    throw new Error(`A Classic passkey handle is 51 bytes, not ${handle.byteLength}`);
  }
  return {
    seed: handle.slice(0, SEED_BYTES),
    accountId: `co_z${base58(handle.slice(SEED_BYTES))}`,
  };
}

/** HKDF info for KTD4. A stored-data format: changing it opens different accounts. */
const DEVICE_KEY_INFO = "calgram/jazz2-device-key/v1";

/**
 * The Jazz 2 device key a Classic seed opens (KTD4): HKDF-SHA256 over the 32 seed
 * bytes, with an empty salt and `calgram/jazz2-device-key/v1` as info, 32 bytes long.
 * The same seed always gives the same key, so every device lands in one account.
 */
export async function deriveDeviceKey(seed: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", Uint8Array.from(seed), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(DEVICE_KEY_INFO),
    },
    material,
    256,
  );
  return formatDeviceKey(new Uint8Array(bits));
}
