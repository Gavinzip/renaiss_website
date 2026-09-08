import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CommunityMapDialog } from "@/components/CommunityMapDialog";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { EventTimeline } from "@/components/EventTimeline";
import { Icon } from "@/components/Icon";
import { OfficialSummaryDialog } from "@/components/OfficialSummaryDialog";
import { Pagination } from "@/components/Pagination";
import { ProjectFilterNav } from "@/components/ProjectFilterNav";
import { ViewHeader } from "@/components/AppShell";
import { eventStatus, isCommunity, isEvent, isMedia, isOfficial, isPastEventWithinDisplayWindow, isUpcomingEventWithinDisplayWindow, sortEventsByStatus } from "@/lib/feed";
import { text } from "@/lib/copy";
import { usePaginatedRows } from "@/lib/pagination";
import { projectIdForCard, type AccountProjectMap, type ProjectId } from "@/lib/projects";
import { regionIdForAccount, regionLabel, regionLabelForAccount, type EventRegionId } from "@/lib/regions";
import type { FeedCard, IntelFeed, Language } from "@/types";

interface SharedViewProps {
  accountProjects: AccountProjectMap;
  cards: FeedCard[];
  lang: Language;
  loading: boolean;
  onOpenArticle: (source: string) => void;
  onRefresh: () => void;
  translationPending: boolean;
  communityMetrics?: IntelFeed["community_metrics"];
  officialOverview?: IntelFeed["official_overview"];
}

function RefreshButton({ disabled, lang, onRefresh }: { disabled: boolean; lang: Language; onRefresh: () => void }) {
  return <button type="button" className="community-hub-refresh" disabled={disabled} onClick={onRefresh}><Icon name="refresh-cw" /><span>{text(lang, "action.refresh")}</span></button>;
}

function DataEmpty({ lang, translating }: { lang: Language; translating: boolean }) {
  return <EmptyState title={text(lang, translating ? "empty.translating" : "empty.unavailable")} />;
}

interface DynamicStreamProps extends SharedViewProps {
  beforeToolbar?: ReactNode;
  eyebrow: string;
  getSourceLabel?: (card: FeedCard) => string;
  headerAction?: ReactNode;
  leadKey: string;
  paginationKey?: string;
  selectRows: (cards: FeedCard[]) => FeedCard[];
  toolbarLeading?: ReactNode;
  titleKey: string;
}

function DynamicStream({ cards, lang, loading, onOpenArticle, onRefresh, translationPending, beforeToolbar, eyebrow, getSourceLabel, headerAction, leadKey, paginationKey = "", selectRows, toolbarLeading, titleKey }: DynamicStreamProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => selectRows(cards).filter((card) => {
    const haystack = [card.title, card.summary, card.raw_text, card.account].join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }), [cards, query, selectRows]);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(rows, `${lang}:${titleKey}:${paginationKey}:${query}`);

  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow={eyebrow} title={text(lang, titleKey)} lead={text(lang, leadKey)} action={headerAction ?? <RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    {beforeToolbar}
    <div className="community-hub-toolbar">{toolbarLeading}<label className="community-hub-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" placeholder={text(lang, "search.placeholder")} /></label></div>
    <div className="community-hub-content-list">{pageRows.length ? pageRows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} sourceLabel={getSourceLabel?.(card)} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}

function selectCommunityCards(cards: FeedCard[], accountProjects: AccountProjectMap): FeedCard[] {
  return cards.filter((card) => isCommunity(card, accountProjects)).filter((card) => !isOfficial(card, accountProjects));
}

function selectOfficialCards(cards: FeedCard[], accountProjects: AccountProjectMap): FeedCard[] {
  return cards.filter((card) => isOfficial(card, accountProjects)).filter((card) => !isEvent(card, accountProjects));
}

