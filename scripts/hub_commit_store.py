"""Publication deduplication lives in the same transaction as its content."""
from psycopg2.extras import Json


def initialize(cur):
    cur.execute('''CREATE TABLE IF NOT EXISTS hub_job_commits (
        id TEXT PRIMARY KEY, result JSONB NOT NULL,
        committed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)''')


def committed(cur, job):
    initialize(cur)
    cur.execute('SELECT result FROM hub_job_commits WHERE id=%s', (job['id'],))
    row = cur.fetchone()
    return row[0] if row else None


def record(cur, job, result):
    cur.execute('INSERT INTO hub_job_commits(id,result) VALUES(%s,%s)', (job['id'], Json(result)))
