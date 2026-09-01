import type { EventStatus, FeedCard, IntelFeed, Language, PlanStatus } from "@/types";
import { isRegionalCommunitySource } from "@/lib/regions";
import { projectIdForCard, type AccountProjectMap } from "@/lib/projects";

const OFFICIAL_X_HANDLES = new Set(["renaissxyz"]);
const PRODUCT_PROGRESS_X_HANDLE = "renaissxyz";
const REMOVED_SOURCE_HANDLES = new Set(["pokegetinfomain"]);
const OFFICIAL_DISCORD_GUILD_IDS = new Set(["1478788250687766796"]);
const UPCOMING_EVENT_DISPLAY_DAYS = 14;
const PAST_EVENT_DISPLAY_DAYS = 14;
const RECENT_OFFICIAL_UPDATE_DAYS = 30;
const IN_PROGRESS_DISPLAY_DAYS = 14;
const COMPLETED_PROGRESS_DISPLAY_DAYS = 30;

export function safeUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    return new URL(raw).href;
  } catch {
    return "";
  }
}

export function coverUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^\/data\/generated_covers\//.test(raw)) return `https://renaiss.zeabur.app${raw}`;
  return safeUrl(raw);
}

export function toDate(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function toCalendarDay(value: unknown): Date | null {
  const raw = String(value ?? "").trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
  const date = toDate(value);
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
}

function eventStartDay(card: FeedCard): Date | null {
  return toCalendarDay(card.timeline_date) ?? toCalendarDay(card.published_at);
}

function calendarToday(referenceDate = new Date()): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
}

function isWithinPastDays(value: unknown, days: number, referenceDate = new Date()): boolean {
  const day = toCalendarDay(value);
  if (!day) return false;
  const today = calendarToday(referenceDate);
  const firstVisibleDay = new Date(today);
  firstVisibleDay.setDate(firstVisibleDay.getDate() - days);
  return day <= today && day >= firstVisibleDay;
}

function localeFor(lang: Language): string {
  return lang === "zh-Hans" ? "zh-CN" : lang === "ko" ? "ko-KR" : lang === "en" ? "en-US" : "zh-TW";
}

export function formatDate(value: unknown, lang: Language): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(localeFor(lang), { month: "short", day: "numeric", year: "numeric" }) : "--";
}

