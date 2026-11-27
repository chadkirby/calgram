/**
 * A note on this device that its account was set up and showing the app. With it, a
 * launch shows the app shell at once instead of "Loading…" and "Checking your
 * account…", and the Daily page fills in as Jazz opens. It is only a hint: the
 * session and the profile row still decide where the visitor ends up.
 */
const KEY = "sammygram-account-ready";

export function hasReadyHint(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberReady() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable: launches show the usual screens.
  }
}

export function forgetReady() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}
