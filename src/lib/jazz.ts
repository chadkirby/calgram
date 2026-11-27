import { startJazzClient, type JazzClient, type JazzSession } from "jazz-tools/react";

/** Identifies the app in passkey prompts. */
export const APPLICATION_NAME = "Sammygram Calorie Tracker";

let session: JazzSession<JazzClient> | undefined;

/**
 * This browser's Jazz 2 session, opened on first use. The app owns it (rather than
 * `<JazzProvider config>`) so Start can write the profile right after creating the
 * account, before React has switched to the signed-in tree.
 *
 * - `initial: "signed-out"` (KTD8): the app decides whether to create an account.
 * - `clearOnSignOut`: signing out forgets this browser's account key and local data.
 */
export function getJazzSession(): JazzSession<JazzClient> {
  session ??= startJazzClient({
    serverUrl: "/jazz",
    initial: "signed-out",
    client: () => import("jazz-tools/local-first"),
    localFirst: "now",
    clearOnSignOut: true,
  });
  return session;
}
