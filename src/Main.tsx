import { JazzProvider } from "jazz-tools/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { SignedInAccount, SignedOutAccount } from "./lib/account.tsx";
import { getJazzSession } from "./lib/jazz.ts";
import { MigrationGate } from "./migration/MigrationGate.tsx";
import { migrateClassicSession } from "./migration/migrate.ts";
import { router } from "./router.tsx";

// Before the first render, so a returning user never sees the welcome screen (R4).
migrateClassicSession();

// Production only: the service worker serves the app's files from this device, so a
// launch needs no network (vite-plugins/sw.js). Never in dev, where it would keep
// serving a stale build.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error: unknown) => console.warn("Service worker registration failed:", error));
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MigrationGate>
      <JazzProvider
        session={getJazzSession()}
        loading={
          <output className="block p-8 text-center text-sm text-muted-foreground">Loading…</output>
        }
        signedOut={
          <SignedOutAccount>
            <RouterProvider router={router} />
          </SignedOutAccount>
        }
      >
        <SignedInAccount>
          <RouterProvider router={router} />
        </SignedInAccount>
      </JazzProvider>
    </MigrationGate>
  </StrictMode>,
);
