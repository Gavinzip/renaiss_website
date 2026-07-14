const PROFILE_CACHE = "renaiss-profile-shell-v17";
const PROFILE_ASSETS = [
  "./profile.html",
  "./profile.webmanifest",
  "./assets/index-base.css?v=20260507-logo-original1",
  "./assets/profile.css?v=20260606-profile17",
  "./assets/profile.js?v=20260606-profile17",
  "./assets/profile-pwa.js?v=20260606-profile17",
  "./assets/page-prefetch.js?v=20260606-profile1",
  "./assets/renaiss-logo-alpha-cropped.png",
  "./assets/renaiss-favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PROFILE_CACHE)
      .then((cache) => cache.addAll(PROFILE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== PROFILE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PROFILE_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./profile.html"))),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(PROFILE_CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
