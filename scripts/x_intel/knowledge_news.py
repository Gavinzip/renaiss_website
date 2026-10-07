"""Publication-date eligibility for recent news, separate from event schedules."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any


def recent_news_window(question: str, now: datetime) -> tuple[date, date] | None:
    q = question.casefold()
    news = ("消息", "新聞", "新闻", "動態", "动态", "更新", "近況", "近况", "news", "update", "소식", "뉴스", "업데이트")
    recent = ("最近", "近期", "最新", "今天", "今日", "本週", "本周", "recent", "latest", "today", "this week", "최근", "최신", "오늘", "이번 주")
    implicit = any(term in q for term in ("what's new", "what’s new", "what is new"))
    if not implicit and not (any(term in q for term in news) and any(term in q for term in recent)):
        return None
    today = now.date()
    if any(term in q for term in ("今天", "今日", "today", "오늘")):
        start = today
    elif any(term in q for term in ("本週", "本周", "this week", "이번 주")):
        start = today - timedelta(days=today.weekday())
    else:
        start = today - timedelta(days=6)
    return start, today


def eligible_news_sources(sources: list[dict[str, Any]], question: str, now: datetime) -> list[dict[str, Any]]:
    window = recent_news_window(question, now)
    if window is None:
        return sources
    start, end = window
    eligible: list[tuple[datetime, dict[str, Any]]] = []
    for source in sources:
        if source.get("knowledge_kind", "social") != "social":
            continue
        try:
            published = datetime.fromisoformat(str(source.get("published_at") or "").replace("Z", "+00:00"))
        except ValueError:
            continue
        published = published.replace(tzinfo=now.tzinfo) if published.tzinfo is None else published.astimezone(now.tzinfo)
        if not start <= published.date() <= end or published > now:
            continue
        eligible.append((published, {**source, "rank_reasons": [*(source.get("rank_reasons") or []), "recent_publication"]}))
    eligible.sort(key=lambda row: (row[0], float(row[1].get("score") or 0)), reverse=True)
    return [source for _, source in eligible]


def no_recent_news_answer(lang: str, window: tuple[date, date]) -> str:
    start, end = (value.isoformat() for value in window)
    if lang == "zh-Hans":
        return f"目前检索资料没有 {start} 至 {end} 的可确认消息。"
    if lang.startswith("zh"):
        return f"目前檢索資料沒有 {start} 至 {end} 的可確認消息。"
    if lang.startswith("ko"):
        return f"현재 검색 자료에서 {start}부터 {end}까지 확인 가능한 소식을 찾지 못했습니다."
    return f"The retrieved sources do not confirm any news published between {start} and {end}."
