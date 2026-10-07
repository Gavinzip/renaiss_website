import { toDate } from "@/lib/feed";
import type { FeedCard } from "@/types";

const genericEntities = new Set(["renaiss", "renaissxyz", "vinci world", "vinciwld", "bnb chain", "bnbchain", "web3", "blockchain", "community", "gacha", "pack", "product", "cbo", "chief business o", "chief business officer", "卡牌", "收藏品"]);
const genericWords = new Set(["renaiss", "vinci", "world", "bnb", "chain", "official", "update", "product", "pack", "the", "and", "for", "with", "from"]);
const appointment = /\bcbo\b|chief business officer|商務長|商务长/;

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[@#]/g, "").replace(/\s+/g, " ").trim();
}

function titleTokens(title: string): Set<string> {
  const value = normalize(title).replace(/renaiss|vinci world|bnb\s*chain/g, "");
  const tokens = new Set((value.match(/[a-z][a-z0-9_]{2,}/g) ?? []).filter((word) => !genericWords.has(word)));
  for (const phrase of value.match(/[\p{Script=Han}]+/gu) ?? []) {
    for (let index = 0; index < phrase.length - 1; index++) tokens.add(phrase.slice(index, index + 2));
  }
  return tokens;
}

export function sameHighlightStory(left: FeedCard, right: FeedCard): boolean {
  if (left.url && left.url === right.url || left.id && left.id === right.id) return true;
  if (left.canonical_story_id && left.canonical_story_id === (right.canonical_story_id || right.id)) return true;
  if (right.canonical_story_id && right.canonical_story_id === left.id) return true;
  const leftTime = toDate(left.published_at);
  const rightTime = toDate(right.published_at);
  if (!leftTime || !rightTime || Math.abs(leftTime.valueOf() - rightTime.valueOf()) > 7 * 86_400_000) return false;
  const titleA = normalize(left.title ?? "");
  const titleB = normalize(right.title ?? "");
  if (titleA.length >= 6 && titleA === titleB) return true;
  const tokensA = titleTokens(titleA);
  const tokensB = titleTokens(titleB);
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  if (shared >= 3 && shared / Math.max(1, Math.min(tokensA.size, tokensB.size)) >= 0.6) return true;

  const sourceA = normalize(`${left.title ?? ""} ${left.raw_text ?? ""}`);
  const sourceB = normalize(`${right.title ?? ""} ${right.raw_text ?? ""}`);
  const handles = `${left.raw_text ?? ""} ${right.raw_text ?? ""}`.match(/@[a-zA-Z0-9_]+/g) ?? [];
  const entities = [...(left.partner_names ?? []), ...(right.partner_names ?? []), ...(left.tags ?? []), ...(right.tags ?? []), ...handles].map(normalize);
  const sharesEntity = entities.some((entity) => entity.length >= 3 && !genericEntities.has(entity) && sourceA.includes(entity) && sourceB.includes(entity));
  return sharesEntity && (shared >= 2 || appointment.test(sourceA) && appointment.test(sourceB));
}

export function distinctHighlightStories(cards: FeedCard[]): FeedCard[] {
  const selected: FeedCard[] = [];
  for (const card of cards) {
    if (!selected.some((story) => sameHighlightStory(story, card))) selected.push(card);
  }
  return selected;
}
