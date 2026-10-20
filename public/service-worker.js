const CACHE_NAME = "virtual-na-cache-v5";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/logo.png", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith("virtual-na-cache-") && name !== CACHE_NAME)
      .map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Meeting and helpline data refresh independently of the application shell.
  if (!STATIC_ASSETS.includes(url.pathname)) return;
  const update = caches.open(CACHE_NAME).then(async cache => {
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  });
  event.waitUntil(update.catch(() => {}));
  event.respondWith(caches.match(event.request).then(cached => cached || update));
});
