import { isOfficial } from "@/lib/feed";
import type { AccountProjectMap } from "@/lib/projects";
import type { LimitedPackSbtSnapshot, PackSbtCampaign } from "@/lib/limitedPackSbt";
import type { FeedCard } from "@/types";
import { weeklyPackCampaigns as sharedCampaigns } from "../../../../website/assets/limited-pack-sbt.js";
export { taipeiWeek, packInCurrentWindow } from "../../../../website/assets/limited-pack-sbt.js";

export function weeklyPackCampaigns(snapshot: LimitedPackSbtSnapshot, cards: FeedCard[], accountProjects: AccountProjectMap, reference = new Date()): PackSbtCampaign[] {
  return sharedCampaigns(snapshot, cards.filter((card) => isOfficial(card, accountProjects)), reference);
}
