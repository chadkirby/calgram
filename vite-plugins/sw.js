// Sammygram's service worker. It serves the app's own files from a cache, so opening
// the app needs no network; Jazz then reads the data stored on this device.
//
// Updates: the browser fetches this file on each launch. A new build installs its cache
// in the background and waits. The page (src/lib/appUpdate.ts) asks it to take over
// ("skip-waiting") when the app opens or returns to the screen, or when a file the old
// build needs has gone from the server, and reloads once it has; every open page of the
// old build reloads with it, so none is left without its chunks.
//
// The build (vite-plugins/service-worker.ts) replaces the line below with the real list.
const BUILD = { version: "dev", files: [] };

const CACHE = `sammygram-${BUILD.version}`;
const PRECACHED = new Set(BUILD.files);

// The page asks a waiting build to take over (src/lib/appUpdate.ts).
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  // All or nothing, straight from the server: a half-filled or stale cache never installs.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(BUILD.files.map((url) => new Request(url, { cache: "reload" }))),
      ),
  );
});

/**
 * Drop earlier builds' caches. Safe whenever this worker is active: it activates only
 * once no page of an earlier build is open, or when a page asked it to take over, and
 * then every open page reloads onto this build.
 */
const deleteOldCaches = () =>
  caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("sammygram-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      ),
    );

// Activation often happens as the last old page closes (the app being killed), and the
// cleanup can be cut short there, so each launch this worker serves tidies up too.
self.addEventListener("activate", (event) => event.waitUntil(deleteOldCaches()));

/** The cached copy of `path`, or the network if it's somehow missing. */
const fromCache = (path, request) =>
  caches.open(CACHE).then((cache) => cache.match(path).then((hit) => hit ?? fetch(request)));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Sync and the Worker's API always go to the server.
  if (url.pathname.startsWith("/jazz") || url.pathname.startsWith("/api/")) return;

  const isFile =
    url.pathname !== "/" && (PRECACHED.has(url.pathname) || /\.\w+$/.test(url.pathname));
  if (request.mode === "navigate" && !isFile) {
    // An app route: every route is served by the page itself.
    event.respondWith(fromCache("/", request));
    // Not while a newer build is installing or waiting: its cache isn't ours to drop.
    if (!self.registration.installing && !self.registration.waiting) {
      event.waitUntil(deleteOldCaches());
    }
  } else if (PRECACHED.has(url.pathname)) {
    // One of the app's files, loaded by the page or opened directly (an icon, say).
    event.respondWith(fromCache(url.pathname, request));
  }
  // Anything else (sw.js, other files) goes to the network as usual.
});
