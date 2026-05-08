(function () {
  "use strict";

  const DEFAULT_INTEL_API_BASE = "https://renaiss.zeabur.app";
  const INTEL_API_BASE = (() => {
    const normalize = (raw) => String(raw || "").trim().replace(/\/+$/g, "");
    const search = new URLSearchParams(window.location.search || "");
    const fromQuery = normalize(search.get("intel_api_base") || "");
    const localHost = /^(127\.0\.0\.1|localhost|::1)$/i.test(String(window.location.hostname || ""));
    const fromHost = localHost
      ? (String(window.location.port || "") === "8787" ? normalize(window.location.origin || "") : "http://127.0.0.1:8787")
      : "";
    return fromQuery || fromHost || DEFAULT_INTEL_API_BASE;
  })();

  function intelApiUrl(path) {
    const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return `${INTEL_API_BASE}${safePath}`;
  }

  function setStatus(text, mode) {
    const el = document.getElementById("public-feedback-status");
    if (!el) return;
    el.classList.remove("is-ok", "is-error");
    if (mode === "ok") el.classList.add("is-ok");
    if (mode === "error") el.classList.add("is-error");
    el.textContent = String(text || "");
  }

  async function submitFeedback(payload) {
    const response = await fetch(intelApiUrl("/api/intel/public-feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  }

  const form = document.getElementById("public-feedback-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = document.getElementById("public-feedback-submit");
    const payload = {
      category: document.getElementById("public-feedback-category")?.value || "other",
      title: document.getElementById("public-feedback-title")?.value || "",
      message: document.getElementById("public-feedback-message")?.value || "",
      contact: document.getElementById("public-feedback-contact")?.value || "",
      website: document.getElementById("public-feedback-website")?.value || "",
      page_url: window.location.href,
    };
    if (String(payload.message || "").trim().length < 2) {
      setStatus("請先輸入回饋內容。", "error");
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    setStatus("送出中...", "");
    try {
      await submitFeedback(payload);
      form.reset();
      setStatus("已送出，謝謝你的回饋。", "ok");
    } catch (error) {
      setStatus(`送出失敗：${String(error?.message || error)}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
