(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./profile-sw.js").catch((error) => {
      console.warn("[profile] service worker registration failed", error);
    });
  });
})();
