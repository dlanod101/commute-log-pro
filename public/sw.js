const SW_VERSION = "__SW_VERSION__";
const CACHE = `t-data-${SW_VERSION}`;
const OFFLINE_URL = "/app";
const PRECACHE = ["/logo.png", "/manifest.webmanifest"];

function isLocalDev() {
  const host = self.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE);
      try {
        await cache.add(OFFLINE_URL);
      } catch {
        /* /app may not exist until first deploy */
      }
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[sw] activated", SW_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Dev: never intercept — keeps Vite HMR and login working on localhost.
  if (isLocalDev()) return;

  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/@") ||
    url.pathname.includes("__vite") ||
    url.pathname.includes("/node_modules/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return (await caches.match(OFFLINE_URL)) || fetch(event.request);
        }
        return Response.error();
      }),
  );
});
