from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from pathlib import Path
import re
from typing import Any
from zoneinfo import ZoneInfo

from .bootstrap import clean_text, data_dir, resolve_minimax_key
from .embedding_cache import create_embedding_vector, embedding_cosine_similarity
from .knowledge_memory import knowledge_embedding_model, knowledge_memory_path, resolve_openai_embedding_key
from .sources import minimax_chat, minimax_model_name


EMBED_CACHE_FILENAME = "x_intel_embedding_cache.json"
LOCAL_TZ = ZoneInfo("Asia/Taipei")
EVENT_START_DATE_ROLES = {"event_start", "schedule_update"}
ACTION_DATE_ROLES = {
    "registration_open",
    "registration_deadline",
    "result_announcement",
    "product_release",
    "feature_launch",
}
MONTH_NAME_TO_NUMBER = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_local() -> datetime:
    return datetime.now(LOCAL_TZ)


def _agent_model() -> str:
    return str(os.getenv("INTEL_AGENT_MINIMAX_MODEL") or minimax_model_name()).strip() or minimax_model_name()


def _agent_temperature() -> float:
    raw = str(os.getenv("INTEL_AGENT_TEMPERATURE") or "0.2").strip()
    try:
        value = float(raw)
    except Exception:
        value = 0.2
    return max(0.0, min(value, 1.0))


def _float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name) or default)
    except Exception:
        value = default
    return value if value > 0 else default


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name) or default)
    except Exception:
        value = default
    return value if value > 0 else default


