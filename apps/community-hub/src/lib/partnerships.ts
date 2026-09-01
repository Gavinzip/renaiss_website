import type { FeedCard } from "@/types";

const RENAISS_INDEX_ACCOUNT = "renaiss_index";
const PARTNERSHIP_PATTERNS = [
  /\b(?:renaiss\s+index\s+)?is\s+partnering\s+with\s+[“\"]?([^.!?\n🤝]{2,80})/i,
  /\b(?:renaiss\s+index\s+)?(?:has\s+)?partnered\s+with\s+[“\"]?([^.!?\n🤝]{2,80})/i,
  /\b(?:renaiss\s+index\s+)?announces?\s+(?:a\s+)?partnership\s+with\s+[“\"]?([^.!?\n🤝]{2,80})/i,
] as const;

function normalizedAccount(value: unknown): string {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function cleanPartnerName(value: unknown): string {
  return String(value ?? "")
    .replace(/[”"'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Returns only partnerships explicitly stated in the original Index source.
 * Translated editorial titles are deliberately excluded so the classification
 * remains stable across UI languages.
 */
export function indexPartnershipNames(card: FeedCard): string[] {
  if (normalizedAccount(card.account) !== RENAISS_INDEX_ACCOUNT) return [];

  const structured = (card.partner_names ?? []).map(cleanPartnerName).filter(Boolean);
  if (card.official_update_kind === "partnership" && structured.length) return [...new Set(structured)];

  const source = String(card.raw_text ?? "").trim();
  if (!source) return [];
  for (const pattern of PARTNERSHIP_PATTERNS) {
    const match = source.match(pattern);
    const name = cleanPartnerName(match?.[1]);
    if (name) return [name];
  }
  return [];
}

export function isIndexPartnershipUpdate(card: FeedCard): boolean {
  return indexPartnershipNames(card).length > 0;
}
