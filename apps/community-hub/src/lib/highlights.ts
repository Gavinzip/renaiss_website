import { eventStatus, isEvent, isOfficial, officialUpdateCards, safeUrl, toCalendarDay, toDate } from "@/lib/feed";
import type { AccountProjectMap } from "@/lib/projects";
import type { FeedCard } from "@/types";
import { distinctHighlightStories } from "@/lib/highlightStories";

export interface RecentHighlights {
  cards: FeedCard[];
  view: "events" | "official";
}

export function recentHighlights(cards: FeedCard[], accountProjects: AccountProjectMap = {}, referenceDate = new Date()): RecentHighlights {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 14);
  const newest = [...cards].sort((a, b) => Number(toDate(b.published_at)) - Number(toDate(a.published_at)));
  const latestEvents = new Map<string, FeedCard>();
  for (const card of newest) {
    if (!isOfficial(card, accountProjects) || !isEvent(card) || !card.event_group_key) continue;
    // Resolve identity before eligibility: a later closure must supersede
    // an earlier invitation, and multiple posts remain a single event.
    if (!latestEvents.has(card.event_group_key)) latestEvents.set(card.event_group_key, card);
  }
  const events = [...latestEvents.values()].filter((card) => {
    const start = toCalendarDay(card.effective_event_date);
    if (!start || !["event_start", "schedule_update"].includes(card.date_role ?? "")) return false;
    if (!safeUrl(card.url) || !card.event_facts?.participation?.trim() || card.plan_status === "cancelled") return false;
    if (!["ongoing", "upcoming"].includes(card.event_status ?? "") || start > horizon) return false;
    const status = eventStatus({ ...card, timeline_date: card.effective_event_date }, referenceDate);
    return status === "active" || status === "upcoming";
  }).sort((a, b) => {
    const activeA = eventStatus(a, referenceDate) === "active";
    const activeB = eventStatus(b, referenceDate) === "active";
    return activeA !== activeB ? (activeA ? -1 : 1) : String(a.effective_event_date).localeCompare(String(b.effective_event_date));
  });
  if (events.length) return { cards: events.slice(0, 3), view: "events" };
  const updates = distinctHighlightStories(officialUpdateCards(newest, accountProjects).filter((card) => safeUrl(card.url)));
  return { cards: updates.slice(0, 3), view: "official" };
}
