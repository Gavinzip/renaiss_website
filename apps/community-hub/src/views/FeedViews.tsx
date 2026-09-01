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
import { eventStatus, isCommunity, isEvent, isMedia, isOfficial, isProductProgressSource, isUpcomingEventWithinDisplayWindow, planStatus, sortEventsByStatus } from "@/lib/feed";
import { text } from "@/lib/copy";
import { usePaginatedRows } from "@/lib/pagination";
import { projectIdForCard, type AccountProjectMap, type ProjectId } from "@/lib/projects";
import { regionIdForAccount, regionLabel, regionLabelForAccount, type EventRegionId } from "@/lib/regions";
import type { FeedCard, HubView, IntelFeed, Language } from "@/types";

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
  return cards.filter((card) => Boolean(projectIdForCard(card, accountProjects))).filter((card) => !isEvent(card, accountProjects));
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
  const regionFilters = <div className="community-hub-filter-row community-hub-region-filter" aria-label={text(props.lang, "community.regionFilter")}>
    <button type="button" className={regionFilter === "all" ? "is-active" : ""} onClick={() => setRegionFilter("all")}>{text(props.lang, "community.regionAll")} <span>{communityCards.length}</span></button>
    {regionOptions.map((regionId) => <button type="button" key={regionId} className={regionFilter === regionId ? "is-active" : ""} onClick={() => setRegionFilter(regionId)}>{regionLabel(regionId, props.lang)} <span>{regionCounts.get(regionId)}</span></button>)}
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

interface FutureViewProps extends SharedViewProps {
  onNavigate: (view: Exclude<HubView, "article">) => void;
}

