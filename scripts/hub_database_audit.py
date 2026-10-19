"""Per-invocation connection timing; never log SQL, data or credentials."""
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
import time

current = ContextVar('hub_database_audit', default=None)


@contextmanager
def phase(name, metrics):
    token = current.set((name, metrics))
    try:
        yield
    finally:
        current.reset(token)


@contextmanager
def connection():
    target = current.get()
    start = time.monotonic()
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        yield
    finally:
        if target:
            name, metrics = target
            metrics.setdefault('database_connections', []).append({'phase': name, 'started_at': timestamp,
                'ended_at': datetime.now(timezone.utc).isoformat(), 'seconds': round(time.monotonic()-start, 4)})
