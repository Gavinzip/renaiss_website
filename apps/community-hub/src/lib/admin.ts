import { completePipelineRequest } from "@/lib/pipelineJob";
import { intelApiUrl } from "@/lib/api";
import { readJson } from "@/lib/jsonRequest";
import type { ProjectId } from "@/lib/projects";
import type { FeedCard, IntelFeed, PlanStatus, RecordResult, SbtEntry } from "@/types";
import { CARD_TYPES, ROUTING_TOPICS } from "@/lib/taxonomy";

export { CARD_TYPES, ROUTING_TOPICS };

export interface AdminStatus {
  job_control?: { status_token: string };
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
      account_categories?: Record<string, "official" | "official_community" | "other">;
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
  eventRegion: string;
  planStatus: PlanStatus;
  productIds: string[];
  recordResult: RecordResult | null;
  reason: string;
  sbtEntries: SbtEntry[];
  timelineDate: string;
  timelineEndDate: string;
  routingTopics: string[];
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
  job?: { id: string; status: string; status_token?: string; message?: string; error?: string; response?: Record<string,unknown> | null };
  error?: string;
  feed?: IntelFeed;
  history?: EditorialHistoryItem[];
  ok?: boolean;
  source?: Record<string, unknown>;
  status?: AdminStatus;
}

async function requestJson(path: string, init?: RequestInit, signal?: AbortSignal): Promise<JsonResponse> {
  if (!init?.method || init.method === "GET") {
    const payload = await readJson(intelApiUrl(path), { credentials: "include", signal }) as JsonResponse;
    if (!payload || payload.ok === false) throw new Error(payload?.error || "admin_request_failed");
    return payload;
  }
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
  return requestJson(path, { method: "POST", body: JSON.stringify(body) }).then(payload => completePipelineRequest(payload));
}

export function cardDraft(card: FeedCard): CardEditorialDraft {
  return {
    cardType: String(card.card_type ?? "insight"),
    eventRegion: String(card.event_region ?? "unknown"),
    planStatus: (String(card.plan_status ?? "needs_review") as PlanStatus),
    productIds: (card.product_ids ?? []).map((value) => String(value).toLowerCase()),
    recordResult: card.record_result ? { ...card.record_result } : null,
    reason: "",
    sbtEntries: (card.sbt_entries ?? []).map((entry) => ({ ...entry })),
    timelineDate: String(card.timeline_date ?? "").slice(0, 10),
    timelineEndDate: String(card.timeline_end_date ?? "").slice(0, 10),
    routingTopics: (card.routing_topics ?? []).map((value) => String(value).toLowerCase()),
  };
}

export async function readAdminStatus(signal?: AbortSignal): Promise<AdminStatus> {
  const payload = await requestJson("/api/intel/admin-status?limit=12", undefined, signal);
  if (!payload.status) throw new Error("admin_status_missing");
  return payload.status;
}

