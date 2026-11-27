import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAll, useDb, useJazzSession } from "jazz-tools/react";
import { app, type ProfileInsert } from "../../jazz/jazz.generated";
import { toProfile, type Profile } from "./data";
import { getJazzSession } from "./jazz";
import { forgetPasskeyFlags, markPasskeySaved, promptForPasskey, savePasskey } from "./passkey";

/**
 * Where this visitor is (plan's visit flowchart, PR B subset):
 * - `signed-out`: no Jazz 2 account in this browser. Show the welcome screen.
 * - `checking`: signed in, the setup status isn't known yet (still loading, or
 *   waiting for the server to confirm it's missing).
 * - `needs-setup`: signed in, and the server confirms there's no setup status.
 * - `ready`: setup status present. Show the app.
 */
export type AccountStatus = "signed-out" | "checking" | "needs-setup" | "ready";

export interface AccountState {
  status: AccountStatus;
  accountId?: string;
  profile?: Profile;
  /** Write fields to this account's profile row, creating it if there is none. */
  saveProfile(patch: ProfileInsert): void;
}

const signedOut: AccountState = {
  status: "signed-out",
  saveProfile: () => {
    throw new Error("No account is signed in");
  },
};

const AccountContext = createContext<AccountState>(signedOut);

export const useAccount = () => useContext(AccountContext);

export function SignedOutAccount({ children }: { children: React.ReactNode }) {
  return <AccountContext.Provider value={signedOut}>{children}</AccountContext.Provider>;
}

const firstWithStatus = (rows: Profile[] | undefined) =>
  rows?.find((row) => row.setupStatus) ?? rows?.[0];

/**
 * The signed-in account and its setup status (KTD6). A status in the local copy is
 * trusted, so the app works offline. A missing one only counts once a remote read
 * confirms the server has none; until then (and offline) the status is `checking`.
 */
export function SignedInAccount({ children }: { children: React.ReactNode }) {
  const db = useDb();
  const { user } = useJazzSession();
  const { data } = useAll(app.profile);
  const local = useMemo(() => data?.map(toProfile), [data]);
  const localProfile = firstWithStatus(local);
  const [remote, setRemote] = useState<Profile[]>();

  const confirmWithServer = local !== undefined && !localProfile?.setupStatus;
  useEffect(() => {
    if (!confirmWithServer) return;
    let live = true;
    db.all(app.profile, { tier: "remote" }).then(
      (rows) => live && setRemote(rows.map(toProfile)),
      (error: unknown) => console.warn("Couldn't read the profile from the server:", error),
    );
    return () => {
      live = false;
    };
  }, [db, confirmWithServer]);

  const remoteProfile = firstWithStatus(remote);
  const profile = localProfile?.setupStatus
    ? localProfile
    : remoteProfile?.setupStatus
      ? remoteProfile
      : (localProfile ?? remoteProfile);

  const status: AccountStatus =
    local === undefined
      ? "checking"
      : profile?.setupStatus
        ? "ready"
        : remote === undefined
          ? "checking"
          : "needs-setup";

  const saveProfile = useCallback(
    (patch: ProfileInsert) => {
      if (profile) db.update(app.profile, profile.id, patch);
      else db.insert(app.profile, patch);
    },
    [db, profile],
  );

  const value = useMemo(
    () => ({ status, accountId: user?.accountId, profile, saveProfile }),
    [status, user?.accountId, profile, saveProfile],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** The profile fields "Start" writes: the first name, and setup status `native` (KTD6). */
export function nativeSetup(firstName: string): ProfileInsert {
  const name = firstName.trim() || null;
  return { firstName: name, name, setupStatus: "native" };
}

/**
 * "Start": create a device account in this browser and write its profile. Runs from
 * the click, not an effect, so it can't run twice.
 */
export async function startNewAccount(firstName: string) {
  const session = getJazzSession();
  await session.createDeviceAccount();
  session.db.insert(app.profile, nativeSetup(firstName));
}

export type ReturningResult =
  | { kind: "restored" }
  | { kind: "classic" }
  | { kind: "error"; message: string };

/** "I've used Sammygram before": one passkey prompt, routed by its handle (KTD7). */
export async function signInWithPasskey(): Promise<ReturningResult> {
  const route = await promptForPasskey();
  if (route.kind !== "restore") return route;
  const session = getJazzSession();
  try {
    await session.restoreDeviceAccount(route.deviceKey);
  } catch (error) {
    console.error("Restoring the account failed:", error);
    return { kind: "error", message: "Couldn't open that account. Please try again." };
  }
  const accountId = session.getSnapshot().user?.accountId;
  if (accountId) markPasskeySaved(accountId);
  return { kind: "restored" };
}

/** Save the signed-in account's key in a passkey; tracks progress for the button. */
export function useSavePasskey() {
  const session = useJazzSession();
  const { accountId, profile } = useAccount();
  const firstName = profile?.firstName;
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = useCallback(async () => {
    if (!accountId) return false;
    setState("saving");
    try {
      await savePasskey(session.exportDeviceKey(), accountId, firstName);
      setState("saved");
      return true;
    } catch (error) {
      console.error("Saving a passkey failed:", error);
      setState("error");
      return false;
    }
  }, [session, accountId, firstName]);
  return { save, state };
}

/**
 * Sign out, forgetting this browser's account key, local data and passkey flags. A
 * migrated account also drops the local Classic session, so the next load doesn't
 * sign back in through it; Classic data on the server is untouched (R9).
 */
export async function signOut(profile: Profile | undefined) {
  const session = getJazzSession();
  const accountId = session.getSnapshot().user?.accountId;
  await session.signOut();
  if (accountId) forgetPasskeyFlags(accountId);
  if (profile?.setupStatus === "migrated") {
    try {
      localStorage.removeItem("jazz-logged-in-secret");
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }
}
