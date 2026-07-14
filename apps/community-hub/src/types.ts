export const LANGUAGES = ["zh-Hant", "zh-Hans", "en", "ko"] as const;

export type Language = (typeof LANGUAGES)[number];
export type HubView = "overview" | "feed" | "events" | "sbt" | "guide" | "article" | "records" | "media" | "knowledge";
export type EventStatus = "active" | "upcoming" | "past" | "reference";

export interface FeedCard {
  account?: string;
  bullets?: string[];
  card_type?: string;
  cover_image?: string;
  dedupe_status?: string;
  event_wall?: boolean;
  glance?: string;
  published_at?: string;
  raw_text?: string;
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

export interface IntelFeed {
  cards?: FeedCard[];
  community_metrics?: {
    accounts?: Record<string, CommunityMetric>;
    score_basis?: string[];
    updated_at?: string;
    window_days?: number;
  };
  generated_at?: string;
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
  intro?: string;
  introTitle?: string;
  items?: Array<[string, string]>;
  primer?: Array<[string, string]>;
  text?: string;
  title?: string;
  type?: "intro" | "steps" | "imageText" | "cards" | "sbtChecklist" | "ratings";
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
  tools?: Array<{ authors?: string[]; link?: string; linkLabel?: string | LocalizedText; name?: LocalizedText }>;
}

declare global {
  interface Window {
    BEGINNER_GUIDE_STATIC?: LegacyBeginnerData;
    RENAISS_SBT_CATALOG?: readonly LegacySbtRow[];
    RENAISS_SBT_ICON_BASE?: string;
  }
}
