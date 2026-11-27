import { describe, expect, it } from "vitest";
import { formatDeviceKey, routePasskeyHandle } from "../passkey";

/** authenticatorData with the given flags byte (offset 32). */
function authData(flags: number): Uint8Array {
  const bytes = new Uint8Array(37);
  bytes[32] = flags;
  return bytes;
}
const UP = 0x01;
const UV = 0x04;
const bytes = (length: number) => Uint8Array.from({ length }, (_, i) => i);

describe("routePasskeyHandle", () => {
  it("routes a 32-byte handle to restore, as the device key BrowserPasskeyBackup saved", () => {
    const route = routePasskeyHandle(bytes(32).buffer, authData(UP | UV));
    expect(route).toEqual({ kind: "restore", deviceKey: formatDeviceKey(bytes(32)) });
  });

  it("refuses a 32-byte restore without user verification", () => {
    expect(routePasskeyHandle(bytes(32), authData(UP)).kind).toBe("error");
  });

  it("routes a 51-byte handle to Classic, with or without user verification", () => {
    expect(routePasskeyHandle(bytes(51), authData(UP)).kind).toBe("classic");
    expect(routePasskeyHandle(bytes(51), authData(UP | UV)).kind).toBe("classic");
  });

  it.each([0, 16, 31, 33, 50, 52, 64])("shows an error for a %i-byte handle", (length) => {
    const route = routePasskeyHandle(bytes(length), authData(UP | UV));
    expect(route.kind).toBe("error");
  });

  it("shows an error when the passkey has no user handle", () => {
    expect(routePasskeyHandle(null, authData(UP | UV)).kind).toBe("error");
  });
});

describe("formatDeviceKey", () => {
  it("matches Jazz's device key format: prefix plus unpadded base64url", () => {
    // 32 bytes of 0xff encode to 42 "_" and a final "8" in base64url.
    expect(formatDeviceKey(new Uint8Array(32).fill(0xff))).toBe(`jazz-auth-v1:${"_".repeat(42)}8`);
    // Checked against the platform's own base64 encoder rather than a hard-coded key.
    const base64url = btoa(String.fromCharCode(...bytes(32)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    expect(formatDeviceKey(bytes(32))).toBe(`jazz-auth-v1:${base64url}`);
  });
});
