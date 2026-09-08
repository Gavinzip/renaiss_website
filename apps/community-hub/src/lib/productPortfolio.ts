import type { FeedCard } from "@/types";

export type ProductFamilyId = "fair" | "gacha" | "packs" | "rewards" | "index" | "tech" | "store" | "platform" | "vinci";
export type ProductMode = "core" | "experimental" | "candidate";
export type ProductStatus = "candidate" | "proposed" | "upcoming" | "live" | "updated" | "maintenance" | "adopted" | "sold_out" | "claim_open" | "completed" | "prototype" | "expanding" | "restocked";
export type ProductUpdateKind = "proposal" | "implementation" | "adoption" | "launch" | "content_update" | "maintenance" | "restock" | "sold_out" | "claim_open" | "policy_change" | "partnership" | "partner_added" | "prototype" | "announcement" | "milestone" | "context";

export interface ProductTimelineEvent {
  card: FeedCard;
  date: string;
  kind: ProductUpdateKind;
  relatedProductIds: string[];
}

export interface ProductSnapshot {
  evidenceCard?: FeedCard;
  evidenceImage: string;
  familyId: ProductFamilyId;
  icon: string;
  id: string;
  lastVerifiedAt: string;
  mode: ProductMode;
  name: string;
  nameKey?: string;
  ownerAccounts: readonly string[];
  standaloneCards: FeedCard[];
  status: ProductStatus;
  summary: string;
  summaryKey?: string;
  timeline: ProductTimelineEvent[];
}

export interface ProductFamilySnapshot {
  icon: string;
  id: ProductFamilyId;
  products: ProductSnapshot[];
  standaloneCount: number;
  updateCount: number;
}

export interface ProductSourceSnapshot {
  account: string;
  ownedFamilyIds: ProductFamilyId[];
  ownedProductIds: string[];
  updateCount: number;
}

export interface ProductRelatedUpdate {
  card: FeedCard;
  familyId: ProductFamilyId;
  isMilestone: boolean;
  kind: ProductUpdateKind;
  productId: string;
}

export interface ProductPortfolio {
  families: ProductFamilySnapshot[];
  productCount: number;
  relatedUpdates: ProductRelatedUpdate[];
  standaloneCount: number;
  sources: ProductSourceSnapshot[];
  unassignedUpdates: FeedCard[];
  unmappedUpdates: ProductTimelineEvent[];
  updateCount: number;
}

interface ProductEntityDefinition {
  familyId: ProductFamilyId;
  icon: string;
  id: string;
  mode?: ProductMode;
  name: string;
  ownerAccounts: readonly string[];
  priority: number;
}

const FAMILY_ORDER: ProductFamilyId[] = ["fair", "gacha", "packs", "rewards", "index", "tech", "store", "platform", "vinci"];
const FAMILY_ICONS: Record<ProductFamilyId, string> = {
  fair: "badge-check",
  gacha: "blocks",
  packs: "package-open",
  rewards: "gift",
  index: "chart-no-axes-combined",
  tech: "flask-conical",
  store: "shopping-bag",
  platform: "sliders-horizontal",
  vinci: "sparkles",
};

const RENAISS_XYZ_OWNER = ["renaissxyz"] as const;
const RENAISS_INDEX_OWNER = ["renaiss_index"] as const;
const TASTE_LAB_OWNER = ["tastedotmd"] as const;
const VINCI_WORLD_OWNER = ["vinciwld"] as const;

