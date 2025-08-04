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
		if (!("serviceWorker" in navigator)) return;
		const registerSW = async () => {
			console.log("Registering service worker...");
			try {
				const reg = await navigator.serviceWorker.register("/sw.js", {
					scope: "/",
				});
				console.log("SW registered", reg);
				reg.addEventListener("updatefound", () => {
					const newWorker = reg.installing;
					console.log("SW update found", newWorker?.state);
					if (!newWorker) return;
					newWorker.addEventListener("statechange", () => {
						console.log("SW state", newWorker.state);
						if (newWorker.state === "installed" && reg.waiting) {
							reg.waiting.postMessage({ type: "SKIP_WAITING" });
							window.location.reload();
						}
					});
				});
				if (reg.waiting) {
					reg.waiting.postMessage({ type: "SKIP_WAITING" });
					window.location.reload();
				}
				navigator.serviceWorker.addEventListener("controllerchange", () => {
					console.log("SW controller changed");
				});
			} catch (e) {
				console.warn("SW registration failed", e);
			}
		};
		if (document.readyState === "complete") {
			registerSW();
		} else {
			window.addEventListener("load", registerSW, { once: true });
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
