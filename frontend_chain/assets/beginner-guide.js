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
    const kicker = `<div class="beginner-section-kicker">${String(index + 1).padStart(2, "0")}</div>`;
    if (type === "intro") {
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];
      return `
        <section class="beginner-static-section beginner-static-intro">
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
        <section class="beginner-static-section">
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
        <section class="beginner-static-section beginner-media-split">
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
        <section class="beginner-static-section">
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
        <section class="beginner-static-section beginner-sbt-section">
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
      <section class="beginner-static-section">
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
      const commandLine = command.command
        ? `<div class="beginner-command-meta">${escapeHtml(labels.commandLabel || "Command")}: <code>${escapeHtml(command.command)}</code></div>`
        : "";
      return `
        <article class="beginner-command-card">
          <div class="beginner-command-top">
            <span class="beginner-tool-index">${String(idx + 1).padStart(2, "0")}</span>
            <iconify-icon icon="${escapeHtml(command.icon || "lucide:terminal-square")}"></iconify-icon>
          </div>
          <h4>${escapeHtml(commandName)}</h4>
          <p>${escapeHtml(desc)}</p>
          ${commandLine}
        </article>
      `;
    }).join("");
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
          <h3>${escapeHtml(labels.commandsTitle || "TCG Pro Discord 指令清單")}</h3>
          <p>${escapeHtml(labels.commandsSubtitle || "")}</p>
          <p class="beginner-command-owner">${escapeHtml(labels.commandsOwner || "")}</p>
        </div>
      </div>
      <div class="beginner-command-grid">${commandCards}</div>
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

  function renderStaticPage(lang) {
    const tag = saveLang(lang);
    renderStaticGuide(tag);
    renderStaticTools(tag);
    renderStaticFaq(tag);
    renderStaticSbt(tag);
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
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      renderStaticPage(langSelect.value);
    });
  }
  observeSections();
})();
