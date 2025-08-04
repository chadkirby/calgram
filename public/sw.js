/* eslint-disable no-restricted-globals */
// Plain JS service worker compiled from src/sw.ts for serving at /sw.js

// VERSION is injected in app builds, but public files are not transformed by Vite.
// Use a safe fallback that still changes across dev sessions.
const VERSION = (typeof self !== 'undefined' && typeof self.__BUILD_HASH__ !== 'undefined')
  ? self.__BUILD_HASH__
  : 'dev-' + Date.now();

const CACHE_NAME = `calgram-cache-${VERSION}`;

// Core routes to precache (keep minimal; Vite assets are hashed and runtime-cached)
const CORE_ASSETS = [
  '/',
];

// Utility: log with version
const log = (...args) => console.log('[sw]', VERSION, ...args);

// Install: pre-cache minimal shell
self.addEventListener('install', (event) => {
  log('install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      // Force this SW to become the active one
      return self.skipWaiting();
    })
  );
});

// Activate: claim clients and clean up old caches
self.addEventListener('activate', (event) => {
  log('activate');
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('calgram-cache-') && k !== CACHE_NAME)
        .map((k) => {
          log('delete old cache', k);
          return caches.delete(k);
        })
    );
    await self.clients.claim();
  })());
});

// Message channel for SKIP_WAITING
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SKIP_WAITING') {
    log('received SKIP_WAITING');
    self.skipWaiting();
  }
});

// Strategy helpers
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && request.method === 'GET') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || new Response(null, { status: 504 }));

  if (cached) return cached;
  return await networkPromise;
}

// Fetch handler:
// - HTML: network-first to pick up new deployments
// - Assets (hashed): stale-while-revalidate for speed
// - Others: pass-through
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // HTML documents
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets: JS/CSS/Images
  if (['script', 'style', 'image', 'font'].includes(req.destination)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: try cache then network
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
