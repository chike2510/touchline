// ============================================================================
// Service worker for Touchline. Strategy:
//   - App-shell routes + manifest + icons are precached on install.
//   - Navigation requests: network-first (pick up new deploys when online),
//     falling back to the cached page, then to the cached "/" shell so the
//     app still opens offline even on a route that wasn't precached yet.
//   - Static assets (_next/static, fonts, images): cache-first, since their
//     filenames are content-hashed by Next.js and never change in place.
//   - Everything else (e.g. any future same-origin GET): stale-while-
//     revalidate as a reasonable default.
//
// IMPORTANT: bump CACHE_VERSION whenever you change this file's caching
// logic, so old clients don't get stuck on a stale strategy.
// ============================================================================
const CACHE_VERSION = "v1";
const SHELL_CACHE = `touchline-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `touchline-runtime-${CACHE_VERSION}`;

// These match the static export's route folders (see next.config.js
// `output: "export"`). Add new top-level routes here as they're built.
const PRECACHE_URLS = [
  "/",
  "/inbox",
  "/squad",
  "/transfers",
  "/club",
  "/matchday",
  "/settings",
  "/new-game",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        // Don't fail the whole install if one precache URL 404s (e.g. a
        // route added to this list before it's actually built yet) — log
        // and continue so the rest of the shell still gets cached.
        console.warn("[sw] some precache URLs failed:", err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // never cache mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin (fonts CDN etc.)

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/")) || Response.error();
        })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Stale-while-revalidate default for anything else same-origin.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
