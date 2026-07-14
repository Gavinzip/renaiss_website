// Beginner Wiki renderer. CMS data is loaded from ai_intel_server.py when available,
// and the embedded static data remains the initial seed/fallback for local previews.
(function initBeginnerPage() {
  const LANG_KEY = "intel_ui_lang";
  const WIKI_LANGS = ["zh-Hant", "zh-Hans", "en", "ko"];
  let data = window.BEGINNER_GUIDE_STATIC || {};
  const contentEl = document.getElementById("beginner-md-content");
  const toolsEl = document.getElementById("beginner-tools-list");
  const faqEl = document.getElementById("beginner-faq-list");
  const coverWrap = document.getElementById("beginner-cover");
  const coverImg = document.getElementById("beginner-cover-img");
  const wikiSearchInput = document.getElementById("beginner-wiki-search-input");
  const wikiTopicGrid = document.getElementById("beginner-wiki-topic-grid");
  const wikiSearchEmpty = document.getElementById("beginner-wiki-search-empty");
  const wikiEntry = document.querySelector(".beginner-wiki-entry");
  const docsMain = document.getElementById("beginner-docs-main");
  const docsLayout = document.querySelector(".beginner-docs-layout");
  const docsNav = document.getElementById("beginner-docs-nav");
  const sidebarHome = document.querySelector(".beginner-sidebar-home");
  const sidebarToggle = document.getElementById("beginner-sidebar-toggle");
  const wikiMenuToggle = document.getElementById("beginner-wiki-menu-toggle");
  const wikiMenu = document.getElementById("beginner-wiki-menu");
  const wikiMegaGrid = document.getElementById("beginner-wiki-mega-grid");
  const wikiMenuLabel = document.getElementById("beginner-wiki-menu-label");
  const wikiMenuTitle = document.getElementById("beginner-wiki-menu-title");
  const wikiMenuOverview = document.getElementById("beginner-wiki-menu-overview");
  const wikiLoginBtn = document.getElementById("beginner-wiki-login-btn");
  const wikiEditorBtn = document.getElementById("beginner-wiki-editor-btn");
  const wikiLogoutBtn = document.getElementById("beginner-wiki-logout-btn");
  const wikiInlineToolbar = document.getElementById("beginner-wiki-inline-toolbar");
  const wikiInlineSave = document.getElementById("beginner-wiki-inline-save");
  const wikiInlineTranslateSave = document.getElementById("beginner-wiki-inline-translate-save");
  const wikiInlineExit = document.getElementById("beginner-wiki-inline-exit");
  const wikiInlineAddSection = document.getElementById("beginner-wiki-inline-add-section");
  const wikiInlineMessage = document.getElementById("beginner-wiki-inline-message");
  const wikiAuthModal = document.getElementById("beginner-wiki-auth-modal");
  const wikiAuthForm = document.getElementById("beginner-wiki-auth-form");
  const wikiAuthMessage = document.getElementById("beginner-wiki-auth-message");
  const wikiEditorModal = document.getElementById("beginner-wiki-editor-modal");
  const wikiEditorForm = document.getElementById("beginner-wiki-editor-form");
  const wikiEditorMessage = document.getElementById("beginner-wiki-editor-message");
  const wikiEditorMeta = document.getElementById("beginner-wiki-editor-meta");
  const wikiEditorLang = document.getElementById("beginner-wiki-editor-lang");
  const wikiEditorRefresh = document.getElementById("beginner-wiki-editor-refresh");
  const wikiEditorTranslateSave = document.getElementById("beginner-wiki-translate-save");
  const wikiEditTitle = document.getElementById("beginner-wiki-edit-title");
  const wikiEditSubtitle = document.getElementById("beginner-wiki-edit-subtitle");
  const wikiEditEyebrow = document.getElementById("beginner-wiki-edit-eyebrow");
  const wikiEditStats = document.getElementById("beginner-wiki-edit-stats");
  const wikiEditSectionsUi = document.getElementById("beginner-wiki-edit-sections-ui");
  const wikiEditToolsUi = document.getElementById("beginner-wiki-edit-tools-ui");
  const wikiEditFaqUi = document.getElementById("beginner-wiki-edit-faq-ui");
  const wikiAddStat = document.getElementById("beginner-wiki-add-stat");
  const wikiAddTool = document.getElementById("beginner-wiki-add-tool");
  const wikiAddFaq = document.getElementById("beginner-wiki-add-faq");
  const langSelect = document.getElementById("beginner-lang-select");
  const timelineEl = document.getElementById("beginner-scroll-timeline");
  const timelineItems = timelineEl ? Array.from(timelineEl.querySelectorAll("[data-beginner-anchor]")) : [];
  const SIDEBAR_COLLAPSED_KEY = "beginner_docs_sidebar_collapsed";
  const staticWikiSeed = window.BEGINNER_GUIDE_STATIC || {};
  let wikiInlineEditMode = false;

  const TIMELINE_KEYS = ["start", "sbt", "tcg", "tools", "faq"];
  const TIMELINE_LABELS = {
    "zh-Hant": { start: "開始", sbt: "SBT", tcg: "TCG", tools: "工具", faq: "FAQ", title: "快速導覽" },
    "zh-Hans": { start: "开始", sbt: "SBT", tcg: "TCG", tools: "工具", faq: "FAQ", title: "快速导览" },
    en: { start: "Start", sbt: "SBT", tcg: "TCG", tools: "Tools", faq: "FAQ", title: "Quick Nav" },
    ko: { start: "시작", sbt: "SBT", tcg: "TCG", tools: "도구", faq: "FAQ", title: "빠른 이동" },
  };
  const SIDEBAR_LABELS = {
    "zh-Hant": { guide: "分類", home: "攻略", homeSub: "Renaiss Wiki 總覽", collapse: "收合", expand: "展開", current: "正在學" },
    "zh-Hans": { guide: "分类", home: "攻略", homeSub: "Renaiss Wiki 总览", collapse: "收合", expand: "展开", current: "正在学" },
    en: { guide: "Categories", home: "Guide", homeSub: "Renaiss Wiki overview", collapse: "Collapse", expand: "Expand", current: "Learning" },
    ko: { guide: "분류", home: "공략", homeSub: "Renaiss Wiki 개요", collapse: "접기", expand: "펼치기", current: "학습 중" },
  };
  const SIDEBAR_GROUP_OPEN_KEY = "beginner_docs_sidebar_open_groups";
  const SIDEBAR_GROUP_ICONS = {
    Start: "lucide:compass",
    Quest: "lucide:badge-check",
    TCG: "lucide:layers-3",
    Help: "lucide:circle-help",
  };
  const WIKI_AUTH_TOKEN_KEY = "intel_admin_bearer_token_v1";
  const DEFAULT_WIKI_API_BASE = "https://renaiss.zeabur.app";
  const wikiCmsState = {
    auth: {
      ready: false,
      authenticated: false,
      authRequired: true,
      authConfigured: false,
      user: "",
      role: "",
      permissions: {},
    },
    meta: {},
    apiAvailable: true,
  };
  const WIKI_MENU_LABELS = {
    "zh-Hant": {
      label: "Wiki",
      title: "新手教學",
      overview: "總覽",
      groups: [
        ["入門", "Start", ["start", "packs", "market"]],
        ["鏈上任務", "Quest", ["sbt"]],
        ["卡牌與工具", "TCG", ["tcg", "tools"]],
        ["支援", "Help", ["faq"]],
      ],
    },
    "zh-Hans": {
      label: "Wiki",
      title: "新手教学",
      overview: "总览",
      groups: [
        ["入门", "Start", ["start", "packs", "market"]],
        ["链上任务", "Quest", ["sbt"]],
        ["卡牌与工具", "TCG", ["tcg", "tools"]],
        ["支持", "Help", ["faq"]],
      ],
    },
    en: {
      label: "Wiki",
      title: "Beginner Guide",
      overview: "Overview",
      groups: [
        ["Getting Started", "Start", ["start", "packs", "market"]],
        ["On-chain Tasks", "Quest", ["sbt"]],
        ["Cards & Tools", "TCG", ["tcg", "tools"]],
        ["Support", "Help", ["faq"]],
      ],
    },
    ko: {
      label: "Wiki",
      title: "초보자 가이드",
      overview: "개요",
      groups: [
        ["시작", "Start", ["start", "packs", "market"]],
        ["온체인 과제", "Quest", ["sbt"]],
        ["카드와 도구", "TCG", ["tcg", "tools"]],
        ["지원", "Help", ["faq"]],
      ],
    },
  };

  const WIKI_TOPICS = {
    "zh-Hant": [
      ["開始使用", "錢包、註冊、充值前先看這裡", "beginner-anchor-start", "lucide:route"],
      ["抽卡與回購", "限時卡池、無限卡機、FMV 時間窗", "beginner-wiki-section-2", "lucide:package-open"],
      ["Marketplace", "買賣、Bid、List、Trade 與積分", "beginner-wiki-section-4", "lucide:store"],
      ["SBT", "目前還能完成的新手任務", "beginner-anchor-sbt", "lucide:badge-check"],
      ["TCG 基礎", "寶可夢、海賊王、評級與查價", "beginner-anchor-tcg", "lucide:library-big"],
      ["工具", "社群工具與 TCG Pro 指令", "beginner-anchor-tools", "lucide:wrench"],
      ["FAQ", "真卡、金庫、回購、FMV 常見問題", "beginner-anchor-faq", "lucide:help-circle"],
    ],
    "zh-Hans": [
      ["开始使用", "钱包、注册、充值前先看这里", "beginner-anchor-start", "lucide:route"],
      ["抽卡与回购", "限时卡池、无限卡机、FMV 时间窗", "beginner-wiki-section-2", "lucide:package-open"],
      ["Marketplace", "买卖、Bid、List、Trade 与积分", "beginner-wiki-section-4", "lucide:store"],
      ["SBT", "目前还能完成的新手任务", "beginner-anchor-sbt", "lucide:badge-check"],
      ["TCG 基础", "宝可梦、海贼王、评级与查价", "beginner-anchor-tcg", "lucide:library-big"],
      ["工具", "社群工具与 TCG Pro 指令", "beginner-anchor-tools", "lucide:wrench"],
      ["FAQ", "真卡、金库、回购、FMV 常见问题", "beginner-anchor-faq", "lucide:help-circle"],
    ],
    en: [
      ["Start Here", "Wallet, login, and funding basics", "beginner-anchor-start", "lucide:route"],
      ["Packs", "Limited pools, machines, and FMV windows", "beginner-wiki-section-2", "lucide:package-open"],
      ["Marketplace", "Buying, bidding, listing, trading, and points", "beginner-wiki-section-4", "lucide:store"],
      ["SBT", "Available beginner achievements", "beginner-anchor-sbt", "lucide:badge-check"],
      ["TCG Basics", "Pokemon, One Piece, grading, and pricing", "beginner-anchor-tcg", "lucide:library-big"],
      ["Tools", "Community tools and TCG Pro commands", "beginner-anchor-tools", "lucide:wrench"],
      ["FAQ", "Physical cards, custody, buyback, and FMV", "beginner-anchor-faq", "lucide:help-circle"],
    ],
    ko: [
      ["시작하기", "지갑, 로그인, 입금 기본", "beginner-anchor-start", "lucide:route"],
      ["팩과 바이백", "한정 풀, 머신, FMV 시간", "beginner-wiki-section-2", "lucide:package-open"],
      ["Marketplace", "구매, 입찰, 등록, 거래와 포인트", "beginner-wiki-section-4", "lucide:store"],
      ["SBT", "현재 가능한 초보자 업적", "beginner-anchor-sbt", "lucide:badge-check"],
      ["TCG 기초", "포켓몬, 원피스, 등급, 가격", "beginner-anchor-tcg", "lucide:library-big"],
      ["도구", "커뮤니티 도구와 TCG Pro 명령", "beginner-anchor-tools", "lucide:wrench"],
      ["FAQ", "실물 카드, 보관, 바이백, FMV", "beginner-anchor-faq", "lucide:help-circle"],
    ],
  };

  const WIKI_SEARCH_LABELS = {
    "zh-Hant": {
      placeholder: "搜尋錢包、充值、SBT、Marketplace...",
      empty: "沒有符合的教學段落，換一個關鍵字試試。",
    },
    "zh-Hans": {
      placeholder: "搜索钱包、充值、SBT、Marketplace...",
      empty: "没有符合的教学段落，换一个关键词试试。",
    },
    en: {
      placeholder: "Search wallet, funding, SBT, Marketplace...",
      empty: "No matching guide section. Try another keyword.",
    },
    ko: {
      placeholder: "지갑, 입금, SBT, Marketplace 검색...",
      empty: "일치하는 가이드 섹션이 없습니다. 다른 키워드를 입력해 보세요.",
    },
  };

  const TOPIC_SECTION_INDEXES = {
    start: [0, 1],
    packs: [2, 3],
    market: [4],
    sbt: [5],
    tcg: [6, 7, 8, 9, 10],
    tools: [],
    faq: [],
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function editAttr(field, extra = "") {
    if (!wikiInlineEditMode) return "";
    return ` contenteditable="true" spellcheck="true" data-wiki-field="${escapeHtml(field)}"${extra}`;
  }

  function editLabelAttr(field) {
    if (!wikiInlineEditMode) return "";
    return ` contenteditable="true" spellcheck="true" data-wiki-label-field="${escapeHtml(field)}"`;
  }

  function setEditableText(el, text, attrName, attrValue) {
    if (!el) return;
    el.textContent = text || "";
    if (wikiInlineEditMode && attrName && attrValue) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.setAttribute(attrName, attrValue);
    } else {
      el.removeAttribute("contenteditable");
      el.removeAttribute("spellcheck");
      if (attrName) el.removeAttribute(attrName);
    }
  }

  function inlineTextValue(root, selector) {
    const node = root ? root.querySelector(selector) : null;
    return String(node ? node.textContent || "" : "").trim();
  }

  function cleanInlineText(node) {
    if (!node) return "";
    if (!(node instanceof HTMLElement)) return String(node.textContent || "").trim();
    const clone = node.cloneNode(true);
    clone.querySelectorAll("[contenteditable='false'], .wiki-inline-list-controls, .wiki-inline-section-controls").forEach((child) => child.remove());
    return String(clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function topicForSectionIndex(index) {
    for (const [topicId, indexes] of Object.entries(TOPIC_SECTION_INDEXES)) {
      if (indexes.includes(Number(index))) return topicId;
    }
    return "start";
  }

  function sectionTopic(section, index) {
    const raw = String(section && section.topic || "").trim().toLowerCase();
    if (raw && Object.prototype.hasOwnProperty.call(TOPIC_SECTION_INDEXES, raw)) return raw;
    return topicForSectionIndex(index);
  }

  function sectionTypeOptions(activeType) {
    return [
      ["intro", "文字說明"],
      ["steps", "步驟"],
      ["imageText", "圖文"],
      ["cards", "重點卡"],
      ["sbtChecklist", "SBT 任務"],
      ["ratings", "評級卡"],
    ].map(([value, label]) => `<option value="${value}" ${String(activeType) === value ? "selected" : ""}>${label}</option>`).join("");
  }

  function topicOptions(activeTopic) {
    return [
      ["start", "入門"],
      ["packs", "抽卡與回購"],
      ["market", "Marketplace"],
      ["sbt", "鏈上任務"],
      ["tcg", "卡牌與工具"],
    ].map(([value, label]) => `<option value="${value}" ${String(activeTopic) === value ? "selected" : ""}>${label}</option>`).join("");
  }

  function inlineControlsHtml(section, index) {
    if (!wikiInlineEditMode) return "";
    const type = String(section && section.type || "intro");
    const activeTopic = sectionTopic(section, index);
    const imageControls = ["imageText", "ratings"].includes(type)
      ? `
        <label>
          <span>圖片</span>
          <input data-wiki-section-image type="number" min="0" step="1" value="${escapeHtml(section.image ?? 0)}" />
        </label>
        <label>
          <span>圖片網址</span>
          <input data-wiki-section-image-url type="url" value="${escapeHtml(section.imageUrl || section.image_url || "")}" placeholder="https://..." />
        </label>
        <label>
          <span>圖片位置</span>
          <select data-wiki-section-layout>
            ${[
              ["image-left", "圖左文右"],
              ["image-right", "圖右文左"],
              ["image-top", "圖上文下"],
            ].map(([value, label]) => `<option value="${value}" ${String(section.layout || "image-left") === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      `
      : "";
    return `
      <div class="wiki-inline-section-controls" contenteditable="false">
        <span>段落 ${String(index + 1).padStart(2, "0")} / ${escapeHtml(type)}</span>
        <label>
          <span>分類</span>
          <select data-wiki-section-topic>${topicOptions(activeTopic)}</select>
        </label>
        <label>
          <span>段落版型</span>
          <select data-wiki-section-type-control>${sectionTypeOptions(type)}</select>
        </label>
        ${imageControls}
        <button type="button" class="wiki-creator-btn" data-wiki-section-move="up">上移</button>
        <button type="button" class="wiki-creator-btn" data-wiki-section-move="down">下移</button>
        <button type="button" class="wiki-creator-btn" data-wiki-section-remove>刪除</button>
      </div>
    `;
  }

  function inlineAddRemoveControls(kind) {
    if (!wikiInlineEditMode) return "";
    return `
      <div class="wiki-inline-list-controls" contenteditable="false">
        <button type="button" class="wiki-creator-btn" data-wiki-list-add="${escapeHtml(kind)}">新增</button>
      </div>
    `;
  }

  function inlineRemoveButton() {
    return wikiInlineEditMode
      ? `<button type="button" class="wiki-inline-remove" data-wiki-item-remove contenteditable="false">移除</button>`
      : "";
  }

  function textListItemHtml(value = "") {
    return `
      <span data-wiki-list-item>
        <span class="wiki-inline-list-text" ${editAttr("listItem")}>${escapeHtml(value)}</span>
        ${inlineRemoveButton()}
      </span>
    `;
  }

  function pairItemHtml(title = "", body = "", className = "beginner-info-card") {
    return `
      <article class="${escapeHtml(className)}" data-wiki-pair-item>
        <h3 ${editAttr("pairTitle")}>${escapeHtml(title)}</h3>
        <p ${editAttr("pairBody")}>${escapeHtml(body)}</p>
        ${inlineRemoveButton()}
      </article>
    `;
  }

  function normalizeApiBase(raw) {
    return String(raw || "").trim().replace(/\/+$/g, "");
  }

  function isLocalHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  }

  function uniqueList(values) {
    const seen = new Set();
    return values.filter((value) => {
      const normalized = normalizeApiBase(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function explicitWikiApiBase() {
    const search = new URLSearchParams(window.location.search || "");
    const fromQuery = normalizeApiBase(search.get("intel_api_base") || search.get("wiki_api_base") || "");
    if (fromQuery) {
      try {
        localStorage.setItem("intel_api_base", fromQuery);
      } catch (_error) {}
      return fromQuery;
    }
    const fromWindow = normalizeApiBase(window.INTEL_API_BASE || window.__INTEL_API_BASE__ || window.__WIKI_API_BASE__ || "");
    if (fromWindow) return fromWindow;
    try {
      return normalizeApiBase(localStorage.getItem("intel_api_base") || "");
    } catch (_error) {}
    return "";
  }

  function wikiApiBaseCandidates() {
    const explicit = explicitWikiApiBase();
    if (explicit) return [explicit];
    const origin = normalizeApiBase(window.location.origin || "");
    if (isLocalHost(window.location.hostname)) {
      return uniqueList([origin, "http://127.0.0.1:8787", DEFAULT_WIKI_API_BASE]);
    }
    return uniqueList([DEFAULT_WIKI_API_BASE]);
  }

  const WIKI_API_BASE_CANDIDATES = wikiApiBaseCandidates();
  let activeWikiApiBase = WIKI_API_BASE_CANDIDATES[0] || DEFAULT_WIKI_API_BASE;

  function wikiApiUrl(path) {
    const tail = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
    return `${activeWikiApiBase}${tail}`;
  }

  function readWikiAuthToken() {
    try {
      return String(localStorage.getItem(WIKI_AUTH_TOKEN_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function saveWikiAuthToken(token) {
    const value = String(token || "").trim();
    if (!value) return;
    try {
      localStorage.setItem(WIKI_AUTH_TOKEN_KEY, value);
    } catch (_error) {}
  }

  function clearWikiAuthToken() {
    try {
      localStorage.removeItem(WIKI_AUTH_TOKEN_KEY);
    } catch (_error) {}
  }

  function wikiAuthHeaders(base = {}) {
    const headers = { ...(base || {}) };
    const token = readWikiAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function cloneData(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_error) {
      return {};
    }
  }

  function mergeWikiData(seed, incoming) {
    const merged = cloneData(seed);
    const cms = incoming && typeof incoming === "object" ? incoming : {};
    Object.entries(cms).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      merged[key] = value;
    });
    return merged;
  }

  function setWikiMessage(el, text, mode) {
    if (!el) return;
    const value = String(text || "").trim();
    el.hidden = !value;
    el.textContent = value;
    el.classList.toggle("is-error", mode === "error");
    el.classList.toggle("is-ok", mode === "ok");
  }

  function renderInline(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/==([^=]+)==/g, '<span class="beginner-inline-rainbow">$1</span>');
  }

  function renderSbtIntroTitle(value) {
    const raw = String(value || "");
    if (!raw) return "";
    const escaped = escapeHtml(raw);
    return escaped.replace(/\bSBT\b/, '<span class="beginner-sbt-title-accent">SBT</span>');
  }

  const CARD_SEARCH_HIGHLIGHT_PHRASES = [
    "Discord 的 card-search 頻道直接上傳卡圖",
    "Discord 的 card-search 频道直接上传卡图",
    "Upload a card image in Discord card-search",
    "Upload a card image directly in the Discord card-search channel",
    "Discord의 card-search 채널에 카드 이미지를 직접 업로드",
    "Discord card-search 채널에 카드 이미지를 올리면",
  ];

  function renderCardSearchHighlight(value) {
    const raw = String(value || "");
    if (!raw) return "";
    for (const phrase of CARD_SEARCH_HIGHLIGHT_PHRASES) {
      if (!raw.includes(phrase)) continue;
      return raw
        .split(phrase)
        .map((chunk, index, list) => {
          const tail = index < list.length - 1
            ? `<span class="beginner-inline-rainbow beginner-cardsearch-highlight">${escapeHtml(phrase)}</span>`
            : "";
          return `${escapeHtml(chunk)}${tail}`;
        })
        .join("");
    }
    return escapeHtml(raw).replace(/card-search/gi, (token) => `<span class="beginner-inline-rainbow beginner-cardsearch-highlight">${token}</span>`);
  }

  function sectionAnchorId(section) {
    const type = String(section && section.type || "").trim();
    if (type === "sbtChecklist") return "beginner-anchor-sbt";
    const title = String(section && section.title || "").trim();
    if (type === "intro" && /(?:^|\s)TCG(?:\s|$)|基礎|基础|Basics|기초/i.test(title)) return "beginner-anchor-tcg";
    return "";
  }

  function normalizeLang(raw) {
    const value = String(raw || "").trim();
    if (["zh-Hant", "zh-TW", "zh-HK", "zh-MO", "繁體中文"].includes(value)) return "zh-Hant";
    if (["zh-Hans", "zh-CN", "zh-SG", "简体中文"].includes(value)) return "zh-Hans";
    if (value === "en" || value.startsWith("en-")) return "en";
    if (value === "ko" || value.startsWith("ko-")) return "ko";
    return "zh-Hant";
  }

  function currentLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored) return normalizeLang(stored);
    } catch (_error) {}
    return normalizeLang(document.documentElement.lang || navigator.language || "zh-Hant");
  }

  function saveLang(lang) {
    const tag = normalizeLang(lang);
    document.documentElement.lang = tag;
    if (langSelect) langSelect.value = tag;
    try {
      localStorage.setItem(LANG_KEY, tag);
    } catch (_error) {}
    return tag;
  }

  function labelsFor(lang) {
    return (data.labels && (data.labels[lang] || data.labels["zh-Hant"])) || {};
  }

  function localized(value, lang, fallback) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value[lang] || value["zh-Hant"] || value.en || fallback || "";
    }
    return value || fallback || "";
  }

  function guideFor(lang) {
    return (data.guides && (data.guides[lang] || data.guides["zh-Hant"])) || { sections: [], stats: [] };
  }

  function topicIdForAnchor(anchor) {
    const value = String(anchor || "");
    if (value === "beginner-anchor-start") return "start";
    if (value === "beginner-wiki-section-2") return "packs";
    if (value === "beginner-wiki-section-4") return "market";
    if (value === "beginner-anchor-sbt") return "sbt";
    if (value === "beginner-anchor-tcg") return "tcg";
    if (value === "beginner-anchor-tools") return "tools";
    if (value === "beginner-anchor-faq") return "faq";
    return "start";
  }

  function currentTopic() {
    const raw = new URLSearchParams(window.location.search).get("topic");
    const topic = String(raw || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(TOPIC_SECTION_INDEXES, topic) ? topic : "";
  }

  function topicUrl(topicId) {
    const url = new URL(window.location.href);
    if (topicId) {
      url.searchParams.set("topic", topicId);
    } else {
      url.searchParams.delete("topic");
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function anchorForTopicId(topicId, lang = currentLang()) {
    const row = topicRowById(lang, topicId);
    return row ? row[2] : "";
  }

  function scrollToTopicAnchor(topicId) {
    const anchorId = anchorForTopicId(topicId);
    const target = anchorId ? document.getElementById(anchorId) : document.getElementById("beginner-anchor-start");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToGuideTop(behavior) {
    window.scrollTo({ top: 0, behavior });
  }

  function commitTopicChange(nextTopic, method, shouldScroll) {
    window.history[method]({ beginnerTopic: nextTopic }, "", topicUrl(nextTopic));
    renderStaticPage(currentLang());
    if (shouldScroll) {
      window.requestAnimationFrame(() => scrollToGuideTop("auto"));
    }
  }

  function navigateTopic(topicId, options) {
    const nextTopic = Object.prototype.hasOwnProperty.call(TOPIC_SECTION_INDEXES, topicId) ? topicId : "";
    const method = options && options.replace ? "replaceState" : "pushState";
    const shouldScroll = !options || options.scroll !== false;
    if (currentTopic() !== nextTopic) {
      commitTopicChange(nextTopic, method, shouldScroll);
      return;
    }
    if (shouldScroll) window.requestAnimationFrame(() => scrollToGuideTop("auto"));
  }

  function isSidebarCollapsed() {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function setSidebarCollapsed(collapsed, persist) {
    const labels = SIDEBAR_LABELS[currentLang()] || SIDEBAR_LABELS["zh-Hant"];
    if (docsLayout) docsLayout.classList.toggle("is-sidebar-collapsed", collapsed);
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      sidebarToggle.setAttribute("aria-label", collapsed ? labels.expand : labels.collapse);
      sidebarToggle.innerHTML = `<iconify-icon icon="${collapsed ? "lucide:panel-left-open" : "lucide:panel-left-close"}"></iconify-icon><span>${escapeHtml(collapsed ? labels.expand : labels.collapse)}</span>`;
    }
    if (persist) {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
      } catch (_error) {}
    }
  }

  function setWikiMenuOpen(open, options) {
    if (!wikiMenu || !wikiMenuToggle) return;
    window.clearTimeout(setWikiMenuOpen.closeTimer);
    wikiMenuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    wikiMenuToggle.classList.toggle("is-open", open);
    if (open) {
      wikiMenu.hidden = false;
      window.requestAnimationFrame(() => wikiMenu.classList.add("is-open"));
      return;
    }
    wikiMenu.classList.remove("is-open");
    if (options && options.immediate) {
      wikiMenu.hidden = true;
      return;
    }
    setWikiMenuOpen.closeTimer = window.setTimeout(() => {
      wikiMenu.hidden = true;
    }, 180);
  }
  setWikiMenuOpen.closeTimer = 0;

  function handleTopicLinkClick(event) {
    const link = event.target && event.target.closest ? event.target.closest("[data-topic-id]") : null;
    if (!link) return;
    if (wikiInlineEditMode && event.target.closest("[contenteditable='true'], input, textarea, select, button")) return;
    event.preventDefault();
    setWikiMenuOpen(false, { immediate: true });
    const topicId = String(link.getAttribute("data-topic-id") || "").trim();
    if (wikiInlineEditMode) {
      scrollToTopicAnchor(topicId);
      return;
    }
    navigateTopic(topicId);
  }

  function handleSidebarGroupToggle(event) {
    const button = event.target && event.target.closest ? event.target.closest("[data-sidebar-group-toggle]") : null;
    if (!button || !docsNav || !docsNav.contains(button)) return false;
    if (wikiInlineEditMode && event.target.closest("[contenteditable='true'], input, textarea, select")) return true;
    event.preventDefault();
    const groupId = String(button.getAttribute("data-sidebar-group-toggle") || "");
    const group = button.closest("[data-sidebar-group-id]");
    setSidebarGroupOpen(groupId, !(group && group.classList.contains("is-open")), true);
    return true;
  }

  function topicRowsFor(lang) {
    const staticRows = WIKI_TOPICS[lang] || WIKI_TOPICS["zh-Hant"];
    const cmsRows = data.topics && (data.topics[lang] || data.topics["zh-Hant"]);
    const rows = Array.isArray(cmsRows) && cmsRows.length ? cmsRows : staticRows;
    return rows
      .map((row, index) => {
        if (Array.isArray(row)) {
          return [row[0] || "", row[1] || "", row[2] || "", row[3] || "lucide:file-text", row[4] || topicIdForAnchor(row[2]) || `topic-${index}`];
        }
        if (!row || typeof row !== "object") return null;
        const anchor = String(row.anchor || row.target || "").trim();
        const id = String(row.id || topicIdForAnchor(anchor) || `topic-${index}`).trim();
        return [
          String(row.title || row.name || ""),
          String(row.subtitle || row.description || ""),
          anchor || anchorForKnownTopic(id),
          String(row.icon || "lucide:file-text"),
          id,
        ];
      })
      .filter(Boolean);
  }

  function anchorForKnownTopic(topicId) {
    const anchors = {
      start: "beginner-anchor-start",
      packs: "beginner-wiki-section-2",
      market: "beginner-wiki-section-4",
      sbt: "beginner-anchor-sbt",
      tcg: "beginner-anchor-tcg",
      tools: "beginner-anchor-tools",
      faq: "beginner-anchor-faq",
    };
    return anchors[String(topicId || "")] || "";
  }

  function menuLabelsFor(lang) {
    const fallback = WIKI_MENU_LABELS[lang] || WIKI_MENU_LABELS["zh-Hant"];
    const cms = data.menuLabels && (data.menuLabels[lang] || data.menuLabels["zh-Hant"]);
    if (!cms || typeof cms !== "object") return fallback;
    const fallbackGroups = Array.isArray(fallback.groups) ? fallback.groups : [];
    const groups = Array.isArray(cms.groups) && cms.groups.length
      ? cms.groups.map((group, index) => {
        if (Array.isArray(group)) return [group[0] || "", group[1] || "", Array.isArray(group[2]) ? group[2] : [], group[3] || ""];
        const fallbackGroup = fallbackGroups[index] || [];
        return [
          String(group.title || group.name || fallbackGroup[0] || ""),
          String(group.kicker || group.label || fallbackGroup[1] || ""),
          Array.isArray(group.ids) ? group.ids.map(String) : (Array.isArray(fallbackGroup[2]) ? fallbackGroup[2] : []),
          String(group.icon || fallbackGroup[3] || ""),
        ];
      })
      : fallbackGroups;
    return {
      label: String(cms.label || fallback.label || "Wiki"),
      title: String(cms.title || fallback.title || ""),
      overview: String(cms.overview || fallback.overview || ""),
      groups,
    };
  }

  function sidebarGroupId(group, index) {
    const key = String((Array.isArray(group) && group[1]) || index || "");
    return key.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `group-${index}`;
  }

  function sidebarGroupIcon(group) {
    if (Array.isArray(group) && group[3]) return String(group[3]);
    const key = String((Array.isArray(group) && group[1]) || "");
    return SIDEBAR_GROUP_ICONS[key] || "lucide:folder";
  }

  function readOpenSidebarGroups() {
    try {
      const raw = localStorage.getItem(SIDEBAR_GROUP_OPEN_KEY);
      const values = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(values) ? values.map(String) : []);
    } catch (_error) {
      return new Set();
    }
  }

  function writeOpenSidebarGroups(openGroups) {
    try {
      localStorage.setItem(SIDEBAR_GROUP_OPEN_KEY, JSON.stringify(Array.from(openGroups)));
    } catch (_error) {}
  }

  function setSidebarGroupOpen(groupId, open, persist) {
    if (!docsNav) return;
    const group = docsNav.querySelector(`[data-sidebar-group-id="${groupId}"]`);
    if (!group) return;
    const button = group.querySelector("[data-sidebar-group-toggle]");
    const panel = group.querySelector(".beginner-sidebar-group-panel");
    group.classList.toggle("is-open", open);
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
    if (panel) panel.setAttribute("aria-hidden", open ? "false" : "true");
    group.querySelectorAll("[data-topic-id]").forEach((link) => {
      if (link instanceof HTMLElement) link.tabIndex = open ? 0 : -1;
    });
    if (!persist) return;
    const openGroups = readOpenSidebarGroups();
    if (open) {
      openGroups.add(groupId);
    } else {
      openGroups.delete(groupId);
    }
    writeOpenSidebarGroups(openGroups);
  }

  function topicRowById(lang, topicId) {
    return topicRowsFor(lang).find((row) => (row[4] || topicIdForAnchor(row[2])) === topicId) || null;
  }

  function sectionDomId(section, index) {
    return sectionAnchorId(section) || `beginner-wiki-section-${index}`;
  }

  function sectionSearchText(section) {
    const parts = [
      section && section.title,
      section && section.text,
      section && section.intro,
      section && section.introTitle,
    ];
    if (Array.isArray(section && section.bullets)) parts.push(...section.bullets);
    if (Array.isArray(section && section.primer)) {
      section.primer.forEach((row) => parts.push(...(Array.isArray(row) ? row : [])));
    }
    if (Array.isArray(section && section.items)) {
      section.items.forEach((row) => parts.push(...(Array.isArray(row) ? row : [])));
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function imageHtml(index, alt, modifier, explicitSrc = "") {
    const src = explicitSrc || (Array.isArray(data.images) ? data.images[index] : "");
    if (!src) return "";
    const className = ["beginner-static-media", modifier].filter(Boolean).join(" ");
    return `<figure class="${className}"><img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(alt || "Renaiss guide")}" /></figure>`;
  }

  function sbtDifficultyStars(difficulty) {
    return Array.from({ length: 5 }, (_, index) => {
      const filled = index < difficulty;
      return `<span class="${filled ? "is-filled" : "is-empty"}" aria-hidden="true">${filled ? "★" : "☆"}</span>`;
    }).join("");
  }

  function sbtIconSrc(file, base) {
    if (/^(?:https?:)?\/\//i.test(file)) return file;
    return `${base}${file}`;
  }

  function localizedMap(values, lang, fallback = "") {
    if (values && typeof values === "object" && !Array.isArray(values)) {
      return String(values[lang] || values["zh-Hant"] || values.en || fallback || "");
    }
    return String(values || fallback || "");
  }

  function staticSbtItems() {
    const rows = Array.isArray(window.RENAISS_SBT_CATALOG) ? window.RENAISS_SBT_CATALOG : [];
    const reqs = data.sbtRequirements || staticWikiSeed.sbtRequirements || {};
    return rows.map((row) => {
      const name = {};
      const requirement = {};
      const badge = {};
      WIKI_LANGS.forEach((tag) => {
        name[tag] = String(row.name || "");
        requirement[tag] = String(reqs[tag]?.[row.name] || row.requirement || "");
        badge[tag] = String(row.badge || (row.status === "available" ? "✅ Available" : row.status || ""));
      });
      return {
        key: String(row.name || ""),
        name,
        requirement,
        badge,
        status: String(row.status || "available"),
        difficulty: Number(row.difficulty) || 0,
        icons: Array.isArray(row.icons) ? row.icons.map((icon) => String(icon || "").trim()).filter(Boolean) : [],
      };
    });
  }

  function sbtItemsData() {
    const rows = Array.isArray(data.sbtItems) && data.sbtItems.length ? data.sbtItems : staticSbtItems();
    return rows
      .filter((row) => row && typeof row === "object")
      .map((row) => ({
        key: String(row.key || localizedMap(row.name, "zh-Hant") || row.name || ""),
        name: row.name && typeof row.name === "object" && !Array.isArray(row.name)
          ? row.name
          : Object.fromEntries(WIKI_LANGS.map((tag) => [tag, String(row.name || row.key || "")])),
        requirement: row.requirement && typeof row.requirement === "object" && !Array.isArray(row.requirement)
          ? row.requirement
          : Object.fromEntries(WIKI_LANGS.map((tag) => [tag, String(row.requirement || "")])),
        badge: row.badge && typeof row.badge === "object" && !Array.isArray(row.badge)
          ? row.badge
          : Object.fromEntries(WIKI_LANGS.map((tag) => [tag, String(row.badge || "")])),
        status: String(row.status || "available"),
        difficulty: Number(row.difficulty) || 0,
        icons: Array.isArray(row.icons) ? row.icons.map((icon) => String(icon || "").trim()).filter(Boolean) : [],
      }));
  }

  function sbtStatusOptions(activeStatus) {
    return [
      ["available", "Available"],
      ["invite", "Invite"],
      ["closed", "Closed"],
      ["event", "Event"],
      ["unknown", "Unknown"],
    ].map(([value, label]) => `<option value="${value}" ${String(activeStatus || "available") === value ? "selected" : ""}>${label}</option>`).join("");
  }

  function renderSbtChecklistInner(lang) {
    const labels = labelsFor(lang);
    const rows = sbtItemsData().filter((row) => wikiInlineEditMode || row.status === "available");
    const base = typeof sbtIconBase !== "undefined" ? sbtIconBase : "";
    const difficultyLabel = labels.difficultyLabel || "難度";
    const items = rows.map((row, index) => {
      const difficulty = Math.max(0, Math.min(5, Number(row.difficulty) || 0));
      const difficultyHtml = difficulty
        ? `<span class="sbt-difficulty" aria-label="${escapeHtml(difficultyLabel)} ${difficulty} / 5"><span class="sbt-difficulty-label">${escapeHtml(difficultyLabel)}</span><span class="sbt-stars">${sbtDifficultyStars(difficulty)}</span></span>`
        : "";
      const iconsHtml = (row.icons || []).map((file) => {
        const src = sbtIconSrc(file, base);
        return `<a class="sbt-thumb" href="${escapeHtml(src)}" target="_blank" rel="noreferrer"><img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(localizedMap(row.name, lang, row.key))}" /></a>`;
      }).join("");
      const name = localizedMap(row.name, lang, row.key);
      const requirement = localizedMap(row.requirement, lang, "");
      const badge = localizedMap(row.badge, lang, row.status === "available" ? "✅ Available" : row.status);
      return `
        <article class="sbt-item ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}" data-wiki-sbt-item data-wiki-sbt-index="${index}">
          <div class="sbt-item-icons">${iconsHtml}</div>
          <div class="sbt-item-main">
            <div class="sbt-item-top">
              <div class="sbt-item-name" ${editAttr("sbtName")}>${escapeHtml(name)}</div>
              <div class="sbt-item-badges">
                ${difficultyHtml}
                <span class="status ${row.status === "available" ? "s-on" : "s-off"}" ${editAttr("sbtBadge")}>${escapeHtml(badge)}</span>
              </div>
            </div>
            <p class="sbt-item-req" ${editAttr("sbtRequirement")}>${escapeHtml(requirement)}</p>
            ${wikiInlineEditMode ? `
              <div class="wiki-inline-sbt-controls" contenteditable="false">
                <label class="wiki-inline-link-field">
                  <span>狀態</span>
                  <select data-wiki-sbt-field="status">${sbtStatusOptions(row.status)}</select>
                </label>
                <label class="wiki-inline-link-field">
                  <span>難度</span>
                  <input data-wiki-sbt-field="difficulty" type="number" min="0" max="5" step="1" value="${escapeHtml(difficulty)}" />
                </label>
                <label class="wiki-inline-sbt-icons">
                  <span>Icons</span>
                  <textarea data-wiki-sbt-field="icons" rows="2" placeholder="每行一個檔名或圖片網址">${escapeHtml((row.icons || []).join("\n"))}</textarea>
                </label>
              </div>
              ${inlineRemoveButton()}
            ` : ""}
          </div>
        </article>
      `;
    }).join("");
    return `
      <div id="sbt-beginner-groups" class="sbt-groups sbt-groups-top beginner-inline-sbt" aria-hidden="false">
        <article class="sbt-group">
          <div class="sbt-group-head">
            <div class="sbt-group-title">✅ 還能得到 | Available</div>
            <div id="sbt-available-count" class="status s-soon"><iconify-icon icon="lucide:clock-3"></iconify-icon>${rows.length} ${labels.items || "items"}</div>
          </div>
          <div id="sbt-available-list" class="sbt-list">${items}${wikiInlineEditMode ? `<button type="button" class="wiki-inline-add-card" data-wiki-sbt-add contenteditable="false">新增 SBT</button>` : ""}</div>
        </article>
      </div>
    `;
  }

  function renderSection(section, index) {
    const type = String(section && section.type || "intro");
    const rawTitle = section && section.title || "";
    const title = wikiInlineEditMode ? escapeHtml(rawTitle) : escapeHtml(rawTitle);
    const anchorId = sectionDomId(section, index);
    const layout = String(section && section.layout || "image-left");
    const inlineClass = wikiInlineEditMode ? " is-wiki-inline-section" : "";
    const anchorAttr = ` id="${escapeHtml(anchorId)}" data-beginner-anchor-target="1" data-beginner-search="${escapeHtml(sectionSearchText(section))}" data-wiki-section-index="${index}" data-wiki-section-type="${escapeHtml(type)}"`;
    const kicker = `<div class="beginner-section-kicker">${String(index + 1).padStart(2, "0")}</div>`;
    if (type === "intro") {
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];
      return `
        <section${anchorAttr} class="beginner-static-section beginner-static-intro${inlineClass}">
          ${inlineControlsHtml(section, index)}
          ${kicker}
          <h2 ${editAttr("title")}>${title}</h2>
          <p ${editAttr("text")}>${wikiInlineEditMode ? escapeHtml(section.text || "") : renderInline(section.text || "")}</p>
          ${(bullets.length || wikiInlineEditMode) ? `<div class="beginner-static-points" data-wiki-list="bullets">${bullets.map((item) => wikiInlineEditMode ? textListItemHtml(item) : `<span>${renderInline(item)}</span>`).join("")}${inlineAddRemoveControls("text")}</div>` : ""}
        </section>
      `;
    }
    if (type === "steps") {
      const rows = Array.isArray(section.items) ? section.items : [];
      return `
        <section${anchorAttr} class="beginner-static-section${inlineClass}">
          ${inlineControlsHtml(section, index)}
          ${kicker}
          <h2 ${editAttr("title")}>${title}</h2>
          <div class="beginner-step-grid" data-wiki-pair-list="items">
            ${rows.map((row, idx) => `
              <article class="beginner-step-card" data-wiki-pair-item>
                <span class="wiki-inline-step-index">${idx + 1}</span>
                <h3 ${editAttr("pairTitle")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</h3>
                <p ${editAttr("pairBody")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</p>
                ${inlineRemoveButton()}
              </article>
            `).join("")}
            ${inlineAddRemoveControls("pair")}
          </div>
        </section>
      `;
    }
    if (type === "imageText") {
      return `
        <section${anchorAttr} class="beginner-static-section beginner-media-split is-layout-${escapeHtml(layout)}${inlineClass}">
          ${inlineControlsHtml(section, index)}
          ${imageHtml(Number(section.image || 0), section.title, "is-cover", section.imageUrl || section.image_url || "")}
          <div>
            ${kicker}
            <h2 ${editAttr("title")}>${title}</h2>
            <p ${editAttr("text")}>${wikiInlineEditMode ? escapeHtml(section.text || "") : renderInline(section.text || "")}</p>
          </div>
        </section>
      `;
    }
    if (type === "ratings") {
      const rows = Array.isArray(section.items) ? section.items : [];
      return `
        <section${anchorAttr} class="beginner-static-section beginner-rating-section is-layout-${escapeHtml(layout)}${inlineClass}">
          ${inlineControlsHtml(section, index)}
          ${imageHtml(Number(section.image || 0), section.title, "is-contain", section.imageUrl || section.image_url || "")}
          ${kicker}
          <h2 ${editAttr("title")}>${title}</h2>
          <p ${editAttr("intro")}>${wikiInlineEditMode ? escapeHtml(section.intro || "") : renderInline(section.intro || "")}</p>
          <div class="beginner-rating-grid" data-wiki-pair-list="items">
            ${rows.map((row) => `
              <article class="beginner-rating-card" data-wiki-pair-item>
                <strong ${editAttr("pairTitle")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</strong>
                <span ${editAttr("pairBody")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</span>
                ${inlineRemoveButton()}
              </article>
            `).join("")}
            ${inlineAddRemoveControls("pair")}
          </div>
        </section>
      `;
    }
    if (type === "sbtChecklist") {
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];
      const primer = Array.isArray(section.primer) ? section.primer : [];
      return `
        <section${anchorAttr} class="beginner-static-section beginner-sbt-section${inlineClass}">
          ${inlineControlsHtml(section, index)}
          <div class="beginner-sbt-primer">
            <div class="beginner-sbt-primer-copy">
              <span class="beginner-sbt-pill">Soulbound Token</span>
              <h2 ${editAttr("introTitle")}>${wikiInlineEditMode ? escapeHtml(section.introTitle || "") : renderSbtIntroTitle(section.introTitle || "")}</h2>
              <p ${editAttr("text")}>${wikiInlineEditMode ? escapeHtml(section.text || "") : renderInline(section.text || "")}</p>
            </div>
            ${(primer.length || wikiInlineEditMode) ? `
              <div class="beginner-sbt-primer-grid" data-wiki-pair-list="primer">
                ${primer.map((row) => `
                  <article class="beginner-sbt-primer-item" data-wiki-pair-item>
                    <strong ${editAttr("pairTitle")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</strong>
                    <span ${editAttr("pairBody")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</span>
                    ${inlineRemoveButton()}
                  </article>
                `).join("")}
                ${inlineAddRemoveControls("pair")}
              </div>
            ` : ""}
          </div>
          <div class="beginner-sbt-list-head">
            ${kicker}
            <h2 ${editAttr("title")}>${title}</h2>
          </div>
          ${(bullets.length || wikiInlineEditMode) ? `<div class="beginner-static-points" data-wiki-list="bullets">${bullets.map((item) => wikiInlineEditMode ? textListItemHtml(item) : `<span>${renderInline(item)}</span>`).join("")}${inlineAddRemoveControls("text")}</div>` : ""}
          ${renderSbtChecklistInner(currentLang())}
        </section>
      `;
    }
    const cards = Array.isArray(section.items) ? section.items : [];
    return `
      <section${anchorAttr} class="beginner-static-section${inlineClass}">
        ${inlineControlsHtml(section, index)}
        ${kicker}
        <h2 ${editAttr("title")}>${title}</h2>
        <div class="beginner-info-grid" data-wiki-pair-list="items">
          ${cards.map((row) => `
            <article class="beginner-info-card" data-wiki-pair-item>
              <h3 ${editAttr("pairTitle")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</h3>
              <p ${editAttr("pairBody")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</p>
              ${inlineRemoveButton()}
            </article>
          `).join("")}
          ${inlineAddRemoveControls("pair")}
        </div>
      </section>
    `;
  }

  function renderWikiEntry(lang) {
    const labels = WIKI_SEARCH_LABELS[lang] || WIKI_SEARCH_LABELS["zh-Hant"];
    const activeTopic = wikiInlineEditMode ? "" : currentTopic();
    if (wikiSearchInput) {
      wikiSearchInput.placeholder = labels.placeholder;
      wikiSearchInput.value = "";
    }
    if (wikiSearchEmpty) wikiSearchEmpty.textContent = labels.empty;
    if (!wikiTopicGrid) return;
    const topics = topicRowsFor(lang);
    wikiTopicGrid.innerHTML = topics.map((row, index) => {
      const topicId = row[4] || topicIdForAnchor(row[2]);
      const tag = wikiInlineEditMode ? "article" : "a";
      const href = wikiInlineEditMode ? "" : ` href="./beginner.html?topic=${escapeHtml(topicId)}"`;
      return `
      <${tag} class="beginner-wiki-topic ${topicId === activeTopic ? "is-active" : ""} ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}"${href} data-topic-id="${escapeHtml(topicId)}" data-topic-search="${escapeHtml(`${row[0]} ${row[1]}`.toLowerCase())}" data-wiki-topic-item data-wiki-topic-index="${index}">
        <span class="beginner-wiki-topic-icon"><iconify-icon icon="${escapeHtml(row[3])}"></iconify-icon></span>
        <span class="beginner-wiki-topic-copy">
          <strong ${editAttr("topicTitle")}>${escapeHtml(row[0])}</strong>
          <em ${editAttr("topicSubtitle")}>${escapeHtml(row[1])}</em>
        </span>
        ${wikiInlineEditMode ? `
          <label class="wiki-inline-topic-icon" contenteditable="false">
            <span>Icon</span>
            <input data-wiki-topic-field="icon" value="${escapeHtml(row[3])}" />
          </label>
        ` : ""}
      </${tag}>
    `;
    }).join("");
  }

  function renderSidebar(lang) {
    const labels = SIDEBAR_LABELS[lang] || SIDEBAR_LABELS["zh-Hant"];
    const menuLabels = menuLabelsFor(lang);
    const activeTopic = wikiInlineEditMode ? "" : currentTopic();
    const labelEl = document.querySelector(".beginner-sidebar-label");
    if (labelEl) labelEl.textContent = labels.guide;
    if (sidebarHome) {
      sidebarHome.classList.toggle("is-active", !activeTopic);
      const copy = sidebarHome.querySelector("span:last-child");
      if (copy) {
        copy.innerHTML = `<strong>${escapeHtml(labels.home)}</strong><em>${escapeHtml(labels.homeSub)}</em>`;
      }
    }
    if (!docsNav) return;
    const topics = topicRowsFor(lang);
    const topicMap = new Map(topics.map((row) => [row[4] || topicIdForAnchor(row[2]), row]));
    const groups = menuLabels.groups || [];
    const storedOpenGroups = readOpenSidebarGroups();
    const hasStoredGroups = storedOpenGroups.size > 0;
    const activeGroupId = groups.reduce((result, group, index) => {
      if (result) return result;
      const ids = Array.isArray(group[2]) ? group[2] : [];
      return ids.includes(activeTopic) ? sidebarGroupId(group, index) : "";
    }, "");
    docsNav.innerHTML = `
      <ul class="beginner-sidebar-outline">
        ${groups.map((group, index) => {
      const title = group[0];
      const kicker = group[1];
      const ids = Array.isArray(group[2]) ? group[2] : [];
      const groupId = sidebarGroupId(group, index);
      const isActiveGroup = groupId === activeGroupId;
      const isOpen = storedOpenGroups.has(groupId) || isActiveGroup || (!hasStoredGroups && !activeTopic && index === 0);
      const itemCount = ids.filter((topicId) => topicMap.has(topicId)).length;
      return `
        <li class="beginner-sidebar-group ${isOpen ? "is-open" : ""} ${isActiveGroup ? "is-active" : ""}" data-sidebar-group-id="${escapeHtml(groupId)}" data-wiki-menu-group data-wiki-menu-group-index="${index}">
          <button class="beginner-sidebar-group-toggle" type="button" aria-expanded="${isOpen ? "true" : "false"}" data-sidebar-group-toggle="${escapeHtml(groupId)}">
            <iconify-icon icon="${escapeHtml(sidebarGroupIcon(group))}"></iconify-icon>
            <span class="beginner-sidebar-group-copy">
              <em ${editAttr("menuGroupKicker")}>${escapeHtml(kicker)}</em>
              <strong ${editAttr("menuGroupTitle")}>${escapeHtml(title)}</strong>
            </span>
            <span class="beginner-sidebar-group-count">${escapeHtml(String(itemCount).padStart(2, "0"))}</span>
            <iconify-icon class="beginner-sidebar-group-chevron" icon="lucide:chevron-down"></iconify-icon>
          </button>
          <ul class="beginner-sidebar-group-panel" aria-hidden="${isOpen ? "false" : "true"}">
            ${ids.map((topicId) => {
              const row = topicMap.get(topicId);
              if (!row) return "";
              const isActive = topicId === activeTopic;
              return `
                <li class="beginner-sidebar-topic-item">
                  <a class="beginner-sidebar-topic ${isActive ? "is-active" : ""}" href="./beginner.html?topic=${escapeHtml(topicId)}" data-topic-id="${escapeHtml(topicId)}" ${isOpen ? "" : "tabindex=\"-1\""}>
                    <span class="beginner-sidebar-topic-rail" aria-hidden="true"></span>
                    <iconify-icon icon="${escapeHtml(row[3])}"></iconify-icon>
                    <span class="beginner-sidebar-topic-copy">
                      <strong>${escapeHtml(row[0])}</strong>
                      <em>${escapeHtml(row[1])}</em>
                      ${isActive ? `<span class="beginner-sidebar-topic-state">${escapeHtml(labels.current)}</span>` : ""}
                    </span>
                  </a>
                </li>
              `;
            }).join("")}
          </ul>
        </li>
      `;
    }).join("")}
      </ul>
    `;
    const activeLink = docsNav.querySelector(".beginner-sidebar-topic.is-active");
    if (activeLink) {
      window.requestAnimationFrame(() => {
        activeLink.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
      });
    }
  }

  function renderWikiMenu(lang) {
    const labels = menuLabelsFor(lang);
    const activeTopic = wikiInlineEditMode ? "" : currentTopic();
    const topicMap = new Map(topicRowsFor(lang).map((row) => [row[4] || topicIdForAnchor(row[2]), row]));
    setEditableText(wikiMenuLabel, labels.label, "data-wiki-menu-field", "label");
    setEditableText(wikiMenuTitle, labels.title, "data-wiki-menu-field", "title");
    setEditableText(wikiMenuOverview, labels.overview, "data-wiki-menu-field", "overview");
    const overviewLink = wikiMenu ? wikiMenu.querySelector(".wiki-mega-open") : null;
    if (overviewLink) overviewLink.classList.toggle("is-active", !activeTopic);
    if (!wikiMegaGrid) return;
    wikiMegaGrid.innerHTML = labels.groups.map((group) => {
      const title = group[0];
      const kicker = group[1];
      const ids = group[2] || [];
      return `
        <section class="wiki-mega-column">
          <div class="wiki-mega-column-kicker">${escapeHtml(kicker)}</div>
          <h3>${escapeHtml(title)}</h3>
          ${ids.map((topicId) => {
            const row = topicMap.get(topicId);
            if (!row) return "";
            return `
              <a class="wiki-mega-link ${topicId === activeTopic ? "is-active" : ""}" href="./beginner.html?topic=${escapeHtml(topicId)}" data-topic-id="${escapeHtml(topicId)}">
                <iconify-icon icon="${escapeHtml(row[3])}"></iconify-icon>
                <span>
                  <strong>${escapeHtml(row[0])}</strong>
                  <em>${escapeHtml(row[1])}</em>
                </span>
              </a>
            `;
          }).join("")}
        </section>
      `;
    }).join("");
  }

  function applyWikiSearch(query) {
    const value = String(query || "").trim().toLowerCase();
    const activeTopic = wikiInlineEditMode ? "" : currentTopic();
    const targets = activeTopic
      ? Array.from(document.querySelectorAll("[data-beginner-search]"))
      : Array.from(document.querySelectorAll("[data-topic-search]"));
    let visibleCount = 0;
    targets.forEach((section) => {
      const searchText = activeTopic
        ? String(section.getAttribute("data-beginner-search") || "")
        : String(section.getAttribute("data-topic-search") || "");
      const ok = !value || searchText.includes(value);
      section.classList.toggle("is-hidden-by-search", !ok);
      if (ok) visibleCount += 1;
    });
    if (wikiSearchEmpty) {
      wikiSearchEmpty.classList.toggle("is-visible", Boolean(value) && visibleCount === 0);
    }
  }

  function bindWikiEntry() {
    if (wikiSearchInput && wikiSearchInput.dataset.boundBeginnerSearch !== "1") {
      wikiSearchInput.dataset.boundBeginnerSearch = "1";
      wikiSearchInput.addEventListener("input", () => applyWikiSearch(wikiSearchInput.value));
    }
    if (wikiTopicGrid && wikiTopicGrid.dataset.boundBeginnerTopics !== "1") {
      wikiTopicGrid.dataset.boundBeginnerTopics = "1";
      wikiTopicGrid.addEventListener("click", handleTopicLinkClick);
    }
    if (docsNav && docsNav.dataset.boundBeginnerTopics !== "1") {
      docsNav.dataset.boundBeginnerTopics = "1";
      docsNav.addEventListener("click", (event) => {
        if (handleSidebarGroupToggle(event)) return;
        handleTopicLinkClick(event);
      });
    }
    if (sidebarHome && sidebarHome.dataset.boundBeginnerTopics !== "1") {
      sidebarHome.dataset.boundBeginnerTopics = "1";
      sidebarHome.addEventListener("click", handleTopicLinkClick);
    }
    if (wikiMenu && wikiMenu.dataset.boundBeginnerTopics !== "1") {
      wikiMenu.dataset.boundBeginnerTopics = "1";
      wikiMenu.addEventListener("click", handleTopicLinkClick);
    }
    if (wikiMenuToggle && wikiMenuToggle.dataset.boundWikiMenu !== "1") {
      wikiMenuToggle.dataset.boundWikiMenu = "1";
      wikiMenuToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        setWikiMenuOpen(wikiMenuToggle.getAttribute("aria-expanded") !== "true");
      });
    }
    if (sidebarToggle && sidebarToggle.dataset.boundSidebarToggle !== "1") {
      sidebarToggle.dataset.boundSidebarToggle = "1";
      sidebarToggle.addEventListener("click", () => {
        setSidebarCollapsed(!docsLayout.classList.contains("is-sidebar-collapsed"), true);
      });
    }
  }

  function renderStats(guide) {
    return `
      <div class="beginner-stat-row" data-wiki-stats>
        ${(guide.stats || []).map((row, idx) => `
          <article class="beginner-stat" data-wiki-stat-index="${idx}">
            <span class="beginner-stat-label" ${editAttr("statLabel")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</span>
            <div class="beginner-stat-value" ${editAttr("statValue")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</div>
            ${inlineRemoveButton()}
          </article>
        `).join("")}
        ${wikiInlineEditMode ? `<button type="button" class="beginner-stat wiki-inline-add-card" data-wiki-stat-add contenteditable="false">新增首頁重點</button>` : ""}
      </div>
    `;
  }

  function selectedGuideSections(guide, topicId) {
    if (wikiInlineEditMode) {
      return (Array.isArray(guide.sections) ? guide.sections : [])
        .map((section, index) => ({ section, index }))
        .filter((item) => item.section);
    }
    if (!topicId) return [];
    const sections = Array.isArray(guide.sections) ? guide.sections : [];
    const hasTaggedSections = sections.some((section) => section && section.topic);
    if (hasTaggedSections) {
      return sections
        .map((section, index) => ({ section, index }))
        .filter((item) => item.section && sectionTopic(item.section, item.index) === topicId);
    }
    const indexes = TOPIC_SECTION_INDEXES[topicId] || [];
    return indexes
      .map((index) => ({ section: guide.sections && guide.sections[index], index }))
      .filter((item) => item.section);
  }

  function updateTopicPanels(topicId) {
    const toolsPanel = document.getElementById("beginner-anchor-tools");
    const faqPanel = document.getElementById("beginner-anchor-faq");
    if (wikiInlineEditMode) {
      if (toolsPanel) toolsPanel.hidden = false;
      if (faqPanel) faqPanel.hidden = false;
      return;
    }
    if (toolsPanel) toolsPanel.hidden = topicId !== "tools";
    if (faqPanel) faqPanel.hidden = topicId !== "faq";
  }

  function renderStaticGuide(lang) {
    const guide = guideFor(lang);
    const labels = labelsFor(lang);
    const topicId = wikiInlineEditMode ? "" : currentTopic();
    const topicRow = topicId ? topicRowById(lang, topicId) : null;
    const titleEl = document.getElementById("beginner-page-title");
    const subEl = document.getElementById("beginner-page-subtitle");
    const chipEl = document.getElementById("beginner-page-chip");
    if (titleEl) {
      const title = topicRow ? topicRow[0] : guide.title || "";
      const icon = topicRow ? topicRow[3] : "lucide:flag";
      titleEl.innerHTML = `<iconify-icon icon="${escapeHtml(icon)}"></iconify-icon><span ${editAttr("heroTitle", ' data-wiki-hero-field="title"')}>${escapeHtml(title)}</span>`;
    }
    if (subEl) {
      const subtitle = topicRow ? topicRow[1] : guide.subtitle || "";
      subEl.innerHTML = `<span ${editAttr("heroSubtitle", ' data-wiki-hero-field="subtitle"')}>${escapeHtml(subtitle)}</span>`;
    }
    if (chipEl) {
      const chipText = topicRow ? "Wiki Article" : guide.eyebrow || "";
      chipEl.innerHTML = `<iconify-icon icon="${topicRow ? "lucide:file-text" : "lucide:route"}"></iconify-icon><span ${editAttr("heroEyebrow", ' data-wiki-hero-field="eyebrow"')}>${escapeHtml(chipText)}</span>`;
    }
    if (coverImg && Array.isArray(data.images)) coverImg.src = data.images[0] || "";
    if (coverWrap) {
      coverWrap.style.display = "block";
      const coverHost = coverWrap.closest(".beginner-help-hero") || coverWrap.parentElement || coverWrap;
      coverHost.querySelector(".wiki-inline-cover-controls")?.remove();
      if (wikiInlineEditMode) {
        coverHost.insertAdjacentHTML("beforeend", `
          <label class="wiki-inline-cover-controls" contenteditable="false">
            <span>封面圖片</span>
            <input data-wiki-cover-image-url type="url" value="${escapeHtml(Array.isArray(data.images) ? data.images[0] || "" : "")}" />
          </label>
        `);
      }
    }
    renderWikiEntry(lang);
    renderSidebar(lang);
    renderWikiMenu(lang);
    setSidebarCollapsed(isSidebarCollapsed(), false);
    if (wikiEntry) wikiEntry.classList.toggle("is-topic-page", Boolean(topicId));
    updateTopicPanels(topicId);
    if (contentEl) {
      const selected = selectedGuideSections(guide, topicId);
      contentEl.innerHTML = `
        ${topicId ? "" : renderStats(guide)}
        ${selected.map((item) => renderSection(item.section, item.index)).join("")}
      `;
    }
    const textTargets = {
      "beginner-tools-title": ["toolsTitle", labels.toolsTitle],
      "beginner-tools-subtitle": ["toolsSubtitle", labels.toolsSubtitle],
      "beginner-faq-title": ["faqTitle", labels.faqTitle],
      "beginner-faq-subtitle": ["faqSubtitle", labels.faqSubtitle],
      "beginner-nav-game": ["navGame", labels.navGame],
      "beginner-nav-aggregator": ["navAggregator", labels.navAggregator],
      "beginner-nav-beginner": ["navBeginner", labels.navBeginner],
      "beginner-open-link": ["openRenaiss", labels.openRenaiss],
    };
    Object.entries(textTargets).forEach(([id, pair]) => {
      const el = document.getElementById(id);
      const [key, text] = pair;
      if (el && text) setEditableText(el, text, "data-wiki-label-field", key);
    });
    const sbtTitle = document.getElementById("beginner-sbt-title");
    const sbtSub = document.getElementById("beginner-sbt-subtitle");
    if (sbtTitle) sbtTitle.innerHTML = `<iconify-icon icon="lucide:flag"></iconify-icon>${escapeHtml(labels.sbtTitle || "")}`;
    if (sbtSub) sbtSub.textContent = labels.sbtSubtitle || "";
  }

  function renderStaticTools(lang) {
    if (!toolsEl) return;
    const labels = labelsFor(lang);
    const tools = Array.isArray(data.tools) ? data.tools : [];
    const commands = Array.isArray(data.commands) ? data.commands : [];
    const toolCards = tools.map((tool, idx) => {
      const toolName = localized(tool.name, lang, "");
      const linkLabel = localized(tool.linkLabel, lang, labels.linkLabel || "Link");
      const authors = (tool.authors || []).join("、");
      return `
        <article class="beginner-tool-card ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}" data-wiki-tool-card data-wiki-tool-index="${idx}">
          <div class="beginner-tool-top">
            <span class="beginner-tool-index">${String(idx + 1).padStart(2, "0")}</span>
            <iconify-icon icon="lucide:wrench"></iconify-icon>
          </div>
          <div class="beginner-tool-name" ${editAttr("toolName")}>${escapeHtml(toolName)}</div>
          <div class="beginner-tool-meta">${escapeHtml(labels.authorLabel || "作者")}：<span ${editAttr("toolAuthors")}>${escapeHtml(authors)}</span></div>
          ${wikiInlineEditMode ? `
            <label class="wiki-inline-link-field" contenteditable="false">
              <span>連結</span>
              <input data-wiki-tool-field="link" type="url" value="${escapeHtml(tool.link || "")}" />
            </label>
            <div class="beginner-tool-link is-editing" contenteditable="false"><iconify-icon icon="lucide:external-link"></iconify-icon><span ${editAttr("toolLinkLabel")}>${escapeHtml(linkLabel)}</span></div>
            ${inlineRemoveButton()}
          ` : `<a class="beginner-tool-link" href="${escapeHtml(tool.link)}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:external-link"></iconify-icon>${escapeHtml(linkLabel)}</a>`}
        </article>
      `;
    }).join("");
    const commandCards = commands.map((command, idx) => {
      const desc = command.desc && (command.desc[lang] || command.desc["zh-Hant"]) || "";
      const commandName = localized(command.name, lang, "");
      const commandMeta = localized(command.meta, lang, "");
      const commandLine = command.command
        ? (wikiInlineEditMode
          ? `<label class="wiki-inline-link-field" contenteditable="false"><span>${escapeHtml(labels.commandLabel || "Command")}</span><input data-wiki-command-field="command" value="${escapeHtml(command.command)}" /></label>`
          : `<div class="beginner-command-meta">${escapeHtml(labels.commandLabel || "Command")}: <code>${escapeHtml(command.command)}</code></div>`)
        : (commandMeta
          ? `<div class="beginner-command-meta is-auto"><iconify-icon icon="lucide:sparkles"></iconify-icon><span ${editAttr("commandMeta")}>${escapeHtml(commandMeta)}</span></div>`
          : "");
      return `
        <article class="beginner-command-card ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}" data-wiki-command-card data-wiki-command-index="${idx}">
          <div class="beginner-command-top">
            <span class="beginner-tool-index">${String(idx + 1).padStart(2, "0")}</span>
            <iconify-icon icon="${escapeHtml(command.icon || "lucide:terminal-square")}"></iconify-icon>
          </div>
          <h4 ${editAttr("commandName")}>${escapeHtml(commandName)}</h4>
          <p ${editAttr("commandDesc")}>${wikiInlineEditMode ? escapeHtml(desc) : renderCardSearchHighlight(desc)}</p>
          ${commandLine}
          ${wikiInlineEditMode ? `
            <label class="wiki-inline-link-field" contenteditable="false">
              <span>Icon</span>
              <input data-wiki-command-field="icon" value="${escapeHtml(command.icon || "lucide:terminal-square")}" />
            </label>
            ${inlineRemoveButton()}
          ` : ""}
        </article>
      `;
    }).join("");
    const showcase = data.commandShowcase || {};
    const showcaseImages = Array.isArray(showcase.images) ? showcase.images : [];
    const showcaseHtml = showcaseImages.length
      ? `
      <section class="beginner-command-focus" aria-label="${escapeHtml(labels.commandsCriticalTitle || "Critical Workflow")}">
        <div class="beginner-command-focus-head">
          <span class="beginner-command-focus-tag"><iconify-icon icon="lucide:alert-triangle"></iconify-icon><span ${editLabelAttr("commandsCriticalTag")}>${escapeHtml(labels.commandsCriticalTag || "High Priority")}</span></span>
          <h4 ${editLabelAttr("commandsCriticalTitle")}>${escapeHtml(labels.commandsCriticalTitle || "")}</h4>
          <p ${editLabelAttr("commandsCriticalDesc")}>${wikiInlineEditMode ? escapeHtml(labels.commandsCriticalDesc || "") : renderCardSearchHighlight(labels.commandsCriticalDesc || "")}</p>
          <p class="beginner-command-focus-note" ${editLabelAttr("commandsCriticalHint")}>${escapeHtml(labels.commandsCriticalHint || "")}</p>
          <div class="beginner-command-focus-gallery-title" ${editLabelAttr("commandsExamplesTitle")}>${escapeHtml(labels.commandsExamplesTitle || "")}</div>
          <div class="beginner-command-focus-gallery-note" ${editLabelAttr("commandsExamplesNote")}>${escapeHtml(labels.commandsExamplesNote || "")}</div>
        </div>
        <div class="beginner-command-focus-gallery">
          ${showcaseImages.map((item, idx) => {
            const src = String(item && item.src || "").trim();
            if (!src) return "";
            const caption = localized(item.caption, lang, "");
            return `
              <figure class="beginner-command-focus-figure ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}" data-wiki-showcase-image data-wiki-showcase-index="${idx}">
                <img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(caption || `Command showcase ${idx + 1}`)}" />
                ${caption || wikiInlineEditMode ? `<figcaption ${editAttr("showcaseCaption")}>${escapeHtml(caption)}</figcaption>` : ""}
                ${wikiInlineEditMode ? `
                  <label class="wiki-inline-link-field" contenteditable="false">
                    <span>圖片</span>
                    <input data-wiki-showcase-field="src" type="url" value="${escapeHtml(src)}" />
                  </label>
                  ${inlineRemoveButton()}
                ` : ""}
              </figure>
            `;
          }).join("")}
          ${wikiInlineEditMode ? `<button type="button" class="wiki-inline-add-card" data-wiki-showcase-add contenteditable="false">新增範例圖</button>` : ""}
        </div>
      </section>
      `
      : "";
    toolsEl.innerHTML = `
      <div class="beginner-tools-subhead">
        <div>
          <h3 ${editLabelAttr("communityToolsTitle")}>${escapeHtml(labels.communityToolsTitle || "Community-Built Tools")}</h3>
          <p ${editLabelAttr("communityToolsSubtitle")}>${escapeHtml(labels.communityToolsSubtitle || "")}</p>
        </div>
      </div>
      <div class="beginner-tools-grid" data-wiki-tools>${toolCards}${wikiInlineEditMode ? `<button type="button" class="wiki-inline-add-card" data-wiki-tool-add contenteditable="false">新增工具</button>` : ""}</div>
      <div class="beginner-tools-subhead">
        <div>
          <h3 class="beginner-commands-title-rainbow" ${editLabelAttr("commandsTitle")}>${escapeHtml(labels.commandsTitle || "TCG Pro Discord 指令清單")}</h3>
          <p ${editLabelAttr("commandsSubtitle")}>${escapeHtml(labels.commandsSubtitle || "")}</p>
          <p class="beginner-command-owner" ${editLabelAttr("commandsOwner")}>${escapeHtml(labels.commandsOwner || "")}</p>
        </div>
      </div>
      <div class="beginner-command-grid" data-wiki-commands>${commandCards}${wikiInlineEditMode ? `<button type="button" class="wiki-inline-add-card" data-wiki-command-add contenteditable="false">新增指令</button>` : ""}</div>
      ${showcaseHtml}
    `;
  }

  function renderStaticFaq(lang) {
    if (!faqEl) return;
    const rows = data.faq && (data.faq[lang] || data.faq["zh-Hant"]) || [];
    faqEl.innerHTML = rows.map((row) => `
      <article class="beginner-faq-item ${wikiInlineEditMode ? "is-wiki-inline-card" : ""}" data-wiki-faq-item>
        <div class="beginner-faq-q">Q: <span ${editAttr("faqQuestion")}>${wikiInlineEditMode ? escapeHtml(row[0] || "") : renderInline(row[0] || "")}</span></div>
        <div class="beginner-faq-a">A: <span ${editAttr("faqAnswer")}>${wikiInlineEditMode ? escapeHtml(row[1] || "") : renderInline(row[1] || "")}</span></div>
        ${inlineRemoveButton()}
      </article>
    `).join("") + (wikiInlineEditMode ? `<button type="button" class="wiki-inline-add-card" data-wiki-faq-add contenteditable="false">新增 FAQ</button>` : "");
  }

  function renderStaticSbt(lang) {
    const availableList = document.getElementById("sbt-available-list");
    const availableCount = document.getElementById("sbt-available-count");
    if (!availableList || !availableCount) return;
    const labels = labelsFor(lang);
    const rows = Array.isArray(window.RENAISS_SBT_CATALOG) ? window.RENAISS_SBT_CATALOG.filter((row) => row && row.status === "available") : [];
    availableCount.innerHTML = `<iconify-icon icon="lucide:clock-3"></iconify-icon>${rows.length} ${labels.items || "items"}`;
  }

  function timelineAnchorId(key) {
    if (key === "start") return "beginner-anchor-start";
    if (key === "sbt") return "beginner-anchor-sbt";
    if (key === "tcg") return "beginner-anchor-tcg";
    if (key === "tools") return "beginner-anchor-tools";
    if (key === "faq") return "beginner-anchor-faq";
    return "";
  }

  function timelineTarget(key) {
    const id = timelineAnchorId(key);
    if (!id) return null;
    return document.getElementById(id);
  }

  function setActiveTimelineKey(activeKey) {
    timelineItems.forEach((item) => {
      const key = String(item.getAttribute("data-beginner-anchor") || "").trim();
      item.classList.toggle("is-active", key === activeKey);
    });
  }

  function syncTimelineActive() {
    if (!timelineItems.length) return;
    if (wikiInlineEditMode) {
      setActiveTimelineKey("");
      return;
    }
    const topicId = currentTopic();
    if (topicId && TIMELINE_KEYS.includes(topicId)) {
      setActiveTimelineKey(topicId);
      return;
    }
    if (topicId) {
      setActiveTimelineKey("");
      return;
    }
    setActiveTimelineKey("start");
  }

  let timelineTicking = false;
  function queueTimelineSync() {
    if (timelineTicking) return;
    timelineTicking = true;
    window.requestAnimationFrame(() => {
      timelineTicking = false;
      syncTimelineActive();
    });
  }

  function bindTimelineNav() {
    if (!timelineItems.length) return;
    timelineItems.forEach((item) => {
      if (item.dataset.boundTimeline === "1") return;
      item.dataset.boundTimeline = "1";
      item.addEventListener("click", () => {
        const key = String(item.getAttribute("data-beginner-anchor") || "").trim();
        if (wikiInlineEditMode) {
          scrollToTopicAnchor(key);
          return;
        }
        if (key && currentTopic() !== key) {
          navigateTopic(key);
          return;
        }
        const target = timelineTarget(key);
        if (!target) return;
        setActiveTimelineKey(key);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function updateTimelineLocale(lang) {
    if (!timelineEl || !timelineItems.length) return;
    const labels = TIMELINE_LABELS[lang] || TIMELINE_LABELS["zh-Hant"];
    const titleEl = timelineEl.querySelector(".beginner-scroll-timeline-title");
    if (titleEl) titleEl.textContent = labels.title;
    timelineItems.forEach((item) => {
      const key = String(item.getAttribute("data-beginner-anchor") || "").trim();
      if (!labels[key]) return;
      item.textContent = labels[key];
    });
  }

  async function loadCmsWikiData() {
    let lastError = null;
    for (const base of WIKI_API_BASE_CANDIDATES) {
      activeWikiApiBase = base;
      try {
        const response = await fetch(wikiApiUrl("/api/wiki/beginner"), {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: wikiAuthHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        const wiki = payload.wiki || {};
        if (wiki.exists && wiki.data && typeof wiki.data === "object") {
          data = mergeWikiData(staticWikiSeed, wiki.data);
          wikiCmsState.meta = wiki.meta || {};
        } else {
          wikiCmsState.meta = wiki.meta || {};
        }
        wikiCmsState.apiAvailable = true;
        return payload;
      } catch (error) {
        lastError = error;
      }
    }
    wikiCmsState.apiAvailable = false;
    wikiCmsState.meta = { error: String(lastError?.message || lastError || "api_unavailable") };
    return null;
  }

  async function fetchWikiAuthState() {
    try {
      const response = await fetch(wikiApiUrl("/api/auth/me"), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: wikiAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const token = String(payload.token || "").trim();
      if (token) saveWikiAuthToken(token);
      wikiCmsState.auth = {
        ready: true,
        authenticated: Boolean(payload.authenticated),
        authRequired: Boolean(payload.auth_required),
        authConfigured: Boolean(payload.auth_configured),
        user: String(payload.user || ""),
        role: String(payload.role || ""),
        permissions: payload.permissions && typeof payload.permissions === "object" ? payload.permissions : {},
      };
    } catch (error) {
      wikiCmsState.auth = {
        ready: true,
        authenticated: false,
        authRequired: true,
        authConfigured: false,
        user: "",
        role: "",
        permissions: {},
        error: String(error?.message || error || "auth_unavailable"),
      };
    }
    updateWikiCreatorUi();
    return wikiCmsState.auth;
  }

  function canEditWiki() {
    if (!wikiCmsState.auth.authRequired) return true;
    return Boolean(wikiCmsState.auth.authenticated && wikiCmsState.auth.permissions && wikiCmsState.auth.permissions.wiki_edit);
  }

  function isDirectusWiki() {
    const meta = wikiCmsState.meta || {};
    return String(meta.provider || meta.source || "").toLowerCase() === "directus";
  }

  function directusStudioUrl() {
    const meta = wikiCmsState.meta || {};
    return String(meta.studio_url || meta.studioUrl || "").trim();
  }

  function legacyInlineEditorEnabled() {
    return Boolean(window.RENAISS_ENABLE_LEGACY_WIKI_EDITOR);
  }

  function updateWikiCreatorUi() {
    if (isDirectusWiki()) {
      const editable = canEditWiki();
      if (wikiLoginBtn) wikiLoginBtn.hidden = editable;
      if (wikiLogoutBtn) wikiLogoutBtn.hidden = !wikiCmsState.auth.authenticated;
      if (wikiEditorBtn) {
        wikiEditorBtn.hidden = !editable;
        const role = wikiCmsState.auth.role || "creator";
        wikiEditorBtn.textContent = wikiInlineEditMode ? "退出編輯模式" : (role === "admin" ? "Admin 編輯 Wiki" : "Creator 編輯 Wiki");
      }
      return;
    }
    if (!legacyInlineEditorEnabled()) {
      if (wikiLoginBtn) wikiLoginBtn.hidden = true;
      if (wikiEditorBtn) wikiEditorBtn.hidden = true;
      if (wikiLogoutBtn) wikiLogoutBtn.hidden = true;
      if (wikiInlineEditMode) setWikiInlineEditing(false);
      return;
    }
    const editable = canEditWiki();
    if (wikiLoginBtn) wikiLoginBtn.hidden = editable;
    if (wikiEditorBtn) wikiEditorBtn.hidden = !editable;
    if (wikiLogoutBtn) wikiLogoutBtn.hidden = !wikiCmsState.auth.authenticated;
    if (wikiEditorBtn) {
      const role = wikiCmsState.auth.role || "creator";
      wikiEditorBtn.textContent = wikiInlineEditMode ? "退出編輯模式" : (role === "admin" ? "Admin 編輯 Wiki" : "Creator 編輯 Wiki");
    }
  }

  function openWikiModal(modal) {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeWikiModal(modal) {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  async function submitWikiLogin(username, password) {
    const response = await fetch(wikiApiUrl("/api/auth/login"), {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: wikiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    if (payload.token) saveWikiAuthToken(payload.token);
    await fetchWikiAuthState();
    return payload;
  }

  async function submitWikiLogout() {
    try {
      await fetch(wikiApiUrl("/api/auth/logout"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: wikiAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
    } catch (_error) {}
    clearWikiAuthToken();
    await fetchWikiAuthState();
  }

  function editorLang() {
    return normalizeLang(wikiEditorLang ? wikiEditorLang.value : currentLang());
  }

  function fieldValue(root, selector) {
    const node = root ? root.querySelector(selector) : null;
    return String(node && "value" in node ? node.value : "").trim();
  }

  function setLocalizedField(target, key, lang, value) {
    const current = target[key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current[lang] = value;
      return;
    }
    target[key] = { "zh-Hant": String(current || "") };
    target[key][lang] = value;
  }

  function editorInput(label, attrs = {}, value = "") {
    const attr = Object.entries(attrs)
      .map(([key, raw]) => `${key}="${escapeHtml(raw)}"`)
      .join(" ");
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input ${attr} value="${escapeHtml(value)}" />
      </label>
    `;
  }

  function editorTextarea(label, attrs = {}, value = "", rows = 3) {
    const attr = Object.entries(attrs)
      .map(([key, raw]) => `${key}="${escapeHtml(raw)}"`)
      .join(" ");
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <textarea ${attr} rows="${rows}">${escapeHtml(value)}</textarea>
      </label>
    `;
  }

  function pairRowHtml(title = "", body = "", removeLabel = "移除") {
    return `
      <div class="beginner-wiki-repeat-row" data-editor-pair-row>
        <input data-pair-title type="text" value="${escapeHtml(title)}" placeholder="標題" />
        <textarea data-pair-body rows="2" placeholder="內容">${escapeHtml(body)}</textarea>
        <button type="button" class="wiki-creator-icon-btn" data-editor-remove-row>${escapeHtml(removeLabel)}</button>
      </div>
    `;
  }

  function textRowHtml(value = "", removeLabel = "移除") {
    return `
      <div class="beginner-wiki-repeat-row is-text" data-editor-text-row>
        <textarea data-text-value rows="2" placeholder="項目內容">${escapeHtml(value)}</textarea>
        <button type="button" class="wiki-creator-icon-btn" data-editor-remove-row>${escapeHtml(removeLabel)}</button>
      </div>
    `;
  }

  function statRowHtml(row = []) {
    return `
      <div class="beginner-wiki-repeat-row" data-editor-stat-row>
        <input data-stat-label type="text" value="${escapeHtml(row[0] || "")}" placeholder="標籤，例如 首要任務" />
        <input data-stat-value type="text" value="${escapeHtml(row[1] || "")}" placeholder="內容，例如 綁定 X / Discord" />
        <button type="button" class="wiki-creator-icon-btn" data-editor-remove-row>移除</button>
      </div>
    `;
  }

  function sectionListHtml(listName, rows, kind = "pair") {
    const addLabel = kind === "text" ? "新增項目" : "新增一列";
    const rowHtml = (rows || []).map((row) => {
      if (kind === "text") return textRowHtml(row || "");
      return pairRowHtml(row && row[0], row && row[1]);
    }).join("");
    return `
      <div class="beginner-wiki-field-group">
        <div class="beginner-wiki-field-group-head">
          <span>${escapeHtml(listName)}</span>
          <button type="button" class="wiki-creator-btn" data-editor-add-row data-row-kind="${escapeHtml(kind)}">${escapeHtml(addLabel)}</button>
        </div>
        <div class="beginner-wiki-repeat-list" data-editor-repeat-list data-row-kind="${escapeHtml(kind)}">
          ${rowHtml}
        </div>
      </div>
    `;
  }

  function sectionFieldsHtml(section) {
    const type = String(section && section.type || "intro");
    const imageInput = ["imageText", "ratings"].includes(type)
      ? editorInput("圖片序號", { "data-section-field": "image", type: "number", min: "0", step: "1" }, section.image ?? "")
      : "";
    if (type === "steps") {
      return sectionListHtml("步驟", section.items || [], "pair");
    }
    if (type === "cards") {
      return sectionListHtml("卡片", section.items || [], "pair");
    }
    if (type === "ratings") {
      return `
        ${imageInput}
        ${editorTextarea("導言", { "data-section-field": "intro" }, section.intro || "", 3)}
        ${sectionListHtml("評級項目", section.items || [], "pair")}
      `;
    }
    if (type === "sbtChecklist") {
      return `
        ${editorInput("內文標題", { "data-section-field": "introTitle", type: "text" }, section.introTitle || "")}
        ${editorTextarea("主要說明", { "data-section-field": "text" }, section.text || "", 4)}
        ${sectionListHtml("重點卡", section.primer || [], "pair")}
        ${sectionListHtml("條列", section.bullets || [], "text")}
      `;
    }
    if (type === "imageText") {
      return `
        ${imageInput}
        ${editorTextarea("內文", { "data-section-field": "text" }, section.text || "", 4)}
      `;
    }
    return `
      ${editorTextarea("內文", { "data-section-field": "text" }, section.text || "", 4)}
      ${sectionListHtml("條列", section.bullets || [], "text")}
    `;
  }

  function sectionEditorHtml(section, index) {
    const type = String(section && section.type || "intro");
    const label = {
      intro: "說明",
      steps: "步驟",
      imageText: "圖文",
      cards: "卡片",
      sbtChecklist: "SBT",
      ratings: "評級",
    }[type] || type;
    return `
      <article class="beginner-wiki-edit-card" data-editor-section-card data-section-index="${index}" data-section-type="${escapeHtml(type)}">
        <div class="beginner-wiki-edit-card-head">
          <div>
            <span>${String(index + 1).padStart(2, "0")} / ${escapeHtml(label)}</span>
            <strong>${escapeHtml(section.title || "未命名段落")}</strong>
          </div>
        </div>
        ${editorInput("段落標題", { "data-section-field": "title", type: "text" }, section.title || "")}
        ${sectionFieldsHtml(section)}
      </article>
    `;
  }

  function toolEditorHtml(tool, index, lang) {
    const name = localized(tool.name, lang, "");
    const linkLabel = localized(tool.linkLabel, lang, "");
    return `
      <article class="beginner-wiki-edit-card" data-editor-tool-card data-tool-index="${index}">
        <div class="beginner-wiki-edit-card-head">
          <div>
            <span>Tool ${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(name || "未命名工具")}</strong>
          </div>
          <button type="button" class="wiki-creator-icon-btn" data-editor-remove-card>移除</button>
        </div>
        ${editorInput("工具名稱", { "data-tool-field": "name", type: "text" }, name)}
        ${editorInput("作者，用逗號分隔", { "data-tool-field": "authors", type: "text" }, (tool.authors || []).join(", "))}
        ${editorInput("連結", { "data-tool-field": "link", type: "url" }, tool.link || "")}
        ${editorInput("連結文字", { "data-tool-field": "linkLabel", type: "text" }, linkLabel)}
      </article>
    `;
  }

  function fillWikiEditor() {
    const draft = cloneData(data);
    const lang = editorLang();
    const guide = (draft.guides && (draft.guides[lang] || draft.guides["zh-Hant"])) || { sections: [] };
    if (wikiEditTitle) wikiEditTitle.value = guide.title || "";
    if (wikiEditSubtitle) wikiEditSubtitle.value = guide.subtitle || "";
    if (wikiEditEyebrow) wikiEditEyebrow.value = guide.eyebrow || "";
    if (wikiEditStats) wikiEditStats.innerHTML = (guide.stats || []).map(statRowHtml).join("");
    if (wikiEditSectionsUi) wikiEditSectionsUi.innerHTML = (guide.sections || []).map(sectionEditorHtml).join("");
    if (wikiEditToolsUi) wikiEditToolsUi.innerHTML = (draft.tools || []).map((tool, idx) => toolEditorHtml(tool || {}, idx, lang)).join("");
    if (wikiEditFaqUi) wikiEditFaqUi.innerHTML = ((draft.faq && (draft.faq[lang] || draft.faq["zh-Hant"])) || []).map((row) => pairRowHtml(row && row[0], row && row[1])).join("");
    if (wikiEditorMeta) {
      const meta = wikiCmsState.meta || {};
      wikiEditorMeta.textContent = meta.revision
        ? `目前版本：#${meta.revision}，${meta.updated_by || "unknown"} / ${meta.updated_role || "creator"} 更新於 ${meta.updated_at || "--"}`
        : "尚未建立後台版本；第一次儲存後會建立可維護版本。";
    }
    setWikiMessage(wikiEditorMessage, "", "");
  }

  function collectPairRows(root, selector = "[data-editor-pair-row]") {
    return Array.from(root ? root.querySelectorAll(selector) : [])
      .map((row) => [fieldValue(row, "[data-pair-title]"), fieldValue(row, "[data-pair-body]")])
      .filter((row) => row[0] || row[1]);
  }

  function collectTextRows(root) {
    return Array.from(root ? root.querySelectorAll("[data-editor-text-row]") : [])
      .map((row) => fieldValue(row, "[data-text-value]"))
      .filter(Boolean);
  }

  function collectStats() {
    return Array.from(wikiEditStats ? wikiEditStats.querySelectorAll("[data-editor-stat-row]") : [])
      .map((row) => [fieldValue(row, "[data-stat-label]"), fieldValue(row, "[data-stat-value]")])
      .filter((row) => row[0] || row[1]);
  }

  function collectSectionCard(card, original) {
    const section = cloneData(original || {});
    const type = String(card.getAttribute("data-section-type") || section.type || "intro");
    section.type = type;
    section.title = fieldValue(card, "[data-section-field='title']");
    const imageRaw = fieldValue(card, "[data-section-field='image']");
    if (imageRaw) section.image = Number(imageRaw);
    if (card.querySelector("[data-section-field='text']")) section.text = fieldValue(card, "[data-section-field='text']");
    if (card.querySelector("[data-section-field='intro']")) section.intro = fieldValue(card, "[data-section-field='intro']");
    if (card.querySelector("[data-section-field='introTitle']")) section.introTitle = fieldValue(card, "[data-section-field='introTitle']");
    const lists = card.querySelectorAll("[data-editor-repeat-list]");
    lists.forEach((list, idx) => {
      const kind = String(list.getAttribute("data-row-kind") || "pair");
      const previousKeys = {
        intro: ["bullets"],
        steps: ["items"],
        imageText: [],
        cards: ["items"],
        sbtChecklist: ["primer", "bullets"],
        ratings: ["items"],
      }[type] || [];
      const key = previousKeys[idx];
      if (!key) return;
      section[key] = kind === "text" ? collectTextRows(list) : collectPairRows(list);
    });
    return section;
  }

  function collectTools(lang) {
    return Array.from(wikiEditToolsUi ? wikiEditToolsUi.querySelectorAll("[data-editor-tool-card]") : []).map((card) => {
      const index = Number(card.getAttribute("data-tool-index") || 0);
      const tool = cloneData((data.tools || [])[index] || {});
      setLocalizedField(tool, "name", lang, fieldValue(card, "[data-tool-field='name']"));
      setLocalizedField(tool, "linkLabel", lang, fieldValue(card, "[data-tool-field='linkLabel']"));
      tool.link = fieldValue(card, "[data-tool-field='link']");
      tool.authors = fieldValue(card, "[data-tool-field='authors']")
        .split(/[,\n，、]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return tool;
    }).filter((tool) => localized(tool.name, lang, "") || tool.link);
  }

  function normalizeInlineSection(section, type) {
    const next = cloneData(section || {});
    next.type = type || next.type || "intro";
    if (!next.title) next.title = "新段落";
    if (["imageText", "ratings"].includes(next.type)) {
      if (next.image === undefined || next.image === null || Number.isNaN(Number(next.image))) next.image = 0;
      if (!next.layout) next.layout = "image-left";
    }
    if (next.type === "intro") {
      if (!next.text) next.text = "";
      if (!Array.isArray(next.bullets)) next.bullets = [];
    }
    if (next.type === "steps" || next.type === "cards" || next.type === "ratings") {
      if (!Array.isArray(next.items)) next.items = [];
    }
    if (next.type === "sbtChecklist") {
      if (!next.introTitle) next.introTitle = "SBT 是什麼？";
      if (!next.text) next.text = "";
      if (!Array.isArray(next.primer)) next.primer = [];
      if (!Array.isArray(next.bullets)) next.bullets = [];
    }
    return next;
  }

  function collectInlinePairRows(root, listName) {
    const list = root ? root.querySelector(`[data-wiki-pair-list="${listName}"]`) : null;
    return Array.from(list ? list.querySelectorAll("[data-wiki-pair-item]") : [])
      .map((row) => [
        cleanInlineText(row.querySelector("[data-wiki-field='pairTitle']")),
        cleanInlineText(row.querySelector("[data-wiki-field='pairBody']")),
      ])
      .filter((row) => row[0] || row[1]);
  }

  function collectInlineTextRows(root, listName) {
    const list = root ? root.querySelector(`[data-wiki-list="${listName}"]`) : null;
    return Array.from(list ? list.querySelectorAll("[data-wiki-list-item]") : [])
      .map((row) => cleanInlineText(row))
      .filter(Boolean);
  }

  function collectInlineStats() {
    const statsRoot = contentEl ? contentEl.querySelector("[data-wiki-stats]") : null;
    return Array.from(statsRoot ? statsRoot.querySelectorAll(".beginner-stat:not([data-wiki-stat-add])") : [])
      .map((row) => [
        cleanInlineText(row.querySelector("[data-wiki-field='statLabel']")),
        cleanInlineText(row.querySelector("[data-wiki-field='statValue']")),
      ])
      .filter((row) => row[0] || row[1]);
  }

  function collectInlineSection(sectionEl, originalSections) {
    const originalIndex = Number(sectionEl.getAttribute("data-wiki-section-index") || 0);
    const original = cloneData((originalSections || [])[originalIndex] || {});
    const type = fieldValue(sectionEl, "[data-wiki-section-type-control]") || String(sectionEl.getAttribute("data-wiki-section-type") || original.type || "intro");
    const section = normalizeInlineSection(original, type);
    section.title = cleanInlineText(sectionEl.querySelector("[data-wiki-field='title']")) || section.title || "";
    section.topic = fieldValue(sectionEl, "[data-wiki-section-topic]") || sectionTopic(original, originalIndex);
    const imageValue = fieldValue(sectionEl, "[data-wiki-section-image]");
    if (imageValue !== "") section.image = Number(imageValue);
    const imageUrlValue = fieldValue(sectionEl, "[data-wiki-section-image-url]");
    if (imageUrlValue) {
      section.imageUrl = imageUrlValue;
    } else {
      delete section.imageUrl;
      delete section.image_url;
    }
    const layoutValue = fieldValue(sectionEl, "[data-wiki-section-layout]");
    if (layoutValue) section.layout = layoutValue;
    const textEl = sectionEl.querySelector("[data-wiki-field='text']");
    if (textEl) section.text = cleanInlineText(textEl);
    const introEl = sectionEl.querySelector("[data-wiki-field='intro']");
    if (introEl) section.intro = cleanInlineText(introEl);
    const introTitleEl = sectionEl.querySelector("[data-wiki-field='introTitle']");
    if (introTitleEl) section.introTitle = cleanInlineText(introTitleEl);
    if (sectionEl.querySelector("[data-wiki-list='bullets']")) section.bullets = collectInlineTextRows(sectionEl, "bullets");
    if (sectionEl.querySelector("[data-wiki-pair-list='items']")) section.items = collectInlinePairRows(sectionEl, "items");
    if (sectionEl.querySelector("[data-wiki-pair-list='primer']")) section.primer = collectInlinePairRows(sectionEl, "primer");
    return normalizeInlineSection(section, section.type);
  }

  function collectInlineSections(lang, originalSections) {
    return Array.from(contentEl ? contentEl.querySelectorAll("[data-wiki-section-type]") : [])
      .map((sectionEl) => collectInlineSection(sectionEl, originalSections || guideFor(lang).sections || []));
  }

  function collectInlineTools(lang) {
    const originalTools = Array.isArray(data.tools) ? data.tools : [];
    return Array.from(toolsEl ? toolsEl.querySelectorAll("[data-wiki-tool-card]") : [])
      .map((card) => {
        const index = Number(card.getAttribute("data-wiki-tool-index") || 0);
        const tool = cloneData(originalTools[index] || { name: {}, authors: [], link: "", linkLabel: {} });
        setLocalizedField(tool, "name", lang, cleanInlineText(card.querySelector("[data-wiki-field='toolName']")));
        setLocalizedField(tool, "linkLabel", lang, cleanInlineText(card.querySelector("[data-wiki-field='toolLinkLabel']")) || localized(tool.linkLabel, lang, ""));
        tool.link = fieldValue(card, "[data-wiki-tool-field='link']");
        tool.authors = cleanInlineText(card.querySelector("[data-wiki-field='toolAuthors']"))
          .split(/[,\n，、]/)
          .map((item) => item.trim())
          .filter(Boolean);
        return tool;
      })
      .filter((tool) => localized(tool.name, lang, "") || tool.link);
  }

  function collectInlineFaq(lang) {
    return Array.from(faqEl ? faqEl.querySelectorAll("[data-wiki-faq-item]") : [])
      .map((item) => [
        cleanInlineText(item.querySelector("[data-wiki-field='faqQuestion']")),
        cleanInlineText(item.querySelector("[data-wiki-field='faqAnswer']")),
      ])
      .filter((row) => row[0] || row[1]);
  }

  function collectInlineLabels(lang) {
    const labels = cloneData(labelsFor(lang));
    document.querySelectorAll("[data-wiki-label-field]").forEach((node) => {
      const key = String(node.getAttribute("data-wiki-label-field") || "").trim();
      if (key) labels[key] = cleanInlineText(node);
    });
    return labels;
  }

  function collectInlineTopics(lang) {
    const originalRows = topicRowsFor(lang);
    return Array.from(wikiTopicGrid ? wikiTopicGrid.querySelectorAll("[data-wiki-topic-item]") : [])
      .map((card) => {
        const index = Number(card.getAttribute("data-wiki-topic-index") || 0);
        const original = originalRows[index] || [];
        const id = String(card.getAttribute("data-topic-id") || original[4] || topicIdForAnchor(original[2]) || `topic-${index}`).trim();
        return {
          id,
          title: cleanInlineText(card.querySelector("[data-wiki-field='topicTitle']")) || original[0] || "",
          subtitle: cleanInlineText(card.querySelector("[data-wiki-field='topicSubtitle']")) || original[1] || "",
          anchor: original[2] || anchorForKnownTopic(id),
          icon: fieldValue(card, "[data-wiki-topic-field='icon']") || original[3] || "lucide:file-text",
        };
      })
      .filter((topic) => topic.title || topic.id);
  }

  function collectInlineMenuLabels(lang) {
    const current = menuLabelsFor(lang);
    const groups = Array.from(docsNav ? docsNav.querySelectorAll("[data-wiki-menu-group]") : [])
      .map((groupEl) => {
        const index = Number(groupEl.getAttribute("data-wiki-menu-group-index") || 0);
        const original = (current.groups || [])[index] || [];
        return {
          title: cleanInlineText(groupEl.querySelector("[data-wiki-field='menuGroupTitle']")) || original[0] || "",
          kicker: cleanInlineText(groupEl.querySelector("[data-wiki-field='menuGroupKicker']")) || original[1] || "",
          ids: Array.isArray(original[2]) ? original[2].map(String) : [],
          icon: original[3] || sidebarGroupIcon(original),
        };
      })
      .filter((group) => group.title || group.kicker || group.ids.length);
    const readMenuField = (field, fallback) => {
      const node = document.querySelector(`[data-wiki-menu-field="${field}"]`);
      return cleanInlineText(node) || fallback || "";
    };
    return {
      label: readMenuField("label", current.label),
      title: readMenuField("title", current.title),
      overview: readMenuField("overview", current.overview),
      groups: groups.length ? groups : current.groups,
    };
  }

  function collectInlineCommands(lang) {
    const originalCommands = Array.isArray(data.commands) ? data.commands : [];
    return Array.from(document.querySelectorAll("[data-wiki-command-card]"))
      .map((card) => {
        const index = Number(card.getAttribute("data-wiki-command-index") || 0);
        const command = cloneData(originalCommands[index] || { name: {}, desc: {}, meta: {}, command: "", icon: "lucide:terminal-square" });
        setLocalizedField(command, "name", lang, cleanInlineText(card.querySelector("[data-wiki-field='commandName']")));
        setLocalizedField(command, "desc", lang, cleanInlineText(card.querySelector("[data-wiki-field='commandDesc']")));
        if (card.querySelector("[data-wiki-field='commandMeta']")) {
          setLocalizedField(command, "meta", lang, cleanInlineText(card.querySelector("[data-wiki-field='commandMeta']")));
        }
        command.command = fieldValue(card, "[data-wiki-command-field='command']");
        command.icon = fieldValue(card, "[data-wiki-command-field='icon']") || command.icon || "lucide:terminal-square";
        return command;
      })
      .filter((command) => localized(command.name, lang, "") || command.command || localized(command.desc, lang, ""));
  }

  function collectInlineCommandShowcase(lang) {
    const original = data.commandShowcase && typeof data.commandShowcase === "object" ? data.commandShowcase : {};
    const originalImages = Array.isArray(original.images) ? original.images : [];
    const images = Array.from(document.querySelectorAll("[data-wiki-showcase-image]"))
      .map((figure) => {
        const index = Number(figure.getAttribute("data-wiki-showcase-index") || 0);
        const item = cloneData(originalImages[index] || { src: "", caption: {} });
        item.src = fieldValue(figure, "[data-wiki-showcase-field='src']") || item.src || "";
        setLocalizedField(item, "caption", lang, cleanInlineText(figure.querySelector("[data-wiki-field='showcaseCaption']")));
        return item;
      })
      .filter((item) => item.src || localized(item.caption, lang, ""));
    return { ...cloneData(original), images };
  }

  function collectInlineImages() {
    const images = Array.isArray(data.images) ? data.images.slice() : [];
    const cover = fieldValue(document, "[data-wiki-cover-image-url]");
    if (cover) images[0] = cover;
    return images;
  }

  function collectInlineSbtItems(lang) {
    const originalRows = sbtItemsData();
    return Array.from(document.querySelectorAll("[data-wiki-sbt-item]"))
      .map((card) => {
        const index = Number(card.getAttribute("data-wiki-sbt-index") || 0);
        const item = cloneData(originalRows[index] || {
          key: "",
          name: {},
          requirement: {},
          badge: {},
          status: "available",
          difficulty: 1,
          icons: [],
        });
        const name = cleanInlineText(card.querySelector("[data-wiki-field='sbtName']"));
        const requirement = cleanInlineText(card.querySelector("[data-wiki-field='sbtRequirement']"));
        const badge = cleanInlineText(card.querySelector("[data-wiki-field='sbtBadge']"));
        setLocalizedField(item, "name", lang, name);
        setLocalizedField(item, "requirement", lang, requirement);
        setLocalizedField(item, "badge", lang, badge);
        item.key = String(item.key || name || localized(item.name, "zh-Hant", "") || "").trim();
        item.status = fieldValue(card, "[data-wiki-sbt-field='status']") || "available";
        item.difficulty = Math.max(0, Math.min(5, Number(fieldValue(card, "[data-wiki-sbt-field='difficulty']") || 0)));
        item.icons = fieldValue(card, "[data-wiki-sbt-field='icons']")
          .split(/[\n,，]+/)
          .map((icon) => icon.trim())
          .filter(Boolean);
        return item;
      })
      .filter((item) => localized(item.name, lang, "") || item.key || localized(item.requirement, lang, ""));
  }

  function draftWikiFromInline() {
    const lang = currentLang();
    const fullDraft = cloneData(data);
    if (!fullDraft.guides || typeof fullDraft.guides !== "object") fullDraft.guides = {};
    const guide = fullDraft.guides[lang] && typeof fullDraft.guides[lang] === "object"
      ? cloneData(fullDraft.guides[lang])
      : cloneData(guideFor(lang));
    guide.title = inlineTextValue(document, "[data-wiki-hero-field='title']") || guide.title || "";
    guide.subtitle = inlineTextValue(document, "[data-wiki-hero-field='subtitle']") || guide.subtitle || "";
    guide.eyebrow = inlineTextValue(document, "[data-wiki-hero-field='eyebrow']") || guide.eyebrow || "";
    guide.stats = collectInlineStats();
    guide.sections = collectInlineSections(lang, Array.isArray(guide.sections) ? guide.sections : []);
    fullDraft.guides[lang] = guide;
    fullDraft.images = collectInlineImages();
    if (!fullDraft.labels || typeof fullDraft.labels !== "object" || Array.isArray(fullDraft.labels)) fullDraft.labels = {};
    fullDraft.labels[lang] = collectInlineLabels(lang);
    if (!fullDraft.topics || typeof fullDraft.topics !== "object" || Array.isArray(fullDraft.topics)) fullDraft.topics = {};
    fullDraft.topics[lang] = collectInlineTopics(lang);
    if (!fullDraft.menuLabels || typeof fullDraft.menuLabels !== "object" || Array.isArray(fullDraft.menuLabels)) fullDraft.menuLabels = {};
    fullDraft.menuLabels[lang] = collectInlineMenuLabels(lang);
    fullDraft.tools = collectInlineTools(lang);
    fullDraft.commands = collectInlineCommands(lang);
    fullDraft.commandShowcase = collectInlineCommandShowcase(lang);
    if (!fullDraft.faq || typeof fullDraft.faq !== "object" || Array.isArray(fullDraft.faq)) fullDraft.faq = {};
    fullDraft.faq[lang] = collectInlineFaq(lang);
    const inlineSbtItems = collectInlineSbtItems(lang);
    if (inlineSbtItems.length) fullDraft.sbtItems = inlineSbtItems;
    return fullDraft;
  }

  function draftWikiFromEditor() {
    const lang = editorLang();
    const fullDraft = cloneData(data);
    if (!fullDraft.guides || typeof fullDraft.guides !== "object") fullDraft.guides = {};
    const guide = fullDraft.guides[lang] && typeof fullDraft.guides[lang] === "object"
      ? cloneData(fullDraft.guides[lang])
      : {};
    guide.title = String(wikiEditTitle?.value || "").trim();
    guide.subtitle = String(wikiEditSubtitle?.value || "").trim();
    guide.eyebrow = String(wikiEditEyebrow?.value || "").trim();
    guide.stats = collectStats();
    const originalSections = Array.isArray(guide.sections) ? guide.sections : [];
    guide.sections = Array.from(wikiEditSectionsUi ? wikiEditSectionsUi.querySelectorAll("[data-editor-section-card]") : [])
      .map((card) => collectSectionCard(card, originalSections[Number(card.getAttribute("data-section-index") || 0)]));
    fullDraft.guides[lang] = guide;
    fullDraft.tools = collectTools(lang);
    if (!fullDraft.faq || typeof fullDraft.faq !== "object" || Array.isArray(fullDraft.faq)) fullDraft.faq = {};
    fullDraft.faq[lang] = collectPairRows(wikiEditFaqUi);
    return fullDraft;
  }

  function shouldTranslateString(value) {
    const text = String(value || "").trim();
    if (!text || /^https?:\/\//i.test(text)) return false;
    return /[A-Za-z\u3400-\u9fff\uac00-\ud7af]/.test(text);
  }

  function collectTranslationRefs(node, refs = [], skipKeys = new Set(), parent = null, key = "") {
    if (typeof node === "string") {
      if (parent && !skipKeys.has(String(key)) && shouldTranslateString(node)) refs.push({ parent, key, value: node });
      return refs;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => collectTranslationRefs(item, refs, skipKeys, node, idx));
      return refs;
    }
    if (node && typeof node === "object") {
      Object.entries(node).forEach(([childKey, value]) => {
        if (skipKeys.has(childKey)) return;
        collectTranslationRefs(value, refs, skipKeys, node, childKey);
      });
    }
    return refs;
  }

  async function translateRows(texts, targetLang) {
    if (!texts.length) return { items: [], modes: [] };
    const items = [];
    const modes = [];
    for (let start = 0; start < texts.length; start += 180) {
      const chunk = texts.slice(start, start + 180);
      const response = await fetch(wikiApiUrl("/api/intel/translate-texts"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: wikiAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ lang: targetLang, texts: chunk }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `翻譯失敗 HTTP ${response.status}`);
      items.push(...(Array.isArray(payload.items) ? payload.items : chunk));
      modes.push(String(payload.mode || ""));
    }
    return { items, modes };
  }

  async function translatedClone(value, targetLang, skipKeys = new Set()) {
    const cloned = cloneData(value);
    const refs = collectTranslationRefs(cloned, [], skipKeys);
    const { items, modes } = await translateRows(refs.map((ref) => ref.value), targetLang);
    refs.forEach((ref, idx) => {
      ref.parent[ref.key] = String(items[idx] || ref.value);
    });
    return { value: cloned, modes };
  }

  async function translateWikiDraftFromSource(draft, sourceLang) {
    const sourceGuide = draft.guides && draft.guides[sourceLang];
    const sourceFaq = draft.faq && draft.faq[sourceLang];
    const allModes = [];
    const targets = ["zh-Hant", "zh-Hans", "en", "ko"].filter((lang) => lang !== sourceLang);
    for (const targetLang of targets) {
      if (sourceGuide) {
        const translatedGuide = await translatedClone(sourceGuide, targetLang, new Set(["type", "topic", "image", "layout"]));
        draft.guides[targetLang] = translatedGuide.value;
        allModes.push(...translatedGuide.modes);
      }
      if (sourceFaq) {
        const translatedFaq = await translatedClone(sourceFaq, targetLang);
        draft.faq[targetLang] = translatedFaq.value;
        allModes.push(...translatedFaq.modes);
      }
      if (Array.isArray(draft.tools)) {
        const sourceNames = draft.tools.map((tool) => localized(tool.name, sourceLang, ""));
        const sourceLabels = draft.tools.map((tool) => localized(tool.linkLabel, sourceLang, ""));
        const translatedNames = await translateRows(sourceNames, targetLang);
        const translatedLabels = await translateRows(sourceLabels, targetLang);
        allModes.push(...translatedNames.modes, ...translatedLabels.modes);
        draft.tools.forEach((tool, idx) => {
          setLocalizedField(tool, "name", targetLang, String(translatedNames.items[idx] || sourceNames[idx] || ""));
          setLocalizedField(tool, "linkLabel", targetLang, String(translatedLabels.items[idx] || sourceLabels[idx] || ""));
        });
      }
    }
    return { draft, modes: Array.from(new Set(allModes.filter(Boolean))) };
  }

  async function saveWikiDraft(draft, sourceLang) {
    const meta = wikiCmsState.meta || {};
    const body = {
      data: draft,
      source_lang: normalizeLang(sourceLang || currentLang()),
      auto_translate: true,
    };
    if (meta.content_hash) body.base_hash = String(meta.content_hash);
    const response = await fetch(wikiApiUrl("/api/wiki/beginner"), {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: wikiAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      if (response.status === 401 || response.status === 403) {
        clearWikiAuthToken();
        await fetchWikiAuthState();
      }
      if (response.status === 409 || payload?.code === "wiki_conflict") {
        throw new Error(payload?.error || "Wiki 已被其他人更新，請重新載入後再儲存，避免覆蓋對方。");
      }
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    const wiki = payload.wiki || {};
    if (wiki.data && typeof wiki.data === "object") data = mergeWikiData(staticWikiSeed, wiki.data);
    wikiCmsState.meta = wiki.meta || {};
    return payload;
  }

  function setInlineBusy(busy) {
    [wikiInlineSave, wikiInlineTranslateSave, wikiInlineAddSection, wikiInlineExit, wikiEditorBtn].forEach((button) => {
      if (button) button.disabled = Boolean(busy);
    });
  }

  function setWikiInlineEditing(enabled) {
    const next = Boolean(enabled);
    if (next && !canEditWiki()) {
      setWikiMessage(wikiAuthMessage, "", "");
      openWikiModal(wikiAuthModal);
      return;
    }
    wikiInlineEditMode = next;
    document.body.classList.toggle("is-wiki-inline-editing", wikiInlineEditMode);
    if (wikiInlineToolbar) wikiInlineToolbar.hidden = !wikiInlineEditMode;
    closeWikiModal(wikiEditorModal);
    setWikiMessage(wikiInlineMessage, "", "");
    renderStaticPage(currentLang());
    updateWikiCreatorUi();
  }

  function refreshInlineSectionNumbers() {
    Array.from(contentEl ? contentEl.querySelectorAll("[data-wiki-section-type]") : []).forEach((section, index) => {
      const label = section.querySelector(".wiki-inline-section-controls > span");
      const type = fieldValue(section, "[data-wiki-section-type-control]") || String(section.getAttribute("data-wiki-section-type") || "intro");
      if (label) label.textContent = `段落 ${String(index + 1).padStart(2, "0")} / ${type}`;
    });
  }

  function refreshInlineStepNumbers(root = document) {
    root.querySelectorAll(".beginner-step-grid").forEach((grid) => {
      Array.from(grid.querySelectorAll("[data-wiki-pair-item]")).forEach((item, index) => {
        const badge = item.querySelector(".wiki-inline-step-index");
        if (badge) badge.textContent = String(index + 1);
      });
    });
  }

  function inlinePairItemForList(list, title = "新項目", body = "在這裡輸入內容。") {
    if (list && list.classList.contains("beginner-step-grid")) {
      const nextIndex = list.querySelectorAll("[data-wiki-pair-item]").length + 1;
      return `
        <article class="beginner-step-card" data-wiki-pair-item>
          <span class="wiki-inline-step-index">${nextIndex}</span>
          <h3 ${editAttr("pairTitle")}>${escapeHtml(title)}</h3>
          <p ${editAttr("pairBody")}>${escapeHtml(body)}</p>
          ${inlineRemoveButton()}
        </article>
      `;
    }
    if (list && list.classList.contains("beginner-rating-grid")) {
      return `
        <article class="beginner-rating-card" data-wiki-pair-item>
          <strong ${editAttr("pairTitle")}>${escapeHtml(title)}</strong>
          <span ${editAttr("pairBody")}>${escapeHtml(body)}</span>
          ${inlineRemoveButton()}
        </article>
      `;
    }
    if (list && list.classList.contains("beginner-sbt-primer-grid")) {
      return `
        <article class="beginner-sbt-primer-item" data-wiki-pair-item>
          <strong ${editAttr("pairTitle")}>${escapeHtml(title)}</strong>
          <span ${editAttr("pairBody")}>${escapeHtml(body)}</span>
          ${inlineRemoveButton()}
        </article>
      `;
    }
    return pairItemHtml(title, body, "beginner-info-card");
  }

  function inlineStatHtml(label = "新重點", value = "在這裡輸入內容") {
    return `
      <article class="beginner-stat" data-wiki-stat-index="-1">
        <span class="beginner-stat-label" ${editAttr("statLabel")}>${escapeHtml(label)}</span>
        <div class="beginner-stat-value" ${editAttr("statValue")}>${escapeHtml(value)}</div>
        ${inlineRemoveButton()}
      </article>
    `;
  }

  function inlineToolHtml(index, lang) {
    const labels = labelsFor(lang);
    return `
      <article class="beginner-tool-card is-wiki-inline-card" data-wiki-tool-card data-wiki-tool-index="${index}">
        <div class="beginner-tool-top">
          <span class="beginner-tool-index">${String(index + 1).padStart(2, "0")}</span>
          <iconify-icon icon="lucide:wrench"></iconify-icon>
        </div>
        <div class="beginner-tool-name" ${editAttr("toolName")}>新工具</div>
        <div class="beginner-tool-meta">${escapeHtml(labels.authorLabel || "作者")}：<span ${editAttr("toolAuthors")}>作者名稱</span></div>
        <label class="wiki-inline-link-field" contenteditable="false">
          <span>連結</span>
          <input data-wiki-tool-field="link" type="url" value="" />
        </label>
        <div class="beginner-tool-link is-editing" contenteditable="false"><iconify-icon icon="lucide:external-link"></iconify-icon><span ${editAttr("toolLinkLabel")}>${escapeHtml(labels.linkLabel || "Link")}</span></div>
        ${inlineRemoveButton()}
      </article>
    `;
  }

  function inlineFaqHtml(question = "新的問題？", answer = "在這裡輸入答案。") {
    return `
      <article class="beginner-faq-item is-wiki-inline-card" data-wiki-faq-item>
        <div class="beginner-faq-q">Q: <span ${editAttr("faqQuestion")}>${escapeHtml(question)}</span></div>
        <div class="beginner-faq-a">A: <span ${editAttr("faqAnswer")}>${escapeHtml(answer)}</span></div>
        ${inlineRemoveButton()}
      </article>
    `;
  }

  function inlineCommandHtml(index) {
    return `
      <article class="beginner-command-card is-wiki-inline-card" data-wiki-command-card data-wiki-command-index="${index}">
        <div class="beginner-command-top">
          <span class="beginner-tool-index">${String(index + 1).padStart(2, "0")}</span>
          <iconify-icon icon="lucide:terminal-square"></iconify-icon>
        </div>
        <h4 ${editAttr("commandName")}>新指令</h4>
        <p ${editAttr("commandDesc")}>在這裡輸入指令用途。</p>
        <label class="wiki-inline-link-field" contenteditable="false">
          <span>Command</span>
          <input data-wiki-command-field="command" value="" />
        </label>
        <label class="wiki-inline-link-field" contenteditable="false">
          <span>Icon</span>
          <input data-wiki-command-field="icon" value="lucide:terminal-square" />
        </label>
        ${inlineRemoveButton()}
      </article>
    `;
  }

  function inlineShowcaseHtml(index) {
    return `
      <figure class="beginner-command-focus-figure is-wiki-inline-card" data-wiki-showcase-image data-wiki-showcase-index="${index}">
        <img loading="lazy" src="" alt="" />
        <figcaption ${editAttr("showcaseCaption")}>新增範例說明</figcaption>
        <label class="wiki-inline-link-field" contenteditable="false">
          <span>圖片</span>
          <input data-wiki-showcase-field="src" type="url" value="" />
        </label>
        ${inlineRemoveButton()}
      </figure>
    `;
  }

  function inlineSbtHtml(index, lang) {
    return `
      <article class="sbt-item is-wiki-inline-card" data-wiki-sbt-item data-wiki-sbt-index="${index}">
        <div class="sbt-item-icons"></div>
        <div class="sbt-item-main">
          <div class="sbt-item-top">
            <div class="sbt-item-name" ${editAttr("sbtName")}>新的 SBT</div>
            <div class="sbt-item-badges">
              <span class="sbt-difficulty" aria-label="難度 1 / 5"><span class="sbt-difficulty-label">難度</span><span class="sbt-stars">${sbtDifficultyStars(1)}</span></span>
              <span class="status s-on" ${editAttr("sbtBadge")}>✅ Available</span>
            </div>
          </div>
          <p class="sbt-item-req" ${editAttr("sbtRequirement")}>在這裡輸入取得條件。</p>
          <div class="wiki-inline-sbt-controls" contenteditable="false">
            <label class="wiki-inline-link-field">
              <span>狀態</span>
              <select data-wiki-sbt-field="status">${sbtStatusOptions("available")}</select>
            </label>
            <label class="wiki-inline-link-field">
              <span>難度</span>
              <input data-wiki-sbt-field="difficulty" type="number" min="0" max="5" step="1" value="1" />
            </label>
            <label class="wiki-inline-sbt-icons">
              <span>Icons</span>
              <textarea data-wiki-sbt-field="icons" rows="2" placeholder="每行一個檔名或圖片網址"></textarea>
            </label>
          </div>
          ${inlineRemoveButton()}
        </div>
      </article>
    `;
  }

  async function saveInlineDraft(translateAll) {
    if (!wikiInlineEditMode) return;
    setInlineBusy(true);
    const sourceLang = currentLang();
    setWikiMessage(wikiInlineMessage, "正在儲存，翻譯 agent 會自動掃描並同步其他語言...", "");
    try {
      const draft = draftWikiFromInline();
      await saveWikiDraft(draft, sourceLang);
      renderStaticPage(sourceLang);
      const modes = Array.isArray(wikiCmsState.meta?.translation_modes) ? wikiCmsState.meta.translation_modes.join(", ") : "";
      setWikiMessage(
        wikiInlineMessage,
        wikiCmsState.meta?.auto_translate
          ? `已儲存，翻譯 agent 已同步其他語言${modes ? `。模式：${modes}` : "。"}`
          : "已儲存並更新 Wiki。",
        "ok"
      );
    } catch (error) {
      setWikiMessage(wikiInlineMessage, String(error?.message || error), "error");
    } finally {
      setInlineBusy(false);
    }
  }

  function bindInlineEditingUi() {
    if (wikiInlineExit && wikiInlineExit.dataset.boundWikiInline !== "1") {
      wikiInlineExit.dataset.boundWikiInline = "1";
      wikiInlineExit.addEventListener("click", () => setWikiInlineEditing(false));
    }
    if (wikiInlineSave && wikiInlineSave.dataset.boundWikiInline !== "1") {
      wikiInlineSave.dataset.boundWikiInline = "1";
      wikiInlineSave.addEventListener("click", () => saveInlineDraft(false));
    }
    if (wikiInlineTranslateSave && wikiInlineTranslateSave.dataset.boundWikiInline !== "1") {
      wikiInlineTranslateSave.dataset.boundWikiInline = "1";
      wikiInlineTranslateSave.addEventListener("click", () => saveInlineDraft(true));
    }
    if (wikiInlineAddSection && wikiInlineAddSection.dataset.boundWikiInline !== "1") {
      wikiInlineAddSection.dataset.boundWikiInline = "1";
      wikiInlineAddSection.addEventListener("click", () => {
        data = draftWikiFromInline();
        const lang = currentLang();
        if (!data.guides || typeof data.guides !== "object") data.guides = {};
        const guide = data.guides[lang] || guideFor(lang);
        if (!Array.isArray(guide.sections)) guide.sections = [];
        guide.sections.push(normalizeInlineSection({
          type: "intro",
          topic: currentTopic() || "start",
          title: "新段落",
          text: "在這裡輸入內容。",
          bullets: ["新增重點"],
        }, "intro"));
        data.guides[lang] = guide;
        renderStaticPage(lang);
        const sections = contentEl ? contentEl.querySelectorAll("[data-wiki-section-type]") : [];
        const last = sections.length ? sections[sections.length - 1] : null;
        if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
        setWikiMessage(wikiInlineMessage, "已新增段落，尚未儲存。", "");
      });
    }
    if (docsMain && docsMain.dataset.boundWikiInline !== "1") {
      docsMain.dataset.boundWikiInline = "1";
      docsMain.addEventListener("click", (event) => {
        if (!wikiInlineEditMode) return;
        const removeItem = event.target.closest("[data-wiki-item-remove]");
        if (removeItem) {
          event.preventDefault();
          const target = removeItem.closest("[data-wiki-list-item], [data-wiki-pair-item], .beginner-stat:not([data-wiki-stat-add]), [data-wiki-tool-card], [data-wiki-faq-item], [data-wiki-sbt-item], [data-wiki-command-card], [data-wiki-showcase-image]");
          if (target) target.remove();
          refreshInlineStepNumbers();
          setWikiMessage(wikiInlineMessage, "已移除項目，尚未儲存。", "");
          return;
        }
        const moveButton = event.target.closest("[data-wiki-section-move]");
        if (moveButton) {
          event.preventDefault();
          const section = moveButton.closest("[data-wiki-section-type]");
          const sections = Array.from(contentEl ? contentEl.querySelectorAll("[data-wiki-section-type]") : []);
          const index = sections.indexOf(section);
          const direction = String(moveButton.getAttribute("data-wiki-section-move") || "");
          if (direction === "up" && index > 0) sections[index - 1].before(section);
          if (direction === "down" && index >= 0 && index < sections.length - 1) sections[index + 1].after(section);
          refreshInlineSectionNumbers();
          setWikiMessage(wikiInlineMessage, "段落順序已調整，尚未儲存。", "");
          return;
        }
        const removeSection = event.target.closest("[data-wiki-section-remove]");
        if (removeSection) {
          event.preventDefault();
          removeSection.closest("[data-wiki-section-type]")?.remove();
          refreshInlineSectionNumbers();
          setWikiMessage(wikiInlineMessage, "已刪除段落，尚未儲存。", "");
          return;
        }
        const addListItem = event.target.closest("[data-wiki-list-add]");
        if (addListItem) {
          event.preventDefault();
          const list = addListItem.closest("[data-wiki-list], [data-wiki-pair-list]");
          const controls = addListItem.closest(".wiki-inline-list-controls");
          const kind = String(addListItem.getAttribute("data-wiki-list-add") || "");
          if (list && controls) {
            controls.insertAdjacentHTML("beforebegin", kind === "text" ? textListItemHtml("新增項目") : inlinePairItemForList(list));
            refreshInlineStepNumbers(list);
            setWikiMessage(wikiInlineMessage, "已新增項目，尚未儲存。", "");
          }
          return;
        }
        const addStat = event.target.closest("[data-wiki-stat-add]");
        if (addStat) {
          event.preventDefault();
          addStat.insertAdjacentHTML("beforebegin", inlineStatHtml());
          setWikiMessage(wikiInlineMessage, "已新增首頁重點，尚未儲存。", "");
          return;
        }
        const addTool = event.target.closest("[data-wiki-tool-add]");
        if (addTool) {
          event.preventDefault();
          const index = toolsEl ? toolsEl.querySelectorAll("[data-wiki-tool-card]").length : 0;
          addTool.insertAdjacentHTML("beforebegin", inlineToolHtml(index, currentLang()));
          setWikiMessage(wikiInlineMessage, "已新增工具，尚未儲存。", "");
          return;
        }
        const addFaq = event.target.closest("[data-wiki-faq-add]");
        if (addFaq) {
          event.preventDefault();
          addFaq.insertAdjacentHTML("beforebegin", inlineFaqHtml());
          setWikiMessage(wikiInlineMessage, "已新增 FAQ，尚未儲存。", "");
          return;
        }
        const addSbt = event.target.closest("[data-wiki-sbt-add]");
        if (addSbt) {
          event.preventDefault();
          const index = document.querySelectorAll("[data-wiki-sbt-item]").length;
          addSbt.insertAdjacentHTML("beforebegin", inlineSbtHtml(index, currentLang()));
          setWikiMessage(wikiInlineMessage, "已新增 SBT，尚未儲存。", "");
          return;
        }
        const addCommand = event.target.closest("[data-wiki-command-add]");
        if (addCommand) {
          event.preventDefault();
          const index = document.querySelectorAll("[data-wiki-command-card]").length;
          addCommand.insertAdjacentHTML("beforebegin", inlineCommandHtml(index));
          setWikiMessage(wikiInlineMessage, "已新增指令，尚未儲存。", "");
          return;
        }
        const addShowcase = event.target.closest("[data-wiki-showcase-add]");
        if (addShowcase) {
          event.preventDefault();
          const index = document.querySelectorAll("[data-wiki-showcase-image]").length;
          addShowcase.insertAdjacentHTML("beforebegin", inlineShowcaseHtml(index));
          setWikiMessage(wikiInlineMessage, "已新增範例圖，尚未儲存。", "");
        }
      });
      docsMain.addEventListener("change", (event) => {
        if (!wikiInlineEditMode) return;
        const typeControl = event.target.closest("[data-wiki-section-type-control]");
        if (typeControl) {
          data = draftWikiFromInline();
          renderStaticPage(currentLang());
          setWikiMessage(wikiInlineMessage, "段落版型已切換，尚未儲存。", "");
          return;
        }
        const layoutControl = event.target.closest("[data-wiki-section-layout]");
        if (layoutControl) {
          const section = layoutControl.closest("[data-wiki-section-type]");
          if (section) {
            section.classList.remove("is-layout-image-left", "is-layout-image-right", "is-layout-image-top");
            section.classList.add(`is-layout-${layoutControl.value}`);
          }
          setWikiMessage(wikiInlineMessage, "圖片位置已調整，尚未儲存。", "");
          return;
        }
        const imageControl = event.target.closest("[data-wiki-section-image]");
        if (imageControl) {
          const section = imageControl.closest("[data-wiki-section-type]");
          const img = section ? section.querySelector(".beginner-static-media img") : null;
          const src = Array.isArray(data.images) ? data.images[Number(imageControl.value) || 0] : "";
          if (img && src) img.src = src;
          setWikiMessage(wikiInlineMessage, "圖片已切換，尚未儲存。", "");
          return;
        }
        const imageUrlControl = event.target.closest("[data-wiki-section-image-url]");
        if (imageUrlControl) {
          const section = imageUrlControl.closest("[data-wiki-section-type]");
          const img = section ? section.querySelector(".beginner-static-media img") : null;
          const src = String(imageUrlControl.value || "").trim();
          if (img && src) img.src = src;
          setWikiMessage(wikiInlineMessage, "圖片網址已更新，尚未儲存。", "");
          return;
        }
        const coverImageControl = event.target.closest("[data-wiki-cover-image-url]");
        if (coverImageControl) {
          if (coverImg && coverImageControl.value) coverImg.src = String(coverImageControl.value || "").trim();
          setWikiMessage(wikiInlineMessage, "封面圖片已更新，尚未儲存。", "");
          return;
        }
        const topicIconControl = event.target.closest("[data-wiki-topic-field='icon']");
        if (topicIconControl) {
          const topic = topicIconControl.closest("[data-wiki-topic-item]");
          const icon = topic ? topic.querySelector(".beginner-wiki-topic-icon iconify-icon") : null;
          if (icon) icon.setAttribute("icon", String(topicIconControl.value || "lucide:file-text").trim());
          setWikiMessage(wikiInlineMessage, "分類圖示已更新，尚未儲存。", "");
          return;
        }
        const commandIconControl = event.target.closest("[data-wiki-command-field='icon']");
        if (commandIconControl) {
          const card = commandIconControl.closest("[data-wiki-command-card]");
          const icon = card ? card.querySelector(".beginner-command-top iconify-icon") : null;
          if (icon) icon.setAttribute("icon", String(commandIconControl.value || "lucide:terminal-square").trim());
          setWikiMessage(wikiInlineMessage, "指令圖示已更新，尚未儲存。", "");
          return;
        }
        const showcaseSrcControl = event.target.closest("[data-wiki-showcase-field='src']");
        if (showcaseSrcControl) {
          const figure = showcaseSrcControl.closest("[data-wiki-showcase-image]");
          const img = figure ? figure.querySelector("img") : null;
          if (img) img.src = String(showcaseSrcControl.value || "").trim();
          setWikiMessage(wikiInlineMessage, "範例圖片已更新，尚未儲存。", "");
          return;
        }
        const sbtField = event.target.closest("[data-wiki-sbt-field]");
        if (sbtField) {
          const card = sbtField.closest("[data-wiki-sbt-item]");
          if (card && sbtField.getAttribute("data-wiki-sbt-field") === "difficulty") {
            const nextDifficulty = Math.max(0, Math.min(5, Number(sbtField.value || 0)));
            const stars = card.querySelector(".sbt-stars");
            if (stars) stars.innerHTML = sbtDifficultyStars(nextDifficulty);
          }
          if (card && sbtField.getAttribute("data-wiki-sbt-field") === "status") {
            const badge = card.querySelector("[data-wiki-field='sbtBadge']");
            if (badge && !String(badge.textContent || "").trim()) badge.textContent = sbtField.value === "available" ? "✅ Available" : sbtField.value;
            badge?.classList.toggle("s-on", sbtField.value === "available");
            badge?.classList.toggle("s-off", sbtField.value !== "available");
          }
          setWikiMessage(wikiInlineMessage, "SBT 設定已更新，尚未儲存。", "");
        }
      });
    }
  }

  function bindWikiCreatorUi() {
    bindInlineEditingUi();
    if (wikiLoginBtn && wikiLoginBtn.dataset.boundWikiAuth !== "1") {
      wikiLoginBtn.dataset.boundWikiAuth = "1";
      wikiLoginBtn.addEventListener("click", () => {
        setWikiMessage(wikiAuthMessage, "", "");
        openWikiModal(wikiAuthModal);
      });
    }
    if (wikiLogoutBtn && wikiLogoutBtn.dataset.boundWikiAuth !== "1") {
      wikiLogoutBtn.dataset.boundWikiAuth = "1";
      wikiLogoutBtn.addEventListener("click", async () => {
        wikiLogoutBtn.disabled = true;
        try {
          if (wikiInlineEditMode) setWikiInlineEditing(false);
          await submitWikiLogout();
        } finally {
          wikiLogoutBtn.disabled = false;
        }
      });
    }
    document.querySelectorAll("[data-beginner-wiki-auth-close]").forEach((button) => {
      if (button.dataset.boundWikiAuthClose === "1") return;
      button.dataset.boundWikiAuthClose = "1";
      button.addEventListener("click", () => closeWikiModal(wikiAuthModal));
    });
    document.querySelectorAll("[data-beginner-wiki-editor-close]").forEach((button) => {
      if (button.dataset.boundWikiEditorClose === "1") return;
      button.dataset.boundWikiEditorClose = "1";
      button.addEventListener("click", () => closeWikiModal(wikiEditorModal));
    });
    if (wikiAuthForm && wikiAuthForm.dataset.boundWikiAuth !== "1") {
      wikiAuthForm.dataset.boundWikiAuth = "1";
      wikiAuthForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = document.getElementById("beginner-wiki-auth-username");
        const password = document.getElementById("beginner-wiki-auth-password");
        setWikiMessage(wikiAuthMessage, "登入中...", "");
        try {
          await submitWikiLogin(username ? username.value : "", password ? password.value : "");
          setWikiMessage(wikiAuthMessage, "登入成功。", "ok");
          closeWikiModal(wikiAuthModal);
        } catch (error) {
          setWikiMessage(wikiAuthMessage, String(error?.message || error), "error");
        }
      });
    }
    if (wikiEditorBtn && wikiEditorBtn.dataset.boundWikiEditor !== "1") {
      wikiEditorBtn.dataset.boundWikiEditor = "1";
      wikiEditorBtn.addEventListener("click", () => {
        setWikiInlineEditing(!wikiInlineEditMode);
      });
    }
    if (wikiEditorLang && wikiEditorLang.dataset.boundWikiEditor !== "1") {
      wikiEditorLang.dataset.boundWikiEditor = "1";
      wikiEditorLang.addEventListener("change", fillWikiEditor);
    }
    if (wikiAddStat && wikiAddStat.dataset.boundWikiEditor !== "1") {
      wikiAddStat.dataset.boundWikiEditor = "1";
      wikiAddStat.addEventListener("click", () => {
        if (wikiEditStats) wikiEditStats.insertAdjacentHTML("beforeend", statRowHtml(["", ""]));
      });
    }
    if (wikiAddFaq && wikiAddFaq.dataset.boundWikiEditor !== "1") {
      wikiAddFaq.dataset.boundWikiEditor = "1";
      wikiAddFaq.addEventListener("click", () => {
        if (wikiEditFaqUi) wikiEditFaqUi.insertAdjacentHTML("beforeend", pairRowHtml("", ""));
      });
    }
    if (wikiAddTool && wikiAddTool.dataset.boundWikiEditor !== "1") {
      wikiAddTool.dataset.boundWikiEditor = "1";
      wikiAddTool.addEventListener("click", () => {
        if (!wikiEditToolsUi) return;
        const index = wikiEditToolsUi.querySelectorAll("[data-editor-tool-card]").length;
        wikiEditToolsUi.insertAdjacentHTML("beforeend", toolEditorHtml({ name: {}, authors: [], link: "", linkLabel: {} }, index, editorLang()));
      });
    }
    if (wikiEditorRefresh && wikiEditorRefresh.dataset.boundWikiEditor !== "1") {
      wikiEditorRefresh.dataset.boundWikiEditor = "1";
      wikiEditorRefresh.addEventListener("click", async () => {
        wikiEditorRefresh.disabled = true;
        setWikiMessage(wikiEditorMessage, "重新載入中...", "");
        try {
          await loadCmsWikiData();
          fillWikiEditor();
          renderStaticPage(currentLang());
          setWikiMessage(wikiEditorMessage, "已重新載入。", "ok");
        } catch (error) {
          setWikiMessage(wikiEditorMessage, String(error?.message || error), "error");
        } finally {
          wikiEditorRefresh.disabled = false;
        }
      });
    }
    if (wikiEditorForm && wikiEditorForm.dataset.boundWikiDelegate !== "1") {
      wikiEditorForm.dataset.boundWikiDelegate = "1";
      wikiEditorForm.addEventListener("click", (event) => {
        const removeRow = event.target.closest("[data-editor-remove-row]");
        if (removeRow) {
          removeRow.closest("[data-editor-pair-row], [data-editor-text-row], [data-editor-stat-row]")?.remove();
          return;
        }
        const removeCard = event.target.closest("[data-editor-remove-card]");
        if (removeCard) {
          removeCard.closest("[data-editor-tool-card]")?.remove();
          return;
        }
        const addRow = event.target.closest("[data-editor-add-row]");
        if (addRow) {
          const list = addRow.closest(".beginner-wiki-field-group")?.querySelector("[data-editor-repeat-list]");
          if (!list) return;
          const kind = String(addRow.getAttribute("data-row-kind") || list.getAttribute("data-row-kind") || "pair");
          list.insertAdjacentHTML("beforeend", kind === "text" ? textRowHtml("") : pairRowHtml("", ""));
        }
      });
    }
    if (wikiEditorTranslateSave && wikiEditorTranslateSave.dataset.boundWikiEditor !== "1") {
      wikiEditorTranslateSave.dataset.boundWikiEditor = "1";
      wikiEditorTranslateSave.addEventListener("click", async () => {
        wikiEditorTranslateSave.disabled = true;
        const saveBtn = document.getElementById("beginner-wiki-editor-save");
        if (saveBtn) saveBtn.disabled = true;
        setWikiMessage(wikiEditorMessage, "正在儲存，翻譯 agent 會自動掃描並同步其他語言...", "");
        try {
          const sourceLang = editorLang();
          const draft = draftWikiFromEditor();
          await saveWikiDraft(draft, sourceLang);
          renderStaticPage(currentLang());
          fillWikiEditor();
          const modes = Array.isArray(wikiCmsState.meta?.translation_modes) ? wikiCmsState.meta.translation_modes.join(", ") : "";
          setWikiMessage(wikiEditorMessage, `已儲存，翻譯 agent 已同步其他語言${modes ? `。模式：${modes}` : "。"}`, "ok");
        } catch (error) {
          setWikiMessage(wikiEditorMessage, String(error?.message || error), "error");
        } finally {
          wikiEditorTranslateSave.disabled = false;
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
    if (wikiEditorForm && wikiEditorForm.dataset.boundWikiEditor !== "1") {
      wikiEditorForm.dataset.boundWikiEditor = "1";
      wikiEditorForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveBtn = document.getElementById("beginner-wiki-editor-save");
        if (saveBtn) saveBtn.disabled = true;
        setWikiMessage(wikiEditorMessage, "正在儲存，翻譯 agent 會自動掃描並同步其他語言...", "");
        try {
          const draft = draftWikiFromEditor();
          await saveWikiDraft(draft, editorLang());
          renderStaticPage(currentLang());
          fillWikiEditor();
          const modes = Array.isArray(wikiCmsState.meta?.translation_modes) ? wikiCmsState.meta.translation_modes.join(", ") : "";
          setWikiMessage(wikiEditorMessage, `已儲存，翻譯 agent 已同步其他語言${modes ? `。模式：${modes}` : "。"}`, "ok");
        } catch (error) {
          setWikiMessage(wikiEditorMessage, String(error?.message || error), "error");
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }
  }

  function renderStaticPage(lang) {
    const tag = saveLang(lang);
    renderStaticGuide(tag);
    renderStaticTools(tag);
    renderStaticFaq(tag);
    renderStaticSbt(tag);
    bindWikiEntry();
    applyWikiSearch("");
    updateTimelineLocale(tag);
    syncTimelineActive();
  }

  function observeSections() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("inview");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    document.querySelectorAll(".observe").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        el.style.setProperty("--delay", "0ms");
        el.classList.add("inview");
      } else {
        observer.observe(el);
      }
    });
  }

  async function bootBeginnerPage() {
    const requestedLang = new URLSearchParams(window.location.search).get("lang");
    bindWikiCreatorUi();
    await loadCmsWikiData();
    renderStaticPage(requestedLang || currentLang());
    bindTimelineNav();
    fetchWikiAuthState();
    window.addEventListener("scroll", queueTimelineSync, { passive: true });
    window.addEventListener("resize", queueTimelineSync);
    if (langSelect) {
      langSelect.addEventListener("change", () => {
        if (wikiInlineEditMode) data = draftWikiFromInline();
        renderStaticPage(langSelect.value);
      });
    }
    document.addEventListener("click", (event) => {
      if (!wikiMenu || !wikiMenuToggle) return;
      if (wikiMenu.hidden) return;
      if (wikiMenu.contains(event.target) || wikiMenuToggle.contains(event.target)) return;
      setWikiMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setWikiMenuOpen(false);
        closeWikiModal(wikiAuthModal);
        closeWikiModal(wikiEditorModal);
      }
    });
    window.addEventListener("popstate", () => {
      if (wikiInlineEditMode) data = draftWikiFromInline();
      renderStaticPage(currentLang());
      scrollToGuideTop("auto");
    });
    observeSections();
  }

  bootBeginnerPage();
})();
