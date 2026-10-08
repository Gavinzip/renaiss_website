import { validPackSnapshot } from "./limited-pack-sbt.js";

/** Both frontends expire unverifiable data instead of keeping an old machine. */
export function subscribePackSnapshot(url, onChange) {
  const empty = { status: "loading", checked_at: null, valid_for_seconds: 0, non_limited_pack_names: [], campaigns: [] };
  let mounted = true;
  let controller;
  let expires;
  let nextCheck = 0;
  onChange(empty);
  const load = async () => {
    nextCheck = Date.now() + 60_000;
    controller?.abort();
    const request = controller = new AbortController();
    const timeout = setTimeout(() => request.abort(), 15_000);
    try {
      const response = await fetch(url, { signal: request.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Limited-pack source unavailable");
      const payload = await response.json();
      if (!validPackSnapshot(payload)) throw new Error("Invalid limited-pack SBT response");
      if (mounted && request === controller) {
        clearTimeout(expires);
        onChange(payload);
        if (payload.status === "loading") nextCheck = Date.now() + 2_000;
        if (payload.status === "ready") expires = setTimeout(() => onChange({ ...empty, status: "unavailable" }), payload.valid_for_seconds * 1_000);
      }
    } catch {
      if (mounted && request === controller) {
        clearTimeout(expires);
        onChange({ ...empty, status: "unavailable" });
      }
    } finally {
      clearTimeout(timeout);
    }
  };
  const visible = () => { if (document.visibilityState === "visible") void load(); };
  void load();
  const poll = setInterval(() => { if (document.visibilityState === "visible" && Date.now() >= nextCheck) void load(); }, 5_000);
  document.addEventListener("visibilitychange", visible);
  return () => {
    mounted = false;
    controller?.abort();
    clearTimeout(expires);
    clearInterval(poll);
    document.removeEventListener("visibilitychange", visible);
  };
}
