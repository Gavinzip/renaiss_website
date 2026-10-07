import { isOfficial, isSbt, safeUrl, toCalendarDay, toDate } from "@/lib/feed";
import type { AccountProjectMap } from "@/lib/projects";
import type { FeedCard, SbtEntry } from "@/types";

export type SbtSignalStatus = "upcoming" | "claimable";

export interface SbtAcquisitionSignal {
  acquisition: string;
  date: string;
  startDate: string;
  name: string;
  publishedAt: string;
  source: string;
  status: SbtSignalStatus;
  title: string;
}

function sourceQuote(value: string | undefined, card: FeedCard): boolean {
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return Boolean(value?.trim() && normalize(card.raw_text ?? "").includes(normalize(value)));
}

function campaignKey(entry: SbtEntry, card: FeedCard): string {
  if (sourceQuote(entry.campaign, card)) return String(entry.campaign).normalize("NFKC").trim().toLowerCase().replace(/[\s_]+/g, "-");
  // Product membership is an existing canonical feed fact, never inferred
  // from a translated title. A generic SBT without one stays source-scoped.
  const packs = (card.product_ids ?? []).filter((id) => id.endsWith("-pack"));
  return packs.length === 1 ? packs[0] : "";
}

export function sbtAcquisitionSignals(cards: FeedCard[], accountProjects: AccountProjectMap = {}, referenceDate = new Date()): SbtAcquisitionSignal[] {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const latest = new Map<string, { entry: SbtEntry; card: FeedCard; campaign: string }>();
  const closedCampaigns = new Map<string, number>();
  const official = cards.filter((card) => isOfficial(card, accountProjects) && isSbt(card))
    .sort((left, right) => Number(toDate(right.published_at)) - Number(toDate(left.published_at)));

  for (const card of official) {
    const published = toDate(card.published_at);
    const source = safeUrl(card.url);
    if (!published || !source) continue;
    for (const entry of card.sbt_entries ?? []) {
      const name = entry.name.trim().toLowerCase();
      if (!name) continue;
      const campaign = campaignKey(entry, card);
      const key = `${campaign || (/^(?:sbt|soulbound token)$/i.test(name) ? source : "named")}:${name}`;
      if (!latest.has(key)) latest.set(key, { entry, card, campaign });
      if (campaign && ["ended", "distributed"].includes(entry.status) && sourceQuote(entry.evidence, card)) {
        closedCampaigns.set(campaign, Math.max(closedCampaigns.get(campaign) ?? 0, published.valueOf()));
      }
    }
  }

  return [...latest.values()].flatMap(({ entry, card, campaign }): SbtAcquisitionSignal[] => {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(entry.start_date) ? toCalendarDay(entry.start_date) : null;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(entry.end_date) ? toCalendarDay(entry.end_date) : null;
    const published = Number(toDate(card.published_at));
    if (!start || !end || start > end || end < today || !entry.acquisition.trim()) return [];
    if (!sourceQuote(entry.acquisition_evidence, card) || !sourceQuote(entry.period_evidence, card)) return [];
    if (!["available", "upcoming"].includes(entry.status) || (closedCampaigns.get(campaign) ?? 0) >= published) return [];
    // "Upcoming" is not automatically promoted to live after its date passes;
    // a new official confirmation is required.
    if (entry.status === "upcoming" && start <= today) return [];
    return [{ acquisition: entry.acquisition, date: entry.end_date, startDate: entry.start_date,
      name: entry.name, publishedAt: String(card.published_at), source: safeUrl(card.url),
      status: start > today ? "upcoming" : "claimable", title: card.title || "Renaiss" }];
  }).sort((left, right) => left.status === right.status ? left.date.localeCompare(right.date) : left.status === "claimable" ? -1 : 1);
}
