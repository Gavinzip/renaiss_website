#!/usr/bin/env python3
"""Persistence for Expo portfolio/profile sync."""

from __future__ import annotations

import copy
import json
import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4


@dataclass(frozen=True)
class ProfileIdentity:
    privy_user_id: str
    email: str = ""
    display_name: str = ""


class ExpoProfileStore:
    """Profile store facade.

    Production should provide a Postgres URL. Local development can keep using
    the SQLite file so the Expo preview stays easy to run without services.
    """

    def __init__(self, db_path: Path, database_url: str | None = None):
        postgres_url = normalize_database_url(database_url or profile_database_url_from_env())
        self.backend = PostgresExpoProfileStore(postgres_url) if postgres_url else SQLiteExpoProfileStore(db_path)
        self.storage_key = self.backend.storage_key

    def __getattr__(self, name: str):
        return getattr(self.backend, name)


class SQLiteExpoProfileStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.storage_key = self.db_path.name
        self._lock = Lock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def get_or_create_user(self, identity: ProfileIdentity) -> dict[str, Any]:
        privy_user_id = identity.privy_user_id.strip()
        if not privy_user_id:
            raise ValueError("privy_user_id is required")

        now = _now_iso()
        with self._connect() as db, self._lock:
            row = db.execute(
                "select * from profile_users where privy_user_id = ?",
                (privy_user_id,),
            ).fetchone()
            if not row:
                user_id = str(uuid4())
                username = username_from_identity(identity, user_id)
                display_name = identity.display_name or identity.email or username
                db.execute(
                    """
                    insert into profile_users
                    (id, privy_user_id, email, username, display_name, created_at, updated_at)
                    values (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, privy_user_id, identity.email, username, display_name, now, now),
                )
                db.commit()
            else:
                display_name = identity.display_name or row["display_name"]
                email = identity.email or row["email"]
                db.execute(
                    """
                    update profile_users
                    set email = ?, display_name = ?, updated_at = ?
                    where id = ?
                    """,
                    (email, display_name, now, row["id"]),
                )
                db.commit()

            return self._auth_state_unlocked(db, privy_user_id)

    def bind_wallet(self, privy_user_id: str, address: str, label: str = "") -> dict[str, Any]:
        clean_address = normalize_address(address)
        if not clean_address:
            raise ValueError("Wallet address is required")

        now = _now_iso()
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            existing = db.execute(
                "select id from profile_wallets where user_id = ? and address = ?",
                (user["id"], clean_address),
            ).fetchone()
            if existing:
                db.execute(
                    """
                    update profile_wallets
                    set label = coalesce(nullif(?, ''), label), updated_at = ?
                    where id = ?
                    """,
                    (str(label or "").strip(), now, existing["id"]),
                )
            else:
                db.execute(
                    """
                    insert into profile_wallets
                    (id, user_id, address, label, created_at, updated_at, sync_status, card_count)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (str(uuid4()), user["id"], clean_address, str(label or "").strip(), now, now, "pending", 0),
                )
            db.commit()
            return self._auth_state_unlocked(db, privy_user_id)

    def remove_wallet(self, privy_user_id: str, wallet_id: str) -> dict[str, Any]:
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            db.execute("delete from profile_wallet_cards where user_id = ? and wallet_id = ?", (user["id"], wallet_id))
            db.execute("delete from profile_wallets where user_id = ? and id = ?", (user["id"], wallet_id))
            db.commit()
            return self._auth_state_unlocked(db, privy_user_id)

    def wallet_for_user(self, privy_user_id: str, wallet_id: str) -> dict[str, Any] | None:
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            row = db.execute(
                "select * from profile_wallets where user_id = ? and id = ?",
                (user["id"], wallet_id),
            ).fetchone()
            return dict(row) if row else None

    def mark_wallet_sync(
        self,
        privy_user_id: str,
        wallet_id: str,
        *,
        status: str,
        error: str = "",
        card_count: int | None = None,
    ) -> dict[str, Any]:
        now = _now_iso()
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            db.execute(
                """
                update profile_wallets
                set sync_status = ?, sync_error = ?, synced_at = ?, updated_at = ?,
                    card_count = coalesce(?, card_count)
                where user_id = ? and id = ?
                """,
                (status, error, now if status == "synced" else None, now, card_count, user["id"], wallet_id),
            )
            db.commit()
            return self._auth_state_unlocked(db, privy_user_id)

    def save_wallet_cards(self, privy_user_id: str, wallet_id: str, cards: list[dict[str, Any]]) -> None:
        now = _now_iso()
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            db.execute("delete from profile_wallet_cards where user_id = ? and wallet_id = ?", (user["id"], wallet_id))
            for card in cards:
                token_id = str(card.get("token_id") or card.get("tokenId") or "").strip()
                if not token_id:
                    continue
                db.execute(
                    """
                    insert into profile_wallet_cards (user_id, wallet_id, token_id, payload_json, updated_at)
                    values (?, ?, ?, ?, ?)
                    on conflict(user_id, token_id) do update set
                        wallet_id = excluded.wallet_id,
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """,
                    (user["id"], wallet_id, token_id, json.dumps(card, ensure_ascii=False, separators=(",", ":")), now),
                )
            db.commit()

    def load_wallet_cards(self, privy_user_id: str) -> list[dict[str, Any]]:
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            rows = db.execute(
                "select payload_json from profile_wallet_cards where user_id = ? order by updated_at desc",
                (user["id"],),
            ).fetchall()
            return [_json_dict(row["payload_json"]) for row in rows]

    def load_sync_state(self, privy_user_id: str) -> dict[str, Any]:
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            cards = [
                _json_dict(row["payload_json"])
                for row in db.execute(
                    "select payload_json from profile_collection_cards where user_id = ? order by updated_at desc",
                    (user["id"],),
                ).fetchall()
            ]
            state = db.execute("select * from profile_state where user_id = ?", (user["id"],)).fetchone()
            return {
                "cards": cards,
                "preferences": _json_dict(state["preferences_json"]) if state and state["preferences_json"] else None,
                "displayCache": _json_dict(state["display_cache_json"]) if state and state["display_cache_json"] else None,
                "updatedAt": state["updated_at"] if state else None,
            }

    def save_sync_state(
        self,
        privy_user_id: str,
        *,
        cards: list[Any],
        preferences: dict[str, Any] | None,
        display_cache: dict[str, Any] | None,
    ) -> dict[str, Any]:
        now = _now_iso()
        with self._connect() as db, self._lock:
            user = self._require_user_unlocked(db, privy_user_id)
            db.execute("delete from profile_collection_cards where user_id = ?", (user["id"],))
            for raw_card in cards[:500]:
                card = sanitize_cloud_card(raw_card)
                card_id = str(card.get("id") or "").strip()
                if not card_id:
                    continue
                db.execute(
                    """
                    insert into profile_collection_cards (user_id, card_id, payload_json, updated_at)
                    values (?, ?, ?, ?)
                    on conflict(user_id, card_id) do update set
                        payload_json = excluded.payload_json,
                        updated_at = excluded.updated_at
                    """,
                    (user["id"], card_id, json.dumps(card, ensure_ascii=False, separators=(",", ":")), now),
                )
            db.execute(
                """
                insert into profile_state (user_id, preferences_json, display_cache_json, updated_at)
                values (?, ?, ?, ?)
                on conflict(user_id) do update set
                    preferences_json = excluded.preferences_json,
                    display_cache_json = excluded.display_cache_json,
                    updated_at = excluded.updated_at
                """,
                (
                    user["id"],
                    json.dumps(preferences or {}, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(sanitize_display_cache(display_cache), ensure_ascii=False, separators=(",", ":")),
                    now,
                ),
            )
            db.commit()
        return self.load_sync_state(privy_user_id)

    def delete_user(self, privy_user_id: str) -> dict[str, Any]:
        with self._connect() as db, self._lock:
            row = db.execute("select id from profile_users where privy_user_id = ?", (privy_user_id,)).fetchone()
            if row:
                user_id = row["id"]
                db.execute("delete from profile_collection_cards where user_id = ?", (user_id,))
                db.execute("delete from profile_wallet_cards where user_id = ?", (user_id,))
                db.execute("delete from profile_wallets where user_id = ?", (user_id,))
                db.execute("delete from profile_state where user_id = ?", (user_id,))
                db.execute("delete from profile_users where id = ?", (user_id,))
                db.commit()
            return self.empty_auth_state()

    def empty_auth_state(self) -> dict[str, Any]:
        with self._connect() as db:
            account_count = db.execute("select count(*) as count from profile_users").fetchone()["count"]
            wallet_count = db.execute("select count(*) as count from profile_wallets").fetchone()["count"]
            return {
                "user": None,
                "stats": {
                    "accountCount": int(account_count or 0),
                    "walletCount": int(wallet_count or 0),
                    "cardCount": 0,
                    "storageKey": self.storage_key,
                },
            }

    def auth_state(self, privy_user_id: str) -> dict[str, Any]:
        with self._connect() as db, self._lock:
            return self._auth_state_unlocked(db, privy_user_id)

    def _auth_state_unlocked(self, db: sqlite3.Connection, privy_user_id: str) -> dict[str, Any]:
        user = self._require_user_unlocked(db, privy_user_id)
        wallets = [
            wallet_row_payload(row)
            for row in db.execute(
                "select * from profile_wallets where user_id = ? order by created_at asc",
                (user["id"],),
            ).fetchall()
        ]
        account_count = db.execute("select count(*) as count from profile_users").fetchone()["count"]
        wallet_count = db.execute("select count(*) as count from profile_wallets").fetchone()["count"]
        card_count = db.execute(
            """
            select
              (select count(*) from profile_collection_cards where user_id = ?) +
              (select count(*) from profile_wallet_cards where user_id = ?) as count
            """,
            (user["id"], user["id"]),
        ).fetchone()["count"]
        return {
            "user": {
                "id": user["id"],
                "username": user["username"],
                "displayName": user["display_name"],
                "createdAt": user["created_at"],
                "updatedAt": user["updated_at"],
                "wallets": wallets,
            },
            "stats": {
                "accountCount": int(account_count or 0),
                "walletCount": int(wallet_count or 0),
                "cardCount": int(card_count or 0),
                "activeUserId": user["id"],
                "updatedAt": user["updated_at"],
                "storageKey": self.storage_key,
            },
        }

    def _require_user_unlocked(self, db: sqlite3.Connection, privy_user_id: str) -> sqlite3.Row:
        row = db.execute("select * from profile_users where privy_user_id = ?", (privy_user_id,)).fetchone()
        if not row:
            raise ValueError("Profile user has not been created")
        return row

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.db_path)
        db.row_factory = sqlite3.Row
        return db

    def _init_db(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                create table if not exists profile_users (
                  id text primary key,
                  privy_user_id text not null unique,
                  email text,
                  username text not null,
                  display_name text not null,
                  created_at text not null,
                  updated_at text not null
                );
                create table if not exists profile_wallets (
                  id text primary key,
                  user_id text not null,
                  address text not null,
                  label text,
                  created_at text not null,
                  updated_at text not null,
                  synced_at text,
                  sync_status text,
                  sync_error text,
                  card_count integer default 0,
                  unique(user_id, address)
                );
                create table if not exists profile_collection_cards (
                  user_id text not null,
                  card_id text not null,
                  payload_json text not null,
                  updated_at text not null,
                  primary key(user_id, card_id)
                );
                create table if not exists profile_wallet_cards (
                  user_id text not null,
                  wallet_id text not null,
                  token_id text not null,
                  payload_json text not null,
                  updated_at text not null,
                  primary key(user_id, token_id)
                );
                create table if not exists profile_state (
                  user_id text primary key,
                  preferences_json text,
                  display_cache_json text,
                  updated_at text not null
                );
                """
            )
            db.commit()


class PostgresExpoProfileStore(SQLiteExpoProfileStore):
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.storage_key = "postgres"
        self._lock = Lock()
        self._init_db()

    def _connect(self):
        return PostgresConnection(self.database_url)

    def _init_db(self) -> None:
        with self._connect() as db:
            db.execute(
                """
                create table if not exists profile_users (
                  id text primary key,
                  privy_user_id text not null unique,
                  email text,
                  username text not null,
                  display_name text not null,
                  created_at text not null,
                  updated_at text not null
                )
                """
            )
            db.execute(
                """
                create table if not exists profile_wallets (
                  id text primary key,
                  user_id text not null references profile_users(id) on delete cascade,
                  address text not null,
                  label text,
                  created_at text not null,
                  updated_at text not null,
                  synced_at text,
                  sync_status text,
                  sync_error text,
                  card_count integer default 0,
                  unique(user_id, address)
                )
                """
            )
            db.execute(
                """
                create table if not exists profile_collection_cards (
                  user_id text not null references profile_users(id) on delete cascade,
                  card_id text not null,
                  payload_json jsonb not null,
                  updated_at text not null,
                  primary key(user_id, card_id)
                )
                """
            )
            db.execute(
                """
                create table if not exists profile_wallet_cards (
                  user_id text not null references profile_users(id) on delete cascade,
                  wallet_id text not null,
                  token_id text not null,
                  payload_json jsonb not null,
                  updated_at text not null,
                  primary key(user_id, token_id)
                )
                """
            )
            db.execute(
                """
                create table if not exists profile_state (
                  user_id text primary key references profile_users(id) on delete cascade,
                  preferences_json jsonb,
                  display_cache_json jsonb,
                  updated_at text not null
                )
                """
            )
            db.commit()


class PostgresConnection:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._conn = None

    def __enter__(self):
        try:
            import psycopg2
            import psycopg2.extras
        except Exception as exc:  # pragma: no cover - deployment dependency guard
            raise RuntimeError("psycopg2 is required for Expo profile Postgres storage") from exc

        self._conn = psycopg2.connect(self.database_url, cursor_factory=psycopg2.extras.RealDictCursor)
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        if not self._conn:
            return
        if exc_type:
            self._conn.rollback()
        self._conn.close()
        self._conn = None

    def execute(self, query: str, params: tuple[Any, ...] = ()):
        if not self._conn:
            raise RuntimeError("Postgres connection is not open")
        cursor = self._conn.cursor()
        cursor.execute(postgres_query(query), tuple(postgres_param(param) for param in params))
        return cursor

    def commit(self) -> None:
        if self._conn:
            self._conn.commit()


def sanitize_cloud_card(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    card = copy.deepcopy(value)
    for key in [
        "rawLookup",
        "cachedImageUri",
        "cachedImageBase64",
        "capturedImageUri",
        "capturedImageBase64",
        "imageBase64",
        "rawTrades",
    ]:
        card.pop(key, None)

    card["priceHistory"] = []

    card["listings"] = sanitize_listings(card.get("listings"))
    markets = card.get("markets") if isinstance(card.get("markets"), dict) else {}
    clean_markets: dict[str, Any] = {}
    for source, market_value in markets.items():
        if not isinstance(market_value, dict):
            continue
        market = copy.deepcopy(market_value)
        market.pop("rawTrades", None)
        market["listings"] = sanitize_listings(market.get("listings"))
        market["priceHistory"] = []
        clean_markets[str(source)] = market
    if clean_markets:
        card["markets"] = clean_markets
    else:
        card.pop("markets", None)
    return card


def sanitize_display_cache(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    cache = copy.deepcopy(value)
    cache["syncPolicy"] = {
        "includesSNKRRawTrades": False,
        "includesSNKRPriceHistory": False,
    }
    cards = cache.get("cards")
    cache["cards"] = cards[:500] if isinstance(cards, list) else []
    history = cache.get("portfolioHistory")
    cache["portfolioHistory"] = history[-730:] if isinstance(history, list) else []
    return cache


def sanitize_listings(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows = []
    for item in value[:100]:
        if not isinstance(item, dict):
            continue
        row = copy.deepcopy(item)
        row.pop("cachedImageUri", None)
        rows.append(row)
    return rows


def wallet_row_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "address": row["address"],
        "label": row["label"] or "",
        "createdAt": row["created_at"],
        "syncedAt": row["synced_at"],
        "syncStatus": row["sync_status"] or "pending",
        "syncError": row["sync_error"] or "",
        "cardCount": int(row["card_count"] or 0),
    }


def profile_database_url_from_env() -> str:
    for key in (
        "EXPO_PROFILE_DATABASE_URL",
        "DATABASE_URL",
        "POSTGRES_URI",
        "POSTGRES_URL",
        "POSTGRES_CONNECTION_STRING",
        "POSTGRESQL_URL",
    ):
        value = normalize_database_url(os.getenv(key))
        if value:
            return value

    host = str(os.getenv("POSTGRES_HOST") or os.getenv("POSTGRESQL_HOST") or "").strip()
    if not host:
        return ""
    port = str(os.getenv("POSTGRES_PORT") or os.getenv("POSTGRESQL_PORT") or "5432").strip()
    database = str(os.getenv("POSTGRES_DB") or os.getenv("POSTGRES_DATABASE") or os.getenv("POSTGRESQL_DATABASE") or "zeabur").strip()
    user = str(os.getenv("POSTGRES_USER") or os.getenv("POSTGRES_USERNAME") or os.getenv("POSTGRESQL_USER") or "root").strip()
    password = str(os.getenv("POSTGRES_PASSWORD") or os.getenv("POSTGRESQL_PASSWORD") or "").strip()
    if not user or not password:
        return ""
    return normalize_database_url(f"postgresql://{user}:{password}@{host}:{port}/{database}")


def normalize_database_url(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith("postgres://"):
        return f"postgresql://{text.removeprefix('postgres://')}"
    if text.startswith("postgresql://"):
        return text
    return ""


def postgres_query(query: str) -> str:
    return query.replace("?", "%s")


def postgres_param(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped or stripped[0] not in "{[":
        return value
    try:
        parsed = json.loads(stripped)
    except Exception:
        return value
    try:
        from psycopg2.extras import Json
    except Exception:
        return value
    return Json(parsed, dumps=lambda item: json.dumps(item, ensure_ascii=False, separators=(",", ":")))


def username_from_identity(identity: ProfileIdentity, user_id: str) -> str:
    source = identity.email.split("@", 1)[0] if identity.email else identity.privy_user_id.rsplit(":", 1)[-1]
    source = re.sub(r"[^A-Za-z0-9_]+", "_", source).strip("_").lower()
    return source[:24] or f"privy_{user_id[:8]}"


def normalize_address(value: str) -> str:
    text = str(value or "").strip().lower()
    return text if re.fullmatch(r"0x[a-f0-9]{40}", text) else ""


def _json_dict(value: str | None) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
