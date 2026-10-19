"""Derived AI indexes have their own storage and never publish content.

Cache writes use the version loaded by that query, so a slower answer cannot
overwrite a newer cache. The feed writer never reads or locks this table.
"""
import base64
import gzip
import hashlib
import json
from pathlib import PurePosixPath

from neon_feed_store import database_connection


def cache_name(name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts:
        return False
    return name == 'official_knowledge/embeddings.json' or (
        len(path.parts) == 3 and path.parts[:2] in {
            ('official_knowledge', 'documents'), ('official_knowledge', 'indexes')
        } and path.suffix == '.json')


class HubQueryCache:
    def __init__(self, dsn):
        self.dsn = dsn
        with database_connection(dsn) as db, db.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(2026101901)')
            cur.execute('''CREATE TABLE IF NOT EXISTS hub_query_cache (
                name TEXT PRIMARY KEY, content BYTEA NOT NULL, sha256 TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)''')

    def materialize(self, root, source_hashes):
        baseline = {name: digest for name, digest in source_hashes.items() if cache_name(name)}
        stored = {}
        with database_connection(self.dsn) as db, db.cursor() as cur:
            db.set_session(readonly=True)
            cur.execute("SELECT name,encode(content,'base64'),sha256 FROM hub_query_cache ORDER BY name")
            for name, encoded, digest in cur:
                if not cache_name(name):
                    raise RuntimeError('Invalid query cache path')
                raw = gzip.decompress(base64.b64decode(encoded))
                if hashlib.sha256(raw).hexdigest() != digest:
                    raise RuntimeError('Query cache checksum mismatch: ' + name)
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                stored[name] = baseline[name] = digest
        return {'baseline': baseline, 'stored': stored}

    def complete(self, root, versions):
        changed = []
        for target in sorted((root / 'official_knowledge').rglob('*.json')):
            name = target.relative_to(root).as_posix()
            if not cache_name(name):
                raise RuntimeError('Unexpected query cache file: ' + name)
            raw = target.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            if versions['baseline'].get(name) == digest:
                continue
            json.loads(raw)  # Never persist a partial cache file.
            changed.append((name, gzip.compress(raw, mtime=0), digest, versions['stored'].get(name)))
        saved = 0
        # No feed/publication lock, cache invalidation, revision or source writes.
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("SET LOCAL lock_timeout = '3s'")
            for name, content, digest, expected in changed:
                cur.execute('''INSERT INTO hub_query_cache (name,content,sha256) VALUES (%s,%s,%s)
                    ON CONFLICT (name) DO UPDATE SET content=EXCLUDED.content,
                        sha256=EXCLUDED.sha256, updated_at=CURRENT_TIMESTAMP
                    WHERE hub_query_cache.sha256=%s RETURNING name''', (name, content, digest, expected))
                saved += cur.fetchone() is not None
        return {'saved': saved, 'concurrent_cache_versions_preserved': len(changed) - saved}
