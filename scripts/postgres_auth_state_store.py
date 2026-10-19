"""Shared, hashed authentication state without a local SQLite file."""

from __future__ import annotations

import time
from threading import RLock
from typing import Any

from psycopg2.extras import Json

from admin_session_store import _token_key
from neon_feed_store import database_connection


class PostgresAuthStateStore:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._initialized = False
        self._lock = RLock()

    def _ensure_schema(self):
        with self._lock:
            if self._initialized:
                return
            self._initialize()
            self._initialized = True

    def _initialize(self):
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(2026101701)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hub_admin_sessions (
                    token_key TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    expires_at DOUBLE PRECISION NOT NULL
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS hub_admin_sessions_expiry ON hub_admin_sessions(expires_at)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hub_oidc_challenges (
                    state_key TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    expires_at DOUBLE PRECISION NOT NULL
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS hub_oidc_challenges_expiry ON hub_oidc_challenges(expires_at)")

    def save_session(self, token: str, payload: dict[str, Any], expires_at: float) -> None:
        self._ensure_schema()
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM hub_admin_sessions WHERE expires_at <= %s", (time.time(),))
            cursor.execute(
                """INSERT INTO hub_admin_sessions (token_key, payload, expires_at) VALUES (%s, %s, %s)
                   ON CONFLICT (token_key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at""",
                (_token_key(token), Json(payload), float(expires_at)),
            )

    def get_session(self, token: str) -> dict[str, Any] | None:
        if not str(token or "").strip():
            return None
        self._ensure_schema()
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT payload FROM hub_admin_sessions WHERE token_key = %s AND expires_at > %s",
                (_token_key(token), time.time()),
            )
            row = cursor.fetchone()
        return row[0] if row else None

    def delete_session(self, token: str) -> None:
        self._ensure_schema()
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM hub_admin_sessions WHERE token_key = %s", (_token_key(token),))

    def save_challenge(self, state: str, payload: dict[str, Any], expires_at: float) -> None:
        self._ensure_schema()
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM hub_oidc_challenges WHERE expires_at <= %s", (time.time(),))
            cursor.execute(
                """INSERT INTO hub_oidc_challenges (state_key, payload, expires_at) VALUES (%s, %s, %s)
                   ON CONFLICT (state_key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at""",
                (_token_key(state), Json(payload), float(expires_at)),
            )

    def consume_challenge(self, state: str) -> dict[str, Any] | None:
        if not str(state or "").strip():
            return None
        # DELETE ... RETURNING lets only one concurrent callback consume a state.
        self._ensure_schema()
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM hub_oidc_challenges WHERE state_key = %s RETURNING payload, expires_at",
                (_token_key(state),),
            )
            row = cursor.fetchone()
        return row[0] if row and float(row[1]) > time.time() else None
