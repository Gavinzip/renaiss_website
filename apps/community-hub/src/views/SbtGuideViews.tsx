import { Fragment } from "react";
import { ViewHeader } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { assets, beginnerGuideData, sbtCatalog, sbtIconUrl } from "@/data/legacy";
import { text } from "@/lib/copy";
import { coverUrl, formatDate, isSbt, limitedSbtCampaigns, safeUrl } from "@/lib/feed";
import type { FeedCard, GuideSection, Language, LocalizedText } from "@/types";

const guideTopics = [
  { id: "overview", indexes: [] },
  { id: "start", indexes: [0, 1] },
  { id: "packs", indexes: [2, 3] },
  { id: "market", indexes: [4] },
  { id: "sbt", indexes: [5] },
  { id: "tcg", indexes: [6, 7, 8, 9, 10] },
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
  tools: { "zh-Hant": ["工具", "社群工具與 TCG Pro 指令"], "zh-Hans": ["工具", "社群工具与 TCG Pro 指令"], en: ["Tools", "Community tools and TCG Pro commands"], ko: ["도구", "커뮤니티 도구와 TCG Pro 명령어"] },
  faq: { "zh-Hant": ["FAQ", "新手常見問題與解答"], "zh-Hans": ["FAQ", "新手常见问题与解答"], en: ["FAQ", "Common questions and answers"], ko: ["FAQ", "초보자가 자주 묻는 질문과 답변"] },
};

function localized(value: string | LocalizedText | undefined, lang: Language): string {
  if (typeof value === "string") return value;
  return value?.[lang] ?? value?.["zh-Hant"] ?? value?.en ?? "";
}

function InlineText({ value }: { value?: string }) {
  const parts = String(value ?? "").split("==");
  return <>{parts.map((part, index) => index % 2 ? <strong key={`${part}-${index}`}>{part}</strong> : <Fragment key={`${part}-${index}`}>{part}</Fragment>)}</>;
}

