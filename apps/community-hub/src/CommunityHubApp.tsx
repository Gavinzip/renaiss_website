import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { intelApiUrl } from "@/lib/api";
import { text } from "@/lib/copy";
import { normalizeCards, translationCoverage, translationPending } from "@/lib/feed";
import { useHubRoute } from "@/lib/routes";
import type { FeedResponse, HubView, IntelFeed, Language, PackLeaderboard, PackLeaderboardResponse } from "@/types";
import { CommunityView, EventsView, FutureView, MediaView, OfficialView } from "@/views/FeedViews";
import { OverviewView } from "@/views/OverviewView";
import { KnowledgeView, RecordsView } from "@/views/SecondaryViews";
import { ArticleView, GuideView, SbtView } from "@/views/SbtGuideViews";
import { ProfileView } from "@/views/profile/ProfileView";

const LANGUAGE_STORAGE_KEY = "intel_ui_lang";

function normalizeLanguage(value: string | null | undefined): Language {
  const raw = String(value ?? "").trim();
  if (raw === "zh-Hant" || raw === "zh-Hans" || raw === "en" || raw === "ko") return raw;
  if (/^zh(-|_)?cn|zh-hans/i.test(raw)) return "zh-Hans";
  if (/^ko/i.test(raw)) return "ko";
  if (/^en/i.test(raw)) return "en";
  return "zh-Hant";
}

function initialLanguage(): Language {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || document.documentElement.lang || navigator.language);
  } catch {
    return normalizeLanguage(document.documentElement.lang || navigator.language);
  }
}

export function CommunityHubApp() {
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [feed, setFeed] = useState<IntelFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [translationRetries, setTranslationRetries] = useState(0);
  const [leaderboard, setLeaderboard] = useState<PackLeaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const { route, navigate } = useHubRoute();
  const cards = useMemo(() => normalizeCards(feed, lang), [feed, lang]);
  const hasPendingTranslation = translationPending(feed, lang);

  const refresh = useCallback(() => {
    setTranslationRetries(0);
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.classList.add("community-hub-ui-ready");
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); } catch { /* Storage can be unavailable in a private browser context. */ }
    return () => document.documentElement.classList.remove("community-hub-ui-ready");
  }, [lang]);

  useEffect(() => {
    const title = route.view === "article" ? "Article" : text(lang, `nav.${route.view}`);
    document.title = `Renaiss Community Hub | ${title}`;
  }, [lang, route.view]);

  useEffect(() => {
    if (route.view === "profile") {
      setLoading(false);
      setSourceError("");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    let mounted = true;
    setLoading(true);
    setSourceError("");
    void fetch(intelApiUrl(`/api/intel/feed?lang=${encodeURIComponent(lang)}`), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as FeedResponse;
        if (!response.ok || !payload.ok || !payload.feed || !Array.isArray(payload.feed.cards)) throw new Error(payload.error || `HTTP ${response.status}`);
        if (mounted) setFeed(payload.feed);
      })
      .catch((error: unknown) => {
        if (!mounted || (error instanceof DOMException && error.name === "AbortError")) return;
        setFeed(null);
        setSourceError(error instanceof Error ? error.message : "request_failed");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [lang, refreshKey, route.view]);

  useEffect(() => {
    if (route.view !== "records") return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let mounted = true;
    setLeaderboardLoading(true);
    setLeaderboardError("");
    void fetch(intelApiUrl("/api/open-monitor/leaderboard?season=all"), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as PackLeaderboardResponse;
        if (!response.ok || !payload.ok || !payload.leaderboard || !Array.isArray(payload.leaderboard.entries)) throw new Error(payload.error || `HTTP ${response.status}`);
        if (mounted) setLeaderboard(payload.leaderboard);
      })
      .catch((error: unknown) => {
        if (!mounted || (error instanceof DOMException && error.name === "AbortError")) return;
        setLeaderboard(null);
        setLeaderboardError(error instanceof Error ? error.message : "request_failed");
      })
      .finally(() => {
        if (mounted) setLeaderboardLoading(false);
      });
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [route.view, refreshKey]);

  useEffect(() => {
    if (!hasPendingTranslation || translationRetries >= 10) return;
    const timer = window.setTimeout(() => {
      setTranslationRetries((value) => value + 1);
      setRefreshKey((value) => value + 1);
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [hasPendingTranslation, translationRetries]);

  const go = useCallback((view: Exclude<HubView, "article">) => {
    navigate({ view, article: "", guide: view === "guide" ? route.guide : "overview" });
  }, [navigate, route.guide]);

  const openGuide = useCallback((topic: string) => navigate({ view: "guide", guide: topic, article: "" }), [navigate]);
  const openArticle = useCallback((article: string) => navigate({ view: "article", article }), [navigate]);
  const sourceState = sourceError ? "error" : feed ? "live" : "idle";
  const status = route.view === "profile" ? "" : loading ? text(lang, "status.loading") : sourceError ? `${text(lang, "status.error")} · ${sourceError}` : feed ? `${text(lang, "status.live")} · ${cards.length} ${text(lang, "status.cards")}${hasPendingTranslation ? ` · ${text(lang, "status.translating")}${translationCoverage(feed) ? ` ${translationCoverage(feed)}` : ""}` : ""}` : "";

  let view = null;
  const shared = { cards, lang, loading, onOpenArticle: openArticle, onRefresh: refresh, translationPending: hasPendingTranslation };
  if (route.view === "official") view = <OfficialView {...shared} />;
  else if (route.view === "feed") view = <CommunityView {...shared} />;
  else if (route.view === "events") view = <EventsView {...shared} />;
  else if (route.view === "future") view = <FutureView {...shared} />;
  else if (route.view === "sbt") view = <SbtView cards={cards} lang={lang} onOpenArticle={openArticle} />;
  else if (route.view === "profile") view = <ProfileView lang={lang} />;
  else if (route.view === "guide") view = <GuideView lang={lang} topicId={route.guide} onTopicChange={openGuide} />;
  else if (route.view === "article") view = <ArticleView articleUrl={route.article} cards={cards} lang={lang} onBack={() => go("sbt")} />;
  else if (route.view === "records") view = <RecordsView cards={cards} lang={lang} onOpenArticle={openArticle} leaderboard={leaderboard} leaderboardLoading={leaderboardLoading} leaderboardError={leaderboardError} onRefreshLeaderboard={refresh} />;
  else if (route.view === "media") view = <MediaView {...shared} />;
  else if (route.view === "knowledge") view = <KnowledgeView lang={lang} onGuide={() => openGuide("overview")} />;
  else view = <OverviewView cards={cards} lang={lang} onNavigate={go} />;

  return <AppShell lang={lang} loading={loading} onLanguageChange={setLang} onNavigate={go} sourceState={sourceState} status={status} view={route.view}>{view}</AppShell>;
}
