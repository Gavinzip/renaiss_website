"""Source-backed News facets, separate from the canonical post format.

An event mentioning builders is not a developer update. Generic thanks to
partners are not partnership announcements. Evidence is an exact source span.
"""
from __future__ import annotations
import re

NEWS_FACET_VERSION = "2026-11-24-source-evidence-v1"
PRIMARY = {"event": "Events", "product_progress": "Product"}
PARTNER_PATTERNS = (
    r"\bRenaiss\s+partners?\s+with\s+(?P<partner>@?[\w-]+)",
    r"\b(?:we(?:’|')re\s+)?partnering\s+with\s+(?P<partner>@?[\w-]+)",
    r"\bRenaiss\s+integrates?\s+with\s+(?P<partner>@?[\w-]+)",
    r"\bcompleted\s+the\s+integration\s+of\s+.{1,100}?\s+with\s+(?P<partner>@?[\w-]+)",
)
BUILDER_PATTERNS = (
    r"\bfor\s+developers\s*,?\s+Renaiss\s+Index\b",
    r"\b(?:Renaiss\s+SDK|SDKs?,\s+protocol\s+components)\b",
    r"\b(?:hackathon|developer\s+(?:guide|documentation|tools?|API|kit)|SDK\s+(?:release|launch|documentation)|CLI\s+(?:release|launch|tool))\b",
)


def explicit_partnership(source: str) -> tuple[str, list[str]]:
    for pattern in PARTNER_PATTERNS:
        match = re.search(pattern, source, re.I)
        if match:
            return match.group(0), [match.group("partner")]
    return "", []


def news_category_metadata(source: str, card_type: str) -> dict:
    categories = [PRIMARY.get(card_type, "Community")]
    evidence = {}
    quote, _ = explicit_partnership(source)
    if quote:
        categories.append("Partnership"); evidence["Partnership"] = quote
    for pattern in BUILDER_PATTERNS:
        match = re.search(pattern, source, re.I)
        if match:
            categories.append("Builders"); evidence["Builders"] = match.group(0); break
    return {"news_categories": categories, "news_category_evidence": evidence, "news_category_version": NEWS_FACET_VERSION}
