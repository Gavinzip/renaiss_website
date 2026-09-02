import type { FeedCard } from "@/types";

export type ProductFamilyId = "fair" | "gacha" | "packs" | "sbt" | "index" | "tech" | "store" | "platform" | "vinci";
export type ProductMode = "core" | "experimental" | "candidate";
export type ProductStatus = "candidate" | "proposed" | "upcoming" | "live" | "updated" | "maintenance" | "adopted" | "sold_out" | "claim_open" | "completed" | "prototype" | "expanding" | "restocked";
export type ProductUpdateKind = "proposal" | "implementation" | "adoption" | "launch" | "content_update" | "maintenance" | "restock" | "sold_out" | "claim_open" | "policy_change" | "partnership" | "prototype" | "announcement" | "milestone" | "context";

export interface ProductTimelineEvent {
  card: FeedCard;
  date: string;
  kind: ProductUpdateKind;
  relatedProductIds: string[];
}

export interface ProductSnapshot {
  familyId: ProductFamilyId;
  icon: string;
  id: string;
  lastVerifiedAt: string;
  mode: ProductMode;
  name: string;
  relatedCards: FeedCard[];
  status: ProductStatus;
  summary: string;
  timeline: ProductTimelineEvent[];
}

export interface ProductFamilySnapshot {
  icon: string;
  id: ProductFamilyId;
  products: ProductSnapshot[];
  relatedCount: number;
  updateCount: number;
}

export interface ProductPortfolio {
  families: ProductFamilySnapshot[];
  productCount: number;
  relatedCount: number;
  unmappedUpdates: ProductTimelineEvent[];
  updateCount: number;
}

interface ProductEntityDefinition {
  familyId: ProductFamilyId;
  icon: string;
  id: string;
  match: (context: MatchContext) => boolean;
  mode?: ProductMode;
  name: string;
  primaryAccounts?: string[];
  priority: number;
}

interface MatchContext {
  account: string;
  text: string;
}

const FAMILY_ORDER: ProductFamilyId[] = ["fair", "gacha", "packs", "sbt", "index", "tech", "store", "platform", "vinci"];
const FAMILY_ICONS: Record<ProductFamilyId, string> = {
  fair: "badge-check",
  gacha: "blocks",
  packs: "package-open",
  sbt: "award",
  index: "chart-no-axes-combined",
  tech: "flask-conical",
  store: "shopping-bag",
  platform: "sliders-horizontal",
  vinci: "sparkles",
};

const includes = (context: MatchContext, pattern: RegExp) => pattern.test(context.text);

