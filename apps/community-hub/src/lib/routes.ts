import { useCallback, useEffect, useState } from "react";
import type { HubView } from "@/types";

const VIEWS = new Set<HubView>(["overview", "official", "feed", "events", "future", "sbt", "profile", "guide", "article", "records", "media", "knowledge", "manage"]);

export interface HubRoute {
  article: string;
  guide: string;
  section: string;
  view: HubView;
}

function parseRoute(): HubRoute {
  const params = new URLSearchParams(window.location.search);
  const requested = window.location.hash.slice(1).toLowerCase() as HubView;
  const article = params.get("article") ?? "";
  const guide = params.get("guide") ?? "overview";
  const section = params.get("section") ?? "";
  const view = VIEWS.has(requested) ? requested : article ? "article" : params.has("guide") ? "guide" : "overview";
  return { view, guide, article, section };
}

function urlFor(route: HubRoute): string {
  const params = new URLSearchParams(window.location.search);
  params.delete("guide");
  params.delete("article");
  params.delete("section");
  if (route.view === "guide") params.set("guide", route.guide);
  if (route.view === "guide" && route.section) params.set("section", route.section);
  if (route.view === "article" && route.article) params.set("article", route.article);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}#${route.view}`;
}

export function useHubRoute() {
  const [route, setRoute] = useState<HubRoute>(parseRoute);

  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const navigate = useCallback((next: Partial<HubRoute>, replace = false) => {
    setRoute((current) => {
      const changingPage = (next.view !== undefined && next.view !== current.view)
        || (next.guide !== undefined && next.guide !== current.guide);
      const route = { ...current, ...(changingPage ? { section: "" } : {}), ...next };
      const nextUrl = urlFor(route);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) window.history[replace ? "replaceState" : "pushState"]({}, "", nextUrl);
      if (changingPage) window.scrollTo({ top: 0, behavior: "auto" });
      return route;
    });
  }, []);

  return { route, navigate };
}
