"""Canonical Community Hub taxonomy and one-time legacy normalization.

This module is deliberately dependency-free. Ingestion, editorial tools, and
the public feed all import the same vocabulary so an old UI or cached card
cannot silently restore retired labels.
"""

from __future__ import annotations

from typing import Any


CARD_TYPES = frozenset(
    {"event", "product_progress", "announcement", "market", "report", "guide", "insight"}
)
TOPIC_LABELS = frozenset({"collectibles", "sbt"})
SOURCE_ROLES = frozenset({"official", "official_community", "other"})
RETIRED_X_SOURCE_HANDLES = frozenset({"pokegetinfomain"})

PRODUCT_PROGRESS_QUESTIONS = (
    "能否指出明確的產品、功能、協議或平台能力？",
    "相比之前，它的狀態是否真的改變？",
    "是否改變了使用者能做的事，或平台實際運作方式？",
    "原文是否提供足夠證據支持這次變化？",
)
PRODUCT_PROGRESS_EVIDENCE_FIELDS = (
    "product_or_capability",
    "state_change",
    "user_or_platform_impact",
    "source_evidence",
)

LEGACY_SOURCE_ROLE_ALIASES = {"ambassador": "other", "community": "other"}
LEGACY_CARD_TYPE_ALIASES = {"trend": "market"}


def normalize_handle(value: Any) -> str:
    return str(value or "").strip().lower().lstrip("@")


def is_retired_source_handle(value: Any) -> bool:
    return normalize_handle(value) in RETIRED_X_SOURCE_HANDLES


def canonical_source_role(value: Any) -> str:
    role = str(value or "").strip().lower().replace("-", "_")
    role = LEGACY_SOURCE_ROLE_ALIASES.get(role, role)
    return role if role in SOURCE_ROLES else "other"


def canonical_topic_labels(value: Any) -> list[str]:
    rows = value if isinstance(value, list) else [value] if isinstance(value, str) else []
    out: list[str] = []
    for raw in rows:
        label = str(raw or "").strip().lower()
        if label == "pokemon":
            label = "collectibles"
        if label in TOPIC_LABELS and label not in out:
            out.append(label)
    return out


def normalize_product_progress_evidence(value: Any) -> dict[str, str]:
    rows = value if isinstance(value, dict) else {}
    return {
        field: str(rows.get(field) or "").strip()[:500]
        for field in PRODUCT_PROGRESS_EVIDENCE_FIELDS
        if str(rows.get(field) or "").strip()
    }


def has_complete_product_progress_evidence(value: Any) -> bool:
    evidence = normalize_product_progress_evidence(value)
    return all(evidence.get(field) for field in PRODUCT_PROGRESS_EVIDENCE_FIELDS)


def canonical_card_type(
    value: Any,
    *,
    source_role: Any = "other",
    legacy_topics: Any = None,
    plan_status: Any = "",
    classified_by: Any = "",
) -> str:
    """Map stored legacy values without inventing product progress.

    A historical `alpha` decision is retained as Product Progress only when it
    was explicitly confirmed by an editor. All other old `feature` values
    become announcements until the new four-question classifier verifies them.
    """
    card_type = str(value or "").strip().lower().replace("-", "_")
    card_type = LEGACY_CARD_TYPE_ALIASES.get(card_type, card_type)
    topics = {
        str(item or "").strip().lower()
        for item in (legacy_topics if isinstance(legacy_topics, list) else [])
    }
    role = canonical_source_role(source_role)
    classifier = str(classified_by or "").strip().lower()

    if "guides" in topics or "guide" in topics:
        return "guide"
    if card_type == "feature":
        manually_confirmed = classifier in {"manual", "feedback"}
        if role == "official" and "alpha" in topics and manually_confirmed:
            return "product_progress"
        return "announcement"
    if card_type == "product_progress" and role != "official":
        return "announcement"
    return card_type if card_type in CARD_TYPES else "insight"


def migrate_card_taxonomy_payload(payload: dict[str, Any], source_role: Any) -> bool:
    """Normalize one persisted card in place; safe to run on every sync."""
    before = (
        payload.get("source_role"),
        payload.get("card_type"),
        tuple(payload.get("topic_labels") or []),
        payload.get("product_progress_evidence"),
    )
    legacy_topics = payload.get("topic_labels") if isinstance(payload.get("topic_labels"), list) else []
    role = canonical_source_role(source_role)
    payload["source_role"] = role
    payload["card_type"] = canonical_card_type(
        payload.get("card_type"),
        source_role=role,
        legacy_topics=legacy_topics,
        plan_status=payload.get("plan_status"),
        classified_by=payload.get("classified_by"),
    )
    payload["topic_labels"] = canonical_topic_labels(legacy_topics)
    evidence = normalize_product_progress_evidence(payload.get("product_progress_evidence"))
    if payload["card_type"] == "product_progress":
        payload["product_progress_evidence"] = evidence
    else:
        payload.pop("product_progress_evidence", None)
    after = (
        payload.get("source_role"),
        payload.get("card_type"),
        tuple(payload.get("topic_labels") or []),
        payload.get("product_progress_evidence"),
    )
    return before != after
