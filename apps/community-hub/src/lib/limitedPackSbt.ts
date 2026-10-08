import { useEffect, useState } from "react";
import { intelApiUrl } from "@/lib/api";
import { subscribePackSnapshot } from "../../../../website/assets/limited-pack-sbt-client.js";

export interface PackSbtBadge {
  id: number;
  name: string;
  category: "first_pull" | "s_card" | "special_tier";
  requirement: string;
}

export interface PackSbtCampaign {
  id: string;
  name: string;
  status: "open" | "upcoming" | "ended";
  earning_start: string | null;
  earning_end: string | null;
  source_url: string;
  badges: PackSbtBadge[];
  catalog_complete: boolean;
}

export interface LimitedPackSbtSnapshot {
  status: "loading" | "ready" | "unavailable";
  checked_at: string | null;
  valid_for_seconds: number;
  non_limited_pack_names: string[];
  campaigns: PackSbtCampaign[];
}

const INITIAL: LimitedPackSbtSnapshot = { status: "loading", checked_at: null, valid_for_seconds: 0, non_limited_pack_names: [], campaigns: [] };

/** One shared snapshot for the homepage and SBT view; no stale data on errors. */
export function useLimitedPackSbt(enabled: boolean, refreshKey: number): LimitedPackSbtSnapshot {
  const [snapshot, setSnapshot] = useState<LimitedPackSbtSnapshot>(INITIAL);
  useEffect(() => {
    if (!enabled) return;
    return subscribePackSnapshot(intelApiUrl("/api/intel/limited-pack-sbt"), setSnapshot);
  }, [enabled, refreshKey]);
  return snapshot;
}
