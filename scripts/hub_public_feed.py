"""Publish four public feeds once; HTTP reads one verified language at a time."""
from __future__ import annotations

import base64
from functools import lru_cache
import gzip
import hashlib
import json
from pathlib import Path
from threading import RLock
from datetime import datetime, timezone

import psycopg2
from neon_feed_store import database_connection, website_database_url

LANGUAGES = ('zh-Hant', 'zh-Hans', 'en', 'ko')


def refresh_event_status(compressed: bytes, digest: str, *, now=None) -> tuple[bytes, str]:
    """Time-dependent labels still update when source/AI jobs are paused."""
    from x_intel.knowledge_events import event_timing
    body = json.loads(gzip.decompress(compressed))
    current_time = now or datetime.now(timezone.utc)
    changed = False
    for card in body['feed'].get('cards', []):
        if isinstance(card, dict) and card.get('card_type') == 'event':
            status = event_timing({**card, 'raw_hint': card.get('raw_text')}, current_time)
            if card.get('event_status') != status:
                card['event_status'] = status
                changed = True
    if not changed:
        return compressed, digest
    raw = json.dumps(body, ensure_ascii=False).encode('utf-8')
    return gzip.compress(raw, compresslevel=3, mtime=0), hashlib.sha256(raw).hexdigest()


def initialize(cur):
    from hub_cache import initialize as initialize_cache
    initialize_cache(cur)
    cur.execute("""CREATE TABLE IF NOT EXISTS hub_public_feeds (
        lang TEXT PRIMARY KEY, content BYTEA NOT NULL, sha256 TEXT NOT NULL,
        revision BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")


def prepare_public_feeds(root: Path) -> None:
    """Render with the original visibility/translation rules, without AI work."""
    import ai_intel_server as server
    from website_i18n_runtime import localized_feed_from_bundle

    feed = json.loads((root / 'x_intel_feed.json').read_bytes())
    feed = server._attach_x_source_metadata(server._attach_knowledge_memory_stats(feed))
    base_cards = [card for card in feed.get('cards', []) if server._card_is_public(card)]
    hidden = server.public_event_duplicate_ids(base_cards)
    for language in LANGUAGES:
        localized = server._public_feed_snapshot(
            server._attach_x_source_metadata(localized_feed_from_bundle(feed, language, allow_rebuild=False)),
            hidden_event_duplicate_ids=hidden,
        )
        server.attach_product_progress_group_keys(localized)
        for card in localized.get('cards', []):
            if isinstance(card, dict):
                server.migrate_official_account_role_copy_v1(card)
        # Existing legacy URLs remain readable on explicit request. Normal
        # publication does not need the image files in the worker workspace.
        body = {'ok': True, 'feed': localized, 'lang': language}
        (root / f'.public-feed-{language}.json').write_text(json.dumps(body, ensure_ascii=False), encoding='utf-8')


def publish_in_transaction(cur, root: Path, revision: int) -> None:
    initialize(cur)
    from hub_cache import record, FEED_TAG, VERSION_TAG
    record(cur, FEED_TAG, VERSION_TAG)
    for language in LANGUAGES:
        raw = (root / f'.public-feed-{language}.json').read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        compressed = gzip.compress(raw, compresslevel=3, mtime=0)
        cur.execute("""INSERT INTO hub_public_feeds(lang,content,sha256,revision) VALUES(%s,%s,%s,%s)
            ON CONFLICT(lang) DO UPDATE SET content=EXCLUDED.content,sha256=EXCLUDED.sha256,
                revision=EXCLUDED.revision,updated_at=CURRENT_TIMESTAMP""",
            (language, psycopg2.Binary(compressed), digest, revision))


class PublicFeedStore:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self._cache = {}
        self._lock = RLock()

    def read(self, language: str, etag: str = '') -> tuple[bytes | None, str, int]:
        """Return gzip bytes, or None for an unchanged ETag. Never serve stale."""
        if language not in LANGUAGES:
            raise ValueError('Unsupported language')
        with database_connection(self.dsn) as db, db.cursor() as cur:
            db.set_session(isolation_level='REPEATABLE READ', readonly=True)
            cur.execute("""SELECT p.sha256,p.revision FROM hub_public_feeds p JOIN hub_feed_publications f
                ON f.name='intel-feed' AND p.revision=f.revision WHERE p.lang=%s""", (language,))
            row = cur.fetchone()
            if row is None:
                raise RuntimeError('The requested language publication has not been prepared for the current revision')
            digest, revision = row
            with self._lock:
                cached = self._cache.get(language)
                if cached and cached[0] == digest:
                    compressed = cached[1]
                else:
                    cur.execute("SELECT encode(content,'base64') FROM hub_public_feeds WHERE lang=%s", (language,))
                    compressed = base64.b64decode(cur.fetchone()[0])
        if hashlib.sha256(gzip.decompress(compressed)).hexdigest() != digest:
            raise RuntimeError('Public language publication checksum mismatch')
        with self._lock:
            self._cache[language] = (digest, compressed)
        compressed, digest = refresh_event_status(compressed, digest)
        current_etag = 'W/"' + digest + '"'
        return (None if etag == current_etag else compressed), current_etag, revision


@lru_cache(maxsize=2)
def _store(dsn):
    return PublicFeedStore(dsn)


def public_feed_store() -> PublicFeedStore:
    return _store(website_database_url())
