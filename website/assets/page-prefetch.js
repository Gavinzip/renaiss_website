(() => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  if (connection?.saveData || effectiveType.includes("2g")) return;

  const targets = [
    ["./game.html", "document"],
    ["./feedback.html", "document"],
    ["./assets/game-base.css?v=20260426-layout9", "style"],
    ["./assets/game-sections.css?v=20260426-layout10", "style"],
    ["./assets/game.js?v=20260426-layout9", "script"],
    ["./scripts/game-neural-stage.js", "script"],
    ["./assets/game_world/renaiss_world_bg_v3.webp", "image"],
    ["./assets/public-feedback.js?v=20260508-public-feedback1", "script"],
    ["https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js", "script", "anonymous"],
  ];

  const seen = new Set();

  function prefetch(href, as, crossOrigin) {
    if (!href || seen.has(href)) return;
    seen.add(href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    if (as) link.as = as;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    document.head.appendChild(link);
  }

  function start() {
    for (const [href, as, crossOrigin] of targets) {
      prefetch(href, as, crossOrigin);
    }
  }

  window.addEventListener("load", () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 3500 });
    } else {
      window.setTimeout(start, 1400);
    }
  }, { once: true });
})();
