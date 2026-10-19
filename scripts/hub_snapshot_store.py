"""Durable website snapshots; local workspaces are explicit processing copies."""
from __future__ import annotations

from functools import lru_cache
from collections import OrderedDict
import base64
import hashlib
import json
import mimetypes
import gzip
from pathlib import Path, PurePosixPath
from threading import RLock

import psycopg2
from psycopg2.extras import Json

from neon_feed_store import database_connection, website_database_url


def safe_name(value: str) -> str:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError("Invalid snapshot path")
    return str(path)


class HubSnapshotStore:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self._read_cache = OrderedDict()
        self._cache_lock = RLock()
        with database_connection(dsn) as db, db.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101701)")
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_snapshot_files (
                name TEXT PRIMARY KEY, content BYTEA NOT NULL, sha256 TEXT NOT NULL,
                media_type TEXT NOT NULL, source TEXT NOT NULL,
                encoding TEXT NOT NULL DEFAULT 'identity',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
            cur.execute("ALTER TABLE hub_snapshot_files ADD COLUMN IF NOT EXISTS encoding TEXT NOT NULL DEFAULT 'identity'")
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_snapshot_imports (
                id TEXT PRIMARY KEY, source TEXT NOT NULL, manifest JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

    def read(self, name: str) -> bytes | None:
        name = safe_name(name)
        with database_connection(self.dsn) as db, db.cursor() as cur:
            db.set_session(isolation_level='REPEATABLE READ', readonly=True)
            cur.execute("SELECT sha256 FROM hub_snapshot_files WHERE name=%s", (name,))
            row = cur.fetchone()
            if not row:
                return None
            digest = row[0]
            with self._cache_lock:
                cached = self._read_cache.get(name)
                if cached and cached[0] == digest:
                    self._read_cache.move_to_end(name)
                    return cached[1]
            # bytea's default text representation doubles its size. Base64 is
            # decoded locally and preserves the stored gzip compression.
            cur.execute("SELECT encode(content,'base64'),encoding FROM hub_snapshot_files WHERE name=%s", (name,))
            content, encoding = cur.fetchone()
        encoded = base64.b64decode(content)
        raw = gzip.decompress(encoded) if encoding == 'gzip' else encoded
        if hashlib.sha256(raw).hexdigest() != digest:
            raise RuntimeError('Snapshot checksum mismatch: ' + name)
        with self._cache_lock:
            self._read_cache[name] = (digest, raw)
            while sum(len(row[1]) for row in self._read_cache.values()) > 32 * 1024 * 1024:
                self._read_cache.popitem(last=False)
        return raw

    def json(self, name: str, default=None):
        value = self.read(name)
        return json.loads(value) if value is not None else default

    def exists(self, name: str) -> bool:
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("SELECT 1 FROM hub_snapshot_files WHERE name=%s", (safe_name(name),))
            return cur.fetchone() is not None

    def manifest(self) -> list[dict]:
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("SELECT name,sha256,octet_length(content),media_type FROM hub_snapshot_files ORDER BY name")
            return [dict(zip(("name", "sha256", "bytes", "media_type"), r)) for r in cur.fetchall()]

    def materialize(self, root: Path, *, include_media: bool = False) -> dict[str, str]:
        """Refresh a verified disposable workspace, downloading only changes.

        Postgres remains authoritative. A failed job's local edits are detected
        by hashes, and a missing or corrupt source always stops processing.
        Media is needed only for an explicit full restore, never normal jobs.
        """
        hashes = {}
        root.mkdir(parents=True, exist_ok=True)
        with database_connection(self.dsn) as db, db.cursor() as cur:
            db.set_session(isolation_level='REPEATABLE READ', readonly=True)
            cur.execute("""SELECT name,sha256 FROM hub_snapshot_files
                WHERE %s OR (media_type NOT LIKE 'image/%%' AND name NOT LIKE 'generated_covers/%%')
                ORDER BY name""", (include_media,))
            hashes = {safe_name(name): digest for name, digest in cur.fetchall()}
            if 'x_intel_feed.json' not in hashes:
                raise RuntimeError('Source feed has not been imported')
            changed = []
            for name, digest in hashes.items():
                target = root / name
                if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                    changed.append(name)
            cur.execute("""SELECT name,encode(content,'base64'),sha256,encoding FROM hub_snapshot_files
                WHERE name=ANY(%s) ORDER BY name""", (changed,))
            for name, content, digest, encoding in cur:
                target = root / safe_name(name)
                target.parent.mkdir(parents=True, exist_ok=True)
                encoded = base64.b64decode(content)
                raw = gzip.decompress(encoded) if encoding == 'gzip' else encoded
                if hashlib.sha256(raw).hexdigest() != digest:
                    raise RuntimeError('Snapshot checksum mismatch: ' + name)
                target.write_bytes(raw)
        # Drop scratch output from failed jobs and files removed in Postgres.
        # Hidden files are worker input/output and derived publications.
        for target in root.rglob('*'):
            name = target.relative_to(root).as_posix()
            if target.is_file() and name not in hashes and not any(p.startswith('.') for p in target.relative_to(root).parts):
                target.unlink()
        return hashes

    def backup_job(self, job: dict) -> dict:
        """Copy a restore point inside Postgres without downloading the data."""
        from hub_restore_points import initialize, create_restore_point_in_transaction
        initialize()
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(2026101702)')
            external = job.get('control_plane') == 'vercel'
            if external:
                from hub_commit_store import committed, record
                previous = committed(cur, job)
                if previous is not None: return previous
            else:
                cur.execute('SELECT status,owner FROM hub_pipeline_jobs WHERE id=%s FOR UPDATE', (job['id'],))
                if cur.fetchone() != ('running', job['owner']):
                    raise RuntimeError('The worker no longer owns this job')
            cur.execute("SELECT revision FROM hub_feed_publications WHERE name='intel-feed'")
            revision = cur.fetchone()[0]
            backup = create_restore_point_in_transaction(cur, job['created_by'])
            result = {'response': {'ok': True, 'backup': backup}, 'revision': revision, 'changed_files': 0}
            if external: record(cur, job, result)
            else:
                cur.execute("""UPDATE hub_pipeline_jobs SET status='done',result=%s,
                    finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,lease_until=NULL WHERE id=%s""",
                    (Json(result), job['id']))
        return result

    def complete_job(self, root: Path, original_hashes: dict, job: dict, result: dict) -> dict:
        """Publish changed files, feed and job completion in a single transaction."""
        if job['kind']=='backup':
            from hub_restore_points import initialize
            initialize()
        feed = json.loads((root / "x_intel_feed.json").read_bytes())
        changes = []
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix in {".lock", ".sqlite3", ".sqlite"} or any(p.startswith('.') for p in path.relative_to(root).parts):
                continue
            name = safe_name(path.relative_to(root).as_posix())
            raw = path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            if original_hashes.get(name) != digest:
                media_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
                encoding = "identity" if media_type.startswith("image/") else "gzip"
                content = raw if encoding == "identity" else gzip.compress(raw, compresslevel=3)
                changes.append((name, psycopg2.Binary(content), digest, media_type, encoding))
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101702)")
            external = job.get('control_plane') == 'vercel'
            if external:
                from hub_commit_store import committed, record
                previous = committed(cur, job)
                if previous is not None: return previous
            else:
                cur.execute("SELECT status,owner FROM hub_pipeline_jobs WHERE id=%s FOR UPDATE", (job["id"],))
                if cur.fetchone() != ("running", job["owner"]):
                    raise RuntimeError("The worker no longer owns this job")
            # An import of settings or cache is a source change too, even if
            # the feed itself has not changed. Never overwrite such an import.
            cur.execute("""SELECT name,sha256 FROM hub_snapshot_files
                WHERE %s OR (media_type NOT LIKE 'image/%%' AND name NOT LIKE 'generated_covers/%%')""",
                (job['kind'] == 'restore',))
            if dict(cur.fetchall()) != original_hashes:
                raise RuntimeError('Source files changed while the job was running; retry against the new snapshot')
            if result.get('restored'):
                current_names=[p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and not any(v.startswith('.') for v in p.relative_to(root).parts)]
                cur.execute('DELETE FROM hub_snapshot_files WHERE NOT (name=ANY(%s))',(current_names,))
            for name, content, digest, media_type, encoding in changes:
                cur.execute("""INSERT INTO hub_snapshot_files(name,content,sha256,media_type,source,encoding)
                    VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(name) DO UPDATE SET
                    content=EXCLUDED.content,sha256=EXCLUDED.sha256,media_type=EXCLUDED.media_type,
                    source=EXCLUDED.source,encoding=EXCLUDED.encoding,updated_at=CURRENT_TIMESTAMP""",
                    (name, content, digest, media_type, "worker:" + job["id"], encoding))
            cur.execute("""UPDATE hub_feed_publications SET payload=%s,revision=revision+1,
                writer=%s,updated_at=CURRENT_TIMESTAMP WHERE name='intel-feed' RETURNING revision""",
                (Json(feed), job["owner"]))
            revision = cur.fetchone()[0]
            from hub_public_feed import publish_in_transaction
            publish_in_transaction(cur, root, revision)
            if result.get('restored') or any(row[0].startswith('generated_covers/') for row in changes):
                from hub_cache import record, MEDIA_TAG
                record(cur, MEDIA_TAG)
            if job['kind']=='backup':
                from hub_restore_points import create_restore_point_in_transaction
                result['response']={'ok':True,'backup':create_restore_point_in_transaction(cur,job['created_by'])}
            if result.get('needs_translation') and not external:
                targets={'target_langs':['zh-Hant','zh-Hans','en','ko']}
                cur.execute("SELECT id FROM hub_pipeline_jobs WHERE kind='translate' AND input=%s AND status IN ('queued','running') LIMIT 1",(Json(targets),))
                if not cur.fetchone():
                    from uuid import uuid4
                    cur.execute("INSERT INTO hub_pipeline_jobs(id,kind,input,created_by) VALUES(%s,'translate',%s,%s)",(uuid4().hex,Json(targets),job['created_by']))
            completed = {**result, "revision": revision, "changed_files": len(changes)}
            if external: record(cur, job, completed)
            else:
                cur.execute("""UPDATE hub_pipeline_jobs SET status='done',result=%s,
                    finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,lease_until=NULL
                    WHERE id=%s""", (Json(completed), job["id"]))
        return completed


@lru_cache(maxsize=2)
def _store(dsn):
    return HubSnapshotStore(dsn)


def snapshot_store() -> HubSnapshotStore:
    return _store(website_database_url())


def postgres_mode() -> bool:
    import os
    return os.getenv("WEBSITE_STORAGE_BACKEND") == "postgres"
