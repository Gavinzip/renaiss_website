"""Temporal eligibility for event retrieval, applied before the source limit."""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any

from .knowledge_intent import historical_question


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
    if start > now:
        return "upcoming"
    return "ongoing"


def _registration_open(source: dict[str, Any], now: datetime) -> bool:
    """A retained signup post is not an open window; require its boundaries."""
    role = source.get("date_role")
    published = _date(source.get("published_at"), now)
    if not published or published > now:
        return False
    action_date = _date(source.get("effective_event_date") or source.get("timeline_date"), now)
    end = _date(source.get("timeline_end_date"), now)
    if role == "registration_deadline":
        start = published
        end = end or action_date
    elif role == "registration_open":
        start = action_date
    else:
        return False
    if not start or not end or end < start:
        return False
    if end.hour == end.minute == end.second == 0:
        end += timedelta(days=1)
    return start <= now < end


def eligible_event_sources(sources: list[dict[str, Any]], question: str, intent: dict[str, bool], now: datetime) -> list[dict[str, Any]]:
    if not intent.get("event") or not intent.get("event_schedule", True):
        return sources
    q = question.lower()
    historical = historical_question(q)
    dated_question = bool(re.search(r"\d{1,2}\s*[月/.-]\s*\d{1,2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d", q))
    current = intent.get("current_events", not historical and not dated_question)
    horizon = 0 if intent.get("immediate") or any(term in q for term in ("今天", "今日", "today", "tonight")) else 6 - now.weekday() if any(term in q for term in ("本週", "本周", "this week")) else 30
    result = []
    for source in sources:
        if current:
            published = _date(source.get("published_at"), now)
            if published and published > now:
                continue
        timing = event_timing(source, now)
        if current and timing == "ended":
            continue
        if (intent.get("registration") or intent.get("participation")) and source.get("card_type") == "event" and source.get("date_role") in {"registration_open", "registration_deadline"}:
            text = " ".join(str(source.get(key) or "") for key in ("title", "summary", "raw_hint"))
            if re.search(r"\b(register|registration|sign up|applications? open)\b|報名|报名|申請|申请", text, re.I) and not re.search(r"no registration|無需報名|无需报名", text, re.I):
                if not current:
                    result.append({**source, "event_status": "registration_timing"})
                elif _registration_open(source, now):
                    result.append({**source, "event_status": "registration_open"})
                continue
        if timing == "not_event":
            continue
        if current and timing not in {"ongoing", "upcoming"}:
            continue
        source = {**source, "event_status": timing}
        if not historical and not dated_question:
            if timing == "ended":
                continue
            if timing == "upcoming":
                start = _date(source.get("effective_event_date") or source.get("timeline_date"), now)
                if start and (start.date() - now.date()).days > horizon:
                    continue
        result.append(source)
    # Confirmed active events precede announcements with unconfirmed timing.
    return sorted(result, key=lambda row: row["event_status"] != "timing_unconfirmed", reverse=True)


def no_current_events_answer(lang: str) -> str:
    if lang == "zh-Hans":
        return "目前检索资料没有可确认正在或即将举行、可参加或报名的社群活动。"
    if lang.startswith("zh"):
        return "目前檢索資料沒有可確認正在或即將舉行、可參加或報名的社群活動。"
    if lang.startswith("ko"):
        return "현재 검색 자료에서는 지금 참여하거나 신청할 수 있는 진행 중 또는 예정된 커뮤니티 행사를 확인할 수 없습니다."
    return "The retrieved sources do not confirm any current or upcoming community events you can join or register for."
