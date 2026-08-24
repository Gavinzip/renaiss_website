import type { FeedCard, Language } from "@/types";

export type EventRegionId = "global" | "tw" | "kr" | "my" | "vn" | "th" | "multi_region" | "unknown";

interface EventRegion {
  id: EventRegionId;
  labels: Record<Language, string>;
}

const REGIONS: EventRegion[] = [
  { id: "global", labels: { "zh-Hant": "全球", "zh-Hans": "全球", en: "Global", ko: "글로벌" } },
  { id: "tw", labels: { "zh-Hant": "台灣", "zh-Hans": "台湾", en: "Taiwan", ko: "대만" } },
  { id: "kr", labels: { "zh-Hant": "韓國", "zh-Hans": "韩国", en: "Korea", ko: "한국" } },
  { id: "my", labels: { "zh-Hant": "馬來西亞", "zh-Hans": "马来西亚", en: "Malaysia", ko: "말레이시아" } },
  { id: "vn", labels: { "zh-Hant": "越南", "zh-Hans": "越南", en: "Vietnam", ko: "베트남" } },
  { id: "th", labels: { "zh-Hant": "泰國", "zh-Hans": "泰国", en: "Thailand", ko: "태국" } },
  { id: "multi_region", labels: { "zh-Hant": "跨地區", "zh-Hans": "跨地区", en: "Multi-region", ko: "다지역" } },
  { id: "unknown", labels: { "zh-Hant": "待確認", "zh-Hans": "待确认", en: "Unconfirmed", ko: "확인 필요" } },
];

const REGION_BY_ID = new Map(REGIONS.map((region) => [region.id, region]));
const REGION_ID_BY_ACCOUNT = new Map<string, EventRegionId>([
  ["renaissxyz", "global"],
  ["renaisstwcm", "tw"],
  ["renaisskrcm", "kr"],
  ["renaissmycm", "my"],
  ["renaiss_vn", "vn"],
  ["renaiss_th", "th"],
]);

function normalizedAccount(card: FeedCard): string {
  return String(card.account ?? "").trim().replace(/^@+/, "").toLowerCase();
}

export function isRegionalCommunitySource(card: FeedCard): boolean {
  const regionId = REGION_ID_BY_ACCOUNT.get(normalizedAccount(card));
  return Boolean(regionId && regionId !== "global");
}

export function eventRegion(card: FeedCard): EventRegion {
  const regionId = String(card.event_region ?? "").trim().toLowerCase() as EventRegionId;
  return REGION_BY_ID.get(regionId) ?? REGION_BY_ID.get("unknown")!;
}

export function preferredEventRegion(lang: Language): EventRegionId {
  if (lang === "zh-Hant") return "tw";
  if (lang === "ko") return "kr";
  return "global";
}

export function eventRegionLabel(card: FeedCard, lang: Language): string {
  return eventRegion(card).labels[lang];
}

export function regionIdForAccount(account: string): EventRegionId {
  return REGION_ID_BY_ACCOUNT.get(String(account).trim().replace(/^@+/, "").toLowerCase()) ?? "unknown";
}

export function regionLabel(regionId: EventRegionId, lang: Language): string {
  return REGION_BY_ID.get(regionId)?.labels[lang] ?? REGION_BY_ID.get("unknown")!.labels[lang];
}

export function regionLabelForAccount(account: string, lang: Language): string {
  return regionLabel(regionIdForAccount(account), lang);
}
