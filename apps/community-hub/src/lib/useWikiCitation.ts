import { useEffect } from "react";

/** Resolve citations after the requested Wiki chapter has rendered. */
export function useWikiCitation(sectionId: string, ready: boolean, topic: string, language: string) {
  useEffect(() => {
    if (!ready || !sectionId.startsWith("beginner-")) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(sectionId);
      if (!target) return;
      const disclosure = target.closest("details");
      if (disclosure) disclosure.open = true;
      const header = document.querySelector(".community-hub-topbar");
      // Header height changes with the language and mobile layout.
      target.style.scrollMarginTop = `${Math.ceil((header?.getBoundingClientRect().bottom || 0) + 24)}px`;
      target.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sectionId, ready, topic, language]);
}
