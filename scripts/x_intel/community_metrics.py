#!/usr/bin/env python3
"""Backfill regional community X engagement metrics for the pulse map."""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import fcntl
except Exception:  # pragma: no cover - Windows fallback for local tooling.
    fcntl = None  # type: ignore[assignment]

from .bootstrap import REGIONAL_COMMUNITY_X_HANDLE_LABELS, fetch_status_metadata, parse_datetime_guess

METRICS_BACKFILL_STATE_FILENAME = "x_intel_community_metrics_state.json"
METRICS_BACKFILL_LOCK_FILENAME = "x_intel_community_metrics.lock"
COMMUNITY_METRIC_ACCOUNTS = tuple(REGIONAL_COMMUNITY_X_HANDLE_LABELS)
TWEET_ID_RE = re.compile(r"/status/(\d+)")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value or 0)
    except Exception:
        return default


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _account_key(value: object) -> str:
    return str(value or "").strip().lstrip("@").lower()


def _tweet_id_from_card(card: dict[str, Any]) -> str:
    sid = str(card.get("id") or "").strip()
    if sid.isdigit():
        return sid
    match = TWEET_ID_RE.search(str(card.get("url") or ""))
    return match.group(1) if match else ""


def _card_dt(card: dict[str, Any]) -> datetime | None:
    return parse_datetime_guess(str(card.get("published_at") or ""))


def _card_age_ok(card: dict[str, Any], *, now: datetime, window_days: int) -> bool:
    if window_days <= 0:
        return True
    dt = _card_dt(card)
    if not dt:
        return True
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt >= now - timedelta(days=window_days)


def _trim_metrics(metrics: object) -> dict[str, int]:
    raw = metrics if isinstance(metrics, dict) else {}
    return {
        "likes": _safe_int(raw.get("likes"), 0),
        "replies": _safe_int(raw.get("replies", raw.get("comments")), 0),
    }


def _metrics_from_meta(meta: dict[str, Any] | None) -> dict[str, int] | None:
    if not isinstance(meta, dict):
        return None
    raw = meta.get("metrics") if isinstance(meta.get("metrics"), dict) else {}
    return {
        "likes": _safe_int(raw.get("likes"), 0),
        "replies": _safe_int(raw.get("replies", meta.get("conversation_count")), 0),
    }


def _merge_metrics(existing: object, incoming: dict[str, int]) -> dict[str, int]:
    current = _trim_metrics(existing)
    if (incoming.get("likes", 0) + incoming.get("replies", 0)) <= 0 and (
        current.get("likes", 0) + current.get("replies", 0)
    ) > 0:
        return current
    return {
        "likes": max(current.get("likes", 0), _safe_int(incoming.get("likes"), 0)),
        "replies": max(current.get("replies", 0), _safe_int(incoming.get("replies"), 0)),
    }