const PRODUCT_ENTITIES: ProductEntityDefinition[] = [
  { id: "proof-of-fair", familyId: "fair", name: "RIP: Proof of Fair", icon: "shield-check", priority: 140, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "pandora-248", familyId: "gacha", name: "PANDORA 248", icon: "circle-dollar-sign", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "pandora-88", familyId: "gacha", name: "PANDORA 88", icon: "circle-dollar-sign", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "pandora-48", familyId: "gacha", name: "PANDORA 48", icon: "circle-dollar-sign", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "pandora-28", familyId: "gacha", name: "PANDORA 28", icon: "circle-dollar-sign", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "eden-gacha", familyId: "gacha", name: "EDEN Gacha", icon: "gem", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "infinite-gacha", familyId: "gacha", name: "Infinite Gacha", icon: "infinity", priority: 40, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "niu-lai-pack", familyId: "packs", name: "NIU LAI Pack", icon: "beef", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "genesis-pack", familyId: "packs", name: "Genesis Pack", icon: "package-open", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "surge-pack", familyId: "packs", name: "Surge Pack", icon: "package-open", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "inferno-pack", familyId: "packs", name: "Inferno Pack", icon: "package-open", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "tempest-pack", familyId: "packs", name: "Tempest Pack", icon: "package-open", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "omega-pack", familyId: "packs", name: "Omega Pack", icon: "package-open", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "referral-rewards", familyId: "rewards", name: "Referral Rewards", icon: "gift", priority: 120, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "renaiss-index", familyId: "index", name: "Renaiss Index", icon: "chart-no-axes-combined", priority: 80, ownerAccounts: RENAISS_INDEX_OWNER },
  { id: "renaiss-air", familyId: "tech", name: "Renaiss AIR", icon: "wind", priority: 140, mode: "experimental", ownerAccounts: TASTE_LAB_OWNER },
  { id: "collector-assistant", familyId: "tech", name: "Collector Assistant", icon: "bot", priority: 140, mode: "experimental", ownerAccounts: TASTE_LAB_OWNER },
  { id: "card-platform-analysis", familyId: "tech", name: "Card Platform Analysis", icon: "scan-search", priority: 140, mode: "experimental", ownerAccounts: TASTE_LAB_OWNER },
  { id: "store-redemption", familyId: "store", name: "Merch Rewards Redemption", icon: "shopping-bag", priority: 120, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "collectibles-binder", familyId: "platform", name: "Collectibles Binder", icon: "book-image", priority: 130, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "card-handling-fees", familyId: "platform", name: "Card Handling Fees", icon: "receipt-text", priority: 120, ownerAccounts: RENAISS_XYZ_OWNER },
  { id: "social-hall", familyId: "vinci", name: "Vinci World Social Hall", icon: "door-open", priority: 110, mode: "candidate", ownerAccounts: VINCI_WORLD_OWNER },
];

export const PRODUCT_OPTIONS = PRODUCT_ENTITIES.map(({ id, name }) => ({ id, name }));

const ONE_TIME_KINDS = new Set<ProductUpdateKind>(["proposal", "implementation", "adoption", "launch", "sold_out", "policy_change", "prototype", "announcement"]);
const VERIFIED_STATE_CHANGE_KINDS = new Set<ProductUpdateKind>([
  "adoption",
  "claim_open",
  "content_update",
  "implementation",
  "launch",
  "maintenance",
  "policy_change",
  "prototype",
  "restock",
  "sold_out",
]);

function sourceText(card: FeedCard): string {
  return String(card.raw_text ?? "").trim();
}

function normalizedAccount(card: FeedCard): string {
  return String(card.account ?? "").trim().toLowerCase().replace(/^@+/, "");
}

function cardDate(card: FeedCard): string {
  return String(card.timeline_date || card.published_at || "").slice(0, 10);
}

function dateValue(card: FeedCard): number {
  return new Date(card.published_at || card.timeline_date || 0).valueOf() || 0;
}

function evidenceImage(card: FeedCard | undefined): string {
  const cover = String(card?.cover_image ?? "").trim();
  if (cover) return cover;
  return card?.media_images?.map((image) => String(image).trim()).find(Boolean) ?? "";
}