function GuideSectionView({ section }: { section: GuideSection }) {
  if (!section.title) return null;
  const image = Number.isInteger(section.image) ? assets.guideAsset(beginnerGuideData().images?.[section.image ?? 0]) : "";
  const body = section.type === "steps" ? <ol className="community-hub-guide-steps">{(section.items ?? []).map(([title, copy], index) => <li key={`${title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p><InlineText value={copy} /></p></div></li>)}</ol>
    : section.type === "cards" || section.type === "ratings" ? <>{section.intro ? <p className="community-hub-guide-copy"><InlineText value={section.intro} /></p> : null}<dl className="community-hub-guide-terms">{(section.items ?? []).map(([term, description]) => <div key={term}><dt>{term}</dt><dd><InlineText value={description} /></dd></div>)}</dl></>
      : section.type === "sbtChecklist" ? <div className="community-hub-guide-sbt"><p className="community-hub-section-index">{section.introTitle || "SBT"}</p><p className="community-hub-guide-copy"><InlineText value={section.text} /></p>{section.primer?.length ? <dl className="community-hub-guide-terms">{section.primer.map(([term, description]) => <div key={term}><dt>{term}</dt><dd><InlineText value={description} /></dd></div>)}</dl> : null}{section.bullets?.length ? <ul className="community-hub-guide-bullets">{section.bullets.map((row) => <li key={row}><InlineText value={row} /></li>)}</ul> : null}</div>
        : <>{section.text ? <p className="community-hub-guide-copy"><InlineText value={section.text} /></p> : null}{section.bullets?.length ? <ul className="community-hub-guide-bullets">{section.bullets.map((row) => <li key={row}><InlineText value={row} /></li>)}</ul> : null}</>;
  return <section className={`community-hub-guide-section${image ? " has-media" : ""}`}><div><h3>{section.title}</h3>{body}</div>{image ? <figure className="community-hub-guide-media"><img src={image} alt="" loading="lazy" /></figure> : null}</section>;
}

function GuideOverview({ lang }: { lang: Language }) {
  const data = beginnerGuideData();
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

function GuideTools({ lang }: { lang: Language }) {
  const data = beginnerGuideData();
  const labels = data.labels?.[lang] ?? data.labels?.["zh-Hant"] ?? {};
  return <>
    <section className="community-hub-guide-section"><div><h3>{labels.communityToolsTitle || labels.toolsTitle || "Tools"}</h3><p className="community-hub-guide-copy">{labels.communityToolsSubtitle || labels.toolsSubtitle || ""}</p><ul className="community-hub-guide-tool-list">{(data.tools ?? []).map((tool) => <li key={localized(tool.name, lang)}><div><strong>{localized(tool.name, lang)}</strong><p>{(tool.authors ?? []).join(" · ")}</p></div>{tool.link ? <a href={tool.link} target="_blank" rel="noreferrer">{localized(tool.linkLabel, lang) || labels.linkLabel || tool.link}<Icon name="arrow-up-right" /></a> : null}</li>)}</ul></div></section>
    <section className="community-hub-guide-section"><div><h3>{labels.commandsTitle || "Commands"}</h3><p className="community-hub-guide-copy">{labels.commandsSubtitle || ""}</p>{labels.commandsOwner ? <p className="community-hub-guide-command-owner">{labels.commandsOwner}</p> : null}<ul className="community-hub-guide-command-list">{(data.commands ?? []).map((command) => <li key={localized(command.name, lang)}><Icon name={command.icon || "terminal"} /><div><strong>{localized(command.name, lang)}</strong><p><InlineText value={localized(command.desc, lang)} /></p>{command.command ? <small className="community-hub-guide-command-meta">{labels.commandLabel || "Command"}: <code>{command.command}</code></small> : null}</div></li>)}</ul></div></section>
  </>;
}

function GuideFaq({ lang }: { lang: Language }) {
  const data = beginnerGuideData();
  const labels = data.labels?.[lang] ?? data.labels?.["zh-Hant"] ?? {};
  const rows = data.faq?.[lang] ?? data.faq?.["zh-Hant"] ?? [];
  return <section className="community-hub-guide-section"><div><h3>{labels.faqTitle || "FAQ"}</h3><p className="community-hub-guide-copy">{labels.faqSubtitle || ""}</p><div className="community-hub-guide-faq">{rows.map(([question, answer]) => <details key={question}><summary><span>Q. {question}</span><Icon name="chevron-down" /></summary><p>A. <InlineText value={answer} /></p></details>)}</div></div></section>;
}

function EvergreenSbtCatalog({ lang }: { lang: Language }) {
  const rows = sbtCatalog().filter((row) => row.status === "available");
  return <section className="community-hub-guide-sbt-catalog"><header><p className="community-hub-section-index">SBT</p><h3>{text(lang, "sbt.available")}</h3><p>{text(lang, "sbt.availableLead")}</p></header><div className="community-hub-sbt-catalog-list">{rows.map((row) => <article className="community-hub-sbt-item" key={row.name}><div className="community-hub-sbt-icons">{(row.icons ?? []).map((icon) => { const source = sbtIconUrl(icon); return source ? <img src={source} alt="" key={icon} loading="lazy" /> : null; })}</div><div className="community-hub-sbt-main"><p>{row.badge || "Available"}{row.difficulty ? ` · ${"★".repeat(row.difficulty)}` : ""}</p><h3>{row.name}</h3></div><div className="community-hub-sbt-acquisition"><span>{text(lang, "sbt.principle")}</span>{row.requirement}</div></article>)}</div></section>;
}

interface SbtViewProps {
  cards: FeedCard[];
  lang: Language;
  onGuide: () => void;
  onOpenArticle: (source: string) => void;
}

export function SbtView({ cards, lang, onGuide, onOpenArticle }: SbtViewProps) {
  const campaigns = limitedSbtCampaigns(cards);
  const articles = cards.filter(isSbt).slice(0, 24);
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="SBT" title={text(lang, "sbt.title")} lead={text(lang, "sbt.lead")} />
    <details className="community-hub-sbt-primer-details" open>
      <summary><span><p className="community-hub-section-index">SBT</p><strong>{text(lang, "sbt.about")}</strong><small>{text(lang, "sbt.aboutBody")}</small></span><Icon name="chevron-down" /></summary>
      <div className="community-hub-sbt-primer-body"><p>{text(lang, "sbt.principleBody")}</p><dl className="community-hub-sbt-primer"><div><dt>{text(lang, "sbt.about")}</dt><dd>{text(lang, "sbt.aboutBody")}</dd></div><div><dt>{text(lang, "sbt.principle")}</dt><dd>{text(lang, "sbt.principleBody")}</dd></div><div><dt>{text(lang, "action.guide")}</dt><dd>{text(lang, "sbt.availableLead")}</dd></div></dl></div>
    </details>
    <section className="community-hub-sbt-catalog"><div className="community-hub-sbt-catalog-head"><p className="community-hub-section-index">CURRENT</p><h3>{text(lang, "sbt.acquisition")}</h3><p>{text(lang, "sbt.acquisitionLead")}</p></div><div className="community-hub-sbt-acquisition-list">{campaigns.length ? campaigns.map((campaign) => <article className="community-hub-sbt-acquisition-row" key={campaign.source}><div><span>{text(lang, `card.${campaign.status}`)} · {formatDate(campaign.end, lang)}</span><h4>{campaign.names.join(" · ")}</h4></div><p>{campaign.acquisition}</p><a className="community-hub-sbt-source-link" href={campaign.source} target="_blank" rel="noreferrer">{text(lang, "action.original")} <Icon name="arrow-up-right" /></a></article>) : <EmptyState title={text(lang, "sbt.none")} />}</div></section>
    <section className="community-hub-sbt-catalog"><div className="community-hub-sbt-catalog-head"><p className="community-hub-section-index">ARTICLES</p><h3>{text(lang, "sbt.article")}</h3><p>{text(lang, "sbt.articleLead")}</p></div><div className="community-hub-content-list">{articles.length ? articles.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <EmptyState title={text(lang, "sbt.articleEmpty")} />}</div></section>
    <button type="button" className="community-hub-guide-launch" onClick={onGuide}><span><Icon name="book-open-check" /><strong>{text(lang, "action.guide")}</strong><small>{text(lang, "sbt.availableLead")}</small></span><Icon name="arrow-right" /></button>
    <EvergreenSbtCatalog lang={lang} />
  </section>;
}

interface GuideViewProps {
  lang: Language;
  topicId: string;
  onTopicChange: (id: string) => void;
}

export function GuideView({ lang, topicId, onTopicChange }: GuideViewProps) {
  const topic = guideTopics.find((item) => item.id === topicId) ?? guideTopics[0];
  const [title, subtitle] = topicCopy[topic.id][lang];
  const guide = beginnerGuideData().guides?.[lang] ?? beginnerGuideData().guides?.["zh-Hant"];
  let content = null;
  if (topic.id === "overview") content = <GuideOverview lang={lang} />;
  else if (topic.id === "tools") content = <GuideTools lang={lang} />;
  else if (topic.id === "faq") content = <GuideFaq lang={lang} />;
  else content = <>{topic.indexes.map((index) => <GuideSectionView key={index} section={guide?.sections?.[index] ?? {}} />)}{topic.id === "sbt" ? <EvergreenSbtCatalog lang={lang} /> : null}</>;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="GUIDE" title={text(lang, "guide.title")} lead={text(lang, "guide.lead")} />
    <div className="community-hub-guide-layout"><nav className="community-hub-guide-nav" aria-label={guide?.title || title}>{guideTopics.map((item, index) => { const [itemTitle, itemSubtitle] = topicCopy[item.id][lang]; return <button type="button" key={item.id} className={item.id === topic.id ? "is-active" : ""} onClick={() => onTopicChange(item.id)} aria-current={item.id === topic.id ? "page" : undefined}><span>{String(index).padStart(2, "0")}</span><strong>{itemTitle}</strong><small>{itemSubtitle}</small></button>; })}</nav><article className="community-hub-guide-article"><header><p className="community-hub-section-index">{topic.id === "overview" ? guide?.eyebrow || "GUIDE" : "WIKI ARTICLE"}</p><h2>{title}</h2><p>{subtitle}</p></header>{content}</article></div>
  </section>;
}

interface ArticleViewProps {
  articleUrl: string;
  cards: FeedCard[];
  lang: Language;
  onBack: () => void;
}

export function ArticleView({ articleUrl, cards, lang, onBack }: ArticleViewProps) {
  const card = cards.find((row) => safeUrl(row.url) === articleUrl);
  if (!card) return <section className="community-hub-view is-active is-entering"><button type="button" className="community-hub-back-button" onClick={onBack}><Icon name="arrow-left" />{text(lang, "action.back")}</button><EmptyState title={text(lang, "empty.unavailable")} /></section>;
  const media = assets.guideAsset(card.cover_image) || coverUrl(card.cover_image);
  return <section className="community-hub-view is-active is-entering"><article className="community-hub-article"><button type="button" className="community-hub-back-button" onClick={onBack}><Icon name="arrow-left" />{text(lang, "action.back")}</button><header className="community-hub-article-header"><p className="community-hub-section-index">ARTICLE</p><h2>{card.title || "Renaiss"}</h2><div className="community-hub-article-meta"><span>@{String(card.account || "source").replace(/^@+/, "")}</span><span>{formatDate(card.timeline_date || card.published_at, lang)}</span></div></header>{media ? <figure className="community-hub-article-media"><img src={media} alt="" loading="lazy" /></figure> : null}<div className="community-hub-article-body"><p className="community-hub-article-summary">{card.summary || card.glance || ""}</p>{card.bullets?.length ? <section><h3>Highlights</h3><ul>{card.bullets.map((line) => <li key={line}>{line}</li>)}</ul></section> : null}<footer><a className="community-hub-article-source" href={safeUrl(card.url)} target="_blank" rel="noreferrer">{text(lang, "action.original")}<Icon name="arrow-up-right" /></a></footer></div></article></section>;
}
