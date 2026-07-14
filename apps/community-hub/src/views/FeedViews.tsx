import { useMemo, useState } from "react";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ViewHeader } from "@/components/AppShell";
import { eventStatus, isCommunity, isEvent, isMedia, isOfficial, isTaggedRenaiss } from "@/lib/feed";
import { text } from "@/lib/copy";
import type { FeedCard, Language } from "@/types";

interface SharedViewProps {
  cards: FeedCard[];
  lang: Language;
  loading: boolean;
  onOpenArticle: (source: string) => void;
  onRefresh: () => void;
  translationPending: boolean;
}

function RefreshButton({ disabled, lang, onRefresh }: { disabled: boolean; lang: Language; onRefresh: () => void }) {
  return <button type="button" className="community-hub-refresh" disabled={disabled} onClick={onRefresh}><Icon name="refresh-cw" /><span>{text(lang, "action.refresh")}</span></button>;
}

function DataEmpty({ lang, translating }: { lang: Language; translating: boolean }) {
  return <EmptyState title={text(lang, translating ? "empty.translating" : "empty.unavailable")} />;
}

export function FeedView({ cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => cards.filter((card) => {
    if (filter === "official" && !isOfficial(card)) return false;
    if (filter === "community" && !isCommunity(card)) return false;
    if (filter === "tagged" && !isTaggedRenaiss(card)) return false;
    const haystack = [card.title, card.summary, card.raw_text, card.account].join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }).slice(0, 24), [cards, filter, query]);

  const filters = [["all", "filter.all"], ["official", "filter.official"], ["community", "filter.community"], ["tagged", "filter.tagged"]] as const;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="LIVE" title={text(lang, "feed.title")} lead={text(lang, "feed.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-toolbar"><div className="community-hub-filter-row">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{text(lang, label)}</button>)}</div><label className="community-hub-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" placeholder={text(lang, "search.placeholder")} /></label></div>
    <div className="community-hub-content-list">{rows.length ? rows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
  </section>;
}

export function EventsView({ cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"active" | "upcoming" | "past">("active");
  const rows = useMemo(() => cards.filter(isEvent).filter((card) => eventStatus(card) === filter).slice(0, 24), [cards, filter]);
  const filters = [["active", "filter.active"], ["upcoming", "filter.upcoming"], ["past", "filter.past"]] as const;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="TIME" title={text(lang, "events.title")} lead={text(lang, "events.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-filter-row community-hub-filter-row-wide">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{text(lang, label)}</button>)}</div>
    <div className="community-hub-content-list community-hub-event-list">{rows.length ? rows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} status={eventStatus(card)} onOpenArticle={onOpenArticle} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
  </section>;
}

export function MediaView({ cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"all" | "official" | "market">("all");
  const rows = useMemo(() => cards.filter(isMedia).filter((card) => {
    if (filter === "official") return isOfficial(card);
    if (filter === "market") return ["market", "trend", "report"].includes(String(card.card_type ?? "").toLowerCase()) || card.topic_labels?.some((topic) => ["collectibles", "pokemon"].includes(String(topic).toLowerCase()));
    return true;
  }).slice(0, 24), [cards, filter]);
  const filters = [["all", "filter.all"], ["official", "filter.official"], ["market", "filter.market"]] as const;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="MEDIA" title={text(lang, "media.title")} lead={text(lang, "media.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-filter-row community-hub-filter-row-wide">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{text(lang, label)}</button>)}</div>
    <div className="community-hub-content-list">{rows.length ? rows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
  </section>;
}
