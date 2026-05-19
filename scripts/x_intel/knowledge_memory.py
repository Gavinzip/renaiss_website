from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .bootstrap import (
    AI_REVIEW_ADMIN_QUEUE,
    StoryCard,
    clean_text,
    data_dir,
    extract_timeline_date,
    is_official_account_handle,
    normalize_event_facts,
    normalize_topic_labels,
    strip_links_mentions,
)
from .embedding_cache import (
    embedding_cache_key,
    ensure_embeddings_for_rows,
    prune_embedding_cache,
    semantic_text_for_row,
)


KNOWLEDGE_MEMORY_FILENAME = "x_intel_knowledge_memory.json"
KNOWLEDGE_MEMORY_VERSION = "20260518-knowledge-memory2"
DEFAULT_KNOWLEDGE_EMBEDDING_MODEL = "text-embedding-3-small"
DATE_ROLE_EVENT_START = "event_start"
DATE_ROLE_SCHEDULE_UPDATE = "schedule_update"
DATE_ROLE_REGISTRATION_OPEN = "registration_open"
DATE_ROLE_REGISTRATION_DEADLINE = "registration_deadline"
DATE_ROLE_RESULT_ANNOUNCEMENT = "result_announcement"
DATE_ROLE_PRODUCT_RELEASE = "product_release"
DATE_ROLE_FEATURE_LAUNCH = "feature_launch"
DATE_ROLE_PUBLISHED = "published_at"
DATE_ROLE_UNKNOWN = "unknown"

