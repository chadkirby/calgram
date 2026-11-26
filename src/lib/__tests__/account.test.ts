import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "../account";
import type { Profile } from "../data";
import { dismissPasskeyOffer, markPasskeySaved } from "../passkey";

const session = vi.hoisted(() => ({
  getSnapshot: () => ({ user: { accountId: "account-a" } }),
  signOut: vi.fn<() => Promise<void>>(async () => {}),
}));
vi.mock("../jazz", () => ({ APPLICATION_NAME: "test", getJazzSession: () => session }));

const CLASSIC_SECRET = "jazz-logged-in-secret";

describe("signOut", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLASSIC_SECRET, "classic-secret");
    markPasskeySaved("account-a");
    dismissPasskeyOffer("account-a");
  });

  it("drops a migrated account's Classic session and its passkey flags", async () => {
    await signOut({ setupStatus: "migrated" } as Profile);
    expect(session.signOut).toHaveBeenCalled();
    expect(localStorage.getItem(CLASSIC_SECRET)).toBeNull();
    expect(localStorage.getItem("calgram-passkey-saved:account-a")).toBeNull();
    expect(localStorage.getItem("calgram-passkey-offer-dismissed:account-a")).toBeNull();
  });

  it("leaves the Classic key alone for a native account, but still forgets its flags", async () => {
    await signOut({ setupStatus: "native" } as Profile);
    expect(localStorage.getItem(CLASSIC_SECRET)).toBe("classic-secret");
    expect(localStorage.getItem("calgram-passkey-saved:account-a")).toBeNull();
  });
});
