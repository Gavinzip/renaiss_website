const PROFILE_CACHE = "renaiss-profile-shell-b28b6f66e0787b25fed4";
const PROFILE_CACHE_PREFIX = "renaiss-profile-shell-";
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
const PROFILE_PAGE_URL = new URL("./profile.html", self.location.href).href;
const PROFILE_ASSET_URLS = new Set(PROFILE_ASSETS.map((asset) => new URL(asset, self.location.href).href));

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
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(PROFILE_CACHE_PREFIX) && key !== PROFILE_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  const isProfileNavigation = event.request.mode === "navigate" && url.href === PROFILE_PAGE_URL;
  const isProfileAsset = PROFILE_ASSET_URLS.has(url.href);
  if (!isProfileNavigation && !isProfileAsset) return;

  if (isProfileNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PROFILE_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.open(PROFILE_CACHE)
          .then((cache) => cache.match(event.request).then((cached) => cached || cache.match(PROFILE_PAGE_URL)))),
    );
    return;
  }
  event.respondWith(
    caches.open(PROFILE_CACHE).then((cache) => cache.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        cache.put(event.request, copy);
        return response;
      });
    })),
  );
});
