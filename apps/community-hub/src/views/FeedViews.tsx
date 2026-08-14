import { useMemo, useState } from "react";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ViewHeader } from "@/components/AppShell";
import { eventStatus, isCommunity, isEvent, isFuturePlan, isMedia, isOfficial } from "@/lib/feed";
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

interface DynamicStreamProps extends SharedViewProps {
  eyebrow: string;
  leadKey: string;
  selectRows: (cards: FeedCard[]) => FeedCard[];
  titleKey: string;
}

function DynamicStream({ cards, lang, loading, onOpenArticle, onRefresh, translationPending, eyebrow, leadKey, selectRows, titleKey }: DynamicStreamProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => selectRows(cards).filter((card) => {
    const haystack = [card.title, card.summary, card.raw_text, card.account].join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }).slice(0, 24), [cards, query, selectRows]);

  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow={eyebrow} title={text(lang, titleKey)} lead={text(lang, leadKey)} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-toolbar"><label className="community-hub-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" placeholder={text(lang, "search.placeholder")} /></label></div>
    <div className="community-hub-content-list">{rows.length ? rows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
  </section>;
}

function selectCommunityCards(cards: FeedCard[]): FeedCard[] {
  return cards.filter(isCommunity).filter((card) => !isOfficial(card));
}

function selectOfficialCards(cards: FeedCard[]): FeedCard[] {
  return cards.filter(isOfficial).filter((card) => !isEvent(card));
}

function selectFutureCards(cards: FeedCard[]): FeedCard[] {
  return cards.filter(isFuturePlan);
}

export function CommunityView(props: SharedViewProps) {
  return <DynamicStream {...props} eyebrow="COMMUNITY" titleKey="feed.title" leadKey="feed.lead" selectRows={selectCommunityCards} />;
}

export function OfficialView(props: SharedViewProps) {
  return <DynamicStream {...props} eyebrow="OFFICIAL" titleKey="official.title" leadKey="official.lead" selectRows={selectOfficialCards} />;
}

export function FutureView(props: SharedViewProps) {
  return <DynamicStream {...props} eyebrow="FUTURE" titleKey="future.title" leadKey="future.lead" selectRows={selectFutureCards} />;
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
