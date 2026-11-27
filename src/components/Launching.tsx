import { RouterProvider } from "react-router-dom";
import { OpeningAccount } from "@/lib/account";
import { hasReadyHint } from "@/lib/launchHint";
import { router } from "@/router";

/**
 * What a launch shows while the session starts (or the migration check runs): the
 * app shell when this device's account was ready last time, else "Loading…".
 */
export function Launching() {
  if (hasReadyHint()) {
    return (
      <OpeningAccount>
        <RouterProvider router={router} />
      </OpeningAccount>
    );
  }
  return <output className="block p-8 text-center text-sm text-muted-foreground">Loading…</output>;
}
