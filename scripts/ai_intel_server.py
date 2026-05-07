#!/usr/bin/env python3
"""Local server for website + AI intel ingest API."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import time
from http.cookies import SimpleCookie
from datetime import timedelta
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread
from urllib.parse import parse_qs
from urllib.parse import unquote
from urllib.parse import urlparse
from uuid import uuid4

from minimax_news import fetch_pokemon_latest_news, translate_pokemon_news_payload
from x_intel_core import ALLOWED_CARD_TYPES, ALLOWED_TOPIC_LABELS, add_classification_feedback, add_classification_feedback_fields, add_manual_tweet, feedback_memory_stats, load_environment, read_x_source_config, set_manual_selection, sync_accounts, update_card_classification_fields, update_card_event_wall_field, update_card_sbt_fields, update_card_timeline_fields, update_x_source_accounts
from website_backup import get_website_backup_status, restore_website_data_from_backup, run_website_backup, start_website_backup_scheduler
from website_storage import get_website_data_dir, setup_website_storage
from website_i18n_runtime import build_i18n_feed_bundle_async, configure_i18n_runtime, i18n_state_snapshot, localized_feed_from_bundle, queue_i18n_retranslate, translate_texts

ROOT = Path(__file__).resolve().parents[1]


def _resolve_static_root() -> Path:
    raw = str(os.getenv("WEBSITE_STATIC_ROOT", "website") or "website").strip()
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    try:
        resolved = candidate.resolve()
    except Exception:
        resolved = candidate
    if resolved.exists() and resolved.is_dir():
        return resolved
    return ROOT / "website"


# Ensure project/website .env is loaded before storage/auth/env constants are resolved.
load_environment()
STATIC_ROOT = _resolve_static_root()
DATA_ROOT = get_website_data_dir(ROOT)
RESTORE_STATE = restore_website_data_from_backup(DATA_ROOT, ROOT.parent)
STORAGE_STATE = setup_website_storage(ROOT)

FEED_PATH = DATA_ROOT / "x_intel_feed.json"
I18N_FEED_PATH = DATA_ROOT / "x_intel_feed_i18n.json"
JOBS_PATH = DATA_ROOT / "x_intel_jobs.json"
POKEMON_NEWS_CACHE_PATH = DATA_ROOT / "pokemon_latest_news.json"
POKEMON_NEWS_CANONICAL_LANG = "zh-Hant"
configure_i18n_runtime(DATA_ROOT, FEED_PATH)
JOBS_LOCK = Lock()
POKEMON_NEWS_LOCK = Lock()
POKEMON_NEWS_STATE_LOCK = Lock()
SESSIONS_LOCK = Lock()
SYNC_STATE_LOCK = Lock()
BACKUP_STATE_LOCK = Lock()
SESSIONS: dict[str, dict[str, str]] = {}
SYNC_STATE: dict[str, object] = {
    "status": "idle",
    "started_at": "",
    "finished_at": "",
    "last_success_at": "",
    "last_error": "",
    "trigger": "",
    "duration_ms": 0,
    "schedule_enabled": False,
    "schedule_interval_hours": 0.5,
    "schedule_window_days": 30,
    "next_run_at": "",
    "last_scheduled_at": "",
}
BACKUP_STATE: dict[str, object] = {
    "status": "idle",
    "started_at": "",
    "finished_at": "",
    "last_success_at": "",
    "last_error": "",
    "trigger": "",
    "duration_ms": 0,
    "changed": False,
    "skipped": False,
    "reason": "",
}
MAX_JOB_ITEMS = 120
POKEMON_NEWS_CACHE_MINUTES = 50
DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES = 60
DEFAULT_POKEMON_NEWS_MAX_ITEMS = 8
DEFAULT_X_SYNC_INTERVAL_HOURS = 0.5
DEFAULT_X_SYNC_WINDOW_DAYS = 30
I18N_BASE_LANG = "zh-Hant"
I18N_MONITOR_LANGS = ["zh-Hant", "zh-Hans", "en", "ko"]
POKEMON_NEWS_STATE: dict[str, dict] = {}
AUTH_COOKIE_NAME = "intel_admin_session"
DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60
DEFAULT_ALLOWED_ORIGINS = {
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
}
PROTECTED_POST_PATHS = {
    "/api/intel/sync",
    "/api/intel/analyze-url",
    "/api/intel/pick",
    "/api/intel/timeline",
    "/api/intel/event-wall",
    "/api/intel/sbt-fields",
    "/api/intel/feedback",
    "/api/intel/source-config",
    "/api/intel/job-status",
    "/api/intel/backup",
    "/api/intel/restore",
    "/api/intel/retranslate",
}

def _env_flag(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return bool(default)
    return raw in {"1", "true", "yes", "y", "on"}


I18N_WARM_ON_STARTUP = _env_flag("I18N_WARM_ON_STARTUP", False)


def _normalize_samesite(raw: str | None) -> str:
    value = str(raw or "Lax").strip().lower()
    if value in {"lax", "strict", "none"}:
        return value.capitalize()
    return "Lax"


def _parse_allowed_origins(raw: str | None) -> set[str]:
    text = str(raw or "").strip()
    if not text:
        return set(DEFAULT_ALLOWED_ORIGINS)
    parts = [x.strip() for x in text.split(",") if x.strip()]
    return set(DEFAULT_ALLOWED_ORIGINS).union(parts)


AUTH_REQUIRED = _env_flag("INTEL_AUTH_REQUIRED", True)
AUTH_USERNAME = str(os.getenv("INTEL_ADMIN_USER", "")).strip()
AUTH_PASSWORD_HASH = str(os.getenv("INTEL_ADMIN_PASS_HASH", "")).strip()
AUTH_PASSWORD_PLAIN = str(os.getenv("INTEL_ADMIN_PASS", "")).strip()
AUTH_CONFIGURED = bool(AUTH_USERNAME and (AUTH_PASSWORD_HASH or AUTH_PASSWORD_PLAIN))
SESSION_TTL_SECONDS = max(300, int(os.getenv("INTEL_SESSION_TTL_SECONDS", str(DEFAULT_SESSION_TTL_SECONDS)) or DEFAULT_SESSION_TTL_SECONDS))
COOKIE_SAMESITE = _normalize_samesite(os.getenv("INTEL_COOKIE_SAMESITE", "Lax"))
COOKIE_SECURE_ENV = str(os.getenv("INTEL_COOKIE_SECURE", "")).strip().lower()
COOKIE_DOMAIN = str(os.getenv("INTEL_COOKIE_DOMAIN", "")).strip()
ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("INTEL_ALLOWED_ORIGINS", ""))

TRANSLATE_MAX_ITEMS = 220
TRANSLATE_MAX_CHARS = 320


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _verify_password(raw_password: str) -> bool:
    password = str(raw_password or "")
    if not AUTH_CONFIGURED:
        return False
    if AUTH_PASSWORD_HASH:
        encoded = AUTH_PASSWORD_HASH
        if encoded.startswith("pbkdf2_sha256$"):
            parts = encoded.split("$", 3)
            if len(parts) != 4:
                return False
            _, iterations_raw, salt, expected_hex = parts
            try:
                iterations = int(iterations_raw)
            except Exception:
                return False
            digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
            return hmac.compare_digest(digest.hex(), expected_hex)
        if encoded.startswith("sha256$"):
            parts = encoded.split("$", 2)
            if len(parts) != 3:
                return False
            _, salt, expected_hex = parts
            digest = hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()
            return hmac.compare_digest(digest, expected_hex)
    if AUTH_PASSWORD_PLAIN:
        return hmac.compare_digest(password, AUTH_PASSWORD_PLAIN)
    return False


def _parse_iso_utc(raw: str | None) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text)
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _purge_sessions_unlocked(now_iso: str | None = None) -> None:
    now_dt = _parse_iso_utc(now_iso) if now_iso else datetime.now(timezone.utc)
    stale = []
    for sid, data in SESSIONS.items():
        exp = _parse_iso_utc(str(data.get("expires_at") or ""))
        if not exp or exp <= now_dt:
            stale.append(sid)
    for sid in stale:
        SESSIONS.pop(sid, None)


def _create_session(username: str) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=SESSION_TTL_SECONDS)
    token = secrets.token_urlsafe(32)
    with SESSIONS_LOCK:
        _purge_sessions_unlocked(now.isoformat())
        SESSIONS[token] = {
            "username": username,
            "created_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        }
    return token


def _get_session(session_id: str) -> dict | None:
    sid = str(session_id or "").strip()
    if not sid:
        return None
    with SESSIONS_LOCK:
        _purge_sessions_unlocked()
        state = SESSIONS.get(sid)
        if not isinstance(state, dict):
            return None
        return dict(state)


def _delete_session(session_id: str) -> None:
    sid = str(session_id or "").strip()
    if not sid:
        return
    with SESSIONS_LOCK:
        SESSIONS.pop(sid, None)


def _read_jobs_unlocked() -> dict:
    if not JOBS_PATH.exists():
        return {"jobs": {}}
    try:
        raw = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"jobs": {}}
    if not isinstance(raw, dict):
        return {"jobs": {}}
    jobs = raw.get("jobs")
    if not isinstance(jobs, dict):
        jobs = {}
    return {"jobs": jobs}


def _write_jobs_unlocked(jobs: dict) -> None:
    payload = {"updated_at": _now_iso(), "jobs": jobs}
    JOBS_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOBS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _trim_jobs_unlocked(jobs: dict) -> None:
    if len(jobs) <= MAX_JOB_ITEMS:
        return
    ordered = sorted(jobs.items(), key=lambda kv: str((kv[1] or {}).get("created_at") or ""), reverse=True)
    keep = dict(ordered[:MAX_JOB_ITEMS])
    jobs.clear()
    jobs.update(keep)


def _normalize_lang_tag(lang: str | None) -> str:
    raw = str(lang or "").strip().lower()
    if not raw:
        return "zh-Hant"
    if raw.startswith("zh-hant") or raw in {"zh-tw", "zh-hk", "zh-mo"}:
        return "zh-Hant"
    if raw.startswith("zh"):
        return "zh-Hans"
    if raw.startswith("ko"):
        return "ko"
    if raw.startswith("en"):
        return "en"
    return "zh-Hant"


def _state_for_lang_unlocked(lang: str) -> dict:
    state = POKEMON_NEWS_STATE.get(lang)
    if not isinstance(state, dict):
        state = {
            "lang": lang,
            "refreshing": False,
            "last_refresh_at": "",
            "last_error": "",
            "next_refresh_at": "",
            "interval_minutes": DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES,
            "updated_at": _now_iso(),
        }
        POKEMON_NEWS_STATE[lang] = state
    return state


def _update_news_state(lang: str, **fields: object) -> dict:
    tag = _normalize_lang_tag(lang)
    with POKEMON_NEWS_STATE_LOCK:
        state = _state_for_lang_unlocked(tag)
        state.update(fields)
        state["updated_at"] = _now_iso()
        return dict(state)


def _get_news_state(lang: str) -> dict:
    tag = _normalize_lang_tag(lang)
    with POKEMON_NEWS_STATE_LOCK:
        return dict(_state_for_lang_unlocked(tag))


def _news_cache_path(lang: str | None) -> Path:
    tag = _normalize_lang_tag(lang)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", tag)
    if not safe:
        return POKEMON_NEWS_CACHE_PATH
    return DATA_ROOT / f"pokemon_latest_news_{safe}.json"


def _read_feed_snapshot() -> dict:
    if not FEED_PATH.exists():
        return {}
    try:
        raw = json.loads(FEED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except Exception:
        return int(default)


def _count_recent_cards(cards: list[dict], hours: int) -> int:
    if not cards:
        return 0
    now = datetime.now(timezone.utc)
    window = timedelta(hours=max(1, int(hours)))
    total = 0
    for card in cards:
        if not isinstance(card, dict):
            continue
        dt = _parse_iso_utc(card.get("published_at"))
        if not dt:
            continue
        if now - dt <= window:
            total += 1
    return total


def _latest_card_time(cards: list[dict]) -> str:
    latest: datetime | None = None
    for card in cards:
        if not isinstance(card, dict):
            continue
        dt = _parse_iso_utc(card.get("published_at"))
        if not dt:
            continue
        if latest is None or dt > latest:
            latest = dt
    return latest.isoformat() if latest else ""


def _read_i18n_bundle_snapshot() -> dict:
    if not I18N_FEED_PATH.exists():
        return {}
    try:
        raw = json.loads(I18N_FEED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _card_lookup_key(card: dict, index: int) -> str:
    if not isinstance(card, dict):
        return f"idx:{index}"
    for key in ("id", "url", "_card_key"):
        value = str(card.get(key) or "").strip()
        if value:
            return value
    account = str(card.get("account") or "").strip().lower()
    published = str(card.get("published_at") or "").strip()
    title = str(card.get("title") or "").strip()
    return f"{account}|{published}|{title}|{index}"


def _card_title(card: dict) -> str:
    if not isinstance(card, dict):
        return ""
    title = str(card.get("title") or "").strip()
    if title:
        return title
    summary = str(card.get("summary") or "").strip()
    if summary:
        return summary[:120]
    return str(card.get("id") or card.get("url") or "").strip()


def _build_card_index(cards: list[dict] | object) -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not isinstance(cards, list):
        return out
    for idx, row in enumerate(cards):
        if not isinstance(row, dict):
            continue
        key = _card_lookup_key(row, idx)
        if key and key not in out:
            out[key] = row
    return out


def _compute_i18n_alignment(feed: dict, i18n_state: dict) -> dict:
    cards_raw = feed.get("cards")
    base_cards = cards_raw if isinstance(cards_raw, list) else []
    base_index = _build_card_index(base_cards)
    base_keys = list(base_index.keys())
    base_set = set(base_keys)

    bundle = _read_i18n_bundle_snapshot()
    feed_generated_at = str(feed.get("generated_at") or "").strip()
    bundle_source_generated_at = str(bundle.get("source_generated_at") or "").strip()
    source_in_sync = bool(feed_generated_at and bundle_source_generated_at and feed_generated_at == bundle_source_generated_at)
    bundle_langs = bundle.get("langs") if isinstance(bundle.get("langs"), dict) else {}
    bundle_qa = bundle.get("qa") if isinstance(bundle.get("qa"), dict) else {}
    bundle_card_progress_root = bundle.get("card_progress") if isinstance(bundle.get("card_progress"), dict) else {}
    bundle_card_progress_langs = (
        bundle_card_progress_root.get("langs")
        if isinstance(bundle_card_progress_root.get("langs"), dict)
        else {}
    )
    progress_map = i18n_state.get("lang_progress") if isinstance(i18n_state.get("lang_progress"), dict) else {}
    i18n_global_status = str(i18n_state.get("status") or "").strip().lower()
    i18n_target_langs = {
        str(x).strip()
        for x in (i18n_state.get("target_langs") or [])
        if str(x).strip()
    } if isinstance(i18n_state.get("target_langs"), list) else set()

    lang_rows: dict[str, dict] = {}
    ready_langs: list[str] = []
    pending_langs: list[str] = []
    misaligned_langs: list[str] = []
    failed_langs: list[str] = []

    for lang in I18N_MONITOR_LANGS:
        if lang == I18N_BASE_LANG:
            lang_index = dict(base_index)
            lang_keys = list(base_keys)
            missing_keys = []
            extra_keys = []
        else:
            lang_node = bundle_langs.get(lang) if isinstance(bundle_langs.get(lang), dict) else {}
            lang_cards = lang_node.get("cards") if isinstance(lang_node, dict) else []
            lang_index = _build_card_index(lang_cards)
            lang_keys = list(lang_index.keys())
            lang_set = set(lang_keys)
            missing_keys = [key for key in base_keys if key not in lang_set]
            extra_keys = [key for key in lang_keys if key not in base_set]
        missing_titles = [_card_title(base_index[key]) for key in missing_keys[:8]]
        extra_titles = [_card_title(lang_index[key]) for key in extra_keys[:8]]

        progress = progress_map.get(lang) if isinstance(progress_map.get(lang), dict) else {}
        qa_row = bundle_qa.get(lang) if isinstance(bundle_qa.get(lang), dict) else {}
        card_progress_row = (
            bundle_card_progress_langs.get(lang)
            if isinstance(bundle_card_progress_langs.get(lang), dict)
            else {}
        )
        card_summary = (
            card_progress_row.get("summary")
            if isinstance(card_progress_row, dict) and isinstance(card_progress_row.get("summary"), dict)
            else {}
        )
        card_rows = (
            card_progress_row.get("cards")
            if isinstance(card_progress_row, dict) and isinstance(card_progress_row.get("cards"), list)
            else []
        )
        card_status_rows = [row for row in card_rows if isinstance(row, dict)]
        pending_card_ids = [str(row.get("id") or "") for row in card_status_rows if str(row.get("status") or "") == "pending" and str(row.get("id") or "").strip()]
        partial_card_ids = [str(row.get("id") or "") for row in card_status_rows if str(row.get("status") or "") == "partial" and str(row.get("id") or "").strip()]
        failed_card_ids = [str(row.get("id") or "") for row in card_status_rows if str(row.get("status") or "") in {"failed", "partial-failed"} and str(row.get("id") or "").strip()]
        text_done = _safe_int(progress.get("done"), _safe_int(qa_row.get("translated"), 0))
        text_total = _safe_int(progress.get("total"), _safe_int(qa_row.get("total"), 0))
        text_pending = _safe_int(progress.get("pending_count"), _safe_int(qa_row.get("pending_count"), max(0, text_total - text_done)))
        card_total = _safe_int(card_summary.get("total_cards"), len(base_keys if lang != I18N_BASE_LANG else base_keys))
        card_translated = _safe_int(
            card_summary.get("ready_cards"),
            _safe_int(card_summary.get("translated_cards"), text_done),
        )
        card_partial = _safe_int(card_summary.get("partial_cards"), 0)
        card_pending = _safe_int(card_summary.get("pending_cards"), text_pending)
        card_failed = _safe_int(card_summary.get("failed_cards"), 0)
        card_missing = _safe_int(card_summary.get("missing_cards"), len(missing_keys))
        card_extra = _safe_int(card_summary.get("extra_cards"), len(extra_keys))
        build_status = str(progress.get("status") or "").strip().lower()
        build_mode = str(progress.get("mode") or qa_row.get("mode") or "").strip()
        build_error = str(progress.get("error") or qa_row.get("error") or "").strip()
        running_build = (
            build_status in {"running", "queued"}
            or (
                i18n_global_status in {"running", "queued"}
                and lang != I18N_BASE_LANG
                and lang in i18n_target_langs
            )
        )
        if running_build and card_total <= 0 and text_total > 0:
            # Fallback only when card-level summary is unavailable.
            card_total = len(base_keys)
            card_translated = 0
            card_pending = max(0, card_total - card_translated)
        done = len(base_keys) if lang == I18N_BASE_LANG else min(card_total, max(0, card_translated))
        total = len(base_keys) if lang == I18N_BASE_LANG else max(card_total, done)
        pending_count = 0 if lang == I18N_BASE_LANG else max(0, card_pending)
        cache_hits = _safe_int(progress.get("cached_hits"), _safe_int(qa_row.get("cached_hits"), 0))
        is_aligned = not missing_keys and not extra_keys

        if lang == I18N_BASE_LANG:
            state = "base_ready"
        elif build_status == "failed" or build_error:
            state = "failed"
        elif card_failed > 0:
            state = "failed"
        elif running_build:
            state = "aligned_pending"
        elif not is_aligned:
            state = "stale_misaligned"
        elif build_status in {"running", "queued"} or pending_count > 0 or card_partial > 0:
            state = "aligned_pending"
        else:
            state = "aligned_ready"

        if state == "failed":
            failed_langs.append(lang)
        elif state == "stale_misaligned":
            misaligned_langs.append(lang)
        elif state == "aligned_pending":
            pending_langs.append(lang)
        elif state in {"aligned_ready", "base_ready"}:
            ready_langs.append(lang)

        lang_rows[lang] = {
            "lang": lang,
            "state": state,
            "is_aligned": is_aligned,
            "base_count": len(base_keys),
            "lang_count": len(lang_keys),
            "missing_count": len(missing_keys),
            "extra_count": len(extra_keys),
            "missing_ids": missing_keys[:20],
            "extra_ids": extra_keys[:20],
            "missing_titles": missing_titles,
            "extra_titles": extra_titles,
            "done": done,
            "total": total,
            "pending_count": pending_count,
            "cache_hits": cache_hits,
            "text_done": text_done,
            "text_total": text_total,
            "text_pending_count": text_pending,
            "card_total": card_total,
            "card_translated": card_translated,
            "card_partial": card_partial,
            "card_pending": card_pending,
            "card_failed": card_failed,
            "card_missing": card_missing,
            "card_extra": card_extra,
            "card_pending_ids": pending_card_ids[:20],
            "card_partial_ids": partial_card_ids[:20],
            "card_failed_ids": failed_card_ids[:20],
            "build_status": build_status or "pending",
            "build_mode": build_mode,
            "build_error": build_error,
            "updated_at": str(progress.get("updated_at") or ""),
        }

    return {
        "base_lang": I18N_BASE_LANG,
        "base_count": len(base_keys),
        "feed_generated_at": feed_generated_at,
        "bundle_source_generated_at": bundle_source_generated_at,
        "source_in_sync": source_in_sync,
        "langs": lang_rows,
        "ready_langs": ready_langs,
        "pending_langs": pending_langs,
        "misaligned_langs": misaligned_langs,
        "failed_langs": failed_langs,
    }


def _sync_state_snapshot() -> dict:
    with SYNC_STATE_LOCK:
        return dict(SYNC_STATE)


def _start_sync_state(trigger: str = "") -> None:
    with SYNC_STATE_LOCK:
        SYNC_STATE["status"] = "running"
        SYNC_STATE["started_at"] = _now_iso()
        SYNC_STATE["finished_at"] = ""
        SYNC_STATE["last_error"] = ""
        SYNC_STATE["trigger"] = str(trigger or "manual")
        SYNC_STATE["duration_ms"] = 0


def _finish_sync_state_ok(started_monotonic: float) -> None:
    now_iso = _now_iso()
    duration_ms = max(0, int(round((time.monotonic() - float(started_monotonic)) * 1000)))
    with SYNC_STATE_LOCK:
        SYNC_STATE["status"] = "ok"
        SYNC_STATE["finished_at"] = now_iso
        SYNC_STATE["last_success_at"] = now_iso
        SYNC_STATE["last_error"] = ""
        SYNC_STATE["duration_ms"] = duration_ms


def _finish_sync_state_failed(started_monotonic: float, error_message: str) -> None:
    now_iso = _now_iso()
    duration_ms = max(0, int(round((time.monotonic() - float(started_monotonic)) * 1000)))
    with SYNC_STATE_LOCK:
        SYNC_STATE["status"] = "failed"
        SYNC_STATE["finished_at"] = now_iso
        SYNC_STATE["last_error"] = str(error_message or "unknown_error")
        SYNC_STATE["duration_ms"] = duration_ms


def _mark_sync_schedule(
    *,
    enabled: bool,
    interval_hours: float,
    window_days: int,
    next_run_at: str = "",
    last_scheduled_at: str = "",
) -> None:
    with SYNC_STATE_LOCK:
        SYNC_STATE["schedule_enabled"] = bool(enabled)
        SYNC_STATE["schedule_interval_hours"] = float(interval_hours)
        SYNC_STATE["schedule_window_days"] = int(window_days)
        if next_run_at:
            SYNC_STATE["next_run_at"] = next_run_at
        if last_scheduled_at:
            SYNC_STATE["last_scheduled_at"] = last_scheduled_at


def _run_intel_sync(accounts: list[str] | None, days: int, trigger: str) -> dict:
    started_monotonic = time.monotonic()
    _start_sync_state(trigger=trigger)
    try:
        result = sync_accounts(accounts=accounts, window_days=max(1, int(days)))
        build_i18n_feed_bundle_async(result, force=False, target_langs=["en", "ko", "zh-Hans"])
        _finish_sync_state_ok(started_monotonic)
        return result
    except Exception as sync_error:
        _finish_sync_state_failed(started_monotonic, str(sync_error))
        raise


def _warm_i18n_bundle_from_feed() -> None:
    if not FEED_PATH.exists():
        return
    try:
        feed = json.loads(FEED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(feed, dict):
        return
    build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])


def _start_x_sync_scheduler(
    *,
    interval_hours: float = DEFAULT_X_SYNC_INTERVAL_HOURS,
    window_days: int = DEFAULT_X_SYNC_WINDOW_DAYS,
    run_on_startup: bool = False,
) -> None:
    safe_interval_hours = max(0.25, float(interval_hours or DEFAULT_X_SYNC_INTERVAL_HOURS))
    safe_window_days = max(1, int(window_days or DEFAULT_X_SYNC_WINDOW_DAYS))
    interval_seconds = int(round(safe_interval_hours * 60 * 60))
    first_delay = 8 if run_on_startup else interval_seconds
    first_next = (datetime.now(timezone.utc) + timedelta(seconds=first_delay)).isoformat()
    _mark_sync_schedule(
        enabled=True,
        interval_hours=safe_interval_hours,
        window_days=safe_window_days,
        next_run_at=first_next,
    )

    def _loop() -> None:
        delay = first_delay
        while True:
            time.sleep(max(1, int(delay)))
            scheduled_at = _now_iso()
            next_run = (datetime.now(timezone.utc) + timedelta(seconds=interval_seconds)).isoformat()
            _mark_sync_schedule(
                enabled=True,
                interval_hours=safe_interval_hours,
                window_days=safe_window_days,
                next_run_at=next_run,
                last_scheduled_at=scheduled_at,
            )
            with SYNC_STATE_LOCK:
                is_running = str(SYNC_STATE.get("status") or "").strip().lower() == "running"
            if is_running:
                with SYNC_STATE_LOCK:
                    SYNC_STATE["last_error"] = "scheduled sync skipped: another sync is running"
                delay = interval_seconds
                continue
            try:
                _run_intel_sync(accounts=None, days=safe_window_days, trigger="scheduled")
            except Exception:
                pass
            delay = interval_seconds

    Thread(target=_loop, daemon=True).start()


def _backup_state_snapshot() -> dict:
    with BACKUP_STATE_LOCK:
        return dict(BACKUP_STATE)


def _start_backup_state(trigger: str = "") -> float:
    with BACKUP_STATE_LOCK:
        BACKUP_STATE["status"] = "running"
        BACKUP_STATE["started_at"] = _now_iso()
        BACKUP_STATE["finished_at"] = ""
        BACKUP_STATE["last_error"] = ""
        BACKUP_STATE["trigger"] = str(trigger or "manual")
        BACKUP_STATE["duration_ms"] = 0
        BACKUP_STATE["changed"] = False
        BACKUP_STATE["skipped"] = False
        BACKUP_STATE["reason"] = ""
    return time.monotonic()


def _finish_backup_state(result: dict, started_monotonic: float) -> None:
    now_iso = _now_iso()
    duration_ms = max(0, int(round((time.monotonic() - float(started_monotonic)) * 1000)))
    ok = bool(result.get("ok"))
    skipped = bool(result.get("skipped"))
    with BACKUP_STATE_LOCK:
        BACKUP_STATE["status"] = "ok" if ok else ("skipped" if skipped else "failed")
        BACKUP_STATE["finished_at"] = now_iso
        BACKUP_STATE["duration_ms"] = duration_ms
        BACKUP_STATE["changed"] = bool(result.get("changed"))
        BACKUP_STATE["skipped"] = skipped
        BACKUP_STATE["reason"] = str(result.get("reason") or "")
        BACKUP_STATE["last_error"] = "" if ok else str(result.get("error") or result.get("reason") or "unknown_error")
        if ok:
            BACKUP_STATE["last_success_at"] = now_iso


def _spawn_website_backup(trigger: str = "manual") -> bool:
    with BACKUP_STATE_LOCK:
        if str(BACKUP_STATE.get("status") or "") == "running":
            return False

    def _worker() -> None:
        started = _start_backup_state(trigger=trigger)
        result = run_website_backup(DATA_ROOT, ROOT.parent, reason=trigger)
        _finish_backup_state(result, started)

    Thread(target=_worker, daemon=True).start()
    return True


def _collect_jobs_snapshot(limit: int = 12) -> dict:
    with JOBS_LOCK:
        state = _read_jobs_unlocked()
    jobs_map = state.get("jobs") if isinstance(state, dict) else {}
    jobs_map = jobs_map if isinstance(jobs_map, dict) else {}
    rows = []
    for item in jobs_map.values():
        if not isinstance(item, dict):
            continue
        rows.append(dict(item))
    rows.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    rows = rows[: max(1, min(int(limit), 40))]
    counts = {
        "queued": 0,
        "running": 0,
        "done": 0,
        "failed": 0,
    }
    for row in jobs_map.values():
        if not isinstance(row, dict):
            continue
        status = str(row.get("status") or "").strip().lower()
        if status in counts:
            counts[status] += 1
    return {
        "counts": counts,
        "total": len(jobs_map),
        "items": rows,
    }


def _collect_news_state_snapshot() -> list[dict]:
    with POKEMON_NEWS_STATE_LOCK:
        langs = sorted(POKEMON_NEWS_STATE.keys())
        rows = [dict(_state_for_lang_unlocked(lang)) for lang in langs]
    for row in rows:
        tag = _normalize_lang_tag(row.get("lang"))
        cache = _read_news_cache(tag)
        provider = str(cache.get("provider") or os.getenv("NEWS_SEARCH_PROVIDER") or "minimax_cli_search").strip()
        row["provider"] = provider
        row["items"] = len(cache.get("items") or []) if isinstance(cache.get("items"), list) else 0
    return rows


def _build_admin_status(limit: int = 10) -> dict:
    feed = _read_feed_snapshot()
    cards_raw = feed.get("cards")
    cards: list[dict] = cards_raw if isinstance(cards_raw, list) else []
    card_rows = [x for x in cards if isinstance(x, dict)]
    sync_state = _sync_state_snapshot()
    jobs = _collect_jobs_snapshot(limit=limit)
    news_states = _collect_news_state_snapshot()
    i18n_state = i18n_state_snapshot()
    i18n_alignment = _compute_i18n_alignment(feed, i18n_state)
    memory_stats = feedback_memory_stats()
    backup_status = get_website_backup_status(DATA_ROOT)
    backup_state = _backup_state_snapshot()
    x_source_config = read_x_source_config()

    discord_info = feed.get("discord_monitor")
    discord_info = discord_info if isinstance(discord_info, dict) else {}

    generated_at = str(feed.get("generated_at") or "").strip()
    latest_source_at = _latest_card_time(card_rows)
    recent_6h = _count_recent_cards(card_rows, hours=6)
    recent_24h = _count_recent_cards(card_rows, hours=24)

    running_jobs = _safe_int(jobs.get("counts", {}).get("running"))
    queued_jobs = _safe_int(jobs.get("counts", {}).get("queued"))
    sync_running = str(sync_state.get("status") or "").strip().lower() == "running"
    pipeline_counts = feed.get("pipeline_counts") if isinstance(feed.get("pipeline_counts"), dict) else {}
    i18n_raw_status = str(i18n_state.get("status") or "idle").strip().lower()
    lang_rows = i18n_alignment.get("langs") if isinstance(i18n_alignment.get("langs"), dict) else {}
    fully_ready = True
    for tag in ("zh-Hans", "en", "ko"):
        row = lang_rows.get(tag) if isinstance(lang_rows.get(tag), dict) else {}
        if str(row.get("state") or "") != "aligned_ready":
            fully_ready = False
            break

    if i18n_alignment.get("failed_langs"):
        i18n_effective_status = "failed"
    elif i18n_alignment.get("misaligned_langs") or i18n_alignment.get("pending_langs"):
        i18n_effective_status = "running"
    elif fully_ready:
        i18n_effective_status = "ok"
    else:
        i18n_effective_status = i18n_raw_status or "idle"

    i18n_payload = dict(i18n_state) if isinstance(i18n_state, dict) else {}
    i18n_payload["raw_status"] = i18n_raw_status or "idle"
    i18n_payload["effective_status"] = i18n_effective_status
    i18n_payload["alignment"] = i18n_alignment

    return {
        "server_time": _now_iso(),
        "sync": {
            "status": str(sync_state.get("status") or "idle"),
            "started_at": str(sync_state.get("started_at") or ""),
            "finished_at": str(sync_state.get("finished_at") or ""),
            "last_success_at": str(sync_state.get("last_success_at") or generated_at),
            "last_error": str(sync_state.get("last_error") or ""),
            "trigger": str(sync_state.get("trigger") or ""),
            "duration_ms": _safe_int(sync_state.get("duration_ms"), 0),
            "schedule_enabled": bool(sync_state.get("schedule_enabled")),
            "schedule_interval_hours": float(sync_state.get("schedule_interval_hours") or DEFAULT_X_SYNC_INTERVAL_HOURS),
            "schedule_window_days": _safe_int(sync_state.get("schedule_window_days"), DEFAULT_X_SYNC_WINDOW_DAYS),
            "next_run_at": str(sync_state.get("next_run_at") or ""),
            "last_scheduled_at": str(sync_state.get("last_scheduled_at") or ""),
            "feed_generated_at": generated_at,
            "latest_source_at": latest_source_at,
            "total_cards": _safe_int(feed.get("total_cards"), len(card_rows)),
            "raw_total_cards": _safe_int(feed.get("raw_total_cards"), len(card_rows)),
            "source_total_cards": _safe_int(feed.get("source_total_cards"), _safe_int(feed.get("raw_total_cards"), len(card_rows))),
            "excluded_cards": _safe_int(feed.get("excluded_cards"), 0),
            "excluded_by_selection": _safe_int(feed.get("excluded_by_selection"), 0),
            "excluded_by_feedback": _safe_int(feed.get("excluded_by_feedback"), 0),
            "excluded_by_source_preference": _safe_int(feed.get("excluded_by_source_preference"), 0),
            "dedupe_ai_removed": _safe_int((feed.get("dedupe_stats") or {}).get("ai_removed"), 0),
            "dedupe_local_removed": _safe_int((feed.get("dedupe_stats") or {}).get("local_removed"), 0),
            "pipeline_counts": pipeline_counts,
            "new_cards_6h": recent_6h,
            "new_cards_24h": recent_24h,
        },
        "jobs": jobs,
        "new_posts": {
            "new_cards_6h": recent_6h,
            "new_cards_24h": recent_24h,
            "sync_running": sync_running,
            "queued_jobs": queued_jobs,
            "running_jobs": running_jobs,
            "pending_processing": queued_jobs + running_jobs + (1 if sync_running else 0),
            "is_processing": bool(queued_jobs + running_jobs + (1 if sync_running else 0)),
        },
        "memory": memory_stats,
        "agents": [
            {
                "name": "x_sync_agent",
                "status": str(sync_state.get("status") or "idle"),
                "detail": (
                    f"last_sync={generated_at or '--'} "
                    f"next={str(sync_state.get('next_run_at') or '--')} "
                    f"interval={float(sync_state.get('schedule_interval_hours') or DEFAULT_X_SYNC_INTERVAL_HOURS):g}h "
                    f"cards={_safe_int(feed.get('total_cards'), len(card_rows))}"
                ),
            },
            {
                "name": "url_analyzer_agent",
                "status": "running" if running_jobs > 0 else ("queued" if queued_jobs > 0 else "idle"),
                "detail": f"queued={queued_jobs} running={running_jobs}",
            },
            {
                "name": "pokemon_news_agent",
                "status": "running" if any(bool(x.get("refreshing")) for x in news_states) else "idle",
                "detail": f"langs={len(news_states)}",
            },
            {
                "name": "i18n_feed_agent",
                "status": str(i18n_effective_status or i18n_state.get("status") or "idle"),
                "detail": f"langs={','.join([str(x) for x in (i18n_state.get('langs') or [])]) or '--'} source={str(i18n_state.get('source_generated_at') or '--')}",
            },
            {
                "name": "feedback_memory_agent",
                "status": "active",
                "detail": f"rules={_safe_int(memory_stats.get('rules'), 0) + _safe_int(memory_stats.get('default_rules'), 0)} feedback={_safe_int(memory_stats.get('feedback_items'), 0)} profiles={_safe_int(memory_stats.get('source_profiles'), 0)}",
            },
            {
                "name": "website_backup_agent",
                "status": str(backup_state.get("status") or ("enabled" if backup_status.get("enabled") else "disabled")),
                "detail": f"provider={backup_status.get('provider')} subdir={backup_status.get('subdir')} repo={'set' if backup_status.get('has_repo') else 'unset'} changed={backup_state.get('changed')}",
            },
        ],
        "monitors": {
            "x": {
                "accounts": [str(x) for x in (x_source_config.get("x_accounts") or []) if str(x).strip()],
                "default_accounts": [str(x) for x in (x_source_config.get("default_x_accounts") or []) if str(x).strip()],
                "using_default": bool(x_source_config.get("using_default")),
                "updated_at": str(x_source_config.get("updated_at") or ""),
                "source_stats": feed.get("source_stats") if isinstance(feed.get("source_stats"), dict) else {},
                "source_quality": feed.get("source_quality") if isinstance(feed.get("source_quality"), dict) else {},
            },
            "discord": {
                "enabled": bool(discord_info.get("enabled")),
                "configured": bool(discord_info.get("configured")),
                "cards_total": _safe_int(discord_info.get("cards_total"), 0),
                "channel_ids": [str(x) for x in (discord_info.get("channel_ids") or []) if str(x).strip()],
                "channel_stats": discord_info.get("channel_stats") if isinstance(discord_info.get("channel_stats"), dict) else {},
                "errors": [str(x) for x in (discord_info.get("errors") or []) if str(x).strip()][:6],
            }
        },
        "news": {
            "langs": news_states,
        },
        "i18n": i18n_payload,
        "storage": {
            **STORAGE_STATE,
            "restore": RESTORE_STATE,
        },
        "backup": {
            **backup_status,
            "runtime": backup_state,
        },
    }


def _read_news_cache_unlocked(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _read_news_cache(lang: str | None) -> dict:
    path = _news_cache_path(lang)
    with POKEMON_NEWS_LOCK:
        raw = _read_news_cache_unlocked(path)
    return dict(raw) if isinstance(raw, dict) else {}


def _write_news_cache_unlocked(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _is_news_cache_fresh(cache: dict, max_age_minutes: int = POKEMON_NEWS_CACHE_MINUTES) -> bool:
    updated = str(cache.get("generated_at") or "").strip()
    if not updated:
        return False
    try:
        dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
    except Exception:
        return False
    now = datetime.now(timezone.utc)
    age = now - dt.astimezone(timezone.utc)
    return age <= timedelta(minutes=max(1, int(max_age_minutes)))


def _compose_news_payload(cache: dict, lang: str, *, pending: bool = False, refresh_started: bool = False) -> dict:
    base = dict(cache) if isinstance(cache, dict) else {}
    if not base:
        base = {
            "generated_at": "",
            "provider": str(os.getenv("NEWS_SEARCH_PROVIDER") or "minimax_cli_search"),
            "lang": _normalize_lang_tag(lang),
            "summary_mode": "pending",
            "items": [],
            "cached": False,
        }
    state = _get_news_state(lang)
    base["refreshing"] = bool(state.get("refreshing"))
    base["refresh_started"] = bool(refresh_started)
    base["pending"] = bool(pending)
    base["last_refresh_at"] = str(state.get("last_refresh_at") or "")
    base["next_refresh_at"] = str(state.get("next_refresh_at") or "")
    base["auto_interval_minutes"] = int(state.get("interval_minutes") or DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES)
    state_error = str(state.get("last_error") or "").strip()
    if state_error and not str(base.get("warning") or "").strip():
        base["warning"] = f"背景更新最近失敗：{state_error}"
    return base


def _get_pokemon_news(force: bool = False, max_items: int = 8, lang: str | None = None) -> dict:
    lang_tag = _normalize_lang_tag(lang)
    cache_path = _news_cache_path(lang_tag)
    with POKEMON_NEWS_LOCK:
        cache = _read_news_cache_unlocked(cache_path)
    if not force and cache and _is_news_cache_fresh(cache):
        payload = dict(cache)
        payload["cached"] = True
        return payload
    if lang_tag != POKEMON_NEWS_CANONICAL_LANG:
        base_path = _news_cache_path(POKEMON_NEWS_CANONICAL_LANG)
        with POKEMON_NEWS_LOCK:
            base_cache = _read_news_cache_unlocked(base_path)
        if force or not base_cache or not _is_news_cache_fresh(base_cache):
            base_cache = _get_pokemon_news(force=True, max_items=max_items, lang=POKEMON_NEWS_CANONICAL_LANG)
            base_cache.pop("cached", None)
        try:
            translated = translate_pokemon_news_payload(base_cache, lang_tag)
            with POKEMON_NEWS_LOCK:
                _write_news_cache_unlocked(cache_path, translated)
            translated["cached"] = False
            return translated
        except Exception as exc:
            if cache:
                payload = dict(cache)
                payload["cached"] = True
                payload["warning"] = f"新聞翻譯失敗，已回退快取：{exc}"
                return payload
            raise
    try:
        fresh = fetch_pokemon_latest_news(
            max_items=max(3, min(int(max_items), 16)),
            lang=POKEMON_NEWS_CANONICAL_LANG,
        )
        with POKEMON_NEWS_LOCK:
            _write_news_cache_unlocked(cache_path, fresh)
        fresh["cached"] = False
        return fresh
    except Exception as exc:
        if cache:
            payload = dict(cache)
            payload["cached"] = True
            payload["warning"] = f"最新抓取失敗，已回退快取：{exc}"
            return payload
        raise


def _refresh_pokemon_news_worker(lang: str, max_items: int, reason: str, delay_seconds: float = 0) -> None:
    tag = _normalize_lang_tag(lang)
    if delay_seconds > 0:
        time.sleep(float(delay_seconds))
    try:
        news = _get_pokemon_news(force=True, max_items=max_items, lang=tag)
        warning = str(news.get("warning") or "").strip()
        refresh_at = str(news.get("generated_at") or _now_iso()).strip() or _now_iso()
        _update_news_state(tag, refreshing=False, last_refresh_at=refresh_at, last_error=warning, last_reason=reason)
    except Exception as exc:
        _update_news_state(tag, refreshing=False, last_error=str(exc), last_reason=reason)


def _spawn_pokemon_news_refresh(lang: str, max_items: int, reason: str, delay_seconds: float = 0) -> bool:
    tag = _normalize_lang_tag(lang)
    with POKEMON_NEWS_STATE_LOCK:
        state = _state_for_lang_unlocked(tag)
        if bool(state.get("refreshing")):
            return False
        state["refreshing"] = True
        state["last_reason"] = reason
        state["updated_at"] = _now_iso()
    Thread(target=_refresh_pokemon_news_worker, args=(tag, max_items, reason, float(delay_seconds or 0)), daemon=True).start()
    return True


def _start_pokemon_news_scheduler(interval_minutes: int, langs: list[str], max_items: int = DEFAULT_POKEMON_NEWS_MAX_ITEMS) -> None:
    safe_interval_min = max(1, int(interval_minutes))
    interval_seconds = safe_interval_min * 60
    normalized_langs = []
    for lang in langs:
        tag = _normalize_lang_tag(lang)
        if tag and tag not in normalized_langs:
            normalized_langs.append(tag)
    if not normalized_langs:
        normalized_langs = ["zh-Hant"]

    first_next = (datetime.now(timezone.utc) + timedelta(seconds=interval_seconds)).isoformat()
    for idx, lang in enumerate(normalized_langs):
        _update_news_state(lang, interval_minutes=safe_interval_min, next_refresh_at=first_next)
        _spawn_pokemon_news_refresh(lang, max_items=max_items, reason="startup", delay_seconds=idx * 20)

    def _loop() -> None:
        while True:
            time.sleep(interval_seconds)
            next_run = (datetime.now(timezone.utc) + timedelta(seconds=interval_seconds)).isoformat()
            for idx, lang in enumerate(normalized_langs):
                _update_news_state(lang, interval_minutes=safe_interval_min, next_refresh_at=next_run)
                _spawn_pokemon_news_refresh(lang, max_items=max_items, reason="scheduled", delay_seconds=idx * 20)

    Thread(target=_loop, daemon=True).start()


def _create_job(url: str) -> dict:
    with JOBS_LOCK:
        state = _read_jobs_unlocked()
        jobs = state["jobs"]
        job_id = uuid4().hex[:12]
        job = {
            "id": job_id,
            "url": url,
            "status": "queued",
            "message": "已排入背景分析佇列。",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        jobs[job_id] = job
        _trim_jobs_unlocked(jobs)
        _write_jobs_unlocked(jobs)
        return dict(job)


def _update_job(job_id: str, **fields: object) -> dict | None:
    with JOBS_LOCK:
        state = _read_jobs_unlocked()
        jobs = state["jobs"]
        raw = jobs.get(job_id)
        if not isinstance(raw, dict):
            return None
        raw.update(fields)
        raw["updated_at"] = _now_iso()
        jobs[job_id] = raw
        _write_jobs_unlocked(jobs)
        return dict(raw)


def _get_job(job_id: str) -> dict | None:
    with JOBS_LOCK:
        state = _read_jobs_unlocked()
        raw = state["jobs"].get(job_id)
        return dict(raw) if isinstance(raw, dict) else None


def _run_analyze_job(job_id: str, url: str) -> None:
    _update_job(job_id, status="running", started_at=_now_iso(), message="背景分析進行中，可安全刷新頁面。")
    try:
        result = add_manual_tweet(url)
        if not isinstance(result, dict) or not bool(result.get("ok")):
            err_msg = str((result or {}).get("error") or "分析失敗")
            raise RuntimeError(err_msg)
        tweet = result.get("tweet") if isinstance(result.get("tweet"), dict) else {}
        feed = result.get("feed") if isinstance(result.get("feed"), dict) else {}
        if feed:
            build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
        _update_job(
            job_id,
            status="done",
            finished_at=_now_iso(),
            message="分析完成，已加入精選卡片。",
            tweet_id=tweet.get("id"),
            tweet_url=tweet.get("url"),
            generated_at=feed.get("generated_at"),
        )
    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            finished_at=_now_iso(),
            message=f"分析失敗：{exc}",
            error=str(exc),
        )


def _enqueue_analyze_job(url: str) -> dict:
    job = _create_job(url)
    Thread(target=_run_analyze_job, args=(str(job["id"]), url), daemon=True).start()
    return job


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def _request_path(self) -> str:
        return str(urlparse(self.path).path or "/").strip() or "/"

    def _send_data_file(self, path: str) -> bool:
        raw_path = unquote(str(path or ""))
        if not raw_path.startswith("/data/generated_covers/"):
            return False
        rel = raw_path.removeprefix("/data/").lstrip("/")
        root = (DATA_ROOT / "generated_covers").resolve()
        target = (DATA_ROOT / rel).resolve()
        try:
            target.relative_to(root)
        except Exception:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return True
        if not target.exists() or not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return True
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        try:
            size = target.stat().st_size
            self.send_response(HTTPStatus.OK)
            self._set_cors_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "public, max-age=604800")
            self.end_headers()
            with target.open("rb") as fh:
                self.copyfile(fh, self.wfile)
        except BrokenPipeError:
            return True
        except Exception:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "failed to read data file")
        return True

    def _request_origin(self) -> str:
        return str(self.headers.get("Origin") or "").strip()

    def _allowed_origin(self) -> str:
        origin = self._request_origin()
        if not origin:
            return ""
        if "*" in ALLOWED_ORIGINS:
            return origin
        return origin if origin in ALLOWED_ORIGINS else ""

    def _set_cors_headers(self) -> None:
        allow_origin = self._allowed_origin()
        if not allow_origin:
            return
        self.send_header("Access-Control-Allow-Origin", allow_origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Vary", "Origin")

    def _is_secure_cookie(self) -> bool:
        if COOKIE_SECURE_ENV in {"1", "true", "yes", "y", "on"}:
            return True
        if COOKIE_SECURE_ENV in {"0", "false", "no", "n", "off"}:
            return False
        proto = str(self.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip().lower()
        if proto == "https":
            return True
        return False

    def _session_cookie_header(self, session_id: str) -> str:
        parts = [
            f"{AUTH_COOKIE_NAME}={session_id}",
            "Path=/",
            "HttpOnly",
            f"SameSite={COOKIE_SAMESITE}",
            f"Max-Age={SESSION_TTL_SECONDS}",
        ]
        if COOKIE_DOMAIN:
            parts.append(f"Domain={COOKIE_DOMAIN}")
        if self._is_secure_cookie():
            parts.append("Secure")
        return "; ".join(parts)

    def _clear_session_cookie_header(self) -> str:
        parts = [
            f"{AUTH_COOKIE_NAME}=",
            "Path=/",
            "HttpOnly",
            f"SameSite={COOKIE_SAMESITE}",
            "Max-Age=0",
            "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ]
        if COOKIE_DOMAIN:
            parts.append(f"Domain={COOKIE_DOMAIN}")
        if self._is_secure_cookie():
            parts.append("Secure")
        return "; ".join(parts)

    def _session_id_from_cookie(self) -> str:
        cookie_raw = str(self.headers.get("Cookie") or "").strip()
        if not cookie_raw:
            return ""
        jar = SimpleCookie()
        try:
            jar.load(cookie_raw)
        except Exception:
            return ""
        node = jar.get(AUTH_COOKIE_NAME)
        if not node:
            return ""
        return str(node.value or "").strip()

    def _session_id_from_auth_header(self) -> str:
        raw = str(self.headers.get("Authorization") or "").strip()
        if not raw:
            return ""
        scheme, _, value = raw.partition(" ")
        if scheme.lower() != "bearer":
            return ""
        return value.strip()

    def _session_id_from_request(self) -> str:
        # Walrus frontend and Zeabur backend are cross-site; third-party cookies
        # are not reliable there, so the admin session also supports Bearer auth.
        return self._session_id_from_cookie() or self._session_id_from_auth_header()

    def _current_user(self) -> str:
        if not AUTH_REQUIRED:
            return "admin"
        session_id = self._session_id_from_request()
        if not session_id:
            return ""
        state = _get_session(session_id)
        if not state:
            return ""
        return str(state.get("username") or "").strip()

    def _auth_me_payload(self) -> dict:
        if not AUTH_REQUIRED:
            return {
                "ok": True,
                "auth_required": False,
                "auth_configured": AUTH_CONFIGURED,
                "authenticated": True,
                "user": "admin",
                "mode": "open",
            }
        if not AUTH_CONFIGURED:
            return {
                "ok": True,
                "auth_required": True,
                "auth_configured": False,
                "authenticated": False,
                "user": "",
                "mode": "misconfigured",
                "error": "INTEL_ADMIN_USER / INTEL_ADMIN_PASS_HASH 未設定，管理功能已鎖定。",
            }
        user = self._current_user()
        return {
            "ok": True,
            "auth_required": True,
            "auth_configured": True,
            "authenticated": bool(user),
            "user": user,
            "mode": "protected",
        }

    def _require_admin_access(self) -> bool:
        if not AUTH_REQUIRED:
            return True
        if not AUTH_CONFIGURED:
            self._send_json(
                {
                    "ok": False,
                    "error": "管理帳號尚未設定。請設定 INTEL_ADMIN_USER 與 INTEL_ADMIN_PASS_HASH。",
                },
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return False
        if self._current_user():
            return True
        self._send_json(
            {
                "ok": False,
                "error": "需要登入管理員帳號才能查看或執行此操作。",
                "auth_required": True,
            },
            status=HTTPStatus.UNAUTHORIZED,
        )
        return False

    def _send_json(
        self,
        payload: dict,
        status: HTTPStatus = HTTPStatus.OK,
        extra_headers: dict[str, str] | list[tuple[str, str]] | None = None,
    ) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        if isinstance(extra_headers, dict):
            for key, value in extra_headers.items():
                self.send_header(str(key), str(value))
        elif isinstance(extra_headers, list):
            for key, value in extra_headers:
                self.send_header(str(key), str(value))
        self.end_headers()
        self.wfile.write(raw)

    def _require_admin(self, path: str) -> bool:
        if path not in PROTECTED_POST_PATHS:
            return True
        return self._require_admin_access()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self._request_path()
        if self._send_data_file(path):
            return
        if path == "/api/auth/me":
            self._send_json(self._auth_me_payload())
            return
        if path == "/api/intel/admin-status":
            if not self._require_admin_access():
                return
            try:
                query = urlparse(self.path).query
                params = parse_qs(query, keep_blank_values=False)
                limit = _safe_int((params.get("limit") or ["10"])[0], 10)
                status_payload = _build_admin_status(limit=limit)
                self._send_json({"ok": True, "status": status_payload})
            except Exception as exc:
                self._send_json({"ok": False, "error": f"failed to build admin status: {exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if path == "/api/intel/feed":
            if not FEED_PATH.exists():
                self._send_json({"ok": False, "error": "feed not found"}, status=HTTPStatus.NOT_FOUND)
                return
            try:
                query = urlparse(self.path).query
                params = parse_qs(query, keep_blank_values=False)
                request_lang = str((params.get("lang") or ["zh-Hant"])[0] or "zh-Hant")
            except Exception:
                request_lang = "zh-Hant"
            try:
                feed = json.loads(FEED_PATH.read_text(encoding="utf-8"))
            except Exception as exc:
                self._send_json({"ok": False, "error": f"failed to read feed: {exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return
            if not isinstance(feed, dict):
                self._send_json({"ok": False, "error": "feed format invalid"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return
            localized_feed = localized_feed_from_bundle(feed, request_lang)
            self._send_json({"ok": True, "feed": localized_feed, "lang": _normalize_lang_tag(request_lang)})
            return
        if path.startswith("/api/"):
            self._send_json({"ok": False, "error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = self._request_path()
        if path not in {
            "/api/auth/login",
            "/api/auth/logout",
            "/api/intel/sync",
            "/api/intel/analyze-url",
            "/api/intel/pick",
            "/api/intel/timeline",
            "/api/intel/event-wall",
            "/api/intel/sbt-fields",
            "/api/intel/feedback",
            "/api/intel/source-config",
            "/api/intel/job-status",
            "/api/intel/backup",
            "/api/intel/restore",
            "/api/intel/retranslate",
            "/api/intel/pokemon-news",
            "/api/intel/translate-texts",
        }:
            self._send_json({"ok": False, "error": "Not found"}, status=HTTPStatus.NOT_FOUND)
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            payload = {}

        if path == "/api/auth/login":
            username = str(payload.get("username") or "").strip()
            password = str(payload.get("password") or "")
            if not AUTH_REQUIRED:
                self._send_json(
                    {
                        "ok": True,
                        "auth_required": False,
                        "authenticated": True,
                        "user": "admin",
                        "mode": "open",
                    }
                )
                return
            if not AUTH_CONFIGURED:
                self._send_json(
                    {
                        "ok": False,
                        "error": "管理帳號尚未設定。請設定 INTEL_ADMIN_USER 與 INTEL_ADMIN_PASS_HASH。",
                    },
                    status=HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            if username != AUTH_USERNAME or not _verify_password(password):
                self._send_json({"ok": False, "error": "帳號或密碼錯誤"}, status=HTTPStatus.UNAUTHORIZED)
                return
            sid = _create_session(username)
            self._send_json(
                {
                    "ok": True,
                    "auth_required": True,
                    "auth_configured": True,
                    "authenticated": True,
                    "user": username,
                    "mode": "protected",
                    "token": sid,
                },
                extra_headers={"Set-Cookie": self._session_cookie_header(sid)},
            )
            return

        if path == "/api/auth/logout":
            sid = self._session_id_from_request()
            _delete_session(sid)
            self._send_json(
                {
                    "ok": True,
                    "auth_required": AUTH_REQUIRED,
                    "auth_configured": AUTH_CONFIGURED,
                    "authenticated": False,
                    "user": "",
                    "mode": "protected" if AUTH_REQUIRED else "open",
                },
                extra_headers={"Set-Cookie": self._clear_session_cookie_header()},
            )
            return

        if path == "/api/intel/translate-texts":
            lang = _normalize_lang_tag(payload.get("lang"))
            raw_texts = payload.get("texts")
            if not isinstance(raw_texts, list):
                self._send_json({"ok": False, "error": "texts must be an array"}, status=HTTPStatus.BAD_REQUEST)
                return
            rows: list[str] = []
            for item in raw_texts[:TRANSLATE_MAX_ITEMS]:
                text = str(item or "").strip()
                if not text:
                    rows.append("")
                    continue
                rows.append(text[:TRANSLATE_MAX_CHARS])
            translated, mode = translate_texts(rows, lang=lang)
            self._send_json(
                {
                    "ok": True,
                    "lang": lang,
                    "mode": mode,
                    "items": translated,
                }
            )
            return

        if not self._require_admin(path):
            return

        try:
            if path == "/api/intel/sync":
                accounts = payload.get("accounts")
                if isinstance(accounts, list):
                    accounts = [str(x).strip().lstrip("@") for x in accounts if str(x).strip()]
                else:
                    accounts = None
                days = int(payload.get("days", 30) or 30)
                trigger = self._current_user() or "manual"
                result = _run_intel_sync(accounts=accounts, days=max(1, days), trigger=trigger)
                self._send_json({"ok": True, "feed": result})
                return

            if path == "/api/intel/pick":
                tweet_id = str(payload.get("id") or "").strip()
                action = str(payload.get("action") or "").strip().lower()
                reason = str(payload.get("reason") or "").strip()
                selection = set_manual_selection(tweet_id, action)
                feedback = None
                if action == "exclude" and reason:
                    feedback = add_classification_feedback(tweet_id, "exclude", reason=reason)
                result = sync_accounts()
                build_i18n_feed_bundle_async(result, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json({"ok": True, "selection": selection, "feedback": feedback, "feed": result})
                return

            if path == "/api/intel/timeline":
                tweet_id = str(payload.get("id") or "").strip()
                timeline_date = str(payload.get("timeline_date") or "").strip()
                timeline_end_date = str(payload.get("timeline_end_date") or "").strip()
                update = update_card_timeline_fields(tweet_id, timeline_date=timeline_date, timeline_end_date=timeline_end_date)
                feed = _read_feed_snapshot()
                build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json({"ok": True, "update": update, "feed": feed})
                return

            if path == "/api/intel/event-wall":
                tweet_id = str(payload.get("id") or "").strip()
                update = update_card_event_wall_field(tweet_id, bool(payload.get("event_wall")))
                feed = _read_feed_snapshot()
                build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json({"ok": True, "update": update, "feed": feed})
                return

            if path == "/api/intel/sbt-fields":
                tweet_id = str(payload.get("id") or "").strip()
                update = update_card_sbt_fields(
                    tweet_id,
                    sbt_names=payload.get("sbt_names") or "",
                    sbt_acquisition=str(payload.get("sbt_acquisition") or "").strip(),
                )
                feed = _read_feed_snapshot()
                build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json({"ok": True, "update": update, "feed": feed})
                return

            if path == "/api/intel/feedback":
                tweet_id = str(payload.get("id") or "").strip()
                label = str(payload.get("label") or "").strip().lower()
                card_type = str(payload.get("card_type") or "").strip().lower()
                section = str(payload.get("section") or payload.get("topic_label") or "").strip().lower()
                topic_labels = payload.get("topic_labels")
                reason = str(payload.get("reason") or "").strip()
                if card_type or section or isinstance(topic_labels, list):
                    feedback = add_classification_feedback_fields(tweet_id, card_type=card_type, topic_label=section, topic_labels=topic_labels if isinstance(topic_labels, list) else None, reason=reason)
                    update = update_card_classification_fields(tweet_id, card_type=card_type, topic_label=section, topic_labels=topic_labels if isinstance(topic_labels, list) else None)
                else:
                    feedback = add_classification_feedback(tweet_id, label, reason=reason)
                    if label in ALLOWED_CARD_TYPES or label in ALLOWED_TOPIC_LABELS:
                        update = update_card_classification_fields(
                            tweet_id,
                            card_type=label if label in ALLOWED_CARD_TYPES else "",
                            topic_label=label if label in ALLOWED_TOPIC_LABELS else "",
                        )
                    else:
                        update = {"id": tweet_id, "skipped": True, "reason": "no_card_field_patch"}
                feed = _read_feed_snapshot()
                build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json({"ok": True, "feedback": feedback, "update": update, "feed": feed})
                return

            if path == "/api/intel/source-config":
                action = str(payload.get("action") or "").strip().lower()
                account = str(payload.get("account") or "").strip()
                accounts = payload.get("accounts")
                source = update_x_source_accounts(action=action, account=account, accounts=accounts if isinstance(accounts, list) else None)
                self._send_json({"ok": True, "source": source})
                return

            if path == "/api/intel/job-status":
                job_id = str(payload.get("id") or "").strip()
                if not job_id:
                    self._send_json({"ok": False, "error": "id is required"}, status=HTTPStatus.BAD_REQUEST)
                    return
                job = _get_job(job_id)
                if not job:
                    self._send_json({"ok": False, "error": "job not found"}, status=HTTPStatus.NOT_FOUND)
                    return
                self._send_json({"ok": True, "job": job})
                return

            if path == "/api/intel/backup":
                started = _spawn_website_backup(trigger=self._current_user() or "manual")
                self._send_json({"ok": True, "started": started, "backup": _backup_state_snapshot()})
                return

            if path == "/api/intel/restore":
                global RESTORE_STATE
                force_restore = bool(payload.get("force"))
                restore = restore_website_data_from_backup(DATA_ROOT, ROOT.parent, force=force_restore)
                restore = {
                    **restore,
                    "trigger": self._current_user() or "manual",
                    "finished_at": _now_iso(),
                }
                RESTORE_STATE = restore
                feed = None
                if restore.get("ok") is not False and restore.get("restored"):
                    feed = _read_feed_snapshot()
                    build_i18n_feed_bundle_async(feed, force=False, target_langs=["en", "ko", "zh-Hans"])
                self._send_json(
                    {
                        "ok": True,
                        "restore": restore,
                        "feed": feed,
                    }
                )
                return

            if path == "/api/intel/retranslate":
                lang_raw = str(payload.get("lang") or "").strip().lower()
                if not lang_raw or lang_raw == "all":
                    target_langs = ["en", "ko", "zh-Hans"]
                else:
                    target_langs = [x.strip() for x in lang_raw.split(",") if x.strip()]
                mode_raw = str(payload.get("mode") or "").strip().lower()
                force_full = bool(payload.get("force")) or mode_raw in {"full", "reset", "rebuild"}
                feed = _read_feed_snapshot()
                if not isinstance(feed, dict) or not isinstance(feed.get("cards"), list):
                    self._send_json({"ok": False, "error": "feed not ready"}, status=HTTPStatus.SERVICE_UNAVAILABLE)
                    return
                result = queue_i18n_retranslate(feed, target_langs=target_langs, force_full=force_full)
                self._send_json({"ok": True, "retranslate": result, "i18n": i18n_state_snapshot()})
                return

            if path == "/api/intel/pokemon-news":
                force = bool(payload.get("force"))
                max_items = int(payload.get("max_items", 8) or 8)
                lang = str(payload.get("lang") or "").strip() or "zh-Hant"
                cache = _read_news_cache(lang)
                needs_refresh = force or (not cache) or (not _is_news_cache_fresh(cache))
                started = _spawn_pokemon_news_refresh(lang, max_items=max(3, min(max_items, 16)), reason="manual" if force else "on-demand") if needs_refresh else False
                if cache:
                    cache_payload = dict(cache)
                    cache_payload["cached"] = True
                    news = _compose_news_payload(cache_payload, lang, pending=False, refresh_started=started)
                else:
                    news = _compose_news_payload({}, lang, pending=True, refresh_started=started)
                    news["message"] = "背景更新中，稍後會自動顯示最新消息。"
                self._send_json({"ok": True, "news": news})
                return

            url = str(payload.get("url") or "").strip()
            if not url:
                self._send_json({"ok": False, "error": "url is required"}, status=HTTPStatus.BAD_REQUEST)
                return
            job = _enqueue_analyze_job(url)
            self._send_json({"ok": True, "job": job})
        except Exception as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local website AI intel server")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8787, help="Bind port")
    parser.add_argument("--news-interval-minutes", type=int, default=DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES, help="Pokemon news auto refresh interval in minutes")
    parser.add_argument("--news-langs", default="zh-Hant", help="Comma separated language tags for background news cache")
    parser.add_argument(
        "--sync-interval-hours",
        type=float,
        default=float(os.getenv("X_SYNC_INTERVAL_HOURS", str(DEFAULT_X_SYNC_INTERVAL_HOURS)) or DEFAULT_X_SYNC_INTERVAL_HOURS),
        help="X/Discord intel auto sync interval in hours",
    )
    parser.add_argument(
        "--sync-window-days",
        type=int,
        default=int(os.getenv("X_SYNC_WINDOW_DAYS", str(DEFAULT_X_SYNC_WINDOW_DAYS)) or DEFAULT_X_SYNC_WINDOW_DAYS),
        help="X/Discord intel sync window in days",
    )
    parser.add_argument(
        "--sync-run-on-startup",
        action="store_true",
        default=_env_flag("X_SYNC_RUN_ON_STARTUP", False),
        help="Run one X/Discord sync shortly after server startup",
    )
    parser.add_argument(
        "--no-sync-scheduler",
        action="store_true",
        default=not _env_flag("X_SYNC_ENABLED", True),
        help="Disable automatic X/Discord intel sync scheduler",
    )
    args = parser.parse_args()

    langs = [str(x).strip() for x in str(args.news_langs or "").split(",") if str(x).strip()]
    _start_pokemon_news_scheduler(interval_minutes=max(1, int(args.news_interval_minutes)), langs=langs, max_items=DEFAULT_POKEMON_NEWS_MAX_ITEMS)
    if args.no_sync_scheduler:
        _mark_sync_schedule(
            enabled=False,
            interval_hours=max(0.25, float(args.sync_interval_hours)),
            window_days=max(1, int(args.sync_window_days)),
        )
    else:
        _start_x_sync_scheduler(
            interval_hours=max(0.25, float(args.sync_interval_hours)),
            window_days=max(1, int(args.sync_window_days)),
            run_on_startup=bool(args.sync_run_on_startup),
        )
    if I18N_WARM_ON_STARTUP:
        _warm_i18n_bundle_from_feed()
    start_website_backup_scheduler(DATA_ROOT, ROOT.parent)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[ai-intel] serving api={ROOT} static={STATIC_ROOT} at http://{args.host}:{args.port}")
    print(
        "[ai-intel] storage "
        f"data_root={DATA_ROOT} symlink={bool(STORAGE_STATE.get('using_symlink'))} "
        f"migrated={bool(STORAGE_STATE.get('migrated'))}"
    )
    print(f"[ai-intel] pokemon news auto refresh every {max(1, int(args.news_interval_minutes))} minutes; langs={langs or ['zh-Hant']}")
    if args.no_sync_scheduler:
        print("[ai-intel] X/Discord auto sync disabled")
    else:
        print(
            "[ai-intel] X/Discord auto sync "
            f"every {max(0.25, float(args.sync_interval_hours)):g} hours; "
            f"window_days={max(1, int(args.sync_window_days))}; "
            f"startup={bool(args.sync_run_on_startup)}"
        )
    print(
        "[ai-intel] API endpoints: "
        "GET /api/auth/me, POST /api/auth/login, POST /api/auth/logout, GET /api/intel/feed, GET /api/intel/admin-status, "
        "POST /api/intel/sync, POST /api/intel/analyze-url, POST /api/intel/pick, "
        "POST /api/intel/timeline, POST /api/intel/event-wall, POST /api/intel/sbt-fields, "
        "POST /api/intel/feedback, POST /api/intel/source-config, POST /api/intel/job-status, POST /api/intel/backup, POST /api/intel/restore, POST /api/intel/retranslate, POST /api/intel/pokemon-news, "
        "POST /api/intel/translate-texts"
    )
    print(
        "[ai-intel] auth mode: "
        f"required={AUTH_REQUIRED}, configured={AUTH_CONFIGURED}, "
        f"user={'set' if AUTH_USERNAME else 'unset'}, "
        f"allowed_origins={sorted(ALLOWED_ORIGINS)}"
    )
    print(f"[ai-intel] i18n warm on startup: {bool(I18N_WARM_ON_STARTUP)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
