import { ContentCard } from "@/components/ContentCard";
import { Icon } from "@/components/Icon";
import { ViewHeader } from "@/components/AppShell";
import { isVerifiedResult } from "@/lib/feed";
import { text } from "@/lib/copy";
import { OPEN_MONITOR_LEADERBOARD_URL } from "@/lib/sources";
import type { FeedCard, Language, PackLeaderboard, PackLeaderboardEntry } from "@/types";

interface RecordsViewProps {
  cards: FeedCard[];
  lang: Language;
  onOpenArticle: (source: string) => void;
  leaderboard: PackLeaderboard | null;
  leaderboardLoading: boolean;
  leaderboardError: string;
  onRefreshLeaderboard: () => void;
}

function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatPackBreakdown(entry: PackLeaderboardEntry, lang: Language): string {
  const rows = Object.entries(entry.by_pack ?? {})
    .filter(([, count]) => Number(count) > 0)
    .sort(([, left], [, right]) => Number(right) - Number(left))
    .slice(0, 3)
    .map(([pack, count]) => `${pack}: ${Number(count).toLocaleString(lang)}`);
  return rows.length ? rows.join(" · ") : text(lang, "records.packRankNoPackBreakdown");
}

function formatSnapshot(value: number | null | undefined, lang: Language): string {
  if (!value) return text(lang, "records.packRankSnapshotUnknown");
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value * 1000));
}

function PackLeaderboardPanel({ leaderboard, loading, error, lang, onRefresh }: { leaderboard: PackLeaderboard | null; loading: boolean; error: string; lang: Language; onRefresh: () => void }) {
  const entries = leaderboard?.entries ?? [];
  return <div className="community-hub-pack-ranking">
    <div className="community-hub-ranking-intro">
      <strong>{text(lang, "records.packRankSource")}</strong>
      <p>{text(lang, "records.packRankLead")}</p>
      <div>
        <span>{text(lang, "records.packRankTotal")}: {Number(leaderboard?.total_pulls ?? 0).toLocaleString(lang)}</span>
        <span>{text(lang, "records.packRankPlayers")}: {Number(leaderboard?.unique_users ?? 0).toLocaleString(lang)}</span>
        <span>{text(lang, "records.packRankUpdated")}: {formatSnapshot(leaderboard?.snapshot_taken_at, lang)}</span>
      </div>
    </div>
    {loading ? <div className="community-hub-source-state"><strong>{text(lang, "records.packRankLoading")}</strong></div> : null}
    {!loading && error ? <div className="community-hub-source-state"><strong>{text(lang, "records.packRankError")}</strong><p>{error}</p><button type="button" className="community-hub-text-action" onClick={onRefresh}>{text(lang, "action.refresh")}</button></div> : null}
    {!loading && !error && entries.length ? <ol className="community-hub-ranking-list" aria-label={text(lang, "records.packRank")}>
      {entries.map((entry) => {
        const address = String(entry.user_address ?? "");
        return <li className="community-hub-ranking-row" key={`${entry.rank}-${address}`}>
          <span className="community-hub-ranking-position">#{entry.rank ?? "-"}</span>
          <span className="community-hub-ranking-account"><strong title={address}>{shortAddress(address)}</strong><small>{formatPackBreakdown(entry, lang)}</small></span>
          <span className="community-hub-ranking-score"><strong>{Number(entry.pull_count ?? 0).toLocaleString(lang)}</strong><small>{text(lang, "records.packRankPulls")}</small></span>
        </li>;
      })}
    </ol> : null}
    {!loading && !error && !entries.length ? <div className="community-hub-source-state"><strong>{text(lang, "records.packRankEmpty")}</strong></div> : null}
    <div className="community-hub-pack-ranking-footer"><span>{text(lang, "records.packRankMeta")}</span><a href={OPEN_MONITOR_LEADERBOARD_URL.replace("/api/leaderboard/full", "/leaderboard")} target="_blank" rel="noreferrer">{text(lang, "records.packRankSourceLink")} <Icon name="arrow-up-right" /></a></div>
  </div>;
}

export function RecordsView({ cards, lang, onOpenArticle, leaderboard, leaderboardLoading, leaderboardError, onRefreshLeaderboard }: RecordsViewProps) {
  const resultCards = cards.filter(isVerifiedResult);
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="RECORDS" title={text(lang, "records.title")} lead={text(lang, "records.lead")} />
    <div className="community-hub-records-layout">
      <section className="community-hub-record-block"><div className="community-hub-record-heading"><Icon name="trophy" /><h3>{text(lang, "records.winners")}</h3></div>{resultCards.length ? <div className="community-hub-record-result-list">{resultCards.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} status="past" onOpenArticle={onOpenArticle} />)}</div> : <div className="community-hub-source-state"><strong>{text(lang, "records.winnerMissing")}</strong></div>}</section>
      <section className="community-hub-record-block"><div className="community-hub-record-heading"><Icon name="chart-no-axes-combined" /><h3>{text(lang, "records.packRank")}</h3></div><PackLeaderboardPanel leaderboard={leaderboard} loading={leaderboardLoading} error={leaderboardError} lang={lang} onRefresh={onRefreshLeaderboard} /></section>
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