export function FutureView(props: FutureViewProps) {
  const { accountProjects, cards, lang, loading, onNavigate, onOpenArticle, onRefresh, translationPending } = props;
  const [filter, setFilter] = useState<"upcoming" | "in_progress" | "completed">("in_progress");
  const [projectFilter, setProjectFilter] = useState<"all" | ProjectId>("all");
  const productCards = useMemo(() => cards.filter((card) => isProductProgressSource(card, accountProjects)), [accountProjects, cards]);
  const projectCards = useMemo(() => productCards.filter((card) => (
    projectFilter === "all" || projectIdForCard(card, accountProjects) === projectFilter
  )), [accountProjects, productCards, projectFilter]);
  const filterCards = useMemo(() => productCards.filter((card) => planStatus(card) === filter), [filter, productCards]);
  const projectCounts = useMemo(() => filterCards.reduce((counts, card) => {
    const projectId = projectIdForCard(card, accountProjects);
    if (projectId) counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
    return counts;
  }, new Map<ProjectId, number>()), [accountProjects, filterCards]);
  const statusCounts = useMemo(() => projectCards.reduce((counts, card) => {
    const status = planStatus(card);
    if (status === "upcoming" || status === "in_progress" || status === "completed") counts.set(status, (counts.get(status) ?? 0) + 1);
    return counts;
  }, new Map<"upcoming" | "in_progress" | "completed", number>()), [projectCards]);
  const rows = useMemo(() => projectCards
    .filter((card) => planStatus(card) === filter)
    .sort((left, right) => {
      const leftDate = new Date(left.timeline_date || left.published_at || 0).valueOf();
      const rightDate = new Date(right.timeline_date || right.published_at || 0).valueOf();
      return filter === "upcoming" ? leftDate - rightDate : rightDate - leftDate;
    }), [filter, projectCards]);
  const recentOfficialUpdates = useMemo(() => projectFilter === "all" ? [] : projectCards
    .filter((card) => planStatus(card) === "not_plan")
    .sort((left, right) => new Date(right.published_at || 0).valueOf() - new Date(left.published_at || 0).valueOf())
    .slice(0, 3), [projectCards, projectFilter]);
  const { page, pageCount, pageRows, setPage } = usePaginatedRows(rows, `${lang}:${filter}:${projectFilter}`);
  const awaitingClassification = projectCards.some((card) => !planStatus(card) || planStatus(card) === "needs_review");
  const hasOfficialUpdates = projectCards.length > 0;
  const hasOtherProgress = [...statusCounts.values()].some((count) => count > 0);
  const emptyBodyKey = hasOtherProgress ? "future.empty.otherStatus" : hasOfficialUpdates ? "future.empty.withUpdates" : "future.empty.noUpdates";
  const showRecentOfficialUpdates = pageRows.length === 0 && !awaitingClassification && !translationPending && recentOfficialUpdates.length > 0;
  const openOfficialAction = <button type="button" className="community-hub-empty-link" onClick={() => onNavigate("official")}>{text(lang, "future.openOfficial")}<Icon name="arrow-right" /></button>;
  const filters = [["upcoming", "filter.planUpcoming"], ["in_progress", "filter.planActive"], ["completed", "filter.planCompleted"]] as const;
  return <section className="community-hub-view is-active is-entering">
    <ViewHeader eyebrow="PROGRESS" title={text(lang, "future.title")} lead={text(lang, "future.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-progress-controls">
      <ProjectFilterNav active={projectFilter} allCount={filterCards.length} allLabel={text(lang, "filter.allOfficialCategories")} ariaLabel={text(lang, "future.projectFilter")} counts={projectCounts} lang={lang} onChange={setProjectFilter} />
      <div className="community-hub-filter-row community-hub-filter-row-wide community-hub-progress-status-filter" aria-label={text(lang, "future.statusFilter")}>{filters.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{text(lang, label)}</span><span>{statusCounts.get(value) ?? 0}</span></button>)}</div>
    </div>
    <div className="community-hub-content-list">{pageRows.length ? pageRows.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} sourceLabel={text(lang, "card.official")} status={filter === "upcoming" ? "upcoming" : filter === "in_progress" ? "active" : "past"} statusLabel={text(lang, `filter.plan.${filter}`)} />) : <EmptyState title={text(lang, awaitingClassification ? "future.pending" : translationPending ? "empty.translating" : "future.empty")} body={!awaitingClassification && !translationPending ? text(lang, emptyBodyKey) : undefined} action={!awaitingClassification && !translationPending && hasOfficialUpdates && !showRecentOfficialUpdates ? openOfficialAction : undefined} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
    {showRecentOfficialUpdates ? <section className="community-hub-progress-updates" aria-labelledby="community-hub-progress-updates-title">
      <div className="community-hub-progress-updates-head">
        <div><p>{text(lang, "future.recentEyebrow")}</p><h3 id="community-hub-progress-updates-title">{text(lang, "future.recentTitle")}</h3></div>
        {openOfficialAction}
      </div>
      <p className="community-hub-progress-updates-lead">{text(lang, "future.recentLead")}</p>
      <div className="community-hub-content-list">{recentOfficialUpdates.map((card) => <ContentCard key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} sourceLabel={text(lang, "card.official")} statusLabel={text(lang, "future.recentStatus")} />)}</div>
    </section> : null}
  </section>;
}

export function EventsView({ accountProjects, cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"announced" | "past">("announced");
  const rows = useMemo(() => {
    const events = cards.filter((card) => isEvent(card, accountProjects));
    if (filter === "past") {
      return sortEventsByStatus(events.filter((card) => eventStatus(card) === "past"), "past");
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
    <div className="community-hub-filter-row community-hub-filter-row-wide community-hub-event-filter-row">{filters.map(([value, label]) => <button type="button" key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{text(lang, label)}</button>)}</div>
    <div className="community-hub-event-list">{pageRows.length ? <EventTimeline cards={pageRows} lang={lang} onOpenArticle={onOpenArticle} /> : <EmptyState title={text(lang, translationPending ? "empty.translating" : emptyKey)} />}</div>
    <Pagination lang={lang} page={page} pageCount={pageCount} onPageChange={setPage} />
  </section>;
}

export function MediaView({ accountProjects, cards, lang, loading, onOpenArticle, onRefresh, translationPending }: SharedViewProps) {
  const [filter, setFilter] = useState<"all" | "official" | "market">("all");
  const rows = useMemo(() => cards.filter((card) => isMedia(card, accountProjects)).filter((card) => {
    if (filter === "official") return isOfficial(card, accountProjects);
    if (filter === "market") return ["market", "trend", "report"].includes(String(card.card_type ?? "").toLowerCase()) || card.topic_labels?.some((topic) => String(topic).toLowerCase() === "collectibles");
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
