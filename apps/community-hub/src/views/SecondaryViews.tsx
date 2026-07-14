import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ViewHeader } from "@/components/AppShell";
import { formatUpdate, isVerifiedResult } from "@/lib/feed";
import { text } from "@/lib/copy";
import type { FeedCard, IntelFeed, Language } from "@/types";

interface RecordsViewProps {
  cards: FeedCard[];
  feed: IntelFeed | null;
  lang: Language;
  onOpenArticle: (source: string) => void;
}

export function RecordsView({ cards, feed, lang, onOpenArticle }: RecordsViewProps) {
  const resultCards = cards.filter(isVerifiedResult);
  const metrics = feed?.community_metrics;
  const accounts = Object.values(metrics?.accounts ?? {}).filter((row) => Number.isFinite(Number(row.score))).sort((a, b) => Number(b.score) - Number(a.score) || String(a.account || "").localeCompare(String(b.account || "")));
  const number = new Intl.NumberFormat(lang === "zh-Hans" ? "zh-CN" : lang === "ko" ? "ko-KR" : lang === "en" ? "en-US" : "zh-TW");
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="RECORDS" title={text(lang, "records.title")} lead={text(lang, "records.lead")} />
    <div className="community-hub-records-layout">
      <section className="community-hub-record-block"><div className="community-hub-record-heading"><Icon name="trophy" /><h3>{text(lang, "records.winners")}</h3></div>{resultCards.length ? <div className="community-hub-record-result-list">{resultCards.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} status="past" onOpenArticle={onOpenArticle} />)}</div> : <div className="community-hub-source-state"><strong>{text(lang, "records.winnerMissing")}</strong></div>}</section>
      <section className="community-hub-record-block"><div className="community-hub-record-heading"><Icon name="chart-no-axes-combined" /><h3>{text(lang, "records.rank")}</h3></div>{accounts.length ? <div className="community-hub-ranking"><div className="community-hub-ranking-intro"><strong>{text(lang, "records.metrics")}</strong><p>{metrics?.window_days ? `${text(lang, "records.window")} ${metrics.window_days} ${lang === "en" ? "days" : lang === "ko" ? "일" : "天"}` : ""}</p><div><span>{text(lang, "records.basis")} {metrics?.score_basis?.join(" + ") || "--"}</span><span>{text(lang, "records.updated")} {formatUpdate(metrics?.updated_at, lang)}</span></div></div><ol className="community-hub-ranking-list">{accounts.map((account, index) => <li key={account.account ?? index} className="community-hub-ranking-row"><span className="community-hub-ranking-position">{String(index + 1).padStart(2, "0")}</span><div className="community-hub-ranking-account"><strong>@{String(account.account || "unknown").replace(/^@+/, "")}</strong><small>{text(lang, "records.posts")} {number.format(Number(account.posts) || 0)} · {text(lang, "records.likes")} {number.format(Number(account.likes) || 0)} · {text(lang, "records.replies")} {number.format(Number(account.replies) || 0)}</small></div><div className="community-hub-ranking-score"><strong>{number.format(Number(account.score) || 0)}</strong><small>{text(lang, "records.score")}</small></div></li>)}</ol></div> : <div className="community-hub-source-state"><strong>{text(lang, "records.rankMissing")}</strong></div>}</section>
    </div>
  </section>;
}

const toolGroups = [
  {
    id: "product",
    icon: "layout-grid",
    links: [
      ["Renaiss Game", "../game.html"],
      ["Renaiss Aggregator", "../index.html"],
      ["Card Scan", "../card_scan.html"],
      ["Renaiss Agent", "../agent.html"],
    ],
  },
  {
    id: "guide",
    icon: "book-open-check",
    links: [
      ["Beginner Wiki", "../beginner.html?topic=start"],
      ["SBT Guide", "../beginner.html?topic=sbt"],
      ["TCG Tools", "../beginner.html?topic=tools"],
      ["FAQ", "../beginner.html?topic=faq"],
    ],
  },
] as const;

export function KnowledgeView({ lang, onGuide }: { lang: Language; onGuide: () => void }) {
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="KNOWLEDGE" title={text(lang, "knowledge.title")} lead={text(lang, "knowledge.lead")} />
    <div className="community-hub-knowledge-groups">{toolGroups.map((group) => <section className="community-hub-knowledge-group" key={group.id}><div className="community-hub-knowledge-group-head"><Icon name={group.icon} /><div><h3>{group.id === "product" ? "Renaiss" : text(lang, "guide.title")}</h3><p>{group.id === "product" ? "Official product surfaces" : text(lang, "guide.lead")}</p></div></div><nav className="community-hub-guide-list">{group.links.map(([label, href], index) => <a href={href} key={href}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><small>{href.startsWith("../beginner") ? text(lang, "guide.lead") : ""}</small><Icon name="arrow-up-right" /></a>)}</nav></section>)}</div>
    <button type="button" className="community-hub-guide-launch community-hub-guide-launch--knowledge" onClick={onGuide}><span><Icon name="book-open-check" /><strong>{text(lang, "guide.title")}</strong><small>{text(lang, "guide.lead")}</small></span><Icon name="arrow-right" /></button>
  </section>;
}
