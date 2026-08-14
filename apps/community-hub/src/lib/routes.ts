import { useCallback, useEffect, useState } from "react";
import type { HubView } from "@/types";

const VIEWS = new Set<HubView>(["overview", "official", "feed", "events", "future", "sbt", "guide", "article", "records", "media", "knowledge"]);

export interface HubRoute {
  article: string;
  guide: string;
  view: HubView;
}

function parseRoute(): HubRoute {
  const params = new URLSearchParams(window.location.search);
  const requested = window.location.hash.slice(1).toLowerCase() as HubView;
  const article = params.get("article") ?? "";
  const guide = params.get("guide") ?? "overview";
  const view = VIEWS.has(requested) ? requested : article ? "article" : params.has("guide") ? "guide" : "overview";
  return { view, guide, article };
}

function urlFor(route: HubRoute): string {
  const params = new URLSearchParams(window.location.search);
  params.delete("guide");
  params.delete("article");
  if (route.view === "guide") params.set("guide", route.guide);
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
      const route = { ...current, ...next };
      const nextUrl = urlFor(route);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) window.history[replace ? "replaceState" : "pushState"]({}, "", nextUrl);
      if (route.view !== current.view) window.scrollTo({ top: 0, behavior: "auto" });
      return route;
    });
  }, []);

  return { route, navigate };
}
