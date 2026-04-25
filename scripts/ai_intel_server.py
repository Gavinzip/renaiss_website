#!/usr/bin/env python3
"""Local server for website + AI intel ingest API."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
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
from urllib.parse import urlparse
from uuid import uuid4

from minimax_news import fetch_pokemon_latest_news
from x_intel_core import add_classification_feedback, add_manual_tweet, set_manual_selection, sync_accounts

ROOT = Path(__file__).resolve().parents[1]
FEED_PATH = ROOT / "data" / "x_intel_feed.json"
JOBS_PATH = ROOT / "data" / "x_intel_jobs.json"
POKEMON_NEWS_CACHE_PATH = ROOT / "data" / "pokemon_latest_news.json"
JOBS_LOCK = Lock()
POKEMON_NEWS_LOCK = Lock()
POKEMON_NEWS_STATE_LOCK = Lock()
SESSIONS_LOCK = Lock()
SESSIONS: dict[str, dict[str, str]] = {}
MAX_JOB_ITEMS = 120
POKEMON_NEWS_CACHE_MINUTES = 50
DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES = 60
DEFAULT_POKEMON_NEWS_MAX_ITEMS = 8
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
    "/api/intel/feedback",
    "/api/intel/job-status",
}


def _env_flag(name: str, default: bool = False) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    if not raw:
        return bool(default)
    return raw in {"1", "true", "yes", "y", "on"}


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
    return set(parts) or set(DEFAULT_ALLOWED_ORIGINS)


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
    raw = str(lang or "").strip()
    if not raw:
        return "zh-Hant"
    return raw


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
    return ROOT / "data" / f"pokemon_latest_news_{safe}.json"


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
            "provider": "minimax_mcp_web_search",
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
    try:
        fresh = fetch_pokemon_latest_news(
            max_items=max(3, min(int(max_items), 16)),
            lang=lang_tag,
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


def _refresh_pokemon_news_worker(lang: str, max_items: int, reason: str) -> None:
    tag = _normalize_lang_tag(lang)
    try:
        news = _get_pokemon_news(force=True, max_items=max_items, lang=tag)
        warning = str(news.get("warning") or "").strip()
        refresh_at = str(news.get("generated_at") or _now_iso()).strip() or _now_iso()
        _update_news_state(tag, refreshing=False, last_refresh_at=refresh_at, last_error=warning, last_reason=reason)
    except Exception as exc:
        _update_news_state(tag, refreshing=False, last_error=str(exc), last_reason=reason)


def _spawn_pokemon_news_refresh(lang: str, max_items: int, reason: str) -> bool:
    tag = _normalize_lang_tag(lang)
    with POKEMON_NEWS_STATE_LOCK:
        state = _state_for_lang_unlocked(tag)
        if bool(state.get("refreshing")):
            return False
        state["refreshing"] = True
        state["last_reason"] = reason
        state["updated_at"] = _now_iso()
    Thread(target=_refresh_pokemon_news_worker, args=(tag, max_items, reason), daemon=True).start()
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
    for lang in normalized_langs:
        _update_news_state(lang, interval_minutes=safe_interval_min, next_refresh_at=first_next)
        _spawn_pokemon_news_refresh(lang, max_items=max_items, reason="startup")

    def _loop() -> None:
        while True:
            time.sleep(interval_seconds)
            next_run = (datetime.now(timezone.utc) + timedelta(seconds=interval_seconds)).isoformat()
            for lang in normalized_langs:
                _update_news_state(lang, interval_minutes=safe_interval_min, next_refresh_at=next_run)
                _spawn_pokemon_news_refresh(lang, max_items=max_items, reason="scheduled")

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
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _request_path(self) -> str:
        return str(urlparse(self.path).path or "/").strip() or "/"

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

    def _current_user(self) -> str:
        if not AUTH_REQUIRED:
            return "admin"
        session_id = self._session_id_from_cookie()
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
                "error": "需要登入管理員帳號才能執行此操作。",
                "auth_required": True,
            },
            status=HTTPStatus.UNAUTHORIZED,
        )
        return False

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self._request_path()
        if path == "/api/auth/me":
            self._send_json(self._auth_me_payload())
            return
        if path == "/api/intel/feed":
            if not FEED_PATH.exists():
                self._send_json({"ok": False, "error": "feed not found"}, status=HTTPStatus.NOT_FOUND)
                return
            try:
                feed = json.loads(FEED_PATH.read_text(encoding="utf-8"))
            except Exception as exc:
                self._send_json({"ok": False, "error": f"failed to read feed: {exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return
            if not isinstance(feed, dict):
                self._send_json({"ok": False, "error": "feed format invalid"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)
                return
            self._send_json({"ok": True, "feed": feed})
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
            "/api/intel/feedback",
            "/api/intel/job-status",
            "/api/intel/pokemon-news",
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
                },
                extra_headers={"Set-Cookie": self._session_cookie_header(sid)},
            )
            return

        if path == "/api/auth/logout":
            sid = self._session_id_from_cookie()
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
                result = sync_accounts(accounts=accounts, window_days=max(1, days))
                self._send_json({"ok": True, "feed": result})
                return

            if path == "/api/intel/pick":
                tweet_id = str(payload.get("id") or "").strip()
                action = str(payload.get("action") or "").strip().lower()
                selection = set_manual_selection(tweet_id, action)
                result = sync_accounts()
                self._send_json({"ok": True, "selection": selection, "feed": result})
                return

            if path == "/api/intel/feedback":
                tweet_id = str(payload.get("id") or "").strip()
                label = str(payload.get("label") or "").strip().lower()
                reason = str(payload.get("reason") or "").strip()
                feedback = add_classification_feedback(tweet_id, label, reason=reason)
                result = sync_accounts()
                self._send_json({"ok": True, "feedback": feedback, "feed": result})
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
    args = parser.parse_args()

    langs = [str(x).strip() for x in str(args.news_langs or "").split(",") if str(x).strip()]
    _start_pokemon_news_scheduler(interval_minutes=max(1, int(args.news_interval_minutes)), langs=langs, max_items=DEFAULT_POKEMON_NEWS_MAX_ITEMS)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[ai-intel] serving {ROOT} at http://{args.host}:{args.port}")
    print(f"[ai-intel] pokemon news auto refresh every {max(1, int(args.news_interval_minutes))} minutes; langs={langs or ['zh-Hant']}")
    print(
        "[ai-intel] API endpoints: "
        "GET /api/auth/me, POST /api/auth/login, POST /api/auth/logout, GET /api/intel/feed, "
        "POST /api/intel/sync, POST /api/intel/analyze-url, POST /api/intel/pick, "
        "POST /api/intel/feedback, POST /api/intel/job-status, POST /api/intel/pokemon-news"
    )
    print(
        "[ai-intel] auth mode: "
        f"required={AUTH_REQUIRED}, configured={AUTH_CONFIGURED}, "
        f"user={'set' if AUTH_USERNAME else 'unset'}, "
        f"allowed_origins={sorted(ALLOWED_ORIGINS)}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
