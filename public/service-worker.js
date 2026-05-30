const CACHE_NAME = “virtual-na-meeting-finder-v1”;

const FILES_TO_CACHE = [
“/”,
“/index.html”,
“/manifest.json”,
“/icon-192.png”,
“/icon-512.png”
];

self.addEventListener(“install”, event => {
event.waitUntil(
caches.open(CACHE_NAME).then(cache => {
return cache.addAll(FILES_TO_CACHE);
})
);
});

self.addEventListener(“fetch”, event => {
event.respondWith(
fetch(event.request).catch(() => caches.match(event.request))
);
});