def _optional_int_env(name: str) -> int | None:
    raw = str(os.getenv(name) or "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except Exception:
        return None
    return value if value > 0 else None


def _embedding_cache_path() -> Path:
    return data_dir() / EMBED_CACHE_FILENAME


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _load_memory_items() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = _load_json(knowledge_memory_path(), {})
    if not isinstance(payload, dict):
        return [], {}
    rows = payload.get("items")
    items = [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []
    stats = payload.get("stats") if isinstance(payload.get("stats"), dict) else {}
    meta = {
        "version": str(payload.get("version") or ""),
        "generated_at": str(payload.get("generated_at") or ""),
        "retention_days": int(payload.get("retention_days") or 0),
        "embedding_model": str(payload.get("embedding_model") or knowledge_embedding_model()),
        "stats": stats,
    }
    return items, meta


def _load_vector_cache() -> dict[str, list[float]]:
    payload = _load_json(_embedding_cache_path(), {})
    entries = payload.get("entries") if isinstance(payload, dict) else {}
    if not isinstance(entries, dict):
        return {}
    vectors: dict[str, list[float]] = {}
    for key, row in entries.items():
        if not isinstance(row, dict):
            continue
        vector = row.get("vector")
        if not isinstance(vector, list) or not vector:
            continue
        try:
            vectors[str(key)] = [float(x) for x in vector]
        except Exception:
            continue
    return vectors


def _compact(value: Any, limit: int = 320) -> str:
    text = clean_text(str(value or ""))
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].strip() + "..."


def _parse_datetime(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return datetime.fromisoformat(raw).replace(tzinfo=LOCAL_TZ)
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _item_blob(item: dict[str, Any]) -> str:
    parts = [
        item.get("title"),
        item.get("summary"),
        item.get("detail_summary"),
        item.get("raw_hint"),
        item.get("semantic_text"),
        " ".join(str(x) for x in (item.get("topic_labels") or []) if x),
        " ".join(str(x) for x in (item.get("tags") or []) if x),
    ]
    facts = item.get("event_facts")
    if isinstance(facts, dict):
        parts.extend(facts.values())
    return clean_text(" ".join(str(part or "") for part in parts)).lower()


def _extract_text_date(item: dict[str, Any], now: datetime) -> datetime | None:
    text = _item_blob(item)
    year = now.year
    published = _parse_datetime(item.get("published_at"))
    if published:
        year = published.astimezone(LOCAL_TZ).year
    for match in re.finditer(r"(?<!\d)(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*(?:日|号)?", text):
        month, day = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12 and 1 <= day <= 31:
            try:
                return datetime(year, month, day, tzinfo=LOCAL_TZ)
            except Exception:
                continue
    for match in re.finditer(r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b", text):
        month = MONTH_NAME_TO_NUMBER.get(match.group(1).lower())
        day = int(match.group(2))
        if month:
            try:
                return datetime(year, month, day, tzinfo=LOCAL_TZ)
            except Exception:
                continue
    return None


def _extract_question_dates(question: str, now: datetime) -> set[date]:
    text = clean_text(question).lower()
    dates: set[date] = set()
    year = now.year
    for match in re.finditer(r"(?<!\d)(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*(?:日|号)?", text):
        month, day = int(match.group(1)), int(match.group(2))
        if 1 <= month <= 12 and 1 <= day <= 31:
            try:
                dates.add(date(year, month, day))
            except Exception:
                continue
    for match in re.finditer(r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b", text):
        month = MONTH_NAME_TO_NUMBER.get(match.group(1).lower())
        day = int(match.group(2))
        if month:
            try:
                dates.add(date(year, month, day))
            except Exception:
                continue
    return dates


def _effective_event_datetime(item: dict[str, Any], now: datetime) -> datetime | None:
    parsed = _parse_datetime(item.get("timeline_date"))
    if parsed:
        return parsed.astimezone(LOCAL_TZ)
    inferred = _extract_text_date(item, now)
    if inferred:
        return inferred
    if str(item.get("memory_basis") or "") == "event_date":
        parsed = _parse_datetime(item.get("memory_basis_at"))
        if parsed:
            return parsed.astimezone(LOCAL_TZ)
    return None


def _question_intent(question: str) -> dict[str, bool]:
    q = clean_text(question).lower()
    event_terms = (
        "活動", "直播", "ama", "space", "event", "party", "聚會", "報名", "參加",
        "participate", "join", "campfire", "plaza", "graduation",
    )
    near_terms = (
        "等等", "等一下", "今晚", "今天", "今日", "等會", "接下來", "最近", "本週",
        "this week", "today", "tonight", "upcoming", "later",
    )
    immediate_terms = (
        "等等", "等一下", "今晚", "今天晚上", "等會", "等会", "later today", "tonight",
    )
    official_terms = ("官方", "official", "renaiss", "公告")
    sbt_terms = ("sbt", "徽章", "領取", "取得", "unlock", "badge")
    registration_terms = ("報名", "报名", "申請", "申请", "register", "registration", "sign up", "signup")
    return {
        "event": any(term in q for term in event_terms),
        "near": any(term in q for term in near_terms),
        "immediate": any(term in q for term in immediate_terms),
        "official": any(term in q for term in official_terms),
        "sbt": any(term in q for term in sbt_terms),
        "registration": any(term in q for term in registration_terms),
    }


def _score_memory_item(base_score: float, item: dict[str, Any], question: str, now: datetime) -> tuple[float, list[str]]:
    intent = _question_intent(question)
    labels = {str(x).lower() for x in (item.get("topic_labels") or []) if x}
    tags = {str(x).lower() for x in (item.get("tags") or []) if x}
    card_type = str(item.get("card_type") or "").lower()
    account = str(item.get("account") or "").lower()
    date_role = str(item.get("date_role") or "").strip().lower()
    blob = _item_blob(item)
    score = float(base_score or 0.0)
    reasons: list[str] = []

    if intent["event"]:
        if card_type == "event":
            score += 0.13
            reasons.append("event_card")
        if "events" in labels or "events" in tags:
            score += 0.1
            reasons.append("event_label")
        if any(term in blob for term in ("直播", "ama", "discord", "plaza", "graduation", "tonight")):
            score += 0.06
            reasons.append("event_text")

    if intent["official"]:
        if account == "renaissxyz":
            score += 0.1
            reasons.append("official_x")
        if "official" in labels or "official" in tags:
            score += 0.08
            reasons.append("official_label")

    if intent["sbt"] and ("sbt" in labels or "sbt" in tags or "sbt" in blob):
        score += 0.12
        reasons.append("sbt_match")

    event_dt = _effective_event_datetime(item, now)
    question_dates = _extract_question_dates(question, now)
    if question_dates and event_dt:
        if event_dt.date() in question_dates:
            if intent["registration"] and date_role in {"registration_open", "registration_deadline"}:
                score += 0.5
                reasons.append("queried_registration_date")
            elif intent["event"] and date_role in EVENT_START_DATE_ROLES:
                score += 0.48
                reasons.append("queried_event_date")
            elif date_role in ACTION_DATE_ROLES:
                score += 0.1
                reasons.append(f"queried_{date_role}")
            else:
                score += 0.14
                reasons.append("queried_date")
        elif intent["event"] and not intent["registration"] and date_role in EVENT_START_DATE_ROLES:
            score -= 0.22
            reasons.append("different_event_date")
    if intent["near"] and event_dt:
        days = (event_dt.date() - now.date()).days
        if date_role in EVENT_START_DATE_ROLES and days == 0:
            score += 0.24
            reasons.append("today_event")
        elif date_role in EVENT_START_DATE_ROLES and 0 < days <= 3:
            score += 0.16
            reasons.append("upcoming_event")
        elif date_role in EVENT_START_DATE_ROLES and -1 <= days < 0:
            score += 0.04
            reasons.append("recent_event")
        elif date_role in ACTION_DATE_ROLES and days == 0:
            score += 0.03
            reasons.append(f"today_{date_role}")
        elif days < -1:
            score -= 0.36
            reasons.append("older_event")

    event_days = (event_dt.date() - now.date()).days if event_dt else None
    published_dt = _parse_datetime(item.get("published_at"))
    published_days = (published_dt.astimezone(LOCAL_TZ).date() - now.date()).days if published_dt else None
    event_start_is_current = date_role in EVENT_START_DATE_ROLES and (
        event_days is not None and event_days >= -1
    )
    near_time_is_current = event_start_is_current or (
        event_days is None and published_days is not None and -1 <= published_days <= 0
    )
    if (
        intent["near"]
        and near_time_is_current
        and any(term in blob for term in ("今晚", "today", "tonight", "10 pm", "10pm", "10点", "22:00"))
    ):
        score += 0.08
        reasons.append("near_time_text")

    if intent["near"] and event_start_is_current and any(term in blob for term in ("直播", "discord", "live", "10 pm", "10pm", "22:00")):
        score += 0.08
        reasons.append("live_time_match")

    if intent["event"] and account == "renaissxyz":
        score += 0.07
        reasons.append("event_official_priority")

    if intent["near"] and intent["event"] and account == "renaissxyz" and date_role in EVENT_START_DATE_ROLES and event_days == 0:
        score += 0.08
        reasons.append("today_official_event")

    return score, reasons


def _source_from_item(
    item: dict[str, Any],
    score: float,
    *,
    semantic_score: float | None = None,
    rank_reasons: list[str] | None = None,
) -> dict[str, Any]:
    now = _now_local()
    event_dt = _effective_event_datetime(item, now)
    facts = item.get("event_facts") if isinstance(item.get("event_facts"), dict) else {}
    return {
        "id": str(item.get("id") or ""),
        "account": str(item.get("account") or ""),
        "url": str(item.get("url") or ""),
        "title": _compact(item.get("title"), 140),
        "summary": _compact(item.get("summary"), 240),
        "detail_summary": _compact(item.get("detail_summary"), 700),
        "raw_hint": _compact(item.get("raw_hint"), 600),
        "card_type": str(item.get("card_type") or ""),
        "topic_labels": [str(x) for x in (item.get("topic_labels") or []) if x],
        "tags": [str(x) for x in (item.get("tags") or []) if x],
        "event_facts": {str(k): _compact(v, 220) for k, v in facts.items() if str(v or "").strip()},
        "date_role": str(item.get("date_role") or ""),
        "date_role_source": str(item.get("date_role_source") or ""),
        "date_role_confidence": str(item.get("date_role_confidence") or ""),
        "date_role_reason": str(item.get("date_role_reason") or ""),
        "event_group_key": str(item.get("event_group_key") or ""),
        "memory_visibility": str(item.get("memory_visibility") or ""),
        "published_at": str(item.get("published_at") or ""),
        "timeline_date": str(item.get("timeline_date") or ""),
        "timeline_end_date": str(item.get("timeline_end_date") or ""),
        "effective_event_date": event_dt.isoformat() if event_dt else "",
        "memory_expires_at": str(item.get("memory_expires_at") or ""),
        "score": round(float(score or 0.0), 4),
        "semantic_score": round(float(semantic_score if semantic_score is not None else score or 0.0), 4),
        "rank_reasons": rank_reasons or [],
    }


def _context_line(source: dict[str, Any], index: int) -> str:
    parts = [
        f"[{index}] @{source.get('account') or 'source'}",
        f"type={source.get('card_type') or ''}",
        f"date_role={source.get('date_role') or ''}",
        f"event_group={source.get('event_group_key') or ''}",
        f"labels={','.join(source.get('topic_labels') or [])}",
        f"title={source.get('title') or ''}",
        f"summary={source.get('summary') or ''}",
        f"detail={source.get('detail_summary') or ''}",
        f"raw_hint={source.get('raw_hint') or ''}",
        f"event_facts={json.dumps(source.get('event_facts') or {}, ensure_ascii=False)}",
        f"published_at={source.get('published_at') or ''}",
        f"event_date={source.get('timeline_date') or ''}",
        f"effective_event_date={source.get('effective_event_date') or ''}",
        f"rank_reason={','.join(source.get('rank_reasons') or [])}",
        f"url={source.get('url') or ''}",
    ]
    return " | ".join(parts)


def _event_days(source: dict[str, Any], now: datetime) -> int | None:
    dt = _parse_datetime(source.get("effective_event_date") or source.get("timeline_date") or "")
    if not dt:
        return None
    return (dt.astimezone(LOCAL_TZ).date() - now.date()).days


def _filter_sources_for_intent(sources: list[dict[str, Any]], question: str) -> list[dict[str, Any]]:
    intent = _question_intent(question)
    if not sources or not intent.get("event"):
        return sources
    now = _now_local()
    question_dates = _extract_question_dates(question, now)
    if question_dates and intent.get("registration"):
        q = clean_text(question).lower()
        asks_for_list = any(term in q for term in ("哪些", "有什麼", "有什么", "有哪些", "全部", "list", "what registrations"))
        exact_registration_sources = [
            source for source in sources
            if str(source.get("date_role") or "").strip().lower() in {"registration_open", "registration_deadline"}
            and (
                (dt := _parse_datetime(source.get("effective_event_date") or source.get("timeline_date") or ""))
                and dt.astimezone(LOCAL_TZ).date() in question_dates
            )
        ]
        if exact_registration_sources:
            primary_registration_sources = exact_registration_sources if asks_for_list else exact_registration_sources[:1]
            exact_groups = {
                str(source.get("event_group_key") or "").strip()
                for source in primary_registration_sources
                if str(source.get("event_group_key") or "").strip()
            }
            related = [
                source for source in sources
                if source not in primary_registration_sources
                and str(source.get("event_group_key") or "").strip() in exact_groups
            ]
            return _dedupe_sources([*primary_registration_sources, *related]) or sources
    if question_dates and not intent.get("registration"):
        exact_date_sources = [
            source for source in sources
            if str(source.get("date_role") or "").strip().lower() in EVENT_START_DATE_ROLES
            and (
                (dt := _parse_datetime(source.get("effective_event_date") or source.get("timeline_date") or ""))
                and dt.astimezone(LOCAL_TZ).date() in question_dates
            )
        ]
        if exact_date_sources:
            exact_groups = {
                str(source.get("event_group_key") or "").strip()
                for source in exact_date_sources
                if str(source.get("event_group_key") or "").strip()
            }
            related = [
                source for source in sources
                if source not in exact_date_sources
                and str(source.get("event_group_key") or "").strip() in exact_groups
            ]
            return _dedupe_sources([*exact_date_sources, *related]) or sources
    if not intent.get("immediate"):
        return sources
    primary: list[dict[str, Any]] = []
    primary_groups: set[str] = set()
    for source in sources:
        role = str(source.get("date_role") or "").strip().lower()
        days = _event_days(source, now)
        if role in EVENT_START_DATE_ROLES and days == 0:
            primary.append(source)
            group_key = str(source.get("event_group_key") or "").strip()
            if group_key:
                primary_groups.add(group_key)
    if not primary:
        return sources
    merged_related = [
        source for source in sources
        if source not in primary and str(source.get("event_group_key") or "").strip() in primary_groups
    ]
    return _dedupe_sources([*primary, *merged_related]) or sources


def _dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for source in sources:
        sid = str(source.get("id") or "").strip()
        if sid and sid in seen:
            continue
        if sid:
            seen.add(sid)
        deduped.append(source)
    return deduped


def _sanitize_history(history: Any, limit: int = 8) -> list[dict[str, str]]:
    rows = history if isinstance(history, list) else []
    cleaned: list[dict[str, str]] = []
    for row in rows[-limit:]:
        if not isinstance(row, dict):
            continue
        role = str(row.get("role") or "").strip().lower()
        if role not in {"user", "assistant"}:
            continue
        content = clean_text(str(row.get("content") or ""))[:700]
        if not content:
            continue
        cleaned.append({"role": role, "content": content})
    return cleaned


def _history_lines(history: list[dict[str, str]]) -> str:
    if not history:
        return ""
    return "\n".join(
        f"- {row['role']}: {row['content']}"
        for row in history
    )


def _retrieval_query(question: str, history: list[dict[str, str]]) -> str:
    user_context = [row["content"] for row in history[-5:] if row.get("role") == "user"]
    return clean_text("\n".join([*user_context, question]))[:2400]


def _answer_with_minimax(
    *,
    question: str,
    history: list[dict[str, str]],
    sources: list[dict[str, Any]],
    api_key: str,
    lang: str,
) -> tuple[str, dict[str, Any]]:
    model = _agent_model()
    context = "\n".join(_context_line(source, idx + 1) for idx, source in enumerate(sources))
    conversation = _history_lines(history)
    instruction = (
        "You are Renaiss Agent. Answer only from the supplied Renaiss knowledge memory. "
        "If the memory is insufficient, say that the current memory does not contain enough evidence. "
        "Do not invent dates, rewards, prices, or official status. "
        "When the user asks about today, tonight, later, or upcoming events, prioritize sources marked today_event, upcoming_event, official_x, event_card, or near_time_text. "
        "date_role is strict: event_start and schedule_update can be treated as events happening at that time; registration_open, product_release, feature_launch, and result_announcement are not live events. "
        "Sources with the same event_group are one event, not multiple events; use the extra source only to fill missing time, venue, or channel. "
        "Start with the direct answer first, then give the key details: time/date, place/channel, why it matters, and what to do next. "
        "Do not dump raw retrieved memory fields. Synthesize them into a useful answer. "
        "Keep the answer concise and operational. "
        "Cite source numbers like [1] when making concrete claims. "
        "Output the final answer only; do not include analysis, reasoning notes, or preambles."
    )
    if str(lang).lower().startswith("zh"):
        instruction += " Reply in Traditional Chinese unless the user asks otherwise."
    elif str(lang).lower().startswith("ko"):
        instruction += " Reply in Korean unless the user asks otherwise."
    else:
        instruction += " Reply in English unless the user asks otherwise."
    prompt = (
        f"{instruction}\n\n"
        f"Current UTC time: {_now_iso()}\n"
        f"Current Taipei time: {_now_local().isoformat()}\n"
        f"Recent conversation:\n{conversation or '(none)'}\n\n"
        f"Question: {question}\n\n"
        f"Knowledge memory sources:\n{context}"
    )
    answer = minimax_chat(
        prompt,
        api_key,
        max_tokens=_optional_int_env("INTEL_AGENT_MAX_TOKENS"),
        connect_timeout_override=_float_env("INTEL_AGENT_MINIMAX_CONNECT_TIMEOUT_SECONDS", 15.0),
        read_timeout_override=_float_env("INTEL_AGENT_MINIMAX_READ_TIMEOUT_SECONDS", 80.0),
        model_override=model,
        temperature_override=_agent_temperature(),
        use_env_max_tokens=False,
    )
    if not answer:
        raise RuntimeError("agent_empty_response")
    return answer, {
        "provider": "minimax",
        "model": model,
    }


def answer_knowledge_question(question: str, *, lang: str = "zh-Hant", top_k: int = 6, history: Any = None) -> dict[str, Any]:
    cleaned_question = clean_text(str(question or ""))[:1200]
    if not cleaned_question:
        raise ValueError("question is required")
    cleaned_history = _sanitize_history(history)
    embedding_api_key = resolve_openai_embedding_key()
    if not embedding_api_key:
        raise RuntimeError("missing_openai_api_key")

    items, memory_meta = _load_memory_items()
    if not items:
        raise RuntimeError("knowledge_memory_empty")
    vector_cache = _load_vector_cache()
    if not vector_cache:
        raise RuntimeError("embedding_cache_empty")

    embedding_model = str(memory_meta.get("embedding_model") or knowledge_embedding_model())
    query_vector = create_embedding_vector(
        _retrieval_query(cleaned_question, cleaned_history),
        api_key=embedding_api_key,
        model=embedding_model,
        timeout_seconds=_int_env("INTEL_AGENT_EMBEDDING_TIMEOUT_SECONDS", 45),
    )

    now = _now_local()
    scored: list[tuple[float, float, list[str], dict[str, Any]]] = []
    for item in items:
        key = str(item.get("embedding_key") or "").strip()
        if not key:
            continue
        vector = vector_cache.get(key)
        if not vector:
            continue
        semantic_score = embedding_cosine_similarity(query_vector, vector)
        score, reasons = _score_memory_item(semantic_score, item, cleaned_question, now)
        scored.append((score, semantic_score, reasons, item))
    scored.sort(key=lambda row: row[0], reverse=True)
    safe_top_k = max(1, min(int(top_k or 6), 10))
    sources = [
        _source_from_item(item, score, semantic_score=semantic_score, rank_reasons=reasons)
        for score, semantic_score, reasons, item in scored[:safe_top_k]
        if score > 0
    ]
    if not sources:
        raise RuntimeError("no_vector_matches")

    min_score = float(os.getenv("INTEL_AGENT_MIN_SOURCE_SCORE") or "0.18")
    credible_sources = [source for source in sources if float(source.get("score") or 0.0) >= min_score]
    credible_sources = _filter_sources_for_intent(credible_sources, cleaned_question)
    if not credible_sources:
        return {
            "answer": "目前記憶庫裡沒有足夠接近的資料可以回答這個問題。",
            "sources": sources[:3],
            "mode": "no_relevant_memory",
            "stats": {
                "memory_items": len(items),
                "vector_items": len(vector_cache),
                "embedding_model": embedding_model,
                "top_score": sources[0].get("score") if sources else 0,
                "top_semantic_score": sources[0].get("semantic_score") if sources else 0,
            },
        }

    answer_api_key = resolve_minimax_key()
    if not answer_api_key:
        raise RuntimeError("missing_minimax_api_key")

    answer, chat_meta = _answer_with_minimax(
        question=cleaned_question,
        history=cleaned_history,
        sources=credible_sources,
        api_key=answer_api_key,
        lang=lang,
    )
    return {
        "answer": answer,
        "sources": credible_sources,
        "mode": "rag",
        "stats": {
            "memory_items": len(items),
            "vector_items": len(vector_cache),
            "embedding_model": embedding_model,
            "agent_provider": chat_meta.get("provider"),
            "agent_model": chat_meta.get("model"),
            "top_score": credible_sources[0].get("score") if credible_sources else 0,
            "top_semantic_score": credible_sources[0].get("semantic_score") if credible_sources else 0,
            "source_count": len(credible_sources),
            "history_turns": len(cleaned_history),
            "memory_version": memory_meta.get("version"),
            "memory_generated_at": memory_meta.get("generated_at"),
        },
    }
