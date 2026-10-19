"""Postgres queue with leases and one active website mutation at a time."""
from __future__ import annotations

from functools import lru_cache
from uuid import uuid4

from psycopg2.extras import Json, RealDictCursor
from neon_feed_store import database_connection, website_database_url


def public_job(row: dict) -> dict:
    out = {k: v for k, v in row.items() if k not in {"owner", "lease_until"}}
    for key, value in out.items():
        if hasattr(value, "isoformat"):
            out[key] = value.isoformat()
    out["url"] = (out.get("input") or {}).get("url", "")
    out["message"] = out.get("error") or out.get("phase") or out["status"]
    out.update(out.get("result") or {})
    return out


class HubJobStore:
    def __init__(self, dsn):
        self.dsn = dsn
        with database_connection(dsn) as db, db.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101701)")
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_pipeline_jobs (
                id TEXT PRIMARY KEY,kind TEXT NOT NULL,input JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',owner TEXT,lease_until TIMESTAMPTZ,
                phase TEXT NOT NULL DEFAULT '',result JSONB,error TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMPTZ,finished_at TIMESTAMPTZ)""")
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_schedules (
                name TEXT PRIMARY KEY,kind TEXT NOT NULL,input JSONB NOT NULL,
                interval_seconds INTEGER NOT NULL,next_run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_job_id TEXT,enabled BOOLEAN NOT NULL DEFAULT TRUE)""")

    @staticmethod
    def _expire_in_transaction(cur):
        cur.execute("""UPDATE hub_pipeline_jobs SET status='failed',
            error='Worker interrupted; explicitly retry this job',
            finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,lease_until=NULL
            WHERE status='running' AND (lease_until IS NULL OR lease_until<=CURRENT_TIMESTAMP)""")
        return cur.rowcount

    def expire_interrupted(self):
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(2026101702)')
            return self._expire_in_transaction(cur)

    def ensure_schedule(self, name: str, kind: str, payload: dict, interval_seconds: int):
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS hub_schedules (
                name TEXT PRIMARY KEY, kind TEXT NOT NULL, input JSONB NOT NULL,
                interval_seconds INTEGER NOT NULL, next_run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_job_id TEXT, enabled BOOLEAN NOT NULL DEFAULT TRUE)""")
            cur.execute("""INSERT INTO hub_schedules(name,kind,input,interval_seconds,next_run_at)
                VALUES(%s,%s,%s,%s,to_timestamp((floor(extract(epoch from CURRENT_TIMESTAMP)/%s)+1)*%s))
                ON CONFLICT(name) DO UPDATE SET kind=EXCLUDED.kind,input=EXCLUDED.input,
                interval_seconds=EXCLUDED.interval_seconds,enabled=TRUE,
                next_run_at=to_timestamp(floor(extract(epoch from hub_schedules.next_run_at)/EXCLUDED.interval_seconds)*EXCLUDED.interval_seconds)""",
                (name,kind,Json(payload),interval_seconds,interval_seconds,interval_seconds))

    def enqueue_due(self):
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101702)")
            cur.execute("SELECT * FROM hub_schedules WHERE enabled AND next_run_at<=CURRENT_TIMESTAMP FOR UPDATE")
            for schedule in cur.fetchall():
                cur.execute("SELECT id FROM hub_pipeline_jobs WHERE kind=%s AND status IN ('queued','running') LIMIT 1",(schedule['kind'],))
                if cur.fetchone():
                    continue
                job_id=uuid4().hex
                cur.execute("INSERT INTO hub_pipeline_jobs(id,kind,input,created_by) VALUES(%s,%s,%s,'scheduled')",(job_id,schedule['kind'],Json(schedule['input'])))
                cur.execute("UPDATE hub_schedules SET last_job_id=%s,next_run_at=to_timestamp((floor(extract(epoch from CURRENT_TIMESTAMP)/interval_seconds)+1)*interval_seconds) WHERE name=%s",(job_id,schedule['name']))

    def schedule_status(self):
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM hub_schedules ORDER BY name")
            return [{k:(v.isoformat() if hasattr(v,'isoformat') else v) for k,v in dict(row).items()} for row in cur.fetchall()]

    def enqueue(self, kind: str, payload: dict, user: str) -> dict:
        if kind not in {"analyze_url", "reanalyze", "translate", "sync", "action", "metrics", "backup", "restore"}:
            raise ValueError("Unsupported pipeline job")
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101702)")
            self._expire_in_transaction(cur)
            cur.execute("SELECT * FROM hub_pipeline_jobs WHERE kind=%s AND input=%s AND created_by=%s AND status IN ('queued','running') ORDER BY created_at LIMIT 1", (kind, Json(payload), user))
            existing = cur.fetchone()
            if existing:
                return public_job(dict(existing))
            cur.execute("INSERT INTO hub_pipeline_jobs(id,kind,input,created_by) VALUES(%s,%s,%s,%s) RETURNING *", (uuid4().hex, kind, Json(payload), user))
            return public_job(dict(cur.fetchone()))

    def get(self, job_id: str) -> dict | None:
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM hub_pipeline_jobs WHERE id=%s", (job_id,))
            row = cur.fetchone()
            return public_job(dict(row)) if row else None

    def recent(self) -> list[dict]:
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM hub_pipeline_jobs ORDER BY created_at DESC LIMIT 20")
            return [public_job(dict(r)) for r in cur.fetchall()]

    def claim(self, owner: str) -> dict | None:
        with database_connection(self.dsn) as db, db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT pg_advisory_xact_lock(2026101702)")
            cur.execute("SELECT 1 FROM hub_pipeline_jobs WHERE status='running' AND lease_until>CURRENT_TIMESTAMP LIMIT 1")
            if cur.fetchone():
                return None
            # An interrupted AI request is reported, never silently billed again.
            self._expire_in_transaction(cur)
            cur.execute("SELECT id FROM hub_pipeline_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")
            row = cur.fetchone()
            if not row:
                return None
            cur.execute("""UPDATE hub_pipeline_jobs SET status='running',owner=%s,
                lease_until=CURRENT_TIMESTAMP+INTERVAL '120 seconds',attempts=attempts+1,
                started_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=%s RETURNING *""", (owner, row["id"]))
            return dict(cur.fetchone())

    def heartbeat(self, job: dict, phase: str = "") -> bool:
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("""UPDATE hub_pipeline_jobs SET lease_until=CURRENT_TIMESTAMP+INTERVAL '120 seconds',
                phase=CASE WHEN %s='' THEN phase ELSE %s END,updated_at=CURRENT_TIMESTAMP
                WHERE id=%s AND owner=%s AND status='running'""", (phase, phase, job["id"], job["owner"]))
            return cur.rowcount == 1

    def fail(self, job: dict, message: str):
        with database_connection(self.dsn) as db, db.cursor() as cur:
            cur.execute("""UPDATE hub_pipeline_jobs SET status='failed',error=%s,lease_until=NULL,
                finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=%s AND owner=%s AND status='running'""", (message[:1000], job["id"], job["owner"]))


@lru_cache(maxsize=2)
def _store(dsn):
    return HubJobStore(dsn)


def job_store():
    import os
    if os.getenv('HUB_JOB_CONTROL') == 'vercel':
        from hub_vercel_jobs import _store as vercel_store
        return vercel_store
    return _store(website_database_url())
