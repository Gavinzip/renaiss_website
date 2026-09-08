import { isSbt, safeUrl, toDate } from "@/lib/feed";
import type { FeedCard, SbtEntryStatus } from "@/types";

export type SbtSignalStatus = "pending" | "claimable" | "expired";

export interface SbtAcquisitionSignal {
  acquisition: string;
  date: string;
  name: string;
  publishedAt: string;
  source: string;
  status: SbtSignalStatus;
  title: string;
}

interface CandidateRow extends SbtAcquisitionSignal {
  sortTime: number;
}

function signalStatus(status: SbtEntryStatus | undefined): SbtSignalStatus {
  if (status === "available") return "claimable";
  if (status === "ended" || status === "distributed") return "expired";
  return "pending";
}

function rowsForCard(card: FeedCard): CandidateRow[] {
  const source = safeUrl(card.url);
  const publishedAt = String(card.published_at ?? "").trim();
  if (!source || !publishedAt) return [];
  return (card.sbt_entries ?? []).flatMap((entry) => {
    const name = String(entry.name ?? "").trim();
    if (!name) return [];
    const date = String(entry.end_date || entry.start_date || publishedAt).trim();
    return [{
      acquisition: String(entry.acquisition ?? "").trim(),
      date,
      name,
      publishedAt,
      source,
      status: signalStatus(entry.status),
      title: String(card.title ?? "Renaiss"),
      sortTime: Number(toDate(date) ?? toDate(publishedAt) ?? 0),
    }];
  });
}

function betterRow(current: CandidateRow, incoming: CandidateRow): CandidateRow {
  if (incoming.status !== current.status) {
    const rank: Record<SbtSignalStatus, number> = { claimable: 3, pending: 2, expired: 1 };
    return rank[incoming.status] > rank[current.status] ? incoming : current;
  }
  if (incoming.acquisition.length !== current.acquisition.length) {
    return incoming.acquisition.length > current.acquisition.length ? incoming : current;
  }
  return incoming.sortTime >= current.sortTime ? incoming : current;
}

export function sbtAcquisitionSignals(cards: FeedCard[]): SbtAcquisitionSignal[] {
  const recentAfter = new Date();
  recentAfter.setDate(recentAfter.getDate() - 30);
  const grouped = new Map<string, CandidateRow>();

  cards.filter(isSbt).forEach((card) => {
    const publishedAt = toDate(card.published_at);
    if (!publishedAt || publishedAt < recentAfter) return;
    rowsForCard(card).forEach((row) => {
      const key = row.name.toLowerCase();
      const previous = grouped.get(key);
      grouped.set(key, previous ? betterRow(previous, row) : row);
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, 10)
    .map(({ sortTime: _sortTime, ...row }) => row);
}
