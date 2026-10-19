"""Vercel owns queue state and progress; this module never opens Postgres."""
from __future__ import annotations

import os
import time
import requests


def control(op: str, **payload):
    response = requests.post(os.environ['HUB_RUNTIME_ORIGIN'].rstrip('/') + '/api/job-control',
        json={'op': op, **payload}, headers={'Authorization': 'Bearer ' + os.environ['HUB_INTERNAL_SECRET']}, timeout=25)
    response.raise_for_status()
    data = response.json()
    if not data.get('ok'):
        raise RuntimeError('Vercel job control unavailable')
    return data['result']


class VercelJobStore:
    def __init__(self):
        self._last_progress = 0.0

    def enqueue(self, kind, payload, user):
        return control('enqueue', kind=kind, input=payload, user=user)

    def get(self, job_id):
        return control('get', id=job_id)

    def recent(self):
        return control('recent')

    def dashboard(self):
        return control('dashboard')

    def schedule_status(self):
        return control('schedules')

    def heartbeat(self, job, phase=''):
        # This is progress only. Vercel Queues manages its own visibility lease.
        if time.monotonic() - self._last_progress < 15:
            return True
        control('update', id=job['id'], owner=job['owner'], patch={'phase': phase[:300]})
        self._last_progress = time.monotonic()
        return True

    def assert_owned(self, job):
        current = self.get(job['id'])
        if not current or current.get('owner') != job['owner'] or current.get('status') != 'running':
            raise RuntimeError('Vercel worker no longer owns this job')


_store = VercelJobStore()
