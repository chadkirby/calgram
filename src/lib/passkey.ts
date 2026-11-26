import { BrowserPasskeyBackup } from "jazz-tools/passkey-backup";
import { APPLICATION_NAME } from "./jazz";

/**
 * What a calgram passkey holds, told apart by the length of its user handle (KTD7):
 * - 32 bytes: a Jazz 2 device key saved with `BrowserPasskeyBackup`. Restore it.
 * - 51 bytes: a Classic passkey (32-byte seed plus 19-byte account id).
 * - anything else: not a calgram passkey.
 */
export type PasskeyRoute =
  | { kind: "restore"; deviceKey: string }
  | { kind: "classic"; handle: Uint8Array }
  | { kind: "error"; message: string };

const DEVICE_KEY_BYTES = 32;
const CLASSIC_HANDLE_BYTES = 51;
const DEVICE_KEY_PREFIX = "jazz-auth-v1:";
const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;

/**
 * A device key in the form `exportDeviceKey()` returns and `BrowserPasskeyBackup`
 * restores: the prefix and 32 bytes as unpadded base64url. jazz-tools doesn't export
 * its own formatter, so this mirrors it; the passkey E2E proves they agree.
 */
export function formatDeviceKey(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64url = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return DEVICE_KEY_PREFIX + base64url;
}

const asBytes = (data: ArrayBuffer | Uint8Array) =>
  data instanceof Uint8Array ? data : new Uint8Array(data);

/**
 * Route a passkey assertion by its user handle. `authenticatorData` carries the
 * flags byte at offset 32; only a Jazz 2 restore requires user verification, so
 * Classic passkeys on security keys without it still work.
 */
export function routePasskeyHandle(
  userHandle: ArrayBuffer | Uint8Array | null,
  authenticatorData: ArrayBuffer | Uint8Array,
): PasskeyRoute {
  if (userHandle === null) {
    return { kind: "error", message: "That passkey isn't a calgram account passkey." };
  }
  const handle = asBytes(userHandle);
  if (handle.byteLength === CLASSIC_HANDLE_BYTES) return { kind: "classic", handle };
  if (handle.byteLength !== DEVICE_KEY_BYTES) {
    return { kind: "error", message: "That passkey isn't a calgram account passkey." };
  }
  const flags = asBytes(authenticatorData)[32] ?? 0;
  if ((flags & USER_PRESENT) === 0 || (flags & USER_VERIFIED) === 0) {
    return { kind: "error", message: "Your device didn't verify it's you. Please try again." };
  }
  return { kind: "restore", deviceKey: formatDeviceKey(handle) };
}

/** One passkey prompt for any calgram passkey on this site, routed by `routePasskeyHandle`. */
export async function promptForPasskey(): Promise<PasskeyRoute> {
  if (!globalThis.navigator?.credentials || typeof PublicKeyCredential === "undefined") {
    return { kind: "error", message: "This browser doesn't support passkeys." };
  }
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({
      publicKey: { challenge, rpId: location.hostname, userVerification: "preferred" },
    });
  } catch (error) {
    console.warn("Passkey prompt failed:", error);
    return { kind: "error", message: "No passkey was used. Please try again." };
  }
  if (!(credential instanceof PublicKeyCredential)) {
    return { kind: "error", message: "No passkey was used. Please try again." };
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return routePasskeyHandle(response.userHandle, response.authenticatorData);
}

/** Save this account's device key in a new passkey, so it can be restored elsewhere. */
export async function savePasskey(deviceKey: string, accountId: string, firstName?: string) {
  const label = `Sammygram (${firstName?.trim() || "User"})`;
  await new BrowserPasskeyBackup({ appName: APPLICATION_NAME }).backup(deviceKey, label);
  markPasskeySaved(accountId);
}

// Per-account flags kept in this browser only. Keyed by account id, so the next
// account on this browser never inherits them.
const savedKey = (accountId: string) => `calgram-passkey-saved:${accountId}`;
const dismissedKey = (accountId: string) => `calgram-passkey-offer-dismissed:${accountId}`;

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "true");
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable: the offer just shows again.
  }
}

export const hasSavedPasskey = (accountId: string) => readFlag(savedKey(accountId));
export const markPasskeySaved = (accountId: string) => writeFlag(savedKey(accountId), true);
export const isPasskeyOfferDismissed = (accountId: string) => readFlag(dismissedKey(accountId));
export const dismissPasskeyOffer = (accountId: string) => writeFlag(dismissedKey(accountId), true);

/** Forget this browser's flags for an account that signed out. */
export function forgetPasskeyFlags(accountId: string) {
  writeFlag(savedKey(accountId), false);
  writeFlag(dismissedKey(accountId), false);
}
