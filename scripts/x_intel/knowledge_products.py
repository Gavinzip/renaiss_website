"""Official product-update evidence, without reclassifying feed cards."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo


PRODUCT_RE = re.compile(
    r"\b(?:[a-z][a-z0-9-]*\s+pack|pandora\s+\d+|eden\s+gacha|buyback|"
    r"renaiss\s+(?:fair|index|air)|proof\s+of\s+fair|vinci\s+(?:catch|world)|merch)\b",
    re.I,
)


def _update_status(source: dict[str, Any], now: datetime) -> str:
    # Preserve the announcement's tense. A scheduled date becoming past is not
    # evidence that a release happened, or that a pack is still available.
    raw = str(source.get("raw_hint") or "").replace("’", "'").replace("‘", "'")
    if re.search(r"\b(?:now live|just (?:updated|launched|released)|we(?:'ve| have)? updated)\b|已上線|已上线|已推出|已更新", raw, re.I):
        return "reported_released"
    if re.search(r"\b(?:coming|arrives?|arriving|will (?:launch|release)|launches? on)\b|即將|即将|將於|将于|預告|预告", raw, re.I):
        try:
            scheduled = datetime.fromisoformat(str(source.get("timeline_date") or "").replace("Z", "+00:00"))
            scheduled = scheduled.replace(tzinfo=now.tzinfo) if scheduled.tzinfo is None else scheduled.astimezone(now.tzinfo)
            if scheduled.date() < now.date():
                return "release_preview_elapsed"
        except ValueError:
            pass
        return "release_preview"
    return "update_report"


def eligible_product_sources(sources: list[dict[str, Any]], now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or datetime.now(ZoneInfo("Asia/Taipei"))
    result = []
    for source in sources:
        if source.get("knowledge_kind", "social") != "social" or source.get("source_role") != "official":
            continue
        if source.get("card_type") == "product_progress":
            result.append({**source, "product_update_status": _update_status(source, now)})
            continue
        # Release previews remain announcements. Include their product evidence
        # without changing the stricter product_progress taxonomy.
        text = " ".join(str(source.get(key) or "") for key in ("title", "summary", "raw_hint"))
        if (source.get("card_type") == "announcement"
                and source.get("date_role") in {"product_release", "feature_launch"}
                and (source.get("product_ids") or PRODUCT_RE.search(text))):
            result.append({**source, "product_update_status": _update_status(source, now)})
    return result
