"""One-time publication backfill, using an explicit WEBSITE_DATABASE_URL.

Run only against the selected test database before deploying the new reader.
This does not start the queue, call AI, or enable source schedules.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from psycopg2.extras import Json
from hub_public_feed import prepare_public_feeds, publish_in_transaction
from hub_snapshot_store import snapshot_store
from neon_feed_store import database_connection, website_database_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render-root', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.render_root:
        prepare_public_feeds(args.render_root)
        return
    snapshots = snapshot_store()
    with tempfile.TemporaryDirectory(prefix='hub-publication-backfill-') as temp:
        root = Path(temp)
        hashes = snapshots.materialize(root)
        env = {**os.environ, 'WEBSITE_DATA_ROOT': str(root), 'WEBSITE_STORAGE_BACKEND': 'filesystem',
               'WEBSITE_STORAGE_LINK_LEGACY': '0', 'WEBSITE_DATA_MIGRATE_ONCE': '0',
               'WEBSITE_DATA_RESTORE_ON_STARTUP': '0', 'WEBSITE_BACKUP_ENABLED': '0',
               'X_SYNC_ENABLED': '0', 'X_SYNC_RUN_ON_STARTUP': '0', 'I18N_WATCHDOG_ENABLED': '0',
               'I18N_WARM_ON_STARTUP': '0', 'COMMUNITY_METRICS_ENABLED': '0',
               'PYTHONDONTWRITEBYTECODE': '1'}
        subprocess.run([sys.executable, str(Path(__file__).resolve()), '--render-root', str(root)], env=env, check=True)
        feed = json.loads((root / 'x_intel_feed.json').read_bytes())
        with database_connection(website_database_url()) as db, db.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(2026101702)')
            cur.execute("""SELECT name,sha256 FROM hub_snapshot_files
                WHERE media_type NOT LIKE 'image/%%' AND name NOT LIKE 'generated_covers/%%'""")
            if dict(cur.fetchall()) != hashes:
                raise RuntimeError('Source changed during publication backfill')
            cur.execute("SELECT revision,payload=%s FROM hub_feed_publications WHERE name='intel-feed'", (Json(feed),))
            row = cur.fetchone()
            if row is None or not row[1]:
                raise RuntimeError('The feed publication and imported source differ; reconcile them before backfilling')
            publish_in_transaction(cur, root, row[0])
        print(json.dumps({'prepared_languages': 4, 'revision': row[0], 'media_downloaded': False}))


if __name__ == '__main__':
    main()
