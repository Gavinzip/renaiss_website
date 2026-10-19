"""Lightweight anonymous public origin behind Vercel CDN."""
from http.server import BaseHTTPRequestHandler
from pathlib import Path
import os
import hmac
from urllib.parse import urlparse
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from hub_public_http import handle_public, respond

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == '/api/internal/public-version':
            secret = os.getenv('HUB_INTERNAL_SECRET', '')
            if not secret or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret):
                return respond(self, {'ok': False}, status=401)
            from hub_public_http import read_version
            return respond(self, read_version())
        if not handle_public(self):
            respond(self, {'ok': False, 'error': 'Not found'}, status=404)
    do_HEAD = do_GET
