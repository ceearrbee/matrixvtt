/**
 * MatrixVTT Service Worker
 * Cache strategy:
 *   /_matrix/* → network-first (Matrix sync must always be live)
 *   everything else → cache-first, runtime-populate on first fetch
 */

// The cache key carries the package.json version so every deploy
// invalidates the previous shell cache automatically. The
// `__BUILD_VERSION__` placeholder is substituted at build time by
// the `deployMetaPlugin` in vite.config.js. In dev (vite serves
// public/ verbatim) the literal placeholder string is used as the
// key - fine because IS_DEV_HOST self-destructs the SW on localhost
// anyway, so no real caching ever happens here.
const SHELL = 'mvtt-shell-__BUILD_VERSION__';

const PRECACHE = [
  '__BASE_URL__app.html',
  '__BASE_URL__manifest.json',
  '__BASE_URL__icon.svg'
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
// On localhost we never want a SW alive - it precaches app.html and
// serves a stale module graph across file deletions. If this worker
// wakes up on a dev host, it tears itself down: clears every cache,
// unregisters, and drops each open tab's controller so the very next
// reload is a plain network fetch.
const IS_DEV_HOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.port === '5173';

async function selfDestruct() {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) client.navigate(client.url).catch(() => {});
}

self.addEventListener('install', event => {
  if (IS_DEV_HOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  if (IS_DEV_HOST) {
    event.waitUntil(selfDestruct());
    return;
  }
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // In development (localhost), always go to network so edits are visible immediately
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Matrix API → network only (never cache: stale sync tokens and auth would break things)
  if (url.pathname.startsWith('/_matrix/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Docs site is a separate VitePress build with content-hashed assets; it
  // manages its own cache invalidation. If we cached it here, stale HTML would
  // keep pointing at asset hashes that no longer exist after redeploy -
  // VitePress's chunk-error guard then reloads the page and gets the same
  // stale HTML back from us, producing an infinite reload loop.
  if (url.pathname.startsWith('__BASE_URL__docs/')) return;

  // HTML navigations → network-first so a fresh deploy is picked up
  // immediately; fall back to cache when offline. App chunks are
  // content-hashed, so the HTML is the only thing that can go stale.
  if (request.mode === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else → cache-first, populate cache on miss
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache successful same-origin or CORS responses
        if (response.ok && (url.origin === self.location.origin || response.type === 'basic')) {
          const clone = response.clone();
          caches.open(SHELL).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
