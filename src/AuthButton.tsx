import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOut, useAccount, useSavePasskey } from "@/lib/account";
import { hasSavedPasskey } from "@/lib/passkey";

const buttonClass =
  "bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md touch-manipulation";

export function AuthButton() {
  const { status, accountId, profile } = useAccount();
  const navigate = useNavigate();
  const { save, state: saveState } = useSavePasskey();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    setError(null);
    try {
      await signOut(profile);
      setConfirming(false);
      navigate("/", { replace: true });
    } catch (e) {
      console.error("Log out failed:", e);
      const message =
        "Couldn't log out: some changes haven't reached the server yet. Try again when online.";
      if (confirming) setError(message);
      else window.alert(message);
    }
  }

  function handleLogOut() {
    // A native account with no saved passkey can't be recovered after logging out.
    if (profile?.setupStatus === "native" && accountId && !hasSavedPasskey(accountId)) {
      setConfirming(true);
      return;
    }
    void logOut();
  }

  async function saveThenLogOut() {
    if (await save()) await logOut();
  }

  if (status === "signed-out") {
    return (
      <button className={buttonClass} onClick={() => navigate("/")}>
        Log in
      </button>
    );
  }

  return (
    <>
      <button className={buttonClass} onClick={handleLogOut} title="Log out">
        <span className="sm:hidden">Logout</span>
        <span className="hidden sm:inline">Log out</span>
      </button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save a passkey before you log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Without a passkey you can't get back into this account after logging out, and its
              meals and weigh-ins would be lost to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(error || saveState === "error") && (
            <p role="alert" className="text-sm text-destructive">
              {error ?? "Couldn't save a passkey. Please try again."}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={logOut}>
              Log out without a passkey
            </Button>
            <Button onClick={saveThenLogOut} disabled={saveState === "saving"}>
              Save a passkey
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
