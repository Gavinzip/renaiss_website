#!/usr/bin/env python3
"""Serve the website preview and proxy only the live Intel Feed for local Hub QA."""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = ROOT / "website"
INTEL_ORIGIN = "https://renaiss.zeabur.app"
ALLOWED_PROXY_PATHS = {"/api/intel/feed"}


class CommunityHubPreviewHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path in ALLOWED_PROXY_PATHS:
            self._proxy_live_intel(parsed)
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path in ALLOWED_PROXY_PATHS:
            self._proxy_live_intel(parsed, head_only=True)
            return
        super().do_HEAD()

    def _proxy_live_intel(self, parsed: urllib.parse.SplitResult, head_only: bool = False) -> None:
        upstream = f"{INTEL_ORIGIN}{parsed.path}"
        if parsed.query:
            upstream = f"{upstream}?{parsed.query}"
        request = urllib.request.Request(upstream, method="HEAD" if head_only else "GET")
        request.add_header("User-Agent", "Renaiss-Community-Hub-Preview/1.0")
        try:
            with urllib.request.urlopen(request, timeout=50) as response:
                payload = b"" if head_only else response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json; charset=utf-8"))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if not head_only:
                    self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            self.send_error(error.code, error.reason)
        except urllib.error.URLError as error:
            self.send_error(502, f"Intel feed unavailable: {error.reason}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8791")))
    args = parser.parse_args()
    if not STATIC_ROOT.is_dir():
        raise SystemExit(f"Missing static directory: {STATIC_ROOT}")

    handler = functools.partial(CommunityHubPreviewHandler, directory=str(STATIC_ROOT))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"[community-hub-preview] static={STATIC_ROOT} api_proxy={INTEL_ORIGIN}/api/intel/feed")
    print(f"[community-hub-preview] listening=http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
