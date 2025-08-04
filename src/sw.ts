/* eslint-disable no-restricted-globals */
// Minimal, iOS-friendly Service Worker for Vite app with versioned caches and immediate activation

// Ensure TS uses ServiceWorker global types without relying on lib.dom.serviceworker
export {};

// Provide minimal type aliases when lib.dom doesn't include SW types at build time
type SWExtendableEvent = Event & { waitUntil(promise: Promise<any> | any): void };
type SWFetchEvent = Event & { request: Request; respondWith(response: Promise<Response> | Response): void };
type SWMessageEvent = Event & { data: any };

// Narrow self to a generic worker-like global without importing ServiceWorkerGlobalScope
declare const self: {
  skipWaiting: () => Promise<void> | void;
  clients: { claim: () => Promise<void> | void };
  location: Location;
  addEventListener: (type: string, listener: (ev: any) => any) => void;
};

// VERSION is injected at build time by Vite define. Fallback for dev.
declare const __BUILD_HASH__: string;
const VERSION = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev-' + Date.now();
const CACHE_NAME = `calgram-cache-${VERSION}`;

// Core routes to precache (keep minimal; Vite assets are hashed and runtime-cached)
const CORE_ASSETS: string[] = [
  '/',
];

// Utility: log with version
const log = (...args: any[]) => console.log('[sw]', VERSION, ...args);

// Install: pre-cache minimal shell
self.addEventListener('install', (event: SWExtendableEvent) => {
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
self.addEventListener('activate', (event: SWExtendableEvent) => {
  log('activate');
  event.waitUntil(
    (async () => {
      // Delete old versioned caches
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
    })()
  );
});

// Message channel for SKIP_WAITING
self.addEventListener('message', (event: SWMessageEvent) => {
  const data = event.data;
  if (data && data.type === 'SKIP_WAITING') {
    log('received SKIP_WAITING');
    self.skipWaiting();
  }
});

// Strategy helpers
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    // For successful responses, update cache
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err as any;
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      // Only cache OK responses
      if (response && response.status === 200 && request.method === 'GET') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || new Response(null, { status: 504 }));

  // Ensure we always return a Response
  if (cached) return cached;
  return await networkPromise;
}

// Fetch handler:
// - HTML: network-first to pick up new deployments
// - Assets (hashed): stale-while-revalidate for speed
// - Others: pass-through
self.addEventListener('fetch', (event: SWFetchEvent) => {
  const req = event.request as Request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // HTML documents
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets: JS/CSS/Images
  if (['script', 'style', 'image', 'font'].includes((req as any).destination)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Default: try cache falling back to network
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
