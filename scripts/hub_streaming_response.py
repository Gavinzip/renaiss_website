"""Keep the private batch HTTP response alive without changing its JSON shape."""
from __future__ import annotations

import json
from threading import Event, Lock, Thread


def stream_json(handler, operation):
    handler.send_response(200)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Cache-Control', 'no-store')
    handler.end_headers()
    finished, write_lock = Event(), Lock()

    def write(raw):
        with write_lock:
            handler.wfile.write(raw)
            handler.wfile.flush()

    # JSON allows leading whitespace. Send it immediately and periodically so
    # transport idle/header limits do not mistake active AI work for a stall.
    write(b'\n')
    def heartbeat():
        while not finished.wait(15):
            try:
                write(b'\n')
            except OSError:
                return
    thread = Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        result = operation()
    except Exception as exc:
        print('hub_batch_execution_failed', type(exc).__name__, flush=True)
        result = {'ok': False, 'error': 'Batch execution failed'}
    finally:
        finished.set()
        thread.join(timeout=2)
    try:
        write(json.dumps(result).encode())
    except OSError:
        # The durable job result is authoritative even if its caller disconnects.
        print('hub_batch_client_disconnected', flush=True)
