import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, ViewHeader } from "@/components/AppShell";
import { AdminToolsProvider } from "@/components/admin/AdminToolsContext";
import { EMPTY_AUTH_STATE, logout, readAuthState, renaissLoginUrl, type HubAuthState } from "@/lib/auth";
import { intelApiUrl } from "@/lib/api";
import { text } from "@/lib/copy";
import { normalizeCards, translationCoverage, translationPending } from "@/lib/feed";
import { FeedRequestError, readIntelFeed } from "@/lib/feedRequest";
import { JsonRequestError } from "@/lib/jsonRequest";
import { useHubRoute } from "@/lib/routes";
import { readBeginnerWiki } from "@/lib/wiki";
import { readAdminFeed } from "@/lib/admin";
import type { BeginnerWikiDocument, HubView, IntelFeed, Language, PackLeaderboard, PackLeaderboardResponse } from "@/types";
import { CommunityView, EventsView, MediaView, OfficialView } from "@/views/FeedViews";
import { OverviewView } from "@/views/OverviewView";
import { KnowledgeView, RecordsView } from "@/views/SecondaryViews";
import { ArticleView, GuideView, SbtView } from "@/views/SbtGuideViews";
import { ProfileView } from "@/views/profile/ProfileView";

const AdminView = lazy(() => import("@/views/admin/AdminView").then((module) => ({ default: module.AdminView })));
const ProductProgressView = lazy(() => import("@/views/ProductProgressView").then((module) => ({ default: module.ProductProgressView })));

const LANGUAGE_STORAGE_KEY = "intel_ui_lang";
type PreviewEnvironment = "production" | "local" | "";

function initialPreviewEnvironment(): PreviewEnvironment {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) ? "production" : "";
}

function normalizeLanguage(value: string | null | undefined): Language {
  const raw = String(value ?? "").trim();
  if (raw === "zh-Hant" || raw === "zh-Hans" || raw === "en" || raw === "ko") return raw;
  if (/^zh(-|_)?cn|zh-hans/i.test(raw)) return "zh-Hans";
  if (/^ko/i.test(raw)) return "ko";
  if (/^en/i.test(raw)) return "en";
  return "zh-Hant";
}

function initialLanguage(): Language {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested) return normalizeLanguage(requested);
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || document.documentElement.lang || navigator.language);
  } catch {
    return normalizeLanguage(document.documentElement.lang || navigator.language);
  }
}

