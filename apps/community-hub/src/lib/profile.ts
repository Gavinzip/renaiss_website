import { intelApiUrl } from "@/lib/api";
import type { Language } from "@/types";

export interface TcgProfileMetrics {
  active_days: number;
  activity_count: number;
  buyback_usd: number;
  card_withdraw_usd: number;
  cash_net_usd: number;
  collection_count: number;
  holdings_value_usd: number;
  market_bought_usd: number;
  market_sold_usd: number;
  net_with_holdings_usd: number;
  opened_packs: number;
  pack_spent_usd: number;
  sbt_badge_count: number;
  sbt_total: number;
  total_earned_usd: number;
  total_spent_usd: number;
}

export interface TcgProfilePackRow {
  contract?: string;
  contract_short?: string;
  open_count?: number;
  pack_name?: string;
  spent_total?: string;
  unit_price?: string;
}

export interface TcgProfileActivityRow {
  count?: number;
  highlight?: boolean;
  name?: string;
  type?: string;
}

export interface TcgProfileCollectionRow {
  detail_url: string;
  fmv_usd: number;
  image_url: string;
  name: string;
  set_name: string;
  token_id: string;
}

export interface TcgProfileSbtRow {
  amount: number;
  image_url: string;
  name: string;
  token_id: string;
}

export interface TcgProfileExtremeRow {
  image_url: string;
  kind: "highest" | "lowest";
  name: string;
  token_id?: string;
  value_usd: number;
}

export type TcgProfileRankTier = "gold" | "silver" | "bronze" | "none";

export interface TcgProfileRank {
  rank: number | null;
  tier: TcgProfileRankTier;
}

export interface TcgProfileRankings {
  active_days: TcgProfileRank;
  holders_total: number;
  holdings: TcgProfileRank;
  pnl: TcgProfileRank;
  sbt: TcgProfileRank;
  snapshot_updated_at: string | null;
  source: string;
  total_spent: TcgProfileRank;
  trade_volume: TcgProfileRank;
  wallet_in_snapshot: boolean;
}

export interface TcgProfileSbtDiagnostics {
  burned_total: number;
  burn_transfers: number;
  current_total: number;
  incoming_transfers: number;
  minted_total: number;
  mint_transfers: number;
  outgoing_transfers: number;
  received_total: number;
  sent_total: number;
  source: string;
  status: "current_balance" | "no_sbt_transfer_history" | "all_minted_sbt_burned" | "all_sbt_transferred_or_burned" | "no_current_balance";
  transfer_count: number;
}

export interface TcgProfileWarning {
  code?: string;
  message?: string;
  source?: string;
}

export type TcgProfilePosterKind = "collection" | "history" | "extremes";
export const TCG_PROFILE_POSTER_KINDS: readonly TcgProfilePosterKind[] = ["collection", "history", "extremes"];
export const TCG_PROFILE_REQUEST_TIMEOUT_MS = 310_000;

export interface TcgProfilePosters {
  documents: Partial<Record<TcgProfilePosterKind, string>>;
  height: number;
  order: TcgProfilePosterKind[];
  schema_version: string;
  source: "tcg_pro_canonical_html_templates";
  width: number;
}

export interface TcgProfileData {
  cache?: "hit" | "miss";
  collection: TcgProfileCollectionRow[];
  extremes: {
    highest: TcgProfileExtremeRow | null;
    lowest: TcgProfileExtremeRow | null;
  };
  generated_at: string;
  loaded_sources: string[];
  history: {
    activity_rows: TcgProfileActivityRow[];
    pack_rows: TcgProfilePackRow[];
    range: string;
  };
  language: Language;
  metrics: TcgProfileMetrics;
  ok: boolean;
  posters: TcgProfilePosters;
  profile_name: string;
  requested_poster: TcgProfilePosterKind;
  rankings: TcgProfileRankings;
  sbt: TcgProfileSbtRow[];
  sbt_diagnostics: TcgProfileSbtDiagnostics | null;
  schema_version: string;
  wallet: string;
  warnings: TcgProfileWarning[];
}

const WALLET_PATTERN = /^0x[a-f0-9]{40}$/;

export function normalizeProfileWallet(value: string): string {
  const wallet = value.trim().toLowerCase();
  return WALLET_PATTERN.test(wallet) ? wallet : "";
}

export async function fetchTcgProfile(
  wallet: string,
  lang: Language,
  poster: TcgProfilePosterKind,
  signal: AbortSignal,
): Promise<TcgProfileData> {
  const normalized = normalizeProfileWallet(wallet);
  if (!normalized) throw new Error("invalid_wallet");
  const params = new URLSearchParams({
    wallet: normalized,
    lang,
    poster,
    include_extremes: poster === "extremes" ? "1" : "0",
    include_posters: "1",
  });
  const response = await fetch(intelApiUrl(`/api/tcg-profile?${params.toString()}`), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => ({})) as Partial<TcgProfileData> & { error?: string };
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  const posterDocuments = payload.posters?.documents;
  const posterDocumentKeys = posterDocuments ? Object.keys(posterDocuments) : [];
  const selectedDocument = posterDocuments?.[poster];
  const validHistorySnapshot = poster !== "history"
    || (Number(payload.rankings?.holders_total || 0) > 0 && Boolean(payload.rankings?.snapshot_updated_at));
  if (
    !payload.metrics
    || !payload.rankings
    || !Array.isArray(payload.collection)
    || !Array.isArray(payload.sbt)
    || !Array.isArray(payload.loaded_sources)
    || payload.wallet !== normalized
    || payload.language !== lang
    || payload.requested_poster !== poster
    || payload.posters?.source !== "tcg_pro_canonical_html_templates"
    || !Array.isArray(payload.posters.order)
    || payload.posters.order.length !== 1
    || payload.posters.order[0] !== poster
    || posterDocumentKeys.length !== 1
    || posterDocumentKeys[0] !== poster
    || typeof selectedDocument !== "string"
    || !selectedDocument.trim()
    || !validHistorySnapshot
  ) {
    if (!validHistorySnapshot) throw new Error("ranking_snapshot_unavailable");
    throw new Error("invalid_profile_response");
  }
  return payload as TcgProfileData;
}
