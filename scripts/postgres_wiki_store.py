"""Atomic Wiki publications and revision history, without filesystem snapshots."""
from __future__ import annotations

from functools import lru_cache
from psycopg2.extras import Json, RealDictCursor

from neon_feed_store import database_connection, website_database_url
from hub_cache import initialize as initialize_cache, record, WIKI_TAG, VERSION_TAG
from wiki_content import WikiEditConflictError, validate_wiki_data, wiki_data_hash


def _document(row: dict) -> dict:
    meta = {key: row[key] for key in (
        "revision", "content_hash", "updated_by", "updated_role", "source_lang"
    )}
    meta.update(version=1, provider="postgres", source="postgres", editable=True,
                updated_at=row["updated_at"].isoformat(), **row["translation"])
    return {"exists": True, "data": row["data"], "meta": meta}


class PostgresWikiStore:
    def __init__(self, database_url: str):
        self.database_url = database_url
        with database_connection(database_url) as db, db.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101801)")
            initialize_cache(cur)
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_wiki_documents (
                slug TEXT PRIMARY KEY, data JSONB NOT NULL,
                revision BIGINT NOT NULL CHECK (revision > 0), content_hash TEXT NOT NULL,
                updated_by TEXT NOT NULL, updated_role TEXT NOT NULL, source_lang TEXT NOT NULL,
                translation JSONB NOT NULL DEFAULT '{}',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_wiki_revisions (
                slug TEXT NOT NULL, revision BIGINT NOT NULL, data JSONB NOT NULL,
                content_hash TEXT NOT NULL, updated_by TEXT NOT NULL, updated_role TEXT NOT NULL,
                source_lang TEXT NOT NULL, translation JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (slug, revision))""")

    @staticmethod
    def _record_revision(cur, slug: str) -> None:
        cur.execute("""INSERT INTO hub_wiki_revisions
            (slug,revision,data,content_hash,updated_by,updated_role,source_lang,translation,updated_at)
            SELECT slug,revision,data,content_hash,updated_by,updated_role,source_lang,translation,updated_at
            FROM hub_wiki_documents WHERE slug=%s""", (slug,))

    def read(self, slug: str = "beginner") -> dict:
        with database_connection(self.database_url) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM hub_wiki_documents WHERE slug=%s", (slug,))
            row = cur.fetchone()
        return _document(row) if row else {"exists": False, "data": None, "meta": {"provider": "postgres"}}

    def import_document(self, data: dict, *, actor: str, slug: str = "beginner") -> dict:
        """Seed a verified export once. Never overwrite an existing publication."""
        validate_wiki_data(data)
        content_hash = wiki_data_hash(data)
        with database_connection(self.database_url) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""INSERT INTO hub_wiki_documents
                (slug,data,revision,content_hash,updated_by,updated_role,source_lang)
                VALUES (%s,%s,1,%s,%s,'migration','zh-Hant')
                ON CONFLICT (slug) DO NOTHING RETURNING *""", (slug, Json(data), content_hash, actor))
            row = cur.fetchone()
            if row:
                self._record_revision(cur, slug)
                record(cur, WIKI_TAG, VERSION_TAG)
            else:
                cur.execute("SELECT * FROM hub_wiki_documents WHERE slug=%s", (slug,))
                row = cur.fetchone()
                if row["content_hash"] != content_hash:
                    raise WikiEditConflictError("Target Wiki already contains different content; import refused")
        return _document(row)

    def save(self, data: dict, *, expected_revision: int, expected_hash: str,
             user: str, role: str, source_lang: str, translation: dict,
             slug: str = "beginner") -> dict:
        if role not in {"admin", "creator"}:
            raise PermissionError("Wiki editor role is required")
        validate_wiki_data(data)
        with database_connection(self.database_url) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""UPDATE hub_wiki_documents SET data=%s,revision=revision+1,
                content_hash=%s,updated_by=%s,updated_role=%s,source_lang=%s,translation=%s,
                updated_at=CURRENT_TIMESTAMP
                WHERE slug=%s AND revision=%s AND content_hash=%s RETURNING *""",
                (Json(data), wiki_data_hash(data), user, role, source_lang, Json(translation),
                 slug, expected_revision, expected_hash))
            row = cur.fetchone()
            if row is None:
                raise WikiEditConflictError("Wiki 已被其他人更新，請重新載入後再儲存，避免覆蓋對方。")
            self._record_revision(cur, slug)
            record(cur, WIKI_TAG, VERSION_TAG)
        return _document(row)

    def history(self, limit: int = 20, slug: str = "beginner") -> list[dict]:
        with database_connection(self.database_url) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""SELECT revision,content_hash,updated_at,updated_by,updated_role,source_lang
                FROM hub_wiki_revisions WHERE slug=%s ORDER BY revision DESC LIMIT %s""",
                (slug, max(1, min(int(limit), 100))))
            return [{**row, "updated_at": row["updated_at"].isoformat()} for row in cur.fetchall()]


@lru_cache(maxsize=2)
def _store(database_url: str) -> PostgresWikiStore:
    return PostgresWikiStore(database_url)


def wiki_store() -> PostgresWikiStore:
    return _store(website_database_url())
