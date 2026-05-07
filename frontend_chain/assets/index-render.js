    const LOCALIZED_DYNAMIC_REGION_IDS = Object.freeze([
      "intel-master-rail",
      "intel-master-stage",
      "intel-events-list",
      "intel-features-list",
      "intel-events-cards",
      "intel-other-cards",
      "intel-pokemon-cards",
      "intel-collectibles-cards",
      "pokemon-news-list",
      "intel-sbt-cards",
      "intel-sbt-acquisition-list",
      "intel-guides-cards",
      "intel-community-cards",
      "intel-alpha-cards",
      "intel-official-overview-title",
      "intel-official-overview-summary",
      "intel-official-overview-bullets",
      "intel-cards",
      "intel-headline",
      "intel-conclusion",
      "intel-takeaways",
      "intel-key-terms",
      "intel-format-templates",
      "intel-source-status",
      "intel-official-list",
      "intel-community-list",
      "intel-growth-list",
      "intel-recent-list",
      "intel-detail-content",
    ]);

    function markLocalizedDynamicRegions() {
      LOCALIZED_DYNAMIC_REGION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute("data-no-i18n", "1");
      });
    }

    function collectTranslatableTextNodes(root) {
      markLocalizedDynamicRegions();
      const nodes = [];
      const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return shouldTranslateTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }
      return nodes;
    }

    function collectStaticUiTranslationTargets(lang) {
      const tag = normalizeUiLang(lang || currentUiLang);
      const entries = [];
      document.querySelectorAll("[data-i18n-key]").forEach((el) => {
        const key = String(el.getAttribute("data-i18n-key") || "").trim();
        if (!key) return;
        const rows = UI_STATIC_TRANSLATIONS[key];
        if (!rows || typeof rows !== "object") return;
        const next = String(rows[tag] || rows["zh-Hant"] || "").trim();
        if (!next) return;
        const asHtml = String(el.getAttribute("data-i18n-html") || "") === "1";
        const directTextNode = !asHtml && el.childElementCount > 0
          ? Array.from(el.childNodes || []).find(
              (node) => node && node.nodeType === Node.TEXT_NODE && String(node.nodeValue || "").trim().length > 0
            )
          : null;
        const current = String(
          asHtml
            ? el.innerHTML
            : directTextNode
              ? directTextNode.nodeValue || ""
              : el.textContent || ""
        );
        el.setAttribute("data-no-i18n", "1");
        entries.push({
          from: current,
          to: next,
          anchor: el,
          set(value) {
            if (asHtml) {
              el.innerHTML = String(value || "");
              return;
            }
            if (directTextNode) {
              directTextNode.nodeValue = String(value || "");
              return;
            }
            el.textContent = String(value || "");
          },
        });
      });
      return entries;
    }

    function applyUiTranslationFallback(lang, source, translated) {
      const tag = normalizeUiLang(lang);
      const rawSource = String(source || "");
      const rawTranslated = String(translated || "");
      if (!rawSource) return rawTranslated;
      const fallbackMap = UI_TRANSLATION_FALLBACKS[tag] || {};
      const normalizedSource = rawSource.replace(/\s+/g, " ").trim();
      if (rawTranslated === rawSource && Object.prototype.hasOwnProperty.call(fallbackMap, rawSource)) {
        return String(fallbackMap[rawSource] || rawSource);
      }
      if (rawTranslated === rawSource && normalizedSource && Object.prototype.hasOwnProperty.call(fallbackMap, normalizedSource)) {
        return String(fallbackMap[normalizedSource] || normalizedSource);
      }
      return rawTranslated;
    }

    async function translateTextsForUi(lang, texts) {
      const tag = normalizeUiLang(lang);
      const rows = Array.isArray(texts) ? texts.map((x) => String(x || "")) : [];
      if (tag === "zh-Hant") return rows;
      if (typeof window.ensureUiTranslationCache === "function") {
        try {
          await window.ensureUiTranslationCache();
        } catch (_error) {}
      }
      return rows.map((text) => {
        const fallback = applyUiTranslationFallback(tag, text, text);
        if (fallback !== text) return fallback;
        if (typeof window.lookupUiCachedTranslation === "function") {
          const cached = window.lookupUiCachedTranslation(tag, text);
          if (cached) return cached;
        }
        return fallback;
      });
    }

    function updateLangSwitcherUi() {
      const select = document.getElementById("lang-select");
      if (!select) return;
      const tag = normalizeUiLang(currentUiLang);
      if (select.value !== tag) {
        select.value = tag;
      }
    }

    function langDisplayName(lang) {
      const tag = normalizeUiLang(lang);
      if (tag === "zh-Hans") return "简中";
      if (tag === "en") return "English";
      if (tag === "ko") return "한국어";
      return "繁中";
    }

    function setLangBuildStatus(text = "", mode = "") {
      const el = document.getElementById("lang-build-status");
      if (!el) return;
      el.textContent = text;
      el.classList.toggle("is-working", mode === "working");
      el.classList.toggle("is-ready", mode === "ready");
    }

    const INTEL_AUTO_REPAIR_SESSION_KEY = "intel_auto_repair_attempt_v1";
    const INTEL_CATEGORY_RENDER_ORDER = Object.freeze([
      "events",
      "official",
      "sbt",
      "pokemon",
      "collectibles",
      "alpha",
      "guides",
      "community",
      "other",
    ]);
    let intelLazyRenderContext = null;
    let intelLazyRenderToken = 0;
    let intelLazyRenderedCategories = new Set();
    let intelDeferredCategoryQueue = [];
    let intelDeferredCategoryTimer = null;
    let uiLanguageApplyTimer = null;
    let intelFeedPrefetchArmed = false;
    let intelFeedPrefetchStarted = false;
    let pokemonNewsAutoRequested = false;

    function isUsableIntelFeed(feed) {
      return Boolean(feed && typeof feed === "object" && Array.isArray(feed.cards) && feed.cards.length > 0);
    }

    function scheduleIdleTask(callback, delay = 0) {
      const run = () => {
        const fn = () => {
          try {
            callback();
          } catch (_error) {}
        };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(fn, { timeout: 2400 });
        } else {
          window.setTimeout(fn, 80);
        }
      };
      if (delay > 0) {
        window.setTimeout(run, delay);
      } else {
        run();
      }
    }

    function normalizeIntelCategoryName(category) {
      const value = String(category || "").trim().toLowerCase();
      return INTEL_CATEGORY_RENDER_ORDER.includes(value) ? value : "events";
    }

    function getActiveIntelCategory() {
      const fromWindow = normalizeIntelCategoryName(window.__intelActiveCategory || "");
      if (fromWindow !== "events" || String(window.__intelActiveCategory || "").trim()) return fromWindow;
      try {
        if (typeof activeCategory !== "undefined" && activeCategory) {
          return normalizeIntelCategoryName(activeCategory);
        }
      } catch (_error) {}
      const rawHash = String(window.location?.hash || "").replace(/^#cat-/i, "").replace(/^#/, "");
      return normalizeIntelCategoryName(rawHash);
    }

    function shouldClearIntelStorageKey(key) {
      const value = String(key || "");
      const lower = value.toLowerCase();
      if (!value) return false;
      if (lower === "intel_admin_bearer_token_v1") return false;
      return (
        lower === "intel_api_base"
        || lower === String(INTEL_LANG_STORAGE_KEY || "").toLowerCase()
        || lower.startsWith(INTEL_FEED_SNAPSHOT_PREFIX)
        || lower.includes("intel")
        || lower.includes("feed")
        || lower.includes("api")
        || lower.includes("lang")
        || lower.includes("i18n")
        || lower.includes("pokemon-news")
      );
    }

    async function clearIntelAppState(options = {}) {
      const preserveLang = Boolean(options.preserveLang);
      const preserveApiBase = Boolean(options.preserveApiBase);
      const clearCacheStorage = options.clearCacheStorage !== false;
      let savedLang = "";
      let savedApiBase = "";
      try {
        savedLang = String(localStorage.getItem(INTEL_LANG_STORAGE_KEY) || "");
        savedApiBase = String(localStorage.getItem("intel_api_base") || "");
        const keys = [];
        for (let idx = 0; idx < localStorage.length; idx += 1) {
          keys.push(localStorage.key(idx));
        }
        keys.filter(shouldClearIntelStorageKey).forEach((key) => {
          try { localStorage.removeItem(key); } catch (_error) {}
        });
        if (preserveLang && savedLang) localStorage.setItem(INTEL_LANG_STORAGE_KEY, savedLang);
        if (preserveApiBase && savedApiBase) localStorage.setItem("intel_api_base", savedApiBase);
      } catch (_error) {}
      try {
        sessionStorage.clear();
      } catch (_error) {}
      if (clearCacheStorage && window.caches && typeof window.caches.keys === "function") {
        try {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((key) => window.caches.delete(key)));
        } catch (_error) {}
      }
      intelFeedLangCache.clear();
      intelFeedCache = null;
      intelLazyRenderContext = null;
      intelLazyRenderedCategories = new Set();
      intelDeferredCategoryQueue = [];
    }

    async function repairIntelLoadState() {
      const btn = document.getElementById("intel-repair-load-btn");
      if (btn) btn.disabled = true;
      setIntelMessage(uiLabel("repairingLoadState"), "");
      try {
        await clearIntelAppState({ preserveLang: false, preserveApiBase: false, clearCacheStorage: true });
        setIntelMessage(uiLabel("repairDoneReloading"), "ok");
        const url = new URL(window.location.href);
        url.searchParams.set("refresh", `repair-${Date.now()}`);
        window.location.replace(url.toString());
      } catch (error) {
        if (btn) btn.disabled = false;
        setIntelMessage(`${uiLabel("repairFailed")}：${String(error?.message || error)}`, "error");
      }
    }

    function setupIntelLoadRepairButton() {
      const btn = document.getElementById("intel-repair-load-btn");
      if (!btn || btn.dataset.boundIntelRepair) return;
      btn.dataset.boundIntelRepair = "1";
      btn.addEventListener("click", () => {
        repairIntelLoadState();
      });
    }

    const INTEL_FEED_SNAPSHOT_PREFIX = "intel_feed_snapshot_v1:";

    function intelFeedSnapshotKey(lang) {
      return `${INTEL_FEED_SNAPSHOT_PREFIX}${normalizeUiLang(lang || "zh-Hant")}`;
    }

    function loadIntelFeedSnapshot(lang) {
      try {
        const raw = localStorage.getItem(intelFeedSnapshotKey(lang)) || "";
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const feed = parsed && typeof parsed === "object" ? parsed.feed : null;
        if (!isUsableIntelFeed(feed)) return null;
        return feed;
      } catch (_error) {
        return null;
      }
    }

    function saveIntelFeedSnapshot(lang, feed) {
      if (!feed || typeof feed !== "object") return;
      const cards = Array.isArray(feed.cards) ? feed.cards : null;
      if (!cards || !cards.length) return;
      const payload = {
        saved_at: new Date().toISOString(),
        feed,
      };
      try {
        localStorage.setItem(intelFeedSnapshotKey(lang), JSON.stringify(payload));
      } catch (_error) {
      }
    }

    function readCachedIntelFeed(lang, allowBaseFallback = true) {
      const tag = normalizeUiLang(lang || currentUiLang);
      const inMemory = intelFeedLangCache.get(tag);
      if (isUsableIntelFeed(inMemory)) return inMemory;
      const fromSnapshot = loadIntelFeedSnapshot(tag);
      if (fromSnapshot) return fromSnapshot;
      if (allowBaseFallback && tag !== "zh-Hant") {
        const memoryBase = intelFeedLangCache.get("zh-Hant");
        if (isUsableIntelFeed(memoryBase)) return memoryBase;
        const snapshotBase = loadIntelFeedSnapshot("zh-Hant");
        if (snapshotBase) return snapshotBase;
      }
      return null;
    }

    const LANG_MORPH_LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const LANG_MORPH_CJK = "天地玄黃宇宙洪荒風火雷電星月山海光影流轉";
    const LANG_MORPH_HANGUL = "가나다라마바사아자차카타파하우리세계여정";
    let pendingUiLangMorph = false;

    function canUseLangMorphFx() {
      try {
        return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (_error) {
        return true;
      }
    }

    function randomMorphChar(sample) {
      const src = String(sample || "");
      if (!src) return "";
      if (/\s/.test(src)) return src;
      if (/[\u4e00-\u9fff]/.test(src)) {
        return LANG_MORPH_CJK[Math.floor(Math.random() * LANG_MORPH_CJK.length)] || src;
      }
      if (/[\uac00-\ud7a3]/.test(src)) {
        return LANG_MORPH_HANGUL[Math.floor(Math.random() * LANG_MORPH_HANGUL.length)] || src;
      }
      if (/[A-Za-z0-9]/.test(src)) {
        return LANG_MORPH_LATIN[Math.floor(Math.random() * LANG_MORPH_LATIN.length)] || src;
      }
      return src;
    }

    function buildMorphFrame(target, progress) {
      const chars = Array.from(String(target || ""));
      if (!chars.length) return "";
      const p = Math.max(0, Math.min(1, Number(progress || 0)));
      const revealCount = Math.floor(chars.length * p);
      return chars
        .map((char, idx) => {
          if (/\s/.test(char)) return char;
          if (idx <= revealCount) return char;
          return randomMorphChar(char);
        })
        .join("");
    }

    function collectLangMorphEntries(nodes, fromTexts, toTexts, staticEntries = []) {
      const entries = [];
      staticEntries.forEach((row) => {
        if (!row || typeof row.set !== "function") return;
        const from = String(row.from || "");
        const to = String(row.to || "");
        if (!to || from === to) return;
        entries.push({
          from,
          to,
          anchor: row.anchor || null,
          set: row.set,
        });
      });
      nodes.forEach((node, idx) => {
        const parent = node?.parentElement;
        if (!parent) return;
        const from = String(fromTexts[idx] || node.nodeValue || "");
        const to = String(toTexts[idx] || "");
        if (!to || from === to) return;
        entries.push({
          from,
          to,
          anchor: parent,
          set(value) { node.nodeValue = String(value || ""); },
        });
      });
      return entries;
    }

    async function runLangMorphFx(entries, version) {
      if (!entries.length) return;
      const durationMs = 1500;
      const start = performance.now();
      let cancelled = false;
      const rows = entries
        .map((row, idx) => {
          const anchor = row.anchor || null;
          const rect = anchor?.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
          const y = rect ? (rect.top + (window.scrollY || 0)) : (idx * 4);
          return {
            ...row,
            _idx: idx,
            _y: Number.isFinite(y) ? y : (idx * 4),
          };
        })
        .sort((a, b) => (a._y - b._y) || (a._idx - b._idx));
      const totalRows = rows.length;
      rows.forEach((row, order) => {
        const ratio = totalRows > 1 ? (order / (totalRows - 1)) : 0;
        row._start = ratio * 0.56;
        row._span = 0.44;
      });
      rows.forEach((row) => {
        row.anchor?.classList?.add("lang-morphing");
      });
      await new Promise((resolve) => {
        const step = (now) => {
          if (version !== uiTranslateVersion) {
            cancelled = true;
            resolve();
            return;
          }
          const t = Math.max(0, Math.min(1, (now - start) / durationMs));
          rows.forEach((row) => {
            const localRaw = (t - row._start) / row._span;
            if (localRaw <= 0) {
              row.set(row.from);
              return;
            }
            const local = Math.max(0, Math.min(1, localRaw));
            const eased = 1 - Math.pow(1 - local, 2.2);
            row.set(buildMorphFrame(row.to, eased));
          });
          if (t < 1) {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        window.requestAnimationFrame(step);
      });
      rows.forEach((row) => {
        if (!cancelled) {
          row.set(row.to);
        }
        row.anchor?.classList?.remove("lang-morphing");
      });
    }

    function scheduleLangFeedRefresh(payload) {
      if (langFeedRefreshTimer) {
        window.clearTimeout(langFeedRefreshTimer);
        langFeedRefreshTimer = null;
      }
      const i18n = payload && typeof payload === "object" ? payload._i18n || {} : {};
      const mode = String(i18n?.mode || "");
      const lang = normalizeUiLang(payload?.lang || currentUiLang);
      const progress = i18n?.state?.lang_progress?.[lang] || {};
      if (mode === "building" || mode === "building-stale") {
        const percent = Number(progress?.percent || 0);
        const remaining = Number(progress?.remaining || 0);
        const remainingLabel = currentUiLang === "en" ? "remaining" : (currentUiLang === "ko" ? "남음" : "剩");
        const buildingLabel = currentUiLang === "en" ? "building" : (currentUiLang === "ko" ? "빌드 중" : "建置中");
        const suffix = percent > 0 ? `${percent}% / ${remainingLabel} ${remaining}` : buildingLabel;
        setLangBuildStatus(`${langDisplayName(lang)} ${suffix}`, "working");
        langFeedRefreshTimer = window.setTimeout(() => {
          if (normalizeUiLang(currentUiLang) === lang) {
            refreshIntelFeedForCurrentLang().catch(() => {});
          }
        }, 7000);
        return;
      }
      if (lang !== "zh-Hant") {
        setLangBuildStatus(`${langDisplayName(lang)} ready`, "ready");
        window.setTimeout(() => {
          if (normalizeUiLang(currentUiLang) === lang) setLangBuildStatus("");
        }, 2800);
      } else {
        setLangBuildStatus("");
      }
    }

    async function applyUiLanguage() {
      const version = ++uiTranslateVersion;
      updateLangSwitcherUi();
      const wantsMorphFx = pendingUiLangMorph;
      pendingUiLangMorph = false;
      const staticEntries = collectStaticUiTranslationTargets(currentUiLang);
      const nodes = collectTranslatableTextNodes(document.body);
      const currentRows = nodes.map((node) => String(node.nodeValue || ""));
      const originals = nodes.map((node) => {
        const stored = uiTextNodeCache.get(node);
        const current = String(node.nodeValue || "");
        if (typeof stored === "string") {
          return stored;
        }
        uiTextNodeCache.set(node, current);
        return current;
      });
      const targets = currentUiLang === "zh-Hant"
        ? originals
        : await translateTextsForUi(currentUiLang, originals);
      if (version !== uiTranslateVersion) return;
      const nextRows = nodes.map((node, idx) => String(targets[idx] || originals[idx] || node.nodeValue || ""));
      if (wantsMorphFx && canUseLangMorphFx()) {
        const entries = collectLangMorphEntries(nodes, currentRows, nextRows, staticEntries);
        const morphNodeSet = new Set(nodes.filter((node, idx) => {
          const from = String(currentRows[idx] || node.nodeValue || "");
          const to = String(nextRows[idx] || "");
          return to && from !== to;
        }));
        nodes.forEach((node, idx) => {
          if (morphNodeSet.has(node)) return;
          node.nodeValue = nextRows[idx];
        });
        staticEntries.forEach((entry) => {
          if (String(entry.from || "") === String(entry.to || "")) {
            entry.set(entry.to);
          }
        });
        await runLangMorphFx(entries, version);
        return;
      }
      staticEntries.forEach((entry) => {
        entry.set(entry.to);
      });
      nodes.forEach((node, idx) => {
        node.nodeValue = nextRows[idx];
      });
    }

    function scheduleUiLanguageApply(delay = 140) {
      if (uiLanguageApplyTimer) {
        window.clearTimeout(uiLanguageApplyTimer);
        uiLanguageApplyTimer = null;
      }
      uiLanguageApplyTimer = window.setTimeout(() => {
        uiLanguageApplyTimer = null;
        scheduleIdleTask(() => {
          applyUiLanguage().catch(() => {});
        });
      }, Math.max(0, Number(delay) || 0));
    }

    function setupLanguageSwitcher() {
      updateLangSwitcherUi();
      const select = document.getElementById("lang-select");
      if (!select) return;
      select.addEventListener("change", async () => {
        const next = normalizeUiLang(select.value || "zh-Hant");
        if (next === currentUiLang) return;
        pendingUiLangMorph = true;
        saveUiLang(next);
        updateLangSwitcherUi();
        applyUiLanguage().catch(() => {});
        setLangBuildStatus(`${langDisplayName(next)} loading`, "working");
        refreshIntelFeedForCurrentLang()
          .then(() => {
            setLangBuildStatus("");
            applyUiLanguage().catch(() => {});
            scheduleIntelFeedPrefetchOnActivity();
          })
          .catch((error) => {
            setLangBuildStatus("");
            setIntelMessage(`Language feed refresh failed: ${String(error?.message || error)}`, "error");
          });
        pokemonNewsAutoRequested = false;
        maybeRefreshPokemonNewsForCategory(getActiveIntelCategory());
      });
    }

    window.addEventListener("storage", async (event) => {
      if (event.key !== INTEL_LANG_STORAGE_KEY) return;
      const next = normalizeUiLang(event.newValue || "zh-Hant");
      if (next === currentUiLang) return;
      currentUiLang = next;
      document.documentElement.lang = next;
      updateLangSwitcherUi();
      try {
        await applyUiLanguage();
      } catch (_error) {}
    });

    function intelCanEdit() {
      if (!intelAuthState.authRequired) return true;
      return Boolean(intelAuthState.authConfigured && intelAuthState.authenticated);
    }

    const INTEL_AUTH_TOKEN_KEY = "intel_admin_bearer_token_v1";

    function readIntelAuthToken() {
      try {
        return String(window.localStorage.getItem(INTEL_AUTH_TOKEN_KEY) || "").trim();
      } catch (_error) {
        return "";
      }
    }

    function saveIntelAuthToken(token) {
      const value = String(token || "").trim();
      if (!value) return;
      try {
        window.localStorage.setItem(INTEL_AUTH_TOKEN_KEY, value);
      } catch (_error) {}
    }

    function clearIntelAuthToken() {
      try {
        window.localStorage.removeItem(INTEL_AUTH_TOKEN_KEY);
      } catch (_error) {}
    }

    function buildIntelAuthHeaders(baseHeaders = {}) {
      const headers = { ...(baseHeaders || {}) };
      const token = readIntelAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      return headers;
    }

    function handleIntelUnauthorized() {
      clearIntelAuthToken();
      intelAuthState.authenticated = false;
      updateIntelAuthUi();
    }

    function syncIntelAdminVisibility(showAdminPanel) {
      const isAdmin = Boolean(showAdminPanel);
      document.body.classList.toggle("intel-admin-mode", isAdmin);
      document.querySelectorAll(".intel-user-hidden").forEach((el) => {
        el.hidden = !isAdmin;
        el.setAttribute("aria-hidden", isAdmin ? "false" : "true");
      });
      if (typeof window.syncProtectedIntelCategoryVisibility === "function") {
        try {
          window.syncProtectedIntelCategoryVisibility();
        } catch (_error) {}
      }
    }

    function updateIntelAuthUi() {
      const statusEl = document.getElementById("intel-auth-status");
      const adminControls = document.getElementById("intel-admin-controls");
      const adminPanel = document.getElementById("intel-admin-monitor");
      const adminOpenBtn = document.getElementById("nav-admin-monitor-btn");
      const adminPipelineLink = document.getElementById("nav-admin-pipeline-link");
      const loginButtons = [
        document.getElementById("intel-login-btn"),
        document.getElementById("nav-intel-login-btn"),
      ].filter(Boolean);
      const logoutButtons = [
        document.getElementById("intel-logout-btn"),
        document.getElementById("nav-intel-logout-btn"),
      ].filter(Boolean);
      const analyzeBtn = document.getElementById("intel-analyze-btn");
      const syncBtn = document.getElementById("intel-sync-btn");
      const input = document.getElementById("intel-url-input");
      const fileMode = document.body?.dataset?.intelApiDisabled === "1";
      const editable = !fileMode && intelCanEdit();
      const showAdminPanel = !fileMode
        && Boolean(intelAuthState.authRequired)
        && Boolean(intelAuthState.authConfigured)
        && Boolean(intelAuthState.authenticated);
      const showIntelControls = showAdminPanel;
      syncIntelAdminVisibility(showAdminPanel);

      if (analyzeBtn) analyzeBtn.disabled = !editable;
      if (syncBtn) syncBtn.disabled = !editable;
      if (input) input.disabled = !editable;
      if (adminControls) adminControls.style.display = showIntelControls ? "" : "none";
      if (adminPanel) adminPanel.style.display = showAdminPanel ? "grid" : "none";
      if (adminOpenBtn) adminOpenBtn.style.display = showAdminPanel ? "inline-flex" : "none";
      if (adminPipelineLink) adminPipelineLink.style.display = showAdminPanel ? "inline-flex" : "none";
      if (showAdminPanel) startIntelAdminPolling();
      else {
        stopIntelAdminPolling();
        closeIntelAdminModal();
      }
      loginButtons.forEach((btn) => { btn.style.display = "inline-flex"; });
      logoutButtons.forEach((btn) => { btn.style.display = "none"; });
      if (statusEl) statusEl.classList.remove("is-error");

      if (!statusEl) return;
      if (fileMode) {
        statusEl.textContent = "管理模式：file:// 唯讀（請改用 API 網址開啟）。";
        statusEl.classList.add("is-error");
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        if (adminPipelineLink) adminPipelineLink.style.display = "none";
        return;
      }
      if (!intelAuthState.ready || intelAuthState.checking) {
        statusEl.textContent = "管理模式：檢查登入狀態中...";
        return;
      }
      if (intelAuthState.mode === "auth-check-failed") {
        statusEl.textContent = `管理模式：登入狀態讀取失敗（${intelAuthState.error || "auth API unavailable"}）。`;
        statusEl.classList.add("is-error");
        loginButtons.forEach((btn) => { btn.style.display = "inline-flex"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        if (adminPipelineLink) adminPipelineLink.style.display = "none";
        return;
      }
      if (!intelAuthState.authRequired) {
        statusEl.textContent = "管理模式：目前為開放編輯（未啟用登入限制）。";
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        if (adminPipelineLink) adminPipelineLink.style.display = "none";
        return;
      }
      if (!intelAuthState.authConfigured) {
        statusEl.textContent = "管理模式：尚未設定管理員帳號（請設定後端 ENV）。";
        statusEl.classList.add("is-error");
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        if (adminPipelineLink) adminPipelineLink.style.display = "none";
        return;
      }
      if (intelAuthState.authenticated) {
        statusEl.textContent = `管理模式：已登入 @${intelAuthState.user || "admin"}，可修改資料。`;
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "inline-flex"; });
        return;
      }
      statusEl.textContent = "管理模式：唯讀。按 ⌘ + Shift + A 可開啟管理員登入。";
    }

    async function fetchIntelAuthState() {
      intelAuthState.checking = true;
      updateIntelAuthUi();
      try {
        const response = await fetch(intelApiUrl("/api/auth/me"), {
          method: "GET",
          credentials: "include",
          headers: buildIntelAuthHeaders(),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }
        const token = String(data?.token || "").trim();
        if (token) {
          saveIntelAuthToken(token);
        }
        intelAuthState.ready = true;
        intelAuthState.authRequired = Boolean(data?.auth_required);
        intelAuthState.authConfigured = Boolean(data?.auth_configured);
        intelAuthState.authenticated = Boolean(data?.authenticated);
        intelAuthState.user = String(data?.user || "");
        intelAuthState.mode = String(data?.mode || "");
        intelAuthState.error = String(data?.error || "");
        if (intelAuthState.authRequired && !intelAuthState.authenticated) {
          clearIntelAuthToken();
        }
      } catch (error) {
        intelAuthState.ready = true;
        intelAuthState.authRequired = true;
        intelAuthState.authConfigured = false;
        intelAuthState.authenticated = false;
        intelAuthState.user = "";
        intelAuthState.mode = "auth-check-failed";
        intelAuthState.error = String(error?.message || "");
        clearIntelAuthToken();
      } finally {
        intelAuthState.checking = false;
        updateIntelAuthUi();
      }
    }

    async function submitIntelLogin(username, password) {
      const response = await fetch(intelApiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: buildIntelAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      const token = String(data?.token || "").trim();
      if (token) {
        saveIntelAuthToken(token);
      }
      await fetchIntelAuthState();
      if (intelFeedCache) renderIntelFeed(intelFeedCache);
      return data;
    }

    async function submitIntelLogout() {
      const response = await fetch(intelApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: buildIntelAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      clearIntelAuthToken();
      await fetchIntelAuthState();
      if (intelFeedCache) renderIntelFeed(intelFeedCache);
      return data;
    }

    function routeLabelName(label) {
      const map = {
        events: uiLabel("event"),
        event: uiLabel("event"),
        official: uiLabel("official"),
        sbt: "SBT",
        pokemon: uiLabel("pokemon"),
        collectibles: uiLabel("collectibles"),
        alpha: uiLabel("alpha"),
        guides: uiLabel("guides"),
        tools: uiLabel("guides"),
        community: uiLabel("community"),
        other: uiLabel("other"),
      };
      return map[String(label || "").trim()] || "";
    }

    function isAlphaReleaseCard(card) {
      const cardType = String(card?.card_type || "").trim().toLowerCase();
      const labels = Array.isArray(card?.route_labels)
        ? card.route_labels.map((x) => String(x || "").trim().toLowerCase())
        : [];
      return (cardType === "feature" || cardType === "announcement") && labels.includes("alpha");
    }

    function extractSbtHowToGet(card) {
      const rows = [
        ...(Array.isArray(card?.detail_lines) ? card.detail_lines : []),
        ...(Array.isArray(card?.bullets) ? card.bullets : []),
        String(card?.summary || ""),
        String(card?.glance || ""),
      ]
        .map((x) => cleanMasterSummary(String(x || "")))
        .filter((x) => x);
      const direct = rows.find((x) => /sbt\s*取得方式[:：]/i.test(x));
      if (direct) return truncateText(direct.replace(/^.*?sbt\s*取得方式[:：]\s*/iu, ""), 82);
      const fallback = rows.find((x) => /(threshold|snapshot|top\s*\d+%|快照|門檻|排名|rank|解鎖|解锁|領取|领取|取得|獲得).{0,36}(sbt|soulbound|points?|積分|积分)|(sbt|soulbound|points?|積分|积分).{0,36}(threshold|snapshot|top\s*\d+%|快照|門檻|排名|rank|解鎖|解锁|領取|领取|取得|獲得)/i.test(x));
      if (!fallback) return "";
      return truncateText(fallback.replace(/^(更新重點|時間節點|活動重點|參與方式|你要做什麼|下一步)[:：]\s*/u, ""), 82);
    }

    function structuredSlots(card, leadText = "") {
      const dt = resolveExplicitTimelineDate(card);
      let whenText = dt ? toPosterDate(dt.toISOString()) : uiLabel("officialPending");
      if (!dt && hasLiveReleaseSignal(card)) {
        const pub = String(card?.published_at || "").trim();
        whenText = pub ? `${toPosterDate(pub)} (${uiLabel("liveReleased")})` : uiLabel("liveReleased");
      }
      const whatText = truncateText(cleanMasterTitle(card?.title || leadText || uiLabel("updatePending")), 68);
      const textBlob = cardTextBlob(card);
      const thresholdMatch = textBlob.match(/top\s*40%[^0-9]{0,6}(\d{2,5}).*top\s*10%[^0-9]{0,6}(\d{2,5}).*top\s*1%[^0-9]{0,6}(\d{2,5})/i);
      const isThresholdUpdate = /threshold|snapshot|top\s*\d+%/.test(textBlob) && /sbt|points|積分/.test(textBlob);
      const cardType = String(card?.card_type || "").trim().toLowerCase();
      const isAlpha = isAlphaReleaseCard(card);
      const routeLabels = Array.isArray(card?.route_labels)
        ? card.route_labels.map((x) => String(x || "").trim().toLowerCase())
        : [];
      const hasSbtLabel = routeLabels.includes("sbt");
      const details = [
        ...(Array.isArray(card?.detail_lines) ? card.detail_lines : []),
        ...(Array.isArray(card?.bullets) ? card.bullets : []),
      ].map((x) => cleanMasterSummary(x)).filter((x) => String(x || "").trim());
      const sbtHowToGet = extractSbtHowToGet(card);

      let impact = details.find((x) => /(影響|受影響|提升|降低|改變|風險|安全|效率)/.test(String(x)));
      if (!impact) impact = cleanMasterSummary(card?.summary || "");
      if (!impact) impact = String(leadText || uiLabel("audiencePending"));
      impact = truncateText(String(impact).replace(/^(可能影響|影響|重點在)[:：]\s*/u, ""), 78);

      let action = details.find((x) => /(下一步|你要做什麼|建議|先|設定頁|報名|參與|留意|關注|確認)/.test(String(x)));
      if (!action) {
        const join = String(card?.event_facts?.participation || "").trim();
        if (join) action = `${uiLabel("joinMethod")}: ${join}`;
      }
      if (!action) action = uiLabel("alphaCheckConditions");
      action = truncateText(String(action).replace(/^(下一步|你要做什麼|建議)[:：]\s*/u, ""), 78);

      if (isThresholdUpdate) {
        if (thresholdMatch) {
          const t40 = Number(thresholdMatch[1] || 0);
          const t10 = Number(thresholdMatch[2] || 0);
          const t1 = Number(thresholdMatch[3] || 0);
          if (t40 && t10 && t1) {
            impact = `Beta 2.0 參與者：前40% ${t40}分、前10% ${t10}分、前1% ${t1}分。`;
          }
        }
        if (!/快照|snapshot|04\//.test(whenText)) {
          const snap = details.find((x) => /(快照|snapshot|gmt|utc|\d{1,2}[:：]\d{2}\s*(am|pm))/i.test(String(x)));
          if (snap) {
            whenText = truncateText(String(snap).replace(/^(快照時間|時間節點|時間與地點)[:：]\s*/u, ""), 42);
          }
        }
        action = uiLabel("snapshotAction");
      }

      const factSchedule = String(card?.event_facts?.schedule || "").trim();
      const factLocation = String(card?.event_facts?.location || "").trim();
      const factReward = String(card?.event_facts?.reward || "").trim();
      const factJoin = String(card?.event_facts?.participation || "").trim();

      if (isAlpha) {
        const alphaAction = hasSbtLabel && sbtHowToGet ? `${uiLabel("sbtAcquisition")}: ${sbtHowToGet}` : (action || uiLabel("alphaCheckConditions"));
        return {
          title: uiLabel("alphaSlots"),
          slots: [
            { label: uiLabel("whenOnline"), value: whenText || uiLabel("officialPending") },
            { label: uiLabel("whatChanged"), value: whatText || uiLabel("updatePending") },
            { label: uiLabel("affected"), value: impact || uiLabel("audiencePending") },
            { label: uiLabel("nextFirst"), value: alphaAction },
          ],
        };
      }

      if (cardType === "event") {
        const place = truncateText(factLocation || details.find((x) => /(地點|場地|venue|hong kong|香港|discord|線上)/i.test(String(x))) || uiLabel("tbdOfficial"), 68);
        let reward = truncateText(factReward || details.find((x) => /(獎勵|reward|sbt|積分|airdrop|周邊)/i.test(String(x))) || uiLabel("basisFromSource"), 72);
        let next = truncateText(factJoin ? `${uiLabel("joinMethod")}: ${factJoin}` : (action || uiLabel("alphaCheckConditions")), 76);
        if (hasSbtLabel) {
          if (!/(sbt|soulbound)/i.test(reward)) reward = `SBT (${uiLabel("basisFromSource")})`;
          if (sbtHowToGet) next = truncateText(`${uiLabel("sbtAcquisition")}: ${sbtHowToGet}`, 82);
        }
        return {
          title: uiLabel("eventSlots"),
          slots: [
            { label: uiLabel("whenJoin"), value: truncateText(factSchedule || whenText || uiLabel("seeSourceTime"), 62) },
            { label: uiLabel("whereJoin"), value: place },
            { label: uiLabel("rewardGet"), value: reward },
            { label: uiLabel("nextFirst"), value: next },
          ],
        };
      }

      if (cardType === "market") {
        const numberLine = truncateText(
          details.find((x) => /(數字|成交|售價|價格|美元|usdt|ntd|%|volume|market)/i.test(String(x)))
            || uiLabel("seeSourcePrice"),
          74,
        );
        return {
          title: uiLabel("marketSlots"),
          slots: [
            { label: uiLabel("coreEvent"), value: truncateText(whatText || leadText || uiLabel("marketUpdate"), 72) },
            { label: uiLabel("keyNumber"), value: numberLine },
            { label: uiLabel("impact"), value: truncateText(impact || uiLabel("marketImpact"), 76) },
            { label: uiLabel("nextFirst"), value: truncateText(action || uiLabel("compareSourcesFirst"), 76) },
          ],
        };
      }

      if (cardType === "report") {
        const diff = truncateText(details.find((x) => /(優點|缺點|差異|比較|方案|成本)/.test(String(x))) || uiLabel("comparePlanDiff"), 76);
        const audience = truncateText(details.find((x) => /(適合|對象|玩家|新手|使用者|社群)/.test(String(x))) || uiLabel("planAudience"), 72);
        return {
          title: uiLabel("reportSlots"),
          slots: [
            { label: uiLabel("compareWhat"), value: truncateText(whatText || uiLabel("compareWhat"), 72) },
            { label: uiLabel("keyDiff"), value: diff },
            { label: uiLabel("audienceFit"), value: audience },
            { label: uiLabel("nextFirst"), value: truncateText(action || uiLabel("budgetTrial"), 76) },
          ],
        };
      }

      return {
        title: uiLabel("generalSlots"),
        slots: [
          { label: uiLabel("coreTopic"), value: truncateText(whatText || leadText || uiLabel("contentPending"), 72) },
          { label: uiLabel("contextNow"), value: truncateText(whenText || uiLabel("recentUpdate"), 64) },
          { label: uiLabel("yourImpact"), value: truncateText(impact || uiLabel("communityTrackingBasis"), 76) },
          { label: uiLabel("nextStep"), value: truncateText(action || uiLabel("followSameAccount"), 76) },
        ],
      };
    }

    function structuredSlotsHtml(card, leadText = "") {
      const structured = structuredSlots(card, leadText);
      const slots = Array.isArray(structured?.slots) ? structured.slots : [];
      if (!slots.length) return "";
      return `
        <div>
          <div class="intel-detail-block-title">${escapeHtml(String(structured?.title || uiLabel("generalSlots")))}</div>
          <div class="intel-alpha-slots">
            ${slots.slice(0, 4).map((row) => `
              <article class="intel-alpha-slot">
                <span class="intel-alpha-slot-label">${escapeHtml(String(row?.label || ""))}</span>
                <p class="intel-alpha-slot-value">${escapeHtml(String(row?.value || ""))}</p>
              </article>
            `).join("")}
          </div>
        </div>
      `;
    }

    function intelDetailHtml(card) {
      const typeLabel = intelTypeLabel(card?.card_type);
      const account = String(card?.account || "source").trim();
      const publish = toLocalTime(card?.published_at);
      const eventText = card?.timeline_date ? toPosterDate(card.timeline_date) : "--";
      const title = cleanMasterTitle(card?.title || uiLabel("unnamedPost"));
      const glance = cardPrimaryHighlight(card);
      const summary = cleanMasterSummary(card?.summary || "");
      const coverRaw = String(card?.cover_image || "").trim();
      const cover = (typeof resolveCoverImageUrl === "function") ? resolveCoverImageUrl(coverRaw) : coverRaw;
      const coverHtml = /^https?:\/\//i.test(cover)
        ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.closest('.intel-detail-cover')?.remove()" />`
        : `<div class="intel-detail-cover-empty">${escapeHtml(uiLabel("noImage"))}</div>`;
      const bullets = Array.isArray(card?.bullets) ? card.bullets.filter((x) => String(x || "").trim()).slice(0, 8) : [];
      const normalizedBullets = [];
      const seenBullets = new Set();
      bullets.forEach((raw) => {
        const text = normalizeKeylineText(raw);
        if (!text) return;
        const sig = text.toLowerCase();
        if (seenBullets.has(sig)) return;
        seenBullets.add(sig);
        normalizedBullets.push(text);
      });
      const bulletHtml = normalizedBullets.length
        ? `<ul class="intel-detail-list">${normalizedBullets.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : `<p class="intel-summary">${escapeHtml(uiLabel("noHighlights"))}</p>`;
      const summaryLead = summary.split("。").map((x) => String(x || "").trim()).find((x) => x) || "";
      const leadText = summaryLead || normalizeKeylineText(glance) || uiLabel("detailFallbackLead");
      const rawDetailSummary = cleanMasterSummary(card?.detail_summary || "");
      const detailSummary = rawDetailSummary && rawDetailSummary !== summary
        ? rawDetailSummary
        : "";
      const rawDetailLines = Array.isArray(card?.detail_lines) ? card.detail_lines : [];
      const normalizedDetailLines = [];
      const seenDetails = new Set();
      rawDetailLines.forEach((raw) => {
        const text = cleanMasterSummary(raw).trim();
        if (!text) return;
        const sig = text.toLowerCase();
        if (seenDetails.has(sig)) return;
        seenDetails.add(sig);
        normalizedDetailLines.push(text);
      });
      if (!normalizedDetailLines.length) {
        if (leadText) normalizedDetailLines.push(`${uiLabel("eventBackground")}: ${leadText}`);
        const facts = card?.event_facts || {};
        const scheduleText = String(facts?.schedule || "").trim() || (eventText !== "--" ? eventText : "");
        const locationText = String(facts?.location || "").trim();
        if (scheduleText || locationText) {
          normalizedDetailLines.push(`${uiLabel("timeLocation")}: ${[scheduleText, locationText].filter(Boolean).join(" / ")}`);
        }
        const rewardText = String(facts?.reward || "").trim();
        if (rewardText) normalizedDetailLines.push(`${uiLabel("rewardIncentive")}: ${rewardText}`);
        const joinText = String(facts?.participation || "").trim();
        if (joinText) normalizedDetailLines.push(`${uiLabel("joinMethod")}: ${joinText}`);
        const impactHint = normalizeKeylineText(card?.glance || "");
        if (impactHint) normalizedDetailLines.push(`${uiLabel("possibleImpact")}: ${impactHint}`);
        normalizedDetailLines.push(`${uiLabel("nextStep")}: ${uiLabel("sourceRulesFirst")}`);
      }
      const detailHtml = normalizedDetailLines.length
        ? `<ul class="intel-detail-list">${normalizedDetailLines.slice(0, 6).map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : `<p class="intel-summary">${escapeHtml(uiLabel("noExpanded"))}</p>`;
      const eventFactsHtml = renderEventFactsHtml(card);
      const labels = Array.isArray(card?.route_labels) ? card.route_labels : [];
      const tagHtml = labels.length
        ? `<div class="intel-detail-tags">${labels.map((x) => `<span class="intel-detail-tag">${escapeHtml(routeLabelName(x) || translateDisplayLabel(x) || String(x))}</span>`).join("")}</div>`
        : "";
      const url = String(card?.url || "").trim();
      const sourceHtml = url
        ? `<div class="intel-detail-source"><span class="intel-detail-block-title">${escapeHtml(uiLabel("originalSource"))}</span><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>`
        : "";
      const summaryBlock = (summary && !summary.startsWith(leadText) && !leadText.startsWith(summary))
        ? `<p class="intel-summary">${escapeHtml(summary)}</p>`
        : "";
      const alphaSlotsBlock = structuredSlotsHtml(card, leadText);
      return `
        <div class="intel-detail-top">
          <span class="intel-detail-kicker">@${escapeHtml(account)} · ${escapeHtml(typeLabel)}</span>
          <span class="intel-detail-time">${escapeHtml(uiLabel("published"))} ${escapeHtml(publish)} · ${escapeHtml(uiLabel("eventDate"))} ${escapeHtml(eventText)}</span>
        </div>
        <div class="intel-detail-cover">${coverHtml}</div>
        <h3 class="intel-detail-title">${escapeHtml(title)}</h3>
        <div class="intel-detail-grid">
          <section class="intel-detail-section">
            <div class="intel-detail-block-title">${escapeHtml(uiLabel("oneLine"))}</div>
            <p class="intel-detail-glance">${escapeHtml(leadText)}</p>
            ${summaryBlock}
            ${eventFactsHtml ? `<div><div class="intel-detail-block-title">${escapeHtml(uiLabel("eventInfo"))}</div><div class="intel-detail-facts">${eventFactsHtml}</div></div>` : ""}
            <div class="intel-detail-block-title">${escapeHtml(uiLabel("quickPoints"))}</div>
            ${bulletHtml}
          </section>
          <section class="intel-detail-section">
            ${alphaSlotsBlock}
            <div class="intel-detail-block-title">${escapeHtml(uiLabel("aiDeepDive"))}</div>
            ${detailSummary ? `<p class="intel-summary">${escapeHtml(detailSummary)}</p>` : ""}
            ${detailHtml}
            ${tagHtml ? `<div><div class="intel-detail-block-title">${escapeHtml(uiLabel("categoryTags"))}</div>${tagHtml}</div>` : ""}
          </section>
        </div>
        ${sourceHtml}
      `;
    }

    function openDetailModalWithHtml(html) {
      const modal = document.getElementById("intel-detail-modal");
      const content = document.getElementById("intel-detail-content");
      if (!modal || !content) return;
      content.setAttribute("data-no-i18n", "1");
      content.innerHTML = String(html || "");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("intel-modal-open");
      applyUiLanguage().catch(() => {});
    }

    function openIntelDetailModal(cardKey) {
      const key = String(cardKey || "").trim();
      if (!key) return;
      const card = intelCardLookup.get(key);
      if (!card) return;
      openDetailModalWithHtml(intelDetailHtml(card));
    }

    function normalizeSbtText(raw, limit = 120) {
      return truncateText(String(raw || "")
        .replace(/^\s*SBT\s*(取得方式|获取方式|acquisition|획득 방법)\s*[:：]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim(), limit);
    }

    function isWeakSbtName(name) {
      const text = String(name || "").replace(/\s+/g, " ").trim();
      if (!text) return true;
      if (!/(sbt|soulbound|認證|认证|徽章|badge)/i.test(text)) return true;
      return /^(#?\d+\s*)?(個|个)?\s*sbt$/i.test(text)
        || /^的\s*sbt$/i.test(text)
        || /^此結果代表.*sbt$/i.test(text)
        || /^目前共有.*sbt$/i.test(text)
        || /^同步釋出\s*sbt$/i.test(text)
        || /^對應\s*sbt$/i.test(text)
        || /^已結束的\s*sbt$/i.test(text);
    }

    function sbtNamesForCard(card) {
      const rows = [];
      if (Array.isArray(card?.sbt_names)) rows.push(...card.sbt_names);
      if (card?.sbt_name) rows.push(card.sbt_name);
      const seen = new Set();
      return rows
        .map((x) => normalizeSbtText(x, 64))
        .filter((x) => x && !isWeakSbtName(x))
        .filter((x) => {
          const key = x.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 4);
    }

    function sbtDisplayTitle(card) {
      const names = sbtNamesForCard(card);
      if (names.length) return names.join(" / ");
      return "";
    }

    function sbtAcquisitionForCard(card) {
      let direct = normalizeSbtText(card?.sbt_acquisition, 128);
      if (!direct) {
        const rows = [
          ...(Array.isArray(card?.detail_lines) ? card.detail_lines : []),
          ...(Array.isArray(card?.bullets) ? card.bullets : []),
        ];
        const explicit = rows.find((x) => /^\s*SBT\s*(取得方式|获取方式|acquisition|획득 방법)\s*[:：]/i.test(String(x || "")));
        direct = normalizeSbtText(explicit, 128);
      }
      if (!direct) return "";
      if (/^(依官方|以原文|待官方|原文未明確|请看原文|請看原文)/.test(direct)) return "";
      if (!/(取得|獲得|获得|領取|领取|解鎖|解锁|空投|快照|達到|达到|完成|報名|报名|參與|参与|抽|開出|开出|pull|open|claim|airdrop|snapshot|unlock)/i.test(direct)) return "";
      if (/(top value|packs only|lands tomorrow|cards to hunt|here are the top|https?:\/\/)/i.test(direct)) return "";
      return direct;
    }

    function sbtEffectiveEndDate(card) {
      const endRaw = String(card?.timeline_end_date || "").trim();
      if (endRaw) return endRaw;
      return String(card?.timeline_date || "").trim();
    }

    function sbtStatusForCard(card) {
      const dateRaw = sbtEffectiveEndDate(card);
      if (!dateRaw) return { label: uiLabel("sbtStatusPending"), expired: false, date: toPosterDate(card?.published_at) };
      const dt = new Date(dateRaw);
      if (Number.isNaN(dt.valueOf())) return { label: uiLabel("sbtStatusPending"), expired: false, date: toPosterDate(card?.published_at) };
      const endOfDay = new Date(dt);
      endOfDay.setHours(23, 59, 59, 999);
      const isExpired = endOfDay.getTime() < Date.now();
      return {
        label: isExpired ? uiLabel("sbtStatusExpired") : uiLabel("sbtStatusClaimable"),
        expired: isExpired,
        date: toPosterDate(dateRaw),
      };
    }

    function sbtNameGroupKey(names) {
      return (Array.isArray(names) ? names : [])
        .map((x) => String(x || "").trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join("||");
    }

    function sbtRowTimeMs(card) {
      const raw = String(card?.timeline_date || card?.published_at || "").trim();
      if (!raw) return 0;
      const dt = new Date(raw);
      return Number.isNaN(dt.valueOf()) ? 0 : dt.getTime();
    }

    function pickBetterSbtSummaryRow(current, incoming) {
      const currentAcqLen = String(current?.acquisition || "").trim().length;
      const incomingAcqLen = String(incoming?.acquisition || "").trim().length;
      if (incomingAcqLen !== currentAcqLen) return incomingAcqLen > currentAcqLen ? incoming : current;
      const currentActive = current?.status?.expired ? 0 : 1;
      const incomingActive = incoming?.status?.expired ? 0 : 1;
      if (incomingActive !== currentActive) return incomingActive > currentActive ? incoming : current;
      return sbtRowTimeMs(incoming?.card) >= sbtRowTimeMs(current?.card) ? incoming : current;
    }

    let sbtAcqEditMode = false;

    function renderSbtAcquisitionSummary(cards, allCards = []) {
      const panel = document.getElementById("intel-sbt-acquisition-panel");
      const list = document.getElementById("intel-sbt-acquisition-list");
      const empty = document.getElementById("intel-sbt-acquisition-empty");
      const count = document.getElementById("intel-sbt-acquisition-count");
      const title = document.getElementById("intel-sbt-acquisition-title");
      const next = document.getElementById("intel-sbt-acquisition-next");
      if (!panel || !list || !empty || !count || !title || !next) return;
      const adminMode = intelCanEdit();
      title.textContent = uiLabel("sbtAcquisition");
      if (adminMode) {
        next.innerHTML = `
          <span>${escapeHtml(uiLabel("sbtAcquisitionNext"))}</span>
          <button type="button" class="sbt-acq-mode-btn" data-sbt-edit-toggle>
            ${escapeHtml(sbtAcqEditMode ? "完成編輯" : "編輯")}
          </button>
        `;
      } else {
        next.textContent = uiLabel("sbtAcquisitionNext");
      }
      empty.textContent = uiLabel("sbtAcquisitionEmpty");
      const candidateRows = (Array.isArray(cards) ? cards : [])
        .map((card, idx) => {
          const names = sbtNamesForCard(card);
          if (!names.length) return null;
          const acquisition = sbtAcquisitionForCard(card);
          const key = String(card?._card_key || cardStableKey(card, idx)).trim();
          return { card, key, cardId: String(card?.id || "").trim(), names, name: names.join(" / "), acquisition, status: sbtStatusForCard(card) };
        })
        .filter(Boolean);
      const grouped = new Map();
      for (const row of candidateRows) {
        const groupKey = sbtNameGroupKey(row.names);
        if (!groupKey) continue;
        const prev = grouped.get(groupKey);
        grouped.set(groupKey, prev ? pickBetterSbtSummaryRow(prev, row) : row);
      }
      const rows = Array.from(grouped.values())
        .sort((a, b) => sbtRowTimeMs(b.card) - sbtRowTimeMs(a.card))
        .slice(0, 10);
      const cardsForSelect = (Array.isArray(allCards) ? allCards : [])
        .map((card, idx) => {
          const id = String(card?.id || "").trim();
          if (!id) return null;
          const titleText = cleanMasterTitle(String(card?.title || card?.glance || uiLabel("unnamedPost")));
          const account = String(card?.account || "source").trim();
          const whenText = toPosterDate(String(card?.timeline_date || card?.published_at || ""));
          const key = String(card?._card_key || cardStableKey(card, idx)).trim();
          return { id, key, label: `@${account} · ${titleText} · ${whenText || "--"}` };
        })
        .filter(Boolean);
      const optionHtml = cardsForSelect
        .map((row) => `<option value="${escapeHtml(row.id)}" data-card-key="${escapeHtml(row.key)}">${escapeHtml(row.label)}</option>`)
        .join("");
      count.textContent = String(rows.length);
      list.innerHTML = rows.map((row, idx) => `
        <div class="sbt-acq-row-wrap" data-sbt-row="${escapeHtml(row.key)}">
          <button type="button" class="sbt-acq-row" data-sbt-jump-card="${escapeHtml(row.key)}">
            <span class="sbt-acq-index">#${idx + 1}</span>
            <span class="sbt-acq-main">
              <span class="sbt-acq-name">${escapeHtml(row.name)}</span>
              ${row.acquisition ? `<span class="sbt-acq-method">${escapeHtml(row.acquisition)}</span>` : ""}
            </span>
            <span class="sbt-acq-meta">
              <span>${escapeHtml(row.status.date || "--")}</span>
              <span class="sbt-acq-status ${row.status.expired ? "is-expired" : (row.status.label === uiLabel("sbtStatusClaimable") ? "is-claimable" : "")}">${escapeHtml(row.status.label)}</span>
            </span>
          </button>
          ${adminMode && sbtAcqEditMode && row.cardId ? `<button type="button" class="sbt-acq-edit-btn" data-sbt-edit-open="${escapeHtml(row.key)}">${escapeHtml("編輯")}</button>` : ""}
          ${adminMode && sbtAcqEditMode && row.cardId ? `<div class="sbt-acq-editor" data-sbt-editor="${escapeHtml(row.key)}" hidden>
            <div class="sbt-acq-editor-fields">
              <label>SBT Name
                <input type="text" data-sbt-edit-name value="${escapeHtml(row.name)}" />
              </label>
              <label>SBT 取得方式
                <textarea data-sbt-edit-acq rows="2">${escapeHtml(row.acquisition || "")}</textarea>
              </label>
              <label>Start
                <input type="date" data-sbt-edit-start value="${escapeHtml(String(row.card?.timeline_date || "").trim().slice(0, 10))}" />
              </label>
              <label>End
                <input type="date" data-sbt-edit-end value="${escapeHtml(String(row.card?.timeline_end_date || "").trim().slice(0, 10))}" />
              </label>
            </div>
            <div class="sbt-acq-editor-actions">
              <button type="button" class="intel-pick-btn" data-sbt-edit-save="${escapeHtml(row.cardId)}" data-sbt-row-key="${escapeHtml(row.key)}">更新SBT</button>
              <button type="button" class="intel-pick-btn" data-sbt-edit-cancel="${escapeHtml(row.key)}">取消</button>
            </div>
          </div>` : ""}
        </div>
      `).join("");
      if (adminMode && sbtAcqEditMode) {
        list.insertAdjacentHTML("beforeend", `
          <div class="sbt-acq-add" data-sbt-add-box>
            <div class="sbt-acq-add-title">新增 SBT 取得方式</div>
            <div class="sbt-acq-add-grid">
              <label>連接卡片
                <select data-sbt-add-card>
                  <option value="">請選擇卡片</option>
                  ${optionHtml}
                </select>
              </label>
              <label>SBT Name
                <input type="text" data-sbt-add-name placeholder="例如：RenaCrypt Restock SBT" />
              </label>
              <label>SBT 取得方式
                <textarea data-sbt-add-acq rows="2" placeholder="例如：在 5 月前完成一次抽卡即可解鎖"></textarea>
              </label>
              <label>Start
                <input type="date" data-sbt-add-start />
              </label>
              <label>End
                <input type="date" data-sbt-add-end />
              </label>
            </div>
            <div class="sbt-acq-editor-actions">
              <button type="button" class="intel-pick-btn" data-sbt-add-save>新增 / 注入卡片</button>
            </div>
          </span>
          </div>
        `);
      }
      empty.style.display = rows.length ? "none" : "block";
      panel.style.display = (rows.length || (adminMode && sbtAcqEditMode)) ? "block" : "none";
    }

    function pokemonNewsDetailHtml(item) {
      const title = String(item?.summary_title || item?.title || uiLabel("unnamedPost")).trim();
      const summary = String(item?.summary || "").trim();
      const source = String(item?.source || "unknown").trim();
      const dateText = String(item?.date || "").trim();
      const points = Array.isArray(item?.key_points) ? item.key_points.filter((x) => String(x || "").trim()).slice(0, 6) : [];
      const pointHtml = points.length
        ? `<ul class="intel-detail-list">${points.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : `<p class="intel-summary">${escapeHtml(uiLabel("noPokemonPoints"))}</p>`;
      const detailLines = Array.isArray(item?.detail_lines) ? item.detail_lines.filter((x) => String(x || "").trim()).slice(0, 6) : [];
      const detailHtml = detailLines.length
        ? `<ul class="intel-detail-list">${detailLines.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : "";
      const url = String(item?.url || "").trim();
      const sourceHtml = url
        ? `<div class="intel-detail-source"><span class="intel-detail-block-title">${uiLabel("originalSource")}</span><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>`
        : "";
      return `
        <div class="intel-detail-top">
          <span class="intel-detail-kicker">${escapeHtml(uiLabel("pokemonNews"))} · ${escapeHtml(source)}</span>
          <span class="intel-detail-time">${escapeHtml(dateText || "--")}</span>
        </div>
        <h3 class="intel-detail-title">${escapeHtml(title)}</h3>
        ${summary ? `<p class="intel-detail-glance">${escapeHtml(summary)}</p>` : ""}
        <div><div class="intel-detail-block-title">${escapeHtml(uiLabel("keySummary"))}</div>${pointHtml}</div>
        ${detailHtml ? `<div><div class="intel-detail-block-title">${escapeHtml(uiLabel("fullSummary"))}</div>${detailHtml}</div>` : ""}
        ${sourceHtml}
      `;
    }

    function openPokemonNewsDetailModal(index) {
      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0) return;
      const item = pokemonNewsItemsState[idx];
      if (!item) return;
      openDetailModalWithHtml(pokemonNewsDetailHtml(item));
    }

    function closeIntelDetailModal() {
      const modal = document.getElementById("intel-detail-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("intel-modal-open");
    }

    function openIntelAuthModal() {
      const modal = document.getElementById("intel-auth-modal");
      if (!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      const userInput = document.getElementById("intel-auth-username");
      if (userInput) userInput.focus();
    }

    function closeIntelAuthModal(clearPassword = false) {
      const modal = document.getElementById("intel-auth-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (clearPassword) {
        const passInput = document.getElementById("intel-auth-password");
        if (passInput) passInput.value = "";
      }
    }

    function openIntelAdminModal() {
      const modal = document.getElementById("intel-admin-modal");
      if (!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    }

    function closeIntelAdminModal() {
      const modal = document.getElementById("intel-admin-modal");
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }

    function resolveIntelFeedbackModal(value) {
      const resolver = intelFeedbackModalResolver;
      intelFeedbackModalResolver = null;
      if (typeof resolver === "function") resolver(value);
    }

    function closeIntelFeedbackModal(value = null) {
      const modal = document.getElementById("intel-feedback-modal");
      if (!modal) {
        resolveIntelFeedbackModal(value);
        return;
      }
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      resolveIntelFeedbackModal(value);
    }

    const intelTopicLabelTextMap = {
      events: "活動分區",
      official: "官方近期更新",
      sbt: "SBT 分區",
      pokemon: "寶可夢分區",
      collectibles: "收藏趨勢分區",
      alpha: "未來規劃分區",
      guides: "攻略分區",
      community: "社群精選",
      other: "無",
    };

    function intelTopicLabelName(label) {
      const normalized = String(label || "").trim().toLowerCase();
      return intelTopicLabelTextMap[normalized] || normalized || "--";
    }

    function setFeedbackTopicSelections(labels) {
      const normalized = normalizeTopicLabels(labels);
      const selected = new Set(normalized.includes("other") ? ["other"] : normalized);
      document.querySelectorAll("[data-intel-feedback-section-option]").forEach((node) => {
        node.checked = selected.has(String(node.value || "").trim().toLowerCase());
      });
    }

    function openIntelFeedbackModal(options = {}) {
      const modal = document.getElementById("intel-feedback-modal");
      const titleEl = document.getElementById("intel-feedback-title");
      const subEl = document.getElementById("intel-feedback-sub");
      const cardTypeField = document.getElementById("intel-feedback-card-type-field");
      const cardTypeEl = document.getElementById("intel-feedback-card-type");
      const sectionField = document.getElementById("intel-feedback-section-field");
      const sectionCurrentEl = document.getElementById("intel-feedback-section-current");
      const reasonEl = document.getElementById("intel-feedback-reason");
      if (!modal || !cardTypeEl || !reasonEl) return Promise.resolve(null);

      const mode = String(options.mode || "feedback");
      const card = options.card && typeof options.card === "object" ? options.card : {};
      const defaultLabel = String(options.defaultLabel || "insight").trim().toLowerCase();
      const cardTypeLabels = new Set(["event", "feature", "announcement", "market", "trend", "report", "insight"]);
      const sectionLabels = new Set(["events", "official", "sbt", "pokemon", "collectibles", "alpha", "guides", "community", "other"]);
      const cardTypeFromCard = String(options.cardType || card?.card_type || "").trim().toLowerCase();
      const defaultCardType = cardTypeLabels.has(cardTypeFromCard)
        ? cardTypeFromCard
        : (cardTypeLabels.has(defaultLabel) ? defaultLabel : "");
      const defaultSection = sectionLabels.has(defaultLabel) ? defaultLabel : "";
      const currentTopicLabels = normalizeTopicLabels(options.topicLabels || card?.topic_labels || []);
      const selectedTopicLabels = currentTopicLabels.length
        ? currentTopicLabels
        : (defaultSection ? [defaultSection] : ["other"]);
      const isExclude = mode === "exclude";
      if (titleEl) titleEl.textContent = isExclude ? "排除這篇貼文" : "回饋分類";
      if (subEl) {
        subEl.textContent = isExclude
          ? "可直接排除這篇貼文。原因可選，填寫後才會讓 AI 下次遇到類似內容時避開。"
          : "請確認卡片類型與最終分區。分區會以目前勾選結果完整覆蓋，避免多重分區被誤刪。";
      }
      modal.dataset.mode = mode;
      if (cardTypeField) cardTypeField.style.display = isExclude ? "none" : "";
      if (sectionField) sectionField.style.display = isExclude ? "none" : "";
      cardTypeEl.value = isExclude ? "" : defaultCardType;
      setFeedbackTopicSelections(isExclude ? [] : selectedTopicLabels);
      if (sectionCurrentEl) {
        sectionCurrentEl.textContent = `目前分區：${selectedTopicLabels.map(intelTopicLabelName).join(" / ") || "--"}`;
      }
      reasonEl.value = "";
      reasonEl.placeholder = isExclude
        ? "可選填：例，這只是卡包 / 功能更新，不是需要放在活動主時間軸的活動。"
        : "可選填：若希望 AI 下次學到規則，再補充為什麼要這樣分。";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      window.setTimeout(() => (isExclude ? reasonEl : cardTypeEl).focus(), 0);

      return new Promise((resolve) => {
        if (intelFeedbackModalResolver) resolveIntelFeedbackModal(null);
        intelFeedbackModalResolver = resolve;
      });
    }

    function renderIntelCategoryNow(category, context = intelLazyRenderContext) {
      const ctx = context || intelLazyRenderContext;
      if (!ctx || ctx.token !== intelLazyRenderToken) return false;
      const name = normalizeIntelCategoryName(category);
      if (intelLazyRenderedCategories.has(name)) return true;
      const routed = ctx.routed || {};
      const els = ctx.elements || {};
      if (name === "events") {
        renderSectionList(els.eventsList, cardsToSectionItems(ctx.eventsByPublished), uiLabel("noHighlights"));
        renderSectionList(els.featuresList, cardsToSectionItems(ctx.alphaFutureCards), uiLabel("noHighlights"));
        renderMasterTimeline({ cards: ctx.timelineCards });
        renderCardGrid("intel-events-cards", "intel-events-empty", ctx.eventsByPublished, uiLabel("noHighlights"));
      } else if (name === "official") {
        renderSectionList(els.officialList, cardsToSectionItems(routed.official), uiLabel("noHighlights"));
        renderSectionList(els.communityList, cardsToSectionItems(routed.community), uiLabel("noHighlights"));
        renderAgendaList(els.growthList, ctx.agenda?.growth_signals, uiLabel("noHighlights"));
        renderAgendaList(els.recentList, ctx.officialAgenda, uiLabel("noHighlights"));
        renderCardGrid("intel-cards", "intel-empty", routed.official, uiLabel("noHighlights"));
      } else if (name === "sbt") {
        renderSbtAcquisitionSummary(routed.sbt, ctx.cards);
        renderCardGrid("intel-sbt-cards", "intel-sbt-empty", routed.sbt, uiLabel("noHighlights"));
      } else if (name === "pokemon") {
        renderCardGrid("intel-pokemon-cards", "intel-pokemon-empty", routed.pokemon, uiLabel("noHighlights"));
        if (normalizeIntelCategoryName(getActiveIntelCategory()) === "pokemon") {
          maybeRefreshPokemonNewsForCategory("pokemon");
        }
      } else if (name === "collectibles") {
        renderCardGrid("intel-collectibles-cards", "intel-collectibles-empty", routed.collectibles, uiLabel("noHighlights"));
      } else if (name === "alpha") {
        renderCardGrid("intel-alpha-cards", "intel-alpha-empty", ctx.alphaFutureCards, uiLabel("noHighlights"));
      } else if (name === "guides") {
        renderCardGrid("intel-guides-cards", "intel-guides-empty", routed.guides, uiLabel("noHighlights"));
      } else if (name === "community") {
        renderCardGrid("intel-community-cards", "intel-community-empty", routed.community, uiLabel("noHighlights"));
      } else if (name === "other") {
        renderCardGrid("intel-other-cards", "intel-other-empty", routed.other, uiLabel("noHighlights"));
      }
      intelLazyRenderedCategories.add(name);
      intelDeferredCategoryQueue = intelDeferredCategoryQueue.filter((item) => item !== name);
      markLocalizedDynamicRegions();
      updateIntelAuthUi();
      if (normalizeIntelCategoryName(getActiveIntelCategory()) === name) {
        scheduleUiLanguageApply(90);
      }
      return true;
    }

    function renderIntelCategoryFromCurrentFeed(category) {
      return renderIntelCategoryNow(category, intelLazyRenderContext);
    }

    function scheduleIntelDeferredCategoryRender(delay = 6200) {
      if (!intelLazyRenderContext || !intelDeferredCategoryQueue.length || intelDeferredCategoryTimer) return;
      intelDeferredCategoryTimer = window.setTimeout(() => {
        intelDeferredCategoryTimer = null;
        scheduleIdleTask(() => {
          renderNextIntelDeferredCategory();
        });
      }, Math.max(0, Number(delay) || 0));
    }

    function renderNextIntelDeferredCategory() {
      if (!intelLazyRenderContext || !intelDeferredCategoryQueue.length) return;
      const next = intelDeferredCategoryQueue.shift();
      if (next) renderIntelCategoryNow(next, intelLazyRenderContext);
      if (intelDeferredCategoryQueue.length) {
        scheduleIntelDeferredCategoryRender(3200);
      }
    }

    function resetIntelCategoryRenderQueue(context, activeCategoryName) {
      intelLazyRenderContext = context;
      intelLazyRenderedCategories = new Set();
      const activeName = normalizeIntelCategoryName(activeCategoryName);
      intelDeferredCategoryQueue = INTEL_CATEGORY_RENDER_ORDER.filter((name) => name !== activeName);
      if (intelDeferredCategoryTimer) {
        window.clearTimeout(intelDeferredCategoryTimer);
        intelDeferredCategoryTimer = null;
      }
      renderIntelCategoryNow(activeName, context);
      scheduleIntelDeferredCategoryRender(6200);
    }

    function renderIntelFeed(payload) {
      intelFeedCache = payload && typeof payload === "object" ? payload : null;
      const payloadLang = normalizeUiLang(payload?.lang || currentUiLang || "zh-Hant");
      const payloadMode = String(payload?._i18n?.mode || "");
      const shouldPersistSnapshot = !payload?._recovered_from_snapshot && !(
        payloadLang !== "zh-Hant"
        && (payloadMode === "building" || payloadMode === "building-stale" || payloadMode === "base-fallback")
      );
      if (intelFeedCache) {
        intelFeedLangCache.set(payloadLang, intelFeedCache);
        if (shouldPersistSnapshot) {
          saveIntelFeedSnapshot(payloadLang, intelFeedCache);
        }
      }
      const generatedAt = document.getElementById("intel-generated-at");
      const latestSourceAt = document.getElementById("intel-latest-source-at");
      const cardCount = document.getElementById("intel-card-count");
      const accountCount = document.getElementById("intel-account-count");
      const headline = document.getElementById("intel-headline");
      const conclusion = document.getElementById("intel-conclusion");
      const takeaways = document.getElementById("intel-takeaways");
      const sourceStatus = document.getElementById("intel-source-status");
      const keyTerms = document.getElementById("intel-key-terms");
      const formatTemplates = document.getElementById("intel-format-templates");
      const officialOverviewTitle = document.getElementById("intel-official-overview-title");
      const officialOverviewSummary = document.getElementById("intel-official-overview-summary");
      const officialOverviewBullets = document.getElementById("intel-official-overview-bullets");
      const officialList = document.getElementById("intel-official-list");
      const eventsList = document.getElementById("intel-events-list");
      const featuresList = document.getElementById("intel-features-list");
      const communityList = document.getElementById("intel-community-list");
      const growthList = document.getElementById("intel-growth-list");
      const recentList = document.getElementById("intel-recent-list");
      if (!generatedAt || !latestSourceAt || !cardCount || !accountCount || !headline || !conclusion || !takeaways || !sourceStatus) return;

      const cards = Array.isArray(payload?.cards) ? payload.cards : [];
      const routed = routeIntelCards(cards);
      const alphaFutureCards = routed.alpha;
      syncIntelCardLookup(routed);
      const digest = payload?.digest || {};
      const stats = payload?.source_stats || {};
      const quality = payload?.source_quality || {};
      const notes = payload?.notes || {};
      const agenda = payload?.intel_agenda || {};
      const officialOverview = payload?.official_overview || {};
      const templateCounts = payload?.template_counts || {};
      const manualPicks = payload?.manual_picks || {};
      const feedbackStats = payload?.feedback_stats || {};
      const excluded = Number(payload?.excluded_cards || 0);
      const excludedBySelection = Number(payload?.excluded_by_selection || 0);
      const excludedByFeedback = Number(payload?.excluded_by_feedback || 0);
      const activeAccounts = new Set(cards.map((x) => x.account).filter(Boolean));

      generatedAt.textContent = toLocalTime(payload?.generated_at);
      const latestSourceMillis = cards.reduce((max, card) => {
        const ts = toTimestamp(card?.published_at);
        return ts > max ? ts : max;
      }, 0);
      if (latestSourceMillis > 0) {
        const latestDt = new Date(latestSourceMillis);
        const ageDays = Math.max(0, Math.floor((Date.now() - latestSourceMillis) / 86400000));
        latestSourceAt.textContent = `${toLocalTime(latestDt.toISOString())} · ${ageDays}天前`;
      } else {
        latestSourceAt.textContent = "--";
      }
      cardCount.textContent = String(payload?.total_cards || cards.length || 0);
      accountCount.textContent = String(activeAccounts.size);
      headline.textContent = String(digest.headline || "Spring AI 關鍵情報總結");
      conclusion.textContent = String(digest.conclusion || uiLabel("noExpanded"));

      takeaways.innerHTML = "";
      const tips = Array.isArray(digest.takeaways) && digest.takeaways.length
        ? digest.takeaways.slice(0, 3)
        : [uiLabel("noHighlights")];
      tips.forEach((tip) => {
        const li = document.createElement("li");
        li.textContent = String(tip);
        takeaways.appendChild(li);
      });

      sourceStatus.innerHTML = "";
      const providerTag = document.createElement("span");
      providerTag.className = "intel-tag";
      providerTag.textContent = `twitter-cli:${notes?.twitter_cli_ready ? "on" : "off"}`;
      sourceStatus.appendChild(providerTag);
      const excludedTag = document.createElement("span");
      excludedTag.className = "intel-tag";
      excludedTag.textContent = `noise filtered:${excluded}`;
      sourceStatus.appendChild(excludedTag);
      const selectionTag = document.createElement("span");
      selectionTag.className = "intel-tag";
      selectionTag.textContent = `manual exclude:${excludedBySelection}`;
      sourceStatus.appendChild(selectionTag);
      const feedbackTag = document.createElement("span");
      feedbackTag.className = "intel-tag";
      feedbackTag.textContent = `feedback override:${Number(feedbackStats?.override_count || 0)}`;
      sourceStatus.appendChild(feedbackTag);
      const feedbackExcludeTag = document.createElement("span");
      feedbackExcludeTag.className = "intel-tag";
      feedbackExcludeTag.textContent = `feedback exclude:${excludedByFeedback}`;
      sourceStatus.appendChild(feedbackExcludeTag);
      const imageTag = document.createElement("span");
      imageTag.className = "intel-tag";
      imageTag.textContent = `images:${Number(payload?.image_cards || 0)}`;
      sourceStatus.appendChild(imageTag);
      const tplTag = document.createElement("span");
      tplTag.className = "intel-tag";
      tplTag.textContent = `templates E:${Number(templateCounts?.event_poster || 0)} M:${Number(templateCounts?.market_signal || 0)} A:${Number(templateCounts?.announcement_timeline || 0)} C:${Number(templateCounts?.community_brief || 0)}`;
      sourceStatus.appendChild(tplTag);
      const pickTag = document.createElement("span");
      pickTag.className = "intel-tag";
      pickTag.textContent = `manual keep:${Number(manualPicks?.include_count || 0)}`;
      sourceStatus.appendChild(pickTag);
      const pinTag = document.createElement("span");
      pinTag.className = "intel-tag";
      pinTag.textContent = `manual pin:${Number(manualPicks?.pin_count || 0)}`;
      sourceStatus.appendChild(pinTag);
      const bottomTag = document.createElement("span");
      bottomTag.className = "intel-tag";
      bottomTag.textContent = `manual bottom:${Number(manualPicks?.bottom_count || 0)}`;
      sourceStatus.appendChild(bottomTag);
      const accountItems = Object.entries(stats);
      if (accountItems.length) {
        accountItems.forEach(([name, count]) => {
          const item = document.createElement("span");
          item.className = "intel-tag";
          const qRaw = String(quality?.[name] || "unknown");
          const qMap = {
            "twitter-cli": "twitter-cli",
            "r.jina.ai": "r.jina.ai",
            "mixed": "mixed",
            "no-data": "no-data",
          };
          const q = qMap[qRaw] || qRaw;
          item.textContent = `@${name}: ${count} · ${q}`;
          sourceStatus.appendChild(item);
        });
      } else {
        const item = document.createElement("span");
        item.className = "intel-tag";
        item.textContent = uiLabel("noHighlights");
        sourceStatus.appendChild(item);
      }

      if (keyTerms) {
        keyTerms.innerHTML = "";
        const terms = Array.isArray(payload?.key_terms) ? payload.key_terms.slice(0, 12) : [];
        if (terms.length) {
          terms.forEach((term) => {
            const chip = document.createElement("span");
            chip.className = "intel-tag";
            chip.textContent = `#${String(term)}`;
            keyTerms.appendChild(chip);
          });
        } else {
          const chip = document.createElement("span");
          chip.className = "intel-tag";
          chip.textContent = uiLabel("noHighlights");
          keyTerms.appendChild(chip);
        }
      }

      if (formatTemplates) {
        formatTemplates.innerHTML = "";
        const templates = Array.isArray(payload?.format_templates) ? payload.format_templates.slice(0, 4) : [];
        if (templates.length) {
          templates.forEach((tpl) => {
            const div = document.createElement("div");
            div.className = "intel-template-item";
            const name = String(tpl?.name || tpl?.id || uiLabel("unnamedPost"));
            const useFor = String(tpl?.for || "");
            div.innerHTML = `<div class="intel-template-name">${escapeHtml(name)}</div><div class="intel-template-for">${escapeHtml(useFor)}</div>`;
            formatTemplates.appendChild(div);
          });
        } else {
          const div = document.createElement("div");
          div.className = "intel-template-item";
          div.innerHTML = `<div class="intel-template-name">${escapeHtml(uiLabel("generalSlots"))}</div><div class="intel-template-for">${escapeHtml([uiLabel("event"), uiLabel("market"), uiLabel("announcement"), uiLabel("insight")].join(" / "))}</div>`;
          formatTemplates.appendChild(div);
        }
      }

      if (officialOverviewTitle && officialOverviewSummary && officialOverviewBullets) {
        officialOverviewTitle.textContent = String(officialOverview?.title || uiLabel("official"));
        officialOverviewSummary.textContent = String(officialOverview?.summary || uiLabel("noHighlights"));
        officialOverviewBullets.innerHTML = "";
        const rows = Array.isArray(officialOverview?.bullets) ? officialOverview.bullets.slice(0, 4) : [];
        if (!rows.length) {
          const li = document.createElement("li");
          li.textContent = uiLabel("noHighlights");
          officialOverviewBullets.appendChild(li);
        } else {
          rows.forEach((text) => {
            const li = document.createElement("li");
            li.textContent = String(text || "");
            officialOverviewBullets.appendChild(li);
          });
        }
      }

      const eventsByPublished = sortCardsByTimeDesc(routed.events || []);
      const timelineCards = [];
      const timelineSeen = new Set();
      eventsByPublished.forEach((card) => {
        const key = String(card?.id || card?.url || "");
        if (!key || timelineSeen.has(key)) return;
        timelineSeen.add(key);
        timelineCards.push(card);
      });
      const officialAgenda = routed.official.slice(0, 6).map((card) => ({
        label: uiLabel("official"),
        urgency: String(card?.card_type || "") === "announcement" ? "high" : "normal",
        headline: String(card?.title || ""),
        glance: String(card?.glance || card?.summary || ""),
        account: String(card?.account || ""),
        url: String(card?.url || ""),
        published_at: card?.published_at,
      }));
      const context = {
        token: ++intelLazyRenderToken,
        payload,
        cards,
        routed,
        alphaFutureCards,
        eventsByPublished,
        timelineCards,
        agenda,
        officialAgenda,
        elements: {
          officialList,
          eventsList,
          featuresList,
          communityList,
          growthList,
          recentList,
        },
      };
      resetIntelCategoryRenderQueue(context, getActiveIntelCategory());
      if (payload?._recovered_from_snapshot) {
        setIntelMessage(uiLabel("feedFailedUsingSnapshot"), "");
      }
    }

    async function fetchIntelFeed(langOverride = "", options = {}) {
      const requestLang = normalizeUiLang(langOverride || currentUiLang || document.documentElement.lang || "zh-Hant");
      const opts = options && typeof options === "object" ? options : {};
      const allowSnapshot = opts.allowSnapshot !== false;
      const canUseApi = window.location.protocol !== "file:";
      let apiError = null;
      if (canUseApi) {
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 12000);
          const cacheBust = opts.cacheBust ? `&_refresh=${encodeURIComponent(String(Date.now()))}` : "";
          const response = await fetch(intelApiUrl(`/api/intel/feed?lang=${encodeURIComponent(requestLang)}${cacheBust}`), {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          });
          window.clearTimeout(timeout);
          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload?.ok && typeof payload?.feed === "object") {
            if (!payload.feed.lang) {
              payload.feed.lang = requestLang;
            }
            if (isUsableIntelFeed(payload.feed)) {
              return payload.feed;
            }
            apiError = new Error("empty_or_invalid_feed");
          } else {
            apiError = new Error(payload?.error || `HTTP ${response.status}`);
          }
        } catch (error) {
          apiError = error instanceof Error ? error : new Error(String(error || "api_fetch_failed"));
        }
      }
      if (allowSnapshot) {
        const snapshot = readCachedIntelFeed(requestLang, false);
        if (snapshot) {
          return {
            ...snapshot,
            _recovered_from_snapshot: true,
            _recover_error: String(apiError?.message || "api_unavailable"),
          };
        }
      }
      if (apiError) throw apiError;
      throw new Error(`intel_api_unavailable:${requestLang}`);
    }

    async function refreshIntelFeedForCurrentLang(options = {}) {
      const payload = await fetchIntelFeed(currentUiLang, options);
      renderIntelFeed(payload);
      scheduleLangFeedRefresh(payload);
      return payload;
    }

    function prefetchIntelFeeds() {
      if (location.protocol === "file:" || intelFeedPrefetchStarted) return;
      intelFeedPrefetchStarted = true;
      const langs = INTEL_LANGS.filter((lang) => lang !== normalizeUiLang(currentUiLang));
      langs.forEach((lang, index) => {
        window.setTimeout(() => {
          scheduleIdleTask(() => {
            if (isUsableIntelFeed(intelFeedLangCache.get(lang))) return;
            fetchIntelFeed(lang, { allowSnapshot: false })
              .then((payload) => {
                const mode = String(payload?._i18n?.mode || "");
                if (isUsableIntelFeed(payload) && mode !== "building") {
                  intelFeedLangCache.set(lang, payload);
                  saveIntelFeedSnapshot(lang, payload);
                }
              })
              .catch(() => {});
          });
        }, 1400 + index * 5600);
      });
    }

    function scheduleIntelFeedPrefetchOnActivity() {
      if (location.protocol === "file:" || intelFeedPrefetchArmed || intelFeedPrefetchStarted) return;
      intelFeedPrefetchArmed = true;
      const events = ["scroll", "pointerdown", "keydown", "touchstart"];
      let timeoutId = 0;
      const cleanup = () => {
        events.forEach((name) => window.removeEventListener(name, start));
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = 0;
        }
      };
      const start = () => {
        cleanup();
        scheduleIdleTask(() => {
          prefetchIntelFeeds();
        });
      };
      events.forEach((name) => window.addEventListener(name, start, { once: true, passive: true }));
      timeoutId = window.setTimeout(() => {
        scheduleIdleTask(start);
      }, 18000);
    }

    async function attemptIntelAutoRepair(error) {
      try {
        const alreadyTried = sessionStorage.getItem(INTEL_AUTO_REPAIR_SESSION_KEY);
        if (alreadyTried) return false;
        await clearIntelAppState({ preserveLang: true, preserveApiBase: true, clearCacheStorage: false });
        sessionStorage.setItem(INTEL_AUTO_REPAIR_SESSION_KEY, new Date().toISOString());
        const payload = await fetchIntelFeed(currentUiLang, { cacheBust: true, allowSnapshot: false });
        renderIntelFeed(payload);
        scheduleLangFeedRefresh(payload);
        setIntelMessage(uiLabel("feedAutoRepaired"), "ok");
        scheduleIntelFeedPrefetchOnActivity();
        return true;
      } catch (_repairError) {
        setIntelMessage(`Intel feed failed: ${String(error?.message || error || "api_fetch_failed")}`, "error");
        return false;
      }
    }

    async function postIntel(path, body) {
      const response = await fetch(intelApiUrl(path), {
        method: "POST",
        credentials: "include",
        headers: buildIntelAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        if (response.status === 401) {
          handleIntelUnauthorized();
        }
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return data;
    }

    async function fetchIntelAdminStatus(limit = 10) {
      const safeLimit = Math.max(4, Math.min(Number(limit) || 10, 30));
      const response = await fetch(intelApiUrl(`/api/intel/admin-status?limit=${safeLimit}`), {
        method: "GET",
        credentials: "include",
        headers: buildIntelAuthHeaders(),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || typeof data?.status !== "object") {
        if (response.status === 401) {
          handleIntelUnauthorized();
        }
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return data.status;
    }

    async function triggerWebsiteBackup() {
      const data = await postIntel("/api/intel/backup", {});
      return data?.backup || {};
    }

    async function triggerWebsiteRestore(force = true) {
      const data = await postIntel("/api/intel/restore", { force: Boolean(force) });
      return data?.restore || {};
    }

    async function updateIntelXSource(action, account) {
      const data = await postIntel("/api/intel/source-config", {
        action: String(action || "").trim().toLowerCase(),
        account: String(account || "").trim(),
      });
      return data?.source || data;
    }

    function renderIntelXSourceManager(status) {
      const listEl = document.getElementById("intel-admin-x-source-list");
      const metaEl = document.getElementById("intel-admin-x-source-meta");
      if (!listEl && !metaEl) return;
      const monitor = status?.monitors || {};
      const xInfo = monitor?.x && typeof monitor.x === "object" ? monitor.x : {};
      const accounts = Array.isArray(xInfo?.accounts) ? xInfo.accounts.map((x) => String(x || "").trim()).filter(Boolean) : [];
      if (listEl) {
        if (!accounts.length) {
          listEl.textContent = "目前沒有追蹤 X 用戶。";
        } else {
          listEl.innerHTML = accounts.map((account) => `
            <span class="intel-source-pill">
              @${escapeHtml(account)}
              <button type="button" class="intel-source-remove" data-intel-source-remove="${escapeHtml(account)}" aria-label="取消追蹤 @${escapeHtml(account)}">×</button>
            </span>
          `).join("");
        }
      }
      if (metaEl) {
        const defaultText = xInfo?.using_default ? "目前使用預設追蹤清單" : "目前使用管理員自訂追蹤清單";
        const updated = toLocalTime(xInfo?.updated_at);
        const stats = xInfo?.source_stats && typeof xInfo.source_stats === "object" ? xInfo.source_stats : {};
        const countText = accounts.map((account) => `@${account}:${Number(stats?.[account] || 0)}`).join(" · ");
        metaEl.textContent = `${defaultText} · 共 ${accounts.length} 個來源 · 更新 ${updated}${countText ? ` · ${countText}` : ""}`;
      }
    }

    function renderIntelAdminList(el, rows, emptyText) {
      if (!el) return;
      const items = Array.isArray(rows) ? rows.filter(Boolean) : [];
      if (!items.length) {
        el.innerHTML = `<li>${escapeHtml(emptyText || "目前無資料")}</li>`;
        return;
      }
      el.innerHTML = items.map((line) => `<li>${escapeHtml(String(line || ""))}</li>`).join("");
    }

    function renderIntelAdminStatus(status) {
      intelAdminState.lastPayload = status && typeof status === "object" ? status : null;
      const sync = status?.sync || {};
      const jobs = status?.jobs || {};
      const newPosts = status?.new_posts || {};
      const news = status?.news || {};
      const memory = status?.memory || {};
      const monitor = status?.monitors || {};
      const xMonitor = monitor?.x || {};
      const discord = monitor?.discord || {};
      const i18n = status?.i18n || {};
      const storage = status?.storage || {};
      const backup = status?.backup || {};
      const backupRuntime = backup?.runtime || {};
      const updatedAtEl = document.getElementById("intel-admin-updated-at");
      const syncStatusEl = document.getElementById("intel-admin-sync-status");
      const syncMetaEl = document.getElementById("intel-admin-sync-meta");
      const newPostsEl = document.getElementById("intel-admin-new-posts");
      const newMetaEl = document.getElementById("intel-admin-new-meta");
      const jobsEl = document.getElementById("intel-admin-jobs");
      const jobsMetaEl = document.getElementById("intel-admin-jobs-meta");
      const newsEl = document.getElementById("intel-admin-news");
      const newsMetaEl = document.getElementById("intel-admin-news-meta");
      const i18nEl = document.getElementById("intel-admin-i18n");
      const i18nMetaEl = document.getElementById("intel-admin-i18n-meta");
      const storageEl = document.getElementById("intel-admin-storage");
      const storageMetaEl = document.getElementById("intel-admin-storage-meta");
      const dataRepoEl = document.getElementById("intel-admin-data-repo");
      const dataRepoMetaEl = document.getElementById("intel-admin-data-repo-meta");
      const backupEl = document.getElementById("intel-admin-backup");
      const backupMetaEl = document.getElementById("intel-admin-backup-meta");
      const jobListEl = document.getElementById("intel-admin-job-list");
      const backupListEl = document.getElementById("intel-admin-backup-list");
      const monitorListEl = document.getElementById("intel-admin-monitor-list");

      if (updatedAtEl) {
        updatedAtEl.textContent = `最後更新：${toLocalTime(status?.server_time)}`;
      }
      if (syncStatusEl) {
        const statusTextMap = {
          idle: "待命中",
          running: "同步中",
          ok: "同步完成",
          failed: "同步失敗",
        };
        syncStatusEl.textContent = statusTextMap[String(sync?.status || "").toLowerCase()] || String(sync?.status || "--");
      }
      if (syncMetaEl) {
        const nextSync = toLocalTime(sync?.next_run_at);
        const interval = Number(sync?.schedule_interval_hours || 0);
        const scheduleText = sync?.schedule_enabled
          ? ` · 自動每 ${interval || 0.5}h · 下次 ${nextSync}`
          : " · 自動同步未啟用";
        const total = Number(sync?.total_cards || 0);
        const sourceTotal = Number(sync?.source_total_cards || sync?.raw_total_cards || total);
        const rawTotal = Number(sync?.raw_total_cards || sourceTotal || total);
        const removedSelection = Number(sync?.excluded_by_selection || 0);
        const removedFeedback = Number(sync?.excluded_by_feedback || 0);
        const removedSourcePref = Number(sync?.excluded_by_source_preference || 0);
        const removedAi = Number(sync?.dedupe_ai_removed || 0);
        const removedLocal = Number(sync?.dedupe_local_removed || 0);
        syncMetaEl.textContent = `上牆 ${total} / 可用 ${sourceTotal} / 原始 ${rawTotal} · 過濾 手動${removedSelection} 回饋${removedFeedback} 來源去重${removedSourcePref} AI去重${removedAi} 本地去重${removedLocal} · 最近來源 ${toLocalTime(sync?.latest_source_at)}${scheduleText}`;
      }
      if (newPostsEl) {
        const v24 = Number(newPosts?.new_cards_24h || 0);
        const v6 = Number(newPosts?.new_cards_6h || 0);
        newPostsEl.textContent = `24h 新貼文 ${v24}（6h ${v6}）`;
      }
      if (newMetaEl) {
        const pending = Number(newPosts?.pending_processing || 0);
        const flag = Boolean(newPosts?.is_processing);
        const syncRunning = Boolean(newPosts?.sync_running);
        const queuedJobs = Number(newPosts?.queued_jobs || 0);
        const runningJobs = Number(newPosts?.running_jobs || 0);
        newMetaEl.textContent = flag
          ? `背景整理進行中，待處理 ${pending} 件（同步 ${syncRunning ? "1" : "0"} · 任務 跑中 ${runningJobs} / 排隊 ${queuedJobs}）`
          : "目前沒有待處理整理任務";
      }
      if (jobsEl) {
        const counts = jobs?.counts || {};
        jobsEl.textContent = `跑中 ${Number(counts?.running || 0)} / 排隊 ${Number(counts?.queued || 0)}`;
      }
      if (jobsMetaEl) {
        const counts = jobs?.counts || {};
        jobsMetaEl.textContent = `完成 ${Number(counts?.done || 0)} · 失敗 ${Number(counts?.failed || 0)} · 總數 ${Number(jobs?.total || 0)}`;
      }
      if (newsEl) {
        const langs = Array.isArray(news?.langs) ? news.langs : [];
        const running = langs.filter((x) => Boolean(x?.refreshing)).length;
        newsEl.textContent = running > 0 ? `刷新中 ${running} 語言` : `已快取 ${langs.length} 語言`;
      }
      if (newsMetaEl) {
        const langs = Array.isArray(news?.langs) ? news.langs : [];
        const nexts = langs
          .map((x) => toLocalTime(x?.next_refresh_at))
          .filter((x) => x && x !== "--");
        const providerList = [...new Set(langs.map((x) => String(x?.provider || "").trim()).filter(Boolean))];
        const providerText = providerList.length ? ` · provider ${providerList.join(",")}` : "";
        newsMetaEl.textContent = nexts.length ? `下次刷新：${nexts[0]}${providerText}` : `尚未排定下一次刷新${providerText}`;
      }
      const i18nProgress = i18n?.lang_progress && typeof i18n.lang_progress === "object" ? i18n.lang_progress : {};
      if (i18nEl) {
        const i18nStatus = String(i18n?.status || "idle").toLowerCase();
        const publishedLangs = Array.isArray(i18n?.langs) ? i18n.langs.filter(Boolean) : [];
        if (i18nStatus === "running" || i18nStatus === "queued") {
          i18nEl.textContent = `翻譯進行中 · 已發布 ${publishedLangs.length} 語言`;
        } else if (i18nStatus === "ok") {
          i18nEl.textContent = `翻譯完成 · 已發布 ${publishedLangs.length} 語言`;
        } else if (i18nStatus === "failed") {
          i18nEl.textContent = `翻譯異常 · 已發布 ${publishedLangs.length} 語言`;
        } else {
          i18nEl.textContent = `仍有未翻譯內容 · 已發布 ${publishedLangs.length} 語言`;
        }
      }
      if (i18nMetaEl) {
        const publishedLangs = Array.isArray(i18n?.langs) ? i18n.langs.filter(Boolean) : [];
        const tags = ["zh-Hant", "zh-Hans", "en", "ko"];
        const details = tags.map((tag) => {
          const row = i18nProgress[tag] || {};
          const done = Number(row?.done || 0);
          const total = Number(row?.total || 0);
          const rawStatus = String(row?.status || "pending").toLowerCase();
          const cacheHits = Number(row?.cached_hits || 0);
          const pendingCount = Number(row?.pending_count || Math.max(0, total - done));
          const translated = total > 0 ? done >= total : rawStatus === "ok";
          const stateLabel = translated ? "已翻譯" : "未翻譯";
          return `${tag}:${stateLabel} (${done}/${total}) cache${cacheHits} pending${pendingCount}`;
        });
        i18nMetaEl.textContent = `已發布：${publishedLangs.length ? publishedLangs.join(", ") : "--"} · ${details.join(" · ")}`;
      }
      if (storageEl) {
        storageEl.textContent = storage?.using_symlink ? "使用掛載資料夾" : "使用本地資料夾";
      }
      if (storageMetaEl) {
        const root = String(storage?.website_data_root || "--");
        const migrated = storage?.migrated ? "已初次搬移" : "未搬移/不需搬移";
        storageMetaEl.textContent = `${root} · ${migrated}`;
      }
      const restore = storage?.restore || {};
      if (dataRepoEl) {
        const runtimeStatus = String(restore?.status || "").trim().toLowerCase();
        const reason = String(restore?.reason || "").trim();
        const ok = restore?.ok !== false;
        const restored = Boolean(restore?.restored);
        const repoReady = Boolean(backup?.has_repo);
        if (!repoReady) dataRepoEl.textContent = "Repo 未設定";
        else if (runtimeStatus === "running") dataRepoEl.textContent = "從 Repo 還原中";
        else if (!ok) dataRepoEl.textContent = "連線/還原失敗";
        else if (restored) dataRepoEl.textContent = "已從 Repo 還原";
        else if (reason === "manual_only") dataRepoEl.textContent = "等待手動還原";
        else if (reason === "data_root_not_empty") dataRepoEl.textContent = "Repo 已設定，資料已存在";
        else if (reason === "disabled") dataRepoEl.textContent = "啟動還原未啟用";
        else dataRepoEl.textContent = "Repo 已設定";
      }
      if (dataRepoMetaEl) {
        const reason = String(restore?.reason || "--").trim() || "--";
        const subdir = String(restore?.subdir || backup?.subdir || "--");
        const branch = String(restore?.branch || backup?.branch || "--");
        const error = String(restore?.error || "").trim();
        const status = String(restore?.status || "idle").trim() || "idle";
        const trigger = String(restore?.trigger || "--").trim() || "--";
        const force = restore?.force ? "yes" : "no";
        const doneAt = toLocalTime(restore?.finished_at || restore?.last_success_at);
        dataRepoMetaEl.textContent = `status=${status} · restore=${reason} · trigger=${trigger} · force=${force} · branch=${branch} · subdir=${subdir} · finished ${doneAt}${error ? ` · ${error}` : ""}`;
      }
      if (backupEl) {
        const runtimeStatus = String(backupRuntime?.status || "").trim();
        const enabled = Boolean(backup?.enabled);
        const labelMap = {
          idle: enabled ? "待命" : "未啟用",
          running: "上傳中",
          ok: "上次成功",
          failed: "上次失敗",
          skipped: "已略過",
        };
        backupEl.textContent = labelMap[runtimeStatus] || (enabled ? "已啟用" : "未啟用");
      }
      if (backupMetaEl) {
        const repoText = backup?.has_repo ? "repo 已設定" : "repo 未設定";
        const patText = backup?.has_pat ? "PAT 已設定" : "PAT 未設定";
        const last = toLocalTime(backupRuntime?.last_success_at || backupRuntime?.finished_at);
        const error = String(backupRuntime?.last_error || "").trim();
        backupMetaEl.textContent = `${repoText} · ${patText} · last ${last}${error ? ` · ${error}` : ""}`;
      }

      const jobRowsRaw = Array.isArray(jobs?.items) ? jobs.items : [];
      const jobRows = jobRowsRaw.slice(0, 8).map((job) => {
        const st = String(job?.status || "--").toUpperCase();
        const msg = String(job?.message || "").trim() || String(job?.url || "").trim() || "無訊息";
        const updated = toLocalTime(job?.updated_at || job?.created_at);
        return `[${st}] ${msg} · ${updated}`;
      });
      renderIntelAdminList(jobListEl, jobRows, "目前沒有背景整理任務");

      const backupRows = [];
      backupRows.push(`Data root：${String(storage?.website_data_root || backup?.data_root || "--")}`);
      backupRows.push(`Frontend data link：${String(storage?.data_dir || "--")} · symlink=${storage?.using_symlink ? "yes" : "no"}`);
      backupRows.push(`Restore：status=${String(restore?.status || "idle")} · ok=${restore?.ok === false ? "no" : "yes"} · restored=${restore?.restored ? "yes" : "no"} · reason=${String(restore?.reason || "--")} · trigger=${String(restore?.trigger || "--")} · force=${restore?.force ? "yes" : "no"} · branch=${String(restore?.branch || backup?.branch || "--")} · subdir=${String(restore?.subdir || backup?.subdir || "--")}`);
      if (String(restore?.error || "").trim()) backupRows.push(`Restore error：${String(restore.error)}`);
      backupRows.push(`Backup：enabled=${backup?.enabled ? "yes" : "no"} · provider=${String(backup?.provider || "--")} · branch=${String(backup?.branch || "--")} · subdir=${String(backup?.subdir || "--")}`);
      backupRows.push(`Repo：${backup?.has_repo ? "configured" : "missing"} · PAT：${backup?.has_pat ? "configured" : "missing"} · repo_dir=${String(backup?.repo_dir || "--")}`);
      backupRows.push(`Schedule：${String(backup?.timezone || "Asia/Taipei")} ${String(backup?.hour ?? "--").padStart(2, "0")}:${String(backup?.minute ?? "--").padStart(2, "0")} · startup=${backup?.run_on_startup ? "yes" : "no"}`);
      backupRows.push(`Runtime：${String(backupRuntime?.status || "idle")} · changed=${backupRuntime?.changed ? "yes" : "no"} · skipped=${backupRuntime?.skipped ? "yes" : "no"} · duration=${Number(backupRuntime?.duration_ms || 0)}ms`);
      if (String(backupRuntime?.last_error || "").trim()) backupRows.push(`Last error：${String(backupRuntime.last_error)}`);
      if (!backup?.enabled) backupRows.push("Next step：設定 WEBSITE_BACKUP_ENABLED=1 才會啟動排程。");
      if (!backup?.has_repo) backupRows.push("Next step：設定 WEBSITE_BACKUP_REPO 到 private backup repo。");
      if (!backup?.has_pat) backupRows.push("Next step：設定 WEBSITE_BACKUP_PAT，權限只需要 Contents read/write。");
      renderIntelAdminList(backupListEl, backupRows, "目前沒有備份狀態資料");
      renderIntelXSourceManager(status);

      const monitorRows = [];
      const syncNext = toLocalTime(sync?.next_run_at);
      monitorRows.push(
        `X/Twitter sync：${String(sync?.status || "idle")} · interval ${Number(sync?.schedule_interval_hours || 0.5)}h · window ${Number(sync?.schedule_window_days || 30)}d · next ${syncNext}`
      );
      const xAccounts = Array.isArray(xMonitor?.accounts) ? xMonitor.accounts : [];
      monitorRows.push(
        `X tracked users：${xAccounts.length ? xAccounts.map((x) => `@${String(x)}`).join(", ") : "none"}`
      );
      monitorRows.push(
        `Discord monitor：${discord?.enabled ? "on" : "off"} · channel ${Array.isArray(discord?.channel_ids) ? discord.channel_ids.length : 0} · cards ${Number(discord?.cards_total || 0)}`
      );
      const discordErrors = Array.isArray(discord?.errors) ? discord.errors : [];
      if (discordErrors.length) {
        monitorRows.push(`Discord 最近錯誤：${String(discordErrors[0] || "")}`);
      }
      const langRows = Array.isArray(news?.langs) ? news.langs : [];
      langRows.forEach((row) => {
        const tag = String(row?.lang || "--");
        const st = row?.refreshing ? "refreshing" : "idle";
        const last = toLocalTime(row?.last_refresh_at);
        const provider = String(row?.provider || "").trim() || "provider unknown";
        const lastError = String(row?.last_error || "").trim();
        monitorRows.push(`News[${tag}] ${st} · ${provider} · last ${last}${lastError ? ` · error ${lastError}` : ""}`);
      });
      monitorRows.push(`Memory rules · defaults ${Number(memory?.default_rules || 0)} · learned ${Number(memory?.rules || 0)} · feedback ${Number(memory?.feedback_items || 0)} · sources ${Number(memory?.source_profiles || 0)}`);
      const i18nStatus = String(i18n?.status || "idle");
      const i18nLangs = Array.isArray(i18n?.langs) && i18n.langs.length ? i18n.langs.join(",") : "--";
      const i18nFinishedAt = toLocalTime(i18n?.finished_at);
      monitorRows.push(`I18N feed ${i18nStatus} · langs ${i18nLangs} · finished ${i18nFinishedAt}`);
      ["zh-Hant", "zh-Hans", "en", "ko"].forEach((tag) => {
        const row = i18nProgress[tag] || {};
        const status = String(row?.status || "pending").toLowerCase();
        const done = Number(row?.done || 0);
        const total = Number(row?.total || 0);
        const remaining = Number(row?.remaining || Math.max(0, total - done));
        const translated = total > 0 ? done >= total : status === "ok";
        monitorRows.push(`I18N[${tag}] ${translated ? "已翻譯" : "未翻譯"} · ${done}/${total} · 剩餘 ${remaining}`);
      });
      renderIntelAdminList(monitorListEl, monitorRows, "目前沒有 monitor 狀態資料");
      applyUiLanguage().catch(() => {});
    }

    function stopIntelAdminPolling() {
      if (intelAdminState.pollTimer) {
        window.clearInterval(intelAdminState.pollTimer);
        intelAdminState.pollTimer = null;
      }
    }

    async function refreshIntelAdminStatus() {
      if (intelAdminState.fetching) return;
      intelAdminState.fetching = true;
      try {
        const status = await fetchIntelAdminStatus(12);
        renderIntelAdminStatus(status);
      } catch (error) {
        const updatedAtEl = document.getElementById("intel-admin-updated-at");
        if (updatedAtEl) updatedAtEl.textContent = `監控狀態讀取失敗：${String(error?.message || error)}`;
      } finally {
        intelAdminState.fetching = false;
      }
    }

    function startIntelAdminPolling() {
      if (intelAdminState.pollTimer) return;
      refreshIntelAdminStatus();
      intelAdminState.pollTimer = window.setInterval(() => {
        refreshIntelAdminStatus();
      }, 8000);
    }

    function renderPokemonNews(payload) {
      const listEl = document.getElementById("pokemon-news-list");
      const metaEl = document.getElementById("pokemon-news-meta");
      if (!listEl || !metaEl) return;
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      pokemonNewsItemsState = rows.slice(0, 8);
      if (!rows.length) {
        listEl.innerHTML = `<article class="pokemon-news-card"><p class="pokemon-news-summary">${escapeHtml(uiLabel("noPokemonNews"))}</p></article>`;
      } else {
        listEl.innerHTML = rows.slice(0, 8).map((item, index) => {
          const title = String(item?.summary_title || item?.title || item?.url || uiLabel("unnamedPost"));
          const url = String(item?.url || "");
          const source = String(item?.source || "").trim() || "unknown";
          const dateText = String(item?.date || "").trim();
          const summary = String(item?.summary || item?.snippet || "").trim();
          const points = Array.isArray(item?.key_points) ? item.key_points.filter((x) => String(x || "").trim()).slice(0, 3) : [];
          const cardPoints = points.slice(0, 2);
          const pointHtml = points.length
            ? `<ul class="pokemon-news-points">${cardPoints.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
            : "";
          const titleHtml = url.startsWith("http")
            ? `<a class="pokemon-news-title" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
            : `<div class="pokemon-news-title">${escapeHtml(title)}</div>`;
          const linkHtml = url.startsWith("http")
            ? `<a class="pokemon-news-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(uiLabel("sourceOriginal"))}</a>`
            : "";
          return `
            <article class="pokemon-news-card" data-pokemon-news-index="${index}">
              <div class="pokemon-news-top">
                <span class="pokemon-news-source">${escapeHtml(source)}</span>
                <span class="pokemon-news-date">${escapeHtml(dateText || "--")}</span>
              </div>
              ${titleHtml}
              ${summary ? `<p class="pokemon-news-summary">${escapeHtml(summary)}</p>` : ""}
              ${pointHtml}
              <p class="pokemon-news-summary">${escapeHtml(uiLabel("clickCardFull"))}</p>
              ${linkHtml}
            </article>
          `;
        }).join("");
      }
      const generatedAt = toLocalTime(payload?.generated_at);
      const lang = String(payload?.lang || document.documentElement.lang || "zh-Hant").trim();
      const mode = String(payload?.summary_mode || "ai").trim();
      const modeLabel = mode.startsWith("ai") ? uiLabel("aiOrganized") : uiLabel("basicOrganized");
      const providerRaw = String(payload?.provider || "minimax_cli_search").trim();
      const providerLabel = providerRaw === "minimax_mcp_web_search"
        ? "MiniMax MCP web_search"
        : (providerRaw === "minimax_cli_search" || providerRaw === "mmx" ? "MiniMax CLI Search" : providerRaw);
      const cachedLabel = payload?.cached ? ` · ${uiLabel("cached")}` : ` · ${uiLabel("realtime")}`;
      const refreshing = Boolean(payload?.refreshing);
      const refreshingLabel = refreshing ? ` · ${uiLabel("backgroundUpdating")}` : "";
      const nextRefreshAt = toLocalTime(payload?.next_refresh_at);
      const nextLabel = nextRefreshAt && nextRefreshAt !== "--" ? ` · ${uiLabel("nextRefresh")} ${nextRefreshAt}` : "";
      const warning = String(payload?.warning || "").trim();
      const pendingMsg = String(payload?.message || "").trim();
      metaEl.textContent = warning
        ? `${uiLabel("source")}: ${providerLabel} · ${modeLabel} · ${uiLabel("language")} ${lang} · ${uiLabel("updated")} ${generatedAt}${cachedLabel}${refreshingLabel}${nextLabel} · ${warning}`
        : `${uiLabel("source")}: ${providerLabel} · ${modeLabel} · ${uiLabel("language")} ${lang} · ${uiLabel("updated")} ${generatedAt}${cachedLabel}${refreshingLabel}${nextLabel}${pendingMsg ? ` · ${pendingMsg}` : ""}`;
      markLocalizedDynamicRegions();
      applyUiLanguage().catch(() => {});
    }

    async function refreshPokemonNews(force = false) {
      const metaEl = document.getElementById("pokemon-news-meta");
      if (metaEl) {
        metaEl.textContent = force
          ? uiLabel("updatingNews")
          : uiLabel("loadingNews");
      }
      const currentLang = String(document.documentElement.lang || navigator.language || "zh-Hant");
      const data = await postIntel("/api/intel/pokemon-news", {
        force: Boolean(force),
        max_items: 8,
        lang: currentLang,
      });
      const news = data?.news || {};
      renderPokemonNews(news);
      if (pokemonNewsPollTimer) {
        window.clearTimeout(pokemonNewsPollTimer);
        pokemonNewsPollTimer = null;
      }
      if (Boolean(news?.refreshing)) {
        pokemonNewsPollTimer = window.setTimeout(() => {
          refreshPokemonNews(false).catch(() => {});
        }, 3200);
      }
    }

    function maybeRefreshPokemonNewsForCategory(category) {
      if (normalizeIntelCategoryName(category) !== "pokemon") return;
      if (location.protocol === "file:" || pokemonNewsAutoRequested) return;
      pokemonNewsAutoRequested = true;
      refreshPokemonNews(false).catch((error) => {
        const metaEl = document.getElementById("pokemon-news-meta");
        if (metaEl) metaEl.textContent = `${uiLabel("source")}: MiniMax NewsAgent · ${String(error?.message || error)}`;
      });
    }

    function saveAnalyzeJobId(jobId) {
      try {
        if (!jobId) localStorage.removeItem(INTEL_ANALYZE_JOB_KEY);
        else localStorage.setItem(INTEL_ANALYZE_JOB_KEY, String(jobId));
      } catch (_error) {
      }
    }

    function loadAnalyzeJobId() {
      try {
        return String(localStorage.getItem(INTEL_ANALYZE_JOB_KEY) || "").trim();
      } catch (_error) {
        return "";
      }
    }

    function stopAnalyzePolling(clearSaved = false) {
      if (intelAnalyzeState.pollTimer) {
        window.clearInterval(intelAnalyzeState.pollTimer);
        intelAnalyzeState.pollTimer = null;
      }
      if (clearSaved) {
        intelAnalyzeState.jobId = "";
        saveAnalyzeJobId("");
      }
    }

    async function pollAnalyzeJobOnce(jobId) {
      const current = String(jobId || "").trim();
      if (!current) return;
      try {
        const data = await postIntel("/api/intel/job-status", { id: current });
        const job = data?.job || {};
        const status = String(job?.status || "").trim().toLowerCase();
        if (status === "done") {
          stopAnalyzePolling(true);
          await refreshIntelFeedForCurrentLang();
          setIntelMessage("背景分析完成，已加入網站卡片。可直接刷新頁面。", "ok");
          return;
        }
        if (status === "failed") {
          stopAnalyzePolling(true);
          setIntelMessage(String(job?.message || "背景分析失敗。"), "error");
          return;
        }
        const msg = String(job?.message || "背景分析進行中，可直接刷新頁面，完成後會自動更新。");
        setIntelMessage(`${msg}（工作 ${current}）`, "");
      } catch (error) {
        const msg = String(error?.message || "");
        if (/job not found|HTTP 404/i.test(msg)) {
          stopAnalyzePolling(true);
          return;
        }
        setIntelMessage(`背景分析工作 ${current} 追蹤中，可刷新頁面；稍後會自動完成。`, "");
      }
    }

    function startAnalyzePolling(jobId) {
      const current = String(jobId || "").trim();
      if (!current) return;
      stopAnalyzePolling(false);
      intelAnalyzeState.jobId = current;
      saveAnalyzeJobId(current);
      pollAnalyzeJobOnce(current);
      intelAnalyzeState.pollTimer = window.setInterval(() => {
        pollAnalyzeJobOnce(current);
      }, 2500);
    }

    async function submitIntelPick(id, action, reason = "") {
      await postIntel("/api/intel/pick", { id, action, reason });
      await refreshIntelFeedForCurrentLang();
    }

    async function submitIntelFeedback(id, defaultLabel = "insight") {
      const card = intelCardLookup.get(String(id || "").trim()) || {};
      const result = await openIntelFeedbackModal({ mode: "feedback", defaultLabel, card });
      if (!result) return false;
      const cardType = String(result.cardType || "").trim().toLowerCase();
      const topicLabels = normalizeTopicLabels(result.topicLabels || []);
      const reason = String(result.reason || "").trim();
      const labels = [];
      if (cardType) labels.push(cardType);
      topicLabels.forEach((label) => labels.push(label));
      if (!labels.length) {
        setIntelMessage("請至少選擇一個分類（卡片類型或分區）。", "error");
        return false;
      }
      const uniqueLabels = Array.from(new Set(labels));
      for (const label of uniqueLabels) {
        if (!intelFeedbackLabels.has(label)) {
          setIntelMessage("分類無效，請改用系統提供的卡片類型/分區。", "error");
          return false;
        }
      }
      if (!topicLabels.length) {
        setIntelMessage("分區至少要保留一個；若不屬於任何分區請選「無」。", "error");
        return false;
      }
      await postIntel("/api/intel/feedback", { id, card_type: cardType, topic_labels: topicLabels, reason });
      await refreshIntelFeedForCurrentLang();
      return true;
    }

    async function submitIntelTimelineUpdate(id, timelineDate = "", timelineEndDate = "") {
      await postIntel("/api/intel/timeline", {
        id,
        timeline_date: String(timelineDate || "").trim(),
        timeline_end_date: String(timelineEndDate || "").trim(),
      });
      await refreshIntelFeedForCurrentLang();
    }

    async function submitIntelSbtUpdate(id, sbtNames = "", sbtAcquisition = "") {
      await postIntel("/api/intel/sbt-fields", {
        id,
        sbt_names: String(sbtNames || "").trim(),
        sbt_acquisition: String(sbtAcquisition || "").trim(),
      });
      await refreshIntelFeedForCurrentLang();
    }

    async function submitIntelEventWallUpdate(id, eventWall) {
      await postIntel("/api/intel/event-wall", {
        id,
        event_wall: Boolean(eventWall),
      });
      await refreshIntelFeedForCurrentLang();
    }

    async function handleIntelAction(action, id, hintLabel = "", extra = {}) {
      if (!id || !action) return false;
      if (!intelCanEdit()) {
        setIntelMessage("請先登入管理員帳號，再執行保留/排除/分類操作。", "error");
        openIntelAuthModal();
        return false;
      }
      if (action === "include") {
        const yes = window.confirm(
          "確定要保留這篇貼文嗎？這篇會優先保留在整理結果中。",
        );
        if (!yes) return false;
        setIntelMessage("已加入手動保留，重新整理中...", "");
        await submitIntelPick(id, action);
        setIntelMessage("已手動保留這篇貼文。", "ok");
        return true;
      }
      if (action === "exclude") {
        const result = await openIntelFeedbackModal({ mode: "exclude", defaultLabel: "exclude" });
        if (!result) return false;
        const reason = String(result.reason || "").trim();
        setIntelMessage(reason ? "已加入排除，正在寫入 AI 回饋記憶並重新整理..." : "已加入排除，正在重新整理...", "");
        await submitIntelPick(id, action, reason);
        setIntelMessage(reason ? "已排除這篇貼文，原因已寫入 AI 回饋記憶。" : "已排除這篇貼文。", "ok");
        return true;
      }
      if (action === "pin" || action === "unpin" || action === "bottom" || action === "unbottom") {
        const actionTextMap = {
          pin: "頂選",
          unpin: "取消頂選",
          bottom: "置底",
          unbottom: "取消置底",
        };
        const confirmTextMap = {
          pin: "確定要頂選這篇嗎？頂選後可跨越兩週時間窗，但不會改變原本分類。",
          unpin: "確定要取消頂選嗎？取消後會回到一般兩週視窗規則。",
          bottom: "確定要把這篇置底嗎？置底後會排序到該分類最下面。",
          unbottom: "確定要取消置底嗎？取消後會回到一般排序。",
        };
        const okTextMap = {
          pin: "已頂選這篇貼文。",
          unpin: "已取消頂選。",
          bottom: "已將這篇設為置底。",
          unbottom: "已取消置底。",
        };
        if (!window.confirm(confirmTextMap[action] || "確定要更新排序設定嗎？")) return false;
        setIntelMessage(`正在${actionTextMap[action] || "更新"}設定...`, "");
        await submitIntelPick(id, action);
        setIntelMessage(okTextMap[action] || "設定已更新。", "ok");
        return true;
      }
      if (action === "feedback") {
        setIntelMessage("正在套用分類回饋...", "");
        const ok = await submitIntelFeedback(id, hintLabel);
        if (ok) setIntelMessage("已套用分類回饋，並重新同步。", "ok");
        return ok;
      }
      if (action === "timeline-save") {
        const timelineDate = String(extra?.timeline_date || "").trim();
        const timelineEndDate = String(extra?.timeline_end_date || "").trim();
        if (timelineDate && timelineEndDate && timelineEndDate < timelineDate) {
          setIntelMessage("結束日期不得早於開始日期。", "error");
          return false;
        }
        setIntelMessage("正在更新卡片日期...", "");
        await submitIntelTimelineUpdate(id, timelineDate, timelineEndDate);
        setIntelMessage("卡片日期已更新。", "ok");
        return true;
      }
      if (action === "eventwall-true") {
        setIntelMessage("正在加入活動主時間軸...", "");
        await submitIntelEventWallUpdate(id, true);
        setIntelMessage("已加入活動主時間軸。", "ok");
        return true;
      }
      if (action === "eventwall-false") {
        if (!window.confirm("確定要把這張卡移出活動主時間軸嗎？")) return false;
        setIntelMessage("正在移出活動主時間軸...", "");
        await submitIntelEventWallUpdate(id, false);
        setIntelMessage("已移出活動主時間軸。", "ok");
        return true;
      }
      if (action === "sbt-save") {
        const sbtNames = String(extra?.sbt_names || "").trim();
        const sbtAcquisition = String(extra?.sbt_acquisition || "").trim();
        const shouldClear = !sbtNames && !sbtAcquisition;
        if (shouldClear) {
          const yes = window.confirm("你要清空這張卡的 SBT 名稱與取得方式嗎？");
          if (!yes) return false;
        }
        setIntelMessage("正在更新 SBT 欄位...", "");
        await submitIntelSbtUpdate(id, sbtNames, sbtAcquisition);
        setIntelMessage("SBT 欄位已更新。", "ok");
        return true;
      }
      return false;
    }

    document.addEventListener("click", async (event) => {
      const editToggle = event.target?.closest?.("[data-sbt-edit-toggle]");
      if (editToggle) {
        sbtAcqEditMode = !sbtAcqEditMode;
        if (intelFeedCache && typeof intelFeedCache === "object") {
          renderIntelFeed(intelFeedCache);
        }
        return;
      }
      const editOpen = event.target?.closest?.("[data-sbt-edit-open]");
      if (editOpen) {
        const rowKey = String(editOpen.getAttribute("data-sbt-edit-open") || "").trim();
        if (!rowKey) return;
        const host = editOpen.closest("[data-sbt-row]");
        const editor = host?.querySelector?.(`[data-sbt-editor="${rowKey.replace(/"/g, '\\"')}"]`) || host?.querySelector?.("[data-sbt-editor]");
        if (editor) editor.hidden = false;
        return;
      }
      const editCancel = event.target?.closest?.("[data-sbt-edit-cancel]");
      if (editCancel) {
        const rowKey = String(editCancel.getAttribute("data-sbt-edit-cancel") || "").trim();
        if (!rowKey) return;
        const host = editCancel.closest("[data-sbt-row]");
        const editor = host?.querySelector?.(`[data-sbt-editor="${rowKey.replace(/"/g, '\\"')}"]`) || host?.querySelector?.("[data-sbt-editor]");
        if (editor) editor.hidden = true;
        return;
      }
      const editSave = event.target?.closest?.("[data-sbt-edit-save]");
      if (editSave) {
        if (!intelCanEdit()) {
          setIntelMessage("請先登入管理員帳號。", "error");
          openIntelAuthModal();
          return;
        }
        const cardId = String(editSave.getAttribute("data-sbt-edit-save") || "").trim();
        if (!cardId) {
          setIntelMessage("找不到卡片 ID。", "error");
          return;
        }
        const host = editSave.closest("[data-sbt-editor]");
        const nameEl = host?.querySelector?.("[data-sbt-edit-name]");
        const acqEl = host?.querySelector?.("[data-sbt-edit-acq]");
        const startEl = host?.querySelector?.("[data-sbt-edit-start]");
        const endEl = host?.querySelector?.("[data-sbt-edit-end]");
        const sbtNames = String(nameEl?.value || "").trim();
        const sbtAcquisition = String(acqEl?.value || "").trim();
        const timelineDate = String(startEl?.value || "").trim();
        const timelineEndDate = String(endEl?.value || "").trim();
        if (timelineDate && timelineEndDate && timelineEndDate < timelineDate) {
          setIntelMessage("結束日期不得早於開始日期。", "error");
          return;
        }
        editSave.disabled = true;
        try {
          setIntelMessage("正在更新 SBT 欄位...", "");
          await submitIntelSbtUpdate(cardId, sbtNames, sbtAcquisition);
          await submitIntelTimelineUpdate(cardId, timelineDate, timelineEndDate);
          setIntelMessage("SBT 欄位已更新。", "ok");
        } catch (error) {
          setIntelMessage(`更新失敗：${error.message}`, "error");
        } finally {
          editSave.disabled = false;
        }
        return;
      }
      const addSave = event.target?.closest?.("[data-sbt-add-save]");
      if (addSave) {
        if (!intelCanEdit()) {
          setIntelMessage("請先登入管理員帳號。", "error");
          openIntelAuthModal();
          return;
        }
        const box = addSave.closest("[data-sbt-add-box]");
        const selectEl = box?.querySelector?.("[data-sbt-add-card]");
        const nameEl = box?.querySelector?.("[data-sbt-add-name]");
        const acqEl = box?.querySelector?.("[data-sbt-add-acq]");
        const startEl = box?.querySelector?.("[data-sbt-add-start]");
        const endEl = box?.querySelector?.("[data-sbt-add-end]");
        const cardId = String(selectEl?.value || "").trim();
        const sbtNames = String(nameEl?.value || "").trim();
        const sbtAcquisition = String(acqEl?.value || "").trim();
        const timelineDate = String(startEl?.value || "").trim();
        const timelineEndDate = String(endEl?.value || "").trim();
        if (!cardId) {
          setIntelMessage("請先選擇要連接的卡片。", "error");
          return;
        }
        if (!sbtNames && !sbtAcquisition) {
          setIntelMessage("請至少填入 SBT Name 或 取得方式。", "error");
          return;
        }
        if (timelineDate && timelineEndDate && timelineEndDate < timelineDate) {
          setIntelMessage("結束日期不得早於開始日期。", "error");
          return;
        }
        addSave.disabled = true;
        try {
          setIntelMessage("正在新增 SBT 取得方式...", "");
          await submitIntelSbtUpdate(cardId, sbtNames, sbtAcquisition);
          await submitIntelTimelineUpdate(cardId, timelineDate, timelineEndDate);
          setIntelMessage("已注入對應卡片。", "ok");
        } catch (error) {
          setIntelMessage(`新增失敗：${error.message}`, "error");
        } finally {
          addSave.disabled = false;
        }
        return;
      }
      const trigger = event.target?.closest?.("[data-sbt-jump-card]");
      if (!trigger) return;
      const key = String(trigger.getAttribute("data-sbt-jump-card") || "").trim();
      if (!key) return;
      const escaped = (window.CSS && typeof window.CSS.escape === "function")
        ? window.CSS.escape(key)
        : key.replace(/["\\]/g, "\\$&");
      const matches = Array.from(document.querySelectorAll(`[data-intel-card-id="${escaped}"]`));
      if (!matches.length) return;
      const sbtWrap = document.getElementById("intel-sbt-cards");
      const inVisibleSbt = matches.find((el) => Boolean(sbtWrap && sbtWrap.contains(el) && el.getClientRects().length > 0));
      const visible = matches.find((el) => el.getClientRects().length > 0);
      const card = inVisibleSbt || visible || matches[0];
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("is-sbt-jump-target");
      window.setTimeout(() => card.classList.remove("is-sbt-jump-target"), 1800);
    });

    async function renderIntelOnLoad() {
      try {
        await refreshIntelFeedForCurrentLang();
        scheduleIntelFeedPrefetchOnActivity();
      } catch (error) {
        await attemptIntelAutoRepair(error);
      }
      maybeRefreshPokemonNewsForCategory(getActiveIntelCategory());
    }