export async function readAdminJobProgress(token: string, signal?: AbortSignal): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(intelApiUrl('/api/intel/job-status'), {
    method: 'POST', cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: 'admin-jobs' }), signal,
  });
  const payload = await response.json() as { ok?: boolean; error?: string; jobs?: Array<Record<string,unknown>> };
  if (!response.ok || !payload.ok || !Array.isArray(payload.jobs)) throw new Error(payload.error || '工作進度讀取失敗');
  return payload.jobs;
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
  if (!draft.cardType) throw new Error("請保留卡片類型");
  if (draft.timelineDate && draft.timelineEndDate && draft.timelineEndDate < draft.timelineDate) throw new Error("結束日期不得早於開始日期");
  for (const entry of draft.sbtEntries) {
    if (!entry.name.trim() || !entry.evidence.trim()) throw new Error("每筆 SBT 都必須填寫名稱與原文證據");
    if (entry.start_date && entry.end_date && entry.end_date < entry.start_date) throw new Error("SBT 結束日期不得早於開始日期");
  }
  if (draft.recordResult && (!draft.recordResult.subject.trim() || !draft.recordResult.evidence.trim())) throw new Error("紀錄／結果必須填寫對象與原文證據");
  const original = cardDraft(card);
  const sameTopics = [...original.routingTopics].sort().join("|") === [...draft.routingTopics].sort().join("|");
  const sameProducts = [...original.productIds].sort().join("|") === [...draft.productIds].sort().join("|");
  const changed = original.cardType !== draft.cardType
    || !sameTopics
    || !sameProducts
    || original.timelineDate !== draft.timelineDate
    || original.timelineEndDate !== draft.timelineEndDate
    || original.eventRegion !== draft.eventRegion
    || original.planStatus !== draft.planStatus
    || JSON.stringify(original.sbtEntries) !== JSON.stringify(draft.sbtEntries)
    || JSON.stringify(original.recordResult) !== JSON.stringify(draft.recordResult)
    || Boolean(draft.reason.trim());
  if (!changed) return false;
  await post("/api/intel/editorial", {
    id,
    ...(card.editorial_revision !== undefined ? { expected_revision: Number(card.editorial_revision) } : {}),
    patch: {
      card_type: draft.cardType,
      routing_topics: draft.routingTopics,
      product_ids: draft.productIds,
      timeline_date: draft.timelineDate,
      timeline_end_date: draft.timelineEndDate,
      event_region: draft.eventRegion,
      plan_status: draft.planStatus,
      sbt_entries: draft.sbtEntries,
      record_result: draft.recordResult,
      reason: draft.reason.trim(),
    },
  });
  return true;
}

export async function updateCardSelection(cardId: string, action: "bottom" | "clear" | "exclude" | "include" | "pin" | "unbottom" | "unpin", reason = ""): Promise<void> {
  await post("/api/intel/pick", { id: cardId, action, reason });
}

export async function updateTrackedAccount(action: "add" | "remove" | "set_category" | "set_project", account: string, category?: "official" | "official_community" | "other", projectId?: ProjectId): Promise<void> {
  const value = String(account || "").trim().replace(/^@+/, "");
  if (!value) throw new Error("請輸入帳號");
  await post("/api/intel/source-config", { action, account: value, ...(category ? { category } : {}), ...(projectId ? { project_id: projectId } : {}) });
}

export async function refreshCardContent(cardId: string, onProgress?: (message: string) => void, signal?: AbortSignal): Promise<void> {
  const submitted = await requestJson("/api/intel/refresh-content", { method: "POST", body: JSON.stringify({ id: cardId }) }, signal);
  if (!submitted.job?.id) throw new Error("缺少背景工作編號，尚未確認分析完成。");
  const started = Date.now();
  while (!signal?.aborted && Date.now() - started < 30 * 60 * 1000) {
    const poll = new AbortController();
    const cancel = () => poll.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const deadline = window.setTimeout(cancel, 20_000);
    let response: JsonResponse;
    try {
      response = await requestJson("/api/intel/job-status", { method: "POST", body: JSON.stringify({ id: submitted.job.id }), headers: { Authorization: `Bearer ${submitted.job.status_token}` } }, poll.signal);
    } catch (error) {
      if (poll.signal.aborted && !signal?.aborted) throw new Error("查詢逾時，背景工作仍可能執行中，請重新整理後查看。");
      throw error;
    } finally {
      window.clearTimeout(deadline);
      signal?.removeEventListener("abort", cancel);
    }
    const job = response.job;
    if (!job) throw new Error("無法讀取背景工作狀態");
    if (job.status === "done") return;
    if (job.status === "failed") throw new Error(job.error || job.message || "分析失敗");
    onProgress?.(job.message || "背景分析進行中…");
    await new Promise(resolve => window.setTimeout(resolve, 5000));
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  throw new Error("工作仍在背景執行，請從管理頁查看進度。");
}

export async function triggerIntelSync(): Promise<void> {
  await requestJson("/api/intel/sync", { method:"POST",body:JSON.stringify({ background:true,days:30 }) });
}
