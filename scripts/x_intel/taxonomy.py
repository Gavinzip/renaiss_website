"""Canonical Community Hub taxonomy and one-time legacy normalization.

This module is deliberately dependency-free. Ingestion, editorial tools, and
the public feed all import the same vocabulary so an old UI or cached card
cannot silently restore retired labels.
"""

from __future__ import annotations

import hashlib
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
PRODUCT_FAMILY_IDS = frozenset({"fair", "gacha", "packs", "rewards", "index", "tech", "store", "platform", "vinci"})

# A product is not allowed to appear in the public Product Progress view merely
# because a post uses a product-like tag.  These are the explicit terms used to
# place a *verified, otherwise-unmapped* product into a family.  If no family
# can be established, the card remains unmapped for editorial review.
PRODUCT_FAMILY_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("packs", re.compile(r"(?:\b(?:pack|booster|box)\b|卡包|卡盒|卡组|卡組)", re.I)),
    ("gacha", re.compile(r"(?:\b(?:gacha|capsule)\b|扭蛋|轉蛋|转蛋)", re.I)),
    ("rewards", re.compile(r"(?:\b(?:reward|referral)\b|獎勵|奖励|推薦獎勵|推荐奖励)", re.I)),
    ("index", re.compile(r"(?:\bindex\b|指數|指数)", re.I)),
    ("tech", re.compile(r"(?:\b(?:assistant|analysis|air)\b|助手|分析工具)", re.I)),
    ("store", re.compile(r"(?:\b(?:store|merch|redemption)\b|商店|兌換|兑换)", re.I)),
    ("platform", re.compile(r"(?:\b(?:platform|binder|handling fee)\b|平台|卡冊|卡册|手續費|手续费)", re.I)),
    ("vinci", re.compile(r"(?:\bvinci\b|社交大廳|社交大厅)", re.I)),
)

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


def canonical_product_ids(value: Any, *, extra_ids: Any = None) -> list[str]:
    rows = value if isinstance(value, list) else []
    dynamic_ids = {
        str(item or "").strip().lower()
        for item in (extra_ids if isinstance(extra_ids, (list, tuple, set, frozenset)) else [])
        if str(item or "").strip()
    }
    out: list[str] = []
    for raw in rows:
        product_id = str(raw or "").strip().lower()
        if product_id in PRODUCT_IDS or product_id in dynamic_ids:
            if product_id not in out:
                out.append(product_id)
    return out


def _normalized_product_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", str(value or "").casefold())


def _product_slug(value: Any) -> str:
    tokens = re.findall(r"[a-z0-9]+", str(value or "").casefold())
    if tokens:
        return "-".join(tokens)[:64].strip("-")
    normalized = _normalized_product_name(value)
    if not normalized:
        return ""
    # Keep product IDs URL-safe while remaining stable for a non-Latin product
    # name. The public display name is preserved separately.
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12]
    return f"product-{digest}"


def _known_product_id_for_name(value: Any) -> str:
    needle = _normalized_product_name(value)
    if not needle:
        return ""
    for product_id, name in PRODUCT_CATALOG.items():
        aliases = [product_id.replace("-", " "), *str(name).split("/")]
        if needle in {_normalized_product_name(alias) for alias in aliases}:
            return product_id
    return ""


def auto_product_definition(payload: dict[str, Any]) -> dict[str, str] | None:
    """Derive a safe product entity from verified product-progress evidence.

    This is intentionally the primary product-onboarding rule, not a display
    fallback. It only runs for an official card that has already passed the
    four Product Progress evidence tests. Unknown names without a clear family
    remain unmapped instead of being invented as a product card.
    """

    if str(payload.get("review_status") or "").strip().lower() == "admin_overridden":
        return None
    if str(payload.get("classified_by") or "").strip().lower() == "manual":
        return None
    if canonical_source_role(payload.get("source_role")) != "official":
        return None
    if canonical_card_type(payload.get("card_type"), source_role="official") != "product_progress":
        return None
    if str(payload.get("plan_status") or "").strip().lower() not in {"upcoming", "in_progress", "completed"}:
        return None
    evidence = normalize_product_progress_evidence(payload.get("product_progress_evidence"))
    if not has_complete_product_progress_evidence(evidence):
        return None
    name = re.sub(r"\s+", " ", str(evidence.get("product_or_capability") or "").strip())[:96]
    if not name:
        return None
    known_id = _known_product_id_for_name(name)
    if known_id:
        return {"id": known_id, "name": PRODUCT_CATALOG[known_id], "family_id": "", "owner_account": ""}
    family_id = next((family for family, pattern in PRODUCT_FAMILY_PATTERNS if pattern.search(name)), "")
    if family_id not in PRODUCT_FAMILY_IDS:
        return None
    product_id = _product_slug(name)
    owner_account = normalize_handle(payload.get("account"))
    if not product_id or not owner_account:
        return None
    return {
        "id": product_id,
        "name": name,
        "family_id": family_id,
        "owner_account": owner_account,
    }


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
        payload.get("product_definition"),
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
    product_definition = auto_product_definition(payload)
    dynamic_product_id = ""
    if product_definition:
        dynamic_product_id = str(product_definition.get("id") or "").strip().lower()
        payload["product_ids"] = canonical_product_ids(
            [*(payload.get("product_ids") or []), dynamic_product_id],
            extra_ids=[dynamic_product_id] if dynamic_product_id and dynamic_product_id not in PRODUCT_IDS else [],
        )
        if dynamic_product_id not in PRODUCT_IDS:
            payload["product_definition"] = product_definition
        else:
            payload.pop("product_definition", None)
    else:
        payload["product_ids"] = canonical_product_ids(payload.get("product_ids"))
        payload.pop("product_definition", None)
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
        payload.get("product_definition"),
        tuple(
            (item.get("name"), item.get("status"))
            for item in (payload.get("sbt_entries") or [])
            if isinstance(item, dict)
        ),
        payload.get("record_result"),
        payload.get("product_progress_evidence"),
    )
    return before != after
