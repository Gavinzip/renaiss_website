(() => {
  const releaseScript = document.currentScript;
  const clientRelease = String(releaseScript?.dataset.clientRelease || "").trim();

  if (!/^https?:$/.test(window.location.protocol) || !clientRelease) return;

  const manifestUrl = new URL("../client-release.json", releaseScript.src || window.location.href);
  const recoveryPrefix = "renaiss:release-reload:";
  let recoveryInFlight = false;

  function manifestRequestUrl() {
    const url = new URL(manifestUrl);
    // These keys bypass stale entries from the legacy Profile service worker and
    // static CDNs that cannot send no-store for a single manifest file.
    url.searchParams.set("release-check", clientRelease);
    url.searchParams.set("minute", String(Math.floor(Date.now() / 60_000)));
    return url;
  }

  async function currentRelease() {
    const response = await fetch(manifestRequestUrl(), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`release_manifest_http_${response.status}`);
    const payload = await response.json();
    const release = String(payload?.release || "").trim();
    if (!/^[a-f0-9]{12,64}$/i.test(release)) throw new Error("release_manifest_invalid");
    return release;
  }

  function renderUpdateNotice(message) {
    if (document.getElementById("renaiss-release-update")) return;

    const mount = () => {
      if (document.getElementById("renaiss-release-update")) return;
      const notice = document.createElement("aside");
      notice.id = "renaiss-release-update";
      notice.setAttribute("role", "alert");
      notice.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:min(420px,calc(100vw - 32px));padding:14px 16px;border:1px solid rgba(255,255,255,.26);border-radius:14px;background:rgba(14,18,32,.96);box-shadow:0 18px 44px rgba(0,0,0,.34);color:#fff;font:500 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans TC',sans-serif";
      const text = document.createElement("span");
      text.textContent = message;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "重新載入";
      button.style.cssText = "margin-left:12px;border:0;border-radius:999px;padding:7px 11px;background:#fff;color:#101426;font:700 13px/1 inherit;cursor:pointer";
      button.addEventListener("click", () => window.location.reload());
      notice.append(text, button);
      document.body.appendChild(notice);
    };

    if (document.body) mount();
    else window.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  async function checkForUpdate({ showNotice = false } = {}) {
    try {
      const released = await currentRelease();
      const hasUpdate = released !== clientRelease;
      if (hasUpdate && showNotice) {
        renderUpdateNotice("網站已有更新，請重新載入以套用最新版本。");
      }
      return { hasUpdate, released };
    } catch (_error) {
      return { hasUpdate: false, released: "" };
    }
  }

  function staleAssetMessage(value) {
    return String(value instanceof Error ? `${value.name}: ${value.message}` : value || "");
  }

  function looksLikeStaleAssetFailure(value) {
    return /chunkloaderror|loading chunk|dynamically imported module|failed to fetch dynamically|failed to fetch module|importing a module script failed|failed to load module script/i.test(staleAssetMessage(value));
  }

  function isModuleScriptFailure(event) {
    const target = event?.target;
    return target instanceof HTMLScriptElement
      && (target.type === "module" || /\/assets\/.*-[a-z0-9_-]{8,}\.js(?:$|\?)/i.test(target.src));
  }

  async function recoverFromStaleAsset() {
    if (recoveryInFlight) return;
    recoveryInFlight = true;

    try {
      const { hasUpdate, released } = await checkForUpdate();
      if (!hasUpdate || !released) {
        renderUpdateNotice("網站資源載入失敗。請重新載入；若持續發生，請稍後再試。");
        return;
      }

      const marker = `${recoveryPrefix}${released}`;
      if (sessionStorage.getItem(marker)) {
        renderUpdateNotice("新版資源仍無法載入，已停止自動重整以避免循環。請手動重新載入。");
        return;
      }

      sessionStorage.setItem(marker, "1");
      window.location.reload();
    } catch (_error) {
      renderUpdateNotice("網站資源載入失敗。請重新載入；若持續發生，請稍後再試。");
    } finally {
      recoveryInFlight = false;
    }
  }

  window.addEventListener("error", (event) => {
    if (looksLikeStaleAssetFailure(event?.error || event?.message) || isModuleScriptFailure(event)) {
      void recoverFromStaleAsset();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (looksLikeStaleAssetFailure(event?.reason)) void recoverFromStaleAsset();
  });

  window.addEventListener("pageshow", () => {
    void checkForUpdate({ showNotice: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate({ showNotice: true });
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      void checkForUpdate({ showNotice: true });
    });
  }
})();
