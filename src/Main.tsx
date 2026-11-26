import { JazzProvider } from "jazz-tools/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { SignedInAccount, SignedOutAccount } from "./lib/account.tsx";
import { getJazzSession } from "./lib/jazz.ts";
import { router } from "./router.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
  </StrictMode>,
);
