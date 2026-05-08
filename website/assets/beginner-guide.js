// Static renderer for beginner.html. The backend Notion API remains in ai_intel_server.py,
// but this page intentionally renders from local static data by default.
(function initBeginnerPage() {
  const LANG_KEY = "intel_ui_lang";
  const data = window.BEGINNER_GUIDE_STATIC || {};
  const contentEl = document.getElementById("beginner-md-content");
  const toolsEl = document.getElementById("beginner-tools-list");
  const faqEl = document.getElementById("beginner-faq-list");
  const coverWrap = document.getElementById("beginner-cover");
  const coverImg = document.getElementById("beginner-cover-img");
  const langSelect = document.getElementById("beginner-lang-select");
  const timelineEl = document.getElementById("beginner-scroll-timeline");
  const timelineItems = timelineEl ? Array.from(timelineEl.querySelectorAll("[data-beginner-anchor]")) : [];

  const TIMELINE_KEYS = ["start", "sbt", "tcg", "tools", "faq"];
  const TIMELINE_LABELS = {
    "zh-Hant": { start: "開始", sbt: "SBT", tcg: "TCG", tools: "工具", faq: "FAQ", title: "快速導覽" },
    "zh-Hans": { start: "开始", sbt: "SBT", tcg: "TCG", tools: "工具", faq: "FAQ", title: "快速导览" },
    en: { start: "Start", sbt: "SBT", tcg: "TCG", tools: "Tools", faq: "FAQ", title: "Quick Nav" },
    ko: { start: "시작", sbt: "SBT", tcg: "TCG", tools: "도구", faq: "FAQ", title: "빠른 이동" },
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function imageHtml(index, alt, modifier) {
    const src = Array.isArray(data.images) ? data.images[index] : "";
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

  function renderSbtChecklistInner(lang) {
    const labels = labelsFor(lang);
    const rows = typeof sbtRows !== "undefined" && Array.isArray(sbtRows)
      ? sbtRows.filter((row) => row && row.status === "available")
      : [];
    const base = typeof sbtIconBase !== "undefined" ? sbtIconBase : "";
    const reqMap = data.sbtRequirements && (data.sbtRequirements[lang] || {}) || {};
    const difficultyLabel = labels.difficultyLabel || "難度";
    const items = rows.map((row) => {
      const difficulty = Math.max(0, Math.min(5, Number(row.difficulty) || 0));
      const difficultyHtml = difficulty
        ? `<span class="sbt-difficulty" aria-label="${escapeHtml(difficultyLabel)} ${difficulty} / 5"><span class="sbt-difficulty-label">${escapeHtml(difficultyLabel)}</span><span class="sbt-stars">${sbtDifficultyStars(difficulty)}</span></span>`
        : "";
      const iconsHtml = (row.icons || []).map((file) => {
        const src = sbtIconSrc(file, base);
        return `<a class="sbt-thumb" href="${escapeHtml(src)}" target="_blank" rel="noreferrer"><img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(row.name)}" /></a>`;
      }).join("");
      return `
        <article class="sbt-item">
          <div class="sbt-item-icons">${iconsHtml}</div>
          <div class="sbt-item-main">
            <div class="sbt-item-top">
              <div class="sbt-item-name">${escapeHtml(row.name)}</div>
              <div class="sbt-item-badges">
                ${difficultyHtml}
                <span class="status s-on">✅ Available</span>
              </div>
            </div>
            <p class="sbt-item-req">${escapeHtml(reqMap[row.name] || row.requirement || "")}</p>
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
          <div id="sbt-available-list" class="sbt-list">${items}</div>
        </article>
      </div>
    `;
  }

  function renderSection(section, index) {
    const type = String(section && section.type || "intro");
    const title = escapeHtml(section && section.title || "");
    const anchorId = sectionAnchorId(section);
    const anchorAttr = anchorId ? ` id="${anchorId}" data-beginner-anchor-target="1"` : "";
    const kicker = `<div class="beginner-section-kicker">${String(index + 1).padStart(2, "0")}</div>`;
    if (type === "intro") {
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];
      return `
        <section${anchorAttr} class="beginner-static-section beginner-static-intro">
          ${kicker}
          <h2>${title}</h2>
          <p>${renderInline(section.text || "")}</p>
          ${bullets.length ? `<div class="beginner-static-points">${bullets.map((item) => `<span>${renderInline(item)}</span>`).join("")}</div>` : ""}
        </section>
      `;
    }
    if (type === "steps") {
      const rows = Array.isArray(section.items) ? section.items : [];
      return `
        <section${anchorAttr} class="beginner-static-section">
          ${kicker}
          <h2>${title}</h2>
          <div class="beginner-step-grid">
            ${rows.map((row, idx) => `
              <article class="beginner-step-card">
                <span>${idx + 1}</span>
                <h3>${renderInline(row[0] || "")}</h3>
                <p>${renderInline(row[1] || "")}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }
    if (type === "imageText") {
      return `
        <section${anchorAttr} class="beginner-static-section beginner-media-split">
          ${imageHtml(Number(section.image || 0), section.title, "is-cover")}
          <div>
            ${kicker}
            <h2>${title}</h2>
            <p>${renderInline(section.text || "")}</p>
          </div>
        </section>
      `;
    }
    if (type === "ratings") {
      const rows = Array.isArray(section.items) ? section.items : [];
      return `
        <section${anchorAttr} class="beginner-static-section">
          ${imageHtml(Number(section.image || 0), section.title, "is-contain")}
          ${kicker}
          <h2>${title}</h2>
          <p>${renderInline(section.intro || "")}</p>
          <div class="beginner-rating-grid">
            ${rows.map((row) => `
              <article class="beginner-rating-card">
                <strong>${renderInline(row[0] || "")}</strong>
                <span>${renderInline(row[1] || "")}</span>
              </article>
            `).join("")}
          </div>
        </section>
      `;
    }
    if (type === "sbtChecklist") {
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];
      const primer = Array.isArray(section.primer) ? section.primer : [];
      return `
        <section${anchorAttr} class="beginner-static-section beginner-sbt-section">
          <div class="beginner-sbt-primer">
            <div class="beginner-sbt-primer-copy">
              <span class="beginner-sbt-pill">Soulbound Token</span>
              <h2>${renderSbtIntroTitle(section.introTitle || "")}</h2>
              <p>${renderInline(section.text || "")}</p>
            </div>
            ${primer.length ? `
              <div class="beginner-sbt-primer-grid">
                ${primer.map((row) => `
                  <article class="beginner-sbt-primer-item">
                    <strong>${renderInline(row[0] || "")}</strong>
                    <span>${renderInline(row[1] || "")}</span>
                  </article>
                `).join("")}
              </div>
            ` : ""}
          </div>
          <div class="beginner-sbt-list-head">
            ${kicker}
            <h2>${title}</h2>
          </div>
          ${bullets.length ? `<div class="beginner-static-points">${bullets.map((item) => `<span>${renderInline(item)}</span>`).join("")}</div>` : ""}
          ${renderSbtChecklistInner(currentLang())}
        </section>
      `;
    }
    const cards = Array.isArray(section.items) ? section.items : [];
    return `
      <section${anchorAttr} class="beginner-static-section">
        ${kicker}
        <h2>${title}</h2>
        <div class="beginner-info-grid">
          ${cards.map((row) => `
            <article class="beginner-info-card">
              <h3>${renderInline(row[0] || "")}</h3>
              <p>${renderInline(row[1] || "")}</p>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderStaticGuide(lang) {
    const guide = guideFor(lang);
    const labels = labelsFor(lang);
    const titleEl = document.getElementById("beginner-page-title");
    const subEl = document.getElementById("beginner-page-subtitle");
    const chipEl = document.getElementById("beginner-page-chip");
    if (titleEl) titleEl.innerHTML = `<iconify-icon icon="lucide:flag"></iconify-icon>${escapeHtml(guide.title || "")}`;
    if (subEl) subEl.textContent = guide.subtitle || "";
    if (chipEl) chipEl.innerHTML = `<iconify-icon icon="lucide:route"></iconify-icon>${escapeHtml(guide.eyebrow || "")}`;
    if (coverImg && Array.isArray(data.images)) coverImg.src = data.images[0] || "";
    if (coverWrap) coverWrap.style.display = "block";
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="beginner-stat-row">
          ${(guide.stats || []).map((row) => `
            <article class="beginner-stat">
              <span class="beginner-stat-label">${renderInline(row[0] || "")}</span>
              <div class="beginner-stat-value">${renderInline(row[1] || "")}</div>
            </article>
          `).join("")}
        </div>
        ${(guide.sections || []).map(renderSection).join("")}
      `;
    }
    const textTargets = {
      "beginner-tools-title": labels.toolsTitle,
      "beginner-tools-subtitle": labels.toolsSubtitle,
      "beginner-faq-title": labels.faqTitle,
      "beginner-faq-subtitle": labels.faqSubtitle,
      "beginner-nav-game": labels.navGame,
      "beginner-nav-aggregator": labels.navAggregator,
      "beginner-nav-beginner": labels.navBeginner,
      "beginner-open-link": labels.openRenaiss,
    };
    Object.entries(textTargets).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
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
      return `
        <article class="beginner-tool-card">
          <div class="beginner-tool-top">
            <span class="beginner-tool-index">${String(idx + 1).padStart(2, "0")}</span>
            <iconify-icon icon="lucide:wrench"></iconify-icon>
          </div>
          <div class="beginner-tool-name">${escapeHtml(toolName)}</div>
          <div class="beginner-tool-meta">${escapeHtml(labels.authorLabel || "作者")}：${(tool.authors || []).map(escapeHtml).join("、")}</div>
          <a class="beginner-tool-link" href="${escapeHtml(tool.link)}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:external-link"></iconify-icon>${escapeHtml(linkLabel)}</a>
        </article>
      `;
    }).join("");
    const commandCards = commands.map((command, idx) => {
      const desc = command.desc && (command.desc[lang] || command.desc["zh-Hant"]) || "";
      const commandName = localized(command.name, lang, "");
      const commandMeta = localized(command.meta, lang, "");
      const commandLine = command.command
        ? `<div class="beginner-command-meta">${escapeHtml(labels.commandLabel || "Command")}: <code>${escapeHtml(command.command)}</code></div>`
        : (commandMeta
          ? `<div class="beginner-command-meta is-auto"><iconify-icon icon="lucide:sparkles"></iconify-icon>${escapeHtml(commandMeta)}</div>`
          : "");
      return `
        <article class="beginner-command-card">
          <div class="beginner-command-top">
            <span class="beginner-tool-index">${String(idx + 1).padStart(2, "0")}</span>
            <iconify-icon icon="${escapeHtml(command.icon || "lucide:terminal-square")}"></iconify-icon>
          </div>
          <h4>${escapeHtml(commandName)}</h4>
          <p>${renderCardSearchHighlight(desc)}</p>
          ${commandLine}
        </article>
      `;
    }).join("");
    const showcase = data.commandShowcase || {};
    const showcaseImages = Array.isArray(showcase.images) ? showcase.images : [];
    const showcaseHtml = showcaseImages.length
      ? `
      <section class="beginner-command-focus" aria-label="${escapeHtml(labels.commandsCriticalTitle || "Critical Workflow")}">
        <div class="beginner-command-focus-head">
          <span class="beginner-command-focus-tag"><iconify-icon icon="lucide:alert-triangle"></iconify-icon>${escapeHtml(labels.commandsCriticalTag || "High Priority")}</span>
          <h4>${escapeHtml(labels.commandsCriticalTitle || "")}</h4>
          <p>${renderCardSearchHighlight(labels.commandsCriticalDesc || "")}</p>
          <p class="beginner-command-focus-note">${escapeHtml(labels.commandsCriticalHint || "")}</p>
          <div class="beginner-command-focus-gallery-title">${escapeHtml(labels.commandsExamplesTitle || "")}</div>
          <div class="beginner-command-focus-gallery-note">${escapeHtml(labels.commandsExamplesNote || "")}</div>
        </div>
        <div class="beginner-command-focus-gallery">
          ${showcaseImages.map((item, idx) => {
            const src = String(item && item.src || "").trim();
            if (!src) return "";
            const caption = localized(item.caption, lang, "");
            return `
              <figure class="beginner-command-focus-figure">
                <img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(caption || `Command showcase ${idx + 1}`)}" />
                ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
              </figure>
            `;
          }).join("")}
        </div>
      </section>
      `
      : "";
    toolsEl.innerHTML = `
      <div class="beginner-tools-subhead">
        <div>
          <h3>${escapeHtml(labels.communityToolsTitle || "Community-Built Tools")}</h3>
          <p>${escapeHtml(labels.communityToolsSubtitle || "")}</p>
        </div>
      </div>
      <div class="beginner-tools-grid">${toolCards}</div>
      <div class="beginner-tools-subhead">
        <div>
          <h3 class="beginner-commands-title-rainbow">${escapeHtml(labels.commandsTitle || "TCG Pro Discord 指令清單")}</h3>
          <p>${escapeHtml(labels.commandsSubtitle || "")}</p>
          <p class="beginner-command-owner">${escapeHtml(labels.commandsOwner || "")}</p>
        </div>
      </div>
      <div class="beginner-command-grid">${commandCards}</div>
      ${showcaseHtml}
    `;
  }

  function renderStaticFaq(lang) {
    if (!faqEl) return;
    const rows = data.faq && (data.faq[lang] || data.faq["zh-Hant"]) || [];
    faqEl.innerHTML = rows.map((row) => `
      <article class="beginner-faq-item">
        <div class="beginner-faq-q">Q: ${renderInline(row[0] || "")}</div>
        <div class="beginner-faq-a">A: ${renderInline(row[1] || "")}</div>
      </article>
    `).join("");
  }

  function renderStaticSbt(lang) {
    const availableList = document.getElementById("sbt-available-list");
    const availableCount = document.getElementById("sbt-available-count");
    if (!availableList || !availableCount) return;
    const labels = labelsFor(lang);
    const rows = typeof sbtRows !== "undefined" && Array.isArray(sbtRows) ? sbtRows.filter((row) => row && row.status === "available") : [];
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
    const currentY = window.scrollY + 140;
    let activeKey = "start";
    TIMELINE_KEYS.forEach((key) => {
      const el = timelineTarget(key);
      if (!el) return;
      if (el.offsetTop <= currentY) activeKey = key;
    });
    setActiveTimelineKey(activeKey);
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

  function renderStaticPage(lang) {
    const tag = saveLang(lang);
    renderStaticGuide(tag);
    renderStaticTools(tag);
    renderStaticFaq(tag);
    renderStaticSbt(tag);
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

  const requestedLang = new URLSearchParams(window.location.search).get("lang");
  renderStaticPage(requestedLang || currentLang());
  bindTimelineNav();
  window.addEventListener("scroll", queueTimelineSync, { passive: true });
  window.addEventListener("resize", queueTimelineSync);
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      renderStaticPage(langSelect.value);
    });
  }
  observeSections();
})();