export function formatUpdate(value: unknown, lang: Language): string {
  const date = toDate(value);
  return date ? date.toLocaleString(localeFor(lang), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "--";
}

export function normalizeCards(feed: IntelFeed | null, lang: Language): FeedCard[] {
  return (feed?.cards ?? [])
    .filter((card) => card && card.dedupe_status !== "dropped")
    .filter((card) => !REMOVED_SOURCE_HANDLES.has(String(card.account ?? "").trim().replace(/^@+/, "").toLowerCase()))
    .filter((card) => lang === "zh-Hant" || card._i18n_status?.status === "translated")
    .sort((a, b) => Number(toDate(b.published_at) ?? 0) - Number(toDate(a.published_at) ?? 0));
}

export function topics(card: FeedCard): string[] {
  return (card.topic_labels ?? []).map((value) => String(value).toLowerCase());
}

export function isOfficial(card: FeedCard, accountProjects: AccountProjectMap = {}): boolean {
  const account = String(card.account ?? "").trim().replace(/^@+/, "").toLowerCase();
  const source = safeUrl(card.url);
  if (projectIdForCard(card, accountProjects) || OFFICIAL_X_HANDLES.has(account) || /(?:x|twitter)\.com\/renaissxyz(?:\/|$)/i.test(source)) return true;
  const guildMatch = source.match(/^https:\/\/discord\.com\/channels\/(?:@me\/)?(\d+)\//i);
  return Boolean(guildMatch && OFFICIAL_DISCORD_GUILD_IDS.has(guildMatch[1]));
}

export function isProductProgressSource(card: FeedCard, accountProjects: AccountProjectMap = {}): boolean {
  const account = String(card.account ?? "").trim().replace(/^@+/, "").toLowerCase();
  return Boolean(projectIdForCard(card, accountProjects)) || account === PRODUCT_PROGRESS_X_HANDLE;
}

export function isTaggedRenaiss(card: FeedCard): boolean {
  const value = [card.raw_text, card.title, card.summary, ...(card.tags ?? [])].join(" ");
  return /(?:#renaiss\b|@renaissxyz\b)/i.test(value);
}

export function isCommunity(card: FeedCard, accountProjects: AccountProjectMap = {}): boolean {
  return topics(card).includes("community") || (!isOfficial(card, accountProjects) && isTaggedRenaiss(card));
}

export function planStatus(card: FeedCard): PlanStatus | "" {
  const value = String(card.plan_status ?? "");
  return ["upcoming", "in_progress", "completed", "cancelled", "not_plan", "needs_review"].includes(value)
    ? value as PlanStatus
    : "";
}

export function isEvent(card: FeedCard, accountProjects: AccountProjectMap = {}): boolean {
  return card.event_wall === true && (isOfficial(card, accountProjects) || isRegionalCommunitySource(card));
}

export function isGuideArticle(card: FeedCard): boolean {
  const labels = topics(card);
  return labels.some((label) => ["guide", "guides", "tool", "tools", "tutorial", "tutorials"].includes(label));
}

export function isSbt(card: FeedCard): boolean {
  const value = [card.title, card.summary, card.raw_text, card.sbt_name, card.sbt_acquisition, ...(card.sbt_names ?? [])].join(" ");
  return topics(card).includes("sbt") || /\bSBT\b/i.test(value);
}

export function isMedia(card: FeedCard, accountProjects: AccountProjectMap = {}): boolean {
  return isOfficial(card, accountProjects) || topics(card).includes("collectibles") || ["announcement", "market", "report", "trend"].includes(String(card.card_type ?? "").toLowerCase());
}

export function isVerifiedResult(card: FeedCard): boolean {
  if (!isOfficial(card)) return false;
  const value = [card.title, card.summary, card.raw_text].join(" ");
  return /(?:\bwinners?\s+(?:are|is|were|have been|revealed|live|announced)|\bresults?\s+(?:are|is|were|live|announced)|(?:lucky draw|giveaway).{0,64}(?:winner|result)|中獎|得獎|獲獎|中奖|获奖|수상|抽獎結果|抽奖结果|(?:獎勵|奖励|rewards?).{0,24}(?:完成|發放|发放|complete|sent))/i.test(value);
}

export function eventStatus(card: FeedCard, referenceDate = new Date()): EventStatus {
  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const startDay = eventStartDay(card);
  if (!startDay) return "reference";
  const endDay = toCalendarDay(card.timeline_end_date) ?? startDay;
  if (startDay > now) return "upcoming";
  return endDay >= now ? "active" : "past";
}

export function isUpcomingEventWithinDisplayWindow(card: FeedCard, referenceDate = new Date()): boolean {
  const startDay = eventStartDay(card);
  if (!startDay) return false;
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  if (startDay <= today) return false;
  if (card.manual_pin) return true;
  const lastVisibleStartDay = new Date(today);
  lastVisibleStartDay.setDate(lastVisibleStartDay.getDate() + UPCOMING_EVENT_DISPLAY_DAYS);
  return startDay <= lastVisibleStartDay;
}

export function isPastEventWithinDisplayWindow(card: FeedCard, referenceDate = new Date()): boolean {
  if (card.manual_pin) return true;
  const endDay = toCalendarDay(card.timeline_end_date) ?? eventStartDay(card);
  if (!endDay) return false;
  const today = calendarToday(referenceDate);
  if (endDay >= today) return false;
  const firstVisibleEndDay = new Date(today);
  firstVisibleEndDay.setDate(firstVisibleEndDay.getDate() - PAST_EVENT_DISPLAY_DAYS);
  return endDay >= firstVisibleEndDay;
}

export function isRecentOfficialUpdate(card: FeedCard, referenceDate = new Date()): boolean {
  return isWithinPastDays(card.published_at, RECENT_OFFICIAL_UPDATE_DAYS, referenceDate);
}

export function isVisibleProductProgress(card: FeedCard, referenceDate = new Date()): boolean {
  if (card.event_wall === true || ["event", "report", "market"].includes(String(card.card_type ?? "").toLowerCase())) return false;
  const status = planStatus(card);
  if (status === "upcoming") {
    const startDay = toCalendarDay(card.timeline_date);
    return Boolean(startDay && startDay > calendarToday(referenceDate));
  }
  if (status === "in_progress") {
    return isWithinPastDays(card.published_at, IN_PROGRESS_DISPLAY_DAYS, referenceDate);
  }
  if (status === "completed") {
    const completedDay = card.timeline_end_date || card.timeline_date;
    return Boolean(completedDay) && isWithinPastDays(completedDay, COMPLETED_PROGRESS_DISPLAY_DAYS, referenceDate);
  }
  return false;
}

export function collapseProductMilestones(cards: FeedCard[]): FeedCard[] {
  const seenGroups = new Set<string>();
  return cards.filter((card) => {
    const groupKey = String(card.product_progress_group_key ?? "").trim();
    if (!groupKey) return true;
    if (seenGroups.has(groupKey)) return false;
    seenGroups.add(groupKey);
    return true;
  });
}

export function sortEventsByStatus(cards: FeedCard[], status: EventStatus): FeedCard[] {
  const dateValue = (card: FeedCard): number => {
    const date = status === "active"
      ? toDate(card.timeline_end_date) ?? toDate(card.timeline_date) ?? toDate(card.published_at)
      : toDate(card.timeline_date) ?? toDate(card.published_at);
    return Number(date ?? 0);
  };
  const direction = status === "upcoming" || status === "active" ? 1 : -1;
  return [...cards].sort((left, right) => {
    if (Boolean(left.manual_pin) !== Boolean(right.manual_pin)) return left.manual_pin ? -1 : 1;
    return (dateValue(left) - dateValue(right)) * direction;
  });
}

export function limitedSbtStatus(card: FeedCard): "active" | "upcoming" | "ended" | "" {
  const start = toDate(card.timeline_date) ?? toDate(card.published_at);
  const end = toDate(card.timeline_end_date);
  if (!start || !end) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (endDay < today) return "ended";
  return startDay > today ? "upcoming" : "active";
}

export interface LimitedSbtCampaign {
  acquisition: string;
  end: Date;
  names: string[];
  source: string;
  status: "active" | "upcoming";
}

export function limitedSbtCampaigns(cards: FeedCard[], accountProjects: AccountProjectMap = {}): LimitedSbtCampaign[] {
  return cards
    .filter((card) => isOfficial(card, accountProjects))
    .filter(isSbt)
    .flatMap((card) => {
      const status = limitedSbtStatus(card);
      const names = [...new Set([...(card.sbt_names ?? []), card.sbt_name].map((value) => String(value ?? "").trim()).filter(Boolean))];
      const acquisition = String(card.sbt_acquisition ?? "").trim();
      const end = toDate(card.timeline_end_date);
      const source = safeUrl(card.url);
      if (!status || status === "ended" || !names.length || !acquisition || !end || !source) return [];
      return [{ acquisition, end, names, source, status }];
    })
    .sort((left, right) => (left.status === right.status ? left.end.valueOf() - right.end.valueOf() : left.status === "active" ? -1 : 1));
}

export function translationPending(feed: IntelFeed | null, lang: Language): boolean {
  if (lang === "zh-Hant" || !feed?._i18n) return false;
  return ["building", "pretranslated-partial"].includes(String(feed._i18n.mode ?? ""))
    && (Number(feed._i18n.pending) > 0 || Number(feed._i18n.fallback) > 0);
}

export function translationCoverage(feed: IntelFeed | null): string {
  const coverage = Number(feed?._i18n?.coverage);
  return Number.isFinite(coverage) && coverage >= 0 ? `${Math.round(coverage * 100)}%` : "";
}
