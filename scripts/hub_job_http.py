"""Private bounded pipeline invocation, called by the authenticated runtime."""
from http.server import BaseHTTPRequestHandler
import hmac
import json
import os
os.environ['DISCORD_MONITOR_ENABLED'] = '0'
os.environ['HUB_DB_POOL_ENABLED'] = '0'
from hub_batch_runner import run_batch, prepare_scheduled_batch
from hub_streaming_response import stream_json

def create_handler(lane):
    class JobHandler(BaseHTTPRequestHandler):

        def do_GET(self):
            self.respond({"ok": False, "error": "Method not allowed"}, 405)

        def do_POST(self):
            secret = os.getenv('HUB_INTERNAL_SECRET', '')
            if not secret or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret):
                return self.respond({'ok': False}, 401)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 <= length <= 600_000: raise ValueError('Invalid body size')
                body = json.loads(self.rfile.read(length) or b'{}')
                if os.getenv('HUB_JOB_CONTROL') == 'vercel':
                    from hub_vercel_runner import run_vercel_job
                    from hub_job_lanes import is_agent_job
                    if is_agent_job(body['job']) != (lane == 'agent'):
                        raise ValueError('Job delivered to the wrong runtime')
                    stream_json(self, lambda: run_vercel_job(body['job']))
                elif lane == 'agent':
                    raise ValueError('Agent runtime requires Vercel job controls')
                elif body.get('prepare_only') is True:
                    self.respond(prepare_scheduled_batch(), 200)
                else:
                    stream_json(self, lambda: run_batch(scheduled=body.get('scheduled') is True))
            except Exception as exc:
                print('hub_batch_error', type(exc).__name__, flush=True)
                self.respond({'ok': False, 'error': 'Batch invocation failed'}, 500)
        def respond(self, payload, status):
            raw = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

    return JobHandler