TIME_SIGNAL_RE = re.compile(
    r"(\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)|(\b\d{1,2}\s*(?:點|点|時|时)\b)|"
    r"(utc\s*[+-]\s*\d+)|(\b\d{1,2}:\d{2}\b)|今晚|today|tonight|直播|\blive\b|discord",
    re.I,
)
REGISTRATION_SIGNAL_RE = re.compile(r"報名|报名|申請|申请|application|apply|register|registration|sign\s*up|signup|entry", re.I)
REGISTRATION_DEADLINE_RE = re.compile(r"截止|締切|期限|deadline|until|by\s+\w+", re.I)
RESULT_SIGNAL_RE = re.compile(r"當選|当选|結果|结果|発表|發表|announcement|winner|抽選結果", re.I)
PRODUCT_RELEASE_RE = re.compile(r"發售|发售|発売|開賣|开卖|上市|release|pre[-\s]?order|予約|預約|预约", re.I)
FEATURE_LAUNCH_RE = re.compile(r"啟用|启用|上線|上线|launch|realm|channel|頻道|频道|功能|feature", re.I)
SCHEDULE_UPDATE_RE = re.compile(r"時間.*(?:調整|異動|更改|改至)|schedule\s+update|new\s+date|moving\s+the\s+session", re.I)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_openai_embedding_key() -> str:
    for name in ("INTEL_OPENAI_EMBEDDING_API_KEY", "OPENAI_EMBEDDING_API_KEY", "OPENAI_API_KEY"):
        value = str(os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def knowledge_embedding_model() -> str:
    return (
        str(
            os.getenv("INTEL_KNOWLEDGE_EMBEDDING_MODEL")
            or os.getenv("INTEL_DEDUPE_EMBED_MODEL")
            or DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
        ).strip()
        or DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
    )


def _parse_datetime(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    m = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", raw)
    if not m:
        return None
    try:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
    except Exception:
        return None


def _event_datetime_from_facts(card: StoryCard, *, base_dt: datetime | None = None) -> datetime | None:
    facts = normalize_event_facts(card.event_facts)
    schedule = str(facts.get("schedule") or "").strip()
    if not schedule:
        return None
    iso, _label = extract_timeline_date(schedule, base_dt=base_dt)
    return _parse_datetime(iso)


def memory_window_for_card(
    card: StoryCard,
    *,
    now: datetime | None = None,
    retention_days: int = 30,
) -> dict[str, Any]:
    """Return the card's knowledge-memory window.

    Events use the user-facing event date when available: event start - N days
    through event end + N days. Items without an event date use published_at + N
    days. The start timestamp is metadata; expiration only happens after
    expires_at so future events are not lost before their window starts.
    """
    now_dt = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    days = max(1, int(retention_days or 30))
    published_dt = _parse_datetime(card.published_at)
    event_start = _parse_datetime(card.timeline_date)
    event_end = _parse_datetime(card.timeline_end_date)
    if event_start is None:
        event_start = _event_datetime_from_facts(card, base_dt=published_dt or now_dt)
    if event_start is not None:
        if event_end is None or event_end < event_start:
            event_end = event_start
        start_at = event_start - timedelta(days=days)
        expires_at = event_end + timedelta(days=days)
        basis = "event_date"
        basis_at = event_start
    elif published_dt is not None:
        start_at = published_dt
        expires_at = published_dt + timedelta(days=days)
        basis = "published_at"
        basis_at = published_dt
    else:
        return {
            "basis": "unknown",
            "basis_at": "",
            "start_at": "",
            "expires_at": "",
            "active": True,
            "expired": False,
            "pre_window": False,
            "retention_days": days,
        }

    return {
        "basis": basis,
        "basis_at": basis_at.isoformat(),
        "start_at": start_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "active": start_at <= now_dt <= expires_at,
        "expired": now_dt > expires_at,
        "pre_window": now_dt < start_at,
        "retention_days": days,
    }


def _compact(text: Any, max_len: int) -> str:
    value = clean_text(str(text or ""))
    if len(value) <= max_len:
        return value
    return value[:max_len].rsplit(" ", 1)[0].strip() + "..."


def _card_text_blob(card: StoryCard) -> str:
    facts = normalize_event_facts(card.event_facts)
    parts: list[str] = [
        card.title,
        card.summary,
        card.detail_summary,
        card.raw_text,
        " ".join(card.bullets or []),
        " ".join(card.tags or []),
        " ".join(card.topic_labels or []),
        " ".join(facts.values()),
    ]
    return clean_text(" ".join(str(part or "") for part in parts))


def is_public_website_memory_card(card: StoryCard) -> tuple[bool, str]:
    """Return whether a card is eligible for public website knowledge memory."""
    cid = str(card.id or "").strip()
    if not cid:
        return False, "missing_id"
    if str(card.dedupe_status or "").strip().lower() == "dropped":
        return False, "dedupe_dropped"
    review_status = str(card.review_status or "").strip()
    ai_status = str(card.ai_status or "").strip().lower()
    if review_status == AI_REVIEW_ADMIN_QUEUE or ai_status in {"needs_review", "pending", "failed"}:
        return False, "not_public_review"
    labels = normalize_topic_labels(card.topic_labels)
    if labels == ["other"]:
        return False, "other_queue"
    return True, "public_site"


def infer_date_role(card: StoryCard) -> dict[str, str]:
    text = _card_text_blob(card)
    lower = text.lower()
    card_type = str(card.card_type or "").strip().lower()
    facts = normalize_event_facts(card.event_facts)
    schedule = str(facts.get("schedule") or "").strip()
    has_timeline = bool(str(card.timeline_date or "").strip())
    has_time_signal = bool(TIME_SIGNAL_RE.search(text))
    has_registration = bool(REGISTRATION_SIGNAL_RE.search(text))

    if SCHEDULE_UPDATE_RE.search(text):
        return {
            "role": DATE_ROLE_SCHEDULE_UPDATE,
            "source": "source_text",
            "confidence": "high" if has_time_signal else "medium",
            "reason": "schedule_update_text",
        }
    if FEATURE_LAUNCH_RE.search(text) and card_type != "event":
        return {
            "role": DATE_ROLE_FEATURE_LAUNCH,
            "source": "source_text",
            "confidence": "medium",
            "reason": "feature_launch_text",
        }
    if has_registration and REGISTRATION_DEADLINE_RE.search(text) and not re.search(r"無報名|无需報名|不需報名|no registration", lower, re.I):
        return {
            "role": DATE_ROLE_REGISTRATION_DEADLINE,
            "source": "source_text",
            "confidence": "high",
            "reason": "registration_deadline_text",
        }
    if has_registration and not has_time_signal:
        return {
            "role": DATE_ROLE_REGISTRATION_OPEN,
            "source": "source_text",
            "confidence": "high" if has_timeline else "medium",
            "reason": "registration_open_without_event_time",
        }
    if RESULT_SIGNAL_RE.search(text) and not (card_type == "event" and has_time_signal):
        return {
            "role": DATE_ROLE_RESULT_ANNOUNCEMENT,
            "source": "source_text",
            "confidence": "high",
            "reason": "result_announcement_text",
        }
    if PRODUCT_RELEASE_RE.search(text) and not (card_type == "event" and has_time_signal):
        return {
            "role": DATE_ROLE_PRODUCT_RELEASE,
            "source": "source_text",
            "confidence": "high",
            "reason": "product_release_text",
        }
    if card_type == "event" or schedule or has_time_signal:
        return {
            "role": DATE_ROLE_EVENT_START,
            "source": "event_facts" if schedule else "timeline_or_text",
            "confidence": "high" if has_time_signal or schedule else "medium",
            "reason": "event_start",
        }
    if has_timeline:
        return {
            "role": DATE_ROLE_PUBLISHED,
            "source": "timeline_date",
            "confidence": "low",
            "reason": "timeline_without_event_signal",
        }
    return {
        "role": DATE_ROLE_UNKNOWN,
        "source": "",
        "confidence": "low",
        "reason": "no_date_role_signal",
    }


def _normalized_topic_tokens(text: str) -> list[str]:
    raw = clean_text(text).lower()
    replacements = {
        "after graduation": "graduation",
        "graduation": "graduation",
        "13m": "13m",
        "pizza day": "pizza-day",
        "alpha redemption": "alpha-redemption",
        "binance academy": "binance-academy",
        "thailand realm": "thailand-realm",
        "one piece": "one-piece",
    }
    tokens: list[str] = []
    for phrase, token in replacements.items():
        if phrase in raw:
            tokens.append(token)
    cleaned = re.sub(r"https?://\S+", " ", raw)
    cleaned = re.sub(r"[@#]\w+", " ", cleaned)
    cleaned = re.sub(r"\b(?:202\d|20\d{2}|may|月|日|今晚|today|tonight|utc|pm|am)\b", " ", cleaned)
    cleaned = re.sub(r"[^a-z0-9\u4e00-\u9fff-]+", " ", cleaned)
    stop = {
        "renaiss", "official", "the", "and", "with", "from", "for", "new", "date",
        "今晚", "活動", "官方", "直播", "更新", "宣布", "報名", "開放", "活動時間異動",
    }
    for token in cleaned.split():
        token = token.strip("-")
        if len(token) < 3 or token in stop:
            continue
        tokens.append(token)
    out: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        out.append(token)
        if len(out) >= 4:
            break
    for dominant in ("graduation", "pizza-day", "alpha-redemption", "thailand-realm", "binance-academy"):
        if dominant in out:
            return [dominant]
    return out


def event_group_key_for_card(card: StoryCard, date_role: str = "") -> str:
    text = _card_text_blob(card)
    tokens = _normalized_topic_tokens(text)
    if not tokens:
        return ""
    date_part = str(card.timeline_date or "").strip()[:10]
    if not date_part:
        published = _parse_datetime(card.published_at)
        inferred_iso, _label = extract_timeline_date(text, base_dt=published)
        inferred = _parse_datetime(inferred_iso)
        date_part = inferred.date().isoformat() if inferred else ""
    if not date_part:
        published = _parse_datetime(card.published_at)
        date_part = published.date().isoformat() if published else ""
    role = str(date_role or infer_date_role(card).get("role") or "").strip()
    if role in {DATE_ROLE_EVENT_START, DATE_ROLE_SCHEDULE_UPDATE}:
        role_part = "event"
    elif role:
        role_part = role
    else:
        role_part = "memory"
    return ":".join(part for part in [role_part, date_part, "-".join(tokens[:3])] if part)


def _canonical_priority(card: StoryCard) -> float:
    score = float(card.importance or 0.0)
    if card.manual_pin:
        score += 120.0
    if card.manual_pick:
        score += 100.0
    if card.manual_bottom:
        score += 60.0
    if is_official_account_handle(card.account):
        score += 80.0
    if str(card.provider or "").strip().lower() in {"twitter-cli", "tweet-result", "r.jina.ai"}:
        score += 6.0
    if card.timeline_date:
        score += 8.0
    if normalize_event_facts(card.event_facts):
        score += 4.0
    if card.cover_image:
        score += 2.0
    return round(score, 3)


def _knowledge_item(card: StoryCard, window: dict[str, Any], *, embedding_model: str) -> dict[str, Any]:
    raw_hint = strip_links_mentions(card.raw_text or card.detail_summary or card.summary or card.title)
    visible, visible_reason = is_public_website_memory_card(card)
    date_role = infer_date_role(card)
    event_group_key = event_group_key_for_card(card, str(date_role.get("role") or ""))
    row = {
        "id": str(card.id or ""),
        "account": str(card.account or ""),
        "url": str(card.url or ""),
        "title": _compact(card.title, 180),
        "summary": _compact(card.summary, 360),
        "detail_summary": _compact(card.detail_summary, 600),
        "raw_hint": _compact(raw_hint, 900),
        "card_type": str(card.card_type or ""),
        "topic_labels": list(card.topic_labels or []),
        "tags": list(card.tags or []),
        "published_at": str(card.published_at or ""),
        "timeline_date": str(card.timeline_date or ""),
        "timeline_end_date": str(card.timeline_end_date or ""),
        "event_facts": normalize_event_facts(card.event_facts),
        "date_role": str(date_role.get("role") or DATE_ROLE_UNKNOWN),
        "date_role_source": str(date_role.get("source") or ""),
        "date_role_confidence": str(date_role.get("confidence") or ""),
        "date_role_reason": str(date_role.get("reason") or ""),
        "event_group_key": event_group_key,
        "memory_visibility": "public_site" if visible else "hidden",
        "memory_visibility_reason": visible_reason,
        "review_status": str(card.review_status or ""),
        "ai_status": str(card.ai_status or ""),
        "dedupe_status": str(card.dedupe_status or ""),
        "manual_pick": bool(card.manual_pick),
        "manual_pin": bool(card.manual_pin),
        "manual_bottom": bool(card.manual_bottom),
        "source_provider": str(card.provider or ""),
        "canonical_priority": _canonical_priority(card),
        "memory_basis": str(window.get("basis") or ""),
        "memory_basis_at": str(window.get("basis_at") or ""),
        "memory_start_at": str(window.get("start_at") or ""),
        "memory_expires_at": str(window.get("expires_at") or ""),
        "memory_active": bool(window.get("active") is True),
        "memory_pre_window": bool(window.get("pre_window") is True),
    }
    semantic_text = semantic_text_for_row(row)
    row["semantic_text"] = semantic_text
    row["embedding_model"] = embedding_model
    row["embedding_key"] = embedding_cache_key(embedding_model, semantic_text) if semantic_text else ""
    row["embedding_store"] = "x_intel_embedding_cache.json"
    row["embedding_ready"] = False
    return row


def knowledge_row_for_card(
    card: StoryCard,
    *,
    embedding_model: str | None = None,
    now: datetime | None = None,
    retention_days: int = 30,
) -> dict[str, Any]:
    model = str(embedding_model or knowledge_embedding_model()).strip() or DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
    window = memory_window_for_card(card, now=now, retention_days=retention_days)
    return _knowledge_item(card, window, embedding_model=model)


def knowledge_memory_path() -> Path:
    return data_dir() / KNOWLEDGE_MEMORY_FILENAME


def write_knowledge_memory(
    public_cards: list[StoryCard],
    *,
    force_ids: set[str] | None = None,
    now: datetime | None = None,
    retention_days: int = 30,
    embedding_model: str | None = None,
) -> dict[str, Any]:
    """Write public website knowledge memory.

    Visibility is the hard gate. Manual pins or force ids may keep an already
    public card beyond the expiration window, but they must not move hidden
    review/admin cards into knowledge memory.
    """
    now_dt = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    forced = {str(x).strip() for x in (force_ids or set()) if str(x).strip()}
    model = str(embedding_model or knowledge_embedding_model()).strip() or DEFAULT_KNOWLEDGE_EMBEDDING_MODEL
    items: list[dict[str, Any]] = []
    expired_skipped = 0
    forced_expired_kept = 0
    pre_window_count = 0
    hidden_skipped = 0
    hidden_skip_reasons: dict[str, int] = {}

    for card in public_cards:
        cid = str(card.id or "").strip()
        visible, visible_reason = is_public_website_memory_card(card)
        if not visible:
            hidden_skipped += 1
            hidden_skip_reasons[visible_reason] = hidden_skip_reasons.get(visible_reason, 0) + 1
            continue
        is_forced = cid in forced or bool(card.manual_pick or card.manual_pin or card.manual_bottom)
        window = memory_window_for_card(card, now=now_dt, retention_days=retention_days)
        if bool(window.get("expired")) and not is_forced:
            expired_skipped += 1
            continue
        if bool(window.get("expired")) and is_forced:
            forced_expired_kept += 1
        if bool(window.get("pre_window")):
            pre_window_count += 1
        items.append(_knowledge_item(card, window, embedding_model=model))

    items.sort(
        key=lambda item: (
            float(item.get("canonical_priority") or 0.0),
            str(item.get("published_at") or ""),
            str(item.get("id") or ""),
        ),
        reverse=True,
    )
    valid_embedding_keys = {
        str(item.get("embedding_key") or "").strip()
        for item in items
        if str(item.get("embedding_key") or "").strip()
    }
    api_key = resolve_openai_embedding_key()
    embedding_stats: dict[str, Any]
    if api_key and items:
        try:
            vectors_by_id, ensure_stats = ensure_embeddings_for_rows(
                items,
                api_key=api_key,
                model=model,
                timeout_seconds=int(os.getenv("INTEL_KNOWLEDGE_EMBEDDING_TIMEOUT_SECONDS") or "80"),
                batch_size=int(os.getenv("INTEL_KNOWLEDGE_EMBEDDING_BATCH_SIZE") or "40"),
            )
            ready_ids = {str(sid) for sid, row in vectors_by_id.items() if isinstance(row.get("vector"), list) and row.get("vector")}
            for item in items:
                item["embedding_ready"] = str(item.get("id") or "") in ready_ids
            prune_stats = prune_embedding_cache(valid_embedding_keys)
            embedding_stats = {
                "embedding_status": "ready",
                "embedding_ready_count": len(ready_ids),
                **ensure_stats,
                **prune_stats,
            }
        except Exception as exc:
            prune_stats = prune_embedding_cache(valid_embedding_keys)
            embedding_stats = {
                "embedding_status": "failed",
                "embedding_error": clean_text(str(exc))[:220],
                "embedding_ready_count": 0,
                **prune_stats,
            }
    else:
        prune_stats = prune_embedding_cache(valid_embedding_keys)
        embedding_stats = {
            "embedding_status": "missing_api_key" if items else "empty",
            "embedding_ready_count": 0,
            **prune_stats,
        }
    payload = {
        "version": KNOWLEDGE_MEMORY_VERSION,
        "generated_at": _now_iso(),
        "retention_days": int(retention_days),
        "embedding_model": model,
        "memory_policy": {
            "visibility": "public_website_only",
            "visibility_rule": "cards hidden in admin_queue, needs_review/pending/failed AI states, dropped dedupe, or other-only queue are excluded before embeddings are generated",
            "retention_rule": "event dated cards keep memory from event_start - retention_days through event_end + retention_days; undated cards expire retention_days after published_at",
            "manual_rule": "manual pin/pick can keep an already public card past expiration, but cannot put hidden review cards into memory",
            "date_role_rule": "event_start and schedule_update are live event timing; registration_open, registration_deadline, product_release, feature_launch, and result_announcement are action dates, not live events",
        },
        "total_items": len(items),
        "items": items,
        "stats": {
            "input_total": len(public_cards),
            "public_site_input_total": len(public_cards) - hidden_skipped,
            "hidden_skipped": hidden_skipped,
            "hidden_skip_reasons": hidden_skip_reasons,
            "expired_skipped": expired_skipped,
            "forced_expired_kept": forced_expired_kept,
            "pre_window_count": pre_window_count,
            **embedding_stats,
        },
    }
    path = knowledge_memory_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "version": payload["version"],
        "path": str(path),
        "retention_days": int(retention_days),
        "item_total": len(items),
        "hidden_skipped": hidden_skipped,
        "hidden_skip_reasons": hidden_skip_reasons,
        "expired_skipped": expired_skipped,
        "forced_expired_kept": forced_expired_kept,
        "pre_window_count": pre_window_count,
        **embedding_stats,
    }
