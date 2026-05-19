(() => {
  const LANG_STORAGE_KEY = "intel_ui_lang";
  const SUPPORTED_LANGS = new Set(["zh-Hant", "zh-Hans", "en", "ko"]);
  const agentConversation = [];
  let lastSources = [];
  let typingNode = null;
  let activeSourceId = "";
  const agentFeedCacheByLang = new Map();

  function normalizeLangTag(raw) {
    const tag = String(raw || "").trim().toLowerCase();
    if (tag === "zh-hans" || tag === "zh-cn" || tag === "zh-sg") return "zh-Hans";
    if (tag === "en" || tag.startsWith("en-")) return "en";
    if (tag === "ko" || tag.startsWith("ko-")) return "ko";
    return "zh-Hant";
  }

  function loadUiLang() {
    try {
      const saved = normalizeLangTag(localStorage.getItem(LANG_STORAGE_KEY) || "");
      if (SUPPORTED_LANGS.has(saved)) return saved;
    } catch (_error) {}
    return normalizeLangTag(document.documentElement.lang || "zh-Hant");
  }

  function saveUiLang(lang) {
    const next = normalizeLangTag(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch (_error) {}
    document.documentElement.lang = next;
    return next;
  }

  function getUiLangTag() {
    const select = document.getElementById("lang-select");
    if (select && select.value) return normalizeLangTag(select.value);
    return normalizeLangTag(document.documentElement.lang || "zh-Hant");
  }

  function getStaticI18nByKey(key, fallback = "") {
    const rows = window.INTEL_UI_STATIC_TRANSLATIONS && window.INTEL_UI_STATIC_TRANSLATIONS[key];
    if (!rows || typeof rows !== "object") return String(fallback || "");
    const lang = getUiLangTag();
    return String(rows[lang] || rows["zh-Hant"] || fallback || "");
  }

  function applyStaticI18n() {
    const lang = getUiLangTag();
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n-key]").forEach((el) => {
      const key = String(el.getAttribute("data-i18n-key") || "").trim();
      if (!key) return;
      const value = getStaticI18nByKey(key, "");
      if (!value) return;
      if (String(el.getAttribute("data-i18n-html") || "") === "1") {
        el.innerHTML = value;
        return;
      }
      if (el.childElementCount) {
        const textNode = Array.from(el.childNodes || []).find(
          (node) => node && node.nodeType === Node.TEXT_NODE && String(node.nodeValue || "").trim().length > 0
        );
        if (textNode) {
          textNode.nodeValue = value;
          return;
        }
      }
      el.textContent = value;
    });
  }

  function setupLanguageSwitcher() {
    const select = document.getElementById("lang-select");
    const current = loadUiLang();
    if (select) {
      select.value = current;
      select.addEventListener("change", () => {
        saveUiLang(select.value || "zh-Hant");
        applyStaticI18n();
      });
    }
    saveUiLang(current);
    applyStaticI18n();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(value, fallback = "") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    try {
      const parsed = new URL(raw, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (_error) {}
    return fallback;
  }

  function toLocalTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 16);
    try {
      return new Intl.DateTimeFormat(getUiLangTag(), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed);
    } catch (_error) {
      return parsed.toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function compactText(value, limit = 180) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}...`;
  }

  function displayScore(value) {
    const raw = Number(value) || 0;
    return Math.round(Math.max(0, Math.min(1, raw)) * 100);
  }

  function normalizeCompareText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .trim();
  }

  function isNearDuplicateText(a, b) {
    const left = normalizeCompareText(a);
    const right = normalizeCompareText(b);
    if (!left || !right) return false;
    if (left === right) return true;
    const shorter = left.length <= right.length ? left : right;
    const longer = left.length > right.length ? left : right;
    if (shorter.length >= 28 && longer.includes(shorter)) return true;
    if (shorter.length < 42) return false;
    const grams = (text) => {
      const out = new Set();
      for (let idx = 0; idx < text.length - 1; idx += 1) {
        out.add(text.slice(idx, idx + 2));
      }
      return out;
    };
    const leftGrams = grams(left);
    const rightGrams = grams(right);
    const smaller = leftGrams.size <= rightGrams.size ? leftGrams : rightGrams;
    const larger = leftGrams.size > rightGrams.size ? leftGrams : rightGrams;
    let overlap = 0;
    smaller.forEach((gram) => {
      if (larger.has(gram)) overlap += 1;
    });
    return smaller.size > 0 && overlap / smaller.size >= 0.78;
  }

  function uniqueTextEntries(entries, baseline = []) {
    const kept = [];
    const seen = baseline.map((x) => String(x || "")).filter(Boolean);
    entries.forEach((entry) => {
      const value = String(entry?.value || "").replace(/\s+/g, " ").trim();
      if (!value) return;
      if (seen.some((x) => isNearDuplicateText(value, x))) return;
      kept.push({ ...entry, value });
      seen.push(value);
    });
    return kept;
  }

  function cardTextBaseline(card) {
    if (!card || typeof card !== "object") return [];
    return [
      card.title,
      card.glance,
      card.summary,
      card.detail_summary,
      card.raw_text,
      ...(Array.isArray(card.bullets) ? card.bullets : []),
    ].filter(Boolean);
  }

  function sourceId(source) {
    return String(source?.id || source?.card_id || "").trim();
  }

  function primaryCategory(source, card) {
    const labels = [
      ...(Array.isArray(card?.route_labels) ? card.route_labels : []),
      ...(Array.isArray(card?.topic_labels) ? card.topic_labels : []),
      ...(Array.isArray(source?.topic_labels) ? source.topic_labels : []),
    ].map((x) => String(x || "").trim().toLowerCase());
    const allowed = ["events", "official", "sbt", "pokemon", "collectibles", "alpha", "guides", "community", "other"];
    const hit = labels.find((x) => allowed.includes(x));
    if (hit) return hit;
    if (String(card?.account || source?.account || "").trim().toLowerCase() === "renaissxyz") return "official";
    return "official";
  }

  function aggregatorCardLink(source, card) {
    const id = sourceId(source) || String(card?.id || "").trim();
    const category = primaryCategory(source, card);
    const query = id ? `?card=${encodeURIComponent(id)}` : "";
    return `./index.html${query}#cat-${encodeURIComponent(category)}`;
  }

  function formatProviderName(value) {
    const raw = String(value || "").trim();
    if (!raw) return "MiniMax";
    if (raw.toLowerCase() === "minimax") return "MiniMax";
    return raw;
  }

  async function postJson(path, body) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 75000);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error || `HTTP ${response.status}`));
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function getJson(path, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(path, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error || `HTTP ${response.status}`));
      }
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadAgentFeedCard(source) {
    const id = sourceId(source);
    if (!id) return null;
    const lang = getUiLangTag();
    if (!agentFeedCacheByLang.has(lang)) {
      const data = await getJson(`/api/intel/feed?lang=${encodeURIComponent(lang)}`, 18000);
      const cards = Array.isArray(data?.feed?.cards) ? data.feed.cards : [];
      const byId = new Map();
      cards.forEach((card) => {
        if (!card || typeof card !== "object") return;
        const cid = String(card.id || "").trim();
        const ckey = String(card._card_key || "").trim();
        if (cid) byId.set(cid, card);
        if (ckey) byId.set(ckey, card);
      });
      agentFeedCacheByLang.set(lang, byId);
    }
    return agentFeedCacheByLang.get(lang)?.get(id) || null;
  }

  function setRenaissAgentStatus(text, mode = "") {
    const el = document.getElementById("renaiss-agent-status");
    if (!el) return;
    el.classList.remove("is-working", "is-error", "is-ok");
    if (mode === "working") el.classList.add("is-working");
    if (mode === "error") el.classList.add("is-error");
    if (mode === "ok") el.classList.add("is-ok");
    el.textContent = String(text || "");
  }

  function setChatActive(active = true) {
    document.body.classList.toggle("agent-chat-active", Boolean(active));
    const card = document.querySelector(".renaiss-agent-card");
    if (card) {
      card.classList.toggle("is-empty", !active);
      card.classList.toggle("is-chatting", Boolean(active));
    }
  }

  function inlineMessageHtml(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([0-9]+)\]/g, "<span class=\"agent-source-cite\">[$1]</span>");
  }

  function messageHtml(text) {
    const blocks = String(text || "")
      .trim()
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!blocks.length) return "<p></p>";
    return blocks
      .map((part) => {
        const lines = part.split(/\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
          return `<ul>${lines.map((line) => `<li>${inlineMessageHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
        }
        if (lines.length && lines.every((line) => /^[0-9]+[.)]\s+/.test(line))) {
          return `<ol>${lines.map((line) => `<li>${inlineMessageHtml(line.replace(/^[0-9]+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
        }
        return `<p>${lines.map(inlineMessageHtml).join("<br>")}</p>`;
      })
      .join("");
  }

  function scrollMessagesToBottom() {
    const messages = document.getElementById("renaiss-agent-messages");
    if (!messages) return;
    messages.scrollTop = messages.scrollHeight;
  }

  function resizeAgentInput(input = document.getElementById("renaiss-agent-input")) {
    if (!input || input.tagName !== "TEXTAREA") return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  }

  function appendRenaissAgentMessage(role, text, options = {}) {
    const messages = document.getElementById("renaiss-agent-messages");
    if (!messages) return null;
    const safeRole = role === "user" ? "user" : "assistant";
    const div = document.createElement("div");
    div.className = `renaiss-agent-message is-${safeRole} is-entering${options.typing ? " is-typing" : ""}`;
    if (options.typing) {
      div.innerHTML = `
        <div class="renaiss-agent-role">Renaiss Agent</div>
        <div class="agent-typing-row" aria-label="Agent typing">
          <span></span><span></span><span></span>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="renaiss-agent-role">${safeRole === "user" ? "You" : "Renaiss Agent"}</div>
        <div class="renaiss-agent-bubble">${messageHtml(text)}</div>
      `;
    }
    messages.appendChild(div);
    window.requestAnimationFrame(() => div.classList.remove("is-entering"));
    scrollMessagesToBottom();
    return div;
  }

  function showTypingBubble() {
    removeTypingBubble();
    typingNode = appendRenaissAgentMessage("assistant", "", { typing: true });
  }

  function removeTypingBubble() {
    if (!typingNode) return;
    typingNode.remove();
    typingNode = null;
  }

  function sourceDate(source) {
    return source?.effective_event_date || source?.timeline_date || source?.published_at || "";
  }

  function renderRenaissAgentSources(sources = []) {
    const wrap = document.getElementById("renaiss-agent-sources");
    if (!wrap) return;
    const rows = Array.isArray(sources) ? sources.slice(0, 6) : [];
    lastSources = rows;
    if (!rows.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = `
      <div class="renaiss-agent-source-title">
        <span>Memory sources</span>
        <small>點開看原始卡片與引用依據</small>
      </div>
      <div class="renaiss-agent-source-list">
        ${rows.map((source, idx) => {
          const title = compactText(source?.title || source?.summary || source?.id || "Memory item", 92);
          const account = String(source?.account || "source");
          const score = displayScore(source?.score);
          const dateText = sourceDate(source) ? toLocalTime(sourceDate(source)) : "--";
          const summary = compactText(source?.summary || source?.detail_summary || source?.raw_hint || "", 128);
          return `
            <button class="renaiss-agent-source" type="button" data-agent-source-index="${idx}">
              <span class="renaiss-agent-source-index">[${idx + 1}]</span>
              <span class="renaiss-agent-source-copy">
                <strong>${escapeHtml(title)}</strong>
                <em>@${escapeHtml(account)} · ${escapeHtml(dateText)} · ${score}%</em>
                ${summary ? `<span>${escapeHtml(summary)}</span>` : ""}
              </span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function sourceFactsHtml(source) {
    const facts = source?.event_facts && typeof source.event_facts === "object" ? source.event_facts : {};
    const factRows = Object.entries(facts)
      .filter(([, value]) => String(value || "").trim())
      .map(([key, value]) => `
        <div class="agent-source-fact">
          <span>${escapeHtml(key)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `)
      .join("");
    return factRows ? `<div class="agent-source-facts">${factRows}</div>` : "";
  }

  function sourceTagsHtml(source) {
    const tags = Array.from(new Set([...(source?.topic_labels || []), ...(source?.tags || [])]))
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!tags.length) return "";
    return `<div class="agent-source-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
  }

  function sourceReasonHtml(source) {
    const reasons = Array.isArray(source?.rank_reasons) ? source.rank_reasons : [];
    const rows = reasons.map((reason) => String(reason || "").trim()).filter(Boolean).slice(0, 8);
    if (!rows.length) return "";
    return `<div class="agent-source-tags is-reasons">${rows.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
  }

  function renderOriginalCardPreview(card, source, mode = "loading") {
    if (!card) {
      const missing = mode === "missing";
      return `
        <section class="agent-original-card is-loading">
          <div class="agent-original-card-kicker">Original Website Card</div>
          <h3>${missing ? "找不到原始卡片" : "正在載入原始卡片..."}</h3>
          <p>${missing ? "這裡暫時顯示 memory row，代表 feed 與 memory 需要重新同步。" : "會優先顯示網站上那張卡片的完整資料；若找不到才顯示 memory row。"}</p>
        </section>
      `;
    }
    const title = card.title || source?.title || "原始卡片";
    const account = card.account || source?.account || "source";
    const type = card.card_type || source?.card_type || "memory";
    const published = card.published_at ? toLocalTime(card.published_at) : "--";
    const eventDate = card.timeline_date ? toLocalTime(card.timeline_date) : "";
    const cover = safeUrl(card.cover_image || "", "");
    const url = safeUrl(card.url || source?.url || "", "");
    const link = aggregatorCardLink(source, card);
    const bullets = Array.isArray(card.bullets)
      ? card.bullets.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const factHtml = sourceFactsHtml({ event_facts: card.event_facts || {} });
    const sections = uniqueTextEntries([
      { label: "一句話重點", value: card.glance || card.summary },
      { label: "簡要整理", value: card.summary },
      { label: "詳細整理", value: card.detail_summary },
      { label: "原文摘錄", value: card.raw_text },
    ]).slice(0, 4);
    return `
      <section class="agent-original-card">
        <div class="agent-original-card-top">
          <div>
            <div class="agent-original-card-kicker">Original Website Card</div>
            <h3>${escapeHtml(title)}</h3>
            <p>@${escapeHtml(account)} · ${escapeHtml(type)} · 發布 ${escapeHtml(published)}${eventDate ? ` · 事件 ${escapeHtml(eventDate)}` : ""}</p>
          </div>
          ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />` : ""}
        </div>
        ${sections.map((section) => `
          <div class="agent-original-card-section">
            <span>${escapeHtml(section.label)}</span>
            <p>${escapeHtml(compactText(section.value, section.label === "原文摘錄" ? 720 : 420))}</p>
          </div>
        `).join("")}
        ${bullets.length ? `<ul class="agent-original-card-bullets">${bullets.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
        ${factHtml}
        <div class="agent-original-card-actions">
          <a href="${escapeHtml(link)}"><iconify-icon icon="lucide:panel-top-open"></iconify-icon><span>在聚合器查看這張卡</span></a>
          ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:external-link"></iconify-icon><span>開啟原始來源</span></a>` : ""}
        </div>
      </section>
    `;
  }

  function renderMemoryEvidence(source, originalCard = null, mode = "") {
    const url = safeUrl(source?.url || "", "");
    const baseline = cardTextBaseline(originalCard);
    const memorySections = uniqueTextEntries([
      { label: "Memory 一句話", value: source?.summary },
      { label: "Memory 詳細依據", value: source?.detail_summary },
      { label: "Memory 原始線索", value: source?.raw_hint },
    ], baseline).slice(0, 3);
    const metaRows = [
      ["date_role", source?.date_role],
      ["event_group", source?.event_group_key],
      ["expires", source?.memory_expires_at ? toLocalTime(source.memory_expires_at) : ""],
      ["semantic", source?.semantic_score ? `${displayScore(source.semantic_score)}%` : ""],
    ].filter(([, value]) => String(value || "").trim());
    return `
      <section class="agent-source-evidence">
        <h3>Memory retrieval evidence</h3>
        ${mode === "missing-card" ? `<p class="agent-source-warning">找不到對應的網站卡片，這裡暫時顯示 memory row。這不是理想狀態，代表 feed 與 memory 需要重新同步。</p>` : ""}
        ${metaRows.length ? `<div class="agent-source-facts">${metaRows.map(([key, value]) => `
          <div class="agent-source-fact"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>
        `).join("")}</div>` : ""}
        ${sourceReasonHtml(source)}
        ${memorySections.map((section) => `
          <div class="agent-memory-section">
            <span>${escapeHtml(section.label)}</span>
            <p>${escapeHtml(compactText(section.value, 520))}</p>
          </div>
        `).join("")}
        ${sourceTagsHtml(source)}
        ${url ? `<a class="agent-source-open-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:external-link"></iconify-icon><span>開啟來源</span></a>` : ""}
      </section>
    `;
  }

  function openSourceModal(index) {
    const source = lastSources[index];
    const modal = document.getElementById("agent-source-modal");
    const titleEl = document.getElementById("agent-source-title");
    const metaEl = document.getElementById("agent-source-meta");
    const bodyEl = document.getElementById("agent-source-body");
    if (!source || !modal || !titleEl || !metaEl || !bodyEl) return;
    activeSourceId = sourceId(source);
    modal.dataset.sourceId = activeSourceId;
    const title = source.title || source.summary || source.id || "Memory source";
    titleEl.textContent = title;
    metaEl.innerHTML = `
      <span>@${escapeHtml(source.account || "source")}</span>
      <span>${escapeHtml(source.card_type || "memory")}</span>
      <span>${escapeHtml(sourceDate(source) ? toLocalTime(sourceDate(source)) : "--")}</span>
      <span>match ${displayScore(source.score)}%</span>
    `;
    bodyEl.innerHTML = `${renderOriginalCardPreview(null, source)}${renderMemoryEvidence(source, null)}`;
    modal.hidden = false;
    document.body.classList.add("agent-source-modal-open");
    loadAgentFeedCard(source)
      .then((card) => {
        if (modal.dataset.sourceId !== activeSourceId || activeSourceId !== sourceId(source)) return;
        bodyEl.innerHTML = `${renderOriginalCardPreview(card, source, card ? "" : "missing")}${renderMemoryEvidence(source, card, card ? "" : "missing-card")}`;
      })
      .catch(() => {
        if (modal.dataset.sourceId !== activeSourceId || activeSourceId !== sourceId(source)) return;
        bodyEl.innerHTML = `${renderOriginalCardPreview(null, source, "missing")}${renderMemoryEvidence(source, null, "missing-card")}`;
      });
  }

  function closeSourceModal() {
    const modal = document.getElementById("agent-source-modal");
    if (!modal) return;
    activeSourceId = "";
    delete modal.dataset.sourceId;
    modal.hidden = true;
    document.body.classList.remove("agent-source-modal-open");
  }

  async function askRenaissAgent(question) {
    const cleaned = String(question || "").trim();
    if (!cleaned) return;
    const submitBtn = document.getElementById("renaiss-agent-submit");
    const input = document.getElementById("renaiss-agent-input");
    const previousHistory = agentConversation.slice(-8);
    setChatActive(true);
    appendRenaissAgentMessage("user", cleaned);
    agentConversation.push({ role: "user", content: cleaned });
    renderRenaissAgentSources([]);
    setRenaissAgentStatus("Agent is reading memory...", "working");
    showTypingBubble();
    if (submitBtn) submitBtn.disabled = true;
    if (input) input.disabled = true;
    try {
      const data = await postJson("/api/intel/agent", {
        question: cleaned,
        history: previousHistory,
        lang: getUiLangTag(),
        top_k: 6,
      });
      removeTypingBubble();
      const answer = String(data?.answer || "目前沒有答案。");
      appendRenaissAgentMessage("assistant", answer);
      agentConversation.push({ role: "assistant", content: answer });
      while (agentConversation.length > 12) agentConversation.shift();
      renderRenaissAgentSources(data?.sources || []);
      const provider = formatProviderName(data?.stats?.agent_provider || "MiniMax");
      const count = Number(data?.stats?.source_count || (Array.isArray(data?.sources) ? data.sources.length : 0)) || 0;
      setRenaissAgentStatus(`${provider} · ${count} memory sources`, "ok");
    } catch (error) {
      removeTypingBubble();
      const message = String(error?.message || error || "agent_failed");
      appendRenaissAgentMessage("assistant", `Agent 暫時無法回答：${message}`);
      setRenaissAgentStatus(`Agent error: ${message}`, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (input) input.disabled = false;
      if (input) input.focus();
    }
  }

  function resetRenaissAgent() {
    agentConversation.length = 0;
    lastSources = [];
    removeTypingBubble();
    setChatActive(false);
    const messages = document.getElementById("renaiss-agent-messages");
    if (messages) {
      messages.innerHTML = `
        <div class="renaiss-agent-message is-assistant is-welcome">
          <div class="renaiss-agent-role">Renaiss Agent</div>
          <div class="renaiss-agent-bubble"><p>可以直接問近期活動、SBT、官方公告或卡片分類裡的資訊。</p></div>
        </div>
      `;
    }
    renderRenaissAgentSources([]);
    setRenaissAgentStatus("Agent ready.", "ok");
    const input = document.getElementById("renaiss-agent-input");
    if (input) {
      resizeAgentInput(input);
      input.focus();
    }
  }

  function setupRenaissAgent() {
    const form = document.getElementById("renaiss-agent-form");
    const input = document.getElementById("renaiss-agent-input");
    const submitBtn = document.getElementById("renaiss-agent-submit");
    if (!form || !input || form.dataset.boundRenaissAgent) return;
    form.dataset.boundRenaissAgent = "1";
    const disabled = location.protocol === "file:";
    resizeAgentInput(input);
    input.addEventListener("input", () => resizeAgentInput(input));
    if (disabled) {
      if (submitBtn) submitBtn.disabled = true;
      input.disabled = true;
      setRenaissAgentStatus("請用本地或線上 API 網址開啟 Agent。", "error");
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (disabled) return;
      const question = String(input.value || "").trim();
      if (!question) {
        setRenaissAgentStatus("請先輸入問題。", "error");
        input.focus();
        return;
      }
      input.value = "";
      resizeAgentInput(input);
      askRenaissAgent(question);
    });
    document.querySelectorAll("[data-agent-question]").forEach((btn) => {
      if (btn.dataset.boundAgentQuestion) return;
      btn.dataset.boundAgentQuestion = "1";
      btn.addEventListener("click", () => {
        if (disabled) return;
        const question = String(btn.getAttribute("data-agent-question") || btn.textContent || "").trim();
        input.value = question;
        resizeAgentInput(input);
        askRenaissAgent(question);
      });
    });
    document.querySelectorAll("[data-agent-reset]").forEach((btn) => {
      if (btn.dataset.boundAgentReset) return;
      btn.dataset.boundAgentReset = "1";
      btn.addEventListener("click", resetRenaissAgent);
    });
    document.querySelectorAll("[data-agent-focus]").forEach((btn) => {
      if (btn.dataset.boundAgentFocus) return;
      btn.dataset.boundAgentFocus = "1";
      btn.addEventListener("click", () => input.focus());
    });
    document.addEventListener("click", (event) => {
      const sourceBtn = event.target && event.target.closest ? event.target.closest("[data-agent-source-index]") : null;
      if (sourceBtn) {
        openSourceModal(Number(sourceBtn.getAttribute("data-agent-source-index") || 0));
        return;
      }
      if (event.target && event.target.closest && event.target.closest("[data-agent-source-close]")) {
        closeSourceModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSourceModal();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && document.activeElement === input) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }

  function setupRevealAnimation() {
    const nodes = Array.from(document.querySelectorAll(".observe"));
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("inview"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("inview");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });
    nodes.forEach((node) => observer.observe(node));
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== LANG_STORAGE_KEY) return;
    const select = document.getElementById("lang-select");
    const next = normalizeLangTag(event.newValue || "zh-Hant");
    if (select) select.value = next;
    document.documentElement.lang = next;
    applyStaticI18n();
  });

  document.addEventListener("DOMContentLoaded", () => {
    setupLanguageSwitcher();
    setupRevealAnimation();
    setupRenaissAgent();
  }, { once: true });
})();
