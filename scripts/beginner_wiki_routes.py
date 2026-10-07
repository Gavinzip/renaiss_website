"""Chapter and citation routes for the published beginner Wiki.

Directus imported the original eleven chapters with its default topic=start.
Decode that identifiable legacy schema here so the reader and RAG use the same
routes, without rewriting the published text or its content hash.
"""
from __future__ import annotations

import re
from typing import Any

LEGACY_TOPICS = ("start", "start", "packs", "packs", "market", "sbt", "tcg", "tcg", "tcg", "tcg", "tcg")
TCG_TITLE = re.compile(r"(?:^|\s)TCG(?:\s|$)|基礎|基础|Basics|기초", re.IGNORECASE)


def guide_section_routes(guide: dict[str, Any]) -> list[dict[str, str]]:
    sections = guide.get("sections") or []
    topics = {str(section.get("topic") or "").strip().lower()
              for section in sections if isinstance(section, dict) and section.get("topic")}
    legacy = (len(sections) == len(LEGACY_TOPICS) and topics <= {"start"}
              and isinstance(sections[5], dict) and sections[5].get("type") == "sbtChecklist")
    routes = []
    anchors: set[str] = set()
    for index, section in enumerate(sections):
        section = section if isinstance(section, dict) else {}
        topic = LEGACY_TOPICS[index] if legacy else str(section.get("topic") or "start").strip().lower()
        anchor = f"beginner-wiki-section-{index}"
        if section.get("type") == "sbtChecklist":
            anchor = "beginner-anchor-sbt"
        elif section.get("type") == "intro" and TCG_TITLE.search(str(section.get("title") or "")):
            anchor = "beginner-anchor-tcg"
        if anchor in anchors:
            anchor = f"beginner-wiki-section-{index}"
        anchors.add(anchor)
        routes.append({"topic": topic, "anchor": anchor})
    return routes


def wiki_section_routes(data: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    return {language: guide_section_routes(guide) for language, guide in (data.get("guides") or {}).items()
            if isinstance(guide, dict)}


def with_section_routes(document: dict[str, Any]) -> dict[str, Any]:
    """Add derived routing metadata without mutating Directus's cached document."""
    if not document.get("exists") or not isinstance(document.get("data"), dict):
        return document
    return {**document, "meta": {**(document.get("meta") or {}),
                                "section_routes": wiki_section_routes(document["data"])}}
