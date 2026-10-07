export type JsonRequestFailure = "timeout" | "stalled" | "transfer" | "invalidJson";

export class JsonRequestError extends Error {
  constructor(readonly failure: JsonRequestFailure) {
    super(failure);
    this.name = "JsonRequestError";
  }
}

interface JsonRequestOptions {
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  onRetry?: () => void;
  request?: typeof fetch;
}

async function readAttempt(url: string, signal: AbortSignal, options: JsonRequestOptions): Promise<unknown> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectInterrupted: (reason: unknown) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
  const cancel = () => {
    rejectInterrupted(signal.reason);
    controller.abort(signal.reason);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const progress = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      rejectInterrupted(new JsonRequestError("stalled"));
      controller.abort();
    }, options.idleTimeoutMs ?? 12_000);
  };
  const read = async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      progress();
      const response = await (options.request ?? fetch)(url, {
        cache: "no-store", credentials: options.credentials, headers: options.headers, signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      progress();
      reader = response.body?.getReader();
      if (!reader) throw new JsonRequestError("invalidJson");
      const decoder = new TextDecoder();
      let json = "";
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        if (part.value.byteLength) progress();
        json += decoder.decode(part.value, { stream: true });
      }
      try { return JSON.parse(json + decoder.decode()) as unknown; }
      catch { throw new JsonRequestError("invalidJson"); }
    } catch (error) {
      if (controller.signal.aborted || error instanceof JsonRequestError || (error instanceof Error && /^HTTP \d+$/.test(error.message))) throw error;
      throw new JsonRequestError("transfer");
    } finally {
      reader?.releaseLock();
    }
  };
  try { return await Promise.race([read(), interrupted]); }
  finally {
    clearTimeout(idleTimer);
    signal.removeEventListener("abort", cancel);
    controller.abort();
  }
}

/** Read-only requests: one retry for interrupted transport, never for bad data. */
export async function readJson(url: string, options: JsonRequestOptions = {}): Promise<unknown> {
  options.signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", cancel, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new JsonRequestError("timeout"));
      controller.abort();
    }, options.timeoutMs ?? 45_000);
  });
  const read = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await readAttempt(url, controller.signal, options); }
      catch (error) {
        if (controller.signal.aborted || attempt === 1 || !(error instanceof JsonRequestError) || !["stalled", "transfer"].includes(error.failure)) throw error;
        options.onRetry?.();
      }
    }
    throw new JsonRequestError("transfer");
  };
  try { return await Promise.race([read(), deadline]); }
  finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
