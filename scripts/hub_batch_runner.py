"""Finite queue drain: no idle polling, no resident process, no implicit AI retries."""
from __future__ import annotations

import os
from pathlib import Path
import time
import tempfile
from threading import Event, Thread
from uuid import uuid4

from hub_cache import flush_after_publication
from hub_job_store import job_store
from hub_snapshot_store import snapshot_store
from hub_worker import process_job


def prepare_scheduled_batch() -> dict:
    """Durably enqueue due work before acknowledging the Cron HTTP request."""
    queue = job_store()
    expired = queue.expire_interrupted()
    queue.ensure_schedule('source-sync', 'sync', {'days': int(os.getenv('X_SYNC_WINDOW_DAYS', '30'))}, 1800)
    queue.enqueue_due()
    from neon_feed_store import database_connection
    with database_connection(queue.dsn) as db, db.cursor() as cur:
        cur.execute("SELECT count(*) FILTER (WHERE status='queued'), count(*) FILTER (WHERE status='running' AND lease_until>CURRENT_TIMESTAMP) FROM hub_pipeline_jobs")
        queued, running = cur.fetchone()
        cur.execute('SELECT count(*) FROM hub_cache_outbox')
        pending = cur.fetchone()[0]
    return {'ok': True, 'queued': queued, 'running': running, 'cache_pending': pending, 'interrupted': expired}


def run_batch(*, scheduled: bool = False, budget_seconds: int = 1500) -> dict:
    with tempfile.TemporaryDirectory(prefix='hub-batch-') as temporary:
        return _drain(Path(temporary), scheduled, budget_seconds)


def _drain(root: Path, scheduled: bool, budget_seconds: int) -> dict:
    queue, snapshots = job_store(), snapshot_store()
    owner = 'hub-batch-' + uuid4().hex[:12]
    deadline = time.monotonic() + budget_seconds
    if scheduled:
        prepare_scheduled_batch()
    cache = flush_after_publication()
    results = []
    while time.monotonic() < deadline - 45:
        job = queue.claim(owner)
        if job is None:
            break
        finished = Event()
        def heartbeat():
            while not finished.wait(15):
                try:
                    if not queue.heartbeat(job): return
                except Exception as exc:
                    print('hub_heartbeat_failed', type(exc).__name__, flush=True)
        thread = Thread(target=heartbeat, daemon=True)
        thread.start()
        try:
            result = process_job(job, queue, snapshots, root, timeout=max(1, int(deadline - time.monotonic() - 30)))
            results.append({'id': job['id'], 'status': 'done', 'revision': result.get('revision')})
            cache = flush_after_publication()
        except Exception as exc:
            queue.fail(job, str(exc))
            results.append({'id': job['id'], 'status': 'failed', 'error': str(exc)[:500]})
        finally:
            finished.set()
            thread.join(timeout=2)
    ok = not cache.get('pending') and not any(row['status'] == 'failed' for row in results)
    return {'ok': ok, 'jobs': results, 'cache': cache, 'idle_polling': False}
