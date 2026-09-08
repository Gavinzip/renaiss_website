import type { FeedCard } from "@/types";

export const CARD_TYPES = ["event", "product_progress", "announcement", "market", "report", "guide", "insight"] as const;
export const ROUTING_TOPICS = ["collectibles"] as const;
export const SOURCE_ROLES = ["official", "official_community", "other"] as const;

export type CardType = (typeof CARD_TYPES)[number];
export type SourceRole = (typeof SOURCE_ROLES)[number];
export type RoutingTopic = (typeof ROUTING_TOPICS)[number];

export function cardType(card: FeedCard): CardType | "" {
  const value = String(card.card_type ?? "").trim().toLowerCase();
  return CARD_TYPES.includes(value as CardType) ? value as CardType : "";
}

export function routingTopics(card: FeedCard): RoutingTopic[] {
  return [...new Set((card.routing_topics ?? [])
    .map((value) => String(value).trim().toLowerCase())
    .filter((value): value is RoutingTopic => ROUTING_TOPICS.includes(value as RoutingTopic)))];
}

export function storedSourceRole(card: FeedCard): SourceRole | "" {
  const value = String(card.source_role ?? "").trim().toLowerCase();
  return SOURCE_ROLES.includes(value as SourceRole) ? value as SourceRole : "";
}
