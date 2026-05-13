(function () {
  "use strict";

  const DEFAULT_INTEL_API_BASE = "https://renaiss.zeabur.app";
  const INTEL_API_BASE = (() => {
    const normalize = (raw) => String(raw || "").trim().replace(/\/+$/g, "");
    const fromWindow = normalize(window.INTEL_API_BASE || window.__INTEL_API_BASE || "");
    const fromData = normalize(document.body?.dataset?.intelApiBase || "");
    const search = new URLSearchParams(window.location.search || "");
    const fromQuery = normalize(search.get("intel_api_base") || "");
    let fromStorage = "";
    try {
      fromStorage = normalize(localStorage.getItem("intel_api_base") || "");
    } catch (_error) {
      fromStorage = "";
    }
    const localHost = /^(127\.0\.0\.1|localhost|::1)$/i.test(String(window.location.hostname || ""));
    const fromHost = localHost
      ? (String(window.location.port || "") === "8787" ? normalize(window.location.origin || "") : "http://127.0.0.1:8787")
      : "";
    const safeStorage = localHost && !fromQuery && !fromWindow && !fromData ? "" : fromStorage;
    return (
      fromQuery
      || fromWindow
      || fromData
      || fromHost
      || safeStorage
      || DEFAULT_INTEL_API_BASE
    );
  })();
  const INTEL_AUTH_TOKEN_KEY = "intel_admin_bearer_token_v1";
  const pollState = {
    timer: null,
    fetching: false,
  };

  function intelApiUrl(path) {
    const safePath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return `${INTEL_API_BASE}${safePath}`;
  }

  function readIntelAuthToken() {
    try {
      return String(window.localStorage.getItem(INTEL_AUTH_TOKEN_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function buildAuthHeaders(baseHeaders = {}) {
    const headers = { ...(baseHeaders || {}) };
    const token = readIntelAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function toLocalTime(isoLike) {
    const raw = String(isoLike || "").trim();
    if (!raw) return "--";
    const dt = new Date(raw);
    if (Number.isNaN(dt.valueOf())) return "--";
    return dt.toLocaleString("zh-Hant-TW", { hour12: false });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(raw, fallback = "") {
    const value = String(raw || "").trim();
    const safeFallback = String(fallback || "");
    if (!value) return safeFallback;
    const compact = value.replace(/[\u0000-\u001f\u007f\s]+/g, "");
    const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme) {
      const protocol = scheme[1].toLowerCase();
      if (protocol !== "http" && protocol !== "https") return safeFallback;
      try {
        return new URL(value).href;
      } catch (_error) {
        return safeFallback;
      }
    }
    if (compact.startsWith("//")) {
      try {
        return new URL(`https:${value}`).href;
      } catch (_error) {
        return safeFallback;
      }
    }
    if (/[<>"'`]/.test(value)) return safeFallback;
    if (/^(?:[/?#.]|[A-Za-z0-9_-])/.test(value)) return value;
    return safeFallback;
  }

  function normalizePercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }

  function setStageBar(name, percent, text) {
    const labelEl = document.getElementById(`tracker-${name}-label`);
    const barEl = document.getElementById(`tracker-${name}-bar`);
    if (labelEl) labelEl.textContent = String(text || `${Math.round(percent)}%`);
    if (barEl) barEl.style.width = `${normalizePercent(percent)}%`;
  }

  function renderList(elId, rows, emptyText) {
    const el = document.getElementById(elId);
    if (!el) return;
    const items = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!items.length) {
      el.innerHTML = `<li>${escapeHtml(emptyText || "目前沒有資料")}</li>`;
      return;
    }
    el.innerHTML = items.map((line) => `<li>${line}</li>`).join("");
  }

  function itemTitleHtml(item) {
    const row = item && typeof item === "object" ? item : {};
    const title = String(row.title || row.id || "(無標題)").trim();
    const account = String(row.account || "").trim();
    const publishedAt = toLocalTime(row.published_at);
    const info = [account ? `@${escapeHtml(account)}` : "", publishedAt !== "--" ? escapeHtml(publishedAt) : ""]
      .filter(Boolean)
      .join(" · ");
    const url = safeUrl(row.url || "", "");
    const titleHtml = url
      ? `<a class="link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
      : escapeHtml(title);
    if (!info) return titleHtml;
    return `${titleHtml}<br><span style="color:#6282a4;">${info}</span>`;
  }

  function chipClass(status) {
    const s = String(status || "").toLowerCase();
    if (["done", "ok", "ready"].includes(s)) return "ok";
    if (["running", "analyzing", "translating"].includes(s)) return "run";
    if (["failed", "dedupe_dropped"].includes(s)) return "err";
    return "warn";
  }

  function statusChip(status, fallbackText = "--") {
    const raw = String(status || "").trim();
    const lower = raw.toLowerCase();
    const map = {
      pending: "待處理",
      running: "進行中",
      queued: "排隊中",
      done: "完成",
      ok: "完成",
      scanned: "已掃描",
      analyzing: "分析中",
      dedupe_dropped: "去重淘汰",
      selected: "已保留",
      translating: "翻譯中",
      ready: "可上線",
      failed: "失敗",
      idle: "待命",
    };
    const label = map[lower] || raw || fallbackText;
    return `<span class="chip ${chipClass(lower)}">${escapeHtml(label)}</span>`;
  }

  function renderDropReason(item) {
    const row = item && typeof item === "object" ? item : {};
    const stage = String(row.stage || "").trim().toLowerCase();
    if (stage !== "dedupe_dropped") return "--";
    const reason = String(row.reason || "").trim();
    const winnerUrl = safeUrl(row.winner_url || "", "");
    const winnerId = String(row.winner_post_id || "").trim();
    const winnerTitle = String(row.winner_title || "").trim();
    const winnerLabel = winnerTitle || winnerId || winnerUrl || "勝出貼文";
    const winnerHtml = winnerUrl
      ? `<a class="link" href="${escapeHtml(winnerUrl)}" target="_blank" rel="noreferrer">${escapeHtml(winnerLabel)}</a>`
      : (winnerLabel ? escapeHtml(winnerLabel) : "");
    if (reason && winnerHtml) return `${escapeHtml(reason)}<br><span style="color:#6282a4;">保留：${winnerHtml}</span>`;
    if (reason) return escapeHtml(reason);
    if (winnerHtml) return `<span style="color:#6282a4;">保留：${winnerHtml}</span>`;
    return "--";
  }

  function renderPostStages(rows) {
    const body = document.getElementById("tracker-post-stage-body");
    if (!body) return;
    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
      body.innerHTML = "<tr><td colspan=\"6\">目前沒有可追蹤的貼文狀態。</td></tr>";
      return;
    }
    body.innerHTML = items.map((item) => {
      const titleHtml = itemTitleHtml(item);
      const scan = statusChip(item?.scan);
      const curation = statusChip(item?.curation);
      const translation = statusChip(item?.translation);
      const stage = statusChip(item?.stage, "待處理");
      const reason = renderDropReason(item);
      return `<tr><td>${titleHtml}</td><td>${scan}</td><td>${curation}</td><td>${translation}</td><td>${stage}</td><td>${reason}</td></tr>`;
    }).join("");
  }

  function renderPipeline(status) {
    const sync = status?.sync || {};
    const jobs = status?.jobs || {};
    const contentRefresh = status?.content_refresh || {};
    const pipeline = status?.sync_pipeline || {};
    const scan = pipeline?.scan || {};
    const curation = pipeline?.curation || {};
    const translation = pipeline?.translation || {};

    const runMetaEl = document.getElementById("tracker-run-meta");
    if (runMetaEl) {
      const runId = String(pipeline?.run_id || "--");
      const trigger = String(sync?.trigger || "manual");
      const syncStatus = String(sync?.status || "idle");
      const refreshRunning = Number(contentRefresh?.counts?.running || 0);
      runMetaEl.textContent = `run_id=${runId} · trigger=${trigger} · sync=${syncStatus} · card_refresh=${refreshRunning}`;
    }

    const scanTotal = Number(scan?.total_sources || 0);
    const scanDone = Number(scan?.done_sources || 0);
    const scanPercent = scanTotal > 0
      ? Math.round((scanDone / scanTotal) * 100)
      : (String(scan?.status || "").toLowerCase() === "ok" ? 100 : 0);
    setStageBar("scan", scanPercent, `${scanPercent}% · ${scanDone}/${scanTotal || "--"}`);

    const curationTotal = Number(curation?.total_cards || 0);
    const curationDone = Number(curation?.done_cards || 0);
    const curationPercent = curationTotal > 0
      ? Math.round((curationDone / curationTotal) * 100)
      : (String(curation?.status || "").toLowerCase() === "ok" ? 100 : 0);
    setStageBar("curation", curationPercent, `${curationPercent}% · ${curationDone}/${curationTotal || "--"}`);

    const translationPercent = normalizePercent(translation?.percent);
    const translationDone = Number(translation?.items_done || 0);
    const translationTotal = Number(translation?.items_total || 0);
    setStageBar("translation", translationPercent, `${Math.round(translationPercent)}% · ${translationDone}/${translationTotal || "--"}`);

    const scanItems = Array.isArray(scan?.new_items) ? scan.new_items : [];
    const scanRows = scanItems.slice(0, 40).map((item) => {
      return `${statusChip("done", "完成")} ${itemTitleHtml(item)}`;
    });
    renderList("tracker-scan-list", scanRows, "這輪掃描沒有新增卡片。");

    const doneItems = Array.isArray(curation?.done_items) ? curation.done_items : [];
    const pendingItems = Array.isArray(curation?.pending_items) ? curation.pending_items : [];
    const curationRows = [
      ...pendingItems.slice(0, 30).map((item) => `${statusChip("running", "整理中")} ${itemTitleHtml(item)}`),
      ...doneItems.slice(0, 30).map((item) => `${statusChip("done", "完成")} ${itemTitleHtml(item)}`),
    ];
    renderList("tracker-curation-list", curationRows, "目前沒有整理中的卡片。");

    const translationPendingItems = Array.isArray(translation?.pending_items) ? translation.pending_items : [];
    const langRows = Array.isArray(translation?.langs) ? translation.langs : [];
    const translationRows = [
      ...langRows.map((row) => {
        const lang = String(row?.lang || "--");
        const done = Number(row?.done || 0);
        const total = Number(row?.total || 0);
        const percent = Math.round(normalizePercent(row?.percent));
        const st = statusChip(row?.status || "pending");
        return `${st} ${escapeHtml(lang)} · ${done}/${total} · ${percent}%`;
      }),
      ...translationPendingItems.slice(0, 40).map((item) => `${statusChip("running", "翻譯中")} ${itemTitleHtml(item)}`),
    ];
    renderList("tracker-translation-list", translationRows, "目前沒有翻譯中的卡片。");

    const jobItems = Array.isArray(jobs?.items) ? jobs.items : [];
    const refreshItems = Array.isArray(contentRefresh?.items) ? contentRefresh.items : [];
    const refreshRows = refreshItems.slice(0, 20).map((item) => {
      const st = statusChip(String(item?.status || "pending").toLowerCase());
      const title = String(item?.title || item?.card_id || "卡片重新整理").trim();
      const updated = toLocalTime(item?.updated_at || item?.started_at);
      const mode = String(item?.mode || "").trim();
      const message = String(item?.message || "").trim();
      const error = String(item?.error || "").trim();
      const meta = [mode, message, error, updated !== "--" ? updated : ""].filter(Boolean).map(escapeHtml).join(" · ");
      return `${st} ${escapeHtml(title)}${meta ? `<br><span style="color:#6282a4;">卡片重新整理 · ${meta}</span>` : ""}`;
    });
    const jobRows = jobItems.slice(0, 60).map((job) => {
      const st = statusChip(String(job?.status || "pending").toLowerCase());
      const message = String(job?.message || "").trim();
      const url = safeUrl(job?.url || "", "");
      const updated = toLocalTime(job?.updated_at || job?.created_at);
      const title = url
        ? `<a class="link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>`
        : (message ? escapeHtml(message) : "(無網址)");
      const meta = [message && message !== url ? escapeHtml(message) : "", updated !== "--" ? escapeHtml(updated) : ""]
        .filter(Boolean)
        .join(" · ");
      return `${st} ${title}${meta ? `<br><span style="color:#6282a4;">${meta}</span>` : ""}`;
    });
    renderList("tracker-job-list", [...refreshRows, ...jobRows], "目前沒有貼文分析任務。");

    const postRows = Array.isArray(pipeline?.post_stages) ? pipeline.post_stages : [];
    renderPostStages(postRows);
  }

  function setUpdatedAt(serverTime) {
    const updatedEl = document.getElementById("tracker-updated");
    if (!updatedEl) return;
    updatedEl.textContent = `最後更新：${toLocalTime(serverTime)}`;
  }

  async function fetchAuthState() {
    const response = await fetch(intelApiUrl("/api/auth/me"), {
      method: "GET",
      credentials: "include",
      headers: buildAuthHeaders(),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  }

  async function fetchAdminStatus() {
    const response = await fetch(intelApiUrl("/api/intel/admin-status?limit=20"), {
      method: "GET",
      credentials: "include",
      headers: buildAuthHeaders(),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || typeof data?.status !== "object") {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data.status;
  }

  function showLocked(message) {
    const locked = document.getElementById("tracker-locked");
    const main = document.getElementById("tracker-main");
    if (locked) {
      locked.hidden = false;
      if (message) locked.textContent = String(message);
    }
    if (main) main.hidden = true;
  }

  function showMain() {
    const locked = document.getElementById("tracker-locked");
    const main = document.getElementById("tracker-main");
    if (locked) locked.hidden = true;
    if (main) main.hidden = false;
  }

  async function refreshOnce() {
    if (pollState.fetching) return;
    pollState.fetching = true;
    try {
      const status = await fetchAdminStatus();
      showMain();
      setUpdatedAt(status?.server_time);
      renderPipeline(status || {});
    } catch (error) {
      showLocked(`讀取流程頁失敗：${String(error?.message || error)}`);
      const updatedEl = document.getElementById("tracker-updated");
      if (updatedEl) updatedEl.textContent = "最後更新：讀取失敗";
    } finally {
      pollState.fetching = false;
    }
  }

  function startPolling() {
    if (pollState.timer) return;
    pollState.timer = window.setInterval(() => {
      refreshOnce();
    }, 3000);
  }

  async function init() {
    const refreshBtn = document.getElementById("tracker-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        refreshOnce();
      });
    }

    try {
      const auth = await fetchAuthState();
      if (!auth?.authenticated) {
        showLocked("你目前沒有管理員權限，請先回首頁登入管理員後再開啟流程頁。");
        return;
      }
      showMain();
      await refreshOnce();
      startPolling();
    } catch (error) {
      showLocked(`驗證管理員登入失敗：${String(error?.message || error)}`);
    }
  }

  init();
})();
