#!/usr/bin/env python3
"""Durable, hashed storage for admin sessions and OIDC login challenges."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from pathlib import Path
from threading import RLock
from typing import Any


def _token_key(value: str) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


class AuthStateStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=8)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=8000")
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS admin_sessions (token_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at REAL NOT NULL)")
            connection.execute("CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at)")
            connection.execute("CREATE TABLE IF NOT EXISTS oidc_challenges (state_key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at REAL NOT NULL)")
            connection.execute("CREATE INDEX IF NOT EXISTS oidc_challenges_expiry ON oidc_challenges(expires_at)")

    def _purge(self, connection: sqlite3.Connection) -> None:
        now = time.time()
        connection.execute("DELETE FROM admin_sessions WHERE expires_at <= ?", (now,))
        connection.execute("DELETE FROM oidc_challenges WHERE expires_at <= ?", (now,))

    def save_session(self, token: str, payload: dict[str, Any], expires_at: float) -> None:
        with self._lock, self._connect() as connection:
            self._purge(connection)
            connection.execute(
                "INSERT OR REPLACE INTO admin_sessions(token_key, payload, expires_at) VALUES (?, ?, ?)",
                (_token_key(token), json.dumps(payload, ensure_ascii=False), float(expires_at)),
            )

    def get_session(self, token: str) -> dict[str, Any] | None:
        if not str(token or "").strip():
            return None
        with self._lock, self._connect() as connection:
            self._purge(connection)
            row = connection.execute("SELECT payload FROM admin_sessions WHERE token_key = ?", (_token_key(token),)).fetchone()
        if not row:
            return None
        try:
            payload = json.loads(str(row[0]))
        except Exception:
            return None
        return payload if isinstance(payload, dict) else None

    def delete_session(self, token: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM admin_sessions WHERE token_key = ?", (_token_key(token),))

    def save_challenge(self, state: str, payload: dict[str, Any], expires_at: float) -> None:
        with self._lock, self._connect() as connection:
            self._purge(connection)
            connection.execute(
                "INSERT OR REPLACE INTO oidc_challenges(state_key, payload, expires_at) VALUES (?, ?, ?)",
                (_token_key(state), json.dumps(payload, ensure_ascii=False), float(expires_at)),
            )

    def consume_challenge(self, state: str) -> dict[str, Any] | None:
        if not str(state or "").strip():
            return None
        key = _token_key(state)
        with self._lock, self._connect() as connection:
            self._purge(connection)
            row = connection.execute("SELECT payload FROM oidc_challenges WHERE state_key = ?", (key,)).fetchone()
            connection.execute("DELETE FROM oidc_challenges WHERE state_key = ?", (key,))
        if not row:
            return None
        try:
            payload = json.loads(str(row[0]))
        except Exception:
            return None
        return payload if isinstance(payload, dict) else None
