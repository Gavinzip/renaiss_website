"""Job subprocess execution, shared by the finite Vercel batch runner."""
from __future__ import annotations

import json
import os
from pathlib import Path


def process_job(job: dict, queue, snapshots, root: Path, *, timeout: int = 1800, metrics=None) -> dict:
    import time
    from datetime import datetime, timezone
    from hub_database_audit import phase
    from hub_job_lanes import is_agent_job
    agent = is_agent_job(job)
    metrics = metrics if metrics is not None else {}
    if job['kind'] == 'backup':
        with phase('publish', metrics): return snapshots.backup_job(job)
    import subprocess
    queue.heartbeat(job, '檢查資料版本並載入有變動的文字資料')
    with phase('load', metrics):
        hashes = snapshots.materialize(root, include_media=job['kind'] == 'restore')
        if agent:
            # Wiki is a separate publication, not one of the feed snapshot
            # files. Capture it before the AI subprocess loses DB access.
            from beginner_wiki import read_beginner_wiki_document
            wiki = read_beginner_wiki_document(root)
            (root / '.published-wiki.json').write_text(json.dumps(wiki, ensure_ascii=False))
            from hub_query_cache import HubQueryCache
            query_cache = HubQueryCache(snapshots.dsn)
            cache_versions = query_cache.materialize(root, hashes)
    job_path = root / '.job-input.json'
    result_path = root / '.job-result.json'
    job_path.write_text(json.dumps({'job': job, 'dsn_omitted': True}, default=str))
    result_path.unlink(missing_ok=True)
    env = {**os.environ, 'WEBSITE_DATA_ROOT': str(root), 'WEBSITE_STORAGE_BACKEND': 'filesystem',
           'WEBSITE_STORAGE_LINK_LEGACY': '0', 'WEBSITE_DATA_MIGRATE_ONCE': '0',
           'WEBSITE_DATA_RESTORE_ON_STARTUP': '0', 'WEBSITE_BACKUP_ENABLED': '0',
           'DISCORD_MONITOR_ENABLED': '0',
           'PYTHONDONTWRITEBYTECODE': '1'}
    if job.get('control_plane') == 'vercel' and job['kind'] != 'restore':
        env.update(HUB_FORBID_DATABASE='1', WEBSITE_DATABASE_URL='', DATABASE_URL='')
    # Fresh business-code globals for each job; verified scratch files survive
    # between jobs. A restart reconstructs them from authoritative Postgres.
    metrics['processing_started_at'] = datetime.now(timezone.utc).isoformat()
    started = time.monotonic()
    with phase('processing', metrics):
        completed = subprocess.run([os.sys.executable, str(Path(__file__).with_name('hub_worker_job.py')),
                                    str(job_path), str(result_path)], env=env, timeout=timeout)
    metrics['processing_seconds'] = round(time.monotonic()-started, 3)
    metrics['processing_finished_at'] = datetime.now(timezone.utc).isoformat()
    if completed.returncode:
        raise RuntimeError(result_path.read_text()[:1000] if result_path.exists() else 'Pipeline process exited unexpectedly')
    result = json.loads(result_path.read_text())
    if job.get('control_plane') == 'vercel':
        queue.assert_owned(job)
    if agent:
        queue.heartbeat(job, '保存問答結果；不發布或修改消息資料')
        with phase('query_cache', metrics):
            metrics['query_cache'] = query_cache.complete(root, cache_versions)
        metrics['content_published'] = False
        return result
    queue.heartbeat(job, '以同一筆交易發布各語言、貼文與工作結果')
    with phase('publish', metrics):
        return snapshots.complete_job(root, hashes, job, result)


def main():
    from hub_batch_runner import run_batch
    print(json.dumps(run_batch(scheduled=True)), flush=True)


if __name__ == "__main__":
    main()
