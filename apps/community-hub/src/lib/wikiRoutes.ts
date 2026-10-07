import type { BeginnerWikiMeta, GuideSection, Language } from "@/types";

const legacyTopics = ["start", "start", "packs", "packs", "market", "sbt", "tcg", "tcg", "tcg", "tcg", "tcg"];

export function guideSectionRoutes(sections: GuideSection[], lang: Language, meta?: BeginnerWikiMeta) {
  const published = meta?.section_routes?.[lang];
  if (published) return published;
  // Decode the original eleven-chapter schema for older published API versions.
  // New API responses provide the routes shared with knowledge retrieval.
  const topics = new Set(sections.map((section) => section.topic).filter(Boolean));
  const legacy = sections.length === legacyTopics.length && sections[5]?.type === "sbtChecklist"
    && [...topics].every((topic) => topic === "start");
  const anchors = new Set<string>();
  return sections.map((section, index) => {
    const topic = legacy ? legacyTopics[index] : section.topic || "start";
    let anchor = section.type === "sbtChecklist" ? "beginner-anchor-sbt"
      : section.type === "intro" && /(?:^|\s)TCG(?:\s|$)|基礎|基础|Basics|기초/i.test(section.title || "")
        ? "beginner-anchor-tcg" : `beginner-wiki-section-${index}`;
    if (anchors.has(anchor)) anchor = `beginner-wiki-section-${index}`;
    anchors.add(anchor);
    return { topic, anchor };
  });
}

export function guideHref(topic: string, lang: Language, section = ""): string {
  const params = new URLSearchParams({ guide: topic, lang });
  if (section) params.set("section", section);
  return `?${params}#guide`;
}
