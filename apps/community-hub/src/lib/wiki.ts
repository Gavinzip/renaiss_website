import { completePipelineRequest, type PipelineEnvelope } from "@/lib/pipelineJob";
import { intelApiUrl } from "@/lib/api";
import { readJson } from "@/lib/jsonRequest";
import type { BeginnerWikiDocument, Language, LegacyBeginnerData } from "@/types";

interface WikiApiPayload extends PipelineEnvelope {
  cache?: { pending?: boolean };
  code?: string;
  error?: string;
  ok?: boolean;
  wiki?: Partial<BeginnerWikiDocument>;
}

export class WikiConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikiConflictError";
  }
}

function normalizeDocument(payload: WikiApiPayload): BeginnerWikiDocument {
  const wiki = payload.wiki;
  if (!wiki?.exists || !wiki.data || typeof wiki.data !== "object") {
    throw new Error(payload.error || "Wiki 尚未建立");
  }
  return {
    data: wiki.data,
    exists: true,
    meta: { ...(wiki.meta && typeof wiki.meta === "object" ? wiki.meta : {}), cache_pending: payload.cache?.pending === true },
  };
}

export async function readBeginnerWiki(signal?: AbortSignal): Promise<BeginnerWikiDocument> {
  const payload = await readJson(intelApiUrl("/api/wiki/beginner"), { credentials: "omit", cache: "default", signal }) as WikiApiPayload;
  if (!payload || payload.ok === false) throw new Error(payload?.error || "wiki_request_failed");
  return normalizeDocument(payload);
}

export async function saveBeginnerWiki(
  data: LegacyBeginnerData,
  sourceLang: Language,
  baseHash: string,
): Promise<BeginnerWikiDocument> {
  const response = await fetch(intelApiUrl("/api/wiki/beginner"), {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      source_lang: sourceLang,
      auto_translate: true,
      ...(baseHash ? { base_hash: baseHash } : {}),
    }),
  });
  const initial = await response.json().catch(() => ({})) as WikiApiPayload;
  const payload = await completePipelineRequest(initial);
  if (response.status === 409 || payload.code === "wiki_conflict") {
    throw new WikiConflictError(payload.error || "Wiki 已被其他人更新，請重新載入後再儲存。");
  }
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return normalizeDocument(payload);
}

export function cloneWikiData(data: LegacyBeginnerData): LegacyBeginnerData {
  return structuredClone(data);
}
