import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount, useSavePasskey } from "@/lib/account";
import { dismissPasskeyOffer, hasSavedPasskey, isPasskeyOfferDismissed } from "@/lib/passkey";

/**
 * After first use, offer once to save a passkey for a new account. Dismissing it
 * hides it for good on this browser; Settings always has the same button.
 */
export function PasskeyOffer() {
  const { accountId, profile } = useAccount();
  const { save, state } = useSavePasskey();
  const [dismissed, setDismissed] = useState(
    () => !!accountId && isPasskeyOfferDismissed(accountId),
  );

  if (dismissed || !accountId || profile?.setupStatus !== "native" || hasSavedPasskey(accountId)) {
    return null;
  }

  const dismiss = () => {
    dismissPasskeyOffer(accountId);
    setDismissed(true);
  };

  return (
    <section
      aria-label="Save a passkey"
      className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"
    >
      <p className="flex-1 text-muted-foreground">
        {state === "error"
          ? "Couldn't save a passkey. Please try again."
          : "Save a passkey to get back into your account on another device or after logging out."}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={dismiss}>
          Not now
        </Button>
        <Button size="sm" onClick={save} disabled={state === "saving"}>
          Save a passkey
        </Button>
      </div>
    </section>
  );
}
