import type { FeedCard } from "@/types";

export const CARD_TYPES = ["event", "product_progress", "announcement", "market", "report", "guide", "insight"] as const;
export const TOPIC_LABELS = ["collectibles", "sbt"] as const;
export const SOURCE_ROLES = ["official", "official_community", "other"] as const;

export type CardType = (typeof CARD_TYPES)[number];
export type SourceRole = (typeof SOURCE_ROLES)[number];
export type TopicLabel = (typeof TOPIC_LABELS)[number];

export function cardType(card: FeedCard): CardType | "" {
  const value = String(card.card_type ?? "").trim().toLowerCase();
  return CARD_TYPES.includes(value as CardType) ? value as CardType : "";
}

export function topicLabels(card: FeedCard): TopicLabel[] {
  return [...new Set((card.topic_labels ?? [])
    .map((value) => String(value).trim().toLowerCase())
    .filter((value): value is TopicLabel => TOPIC_LABELS.includes(value as TopicLabel)))];
}

export function storedSourceRole(card: FeedCard): SourceRole | "" {
  const value = String(card.source_role ?? "").trim().toLowerCase();
  return SOURCE_ROLES.includes(value as SourceRole) ? value as SourceRole : "";
}
