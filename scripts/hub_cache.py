"""Durable cache invalidations, recorded in the publication transaction."""
from __future__ import annotations

import os
import requests
from neon_feed_store import database_connection, website_database_url

FEED_TAG = 'hub-feed-v1'
WIKI_TAG = 'hub-wiki-v1'
VERSION_TAG = 'hub-version-v1'
MEDIA_TAG = 'hub-media-v1'


def initialize(cur):
    cur.execute("""CREATE TABLE IF NOT EXISTS hub_cache_outbox (
        id BIGSERIAL PRIMARY KEY, tag TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")


def record(cur, *tags):
    for tag in set(tags):
        cur.execute('INSERT INTO hub_cache_outbox(tag) VALUES (%s)', (tag,))


def runtime_request(payload: dict) -> dict:
    secret = os.environ.get('HUB_INTERNAL_SECRET', '')
    origin = os.environ.get('HUB_RUNTIME_ORIGIN', '').rstrip('/')
    if not secret or not origin:
        raise RuntimeError('HUB_INTERNAL_SECRET and HUB_RUNTIME_ORIGIN must be configured')
    response = requests.post(origin + '/api/runtime', json=payload,
        headers={'Authorization': 'Bearer ' + secret}, timeout=30)
    response.raise_for_status()
    result = response.json()
    if not result.get('ok'):
        raise RuntimeError('Vercel runtime operation failed')
    return result


def flush() -> dict:
    dsn = website_database_url()
    with database_connection(dsn) as db, db.cursor() as cur:
        cur.execute('SELECT id,tag FROM hub_cache_outbox ORDER BY id LIMIT 1000')
        rows = cur.fetchall()
        cur.execute("SELECT (SELECT revision FROM hub_feed_publications WHERE name='intel-feed'), (SELECT revision FROM hub_wiki_documents WHERE slug='beginner')")
        feed_revision, wiki_revision = cur.fetchone()
    if not rows:
        return {'pending': False, 'invalidated': []}
    tags = sorted({row[1] for row in rows})
    runtime_request({'tags': tags, 'expected': {'feed': feed_revision or 0, 'wiki': wiki_revision or 0}})
    # A concurrent publication has its own ID; never acknowledge its work.
    with database_connection(dsn) as db, db.cursor() as cur:
        cur.execute('DELETE FROM hub_cache_outbox WHERE id=ANY(%s)', ([row[0] for row in rows],))
    return {'pending': False, 'invalidated': tags}


def flush_after_publication() -> dict:
    try:
        return flush()
    except Exception as exc:
        # The committed content remains authoritative. Keep the durable outbox
        # for the next scheduled invocation and expose this state to the editor.
        print('hub_cache_invalidation_pending', type(exc).__name__, flush=True)
        return {'pending': True, 'error': 'Cache invalidation pending; next scheduled run will retry'}
