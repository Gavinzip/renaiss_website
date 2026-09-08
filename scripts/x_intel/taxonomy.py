"""Canonical Community Hub taxonomy and one-time legacy normalization.

This module is deliberately dependency-free. Ingestion, editorial tools, and
the public feed all import the same vocabulary so an old UI or cached card
cannot silently restore retired labels.
"""

from __future__ import annotations

import re
from typing import Any


CARD_TYPES = frozenset(
    {"event", "product_progress", "announcement", "market", "report", "guide", "insight"}
)
# Routing topics are internal navigation facets, not public display tags. SBT is
# represented by ``sbt_entries`` and therefore does not need a second routing
# label. ``collectibles`` remains until the broader content-domain model exists.
ROUTING_TOPICS = frozenset({"collectibles"})
SOURCE_ROLES = frozenset({"official", "official_community", "other"})
RETIRED_X_SOURCE_HANDLES = frozenset({"pokegetinfomain"})

# Canonical product identity is a stored classification fact. The frontend may
# render this catalogue, but must not reconstruct membership from article copy.
PRODUCT_CATALOG = {
    "proof-of-fair": "RIP: Proof of Fair / Renaiss Fair",
    "pandora-248": "PANDORA 248",
    "pandora-88": "PANDORA 88",
    "pandora-48": "PANDORA 48",
    "pandora-28": "PANDORA 28",
    "eden-gacha": "EDEN Gacha",
    "infinite-gacha": "Infinite Gacha / gacha machines",
    "niu-lai-pack": "NIU LAI Pack",
    "genesis-pack": "Genesis Pack",
    "surge-pack": "Surge Pack",
    "inferno-pack": "Inferno Pack",
    "tempest-pack": "Tempest Pack",
    "omega-pack": "Omega Pack",
    "referral-rewards": "Referral Rewards",
    "renaiss-index": "Renaiss Index partner network",
    "renaiss-air": "Renaiss AIR",
    "collector-assistant": "Collector Assistant",
    "card-platform-analysis": "Card Platform Analysis",
    "store-redemption": "Merch Rewards Redemption",
    "collectibles-binder": "Collectibles Binder",
    "card-handling-fees": "Card Handling Fees",
    "social-hall": "Vinci World Social Hall",
}
PRODUCT_IDS = frozenset(PRODUCT_CATALOG)

SBT_STATUSES = frozenset({"unknown", "upcoming", "available", "ended", "distributed"})
RECORD_RESULT_KINDS = frozenset(
    {
        "competition_result",
        "draw_result",
        "reward_claim",
        "reward_distributed",
        "milestone_record",
    }
)
RECORD_RESULT_STATUSES = frozenset({"confirmed", "claim_open", "distributed", "completed"})

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


def canonical_routing_topics(value: Any) -> list[str]:
    rows = value if isinstance(value, list) else [value] if isinstance(value, str) else []
    out: list[str] = []
    for raw in rows:
        label = str(raw or "").strip().lower()
        if label == "pokemon":
            label = "collectibles"
        # Legacy ``sbt`` topic membership is migrated to ``sbt_entries`` by
        # ``migrate_card_taxonomy_payload``. It must not survive as a parallel
        # navigation label.
        if label in ROUTING_TOPICS and label not in out:
            out.append(label)
    return out


def canonical_product_ids(value: Any) -> list[str]:
    rows = value if isinstance(value, list) else []
    out: list[str] = []
    for raw in rows:
        product_id = str(raw or "").strip().lower()
        if product_id in PRODUCT_IDS and product_id not in out:
            out.append(product_id)
    return out


