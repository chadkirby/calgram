/**
 * Keeps the installed app on the deployed build.
 *
 * The service worker (vite-plugins/sw.js) serves the app from a cache, and a new
 * build installs in the background and waits. A home-screen app or a Safari tab is
 * suspended rather than closed, so without help it would wait forever, and the old
 * page fails once it needs a file the deploy removed (the Classic migration's chunk,
 * which isn't cached).
 *
 * So the page switches to a waiting build, by asking it to take over and reloading
 * once it has, when:
 * - the app opens or comes back to the screen, and a new build is waiting or finishes
 *   installing within a few seconds (before anyone is mid-task);
 * - a file fails to load (`vite:preloadError`): the build it belongs to is gone.
 */

/** How long after opening or returning to the app a new build still takes over. */
const FRESH_MS = 10_000;

/** sessionStorage: when this tab last reloaded for a missing file, so it can't loop. */
const RELOADED_AT_KEY = "sammygram-reloaded-for-missing-file";

let shownAt = Date.now();
let reloading = false;

function takeOver(worker: ServiceWorker | null | undefined) {
  // ServiceWorker.postMessage has no target origin: the worker is this origin's own.
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  worker?.postMessage("skip-waiting");
}

/** Hand over to `worker` as soon as it has installed, if that's still `soon`. */
function whenInstalled(worker: ServiceWorker | null, soon: () => boolean) {
  if (!worker) return;
  const check = () => {
    if (worker.state !== "installed") return;
    worker.removeEventListener("statechange", check);
    if (soon()) takeOver(worker);
  };
  worker.addEventListener("statechange", check);
  check();
}

function onShown(registration: ServiceWorkerRegistration) {
  shownAt = Date.now();
  takeOver(registration.waiting);
  const fresh = () => Date.now() - shownAt < FRESH_MS;
  registration
    .update()
    .then(() => whenInstalled(registration.installing, fresh))
    .catch(() => {}); // offline: keep the build we have
}

/** Reload, unless this tab already did for a missing file a minute ago. */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY));
    if (Date.now() - last < 60_000) return; // reloaded just now: a real network failure
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    return;
  }
  location.reload();
}

/** A file failed to load: switch to the new build, or reload once if there isn't one. */
function onMissingFile(registration: ServiceWorkerRegistration | undefined) {
  if (registration?.waiting) return takeOver(registration.waiting);
  if (!registration) return reloadOnce();
  registration
    .update()
    .then(() => {
      const installing = registration.installing ?? registration.waiting;
      if (installing) whenInstalled(installing, () => true);
      else reloadOnce();
    })
    .catch(() => {}); // offline: nothing newer to fetch
}

/** Production only: in dev, a service worker would keep serving a stale build. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  let registration: ServiceWorkerRegistration | undefined;

  // The new build took over this tab: load it. Not on a first install, which has no
  // earlier controller and never takes over (no clients.claim).
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener("vite:preloadError", () => onMissingFile(registration));

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registered) => {
        registration = registered;
        onShown(registered);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") onShown(registered);
        });
      })
      .catch((error: unknown) => console.warn("Service worker registration failed:", error));
  });
}