export function CommunityView(props: SharedViewProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [regionFilter, setRegionFilter] = useState<"all" | EventRegionId>("all");
  const communityCards = useMemo(() => selectCommunityCards(props.cards, props.accountProjects), [props.accountProjects, props.cards]);
  const regionCounts = useMemo(() => communityCards.reduce((counts, card) => {
    const regionId = regionIdForAccount(String(card.account ?? ""));
    counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    return counts;
  }, new Map<EventRegionId, number>()), [communityCards]);
  const regionOptions = useMemo(() => (["tw", "kr", "my", "vn", "th", "unknown"] as EventRegionId[])
    .filter((regionId) => (regionCounts.get(regionId) ?? 0) > 0), [regionCounts]);
  const selectRows = useCallback((cards: FeedCard[]) => selectCommunityCards(cards, props.accountProjects).filter((card) => (
    regionFilter === "all" || regionIdForAccount(String(card.account ?? "")) === regionFilter
  )), [props.accountProjects, regionFilter]);
  const hotspot = useMemo(() => Object.entries(props.communityMetrics?.accounts ?? {})
    .sort(([, left], [, right]) => Number(right.score ?? 0) - Number(left.score ?? 0))[0], [props.communityMetrics]);
  const hotspotLabel = hotspot ? regionLabelForAccount(hotspot[0], props.lang) : text(props.lang, "community.mapWaiting");
  const mapEntry = <a className="community-hub-map-entry" href="../community_map.html" aria-haspopup="dialog" onClick={(event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMapOpen(true);
  }}>
    <span className="community-hub-map-entry-main"><Icon name="map-pinned" /><span><strong>{text(props.lang, "community.mapTitle")}</strong><small>{text(props.lang, "community.mapLead")}</small></span></span>
    <span className="community-hub-map-entry-rank"><small>{hotspot ? text(props.lang, "community.mapTop") : ""}</small><strong>{hotspotLabel}</strong><Icon name="arrow-right" /></span>
  </a>;
  const regionFilters = <div className="community-hub-filter-row community-hub-project-filter community-hub-project-filter-motion community-hub-region-filter" aria-label={text(props.lang, "community.regionFilter")}>
    <button type="button" className="community-hub-project-filter-button" aria-pressed={regionFilter === "all"} onClick={() => setRegionFilter("all")}>
      <span className="community-hub-project-filter-label">{text(props.lang, "community.regionAll")}</span>
      <span className="community-hub-project-filter-count">{communityCards.length}</span>
    </button>
    {regionOptions.map((regionId) => <button type="button" key={regionId} className="community-hub-project-filter-button" aria-pressed={regionFilter === regionId} onClick={() => setRegionFilter(regionId)}>
      <span className="community-hub-project-filter-label">{regionLabel(regionId, props.lang)}</span>
      <span className="community-hub-project-filter-count">{regionCounts.get(regionId)}</span>
    </button>)}
  </div>;
  const getSourceLabel = (card: FeedCard) => `${regionLabelForAccount(String(card.account ?? ""), props.lang)} · ${text(props.lang, "card.community")}`;
  return <><DynamicStream {...props} beforeToolbar={mapEntry} eyebrow="COMMUNITY" getSourceLabel={getSourceLabel} paginationKey={regionFilter} titleKey="feed.title" leadKey="feed.lead" selectRows={selectRows} toolbarLeading={regionFilters} /><CommunityMapDialog lang={props.lang} open={mapOpen} onClose={() => setMapOpen(false)} /></>;
}

