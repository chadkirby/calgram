import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "../LandingPage";

const startNewAccount = vi.hoisted(() => vi.fn<(firstName: string) => Promise<void>>());

vi.mock("@/lib/account", () => ({
  useAccount: () => ({ status: "signed-out", saveProfile: () => {} }),
  startNewAccount,
  signInWithPasskey: vi.fn<() => Promise<unknown>>(),
  nativeSetup: vi.fn<() => object>(),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ networkStatus: { isOnline: true } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === name)!;

describe("LandingPage", () => {
  it("shows a failed Start inside the name dialog, tied to its form", async () => {
    startNewAccount.mockRejectedValueOnce(new Error("no storage"));
    act(() => root.render(<LandingPage />));

    act(() => button("Start").click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();

    await act(async () => button("Continue").click());

    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe("Couldn't start. Please try again.");
    const form = dialog.querySelector("form")!;
    expect(form.getAttribute("aria-describedby")).toBe(alert!.id);
    // Shown once: not also behind the dialog.
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
});