const PRODUCT_ENTITIES: ProductEntityDefinition[] = [
  { id: "proof-of-fair", familyId: "fair", name: "RIP: Proof of Fair", icon: "shield-check", priority: 140, match: (context) => includes(context, /\bproof\s+of\s+fair\b|\brenaiss\s+fair\b|\bRIP\b/i) },
  { id: "pandora-248", familyId: "gacha", name: "PANDORA 248", icon: "circle-dollar-sign", priority: 130, match: (context) => includes(context, /\bpandora\s*248\b|潘朵拉\s*248/i) },
  { id: "pandora-88", familyId: "gacha", name: "PANDORA 88", icon: "circle-dollar-sign", priority: 130, match: (context) => includes(context, /\bpandora\s*88\b|潘朵拉\s*88/i) },
  { id: "pandora-48", familyId: "gacha", name: "PANDORA 48", icon: "circle-dollar-sign", priority: 130, match: (context) => includes(context, /\bpandora\s*48\b|潘朵拉\s*48/i) },
  { id: "pandora-28", familyId: "gacha", name: "PANDORA 28", icon: "circle-dollar-sign", priority: 130, match: (context) => includes(context, /\bpandora\s*28\b|潘朵拉\s*28/i) },
  { id: "eden-gacha", familyId: "gacha", name: "EDEN Gacha", icon: "gem", priority: 130, match: (context) => includes(context, /\beden\b.{0,40}\bgacha\b|\bgacha\b.{0,40}\beden\b/i) },
  { id: "infinite-gacha", familyId: "gacha", name: "Infinite Gacha", icon: "infinity", priority: 40, match: (context) => includes(context, /\binfinite\s+(?:vrf\s+)?gacha\b|\bgacha\s+machines?\b|扭蛋機|轉蛋機|转蛋机/i) },
  { id: "niu-lai-pack", familyId: "packs", name: "NIU LAI Pack", icon: "beef", priority: 130, match: (context) => includes(context, /\bniu\s+lai\s+pack\b|牛來包|牛来包/i) },
  { id: "genesis-pack", familyId: "packs", name: "Genesis Pack", icon: "package-open", priority: 130, match: (context) => includes(context, /\bgenesis\s+pack\b/i) },
  { id: "surge-pack", familyId: "packs", name: "Surge Pack", icon: "package-open", priority: 130, match: (context) => includes(context, /\bsurge\s+pack\b/i) },
  { id: "inferno-pack", familyId: "packs", name: "Inferno Pack", icon: "package-open", priority: 130, match: (context) => includes(context, /\binferno\s+pack\b/i) },
  { id: "tempest-pack", familyId: "packs", name: "Tempest Pack", icon: "package-open", priority: 130, match: (context) => includes(context, /\btempest\s+pack\b/i) },
  { id: "omega-pack", familyId: "packs", name: "Omega Pack", icon: "package-open", priority: 130, match: (context) => includes(context, /\bomega\s+pack\b/i) },
  { id: "flagship-sbt", familyId: "sbt", name: "FLAGSHIP Supporter SBT", icon: "award", priority: 120, match: (context) => includes(context, /\bflagship\b.{0,80}\bSBT\b|\bSBT\b.{0,80}\bflagship\b/i) },
  { id: "emerald-trinity-sbt", familyId: "sbt", name: "Emerald & Trinity SBT", icon: "award", priority: 120, match: (context) => includes(context, /\b(?:emerald|trinity)\b.{0,100}\bSBT\b/i) },
  { id: "referral-rewards", familyId: "sbt", name: "Referral Rewards", icon: "gift", priority: 120, match: (context) => includes(context, /\breferral\s+rewards?\b|200\s*%\s*(?:referral|推薦|推荐)/i) },
  { id: "renaiss-index", familyId: "index", name: "Renaiss Index", icon: "chart-no-axes-combined", priority: 80, primaryAccounts: ["renaiss_index"], match: (context) => context.account === "renaiss_index" || includes(context, /\brenaiss\s+index\b/i) },
  { id: "renaiss-air", familyId: "tech", name: "Renaiss AIR", icon: "wind", priority: 140, mode: "experimental", match: (context) => includes(context, /\brenaiss\s+air\b/i) },
  { id: "collector-assistant", familyId: "tech", name: "Collector Assistant", icon: "bot", priority: 140, mode: "experimental", match: (context) => includes(context, /\bcollector\s+assistant\b/i) },
  { id: "card-platform-analysis", familyId: "tech", name: "Card Platform Analysis", icon: "scan-search", priority: 140, mode: "experimental", match: (context) => includes(context, /\bcard\s+platform\s+analysis\b/i) },
  { id: "store-redemption", familyId: "store", name: "Store SBT Redemption", icon: "shopping-bag", priority: 120, match: (context) => includes(context, /(?:t-?shirt|bracelet|merch|store|shop).{0,120}(?:SBT|redeem)|(?:SBT|redeem).{0,120}(?:t-?shirt|bracelet|merch|store|shop)/i) },
  { id: "collectibles-binder", familyId: "platform", name: "Collectibles Binder", icon: "book-image", priority: 130, match: (context) => includes(context, /\bcollectibles?\s+binder\b/i) },
  { id: "card-handling-fees", familyId: "platform", name: "Card Handling Fees", icon: "receipt-text", priority: 120, match: (context) => includes(context, /\bcard\s+handling\s+fees?\b|卡牌手續費|卡牌手续费/i) },
  { id: "social-hall", familyId: "vinci", name: "Vinci World Social Hall", icon: "door-open", priority: 110, mode: "candidate", primaryAccounts: ["vinciwld"], match: (context) => includes(context, /\bsocial\s+hall\b/i) },
];

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