export function OfficialView(props: SharedViewProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<"all" | ProjectId>("all");
  const officialCards = useMemo(() => selectOfficialCards(props.cards, props.accountProjects), [props.accountProjects, props.cards]);
  const projectCounts = useMemo(() => officialCards.reduce((counts, card) => {
    const projectId = projectIdForCard(card, props.accountProjects);
    if (projectId) counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
    return counts;
  }, new Map<ProjectId, number>()), [officialCards, props.accountProjects]);
  const selectRows = useCallback((cards: FeedCard[]) => selectOfficialCards(cards, props.accountProjects).filter((card) => (
    projectFilter === "all" || projectIdForCard(card, props.accountProjects) === projectFilter
  )), [projectFilter, props.accountProjects]);
  const projectFilters = <ProjectFilterNav
    active={projectFilter}
    allCount={officialCards.length}
    allLabel={text(props.lang, "filter.allOfficialCategories")}
    ariaLabel={text(props.lang, "official.categoryFilter")}
    counts={projectCounts}
    lang={props.lang}
    onChange={setProjectFilter}
  />;
  const getSourceLabel = () => text(props.lang, "card.official");
  const action = <div className="community-hub-header-actions">
    <button type="button" className="community-hub-summary-trigger" onClick={() => setSummaryOpen(true)}><Icon name="sparkles" /><span>{text(props.lang, "official.aiSummary")}</span></button>
    <RefreshButton disabled={props.loading} lang={props.lang} onRefresh={props.onRefresh} />
  </div>;
  return <>
    <DynamicStream {...props} eyebrow="OFFICIAL" getSourceLabel={getSourceLabel} headerAction={action} paginationKey={projectFilter} titleKey="official.title" leadKey="official.lead" selectRows={selectRows} toolbarLeading={projectFilters} />
    <OfficialSummaryDialog lang={props.lang} open={summaryOpen} overview={props.officialOverview} onClose={() => setSummaryOpen(false)} />
  </>;
}

export function EventsView({ accountProjects, cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"announced" | "past">("announced");
  const rows = useMemo(() => {
    const events = cards.filter((card) => isEvent(card, accountProjects));
    if (filter === "past") {
      return sortEventsByStatus(events.filter((card) => eventStatus(card) === "past" && isPastEventWithinDisplayWindow(card)), "past");
    }

    const active = sortEventsByStatus(events.filter((card) => eventStatus(card) === "active"), "active");
    const upcoming = sortEventsByStatus(events.filter((card) => isUpcomingEventWithinDisplayWindow(card)), "upcoming");
    return [...active, ...upcoming];
  }, [accountProjects, cards, filter]);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(rows, `${lang}:${filter}`);
  const filters = [["announced", "filter.upcoming"], ["past", "filter.past"]] as const;
  const emptyKey = filter === "announced" ? "events.empty.upcoming" : "events.empty.past";
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="TIME" title={text(lang, "events.title")} lead={text(lang, "events.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-filter-row community-hub-filter-row-wide community-hub-project-filter community-hub-project-filter-motion community-hub-event-filter-row">{filters.map(([value, label]) => <button type="button" key={value} className="community-hub-project-filter-button" aria-pressed={filter === value} onClick={() => setFilter(value)}><span className="community-hub-project-filter-label">{text(lang, label)}</span></button>)}</div>
    <div className="community-hub-event-list">{pageRows.length ? <EventTimeline cards={pageRows} lang={lang} onOpenArticle={onOpenArticle} /> : <EmptyState title={text(lang, translationPending ? "empty.translating" : emptyKey)} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}

export function MediaView({ accountProjects, cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"all" | "official" | "market">("all");
  const rows = useMemo(() => cards.filter((card) => isMedia(card, accountProjects)).filter((card) => {
    if (filter === "official") return isOfficial(card, accountProjects);
    if (filter === "market") return ["market", "report"].includes(String(card.card_type ?? "").toLowerCase()) || card.routing_topics?.some((topic) => String(topic).toLowerCase() === "collectibles");
    return true;
  }), [accountProjects, cards, filter]);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(rows, `${lang}:${filter}`);
  const filters = [["all", "filter.all"], ["official", "filter.official"], ["market", "filter.market"]] as const;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="MEDIA" title={text(lang, "media.title")} lead={text(lang, "media.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-filter-row community-hub-filter-row-wide">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{text(lang, label)}</button>)}</div>
    <div className="community-hub-content-list">{pageRows.length ? pageRows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />) : <DataEmpty lang={lang} translating={translationPending} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}
