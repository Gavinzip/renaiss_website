(() => {
  const PREFETCH_TIMEOUT_MS = 8000;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  if (connection?.saveData || effectiveType.includes("2g")) return;

  const ROUTE_TARGETS = {
    "index.html": [
      ["./index.html", "document"],
      ["./assets/index-base.css?v=20260507-logo-original1", "style"],
      ["./assets/index-intel.css?v=20260519-agent-source-card1", "style"],
      ["./assets/index-responsive.css?v=20260507-logo-original1", "style"],
      ["./assets/index-i18n.js?v=20260518-agent2", "script"],
      ["./assets/index-data.js?v=20260518-knowledge-memory1", "script"],
      ["./assets/index-render.js?v=20260528-nav-prefetch1", "script"],
      ["./assets/index-actions.js?v=20260518-agent2", "script"],
    ],
    "agent.html": [
      ["./agent.html", "document"],
      ["./assets/index-base.css?v=20260507-logo-original1", "style"],
      ["./assets/index-intel.css?v=20260520-agent-chat-polish1", "style"],
      ["./assets/index-responsive.css?v=20260507-logo-original1", "style"],
      ["./assets/index-i18n.js?v=20260518-agent-glow1", "script"],
      ["./assets/agent.js?v=20260520-agent-chat-polish1", "script"],
    ],
    "community_map.html": [
      ["./community_map.html", "document"],
      ["./assets/community-map.css?v=20260526-community-map18", "style"],
      ["./assets/community-region-outlines.js?v=20260526-community-map18", "script"],
      ["./assets/community-background-outlines.js?v=20260526-community-map18", "script"],
      ["./assets/community-map.js?v=20260526-community-map18", "script"],
      ["https://unpkg.com", "preconnect"],
    ],
    "card_scan.html": [
      ["./card_scan.html", "document"],
      ["./assets/card-scan.css?v=20260529-card-scan-chart1", "style"],
      ["./assets/card-scan.js?v=20260529-card-scan-chart1", "script"],
    ],
    "game.html": [
      ["./game.html", "document"],
      ["./assets/game-base.css?v=20260426-layout9", "style"],
      ["./assets/game-sections.css?v=20260426-layout10", "style"],
      ["./assets/game.js?v=20260426-layout9", "script"],
      ["./scripts/game-neural-stage.js", "script"],
      ["./assets/game_world/renaiss_world_bg_v3.webp", "image"],
    ],
    "beginner.html": [
      ["./beginner.html", "document"],
      ["./assets/index-base.css?v=20260506-events-admin1", "style"],
      ["./assets/index-intel.css?v=20260509-beginner-cardsearch5", "style"],
      ["./assets/index-responsive.css?v=20260509-beginner-cardsearch5", "style"],
      ["./assets/index-data.js?v=20260508-card-refresh2", "script"],
      ["./assets/beginner-guide-data.js?v=20260509-beginner-cardsearch5", "script"],
      ["./assets/beginner-guide.js?v=20260509-beginner-cardsearch5", "script"],
    ],
    "feedback.html": [
      ["./feedback.html", "document"],
      ["./assets/index-base.css?v=20260507-logo-original1", "style"],
      ["./assets/index-intel.css?v=20260508-x-source-feedback1", "style"],
      ["./assets/index-responsive.css?v=20260507-logo-original1", "style"],
      ["./assets/public-feedback.js?v=20260508-public-feedback1", "script"],
    ],
  };

  const completed = new Set();
  const queued = new Set();
  const preconnected = new Set();
  let queue = [];
  let activeController = null;
  let activeUrl = "";
  let timerId = 0;

  function toUrl(href) {
    try {
      return new URL(href, document.baseURI);
    } catch (_error) {
      return null;
    }
  }

  function routeKeyFor(url) {
    const filename = url.pathname.split("/").filter(Boolean).pop() || "index.html";
    return filename === "" ? "index.html" : filename;
  }

  function sameDocumentHash(url) {
    return (
      url.origin === location.origin
      && url.pathname === location.pathname
      && url.search === location.search
      && Boolean(url.hash)
    );
  }

  function addPreconnect(url) {
    const origin = url.origin;
    if (preconnected.has(origin)) return;
    preconnected.add(origin);
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }

  function scheduleRun(delay = 90) {
    if (timerId || activeController || queue.length === 0 || document.visibilityState === "hidden") return;
    timerId = window.setTimeout(() => {
      timerId = 0;
      runNext();
    }, delay);
  }

  function enqueue(entries) {
    entries.forEach(([href, as]) => {
      const url = toUrl(href);
      if (!url) return;
      if (as === "preconnect") {
        addPreconnect(url);
        return;
      }
      if (as === "document") return;
      if (url.origin !== location.origin) return;
      const key = url.href;
      if (completed.has(key) || queued.has(key) || key === activeUrl) return;
      queued.add(key);
      queue.push({ url, as: as || "fetch" });
    });
    scheduleRun();
  }

  function runNext() {
    if (activeController || queue.length === 0 || document.visibilityState === "hidden") return;
    const target = queue.shift();
    queued.delete(target.url.href);
    if (!target || completed.has(target.url.href)) {
      scheduleRun(0);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PREFETCH_TIMEOUT_MS);
    activeController = controller;
    activeUrl = target.url.href;
    fetch(target.url.href, {
      cache: "no-store",
      credentials: "omit",
      mode: "same-origin",
      priority: "low",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok || response.type === "basic") {
          completed.add(target.url.href);
        }
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        if (activeController === controller) {
          activeController = null;
          activeUrl = "";
        }
        scheduleRun(220);
      });
  }

  function cancelPagePrefetch() {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
    queue = [];
    queued.clear();
    if (activeController) {
      activeController.abort();
      activeController = null;
      activeUrl = "";
    }
  }

  function prefetchForAnchor(anchor) {
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const url = toUrl(anchor.getAttribute("href") || "");
    if (!url || url.origin !== location.origin || sameDocumentHash(url)) return;
    const routeKey = routeKeyFor(url);
    const currentKey = routeKeyFor(new URL(location.href));
    if (routeKey === currentKey && !url.hash) return;
    const targets = ROUTE_TARGETS[routeKey] || [[url.href, "document"]];
    enqueue(targets);
  }

  function installIntentListeners() {
    let lastTouchAt = 0;
    document.addEventListener("pointerover", (event) => {
      if (Date.now() - lastTouchAt < 700) return;
      prefetchForAnchor(event.target?.closest?.("a[href]"));
    }, { passive: true, capture: true });
    document.addEventListener("focusin", (event) => {
      prefetchForAnchor(event.target?.closest?.("a[href]"));
    }, { passive: true, capture: true });
    document.addEventListener("touchstart", (event) => {
      lastTouchAt = Date.now();
      prefetchForAnchor(event.target?.closest?.("a[href]"));
    }, { passive: true, capture: true });
    document.addEventListener("click", (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const url = toUrl(anchor.getAttribute("href") || "");
      if (url && url.origin === location.origin) cancelPagePrefetch();
    }, { capture: true });
    window.addEventListener("pagehide", cancelPagePrefetch);
  }

  const previousCancelBackgroundPrefetch = window.__cancelBackgroundPrefetch;
  window.__cancelPagePrefetch = cancelPagePrefetch;
  window.__cancelBackgroundPrefetch = () => {
    if (typeof previousCancelBackgroundPrefetch === "function") {
      try {
        previousCancelBackgroundPrefetch();
      } catch (_error) {}
    }
    cancelPagePrefetch();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installIntentListeners, { once: true });
  } else {
    installIntentListeners();
  }
})();
