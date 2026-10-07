import type { FeedResponse, IntelFeed } from "../types";
import { readJson } from "./jsonRequest";

export class FeedRequestError extends Error {
  constructor(readonly failure: "invalidPayload") {
    super(failure);
    this.name = "FeedRequestError";
  }
}

interface FeedRequestOptions {
  signal: AbortSignal;
  timeoutMs?: number;
  request?: typeof fetch;
  idleTimeoutMs?: number;
  onRetry?: () => void;
}

/** The deadline covers both response headers and the complete JSON body. */
export async function readIntelFeed(url: string, options: FeedRequestOptions): Promise<IntelFeed> {
  const payload = await readJson(url, options) as FeedResponse;
  if (!payload || !payload.ok || !payload.feed || !Array.isArray(payload.feed.cards)) {
    if (typeof payload?.error === "string" && payload.error) throw new Error(payload.error);
    throw new FeedRequestError("invalidPayload");
  }
  return payload.feed;
}
