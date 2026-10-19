"""Transactional feed publications shared by the website and its worker."""

from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
from collections import OrderedDict
import copy
import os
from threading import RLock
from typing import Any, Iterator

import psycopg2
import certifi
from psycopg2.extras import Json
from psycopg2.pool import ThreadedConnectionPool
from hub_postgres_schema import PublicSchemaCursor


@lru_cache(maxsize=2)
def _connection_pool(database_url):
    configure_postgres_tls()
    return ThreadedConnectionPool(1, 4, database_url, connect_timeout=15, cursor_factory=PublicSchemaCursor)


def configure_postgres_tls() -> None:
    """Use a portable public CA bundle without disabling certificate checks."""
    os.environ.setdefault("PGSSLROOTCERT", certifi.where())


def website_database_url() -> str:
    value = str(os.getenv("WEBSITE_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not value.startswith(("postgres://", "postgresql://")):
        raise RuntimeError("A PostgreSQL WEBSITE_DATABASE_URL or DATABASE_URL is required")
    return value


@contextmanager
def database_connection(database_url: str) -> Iterator[Any]:
    if os.getenv('HUB_FORBID_DATABASE') == '1':
        raise RuntimeError('Neon access is forbidden during source/AI processing')
    configure_postgres_tls()
    pool = _connection_pool(database_url) if os.getenv('HUB_DB_POOL_ENABLED') == '1' else None
    from hub_database_audit import connection as audit_connection
    with audit_connection():
        connection = pool.getconn() if pool else psycopg2.connect(database_url, connect_timeout=15, cursor_factory=PublicSchemaCursor)
        try:
            if pool:
                # Reader transaction policy must not leak to a pool borrower.
                connection.set_session(isolation_level='READ COMMITTED', readonly=False, autocommit=False)
            with connection:
                yield connection
        finally:
            if pool:
                pool.putconn(connection, close=bool(connection.closed))
            else:
                connection.close()


class NeonFeedStore:
    """Publish an existing feed payload atomically, with retry deduplication.

    A feed is an application publication, rather than a copy of a filesystem.
    PostgreSQL failures propagate; no local file is used as a substitute.
    """

    def __init__(self, database_url: str):
        self.database_url = database_url
        self._read_cache = OrderedDict()
        self._cache_lock = RLock()
        with database_connection(database_url) as connection, connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(2026101701)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hub_feed_publications (
                    name TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    revision BIGINT NOT NULL DEFAULT 1,
                    writer TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hub_feed_publish_jobs (
                    job_key TEXT PRIMARY KEY,
                    publication_name TEXT NOT NULL,
                    revision BIGINT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)

    def read(self, name: str = "intel-feed") -> dict[str, Any] | None:
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            connection.set_session(isolation_level='REPEATABLE READ', readonly=True)
            cursor.execute("SELECT revision FROM hub_feed_publications WHERE name=%s", (name,))
            version = cursor.fetchone()
            if version is None:
                return None
            with self._cache_lock:
                cached = self._read_cache.get(name)
                if cached and cached[0] == version[0]:
                    self._read_cache.move_to_end(name)
                    return copy.deepcopy(cached[1])
            cursor.execute("SELECT payload FROM hub_feed_publications WHERE name = %s", (name,))
            row = cursor.fetchone()
        with self._cache_lock:
            self._read_cache[name] = (version[0], row[0])
            while len(self._read_cache) > 4:
                self._read_cache.popitem(last=False)
        return copy.deepcopy(row[0])

    def status(self, name: str = "intel-feed") -> dict[str, Any]:
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT revision, writer, updated_at FROM hub_feed_publications WHERE name = %s",
                (name,),
            )
            row = cursor.fetchone()
        if row is None:
            return {"storage": "postgres", "publication_exists": False}
        return {
            "storage": "postgres",
            "publication_exists": True,
            "revision": int(row[0]),
            "writer": row[1],
            "updated_at": row[2].isoformat(),
        }

    def publish(self, payload: dict[str, Any], *, job_key: str, writer: str, name: str = "intel-feed") -> dict[str, Any]:
        if not job_key or not writer or not isinstance(payload.get("cards"), list):
            raise ValueError("A job key, writer, and feed cards are required")
        with database_connection(self.database_url) as connection, connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO hub_feed_publish_jobs (job_key, publication_name)
                   VALUES (%s, %s) ON CONFLICT (job_key) DO NOTHING RETURNING job_key""",
                (job_key, name),
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    "SELECT publication_name, revision FROM hub_feed_publish_jobs WHERE job_key = %s",
                    (job_key,),
                )
                previous = cursor.fetchone()
                if previous[0] != name:
                    raise ValueError("The job key belongs to another publication")
                return {"published": False, "revision": int(previous[1])}
            cursor.execute(
                """INSERT INTO hub_feed_publications (name, payload, writer)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (name) DO UPDATE SET
                       payload = EXCLUDED.payload,
                       writer = EXCLUDED.writer,
                       revision = hub_feed_publications.revision + 1,
                       updated_at = CURRENT_TIMESTAMP
                   RETURNING revision""",
                (name, Json(payload), writer),
            )
            revision = int(cursor.fetchone()[0])
            cursor.execute(
                "UPDATE hub_feed_publish_jobs SET revision = %s WHERE job_key = %s",
                (revision, job_key),
            )
            return {"published": True, "revision": revision}


@lru_cache(maxsize=2)
def _cached_feed_store(database_url: str) -> NeonFeedStore:
    return NeonFeedStore(database_url)


def feed_store_from_environment() -> NeonFeedStore:
    return _cached_feed_store(website_database_url())
