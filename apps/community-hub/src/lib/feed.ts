import type { EventStatus, FeedCard, IntelFeed, Language } from "@/types";

const OFFICIAL_X_HANDLES = new Set(["renaissxyz"]);
const OFFICIAL_DISCORD_GUILD_IDS = new Set(["1478788250687766796"]);

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
    .filter((card) => lang === "zh-Hant" || card._i18n_status?.status === "translated")
    .sort((a, b) => Number(toDate(b.published_at) ?? 0) - Number(toDate(a.published_at) ?? 0));
}

export function topics(card: FeedCard): string[] {
  return (card.topic_labels ?? []).map((value) => String(value).toLowerCase());
}

export function isOfficial(card: FeedCard): boolean {
  const account = String(card.account ?? "").trim().replace(/^@+/, "").toLowerCase();
  const source = safeUrl(card.url);
  if (OFFICIAL_X_HANDLES.has(account) || /(?:x|twitter)\.com\/renaissxyz(?:\/|$)/i.test(source)) return true;
  const guildMatch = source.match(/^https:\/\/discord\.com\/channels\/(?:@me\/)?(\d+)\//i);
  return Boolean(guildMatch && OFFICIAL_DISCORD_GUILD_IDS.has(guildMatch[1]));
}

export function isTaggedRenaiss(card: FeedCard): boolean {
  const value = [card.raw_text, card.title, card.summary, ...(card.tags ?? [])].join(" ");
  return /(?:#renaiss\b|@renaissxyz\b)/i.test(value);
}

export function isCommunity(card: FeedCard): boolean {
  return topics(card).includes("community") || (!isOfficial(card) && isTaggedRenaiss(card));
}

export function isEvent(card: FeedCard): boolean {
  return isOfficial(card) && card.event_wall === true;
}

export function isSbt(card: FeedCard): boolean {
  const value = [card.title, card.summary, card.raw_text, card.sbt_name, card.sbt_acquisition, ...(card.sbt_names ?? [])].join(" ");
  return topics(card).includes("sbt") || /\bSBT\b/i.test(value);
}

export function isMedia(card: FeedCard): boolean {
  return isOfficial(card) || topics(card).includes("collectibles") || topics(card).includes("pokemon") || ["announcement", "market", "report", "trend"].includes(String(card.card_type ?? "").toLowerCase());
}

export function isVerifiedResult(card: FeedCard): boolean {
  if (!isOfficial(card)) return false;
  const value = [card.title, card.summary, card.raw_text].join(" ");
  return /(?:\bwinners?\s+(?:are|is|were|have been|revealed|live|announced)|\bresults?\s+(?:are|is|were|live|announced)|(?:lucky draw|giveaway).{0,64}(?:winner|result)|中獎|得獎|獲獎|中奖|获奖|수상|抽獎結果|抽奖结果|(?:獎勵|奖励|rewards?).{0,24}(?:完成|發放|发放|complete|sent))/i.test(value);
}

export function eventStatus(card: FeedCard): EventStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = toDate(card.timeline_date) ?? toDate(card.published_at);
  const explicitEnd = toDate(card.timeline_end_date);
  if (!start) return "reference";
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (startDay > now) return "upcoming";
  if (explicitEnd) {
    const endDay = new Date(explicitEnd.getFullYear(), explicitEnd.getMonth(), explicitEnd.getDate());
    if (endDay >= now) return "active";
  }
  const daysSinceStart = Math.floor((now.valueOf() - startDay.valueOf()) / 86_400_000);
  return daysSinceStart <= 14 ? "active" : "past";
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

export function limitedSbtCampaigns(cards: FeedCard[]): LimitedSbtCampaign[] {
  return cards
    .filter(isOfficial)
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
