"""One queue-owned invocation: load, isolated processing, atomic publication."""
from pathlib import Path
import tempfile

from hub_cache import flush_after_publication
from hub_database_audit import phase
from hub_job_store import job_store
from hub_snapshot_store import snapshot_store
from hub_worker import process_job
from hub_job_lanes import is_agent_job


def run_vercel_job(job):
    if job.get('control_plane') != 'vercel':
        raise ValueError('A Vercel-owned job is required')
    queue = job_store()
    queue.assert_owned(job)
    agent = is_agent_job(job)
    metrics = {'control_plane': 'vercel', 'lane': 'agent' if agent else 'mutation',
               'content_published': False if agent else None,
               'processing_database_forbidden': job['kind'] != 'restore'}
    try:
        with phase('load', metrics):
            if not agent: flush_after_publication()
            snapshots = snapshot_store()
        with tempfile.TemporaryDirectory(prefix='hub-job-') as temporary:
            result = process_job(job, queue, snapshots, Path(temporary), timeout=1500, metrics=metrics)
        with phase('publish', metrics): cache = None if agent else flush_after_publication()
        return {'ok': True, 'result': result, 'cache': cache, 'metrics': metrics}
    except Exception as exc:
        print('hub_vercel_job_failed', type(exc).__name__, flush=True)
        return {'ok': False, 'error': str(exc)[:500], 'metrics': metrics}