function updateKind(card: FeedCard, text: string): ProductUpdateKind {
  const cardType = String(card.card_type ?? "").toLowerCase();
  const plan = String(card.plan_status ?? "").toLowerCase();
  if (["event", "market", "report", "guide"].includes(cardType) && cardType !== "product_progress") return "context";
  if (/\bsold\s*out\b|all\s+[\d,]+\s+packs?\s+have\s+been\s+claimed|全數(?:完售|售罄|認領)|全数(?:售罄|认领)/i.test(text)) return "sold_out";
  if (/\bmaintenance\b|維護公告|维护公告/i.test(text)) return "maintenance";
  if (/\bcard\s+handling\s+fee\s+update\b|手續費調整|手续费调整/i.test(text)) return "policy_change";
  if (/\bhackathon\b|\bproject\s+spotlight\b/i.test(text)) return "prototype";
  if (/(?:first|首個|首个).{0,80}(?:implement|apply|實作|实作|採用|采用).{0,80}\bRIP\b|\bRIP\b.{0,80}(?:first|首個|首个).{0,80}(?:implement|apply|實作|实作|採用|采用)/i.test(text)) return "implementation";
  if (/\bimprovement\s+proposal\b|改善提案|개선\s*제안|\bRIP\b.{0,80}(?:introduc|proposal|chapter)|(?:introduc|proposal|chapter).{0,80}\bRIP\b/i.test(text)) return "proposal";
  if (/(?:all|every).{0,80}gacha.{0,80}(?:adopt|use|proof\s+of\s+fair)|(?:全數|全部|所有).{0,80}(?:扭蛋機|转蛋机).{0,80}(?:採用|导入|導入)/i.test(text)) return "adoption";
  if (/\brestock(?:ed|ing)?\b|補貨|补货/i.test(text)) return "restock";
  if (/\bavailable\s+to\s+claim\b|\bclaim\s+(?:your|rewards?)\b|\bSBTs?\s+have\s+now\s+been\s+dropped\b|\bfollow\b.{0,100}\b(?:early\s+supporter\s+)?SBT\b|開放(?:領取|認領)|开放(?:领取|认领)/i.test(text)) return "claim_open";
  if (/\bnow\s+live\b|\bis\s+now\s+open\b|\blaunch(?:es|ed|ing)?\b|\bgo(?:es|ing)?\s+live\b|正式(?:上線|上线|開賣|开卖)|開賣|开卖|已上線|已上线/i.test(text)) return "launch";
  if (/\bpartner(?:ship|ed|ing)?\b|\bteamed\s+up\b|\bbuilt\s+with\b|\bintegrat(?:e|ed|ion)\b|合作(?:夥伴|伙伴|建構|建立)?/i.test(text)) {
    if (normalizedAccount(card) === "renaiss_index" && cardType === "announcement" && plan === "not_plan") return "partner_added";
    return "partnership";
  }
  if (/\bnew\s+(?:cards?|chase|pool|price\s+tier)|\badds?\b.{0,80}\bcards?\b|\bSBT\b.{0,80}(?:unlock|reward|mechanic)|(?:新增|增加|推出).{0,80}(?:卡池|卡牌|SBT|價格帶|价格带)|(?:卡池|SBT).{0,80}(?:新增|解鎖|解锁|機制|机制)/i.test(text)) return "content_update";
  if (/\bcoming\b|\bsoon\b|\bpreview\b|\breveal(?:ed|ing)?\b|即將|即将|預告|预告/i.test(text)) return "announcement";
  return cardType === "product_progress" ? "milestone" : "context";
}

function hasCompleteProductProgressEvidence(card: FeedCard): boolean {
  const evidence = card.product_progress_evidence;
  return Boolean(
    String(evidence?.product_or_capability ?? "").trim()
    && String(evidence?.state_change ?? "").trim()
    && String(evidence?.user_or_platform_impact ?? "").trim()
    && String(evidence?.source_evidence ?? "").trim(),
  );
}

function isMilestone(card: FeedCard, kind: ProductUpdateKind, definition: ProductEntityDefinition): boolean {
  if (!sourceText(card)) return false;
  if (kind === "context") return false;
  const cardType = String(card.card_type ?? "").toLowerCase();
  const plan = String(card.plan_status ?? "").toLowerCase();
  if (definition.mode === "candidate" && !["upcoming", "in_progress", "completed"].includes(plan)) return false;
  if (cardType !== "product_progress") {
    if (kind === "partner_added") return definition.id === "renaiss-index";
    if (kind === "partnership") return ["in_progress", "completed"].includes(plan);
    return VERIFIED_STATE_CHANGE_KINDS.has(kind);
  }
  if (hasCompleteProductProgressEvidence(card)) return true;
  return ["sold_out", "maintenance", "policy_change", "proposal", "implementation", "adoption", "launch", "restock"].includes(kind);
}

function definitionScore(definition: ProductEntityDefinition, account: string): number {
  return definition.priority + (definition.ownerAccounts.includes(account) ? 200 : 0);
}

