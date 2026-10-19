"""Anonymous CDN representations. Never import auth or profile initialization."""
from __future__ import annotations

import gzip
import hashlib
import json
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from hub_cache import FEED_TAG, WIKI_TAG, VERSION_TAG
from hub_public_feed import LANGUAGES, public_feed_store
from neon_feed_store import database_connection, website_database_url


def respond(handler, payload, *, tag='', status=200, etag='', revision=0):
    raw = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
    compressed = 'gzip' in handler.headers.get('Accept-Encoding', '').lower()
    content = gzip.compress(raw, compresslevel=3, mtime=0) if compressed else raw
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Cache-Control', 'no-store')
    if tag:
        handler.send_header('Vercel-CDN-Cache-Control', 'public, max-age=1800')
        handler.send_header('Vercel-Cache-Tag', tag)
        handler.send_header('ETag', etag or 'W/"' + hashlib.sha256(raw).hexdigest() + '"')
        handler.send_header('X-Hub-Origin-Read', uuid4().hex)
        handler.send_header('X-Hub-Publication-Revision', str(revision))
    handler.send_header('Vary', 'Accept-Encoding')
    if compressed:
        handler.send_header('Content-Encoding', 'gzip')
    handler.send_header('Content-Length', str(len(content)))
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(content)


def handle_public(handler) -> bool:
    parsed = urlparse(handler.path)
    if parsed.path not in {'/api/intel/feed', '/api/wiki/beginner', '/api/public/version'}:
        return False
    if handler.command not in {'GET', 'HEAD'}:
        return False
    try:
        if parsed.path == '/api/intel/feed':
            language = (parse_qs(parsed.query).get('lang') or ['zh-Hant'])[0]
            if language not in LANGUAGES:
                raise ValueError('Unsupported language')
            compressed, etag, revision = public_feed_store().read(language)
            respond(handler, gzip.decompress(compressed), tag=FEED_TAG, etag=etag, revision=revision)
        elif parsed.path == '/api/wiki/beginner':
            from beginner_wiki_routes import with_section_routes
            from postgres_wiki_store import wiki_store
            wiki = with_section_routes(wiki_store().read())
            # Permission checks belong to /api/auth/me, never a shared cache.
            respond(handler, {'ok': True, 'wiki': wiki}, tag=WIKI_TAG, revision=wiki['meta'].get('revision', 0))
        else:
            respond(handler, read_version(), tag=VERSION_TAG)
    except ValueError as exc:
        respond(handler, {'ok': False, 'error': str(exc)}, status=400)
    except Exception as exc:
        print('hub_public_read_failed', type(exc).__name__, flush=True)
        respond(handler, {'ok': False, 'error': 'Public publication unavailable'}, status=503)
    return True


def read_version() -> dict:
    with database_connection(website_database_url()) as db, db.cursor() as cur:
        cur.execute("""SELECT
            (SELECT revision FROM hub_feed_publications WHERE name='intel-feed'),
            (SELECT revision FROM hub_wiki_documents WHERE slug='beginner')""")
        feed, wiki = cur.fetchone()
    return {'ok': True, 'feed': feed, 'wiki': wiki}
