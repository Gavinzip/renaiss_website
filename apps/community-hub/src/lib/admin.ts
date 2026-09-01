import { intelApiUrl } from "@/lib/api";
import type { ProjectId } from "@/lib/projects";
import type { FeedCard, IntelFeed, PlanStatus } from "@/types";

export const CARD_TYPES = ["event", "announcement", "feature", "market", "report", "insight"] as const;
export const TOPIC_LABELS = ["events", "official", "sbt", "collectibles", "alpha", "guides", "community", "other"] as const;

export interface AdminStatus {
  server_time?: string;
  sync?: {
    status?: string;
    stage?: string;
    stage_label?: string;
    last_error?: string;
    latest_source?: string;
    last_success_at?: string;
    next_run_at?: string;
    progress_done_cards?: number;
    progress_total_cards?: number;
    progress_done_sources?: number;
    progress_total_sources?: number;
    progress_found_cards?: number;
    total_cards?: number;
    pipeline_counts?: Record<string, number>;
  };
  jobs?: {
    counts?: Record<string, number>;
    items?: Array<Record<string, unknown>>;
    total?: number;
  };
  content_refresh?: {
    counts?: Record<string, number>;
    items?: Array<Record<string, unknown>>;
    total?: number;
  };
  new_posts?: {
    is_processing?: boolean;
    new_cards_6h?: number;
    new_cards_24h?: number;
    pending_processing?: number;
  };
  i18n?: {
    effective_status?: string;
    lang_progress?: Record<string, { done?: number; pending_count?: number; status?: string; total?: number }>;
    status?: string;
  };
  memory?: {
    feedback_items?: number;
    field_overrides?: number;
    rules?: number;
    source_profiles?: number;
  };
  monitors?: {
    x?: {
      accounts?: string[];
      account_categories?: Record<string, "official" | "official_community" | "ambassador">;
      account_projects?: Record<string, string>;
      default_accounts?: string[];
      source_quality?: Record<string, string>;
      source_stats?: Record<string, Record<string, unknown>>;
      updated_at?: string;
      using_default?: boolean;
    };
  };
}

export interface CardEditorialDraft {
  cardType: string;
  eventWall: boolean;
  eventRegion: string;
  planStatus: PlanStatus;
  reason: string;
  sbtAcquisition: string;
  sbtNames: string;
  timelineDate: string;
  timelineEndDate: string;
  topicLabels: string[];
}

export interface EditorialHistoryItem {
  actor?: string;
  id?: string;
  patch?: Record<string, unknown>;
  reason?: string;
  revision?: number;
  source_account?: string;
  source_title?: string;
  updated_at?: string;
}

interface JsonResponse {
  error?: string;
  feed?: IntelFeed;
  history?: EditorialHistoryItem[];
  ok?: boolean;
  source?: Record<string, unknown>;
  status?: AdminStatus;
}

async function requestJson(path: string, init?: RequestInit, signal?: AbortSignal): Promise<JsonResponse> {
  const response = await fetch(intelApiUrl(path), {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal,
  });
  const payload = await response.json().catch(() => ({})) as JsonResponse;
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function post(path: string, body: Record<string, unknown>): Promise<JsonResponse> {
  return requestJson(path, { method: "POST", body: JSON.stringify(body) });
}

export function cardDraft(card: FeedCard): CardEditorialDraft {
  return {
    cardType: String(card.card_type ?? "insight"),
    eventWall: card.event_wall === true,
    eventRegion: String(card.event_region ?? "unknown"),
    planStatus: (String(card.plan_status ?? "needs_review") as PlanStatus),
    reason: "",
    sbtAcquisition: String(card.sbt_acquisition ?? ""),
    sbtNames: [...new Set([...(card.sbt_names ?? []), card.sbt_name].map((value) => String(value ?? "").trim()).filter(Boolean))].join(", "),
    timelineDate: String(card.timeline_date ?? "").slice(0, 10),
    timelineEndDate: String(card.timeline_end_date ?? "").slice(0, 10),
    topicLabels: (card.topic_labels ?? []).map((value) => String(value).toLowerCase()),
  };
}

export async function readAdminStatus(signal?: AbortSignal): Promise<AdminStatus> {
  const payload = await requestJson("/api/intel/admin-status?limit=12", undefined, signal);
  if (!payload.status) throw new Error("admin_status_missing");
  return payload.status;
}

export async function readAdminFeed(signal?: AbortSignal): Promise<IntelFeed> {
  const payload = await requestJson("/api/intel/admin-feed", undefined, signal);
  if (!payload.feed || !Array.isArray(payload.feed.cards)) throw new Error("admin_feed_missing");
  return payload.feed;
}

export async function readEditorialHistory(signal?: AbortSignal): Promise<EditorialHistoryItem[]> {
  const payload = await requestJson("/api/intel/editorial-history?limit=80", undefined, signal);
  return Array.isArray(payload.history) ? payload.history : [];
}

export async function saveCardEditorial(card: FeedCard, draft: CardEditorialDraft): Promise<boolean> {
  const id = String(card.id || "").trim();
  if (!id) throw new Error("找不到貼文 ID");
  if (!draft.cardType || !draft.topicLabels.length) throw new Error("請保留卡片類型與至少一個分區");
  if (draft.timelineDate && draft.timelineEndDate && draft.timelineEndDate < draft.timelineDate) throw new Error("結束日期不得早於開始日期");
  const original = cardDraft(card);
  const sameTopics = [...original.topicLabels].sort().join("|") === [...draft.topicLabels].sort().join("|");
  const changed = original.cardType !== draft.cardType
    || !sameTopics
    || original.timelineDate !== draft.timelineDate
    || original.timelineEndDate !== draft.timelineEndDate
    || original.eventWall !== draft.eventWall
    || original.eventRegion !== draft.eventRegion
    || original.planStatus !== draft.planStatus
    || original.sbtNames !== draft.sbtNames
    || original.sbtAcquisition !== draft.sbtAcquisition.trim()
    || Boolean(draft.reason.trim());
  if (!changed) return false;
  await post("/api/intel/editorial", {
    id,
    ...(card.editorial_revision !== undefined ? { expected_revision: Number(card.editorial_revision) } : {}),
    patch: {
      card_type: draft.cardType,
      topic_labels: draft.topicLabels,
      timeline_date: draft.timelineDate,
      timeline_end_date: draft.timelineEndDate,
      event_wall: draft.eventWall,
      event_region: draft.eventRegion,
      plan_status: draft.planStatus,
      sbt_names: draft.sbtNames,
      sbt_acquisition: draft.sbtAcquisition.trim(),
      reason: draft.reason.trim(),
    },
  });
  return true;
}

export async function updateCardSelection(cardId: string, action: "bottom" | "clear" | "exclude" | "include" | "pin" | "unbottom" | "unpin", reason = ""): Promise<void> {
  await post("/api/intel/pick", { id: cardId, action, reason });
}

export async function updateTrackedAccount(action: "add" | "remove" | "set_category" | "set_project", account: string, category?: "official" | "official_community" | "ambassador", projectId?: ProjectId): Promise<void> {
  const value = String(account || "").trim().replace(/^@+/, "");
  if (!value) throw new Error("請輸入帳號");
  await post("/api/intel/source-config", { action, account: value, ...(category ? { category } : {}), ...(projectId ? { project_id: projectId } : {}) });
}

export async function refreshCardContent(cardId: string): Promise<void> {
  await post("/api/intel/refresh-content", { id: cardId });
}

export async function triggerIntelSync(): Promise<void> {
  await post("/api/intel/sync", { background: true, days: 30 });
}