function updateKind(card: FeedCard, text: string): ProductUpdateKind {
  const cardType = String(card.card_type ?? "").toLowerCase();
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
  if (/\bpartner(?:ship|ed|ing)?\b|\bteamed\s+up\b|\bbuilt\s+with\b|\bintegrat(?:e|ed|ion)\b|合作(?:夥伴|伙伴|建構|建立)?/i.test(text)) return "partnership";
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
    if (kind === "partnership") return ["in_progress", "completed"].includes(plan);
    return VERIFIED_STATE_CHANGE_KINDS.has(kind);
  }
  if (hasCompleteProductProgressEvidence(card)) return true;
  return ["sold_out", "maintenance", "policy_change", "proposal", "implementation", "adoption", "launch", "restock"].includes(kind);
}

function definitionScore(definition: ProductEntityDefinition, account: string): number {
  return definition.priority + (definition.primaryAccounts?.includes(account) ? 200 : 0);
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
  const buckets = new Map<string, { definition: ProductEntityDefinition; related: FeedCard[]; timeline: ProductTimelineEvent[] }>();
  const unmappedUpdates: ProductTimelineEvent[] = [];
  PRODUCT_ENTITIES.forEach((definition) => buckets.set(definition.id, { definition, related: [], timeline: [] }));

  cards.forEach((card) => {
    if (String(card.source_role ?? "").toLowerCase() !== "official") return;
    const account = normalizedAccount(card);
    const text = sourceText(card);
    const context = { account, text };
    const matches = PRODUCT_ENTITIES.filter((definition) => definition.match(context));
    if (!matches.length) {
      if (text && String(card.card_type ?? "").toLowerCase() === "product_progress" && hasCompleteProductProgressEvidence(card)) {
        const kind = updateKind(card, `${text} ${String(card.title ?? "")}`);
        if (kind !== "context") unmappedUpdates.push({ card, date: cardDate(card), kind, relatedProductIds: [] });
      }
      return;
    }
    const primary = [...matches].sort((left, right) => definitionScore(right, account) - definitionScore(left, account))[0];
    const bucket = buckets.get(primary.id);
    if (!bucket) return;
    const eventText = String(card.card_type ?? "").toLowerCase() === "product_progress" ? `${text} ${String(card.title ?? "")}` : text;
    const kind = updateKind(card, eventText);
    if (isMilestone(card, kind, primary)) {
      bucket.timeline.push({ card, date: cardDate(card), kind, relatedProductIds: matches.filter((definition) => definition.id !== primary.id).map((definition) => definition.id) });
    } else {
      bucket.related.push(card);
    }
  });

  const products = [...buckets.values()].map(({ definition, related, timeline }) => {
    const dedupedTimeline = dedupeTimeline(timeline);
    const sortedRelated = [...related].sort((left, right) => dateValue(right) - dateValue(left));
    const latest = dedupedTimeline[0];
    const latestCard = latest?.card ?? sortedRelated[0];
    return {
      id: definition.id,
      familyId: definition.familyId,
      name: definition.name,
      icon: definition.icon,
      mode: definition.mode ?? "core",
      status: statusFor(definition, latest),
      lastVerifiedAt: String(latestCard?.published_at || latestCard?.timeline_date || ""),
      summary: String(latestCard?.summary || latestCard?.glance || ""),
      timeline: dedupedTimeline,
      relatedCards: sortedRelated,
    } satisfies ProductSnapshot;
  }).filter((product) => product.timeline.length || product.relatedCards.length);

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
      relatedCount: familyProducts.reduce((count, product) => count + product.relatedCards.length, 0),
    } satisfies ProductFamilySnapshot;
  }).filter((family) => family.products.length);

  const sortedUnmappedUpdates = [...unmappedUpdates].sort((left, right) => dateValue(right.card) - dateValue(left.card));
  return {
    families,
    productCount: families.reduce((count, family) => count + family.products.length, 0),
    updateCount: families.reduce((count, family) => count + family.updateCount, 0) + sortedUnmappedUpdates.length,
    relatedCount: families.reduce((count, family) => count + family.relatedCount, 0),
    unmappedUpdates: sortedUnmappedUpdates,
  };
}
