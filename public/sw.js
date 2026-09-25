const SHELL_CACHE = "routepilot-shell-v1";
const DATA_CACHE = "routepilot-public-data-v1";
const SHELL = ["/", "/centres", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isPublicData = url.pathname.startsWith("/api/v1/routes/") || url.pathname.startsWith("/api/v1/exam-centres");
  if (isPublicData) {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(DATA_CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request)));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))));
  }
});
