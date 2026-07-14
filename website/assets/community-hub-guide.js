(function attachCommunityHubGuide() {
  const TOPICS = [
    { id: "overview", indexes: [], labels: { "zh-Hant": ["總覽", "Renaiss 的完整新手路線"], "zh-Hans": ["总览", "Renaiss 的完整新手路线"], en: ["Overview", "The complete Renaiss beginner route"], ko: ["개요", "Renaiss 전체 초보자 경로"] } },
    { id: "start", indexes: [0, 1], labels: { "zh-Hant": ["開始使用", "錢包、帳號與充值前先看這裡"], "zh-Hans": ["开始使用", "钱包、帐号与充值前先看这里"], en: ["Getting started", "Wallet, account, and funding preparation"], ko: ["시작하기", "지갑, 계정, 입금 전 준비"] } },
    { id: "packs", indexes: [2, 3], labels: { "zh-Hant": ["抽卡與回購", "限時卡池、無限卡機與 FMV 時間窗"], "zh-Hans": ["抽卡与回购", "限时卡池、无限卡机与 FMV 时间窗"], en: ["Packs and buyback", "Limited pools, infinite machines, and FMV windows"], ko: ["팩과 바이백", "한정 풀, 무한 머신, FMV 시간 창"] } },
    { id: "market", indexes: [4], labels: { "zh-Hant": ["Marketplace", "買賣、競拍與交易積分"], "zh-Hans": ["Marketplace", "买卖、竞拍与交易积分"], en: ["Marketplace", "Buying, selling, bidding, and trading points"], ko: ["Marketplace", "구매, 판매, 입찰, 거래 포인트"] } },
    { id: "sbt", indexes: [5], labels: { "zh-Hant": ["SBT", "用途、取得原則與目前可完成的任務"], "zh-Hans": ["SBT", "用途、获取原则与目前可完成的任务"], en: ["SBT", "Purpose, earning principles, and current tasks"], ko: ["SBT", "용도, 획득 원칙, 현재 가능한 과제"] } },
    { id: "tcg", indexes: [6, 7, 8, 9, 10], labels: { "zh-Hant": ["TCG 基礎", "收藏、評級、查價與市場判讀"], "zh-Hans": ["TCG 基础", "收藏、评级、查价与市场判断"], en: ["TCG basics", "Collecting, grading, pricing, and market judgment"], ko: ["TCG 기초", "수집, 등급, 가격, 시장 판단"] } },
    { id: "tools", indexes: [], labels: { "zh-Hant": ["工具", "社群工具與 TCG Pro 指令"], "zh-Hans": ["工具", "社群工具与 TCG Pro 指令"], en: ["Tools", "Community tools and TCG Pro commands"], ko: ["도구", "커뮤니티 도구와 TCG Pro 명령어"] } },
    { id: "faq", indexes: [], labels: { "zh-Hant": ["FAQ", "新手常見問題與解答"], "zh-Hans": ["FAQ", "新手常见问题与解答"], en: ["FAQ", "Common questions and answers"], ko: ["FAQ", "초보자가 자주 묻는 질문과 답변"] } }
  ];

  const SOURCE_COPY = {
    "zh-Hant": { eyebrow: "SOURCE", title: "資料來源", lead: "內容整理來源：老豆子 @genekmkz 與其 Notion。", x: "X：老豆子 @genekmkz", notion: "Notion：Renaiss 指南" },
    "zh-Hans": { eyebrow: "SOURCE", title: "资料来源", lead: "内容整理来源：老豆子 @genekmkz 与其 Notion。", x: "X：老豆子 @genekmkz", notion: "Notion：Renaiss 指南" },
    en: { eyebrow: "SOURCE", title: "Sources", lead: "Guide materials are credited to @genekmkz and the associated Notion guide.", x: "X: @genekmkz", notion: "Notion: Renaiss Guide" },
    ko: { eyebrow: "SOURCE", title: "자료 출처", lead: "가이드 자료 출처: @genekmkz와 해당 Notion 가이드.", x: "X: @genekmkz", notion: "Notion: Renaiss Guide" }
  };

  function topicFor(id) { return TOPICS.find((topic) => topic.id === id) || TOPICS[0]; }
  function copyFor(topic, lang) { return topic.labels[lang] || topic.labels["zh-Hant"]; }
  function esc(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function byLanguage(value, lang) { return value && typeof value === "object" ? String(value[lang] || value["zh-Hant"] || value.en || "") : String(value || ""); }

  function articleSection(section, images, formatInline) {
    if (!section || !section.title) return "";
    const body = [];
    if (section.type === "steps") {
      body.push(`<ol class="community-hub-guide-steps">${(section.items || []).map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(item?.[0])}</strong><p>${formatInline(item?.[1])}</p></div></li>`).join("")}</ol>`);
    } else if (section.type === "cards" || section.type === "ratings") {
      if (section.intro) body.push(`<p class="community-hub-guide-copy">${formatInline(section.intro)}</p>`);
      body.push(`<dl class="community-hub-guide-terms">${(section.items || []).map((item) => `<div><dt>${esc(item?.[0])}</dt><dd>${formatInline(item?.[1])}</dd></div>`).join("")}</dl>`);
    } else if (section.type === "sbtChecklist") {
      body.push(`<div class="community-hub-guide-sbt"><p class="community-hub-section-index">${esc(section.introTitle || "SBT")}</p><p class="community-hub-guide-copy">${formatInline(section.text)}</p>${(section.primer || []).length ? `<dl class="community-hub-guide-terms">${section.primer.map((item) => `<div><dt>${esc(item?.[0])}</dt><dd>${formatInline(item?.[1])}</dd></div>`).join("")}</dl>` : ""}${(section.bullets || []).length ? `<ul class="community-hub-guide-bullets">${section.bullets.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>` : ""}</div>`);
    } else {
      body.push(`<p class="community-hub-guide-copy">${formatInline(section.text)}</p>`);
      if ((section.bullets || []).length) body.push(`<ul class="community-hub-guide-bullets">${section.bullets.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`);
    }
    const image = Number.isInteger(section.image) ? images[section.image] : "";
    const media = image ? `<figure class="community-hub-guide-media"><img src="${esc(image)}" alt="" loading="lazy" /></figure>` : "";
    return `<section class="community-hub-guide-section${media ? " has-media" : ""}"><div><h3>${esc(section.title)}</h3>${body.join("")}</div>${media}</section>`;
  }

  function overviewSection(staticData, guide, lang, formatInline) {
    const source = SOURCE_COPY[lang] || SOURCE_COPY["zh-Hant"];
    const cover = Array.isArray(staticData.images) ? staticData.images[0] : "";
    const stats = Array.isArray(guide.stats) ? guide.stats : [];
    return `<section class="community-hub-guide-overview">
      ${cover ? `<figure class="community-hub-guide-cover"><img src="${esc(cover)}" alt="" loading="lazy" /></figure>` : ""}
      <div class="community-hub-guide-overview-copy"><p class="community-hub-section-index">${esc(guide.eyebrow || "BEGINNER ROUTE")}</p><h3>${esc(guide.title || "Renaiss")}</h3><p>${formatInline(guide.subtitle || "")}</p></div>
      ${stats.length ? `<dl class="community-hub-guide-stats">${stats.map((row) => `<div><dt>${formatInline(row?.[0])}</dt><dd>${formatInline(row?.[1])}</dd></div>`).join("")}</dl>` : ""}
      <div class="community-hub-guide-source"><p class="community-hub-section-index">${esc(source.eyebrow)}</p><h3>${esc(source.title)}</h3><p>${esc(source.lead)}</p><div><a href="https://x.com/genekmkz" target="_blank" rel="noreferrer">${esc(source.x)}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a><a href="https://www.notion.so/Renaiss-bfbbc705aae04129aee2b619f8cb2b0e#88a5410feeef4dd8b7a2f7e2efd3fe20" target="_blank" rel="noreferrer">${esc(source.notion)}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a></div></div>
    </section>`;
  }

  function toolsSection(staticData, lang, formatInline) {
    const tools = Array.isArray(staticData.tools) ? staticData.tools : [];
    const labels = staticData.labels?.[lang] || staticData.labels?.["zh-Hant"] || {};
    const rows = tools.map((tool) => `<li><div><strong>${esc(byLanguage(tool.name, lang))}</strong><p>${esc((tool.authors || []).join(" · "))}</p></div><a href="${esc(tool.link)}" target="_blank" rel="noreferrer">${esc(byLanguage(tool.linkLabel, lang) || labels.linkLabel || tool.link)}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a></li>`).join("");
    const commands = Array.isArray(staticData.commands) ? staticData.commands : [];
    const commandRows = commands.map((command) => {
      const line = command.command ? `${esc(labels.commandLabel || "Command")}: <code>${esc(command.command)}</code>` : byLanguage(command.meta, lang);
      return `<li><iconify-icon icon="${esc(command.icon || "lucide:terminal")}"></iconify-icon><div><strong>${esc(byLanguage(command.name, lang))}</strong><p>${formatInline(byLanguage(command.desc, lang))}</p>${line ? `<small class="community-hub-guide-command-meta">${line}</small>` : ""}</div></li>`;
    }).join("");
    const showcase = Array.isArray(staticData.commandShowcase?.images) ? staticData.commandShowcase.images : [];
    const showcaseHtml = showcase.length ? `<section class="community-hub-guide-command-focus"><div><p class="community-hub-section-index">${esc(labels.commandsCriticalTag || "IMPORTANT")}</p><h3>${esc(labels.commandsCriticalTitle || "")}</h3><p>${formatInline(labels.commandsCriticalDesc || "")}</p><p class="community-hub-guide-command-focus-note">${formatInline(labels.commandsCriticalHint || "")}</p><h4>${esc(labels.commandsExamplesTitle || "")}</h4><p>${esc(labels.commandsExamplesNote || "")}</p></div><div class="community-hub-guide-showcase">${showcase.map((item) => `<figure><img src="${esc(item?.src)}" alt="" loading="lazy" /><figcaption>${esc(byLanguage(item?.caption, lang))}</figcaption></figure>`).join("")}</div></section>` : "";
    return `<section class="community-hub-guide-section"><div><h3>${esc(labels.communityToolsTitle || labels.toolsTitle || "Tools")}</h3><p class="community-hub-guide-copy">${esc(labels.communityToolsSubtitle || labels.toolsSubtitle || "")}</p><ul class="community-hub-guide-tool-list">${rows}</ul></div></section><section class="community-hub-guide-section"><div><h3>${esc(labels.commandsTitle || "Commands")}</h3><p class="community-hub-guide-copy">${esc(labels.commandsSubtitle || "")}</p>${labels.commandsOwner ? `<p class="community-hub-guide-command-owner">${esc(labels.commandsOwner)}</p>` : ""}<ul class="community-hub-guide-command-list">${commandRows}</ul></div></section>${showcaseHtml}`;
  }

  function faqSection(staticData, lang, formatInline) {
    const labels = staticData.labels?.[lang] || staticData.labels?.["zh-Hant"] || {};
    const rows = (staticData.faq?.[lang] || staticData.faq?.["zh-Hant"] || []).map((item) => `<details><summary><span>Q. ${esc(item?.[0])}</span><iconify-icon icon="lucide:chevron-down"></iconify-icon></summary><p>A. ${formatInline(item?.[1])}</p></details>`).join("");
    return `<section class="community-hub-guide-section"><div><h3>${esc(labels.faqTitle || "FAQ")}</h3><p class="community-hub-guide-copy">${esc(labels.faqSubtitle || "")}</p><div class="community-hub-guide-faq">${rows}</div></div></section>`;
  }

  function render(options) {
    const staticData = window.BEGINNER_GUIDE_STATIC || {};
    const lang = options.lang;
    const topic = topicFor(options.topic);
    const guide = staticData.guides?.[lang] || staticData.guides?.["zh-Hant"] || {};
    const labels = copyFor(topic, lang);
    const navigation = TOPICS.map((item, index) => {
      const itemLabels = copyFor(item, lang);
      return `<button type="button" class="${item.id === topic.id ? "is-active" : ""}" data-hub-guide-topic="${item.id}" aria-current="${item.id === topic.id ? "page" : "false"}"><span>${String(index).padStart(2, "0")}</span><strong>${esc(itemLabels[0])}</strong><small>${esc(itemLabels[1])}</small></button>`;
    }).join("");
    let content = "";
    if (topic.id === "overview") content = overviewSection(staticData, guide, lang, options.formatInline);
    else if (topic.id === "tools") content = toolsSection(staticData, lang, options.formatInline);
    else if (topic.id === "faq") content = faqSection(staticData, lang, options.formatInline);
    else {
      content = topic.indexes.map((index) => articleSection(guide.sections?.[index] || {}, staticData.images || [], options.formatInline)).join("");
      if (topic.id === "sbt") content += options.renderSbtCatalog();
    }
    return `<div class="community-hub-guide-layout"><nav class="community-hub-guide-nav" aria-label="${esc(guide.title || labels[0])}">${navigation}</nav><article class="community-hub-guide-article"><header><p class="community-hub-section-index">${esc(topic.id === "overview" ? guide.eyebrow || "GUIDE" : "WIKI ARTICLE")}</p><h2>${esc(labels[0])}</h2><p>${esc(labels[1])}</p></header>${content}</article></div>`;
  }

  window.RENAISS_COMMUNITY_GUIDE = Object.freeze({
    topicIds: TOPICS.map((topic) => topic.id),
    defaultTopic: TOPICS[0].id,
    render
  });
})();
