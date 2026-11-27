import { JazzProvider } from "jazz-tools/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Launching } from "./components/Launching.tsx";
import "./index.css";
import { SignedInAccount, SignedOutAccount } from "./lib/account.tsx";
import { getJazzSession } from "./lib/jazz.ts";
import { registerServiceWorker } from "./lib/appUpdate.ts";
import { MigrationGate } from "./migration/MigrationGate.tsx";
import { migrateClassicSession } from "./migration/migrate.ts";
import { router } from "./router.tsx";

// Before the first render, so a returning user never sees the welcome screen (R4).
migrateClassicSession();

// Production only: the service worker serves the app's files from this device, so a
// launch needs no network, and a new build takes over when one is deployed.
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MigrationGate>
      <JazzProvider
        session={getJazzSession()}
        loading={<Launching />}
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
