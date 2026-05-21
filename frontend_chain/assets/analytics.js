(() => {
  const MEASUREMENT_ID = "G-NLY9VN6BH9";
  const TRACKED_HOSTS = new Set(["renaiss.zeabur.app"]);

  if (!TRACKED_HOSTS.has(window.location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
})();