function statusFor(definition: ProductEntityDefinition, event?: ProductTimelineEvent): ProductStatus {
  if (!event) return definition.mode === "candidate" ? "candidate" : definition.mode === "experimental" ? "prototype" : "candidate";
  const plan = String(event.card.plan_status ?? "").toLowerCase();
  if (event.kind === "sold_out") return "sold_out";
  if (event.kind === "maintenance") return "maintenance";
  if (event.kind === "adoption") return "adopted";
  if (event.kind === "implementation") return "live";
  if (event.kind === "proposal") return "proposed";
  if (event.kind === "announcement") return "upcoming";
  if (event.kind === "prototype") return "prototype";
  if (event.kind === "partnership") return "expanding";
  if (event.kind === "partner_added") return "expanding";
  if (event.kind === "restock") return "restocked";
  if (event.kind === "claim_open") return plan === "completed" ? "completed" : "claim_open";
  if (event.kind === "launch") return "live";
  if (["content_update", "policy_change", "milestone"].includes(event.kind)) return "updated";
  return "live";
}

function dedupeTimeline(events: ProductTimelineEvent[]): ProductTimelineEvent[] {
  const sorted = [...events].sort((left, right) => dateValue(right.card) - dateValue(left.card));
  const seen = new Set<string>();
  return sorted.filter((event) => {
    const evidenceId = String(event.card.id || event.card.url || event.card.title || event.date);
    const key = ONE_TIME_KINDS.has(event.kind) ? event.kind : `${event.kind}:${evidenceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildProductPortfolio(cards: FeedCard[]): ProductPortfolio {
  const buckets = new Map<string, { definition: ProductEntityDefinition; standalone: FeedCard[]; timeline: ProductTimelineEvent[] }>();
  const relatedUpdates: ProductRelatedUpdate[] = [];
  const unassignedUpdates: FeedCard[] = [];
  const unmappedUpdates: ProductTimelineEvent[] = [];
  PRODUCT_ENTITIES.forEach((definition) => buckets.set(definition.id, { definition, standalone: [], timeline: [] }));

  cards.forEach((card) => {
    if (String(card.source_role ?? "").toLowerCase() !== "official") return;
    const account = normalizedAccount(card);
    const text = sourceText(card);
    const productIds = new Set((card.product_ids ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
    const matches = PRODUCT_ENTITIES.filter((definition) => productIds.has(definition.id));
    if (!matches.length) {
      if (text && String(card.card_type ?? "").toLowerCase() === "product_progress" && hasCompleteProductProgressEvidence(card)) {
        const kind = updateKind(card, `${text} ${String(card.title ?? "")}`);
        if (kind !== "context") unmappedUpdates.push({ card, date: cardDate(card), kind, relatedProductIds: [] });
      } else {
        unassignedUpdates.push(card);
      }
      return;
    }
    const primary = [...matches].sort((left, right) => definitionScore(right, account) - definitionScore(left, account))[0];
    const bucket = buckets.get(primary.id);
    if (!bucket) return;
    const eventText = String(card.card_type ?? "").toLowerCase() === "product_progress" ? `${text} ${String(card.title ?? "")}` : text;
    const kind = updateKind(card, eventText);
    const milestone = isMilestone(card, kind, primary);
    relatedUpdates.push({ card, familyId: primary.familyId, isMilestone: milestone, kind, productId: primary.id });
    if (milestone) {
      bucket.timeline.push({ card, date: cardDate(card), kind, relatedProductIds: matches.filter((definition) => definition.id !== primary.id).map((definition) => definition.id) });
    } else {
      bucket.standalone.push(card);
    }
  });

  const products = [...buckets.values()].map(({ definition, standalone, timeline }) => {
    const dedupedTimeline = dedupeTimeline(timeline);
    const isIndexPartnerNetwork = definition.id === "renaiss-index"
      && dedupedTimeline.length > 0
      && dedupedTimeline.every((event) => event.kind === "partnership" || event.kind === "partner_added");
    const sortedStandalone = [...standalone].sort((left, right) => dateValue(right) - dateValue(left));
    const latest = dedupedTimeline[0];
    const latestCard = latest?.card ?? sortedStandalone[0];
    const evidenceCard = dedupedTimeline.map((event) => event.card).find((card) => evidenceImage(card))
      ?? sortedStandalone.find((card) => evidenceImage(card));
    return {
      evidenceCard,
      evidenceImage: evidenceImage(evidenceCard),
      id: definition.id,
      familyId: definition.familyId,
      name: definition.name,
      nameKey: isIndexPartnerNetwork ? "product.entity.indexPartnerNetwork" : undefined,
      icon: definition.icon,
      mode: definition.mode ?? "core",
      ownerAccounts: definition.ownerAccounts,
      status: statusFor(definition, latest),
      lastVerifiedAt: String(latestCard?.published_at || latestCard?.timeline_date || ""),
      summary: String(latestCard?.summary || latestCard?.glance || ""),
      summaryKey: isIndexPartnerNetwork ? "product.summary.indexPartnerNetwork" : undefined,
      timeline: dedupedTimeline,
      standaloneCards: sortedStandalone,
    } satisfies ProductSnapshot;
  }).filter((product) => product.timeline.length || product.standaloneCards.length);

  const families = FAMILY_ORDER.map((familyId) => {
    const familyProducts = products.filter((product) => product.familyId === familyId).sort((left, right) => {
      const leftDate = new Date(left.lastVerifiedAt || 0).valueOf() || 0;
      const rightDate = new Date(right.lastVerifiedAt || 0).valueOf() || 0;
      return rightDate - leftDate;
    });
    return {
      id: familyId,
      icon: FAMILY_ICONS[familyId],
      products: familyProducts,
      updateCount: familyProducts.reduce((count, product) => count + product.timeline.length, 0),
      standaloneCount: familyProducts.reduce((count, product) => count + product.standaloneCards.length, 0),
    } satisfies ProductFamilySnapshot;
  }).filter((family) => family.products.length);

  const sortedUnmappedUpdates = [...unmappedUpdates].sort((left, right) => dateValue(right.card) - dateValue(left.card));
  const sortedRelatedUpdates = [...relatedUpdates].sort((left, right) => dateValue(right.card) - dateValue(left.card));
  const sortedUnassignedUpdates = [...unassignedUpdates].sort((left, right) => dateValue(right) - dateValue(left));
  const sourceBuckets = new Map<string, { ownedFamilyIds: Set<ProductFamilyId>; ownedProductIds: Set<string>; updateCount: number }>();
  const sourceBucket = (account: string) => {
    const existing = sourceBuckets.get(account);
    if (existing) return existing;
    const created = { ownedFamilyIds: new Set<ProductFamilyId>(), ownedProductIds: new Set<string>(), updateCount: 0 };
    sourceBuckets.set(account, created);
    return created;
  };
  const addSourceUpdate = (account: string) => {
    if (!account) return;
    sourceBucket(account).updateCount += 1;
  };
  families.forEach((family) => family.products.forEach((product) => {
    product.ownerAccounts.forEach((account) => {
      const bucket = sourceBucket(account);
      bucket.ownedFamilyIds.add(product.familyId);
      bucket.ownedProductIds.add(product.id);
    });
  }));
  const ownersByProductId = new Map(PRODUCT_ENTITIES.map((definition) => [definition.id, definition.ownerAccounts]));
  sortedRelatedUpdates.forEach((update) => {
    ownersByProductId.get(update.productId)?.forEach(addSourceUpdate);
  });
  sortedUnmappedUpdates.forEach((event) => addSourceUpdate(normalizedAccount(event.card)));
  sortedUnassignedUpdates.forEach((card) => addSourceUpdate(normalizedAccount(card)));
  const sources = [...sourceBuckets.entries()].map(([account, bucket]) => ({
    account,
    ownedFamilyIds: FAMILY_ORDER.filter((familyId) => bucket.ownedFamilyIds.has(familyId)),
    ownedProductIds: [...bucket.ownedProductIds],
    updateCount: bucket.updateCount,
  } satisfies ProductSourceSnapshot));
  return {
    families,
    productCount: families.reduce((count, family) => count + family.products.length, 0),
    relatedUpdates: sortedRelatedUpdates,
    updateCount: families.reduce((count, family) => count + family.updateCount + family.standaloneCount, 0) + sortedUnmappedUpdates.length,
    standaloneCount: families.reduce((count, family) => count + family.standaloneCount, 0),
    sources,
    unassignedUpdates: sortedUnassignedUpdates,
    unmappedUpdates: sortedUnmappedUpdates,
  };
}
