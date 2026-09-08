import { Fragment, useEffect, useState } from "react";
import { ViewHeader } from "@/components/AppShell";
import { CardMedia, ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { InlineCardAdmin } from "@/components/admin/InlineCardAdmin";
import { Pagination } from "@/components/Pagination";
import { assets, sbtIconUrl } from "@/data/legacy";
import type { HubAuthState } from "@/lib/auth";
import { text } from "@/lib/copy";
import { coverUrl, formatDate, isGuideArticle, isSbt, safeUrl, toDate } from "@/lib/feed";
import { usePaginatedRows } from "@/lib/pagination";
import { sbtAcquisitionSignals } from "@/lib/sbt";
import { cloneWikiData, saveBeginnerWiki } from "@/lib/wiki";
import type { BeginnerWikiDocument, FeedCard, GuideSection, Language, LegacyBeginnerData, LocalizedText } from "@/types";
import { EditableText, WikiInlineEditor } from "@/views/guide/WikiInlineEditor";

const guideTopics = [
  { id: "overview", indexes: [] },
  { id: "start", indexes: [0, 1] },
  { id: "packs", indexes: [2, 3] },
  { id: "market", indexes: [4] },
  { id: "sbt", indexes: [5] },
  { id: "tcg", indexes: [6, 7, 8, 9, 10] },
  { id: "articles", indexes: [] },
  { id: "tools", indexes: [] },
  { id: "faq", indexes: [] },
] as const;

const topicCopy: Record<string, Record<Language, [string, string]>> = {
  overview: { "zh-Hant": ["總覽", "Renaiss 的完整新手路線"], "zh-Hans": ["总览", "Renaiss 的完整新手路线"], en: ["Overview", "The complete Renaiss beginner route"], ko: ["개요", "Renaiss 전체 초보자 경로"] },
  start: { "zh-Hant": ["開始使用", "錢包、帳號與充值前先看這裡"], "zh-Hans": ["开始使用", "钱包、帐号与充值前先看这里"], en: ["Getting started", "Wallet, account, and funding preparation"], ko: ["시작하기", "지갑, 계정, 입금 전 준비"] },
  packs: { "zh-Hant": ["抽卡與回購", "限時卡池、無限卡機與 FMV 時間窗"], "zh-Hans": ["抽卡与回购", "限时卡池、无限卡机与 FMV 时间窗"], en: ["Packs and buyback", "Limited pools, infinite machines, and FMV windows"], ko: ["팩과 바이백", "한정 풀, 무한 머신, FMV 시간 창"] },
  market: { "zh-Hant": ["Marketplace", "買賣、競拍與交易積分"], "zh-Hans": ["Marketplace", "买卖、竞拍与交易积分"], en: ["Marketplace", "Buying, selling, bidding, and trading points"], ko: ["Marketplace", "구매, 판매, 입찰, 거래 포인트"] },
  sbt: { "zh-Hant": ["SBT", "用途、取得原則與目前可完成的任務"], "zh-Hans": ["SBT", "用途、获取原则与目前可完成的任务"], en: ["SBT", "Purpose, earning principles, and current tasks"], ko: ["SBT", "용도, 획득 원칙, 현재 가능한 과제"] },
  tcg: { "zh-Hant": ["TCG 基礎", "收藏、評級、查價與市場判讀"], "zh-Hans": ["TCG 基础", "收藏、评级、查价与市场判断"], en: ["TCG basics", "Collecting, grading, pricing, and market judgment"], ko: ["TCG 기초", "수집, 등급, 가격, 시장 판단"] },
  articles: { "zh-Hant": ["教學文章", "AI 分類的操作與教學文章永久收錄"], "zh-Hans": ["教学文章", "AI 分类的操作与教学文章永久收录"], en: ["Guide articles", "AI-classified tutorials remain available without an expiry window"], ko: ["가이드 글", "AI가 분류한 사용법과 가이드 글을 만료 없이 보관합니다"] },
  tools: { "zh-Hant": ["工具", "社群工具與 TCG Pro 指令"], "zh-Hans": ["工具", "社群工具与 TCG Pro 指令"], en: ["Tools", "Community tools and TCG Pro commands"], ko: ["도구", "커뮤니티 도구와 TCG Pro 명령어"] },
  faq: { "zh-Hant": ["FAQ", "新手常見問題與解答"], "zh-Hans": ["FAQ", "新手常见问题与解答"], en: ["FAQ", "Common questions and answers"], ko: ["FAQ", "초보자가 자주 묻는 질문과 답변"] },
};

function localized(value: string | LocalizedText | undefined, lang: Language): string {
  if (typeof value === "string") return value;
  return value?.[lang] ?? value?.["zh-Hant"] ?? value?.en ?? "";
}

function topicText(data: LegacyBeginnerData, lang: Language, id: string): [string, string] {
  const row = data.topics?.[lang]?.find((topic) => topic.id === id);
  return [row?.title || topicCopy[id][lang][0], row?.subtitle || topicCopy[id][lang][1]];
}

function legacySectionTopic(index: number): string {
  if (index <= 1) return "start";
  if (index <= 3) return "packs";
  if (index === 4) return "market";
  if (index === 5) return "sbt";
  return "tcg";
}

function sectionTopic(section: GuideSection, index: number, sections: GuideSection[]): string {
  const explicitTopics = new Set(sections.map((row) => row.topic).filter(Boolean));
  return explicitTopics.size > 1 && section.topic ? section.topic : legacySectionTopic(index);
}

function InlineText({ value }: { value?: string }) {
  const parts = String(value ?? "").split("==");
  return <>{parts.map((part, index) => index % 2 ? <strong key={`${part}-${index}`}>{part}</strong> : <Fragment key={`${part}-${index}`}>{part}</Fragment>)}</>;
}

function GuideSectionView({ data, section }: { data: LegacyBeginnerData; section: GuideSection }) {
  if (!section.title) return null;
  const image = section.imageUrl || (Number.isInteger(section.image) ? assets.guideAsset(data.images?.[section.image ?? 0]) : "");
  const body = section.type === "steps" ? <ol className="community-hub-guide-steps">{(section.items ?? []).map(([title, copy], index) => <li key={`${title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p><InlineText value={copy} /></p></div></li>)}</ol>
    : section.type === "cards" || section.type === "ratings" ? <>{section.intro ? <p className="community-hub-guide-copy"><InlineText value={section.intro} /></p> : null}<dl className="community-hub-guide-terms">{(section.items ?? []).map(([term, description]) => <div key={term}><dt>{term}</dt><dd><InlineText value={description} /></dd></div>)}</dl></>
      : section.type === "sbtChecklist" ? <div className="community-hub-guide-sbt"><p className="community-hub-section-index">{section.introTitle || "SBT"}</p><p className="community-hub-guide-copy"><InlineText value={section.text} /></p>{section.primer?.length ? <dl className="community-hub-guide-terms">{section.primer.map(([term, description]) => <div key={term}><dt>{term}</dt><dd><InlineText value={description} /></dd></div>)}</dl> : null}{section.bullets?.length ? <ul className="community-hub-guide-bullets">{section.bullets.map((row) => <li key={row}><InlineText value={row} /></li>)}</ul> : null}</div>
        : <>{section.text ? <p className="community-hub-guide-copy"><InlineText value={section.text} /></p> : null}{section.bullets?.length ? <ul className="community-hub-guide-bullets">{section.bullets.map((row) => <li key={row}><InlineText value={row} /></li>)}</ul> : null}</>;
  return <section className={`community-hub-guide-section${image ? " has-media" : ""} is-layout-${section.layout || "image-left"}`}><div><h3>{section.title}</h3>{body}</div>{image ? <figure className="community-hub-guide-media"><img src={image} alt="" loading="lazy" /></figure> : null}</section>;
}

function GuideOverview({ data, lang }: { data: LegacyBeginnerData; lang: Language }) {
  const guide = data.guides?.[lang] ?? data.guides?.["zh-Hant"];
  const cover = assets.guideAsset(data.images?.[0]);
  if (!guide) return <EmptyState title={text(lang, "empty.unavailable")} />;
  return <section className="community-hub-guide-overview">
    {cover ? <figure className="community-hub-guide-cover"><img src={cover} alt="" loading="lazy" /></figure> : null}
    <div className="community-hub-guide-overview-copy"><p className="community-hub-section-index">{guide.eyebrow || "BEGINNER ROUTE"}</p><h3>{guide.title || "Renaiss"}</h3><p><InlineText value={guide.subtitle} /></p></div>
    {guide.stats?.length ? <dl className="community-hub-guide-stats">{guide.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
    <div className="community-hub-guide-source"><p className="community-hub-section-index">SOURCE</p><h3>{text(lang, "guide.source")}</h3><p>{text(lang, "guide.sourceLead")}</p><div><a href="https://x.com/genekmkz" target="_blank" rel="noreferrer">{text(lang, "guide.x")}<Icon name="arrow-up-right" /></a><a href="https://www.notion.so/Renaiss-bfbbc705aae04129aee2b619f8cb2b0e#88a5410feeef4dd8b7a2f7e2efd3fe20" target="_blank" rel="noreferrer">{text(lang, "guide.notion")}<Icon name="arrow-up-right" /></a></div></div>
  </section>;
}

function GuideTools({ data, lang }: { data: LegacyBeginnerData; lang: Language }) {
  const labels = data.labels?.[lang] ?? data.labels?.["zh-Hant"] ?? {};
  const showcase = data.commandShowcase?.images ?? [];
  return <>
    <section className="community-hub-guide-section"><div><h3>{labels.communityToolsTitle || labels.toolsTitle || "Tools"}</h3><p className="community-hub-guide-copy">{labels.communityToolsSubtitle || labels.toolsSubtitle || ""}</p><ul className="community-hub-guide-tool-list">{(data.tools ?? []).map((tool) => <li key={localized(tool.name, lang)}><div><strong>{localized(tool.name, lang)}</strong><p>{(tool.authors ?? []).join(" · ")}</p></div>{tool.link ? <a href={tool.link} target="_blank" rel="noreferrer">{localized(tool.linkLabel, lang) || labels.linkLabel || tool.link}<Icon name="arrow-up-right" /></a> : null}</li>)}</ul></div></section>
    <section className="community-hub-guide-section"><div><h3>{labels.commandsTitle || "Commands"}</h3><p className="community-hub-guide-copy">{labels.commandsSubtitle || ""}</p>{labels.commandsOwner ? <p className="community-hub-guide-command-owner">{labels.commandsOwner}</p> : null}<ul className="community-hub-guide-command-list">{(data.commands ?? []).map((command) => <li key={localized(command.name, lang)}><Icon name={command.icon || "terminal"} /><div><strong>{localized(command.name, lang)}</strong><p><InlineText value={localized(command.desc, lang)} /></p>{command.command ? <small className="community-hub-guide-command-meta">{labels.commandLabel || "Command"}: <code>{command.command}</code></small> : null}</div></li>)}</ul>{showcase.length ? <div className="community-hub-guide-showcase">{showcase.map((image, index) => { const source = assets.guideAsset(image.src) || image.src || ""; return source ? <figure key={`${source}-${index}`}><img src={source} alt="" loading="lazy" /><figcaption>{localized(image.caption, lang)}</figcaption></figure> : null; })}</div> : null}</div></section>
  </>;
}

function GuideFaq({ data, lang }: { data: LegacyBeginnerData; lang: Language }) {
  const labels = data.labels?.[lang] ?? data.labels?.["zh-Hant"] ?? {};
  const rows = data.faq?.[lang] ?? data.faq?.["zh-Hant"] ?? [];
  return <section className="community-hub-guide-section"><div><h3>{labels.faqTitle || "FAQ"}</h3><p className="community-hub-guide-copy">{labels.faqSubtitle || ""}</p><div className="community-hub-guide-faq">{rows.map(([question, answer]) => <details key={question}><summary><span>Q. {question}</span><Icon name="chevron-down" /></summary><p>A. <InlineText value={answer} /></p></details>)}</div></div></section>;
}

function availableSbtRows(data: LegacyBeginnerData, lang: Language) {
  return (data.sbtItems ?? []).filter((row) => row.status === "available").map((row) => ({ ...row, badge: localized(row.badge, lang), name: localized(row.name, lang), requirement: localized(row.requirement, lang) }));
}

function EvergreenSbtCatalog({ data, lang }: { data: LegacyBeginnerData; lang: Language }) {
  const rows = availableSbtRows(data, lang);
  return <section className="community-hub-guide-sbt-catalog"><header><p className="community-hub-section-index">SBT</p><h3>{text(lang, "sbt.legacyAvailable")}</h3><p>{text(lang, "sbt.legacyAvailableLead")}</p></header><div className="community-hub-sbt-catalog-list">{rows.map((row) => <article className="community-hub-sbt-item" key={row.key || String(row.name)}><div className="community-hub-sbt-icons">{(row.icons ?? []).map((icon) => { const source = sbtIconUrl(icon); return source ? <img src={source} alt="" key={icon} loading="lazy" /> : null; })}</div><div className="community-hub-sbt-main"><p>{row.badge || "Available"}{row.difficulty ? ` · ${"★".repeat(row.difficulty)}` : ""}</p><h3>{row.name}</h3></div><div className="community-hub-sbt-acquisition"><span>{text(lang, "sbt.principle")}</span>{row.requirement}</div></article>)}</div></section>;
}

function compactSignalDate(value: string): string {
  const date = toDate(value);
  if (!date) return "--";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

interface SbtViewProps {
  cards: FeedCard[];
  lang: Language;
  onOpenArticle: (source: string) => void;
  onOpenGuide: () => void;
  wiki: BeginnerWikiDocument | null;
}

export function SbtView({ cards, lang, onOpenArticle, onOpenGuide, wiki }: SbtViewProps) {
  const acquisitions = sbtAcquisitionSignals(cards);
  const cardBySource = new Map(cards.map((card) => [safeUrl(card.url), card]));
  const evergreenCount = wiki ? availableSbtRows(wiki.data, lang).length : null;
  const articles = cards.filter(isSbt);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(articles, lang);
  return (
    <section className="community-hub-view is-active is-entering">
      <ViewHeader eyebrow="SBT" title={text(lang, "sbt.title")} lead={text(lang, "sbt.lead")} />

      <a
        className="community-hub-guide-launch community-hub-sbt-evergreen-link"
        href="?guide=sbt#guide"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onOpenGuide();
        }}
      >
        <span>
          <Icon name="book-open-check" />
          <strong>{evergreenCount === null ? "" : `${evergreenCount} `}{text(lang, "sbt.currentCatalog")}</strong>
          <small>{text(lang, "sbt.currentCatalogLead")}</small>
        </span>
        <Icon name="arrow-right" />
      </a>

      <section className="community-hub-sbt-catalog">
        <div className="community-hub-sbt-catalog-head">
          <p className="community-hub-section-index">LIMITED / RECENT · {acquisitions.length}</p>
          <h3>{text(lang, "sbt.acquisition")}</h3>
          <p>{text(lang, "sbt.acquisitionLead")}</p>
        </div>
        {acquisitions.length ? (
          <ol className="community-hub-sbt-signal-list">
            {acquisitions.map((acquisition, index) => {
              const sourceCard = cardBySource.get(safeUrl(acquisition.source));
              return <li key={`${acquisition.name}-${acquisition.acquisition}`}>
                <button type="button" onClick={() => onOpenArticle(acquisition.source)}>
                  <span className="community-hub-sbt-signal-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="community-hub-sbt-signal-copy">
                    <strong>{acquisition.name}</strong>
                    {acquisition.acquisition ? <small>{acquisition.acquisition}</small> : null}
                  </span>
                  <span className="community-hub-sbt-signal-meta">
                    <time dateTime={acquisition.date}>{compactSignalDate(acquisition.date)}</time>
                    <span className={`is-${acquisition.status}`}>{text(lang, `sbt.status.${acquisition.status}`)}</span>
                  </span>
                </button>
                {sourceCard ? <InlineCardAdmin card={sourceCard} sbtFocus /> : null}
              </li>
            })}
          </ol>
        ) : <EmptyState title={text(lang, "sbt.availableEmpty")} />}
      </section>

      <section className="community-hub-sbt-catalog">
        <div className="community-hub-sbt-catalog-head">
          <p className="community-hub-section-index">ARTICLES</p>
          <h3>{text(lang, "sbt.article")}</h3>
          <p>{text(lang, "sbt.articleLead")}</p>
        </div>
        <div className="community-hub-content-list">
          {pageRows.length ? pageRows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <EmptyState title={text(lang, "sbt.articleEmpty")} />}
        </div>
        <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
      </section>
    </section>
  );
}

interface GuideViewProps {
  auth: HubAuthState;
  cards: FeedCard[];
  lang: Language;
  onOpenArticle: (source: string) => void;
  topicId: string;
  onTopicChange: (id: string) => void;
  onWikiChange: (wiki: BeginnerWikiDocument) => void;
  wiki: BeginnerWikiDocument | null;
  wikiError: string;
  wikiLoading: boolean;
}

function GuideArticles({ cards, lang, onOpenArticle }: Pick<GuideViewProps, "cards" | "lang" | "onOpenArticle">) {
  const rows = cards.filter(isGuideArticle);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(rows, lang);
  return <section className="community-hub-guide-dynamic-articles">
    <header><p>{text(lang, "guide.articleLead")}</p><span>{rows.length} {text(lang, "guide.articleCount")}</span></header>
    <div className="community-hub-content-list">{pageRows.length ? pageRows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <EmptyState title={text(lang, "guide.articleEmpty")} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}

export function GuideView({ auth, cards, lang, onOpenArticle, onTopicChange, onWikiChange, topicId, wiki, wikiError, wikiLoading }: GuideViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LegacyBeginnerData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const topic = guideTopics.find((item) => item.id === topicId) ?? guideTopics[0];
  const data = editing && draft ? draft : wiki?.data;
  const [title, subtitle] = data ? topicText(data, lang, topic.id) : topicCopy[topic.id][lang];
  const guide = data?.guides?.[lang] ?? data?.guides?.["zh-Hant"];
  useEffect(() => {
    if (!editing) setDraft(null);
  }, [editing, lang]);
  const startEditing = () => {
    if (!wiki || !auth.permissions.wiki_edit) return;
    const next = cloneWikiData(wiki.data);
    const rows = next.guides?.[lang]?.sections ?? [];
    if (new Set(rows.map((section) => section.topic).filter(Boolean)).size <= 1) {
      rows.forEach((section, index) => { section.topic = legacySectionTopic(index); });
    }
    setDraft(next);
    setMessage("");
    setEditing(true);
  };
  const cancelEditing = () => {
    setDraft(null);
    setMessage("");
    setEditing(false);
  };
  const commitTopicText = (field: "title" | "subtitle", value: string) => {
    if (!draft || ["overview", "articles"].includes(topic.id)) return;
    const next = cloneWikiData(draft);
    const row = next.topics?.[lang]?.find((item) => item.id === topic.id);
    if (row) row[field] = value;
    setDraft(next);
  };
  const commitSave = async () => {
    if (!draft || !wiki) return;
    setSaving(true);
    setMessage("正在儲存，翻譯 agent 會同步其他語言…");
    try {
      const saved = await saveBeginnerWiki(draft, lang, wiki.meta.content_hash || "");
      onWikiChange(saved);
      setDraft(cloneWikiData(saved.data));
      setMessage(`已儲存並同步翻譯${saved.meta.translation_modes?.length ? `（${saved.meta.translation_modes.join(", ")}）` : ""}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  };
  let content = null;
  if (!data) content = <EmptyState title={wikiLoading ? "Wiki 載入中…" : wikiError || text(lang, "empty.unavailable")} />;
  else if (editing && draft) content = <WikiInlineEditor data={draft} lang={lang} message={message} onCancel={cancelEditing} onChange={setDraft} onSave={commitSave} saving={saving} topicId={topic.id} />;
  else if (topic.id === "overview") content = <GuideOverview data={data} lang={lang} />;
  else if (topic.id === "articles") content = <GuideArticles cards={cards} lang={lang} onOpenArticle={onOpenArticle} />;
  else if (topic.id === "tools") content = <GuideTools data={data} lang={lang} />;
  else if (topic.id === "faq") content = <GuideFaq data={data} lang={lang} />;
  else content = <>{(guide?.sections ?? []).map((section, index, sections) => sectionTopic(section, index, sections) === topic.id ? <GuideSectionView data={data} key={`${topic.id}-${index}`} section={section} /> : null)}{topic.id === "sbt" ? <EvergreenSbtCatalog data={data} lang={lang} /> : null}</>;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="GUIDE" title={text(lang, "guide.title")} lead={text(lang, "guide.lead")} action={auth.permissions.wiki_edit && wiki && !editing ? <button type="button" className="community-hub-wiki-edit-button" onClick={startEditing}><Icon name="pencil-line" />編輯 Wiki</button> : undefined} />
    <div className="community-hub-guide-layout"><nav className="community-hub-guide-nav" aria-label={guide?.title || title}>{guideTopics.map((item, index) => { const [itemTitle, itemSubtitle] = data ? topicText(data, lang, item.id) : topicCopy[item.id][lang]; return <button type="button" key={item.id} className={item.id === topic.id ? "is-active" : ""} onClick={() => onTopicChange(item.id)} aria-current={item.id === topic.id ? "page" : undefined}><span>{String(index).padStart(2, "0")}</span><strong>{itemTitle}</strong><small>{itemSubtitle}</small></button>; })}</nav><article className={`community-hub-guide-article${editing ? " is-wiki-editing" : ""}`}><header><p className="community-hub-section-index">{topic.id === "overview" ? guide?.eyebrow || "GUIDE" : "WIKI ARTICLE"}</p><h2>{editing && !["overview", "articles"].includes(topic.id) ? <EditableText value={title} onCommit={(value) => commitTopicText("title", value)} /> : title}</h2><p>{editing && !["overview", "articles"].includes(topic.id) ? <EditableText multiline value={subtitle} onCommit={(value) => commitTopicText("subtitle", value)} /> : subtitle}</p></header>{content}</article></div>
  </section>;
}

interface ArticleViewProps {
  articleUrl: string;
  cards: FeedCard[];
  lang: Language;
  onBack: () => void;
}

function ArticleSourceBlocks({ card, lang }: { card: FeedCard; lang: Language }) {
  const cover = coverUrl(card.cover_image);
  const seenImages = new Set<string>();
  if (cover) seenImages.add(cover);
  const blocks = (card.article_blocks ?? []).flatMap((block, index) => {
    const kind = String(block.type ?? "").trim();
    if (kind === "image") {
      const source = coverUrl(block.url);
      if (!source || seenImages.has(source)) return [];
      seenImages.add(source);
      return [<figure className="community-hub-article-source-image" key={`image-${source}-${index}`}><img src={source} alt={String(block.alt ?? "")} loading="lazy" decoding="async" referrerPolicy="no-referrer" /></figure>];
    }
    const value = String(block.text ?? "").trim();
    if (!value) return [];
    if (kind === "heading") return [<h4 key={`heading-${index}`}>{value}</h4>];
    if (kind === "paragraph") return [<p key={`paragraph-${index}`}>{value}</p>];
    return [];
  });
  const partial = card.article_fetch_status === "partial" ? <p className="community-hub-article-source-warning">{text(lang, "article.partial")}</p> : null;
  if (!blocks.length) return card.raw_text ? <section><h3>{text(lang, "article.sourceText")}</h3>{partial}<p className="community-hub-article-source-text">{card.raw_text}</p></section> : null;
  return <section className="community-hub-article-source-content"><h3>{text(lang, "article.sourceText")}</h3>{partial}{blocks}</section>;
}

export function ArticleView({ articleUrl, cards, lang, onBack }: ArticleViewProps) {
  const card = cards.find((row) => safeUrl(row.url) === articleUrl);
  if (!card) return <section className="community-hub-view is-active is-entering"><button type="button" className="community-hub-back-button" onClick={onBack}><Icon name="arrow-left" />{text(lang, "action.back")}</button><EmptyState title={text(lang, "empty.unavailable")} /></section>;
  const media = assets.guideAsset(card.cover_image) || coverUrl(card.cover_image);
  const facts = Object.entries(card.event_facts ?? {}).filter((entry): entry is [keyof NonNullable<FeedCard["event_facts"]>, string] => Boolean(String(entry[1] ?? "").trim()));
  const labels = [...new Set((card.tags ?? []).map((value) => String(value).trim()).filter(Boolean))];
  const detailLines = [...new Set((card.detail_lines ?? []).map((value) => String(value).trim()).filter(Boolean))];
  const sbtEntries = (card.sbt_entries ?? []).filter((entry) => String(entry.name ?? "").trim());
  return <section className="community-hub-view is-active is-entering"><article className="community-hub-article">
    <button type="button" className="community-hub-back-button" onClick={onBack}><Icon name="arrow-left" />{text(lang, "action.back")}</button>
    <header className="community-hub-article-header"><p className="community-hub-section-index">ARTICLE</p><h2>{card.title || "Renaiss"}</h2><div className="community-hub-article-meta"><span>@{String(card.account || "source").replace(/^@+/, "")}</span><span>{text(lang, "article.published")} · {formatDate(card.published_at, lang)}</span>{card.timeline_date ? <span>{text(lang, "article.timeline")} · {formatDate(card.timeline_date, lang)}{card.timeline_end_date ? ` - ${formatDate(card.timeline_end_date, lang)}` : ""}</span> : null}</div></header>
    <InlineCardAdmin card={card} />
    <CardMedia key={`${card.url ?? media}-${card.published_at ?? ""}`} card={card} className="community-hub-article-media" label={text(lang, "card.defaultCover")} source={media} />
    <div className="community-hub-article-body">
      <p className="community-hub-article-summary">{card.summary || card.glance || ""}</p>
      {facts.length ? <section className="community-hub-article-facts"><h3>{text(lang, "article.facts")}</h3><dl>{facts.map(([key, value]) => <div key={key}><dt>{text(lang, `article.fact.${key}`)}</dt><dd>{value}</dd></div>)}</dl></section> : null}
      {card.bullets?.length ? <section><h3>{text(lang, "article.highlights")}</h3><ul>{card.bullets.map((line) => <li key={line}>{line}</li>)}</ul></section> : null}
      {card.detail_summary ? <section><h3>{text(lang, "article.analysis")}</h3><p>{card.detail_summary}</p></section> : null}
      {detailLines.length ? <section><h3>{text(lang, "article.details")}</h3><ul>{detailLines.map((line) => <li key={line}>{line}</li>)}</ul></section> : null}
      {sbtEntries.length ? <section><h3>{text(lang, "article.sbt")}</h3>{sbtEntries.map((entry, index) => <div key={`${entry.name}-${index}`}><p><strong>{entry.name}</strong></p>{entry.acquisition ? <p>{entry.acquisition}</p> : null}</div>)}</section> : null}
      {card.plan_status || card.plan_status_reason ? <section><h3>{text(lang, "article.plan")}</h3>{card.plan_status ? <p><strong>{text(lang, `filter.plan.${card.plan_status}`)}</strong></p> : null}{card.plan_status_reason ? <p>{card.plan_status_reason}</p> : null}</section> : null}
      <ArticleSourceBlocks card={card} lang={lang} />
      {labels.length ? <div className="community-hub-article-tags" aria-label={text(lang, "article.tags")}>{labels.map((label) => <span key={label}>{label}</span>)}</div> : null}
      <footer><a className="community-hub-article-source" href={safeUrl(card.url)} target="_blank" rel="noreferrer">{text(lang, "action.original")}<Icon name="arrow-up-right" /></a></footer>
    </div>
  </article></section>;
}
