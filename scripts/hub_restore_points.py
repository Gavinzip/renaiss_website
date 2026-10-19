"""Content-addressed restore points for application snapshots in the test database."""
from __future__ import annotations

from pathlib import Path
import gzip
import json
from uuid import uuid4
from psycopg2.extras import Json
from neon_feed_store import database_connection, website_database_url
from hub_snapshot_store import safe_name


def initialize():
    with database_connection(website_database_url()) as db,db.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(2026101701)")
        cur.execute("""CREATE TABLE IF NOT EXISTS hub_snapshot_blobs (
            sha256 TEXT PRIMARY KEY,content BYTEA NOT NULL,encoding TEXT NOT NULL,media_type TEXT NOT NULL)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS hub_restore_points (
            id TEXT PRIMARY KEY,manifest JSONB NOT NULL,created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")


def create_restore_point_in_transaction(cur, actor: str) -> dict:
    cur.execute("""INSERT INTO hub_snapshot_blobs(sha256,content,encoding,media_type)
        SELECT sha256,content,encoding,media_type FROM hub_snapshot_files ON CONFLICT DO NOTHING""")
    cur.execute('SELECT name,sha256 FROM hub_snapshot_files ORDER BY name')
    manifest=dict(cur.fetchall());point=uuid4().hex
    cur.execute('INSERT INTO hub_restore_points(id,manifest,created_by) VALUES(%s,%s,%s)',(point,Json(manifest),actor))
    return {'ok':True,'backup_id':point,'files':len(manifest),'provider':'postgres-content-addressed'}


def create_restore_point(actor: str) -> dict:
    initialize()
    with database_connection(website_database_url()) as db,db.cursor() as cur:
        cur.execute('SELECT pg_advisory_xact_lock(2026101702)')
        return create_restore_point_in_transaction(cur,actor)


def latest_restore_point() -> dict:
    initialize()
    with database_connection(website_database_url()) as db,db.cursor() as cur:
        cur.execute('SELECT id,created_at,created_by FROM hub_restore_points ORDER BY created_at DESC LIMIT 1')
        row=cur.fetchone()
    return {'id':row[0],'created_at':row[1].isoformat(),'created_by':row[2]} if row else {}


def restore_to_workspace(root: Path, point: str='') -> dict:
    initialize()
    with database_connection(website_database_url()) as db,db.cursor() as cur:
        if point:cur.execute('SELECT id,manifest FROM hub_restore_points WHERE id=%s',(point,))
        else:cur.execute('SELECT id,manifest FROM hub_restore_points ORDER BY created_at DESC LIMIT 1')
        row=cur.fetchone()
        if not row:raise ValueError('Restore point not found')
        point,manifest=row
        for name,digest in manifest.items():
            cur.execute('SELECT content,encoding FROM hub_snapshot_blobs WHERE sha256=%s',(digest,))
            data,encoding=cur.fetchone();raw=gzip.decompress(bytes(data)) if encoding=='gzip' else bytes(data)
            target=root/safe_name(name);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
        for target in root.rglob('*'):
            if target.is_file() and target.relative_to(root).as_posix() not in manifest and not any(v.startswith('.') for v in target.relative_to(root).parts):
                target.unlink()
    return {'ok':True,'restored':True,'backup_id':point,'files':len(manifest)}