def _eligible_cards(cards: list[dict[str, Any]], *, now: datetime, window_days: int) -> list[dict[str, Any]]:
    wanted = {_account_key(x) for x in COMMUNITY_METRIC_ACCOUNTS}
    rows: list[dict[str, Any]] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        if _account_key(card.get("account")) not in wanted:
            continue
        if not _tweet_id_from_card(card):
            continue
        if not _card_age_ok(card, now=now, window_days=window_days):
            continue
        rows.append(card)
    rows.sort(key=lambda c: _card_dt(c) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return rows


def _totals(cards: list[dict[str, Any]]) -> dict[str, Any]:
    wanted = {_account_key(x): x for x in COMMUNITY_METRIC_ACCOUNTS}
    by_account: dict[str, dict[str, Any]] = {
        key: {"account": label, "likes": 0, "replies": 0, "posts": 0, "score": 0}
        for key, label in wanted.items()
    }
    for card in cards:
        if not isinstance(card, dict):
            continue
        key = _account_key(card.get("account"))
        if key not in by_account:
            continue
        metrics = _trim_metrics(card.get("metrics"))
        row = by_account[key]
        row["likes"] += metrics["likes"]
        row["replies"] += metrics["replies"]
        row["posts"] += 1
        row["score"] += metrics["likes"] + metrics["replies"]
    total_score = sum(_safe_int(row.get("score"), 0) for row in by_account.values())
    return {
        "score_basis": ["likes", "replies"],
        "total_score": total_score,
        "accounts": by_account,
    }


def _baseline_snapshot(history: list[dict[str, Any]], now: datetime) -> dict[str, Any] | None:
    if not history:
        return None
    cutoff = now - timedelta(hours=24)
    parsed: list[tuple[datetime, dict[str, Any]]] = []
    for row in history:
        if not isinstance(row, dict):
            continue
        dt = parse_datetime_guess(str(row.get("at") or ""))
        if not dt:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        parsed.append((dt, row))
    if not parsed:
        return None
    parsed.sort(key=lambda item: item[0])
    older = [item for item in parsed if item[0] <= cutoff]
    return (older[-1] if older else parsed[0])[1]


def _delta_payload(current: dict[str, Any], baseline: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(baseline, dict):
        return {
            "delta_24h_score": None,
            "delta_reference_at": "",
            "delta_24h_accounts": {},
        }
    current_accounts = current.get("accounts") if isinstance(current.get("accounts"), dict) else {}
    baseline_accounts = baseline.get("accounts") if isinstance(baseline.get("accounts"), dict) else {}
    deltas: dict[str, dict[str, int]] = {}
    for key, row in current_accounts.items():
        prev = baseline_accounts.get(key) if isinstance(baseline_accounts.get(key), dict) else {}
        if not isinstance(row, dict):
            continue
        deltas[str(key)] = {
            "score": _safe_int(row.get("score"), 0) - _safe_int(prev.get("score"), 0),
            "likes": _safe_int(row.get("likes"), 0) - _safe_int(prev.get("likes"), 0),
            "replies": _safe_int(row.get("replies"), 0) - _safe_int(prev.get("replies"), 0),
            "posts": _safe_int(row.get("posts"), 0) - _safe_int(prev.get("posts"), 0),
        }
    return {
        "delta_24h_score": _safe_int(current.get("total_score"), 0) - _safe_int(baseline.get("total_score"), 0),
        "delta_reference_at": str(baseline.get("at") or ""),
        "delta_24h_accounts": deltas,
    }


def _apply_metrics_to_i18n(i18n_path: Path, metrics_by_id: dict[str, dict[str, int]], community_metrics: dict[str, Any]) -> int:
    if not i18n_path.exists():
        return 0
    bundle = _read_json(i18n_path, {})
    if not isinstance(bundle, dict):
        return 0
    changed = 0
    changed_summary = bundle.get("community_metrics") != community_metrics
    bundle["community_metrics"] = community_metrics
    langs = bundle.get("langs") if isinstance(bundle.get("langs"), dict) else {}
    for payload in langs.values():
        if not isinstance(payload, dict):
            continue
        cards = payload.get("cards") if isinstance(payload.get("cards"), list) else []
        for card in cards:
            if not isinstance(card, dict):
                continue
            sid = _tweet_id_from_card(card)
            incoming = metrics_by_id.get(sid)
            if not incoming:
                continue
            merged = _merge_metrics(card.get("metrics"), incoming)
            if _trim_metrics(card.get("metrics")) != merged:
                card["metrics"] = merged
                changed += 1
        if payload.get("community_metrics") != community_metrics:
            payload["community_metrics"] = community_metrics
            changed_summary = True
    if changed or changed_summary:
        _write_json_atomic(i18n_path, bundle)
    return changed


def read_community_metrics_state(data_root: Path) -> dict[str, Any]:
    state = _read_json(Path(data_root) / METRICS_BACKFILL_STATE_FILENAME, {})
    return state if isinstance(state, dict) else {}


def update_community_metrics_state(data_root: Path, values: dict[str, Any]) -> dict[str, Any]:
    state = read_community_metrics_state(Path(data_root))
    if isinstance(values, dict):
        state.update(values)
    _write_state(Path(data_root), state)
    return state


def _write_state(data_root: Path, state: dict[str, Any]) -> None:
    _write_json_atomic(Path(data_root) / METRICS_BACKFILL_STATE_FILENAME, state)


def run_community_metrics_backfill(
    *,
    data_root: Path,
    feed_path: Path,
    i18n_feed_path: Path,
    max_cards: int = 160,
    delay_seconds: float = 3.0,
    window_days: int = 30,
    trigger: str = "scheduled",
) -> dict[str, Any]:
    data_root = Path(data_root)
    feed_path = Path(feed_path)
    i18n_feed_path = Path(i18n_feed_path)
    lock_path = data_root / METRICS_BACKFILL_LOCK_FILENAME
    lock_path.parent.mkdir(parents=True, exist_ok=True)

    with lock_path.open("w", encoding="utf-8") as lock_file:
        if fcntl is not None:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                state = read_community_metrics_state(data_root)
                state.update({"status": "skipped", "last_error": "another community metrics job is running", "trigger": trigger})
                _write_state(data_root, state)
                return state

        started = time.monotonic()
        now = _now()
        state = read_community_metrics_state(data_root)
        state.update(
            {
                "status": "running",
                "trigger": trigger,
                "started_at": now.isoformat(),
                "finished_at": "",
                "last_error": "",
                "max_cards": max_cards,
                "delay_seconds": delay_seconds,
                "window_days": window_days,
            }
        )
        _write_state(data_root, state)

        feed = _read_json(feed_path, {})
        if not isinstance(feed, dict):
            state.update({"status": "failed", "finished_at": _now_iso(), "last_error": "feed format invalid"})
            _write_state(data_root, state)
            return state

        cards = feed.get("cards") if isinstance(feed.get("cards"), list) else []
        card_rows = [card for card in cards if isinstance(card, dict)]
        selected = _eligible_cards(card_rows, now=now, window_days=max(0, int(window_days or 0)))
        limited = selected[: max(0, int(max_cards or 0))]
        metrics_by_id: dict[str, dict[str, int]] = {}
        checked = 0
        updated = 0
        errors = 0

        for idx, card in enumerate(limited):
            sid = _tweet_id_from_card(card)
            if not sid:
                continue
            checked += 1
            meta = fetch_status_metadata(sid, force=True)
            incoming = _metrics_from_meta(meta)
            if incoming is None:
                errors += 1
            else:
                merged = _merge_metrics(card.get("metrics"), incoming)
                if _trim_metrics(card.get("metrics")) != merged:
                    card["metrics"] = merged
                    updated += 1
                metrics_by_id[sid] = merged
            if idx < len(limited) - 1 and delay_seconds > 0:
                time.sleep(float(delay_seconds))

        current_totals = _totals(card_rows)
        history_raw = state.get("history") if isinstance(state.get("history"), list) else []
        baseline = _baseline_snapshot(history_raw, now)
        delta = _delta_payload(current_totals, baseline)
        snapshot = {"at": _now_iso(), **current_totals}
        history = [row for row in history_raw if isinstance(row, dict)]
        history.append(snapshot)
        history = history[-72:]

        community_metrics = {
            "updated_at": snapshot["at"],
            "interval_hours": 1,
            "window_days": max(0, int(window_days or 0)),
            "source": "tweet-result",
            "score_basis": ["likes", "replies"],
            "total_score": current_totals["total_score"],
            "accounts": current_totals["accounts"],
            **delta,
            "last_run": {
                "trigger": trigger,
                "checked": checked,
                "updated": updated,
                "errors": errors,
                "eligible_cards": len(selected),
                "skipped_due_to_limit": max(0, len(selected) - len(limited)),
                "duration_ms": max(0, int(round((time.monotonic() - started) * 1000))),
            },
        }

        feed["community_metrics"] = community_metrics
        _write_json_atomic(feed_path, feed)
        i18n_updated = _apply_metrics_to_i18n(i18n_feed_path, metrics_by_id, community_metrics)

        state.update(
            {
                "status": "ok",
                "finished_at": _now_iso(),
                "last_success_at": _now_iso(),
                "duration_ms": community_metrics["last_run"]["duration_ms"],
                "checked": checked,
                "updated": updated,
                "errors": errors,
                "eligible_cards": len(selected),
                "i18n_cards_updated": i18n_updated,
                "last_totals": current_totals,
                "community_metrics": community_metrics,
                "history": history,
            }
        )
        _write_state(data_root, state)
        return state
