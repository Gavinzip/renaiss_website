    const LOCALIZED_DYNAMIC_REGION_IDS = Object.freeze([
      "intel-master-rail",
      "intel-master-stage",
      "intel-events-list",
      "intel-features-list",
      "intel-events-cards",
      "intel-other-cards",
      "intel-pokemon-cards",
      "pokemon-news-list",
      "intel-sbt-cards",
      "intel-tools-cards",
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

    function containsCjk(text) {
      return /[\u3400-\u9fff]/.test(String(text || ""));
    }

    function pruneNoopTranslationMemo(lang) {
      const tag = normalizeUiLang(lang);
      const prefix = `${tag}\n`;
      for (const [key, value] of uiTranslationMemo.entries()) {
        if (!key.startsWith(prefix)) continue;
        const source = key.slice(prefix.length);
        if (!containsCjk(source)) continue;
        if (String(value || "") === source) {
          uiTranslationMemo.delete(key);
        }
      }
    }

    function applyUiTranslationFallback(lang, source, translated) {
      const tag = normalizeUiLang(lang);
      const rawSource = String(source || "");
      const rawTranslated = String(translated || "");
      if (!rawSource) return rawTranslated;
      const fallbackMap = UI_TRANSLATION_FALLBACKS[tag] || {};
      if (rawTranslated === rawSource && Object.prototype.hasOwnProperty.call(fallbackMap, rawSource)) {
        return String(fallbackMap[rawSource] || rawSource);
      }
      return rawTranslated;
    }

    async function requestTranslateTexts(lang, texts) {
      const response = await fetch(intelApiUrl("/api/intel/translate-texts"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, texts }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return {
        items: data.items.map((x) => String(x || "")),
        mode: String(data?.mode || ""),
      };
    }

    async function translateTextsForUi(lang, texts) {
      const tag = normalizeUiLang(lang);
      const rows = Array.isArray(texts) ? texts.map((x) => String(x || "")) : [];
      if (tag === "zh-Hant") return rows;
      pruneNoopTranslationMemo(tag);
      const out = rows.slice();
      const missing = [];
      const missingSet = new Set();
      rows.forEach((text) => {
        if (!text) return;
        const key = `${tag}\n${text}`;
        if (!uiTranslationMemo.has(key) && !missingSet.has(text)) {
          missingSet.add(text);
          missing.push(text);
        }
      });
      if (missing.length) {
        const chunkSize = 80;
        for (let i = 0; i < missing.length; i += chunkSize) {
          const chunk = missing.slice(i, i + chunkSize);
          let translated = [];
          let canMemo = true;
          try {
            const result = await requestTranslateTexts(tag, chunk);
            translated = result.items;
            if (result.mode === "no-key") {
              canMemo = false;
            }
          } catch (_error) {
            translated = chunk.slice();
            canMemo = false;
          }
          chunk.forEach((text, idx) => {
            const key = `${tag}\n${text}`;
            const raw = String(translated[idx] || text).trim() || text;
            const value = applyUiTranslationFallback(tag, text, raw);
            if (canMemo) {
              uiTranslationMemo.set(key, value);
            } else {
              uiTranslationMemo.delete(key);
            }
          });
        }
      }
      rows.forEach((text, idx) => {
        if (!text) return;
        const key = `${tag}\n${text}`;
        out[idx] = uiTranslationMemo.get(key) || text;
      });
      return out;
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

    function scheduleLangFeedRefresh(payload) {
      if (langFeedRefreshTimer) {
        window.clearTimeout(langFeedRefreshTimer);
        langFeedRefreshTimer = null;
      }
      const i18n = payload && typeof payload === "object" ? payload._i18n || {} : {};
      const mode = String(i18n?.mode || "");
      const lang = normalizeUiLang(payload?.lang || currentUiLang);
      const progress = i18n?.state?.lang_progress?.[lang] || {};
      if (mode === "building") {
        const percent = Number(progress?.percent || 0);
        const remaining = Number(progress?.remaining || 0);
        const suffix = percent > 0 ? `${percent}% / 剩 ${remaining}` : "建置中";
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
      const nodes = collectTranslatableTextNodes(document.body);
      const originals = nodes.map((node) => {
        const stored = uiTextNodeCache.get(node);
        const current = String(node.nodeValue || "");
        if (typeof stored === "string") {
          return stored;
        }
        uiTextNodeCache.set(node, current);
        return current;
      });
      if (currentUiLang === "zh-Hant") {
        nodes.forEach((node, idx) => {
          node.nodeValue = originals[idx];
        });
        return;
      }
      const tag = normalizeUiLang(currentUiLang);
      pruneNoopTranslationMemo(tag);
      const missing = [];
      const missingSet = new Set();
      const nodeOriginals = new Map();
      nodes.forEach((node, idx) => {
        const original = String(originals[idx] || "");
        nodeOriginals.set(node, original);
        if (!original) return;
        const key = `${tag}\n${original}`;
        const cached = uiTranslationMemo.get(key);
        if (cached) {
          node.nodeValue = cached;
          return;
        }
        const immediate = applyUiTranslationFallback(tag, original, original);
        if (immediate && immediate !== original) {
          uiTranslationMemo.set(key, immediate);
          node.nodeValue = immediate;
          return;
        }
        if (!missingSet.has(original)) {
          missingSet.add(original);
          missing.push(original);
        }
      });
      const chunkSize = 80;
      for (let i = 0; i < missing.length; i += chunkSize) {
        if (version !== uiTranslateVersion) return;
        const chunk = missing.slice(i, i + chunkSize);
        let translated = [];
        let canMemo = true;
        try {
          const result = await requestTranslateTexts(tag, chunk);
          translated = result.items;
          if (result.mode === "no-key") canMemo = false;
        } catch (_error) {
          translated = chunk.slice();
          canMemo = false;
        }
        const chunkSet = new Set(chunk);
        chunk.forEach((text, idx) => {
          const key = `${tag}\n${text}`;
          const raw = String(translated[idx] || text).trim() || text;
          const value = applyUiTranslationFallback(tag, text, raw);
          if (canMemo) uiTranslationMemo.set(key, value);
          else uiTranslationMemo.delete(key);
        });
        if (version !== uiTranslateVersion) return;
        nodes.forEach((node) => {
          const original = nodeOriginals.get(node) || "";
          if (!chunkSet.has(original)) return;
          const key = `${tag}\n${original}`;
          node.nodeValue = uiTranslationMemo.get(key) || original;
        });
      }
    }

    function setupLanguageSwitcher() {
      updateLangSwitcherUi();
      const select = document.getElementById("lang-select");
      if (!select) return;
      select.addEventListener("change", async () => {
        const next = normalizeUiLang(select.value || "zh-Hant");
        if (next === currentUiLang) return;
        saveUiLang(next);
        updateLangSwitcherUi();
        setLangBuildStatus(`${langDisplayName(next)} loading`, "working");
        try {
          await applyUiLanguage();
          setLangBuildStatus("");
          refreshIntelFeedForCurrentLang()
            .then(() => applyUiLanguage())
            .catch((error) => setIntelMessage(`語言資料刷新失敗：${String(error?.message || error)}`, "error"));
          refreshPokemonNews(false).catch(() => {});
        } catch (error) {
          setIntelMessage(`語言切換失敗：${String(error?.message || error)}`, "error");
        }
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

    function updateIntelAuthUi() {
      const statusEl = document.getElementById("intel-auth-status");
      const adminPanel = document.getElementById("intel-admin-monitor");
      const adminOpenBtn = document.getElementById("nav-admin-monitor-btn");
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

      if (analyzeBtn) analyzeBtn.disabled = !editable;
      if (syncBtn) syncBtn.disabled = !editable;
      if (input) input.disabled = !editable;
      if (adminPanel) adminPanel.style.display = showAdminPanel ? "grid" : "none";
      if (adminOpenBtn) adminOpenBtn.style.display = showAdminPanel ? "inline-flex" : "none";
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
        return;
      }
      if (!intelAuthState.ready || intelAuthState.checking) {
        statusEl.textContent = "管理模式：檢查登入狀態中...";
        return;
      }
      if (!intelAuthState.authRequired) {
        statusEl.textContent = "管理模式：目前為開放編輯（未啟用登入限制）。";
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        return;
      }
      if (!intelAuthState.authConfigured) {
        statusEl.textContent = "管理模式：尚未設定管理員帳號（請設定後端 ENV）。";
        statusEl.classList.add("is-error");
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "none"; });
        if (adminOpenBtn) adminOpenBtn.style.display = "none";
        return;
      }
      if (intelAuthState.authenticated) {
        statusEl.textContent = `管理模式：已登入 @${intelAuthState.user || "admin"}，可修改資料。`;
        loginButtons.forEach((btn) => { btn.style.display = "none"; });
        logoutButtons.forEach((btn) => { btn.style.display = "inline-flex"; });
        applyUiLanguage().catch(() => {});
        return;
      }
      statusEl.textContent = "管理模式：唯讀。按 ⌘ + Shift + A 可開啟管理員登入。";
      applyUiLanguage().catch(() => {});
    }

    async function fetchIntelAuthState() {
      intelAuthState.checking = true;
      updateIntelAuthUi();
      try {
        const response = await fetch(intelApiUrl("/api/auth/me"), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }
        intelAuthState.ready = true;
        intelAuthState.authRequired = Boolean(data?.auth_required);
        intelAuthState.authConfigured = Boolean(data?.auth_configured);
        intelAuthState.authenticated = Boolean(data?.authenticated);
        intelAuthState.user = String(data?.user || "");
        intelAuthState.mode = String(data?.mode || "");
        intelAuthState.error = String(data?.error || "");
      } catch (error) {
        intelAuthState.ready = true;
        intelAuthState.authRequired = false;
        intelAuthState.authConfigured = false;
        intelAuthState.authenticated = true;
        intelAuthState.user = "";
        intelAuthState.mode = "fallback-open";
        intelAuthState.error = String(error?.message || "");
      } finally {
        intelAuthState.checking = false;
        updateIntelAuthUi();
      }
    }

    async function submitIntelLogin(username, password) {
      const response = await fetch(intelApiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      await fetchIntelAuthState();
      if (intelFeedCache) renderIntelFeed(intelFeedCache);
      return data;
    }

    async function submitIntelLogout() {
      const response = await fetch(intelApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      await fetchIntelAuthState();
      if (intelFeedCache) renderIntelFeed(intelFeedCache);
      return data;
    }

    function routeLabelName(label) {
      const map = {
        events: "活動",
        official: "官方",
        sbt: "SBT",
        pokemon: "寶可夢",
        alpha: "未來 Alpha",
        tools: "工具",
        other: "社群精選",
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
      let whenText = dt ? toPosterDate(dt.toISOString()) : "待官方公告";
      if (!dt && hasLiveReleaseSignal(card)) {
        const pub = String(card?.published_at || "").trim();
        whenText = pub ? `${toPosterDate(pub)}（已上線）` : "已上線";
      }
      const whatText = truncateText(cleanMasterTitle(card?.title || leadText || "更新內容待補充"), 68);
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
      if (!impact) impact = String(leadText || "影響範圍待官方補充。");
      impact = truncateText(String(impact).replace(/^(可能影響|影響|重點在)[:：]\s*/u, ""), 78);

      let action = details.find((x) => /(下一步|你要做什麼|建議|先|設定頁|報名|參與|留意|關注|確認)/.test(String(x)));
      if (!action) {
        const join = String(card?.event_facts?.participation || "").trim();
        if (join) action = `先完成 ${join}，再留意官方下一則公告。`;
      }
      if (!action) action = "先確認開放條件與時間，再決定是否提前準備。";
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
        action = "快照前持續拉分，快照後核對官方最終門檻與 SBT 等級。";
      }

      const factSchedule = String(card?.event_facts?.schedule || "").trim();
      const factLocation = String(card?.event_facts?.location || "").trim();
      const factReward = String(card?.event_facts?.reward || "").trim();
      const factJoin = String(card?.event_facts?.participation || "").trim();

      if (isAlpha) {
        const alphaAction = hasSbtLabel && sbtHowToGet ? `SBT 取得方式：${sbtHowToGet}` : (action || "先確認開放條件與時間");
        return {
          title: "Alpha 四格整理",
          slots: [
            { label: "何時上線", value: whenText || "待官方公告" },
            { label: "改了什麼", value: whatText || "更新內容待補充" },
            { label: "影響誰", value: impact || "影響對象待官方補充" },
            { label: "先做什麼", value: alphaAction },
          ],
        };
      }

      if (cardType === "event") {
        const place = truncateText(factLocation || details.find((x) => /(地點|場地|venue|hong kong|香港|discord|線上)/i.test(String(x))) || "待官方補充", 68);
        let reward = truncateText(factReward || details.find((x) => /(獎勵|reward|sbt|積分|airdrop|周邊)/i.test(String(x))) || "以原文公告為準", 72);
        let next = truncateText(factJoin ? `先完成 ${factJoin}` : (action || "先確認參與方式與截止時間"), 76);
        if (hasSbtLabel) {
          if (!/(sbt|soulbound)/i.test(reward)) reward = "SBT（依官方條件發放）";
          if (sbtHowToGet) next = truncateText(`SBT 取得方式：${sbtHowToGet}`, 82);
        }
        return {
          title: "活動四格整理",
          slots: [
            { label: "何時參加", value: truncateText(factSchedule || whenText || "請看原文時間", 62) },
            { label: "在哪參加", value: place },
            { label: "你能拿到", value: reward },
            { label: "先做什麼", value: next },
          ],
        };
      }

      if (cardType === "market") {
        const numberLine = truncateText(
          details.find((x) => /(數字|成交|售價|價格|美元|usdt|ntd|%|volume|market)/i.test(String(x)))
            || "請看原文中的價格/成交/規模資訊",
          74,
        );
        return {
          title: "市場四格整理",
          slots: [
            { label: "核心事件", value: truncateText(whatText || leadText || "市場更新", 72) },
            { label: "關鍵數字", value: numberLine },
            { label: "影響面", value: truncateText(impact || "影響社群對短期市場方向的判讀", 76) },
            { label: "先做什麼", value: truncateText(action || "比對多來源後再做決策", 76) },
          ],
        };
      }

      if (cardType === "report") {
        const diff = truncateText(details.find((x) => /(優點|缺點|差異|比較|方案|成本)/.test(String(x))) || "重點在比較不同方案差異", 76);
        const audience = truncateText(details.find((x) => /(適合|對象|玩家|新手|使用者|社群)/.test(String(x))) || "適合需要快速選方案的人", 72);
        return {
          title: "工具/攻略四格整理",
          slots: [
            { label: "在比較什麼", value: truncateText(whatText || "方案比較", 72) },
            { label: "重點差異", value: diff },
            { label: "適合誰", value: audience },
            { label: "先做什麼", value: truncateText(action || "先依預算與時程選一個方案試跑", 76) },
          ],
        };
      }

      return {
        title: "重點四格整理",
        slots: [
          { label: "核心主題", value: truncateText(whatText || leadText || "內容待補充", 72) },
          { label: "當下脈絡", value: truncateText(whenText || "近期更新", 64) },
          { label: "對你的影響", value: truncateText(impact || "作為社群觀察與後續追蹤依據", 76) },
          { label: "下一步", value: truncateText(action || "先看原文，再追同帳號後續更新", 76) },
        ],
      };
    }

    function structuredSlotsHtml(card, leadText = "") {
      const structured = structuredSlots(card, leadText);
      const slots = Array.isArray(structured?.slots) ? structured.slots : [];
      if (!slots.length) return "";
      return `
        <div>
          <div class="intel-detail-block-title">${escapeHtml(String(structured?.title || "重點四格整理"))}</div>
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
      const title = cleanMasterTitle(card?.title || "未命名貼文");
      const glance = cardPrimaryHighlight(card);
      const summary = cleanMasterSummary(card?.summary || "");
      const cover = String(card?.cover_image || "").trim();
      const coverHtml = /^https?:\/\//i.test(cover)
        ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" loading="lazy" />`
        : `<div class="intel-detail-cover-empty">此貼文沒有可用圖片，仍可看下方完整整理。</div>`;
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
        : `<p class="intel-summary">目前沒有可用重點條列。</p>`;
      const summaryLead = summary.split("。").map((x) => String(x || "").trim()).find((x) => x) || "";
      const leadText = summaryLead || normalizeKeylineText(glance) || "目前沒有可用摘要，請看原始貼文。";
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
        if (leadText) normalizedDetailLines.push(`事件背景：${leadText}`);
        const facts = card?.event_facts || {};
        const scheduleText = String(facts?.schedule || "").trim() || (eventText !== "--" ? eventText : "");
        const locationText = String(facts?.location || "").trim();
        if (scheduleText || locationText) {
          normalizedDetailLines.push(`時間地點：${[scheduleText, locationText].filter(Boolean).join("／")}`);
        }
        const rewardText = String(facts?.reward || "").trim();
        if (rewardText) normalizedDetailLines.push(`獎勵與誘因：${rewardText}`);
        const joinText = String(facts?.participation || "").trim();
        if (joinText) normalizedDetailLines.push(`參與方式：${joinText}`);
        const impactHint = normalizeKeylineText(card?.glance || "");
        if (impactHint) normalizedDetailLines.push(`可能影響：${impactHint}`);
        normalizedDetailLines.push("下一步：先看原文確認規則、時間與限制，再決定是否參與。");
      }
      const detailHtml = normalizedDetailLines.length
        ? `<ul class="intel-detail-list">${normalizedDetailLines.slice(0, 6).map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : `<p class="intel-summary">目前沒有可用的展開整理。</p>`;
      const eventFactsHtml = renderEventFactsHtml(card);
      const labels = Array.isArray(card?.route_labels) ? card.route_labels : [];
      const tagHtml = labels.length
        ? `<div class="intel-detail-tags">${labels.map((x) => `<span class="intel-detail-tag">${escapeHtml(routeLabelName(x) || String(x))}</span>`).join("")}</div>`
        : "";
      const url = String(card?.url || "").trim();
      const sourceHtml = url
        ? `<div class="intel-detail-source"><span class="intel-detail-block-title">原始來源</span><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>`
        : "";
      const summaryBlock = (summary && !summary.startsWith(leadText) && !leadText.startsWith(summary))
        ? `<p class="intel-summary">${escapeHtml(summary)}</p>`
        : "";
      const alphaSlotsBlock = structuredSlotsHtml(card, leadText);
      return `
        <div class="intel-detail-top">
          <span class="intel-detail-kicker">@${escapeHtml(account)} · ${escapeHtml(typeLabel)}</span>
          <span class="intel-detail-time">發布 ${escapeHtml(publish)} · 事件 ${escapeHtml(eventText)}</span>
        </div>
        <div class="intel-detail-cover">${coverHtml}</div>
        <h3 class="intel-detail-title">${escapeHtml(title)}</h3>
        <div class="intel-detail-grid">
          <section class="intel-detail-section">
            <div class="intel-detail-block-title">一句話重點</div>
            <p class="intel-detail-glance">${escapeHtml(leadText)}</p>
            ${summaryBlock}
            ${eventFactsHtml ? `<div><div class="intel-detail-block-title">活動資訊</div><div class="intel-detail-facts">${eventFactsHtml}</div></div>` : ""}
            <div class="intel-detail-block-title">快速重點</div>
            ${bulletHtml}
          </section>
          <section class="intel-detail-section">
            ${alphaSlotsBlock}
            <div class="intel-detail-block-title">AI 深入整理</div>
            ${detailSummary ? `<p class="intel-summary">${escapeHtml(detailSummary)}</p>` : ""}
            ${detailHtml}
            ${tagHtml ? `<div><div class="intel-detail-block-title">分類標籤</div>${tagHtml}</div>` : ""}
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

    function pokemonNewsDetailHtml(item) {
      const title = String(item?.summary_title || item?.title || "未命名消息").trim();
      const summary = String(item?.summary || "").trim();
      const source = String(item?.source || "unknown").trim();
      const dateText = String(item?.date || "").trim();
      const points = Array.isArray(item?.key_points) ? item.key_points.filter((x) => String(x || "").trim()).slice(0, 6) : [];
      const pointHtml = points.length
        ? `<ul class="intel-detail-list">${points.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : `<p class="intel-summary">目前沒有可顯示重點。</p>`;
      const detailLines = Array.isArray(item?.detail_lines) ? item.detail_lines.filter((x) => String(x || "").trim()).slice(0, 6) : [];
      const detailHtml = detailLines.length
        ? `<ul class="intel-detail-list">${detailLines.map((x) => `<li>${escapeHtml(String(x))}</li>`).join("")}</ul>`
        : "";
      const url = String(item?.url || "").trim();
      const sourceHtml = url
        ? `<div class="intel-detail-source"><span class="intel-detail-block-title">原始來源</span><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>`
        : "";
      return `
        <div class="intel-detail-top">
          <span class="intel-detail-kicker">寶可夢最新消息 · ${escapeHtml(source)}</span>
          <span class="intel-detail-time">${escapeHtml(dateText || "--")}</span>
        </div>
        <h3 class="intel-detail-title">${escapeHtml(title)}</h3>
        ${summary ? `<p class="intel-detail-glance">${escapeHtml(summary)}</p>` : ""}
        <div><div class="intel-detail-block-title">重點摘要</div>${pointHtml}</div>
        ${detailHtml ? `<div><div class="intel-detail-block-title">完整整理</div>${detailHtml}</div>` : ""}
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

    function openIntelFeedbackModal(options = {}) {
      const modal = document.getElementById("intel-feedback-modal");
      const titleEl = document.getElementById("intel-feedback-title");
      const subEl = document.getElementById("intel-feedback-sub");
      const labelField = document.getElementById("intel-feedback-label-field");
      const labelEl = document.getElementById("intel-feedback-label");
      const reasonEl = document.getElementById("intel-feedback-reason");
      if (!modal || !labelEl || !reasonEl) return Promise.resolve(null);

      const mode = String(options.mode || "feedback");
      const defaultLabel = String(options.defaultLabel || "insight").trim().toLowerCase();
      const normalizedLabel = intelFeedbackLabels.has(defaultLabel) ? defaultLabel : "insight";
      const isExclude = mode === "exclude";
      if (titleEl) titleEl.textContent = isExclude ? "排除這篇貼文" : "回饋分類";
      if (subEl) {
        subEl.textContent = isExclude
          ? "請說明為什麼這篇不該出現在目前整理或活動時間軸。這會讓 AI 下次遇到類似內容時避開。"
          : "請選擇正確分類，並說明為什麼要改。這會被存進 AI 分類記憶。";
      }
      if (labelField) labelField.style.display = isExclude ? "none" : "";
      labelEl.value = isExclude ? "exclude" : normalizedLabel;
      reasonEl.value = "";
      reasonEl.placeholder = isExclude
        ? "例：這只是卡包 / 功能更新，不是需要放在活動主時間軸的活動。"
        : "例：這篇主要在說 SBT 取得條件，不應只算活動；SBT 分區要強調怎麼獲得。";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      window.setTimeout(() => reasonEl.focus(), 0);

      return new Promise((resolve) => {
        if (intelFeedbackModalResolver) resolveIntelFeedbackModal(null);
        intelFeedbackModalResolver = resolve;
      });
    }

    function renderIntelFeed(payload) {
      intelFeedCache = payload && typeof payload === "object" ? payload : null;
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
      const alphaFutureCards = filterFutureAlphaCards(routed.alpha);
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
      conclusion.textContent = String(digest.conclusion || "尚未取得可顯示摘要。");

      takeaways.innerHTML = "";
      const tips = Array.isArray(digest.takeaways) && digest.takeaways.length
        ? digest.takeaways.slice(0, 3)
        : ["尚未取得三條結論，請先同步資料。"];
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
        item.textContent = "尚無來源統計";
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
          chip.textContent = "尚未產生關鍵詞";
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
            const name = String(tpl?.name || tpl?.id || "未命名模板");
            const useFor = String(tpl?.for || "");
            div.innerHTML = `<div class="intel-template-name">${escapeHtml(name)}</div><div class="intel-template-for">${escapeHtml(useFor)}</div>`;
            formatTemplates.appendChild(div);
          });
        } else {
          const div = document.createElement("div");
          div.className = "intel-template-item";
          div.innerHTML = `<div class="intel-template-name">固定模板</div><div class="intel-template-for">活動海報 / 市場訊號 / 公告時間線 / 社群觀點</div>`;
          formatTemplates.appendChild(div);
        }
      }

      if (officialOverviewTitle && officialOverviewSummary && officialOverviewBullets) {
        officialOverviewTitle.textContent = String(officialOverview?.title || "近 7 天官方總結");
        officialOverviewSummary.textContent = String(officialOverview?.summary || "目前尚未抓到足夠的官方更新資料。");
        officialOverviewBullets.innerHTML = "";
        const rows = Array.isArray(officialOverview?.bullets) ? officialOverview.bullets.slice(0, 4) : [];
        if (!rows.length) {
          const li = document.createElement("li");
          li.textContent = "目前沒有可顯示的官方重點。";
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
      renderSectionList(officialList, cardsToSectionItems(routed.official), "目前無可用官方重點");
      renderSectionList(eventsList, cardsToSectionItems(eventsByPublished), "目前無可用活動重點");
      renderSectionList(featuresList, cardsToSectionItems(alphaFutureCards), "目前尚未偵測到即將開放功能");
      renderSectionList(communityList, cardsToSectionItems(routed.other), "目前無可用社群焦點");
      const timelineCards = [];
      const timelineSeen = new Set();
      eventsByPublished.forEach((card) => {
        const key = String(card?.id || card?.url || "");
        if (!key || timelineSeen.has(key)) return;
        timelineSeen.add(key);
        timelineCards.push(card);
      });
      renderMasterTimeline({ cards: timelineCards });
      renderAgendaList(growthList, agenda?.growth_signals, "目前無顯著增長訊號");
      const officialAgenda = routed.official.slice(0, 6).map((card) => ({
        label: "官方",
        urgency: String(card?.card_type || "") === "announcement" ? "high" : "normal",
        headline: String(card?.title || ""),
        glance: String(card?.glance || card?.summary || ""),
        account: String(card?.account || ""),
        url: String(card?.url || ""),
        published_at: card?.published_at,
      }));
      renderAgendaList(recentList, officialAgenda, "近期無官方高訊號更新");

      renderCardGrid("intel-events-cards", "intel-events-empty", eventsByPublished, "目前沒有可顯示的活動貼文。");
      renderCardGrid("intel-cards", "intel-empty", routed.official, "目前沒有可顯示的官方貼文。");
      renderCardGrid("intel-sbt-cards", "intel-sbt-empty", routed.sbt, "目前沒有 SBT 相關貼文。");
      renderCardGrid("intel-pokemon-cards", "intel-pokemon-empty", routed.pokemon, "目前沒有寶可夢相關貼文。");
      renderCardGrid("intel-alpha-cards", "intel-alpha-empty", alphaFutureCards, "目前沒有未來功能 / Alpha 相關貼文。");
      renderCardGrid("intel-tools-cards", "intel-tools-empty", routed.tools, "目前沒有工具或攻略貼文。");
      renderCardGrid("intel-other-cards", "intel-other-empty", routed.other, "目前沒有落在其他分類的貼文。");
      markLocalizedDynamicRegions();
      updateIntelAuthUi();
      applyUiLanguage().catch(() => {});
    }

    async function fetchIntelFeed(langOverride = "") {
      const requestLang = normalizeUiLang(langOverride || currentUiLang || document.documentElement.lang || "zh-Hant");
      const canUseApi = window.location.protocol !== "file:";
      if (canUseApi) {
        const response = await fetch(intelApiUrl(`/api/intel/feed?lang=${encodeURIComponent(requestLang)}`), {
          cache: "no-store",
          credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || typeof payload?.feed !== "object") {
          if (INTEL_API_BASE) {
            throw new Error(payload?.error || `HTTP ${response.status}`);
          }
        } else {
          if (!payload.feed.lang) {
            payload.feed.lang = requestLang;
          }
          return payload.feed;
        }
      }
      const response = await fetch("./data/x_intel_feed.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load x_intel_feed.json");
      const fallback = await response.json();
      if (fallback && typeof fallback === "object" && !fallback.lang) {
        fallback.lang = "zh-Hant";
      }
      return fallback;
    }

    async function refreshIntelFeedForCurrentLang() {
      const payload = await fetchIntelFeed(currentUiLang);
      renderIntelFeed(payload);
      scheduleLangFeedRefresh(payload);
      return payload;
    }

    async function postIntel(path, body) {
      const response = await fetch(intelApiUrl(path), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        if (response.status === 401) {
          intelAuthState.authenticated = false;
          updateIntelAuthUi();
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
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || typeof data?.status !== "object") {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return data.status;
    }

    async function triggerWebsiteBackup() {
      const data = await postIntel("/api/intel/backup", {});
      return data?.backup || {};
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
          ? ` · 自動每 ${interval || 12}h · 下次 ${nextSync}`
          : " · 自動同步未啟用";
        syncMetaEl.textContent = `卡片 ${Number(sync?.total_cards || 0)} / 原始 ${Number(sync?.raw_total_cards || 0)} · 最近來源 ${toLocalTime(sync?.latest_source_at)}${scheduleText}`;
      }
      if (newPostsEl) {
        const v24 = Number(newPosts?.new_cards_24h || 0);
        const v6 = Number(newPosts?.new_cards_6h || 0);
        newPostsEl.textContent = `24h 新貼文 ${v24}（6h ${v6}）`;
      }
      if (newMetaEl) {
        const pending = Number(newPosts?.pending_processing || 0);
        const flag = Boolean(newPosts?.is_processing);
        newMetaEl.textContent = flag ? `背景整理進行中，待處理 ${pending} 件` : "目前沒有待處理整理任務";
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
        const reason = String(restore?.reason || "").trim();
        const ok = restore?.ok !== false;
        const restored = Boolean(restore?.restored);
        const repoReady = Boolean(backup?.has_repo);
        if (!repoReady) dataRepoEl.textContent = "Repo 未設定";
        else if (!ok) dataRepoEl.textContent = "連線/還原失敗";
        else if (restored) dataRepoEl.textContent = "已從 Repo 還原";
        else if (reason === "data_root_not_empty") dataRepoEl.textContent = "Repo 已設定，資料已存在";
        else if (reason === "disabled") dataRepoEl.textContent = "啟動還原未啟用";
        else dataRepoEl.textContent = "Repo 已設定";
      }
      if (dataRepoMetaEl) {
        const reason = String(restore?.reason || "--").trim() || "--";
        const subdir = String(restore?.subdir || backup?.subdir || "--");
        const branch = String(restore?.branch || backup?.branch || "--");
        const error = String(restore?.error || "").trim();
        dataRepoMetaEl.textContent = `restore=${reason} · branch=${branch} · subdir=${subdir}${error ? ` · ${error}` : ""}`;
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
      backupRows.push(`Restore：ok=${restore?.ok === false ? "no" : "yes"} · restored=${restore?.restored ? "yes" : "no"} · reason=${String(restore?.reason || "--")} · branch=${String(restore?.branch || backup?.branch || "--")} · subdir=${String(restore?.subdir || backup?.subdir || "--")}`);
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

      const monitorRows = [];
      const syncNext = toLocalTime(sync?.next_run_at);
      monitorRows.push(
        `X/Twitter sync：${String(sync?.status || "idle")} · interval ${Number(sync?.schedule_interval_hours || 12)}h · window ${Number(sync?.schedule_window_days || 30)}d · next ${syncNext}`
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
      const progress = i18n?.lang_progress && typeof i18n.lang_progress === "object" ? i18n.lang_progress : {};
      ["zh-Hant", "zh-Hans", "en", "ko"].forEach((tag) => {
        const row = progress[tag] || {};
        const status = String(row?.status || "pending");
        const percent = Number(row?.percent || 0);
        const done = Number(row?.done || 0);
        const total = Number(row?.total || 0);
        const remaining = Number(row?.remaining || Math.max(0, total - done));
        const mode = String(row?.mode || "");
        monitorRows.push(`I18N[${tag}] ${status}${mode ? `/${mode}` : ""} · 完成 ${percent}% · ${done}/${total} · 剩餘 ${remaining}`);
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
        listEl.innerHTML = `<article class="pokemon-news-card"><p class="pokemon-news-summary">目前沒有可顯示的最新消息。</p></article>`;
      } else {
        listEl.innerHTML = rows.slice(0, 8).map((item, index) => {
          const title = String(item?.summary_title || item?.title || item?.url || "未命名消息");
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
            ? `<a class="pokemon-news-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">查看原文</a>`
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
              <p class="pokemon-news-summary">點擊卡片可看完整整理。</p>
              ${linkHtml}
            </article>
          `;
        }).join("");
      }
      const generatedAt = toLocalTime(payload?.generated_at);
      const lang = String(payload?.lang || document.documentElement.lang || "zh-Hant").trim();
      const mode = String(payload?.summary_mode || "ai").trim();
      const modeLabel = mode.startsWith("ai") ? "AI整理" : "基礎整理";
      const providerRaw = String(payload?.provider || "minimax_cli_search").trim();
      const providerLabel = providerRaw === "minimax_mcp_web_search"
        ? "MiniMax MCP web_search"
        : (providerRaw === "minimax_cli_search" || providerRaw === "mmx" ? "MiniMax CLI Search" : providerRaw);
      const cachedLabel = payload?.cached ? " · 快取" : " · 即時";
      const refreshing = Boolean(payload?.refreshing);
      const refreshingLabel = refreshing ? " · 背景更新中" : "";
      const nextRefreshAt = toLocalTime(payload?.next_refresh_at);
      const nextLabel = nextRefreshAt && nextRefreshAt !== "--" ? ` · 下次 ${nextRefreshAt}` : "";
      const warning = String(payload?.warning || "").trim();
      const pendingMsg = String(payload?.message || "").trim();
      metaEl.textContent = warning
        ? `來源：${providerLabel} · ${modeLabel} · 語言 ${lang} · 更新 ${generatedAt}${cachedLabel}${refreshingLabel}${nextLabel} · ${warning}`
        : `來源：${providerLabel} · ${modeLabel} · 語言 ${lang} · 更新 ${generatedAt}${cachedLabel}${refreshingLabel}${nextLabel}${pendingMsg ? ` · ${pendingMsg}` : ""}`;
      markLocalizedDynamicRegions();
      applyUiLanguage().catch(() => {});
    }

    async function refreshPokemonNews(force = false) {
      const metaEl = document.getElementById("pokemon-news-meta");
      if (metaEl) {
        metaEl.textContent = force
          ? "來源：MiniMax NewsAgent · 正在更新最新消息..."
          : "來源：MiniMax NewsAgent · 載入中...";
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
      const result = await openIntelFeedbackModal({ mode: "feedback", defaultLabel });
      if (!result) return false;
      const label = String(result.label || "").trim().toLowerCase();
      if (!intelFeedbackLabels.has(label)) {
        setIntelMessage("分類無效，請選擇 event/feature/announcement/market/report/insight/official/sbt/pokemon/alpha/tools/other/exclude。", "error");
        return false;
      }
      const reason = String(result.reason || "").trim();
      if (!reason) {
        setIntelMessage("請填寫原因，這樣 AI 才能學到為什麼要改。", "error");
        return false;
      }
      await postIntel("/api/intel/feedback", { id, label, reason });
      await refreshIntelFeedForCurrentLang();
      return true;
    }

    async function handleIntelAction(action, id, hintLabel = "") {
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
        if (!reason) {
          setIntelMessage("請填寫排除原因，這樣 AI 才能學到哪些內容不該出現。", "error");
          return false;
        }
        setIntelMessage("已加入排除，正在寫入 AI 回饋記憶並重新整理...", "");
        await submitIntelPick(id, action, reason);
        setIntelMessage("已排除這篇貼文，原因已寫入 AI 回饋記憶。", "ok");
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
          pin: "確定要頂選這篇嗎？頂選後可跨越兩週時間窗，並會優先出現在「社群精選」。",
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
        setIntelMessage("正在提交分類回饋...", "");
        const ok = await submitIntelFeedback(id, hintLabel);
        if (ok) setIntelMessage("已記錄分類回饋，並重新同步。", "ok");
        return ok;
      }
      return false;
    }

    async function renderIntelOnLoad() {
      try {
        await refreshIntelFeedForCurrentLang();
      } catch (error) {
        setIntelMessage(`情報資料載入失敗：${error.message}`, "error");
      }
      if (location.protocol !== "file:") {
        try {
          await refreshPokemonNews(false);
        } catch (error) {
          const metaEl = document.getElementById("pokemon-news-meta");
          if (metaEl) metaEl.textContent = `來源：MiniMax NewsAgent · 載入失敗：${error.message}`;
        }
      }
    }