export function CommunityHubApp() {
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [previewEnvironment, setPreviewEnvironment] = useState<PreviewEnvironment>(initialPreviewEnvironment);
  const [feed, setFeed] = useState<IntelFeed | null>(null);
  const [adminFeed, setAdminFeed] = useState<IntelFeed | null>(null);
  const [adminFeedError, setAdminFeedError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [translationRetries, setTranslationRetries] = useState(0);
  const [leaderboard, setLeaderboard] = useState<PackLeaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [auth, setAuth] = useState<HubAuthState>(EMPTY_AUTH_STATE);
  const [authLoading, setAuthLoading] = useState(true);
  const [wiki, setWiki] = useState<BeginnerWikiDocument | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiError, setWikiError] = useState("");
  const { route, navigate } = useHubRoute();
  const articleBackView = useRef<Exclude<HubView, "article">>("overview");
  const cards = useMemo(() => normalizeCards(feed, lang), [feed, lang]);
  const hasPendingTranslation = translationPending(feed, lang);
  const needsFeed = route.view !== "profile";

  useEffect(() => {
    if (!previewEnvironment) return;
    let mounted = true;
    void fetch("/api/community-hub/preview-config", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { environment?: string };
        if (!response.ok || !["production", "local"].includes(String(payload.environment || ""))) return;
        if (mounted) setPreviewEnvironment(payload.environment as PreviewEnvironment);
      })
      .catch(() => { /* A Vite preview may not expose the runtime environment endpoint. */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setAuthLoading(true);
    void readAuthState(controller.signal)
      .then((state) => { if (mounted) setAuth(state); })
      .catch(() => { if (mounted) setAuth(EMPTY_AUTH_STATE); })
      .finally(() => { if (mounted) setAuthLoading(false); });
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth")) {
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => { mounted = false; controller.abort(); };
  }, []);

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
    const syncLanguage = () => setLang(initialLanguage());
    window.addEventListener("popstate", syncLanguage);
    return () => window.removeEventListener("popstate", syncLanguage);
  }, []);

  const changeLanguage = useCallback((next: Language) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    const title = route.view === "article" ? "Article" : text(lang, `nav.${route.view}`);
    document.title = `Renaiss Community Hub | ${title}`;
  }, [lang, route.view]);

  useEffect(() => {
    if (!authLoading && route.view === "manage" && !auth.permissions.admin) {
      navigate({ view: "overview", article: "" }, true);
    }
  }, [auth.permissions.admin, authLoading, navigate, route.view]);

  useEffect(() => {
    if (!needsFeed) {
      setLoading(false);
      setSourceError("");
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    setLoading(true);
    setRecovering(false);
    setSourceError("");
    void readIntelFeed(intelApiUrl(`/api/intel/feed?lang=${encodeURIComponent(lang)}`), {
      signal: controller.signal, onRetry: () => { if (mounted) setRecovering(true); },
    })
      .then((nextFeed) => { if (mounted) setFeed(nextFeed); })
      .catch((error: unknown) => {
        if (!mounted || (error instanceof DOMException && error.name === "AbortError")) return;
        setFeed(null);
        setSourceError(error instanceof FeedRequestError || error instanceof JsonRequestError ? text(lang, `status.${error.failure}`) : error instanceof Error ? error.message : text(lang, "status.transfer"));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [lang, needsFeed, refreshKey]);

  useEffect(() => {
    if (!auth.permissions.admin) {
      setAdminFeed(null);
      setAdminFeedError("");
      return;
    }
    const controller = new AbortController();
    setAdminFeedError("");
    void readAdminFeed(controller.signal)
      .then(setAdminFeed)
      .catch((error: unknown) => {
        setAdminFeed(null);
        setAdminFeedError(error instanceof Error ? error.message : "無法讀取管理內容");
      });
    return () => controller.abort();
  }, [auth.permissions.admin, refreshKey]);

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
    if (route.view !== "guide" && route.view !== "sbt") return;
    const controller = new AbortController();
    let mounted = true;
    setWikiLoading(true);
    setWikiError("");
    void readBeginnerWiki(controller.signal)
      .then((document) => { if (mounted) setWiki(document); })
      .catch((error: unknown) => {
        if (!mounted || (error instanceof DOMException && error.name === "AbortError")) return;
        setWiki(null);
        setWikiError(error instanceof JsonRequestError ? text(lang, `status.${error.failure}`) : error instanceof Error ? error.message : "wiki_request_failed");
      })
      .finally(() => { if (mounted) setWikiLoading(false); });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [route.view]);

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
  const openArticle = useCallback((article: string) => {
    if (route.view !== "article") articleBackView.current = route.view;
    navigate({ view: "article", article });
  }, [navigate, route.view]);
  const startLogin = useCallback(() => window.location.assign(renaissLoginUrl()), []);
  const endSession = useCallback(() => {
    setAuthLoading(true);
    void logout()
      .then(setAuth)
      .catch(() => setAuth(EMPTY_AUTH_STATE))
      .finally(() => setAuthLoading(false));
  }, []);
  const sourceState = sourceError ? "error" : feed ? "live" : "idle";
  const status = route.view === "profile" ? "" : loading ? text(lang, recovering ? "status.reconnecting" : "status.loading") : sourceError ? `${text(lang, "status.error")} · ${sourceError}` : feed ? `${text(lang, "status.live")} · ${cards.length} ${text(lang, "status.cards")}${hasPendingTranslation ? ` · ${text(lang, "status.translating")}${translationCoverage(feed) ? ` ${translationCoverage(feed)}` : ""}` : ""}` : "";

  let view = null;
  const shared = { accountProjects: feed?.account_projects ?? {}, cards, communityMetrics: feed?.community_metrics, officialOverview: feed?.official_overview, lang, loading, onOpenArticle: openArticle, onRefresh: refresh, translationPending: hasPendingTranslation };
  if (route.view === "official") view = <OfficialView {...shared} />;
  else if (route.view === "feed") view = <CommunityView {...shared} />;
  else if (route.view === "events") view = <EventsView {...shared} />;
  else if (route.view === "future") view = <Suspense fallback={<div className="community-hub-source-state"><strong>{text(lang, "status.loading")}</strong></div>}><ProductProgressView cards={cards} lang={lang} loading={loading} onOpenArticle={openArticle} onRefresh={refresh} translationPending={hasPendingTranslation} /></Suspense>;
  else if (route.view === "sbt") view = <SbtView accountProjects={shared.accountProjects} cards={cards} lang={lang} onOpenArticle={openArticle} onOpenGuide={() => openGuide("sbt")} wiki={wiki} />;
  else if (route.view === "profile") view = <ProfileView lang={lang} />;
  else if (route.view === "guide") view = <GuideView auth={auth} cards={cards} lang={lang} onOpenArticle={openArticle} onTopicChange={openGuide} onWikiChange={setWiki} sectionId={route.section} topicId={route.guide} wiki={wiki} wikiError={wikiError} wikiLoading={wikiLoading} />;
  else if (route.view === "article") view = <ArticleView articleUrl={route.article} cards={cards} lang={lang} onBack={() => go(articleBackView.current)} />;
  else if (route.view === "records") view = <RecordsView cards={cards} lang={lang} onOpenArticle={openArticle} leaderboard={leaderboard} leaderboardLoading={leaderboardLoading} leaderboardError={leaderboardError} onRefreshLeaderboard={refresh} />;
  else if (route.view === "media") view = <MediaView {...shared} />;
  else if (route.view === "knowledge") view = <KnowledgeView lang={lang} onGuide={openGuide} />;
  else if (route.view === "manage" && auth.permissions.admin) view = <Suspense fallback={<div className="community-hub-source-state"><strong>正在載入管理工具…</strong></div>}><AdminView cards={adminFeed?.cards ?? []} lang={lang} onRefresh={refresh} sourceError={adminFeedError} /></Suspense>;
  else view = <OverviewView accountProjects={feed?.account_projects ?? {}} cards={cards} lang={lang} onNavigate={go} />;

  // A failed or unfinished request is not an empty feed. Independent Wiki and
  // profile screens remain usable while the social feed is unavailable.
  if (!feed && (loading || sourceError) && !["profile", "guide", "knowledge", "manage"].includes(route.view)) {
    view = <section className="community-hub-view is-active">
      <ViewHeader eyebrow={route.view.toUpperCase()} title={text(lang, `nav.${route.view}`)} lead="" action={
        <button type="button" className="community-hub-refresh" disabled={loading} onClick={refresh}>{text(lang, "action.refresh")}</button>
      } />
    </section>;
  }

  return <AdminToolsProvider enabled={auth.permissions.admin} onChanged={refresh}><AppShell auth={auth} authLoading={authLoading} environment={previewEnvironment} lang={lang} loading={loading} onLanguageChange={changeLanguage} onLogin={startLogin} onLogout={endSession} onNavigate={go} sourceState={sourceState} status={status} view={route.view}>{view}</AppShell></AdminToolsProvider>;
}
