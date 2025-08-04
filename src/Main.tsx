import { JazzReactProvider } from "jazz-tools/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
// import { JazzInspector } from "jazz-tools/inspector";
import { apiKey } from "./apiKey.ts";
import { JazzAccount } from "./schema.ts";
import { router } from "./router.tsx";

// This identifies the app in the passkey auth
export const APPLICATION_NAME = "Sammygram Calorie Tracker";

// Service worker registration with update flow
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          // Use a fixed url in prod build output. We'll emit /sw.js at root.
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

          // If there's an updated SW found
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                // If there's a waiting worker, tell it to skip waiting and reload
                if (reg.waiting) {
                  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  // Reload so the new SW takes control of the page
                  window.location.reload();
                }
              }
            });
          });

          // If a worker is waiting already (page re-open), activate it
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }

          // When the controller changes (new SW took over), ensure we're on latest
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Optional: debounce multiple events
          });
        } catch (e) {
          // Non-fatal: SW might be blocked in dev or non-HTTPS
          console.warn('SW registration failed', e);
        }
      };
      // Delay until after first paint
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JazzReactProvider
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
      }}
      storage="indexedDB"
      AccountSchema={JazzAccount}
    >
      <RouterProvider router={router} />
      <ServiceWorkerRegistrar />
      {/* <JazzInspector /> */}
    </JazzReactProvider>
  </StrictMode>,
);