def _canonical_date(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-" and raw.replace("-", "").isdigit():
        return raw
    return ""


def normalize_sbt_entries(
    value: Any,
    *,
    legacy_name: Any = "",
    legacy_names: Any = None,
    legacy_acquisition: Any = "",
    legacy_topic_labels: Any = None,
    raw_text: Any = "",
    timeline_date: Any = "",
    timeline_end_date: Any = "",
) -> list[dict[str, str]]:
    """Return the sole canonical representation of SBT information.

    Legacy scalar/list fields are accepted only at this storage seam so old
    persisted cards can be migrated without making callers maintain two shapes.
    """

    rows = value if isinstance(value, list) else []
    out: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        status = str(raw.get("status") or "unknown").strip().lower().replace("-", "_")
        if status not in SBT_STATUSES:
            status = "unknown"
        item = {
            "name": str(raw.get("name") or "").strip()[:160],
            "acquisition": str(raw.get("acquisition") or "").strip()[:500],
            "status": status,
            "start_date": _canonical_date(raw.get("start_date")),
            "end_date": _canonical_date(raw.get("end_date")),
            "evidence": str(raw.get("evidence") or "").strip()[:800],
        }
        if not item["name"] or not item["evidence"]:
            continue
        key = (
            item["name"].lower(),
            item["acquisition"].lower(),
            item["status"],
            item["start_date"],
            item["end_date"],
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= 8:
            break
    if out:
        return out

    legacy_rows = legacy_names if isinstance(legacy_names, list) else []
    names = [str(item or "").strip()[:160] for item in legacy_rows if str(item or "").strip()]
    scalar_name = str(legacy_name or "").strip()[:160]
    if scalar_name and scalar_name not in names:
        names.insert(0, scalar_name)
    acquisition = str(legacy_acquisition or "").strip()[:500]
    legacy_topics = {
        str(item or "").strip().lower()
        for item in (legacy_topic_labels if isinstance(legacy_topic_labels, list) else [])
    }
    if not names and not acquisition and "sbt" not in legacy_topics:
        return []
    evidence = str(raw_text or "").strip()[:800]
    source_term = re.search(
        r"\bSBT\b|soul\s*bound(?:\s+token)?|soulbound|靈魂綁定|灵魂绑定",
        " ".join(part for part in (evidence, acquisition) if part),
        re.I,
    )
    # A legacy routing label is not enough to invent a structured SBT name.
    # Preserve exact legacy editor values, but leave a label-only row empty so
    # the versioned classifier can reread the source.
    if not names:
        if not source_term:
            return []
        names = [source_term.group(0)]
    if not evidence:
        evidence = acquisition or names[0]
    return [
        {
            "name": name,
            "acquisition": acquisition,
            "status": "unknown",
            "start_date": _canonical_date(timeline_date),
            "end_date": _canonical_date(timeline_end_date),
            "evidence": evidence,
        }
        for name in names[:8]
    ]


def normalize_record_result(value: Any) -> dict[str, str]:
    row = value if isinstance(value, dict) else {}
    kind = str(row.get("kind") or "").strip().lower().replace("-", "_")
    status = str(row.get("status") or "").strip().lower().replace("-", "_")
    subject = str(row.get("subject") or "").strip()[:300]
    evidence = str(row.get("evidence") or "").strip()[:800]
    if kind not in RECORD_RESULT_KINDS or status not in RECORD_RESULT_STATUSES or not subject or not evidence:
        return {}
    return {"kind": kind, "status": status, "subject": subject, "evidence": evidence}


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
        tuple(payload.get("routing_topics") or payload.get("topic_labels") or []),
        tuple(payload.get("product_ids") or []),
        tuple(
            (item.get("name"), item.get("status"))
            for item in (payload.get("sbt_entries") or [])
            if isinstance(item, dict)
        ),
        payload.get("record_result"),
        payload.get("product_progress_evidence"),
    )
    legacy_topics = payload.get("topic_labels") if isinstance(payload.get("topic_labels"), list) else []
    current_topics = payload.get("routing_topics") if isinstance(payload.get("routing_topics"), list) else legacy_topics
    role = canonical_source_role(source_role)
    payload["source_role"] = role
    payload["card_type"] = canonical_card_type(
        payload.get("card_type"),
        source_role=role,
        legacy_topics=legacy_topics,
        plan_status=payload.get("plan_status"),
        classified_by=payload.get("classified_by"),
    )
    payload["routing_topics"] = canonical_routing_topics(current_topics)
    payload["product_ids"] = canonical_product_ids(payload.get("product_ids"))
    payload["sbt_entries"] = normalize_sbt_entries(
        payload.get("sbt_entries"),
        legacy_name=payload.get("sbt_name"),
        legacy_names=payload.get("sbt_names"),
        legacy_acquisition=payload.get("sbt_acquisition"),
        legacy_topic_labels=legacy_topics,
        raw_text=payload.get("raw_text"),
        timeline_date=payload.get("timeline_date"),
        timeline_end_date=payload.get("timeline_end_date"),
    )
    payload["record_result"] = normalize_record_result(payload.get("record_result")) or None
    payload.pop("topic_labels", None)
    payload.pop("sbt_name", None)
    payload.pop("sbt_names", None)
    payload.pop("sbt_acquisition", None)
    evidence = normalize_product_progress_evidence(payload.get("product_progress_evidence"))
    if payload["card_type"] == "product_progress":
        payload["product_progress_evidence"] = evidence
    else:
        payload.pop("product_progress_evidence", None)
    after = (
        payload.get("source_role"),
        payload.get("card_type"),
        tuple(payload.get("routing_topics") or []),
        tuple(payload.get("product_ids") or []),
        tuple(
            (item.get("name"), item.get("status"))
            for item in (payload.get("sbt_entries") or [])
            if isinstance(item, dict)
        ),
        payload.get("record_result"),
        payload.get("product_progress_evidence"),
    )
    return before != after
