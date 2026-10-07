"""Source qualification for SBT claims, independent of models and feed rendering."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

_CLOSED = re.compile(
    r"\b(?:paused|suspended|ended|closed|sold\s*out|cancelled|canceled)\b"
    r"|tạm\s+(?:thời\s+)?(?:tạm\s+)?dừng|暫停|暂停|已結束|已结束|已截止|售罄|중단|종료|마감",
    re.I,
)
_ACTION = re.compile(
    r"\b(?:complete|follow|repost|like|pull|claim|mint|register|participate)\b"
    r"|完成|追蹤|追踪|轉發|转发|領取|领取|抽取|開包|开包|팔로우|참여|획득",
    re.I,
)
_SBT = re.compile(r"\bSBTs?\b|soul\s*bound|soulbound|靈魂綁定|灵魂绑定", re.I)
_MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def _text(value: Any) -> str:
    return " ".join(str(value or "").split()).casefold()


def _quote(value: Any, source: str) -> str:
    quote = str(value or "").strip()
    return quote if quote and _text(quote) in _text(source) else ""


def _closure_quote(name: str, source: str) -> str:
    # Legacy evidence may paraphrase a pause. Reread the nearby original
    # statement rather than preserving the model's opposite status.
    for match in re.finditer(re.escape(name), source, re.I):
        context = source[max(0, match.start() - 180):match.end() + 180]
        if _CLOSED.search(context):
            return context
    return ""


def _date_in_quote(value: str, quote: str) -> bool:
    try:
        day = date.fromisoformat(value)
    except (ValueError, TypeError):
        return False
    month = _MONTHS[day.month - 1]
    patterns = (
        rf"(?<!\d){re.escape(value)}(?!\d)",
        rf"(?<!\d)0?{day.month}[/-]0?{day.day}(?!\d)",
        rf"(?<!\d)0?{day.day}\s+{month[:3]}(?:{month[3:]})?\b",
        rf"\b{month[:3]}(?:{month[3:]})?\s+0?{day.day}(?:st|nd|rd|th)?(?!\d)",
        rf"(?<!\d){day.month}\s*(?:月|월)\s*0?{day.day}\s*(?:日|일)?(?!\d)",
    )
    return any(re.search(pattern, quote, re.I) for pattern in patterns)


def _acquisition_quote(quote: str, name: str) -> bool:
    # A paragraph can mention a buyback action and an SBT separately. Require
    # the action and this SBT in one statement, not just somewhere in the post.
    return any(
        _ACTION.search(statement) and _SBT.search(statement)
        and _text(name) in _text(statement)
        for statement in re.split(r"[.!?。！？]", quote)
    )


def qualify_sbt_entries(entries: list[dict[str, str]], raw_text: Any) -> list[dict[str, str]]:
    """Keep historical mentions, but remove unsupported actions and active periods.

    A name/evidence mention is insufficient to prove an acquisition condition.
    Separate verbatim quotes prevent a nearby buyback requirement or publication
    date from being repurposed as an SBT requirement or deadline.
    """
    source = str(raw_text or "")
    qualified = []
    for original in entries:
        row = dict(original)
        evidence = _quote(row.get("evidence"), source)
        action = _quote(row.get("acquisition_evidence"), source)
        period = _quote(row.get("period_evidence"), source)
        campaign = _quote(row.get("campaign"), source)
        closure = (evidence if evidence and _CLOSED.search(evidence) else "") or _closure_quote(row.get("name", ""), source)
        action_valid = bool(action and _acquisition_quote(action, row.get("name", "")))
        period_valid = bool(
            period and _SBT.search(period) and _date_in_quote(row.get("start_date", ""), period)
            and _date_in_quote(row.get("end_date", ""), period)
            and row["start_date"] <= row["end_date"]
        )
        row["acquisition_evidence"] = action if action_valid else ""
        row["period_evidence"] = period if period_valid else ""
        row["campaign"] = campaign
        if not action_valid:
            row["acquisition"] = ""
        if not period_valid:
            row["start_date"] = ""
            row["end_date"] = ""
        # The statement about this SBT determines closure, even when a model
        # incorrectly marked a pause as an upcoming campaign.
        if closure:
            row["status"] = "ended"
            row["evidence"] = closure
        elif row.get("status") == "distributed" and evidence:
            row["status"] = "distributed"
        elif not evidence or not action_valid:
            row["status"] = "unknown"
        qualified.append(row)
    return qualified
