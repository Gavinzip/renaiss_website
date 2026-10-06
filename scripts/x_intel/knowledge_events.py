"""Temporal eligibility for event retrieval, applied before the source limit."""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any


def _date(value: Any, now: datetime) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        return parsed.replace(tzinfo=now.tzinfo) if parsed.tzinfo is None else parsed.astimezone(now.tzinfo)
    except ValueError:
        return None


def event_timing(source: dict[str, Any], now: datetime) -> str:
    if source.get("card_type") != "event":
        return "not_event"
    role = source.get("date_role")
    text = " ".join(str(source.get(key) or "") for key in ("title", "summary", "raw_hint"))
    if re.search(r"\b(cancelled|canceled|wrapped up|has come to an end)\b|已取消|已結束|已结束|圓滿落幕", text, re.I):
        return "ended"
    if role not in {"event_start", "schedule_update"}:
        # A post/registration date does not establish when the event happens.
        # An explicit date in the separate event schedule can still establish
        # that an old event has ended, even if the post is a signup announcement.
        schedule = str((source.get("event_facts") or {}).get("schedule") or "")
        schedule_dates = [_date(value, now) for value in re.findall(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", schedule)]
        schedule_dates = [value for value in schedule_dates if value is not None]
        if schedule_dates and now >= max(schedule_dates) + timedelta(days=1):
            return "ended"
        # Unknown-time sources need actual event evidence, not a product demo.
        if re.search(r"\b(AMA|meetup|party|gathering|livestream|conference)\b|聚會|聚会|直播|卡展|線下活動|线下活动", text, re.I):
            return "timing_unconfirmed"
        return "not_event"
    start = _date(source.get("effective_event_date") or source.get("timeline_date"), now)
    if not start:
        return "timing_unconfirmed"
    end_value = source.get("timeline_end_date") or source.get("effective_event_date") or source.get("timeline_date")
    end = _date(end_value, now) or start
    # Date-only/midnight schedules prove a day, not the precise closing time.
    if end.hour == end.minute == end.second == 0:
        end += timedelta(days=1)
    if now >= end:
        return "ended"
    if start.date() > now.date():
        return "upcoming"
    return "ongoing"


def eligible_event_sources(sources: list[dict[str, Any]], question: str, intent: dict[str, bool], now: datetime) -> list[dict[str, Any]]:
    if not intent.get("event") or not intent.get("event_schedule", True):
        return sources
    q = question.lower()
    historical = any(term in q for term in ("之前", "已結束", "已结束", "上週", "上周", "過去", "过去", "回顧", "回顾", "past", "ended", "last week", "recap"))
    dated_question = bool(re.search(r"\d{1,2}\s*[月/.-]\s*\d{1,2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d", q))
    horizon = 0 if intent.get("immediate") or any(term in q for term in ("今天", "今日", "today", "tonight")) else 7 if any(term in q for term in ("本週", "本周", "this week")) else 30
    result = []
    for source in sources:
        if intent.get("registration") and source.get("date_role") in {"registration_open", "registration_deadline"}:
            text = " ".join(str(source.get(key) or "") for key in ("title", "summary", "raw_hint"))
            if re.search(r"\b(register|registration|sign up|applications? open)\b|報名|报名|申請|申请", text, re.I) and not re.search(r"no registration|無需報名|无需报名", text, re.I):
                timing = _date(source.get("effective_event_date"), now)
                if historical or dated_question or not intent.get("near") or (timing and timing.date() >= now.date()):
                    result.append({**source, "event_status": "registration_timing"})
                continue
        timing = event_timing(source, now)
        if timing == "not_event":
            continue
        source = {**source, "event_status": timing}
        if not historical and not dated_question:
            if timing == "ended":
                continue
            if timing == "upcoming":
                start = _date(source.get("effective_event_date"), now)
                if start and (start.date() - now.date()).days > horizon:
                    continue
        result.append(source)
    # Confirmed active events precede announcements with unconfirmed timing.
    return sorted(result, key=lambda row: row["event_status"] != "timing_unconfirmed", reverse=True)
