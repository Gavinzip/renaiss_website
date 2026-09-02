from __future__ import annotations

import re
from typing import Any


PRODUCT_PROGRESS_GROUP_VERSION = "product-progress-group-v1"
PRODUCT_ENTITY_PATTERNS = (
    re.compile(r"\bPANDORA\s+\d+\b", re.I),
    re.compile(r"\b[A-Z][A-Za-z0-9-]{2,}\s+[Pp][Aa][Cc][Kk]\b"),
    re.compile(r"\$\s*\d+\s+(?:POK[EÉ]MON\s+)?MACHINE\b", re.I),
)
PRODUCT_SOLD_OUT_RE = re.compile(r"\bsold\s*out\b|all\s+[\d,]+\s+packs?\s+have\s+been\s+claimed", re.I)
PRODUCT_LAUNCH_RE = re.compile(
    r"\b(?:is\s+)?now\s+live\b|\bgo(?:es|ing)?\s+live\b|\blaunch(?:es|ing|ed)?\b|"
    r"\barrives?\b|\bcoming\b|\bready\b|\bopens?\s+(?:today|tomorrow|on)\b",
    re.I,
)
PRODUCT_CLAIM_RE = re.compile(r"\bavailable\s+to\s+claim\b|\bclaim\s+(?:your|rewards?)\b|\bsbts?\s+have\s+now\s+been\s+dropped\b", re.I)


def _normalized_account(value: Any) -> str:
    return str(value or "").strip().lower().lstrip("@")


def _product_entities(raw_text: str) -> list[str]:
    entities: set[str] = set()
    for pattern in PRODUCT_ENTITY_PATTERNS:
        for match in pattern.findall(raw_text):
            entity = re.sub(r"\s+", " ", str(match or "").strip().upper())
            if entity:
                entities.add(entity)
    return sorted(entities)


def product_progress_group_key(card: dict[str, Any]) -> str:
    """Build a language-independent key for one product lifecycle occurrence.

    The UI receives translated editorial copy, so translated titles must never
    be used as identity. This key uses only the original source text plus the
    structured account, timeline, and lifecycle status fields.
    """
    if str(card.get("source_role") or "").strip().lower() != "official":
        return ""
    if str(card.get("card_type") or "").strip().lower() != "product_progress":
        return ""
    status = str(card.get("plan_status") or "").strip().lower()
    if status not in {"upcoming", "in_progress", "completed"}:
        return ""
    raw_text = str(card.get("raw_text") or "").strip()
    entities = _product_entities(raw_text)
    if not entities:
        return ""
    day = str(card.get("timeline_end_date") or card.get("timeline_date") or "").strip()[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return ""
    if PRODUCT_SOLD_OUT_RE.search(raw_text):
        phase = "sold_out"
    elif PRODUCT_CLAIM_RE.search(raw_text):
        phase = "claim"
    elif PRODUCT_LAUNCH_RE.search(raw_text):
        phase = "launch"
    else:
        phase = "launch"
    account = _normalized_account(card.get("account"))
    if not account:
        return ""
    return "|".join((PRODUCT_PROGRESS_GROUP_VERSION, account, "+".join(entities), day, status, phase))


def attach_product_progress_group_keys(feed: dict[str, Any]) -> int:
    cards = feed.get("cards") if isinstance(feed.get("cards"), list) else []
    attached = 0
    for card in cards:
        if not isinstance(card, dict):
            continue
        key = product_progress_group_key(card)
        if key:
            card["product_progress_group_key"] = key
            attached += 1
        else:
            card.pop("product_progress_group_key", None)
    return attached
