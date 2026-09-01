export const LANGUAGES = ["zh-Hant", "zh-Hans", "en", "ko"] as const;

export type Language = (typeof LANGUAGES)[number];
export type HubView = "overview" | "official" | "feed" | "events" | "future" | "sbt" | "profile" | "guide" | "article" | "records" | "media" | "knowledge" | "manage";
export type EventStatus = "active" | "upcoming" | "past" | "reference";
export type PlanStatus = "upcoming" | "in_progress" | "completed" | "cancelled" | "not_plan" | "needs_review";

export interface FeedCard {
  account?: string;
  ai_status?: string;
  bullets?: string[];
  card_type?: string;
  classified_by?: string;
  cover_image?: string;
  dedupe_status?: string;
  detail_lines?: string[];
  detail_summary?: string;
  event_facts?: {
    audience?: string;
    location?: string;
    participation?: string;
    reward?: string;
    schedule?: string;
  };
  event_region?: "tw" | "kr" | "my" | "vn" | "th" | "global" | "multi_region" | "unknown" | string;
  event_region_reason?: string;
  event_region_model?: string;
  event_region_version?: string;
  event_wall?: boolean;
  editorial_revision?: number;
  editorial_updated_at?: string;
  editorial_updated_by?: string;
  glance?: string;
  id?: string;
  manual_bottom?: boolean;
  manual_pick?: boolean;
  manual_pin?: boolean;
  published_at?: string;
  plan_ai_model?: string;
  plan_ai_version?: string;
  plan_status?: PlanStatus;
  plan_status_checked_at?: string;
  plan_status_reason?: string;
  product_progress_group_key?: string;
  raw_text?: string;
  review_status?: string;
  semantic_text?: string;
  sbt_acquisition?: string;
  sbt_name?: string;
  sbt_names?: string[];
  summary?: string;
  tags?: string[];
  timeline_date?: string;
  timeline_end_date?: string;
  title?: string;
  topic_labels?: string[];
  url?: string;
  _i18n_status?: { status?: string };
}

export interface CommunityMetric {
  account?: string;
  likes?: number;
  posts?: number;
  replies?: number;
  score?: number;
}

export interface OfficialOverview {
  bullets?: string[];
  summary?: string;
  title?: string;
}

export interface IntelFeed {
  account_projects?: Record<string, string>;
  cards?: FeedCard[];
  community_metrics?: {
    accounts?: Record<string, CommunityMetric>;
    score_basis?: string[];
    updated_at?: string;
    window_days?: number;
  };
  generated_at?: string;
  official_overview?: OfficialOverview;
  _i18n?: {
    coverage?: number;
    fallback?: number;
    mode?: string;
    pending?: number;
  };
}

export interface FeedResponse {
  ok?: boolean;
  error?: string;
  feed?: IntelFeed;
}

export interface PackLeaderboardEntry {
  rank?: number;
  user_address?: string;
  pull_count?: number;
  delta?: number | null;
  delta_at?: number | null;
  by_pack?: Record<string, number>;
  merged_from?: string[];
}

export interface PackLeaderboard {
  entries?: PackLeaderboardEntry[];
  start_ts?: number | null;
  end_ts?: number | null;
  total_pulls?: number;
  unique_users?: number;
  snapshot_taken_at?: number | null;
  packs?: string[];
}

export interface PackLeaderboardResponse {
  ok?: boolean;
  error?: string;
  season?: string;
  source?: { name?: string; url?: string };
  leaderboard?: PackLeaderboard;
}

export interface LegacySbtRow {
  badge?: string;
  difficulty?: number;
  icons?: string[];
  name?: string;
  requirement?: string;
  status?: string;
}

export type LocalizedText = Partial<Record<Language, string>>;

export interface GuideSection {
  bullets?: string[];
  image?: number;
  imageUrl?: string;
  intro?: string;
  introTitle?: string;
  items?: Array<[string, string]>;
  layout?: "image-left" | "image-right" | "image-top";
  primer?: Array<[string, string]>;
  text?: string;
  title?: string;
  topic?: string;
  type?: "intro" | "steps" | "imageText" | "cards" | "sbtChecklist" | "ratings";
}

export interface GuideTopic {
  anchor?: string;
  icon?: string;
  id: string;
  subtitle?: string;
  title?: string;
}

export interface LegacySbtItem {
  badge?: string | LocalizedText;
  difficulty?: number;
  icons?: string[];
  key?: string;
  name?: string | LocalizedText;
  requirement?: string | LocalizedText;
  status?: string;
}

export interface LegacyGuideData {
  eyebrow?: string;
  sections?: GuideSection[];
  stats?: Array<[string, string]>;
  subtitle?: string;
  title?: string;
}

export interface LegacyBeginnerData {
  commandShowcase?: { images?: Array<{ caption?: LocalizedText; src?: string }> };
  commands?: Array<{ command?: string; desc?: LocalizedText; icon?: string; meta?: LocalizedText; name?: LocalizedText }>;
  faq?: Partial<Record<Language, Array<[string, string]>>>;
  guides?: Partial<Record<Language, LegacyGuideData>>;
  images?: string[];
  labels?: Partial<Record<Language, Record<string, string>>>;
  menuLabels?: Partial<Record<Language, { groups?: Array<[string, string, string[], string?]>; label?: string; overview?: string; title?: string }>>;
  sbtItems?: LegacySbtItem[];
  sbtRequirements?: Partial<Record<Language, Record<string, string>>>;
  topics?: Partial<Record<Language, GuideTopic[]>>;
  toolNames?: Partial<Record<Language, Record<string, string>>>;
  tools?: Array<{ authors?: string[]; link?: string; linkLabel?: string | LocalizedText; name?: LocalizedText }>;
}

export interface BeginnerWikiMeta {
  auto_translate?: boolean;
  cache_seconds?: number;
  content_hash?: string;
  provider?: string;
  revision?: number;
  slug?: string;
  source?: string;
  studio_url?: string;
  translation_modes?: string[];
  updated_at?: string;
  updated_by?: string;
}

export interface BeginnerWikiDocument {
  data: LegacyBeginnerData;
  exists: boolean;
  meta: BeginnerWikiMeta;
}

declare global {
  interface Window {
    BEGINNER_GUIDE_STATIC?: LegacyBeginnerData;
    RENAISS_SBT_CATALOG?: readonly LegacySbtRow[];
    RENAISS_SBT_ICON_BASE?: string;
  }
}
