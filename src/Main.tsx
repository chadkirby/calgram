import { JazzReactProvider } from "jazz-tools/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
// import { JazzInspector } from "jazz-tools/inspector";
import { apiKey } from "./apiKey.ts";
import { JazzAccount } from "./schema.ts";
import { router } from "./router.tsx";

// This identifies the app in the passkey auth
export const APPLICATION_NAME = "jazz-react-tailwind-starter";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JazzReactProvider
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
      }}
      AccountSchema={JazzAccount}
    >
      <RouterProvider router={router} />

      {/* <JazzInspector /> */}
    </JazzReactProvider>
  </StrictMode>,
);
