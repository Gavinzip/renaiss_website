#!/usr/bin/env python3
"""Serve the website preview with a same-origin proxy to the local Hub backend."""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = ROOT / "website"
PRODUCTION_BACKEND_ORIGIN = "https://renaiss.zeabur.app"
LOCAL_BACKEND_ORIGIN = "http://127.0.0.1:8787"
PROXY_REQUEST_HEADERS = {
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "cookie",
    "origin",
    "user-agent",
}
PROXY_RESPONSE_HEADERS = {
    "cache-control",
    "content-encoding",
    "content-type",
    "location",
    "vary",
}


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Return redirects to the browser instead of following them in the proxy."""

    def redirect_request(self, request, file_pointer, code, message, headers, new_url):  # type: ignore[no-untyped-def]
        return None


class CommunityHubPreviewHandler(http.server.SimpleHTTPRequestHandler):
    backend_origin = PRODUCTION_BACKEND_ORIGIN
    environment = "production"
    proxy_opener = urllib.request.build_opener(NoRedirectHandler())

    def end_headers(self) -> None:
        """Keep navigational HTML fresh while leaving hashed assets cacheable."""
        request_path = urllib.parse.urlsplit(self.path).path
        if request_path.endswith(".html") or request_path.endswith("/"):
            self.send_header("Cache-Control", "no-cache, max-age=0")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if urllib.parse.urlsplit(self.path).path == "/api/community-hub/preview-config":
            self._send_preview_config()
            return
        if self._should_proxy():
            self._proxy_backend()
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        super().do_HEAD()

    def do_POST(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        self.send_error(404, "Not found")

    def do_PUT(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        self.send_error(404, "Not found")

    def do_PATCH(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        self.send_error(404, "Not found")

    def do_DELETE(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        self.send_error(404, "Not found")

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self._should_proxy():
            self._proxy_backend()
            return
        self.send_error(404, "Not found")

    def _should_proxy(self) -> bool:
        path = urllib.parse.urlsplit(self.path).path
        return path.startswith("/api/") or path == "/auth/callback"

    def _proxy_backend(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        upstream = f"{self.backend_origin}{parsed.path}"
        if parsed.query:
            upstream = f"{upstream}?{parsed.query}"

        request_body = None
        content_length = int(self.headers.get("Content-Length") or 0)
        if content_length > 0:
            request_body = self.rfile.read(content_length)
        request = urllib.request.Request(upstream, data=request_body, method=self.command)
        for name, value in self.headers.items():
            if name.lower() in PROXY_REQUEST_HEADERS:
                request.add_header(name, value)
        request.add_header("X-Forwarded-Proto", "http")
        request.add_header("X-Forwarded-Host", str(self.headers.get("Host") or "127.0.0.1:8791"))
        if self.environment == "production" and parsed.path == "/api/auth/renaiss/start":
            request.add_header("X-Renaiss-Preview-Origin", "http://127.0.0.1:8791")

        try:
            with self.proxy_opener.open(request, timeout=50) as response:
                self._send_proxy_response(response.status, response.headers, response.read())
        except urllib.error.HTTPError as error:
            self._send_proxy_response(error.code, error.headers, error.read())
        except urllib.error.URLError as error:
            self.send_error(502, f"Local Hub backend unavailable: {error.reason}")

    def _send_proxy_response(self, status: int, headers, payload: bytes) -> None:  # type: ignore[no-untyped-def]
        body = b"" if self.command == "HEAD" else payload
        self.send_response(status)
        for name, value in headers.items():
            if name.lower() in PROXY_RESPONSE_HEADERS:
                self.send_header(name, value)
        for value in headers.get_all("Set-Cookie", []):
            self.send_header("Set-Cookie", self._browser_cookie(value))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _browser_cookie(self, value: str) -> str:
        if self.environment != "production":
            return value
        parts = [part.strip() for part in str(value or "").split(";") if part.strip()]
        local_parts = [part for part in parts if part.lower() != "secure" and not part.lower().startswith(("domain=", "samesite="))]
        local_parts.append("SameSite=Lax")
        return "; ".join(local_parts)

    def _send_preview_config(self) -> None:
        payload = json.dumps(
            {"ok": True, "environment": self.environment, "backend_origin": self.backend_origin},
            ensure_ascii=False,
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8791")))
    parser.add_argument(
        "--mode",
        choices=("production", "local"),
        default=os.getenv("COMMUNITY_HUB_MODE", "production").strip().lower(),
        help="Backend environment; defaults to production",
    )
    parser.add_argument("--backend-origin", default=os.getenv("COMMUNITY_HUB_BACKEND_ORIGIN", ""))
    args = parser.parse_args()
    if not STATIC_ROOT.is_dir():
        raise SystemExit(f"Missing static directory: {STATIC_ROOT}")

    backend_origin = str(args.backend_origin).strip() or (
        PRODUCTION_BACKEND_ORIGIN if args.mode == "production" else LOCAL_BACKEND_ORIGIN
    )
    handler_class = type(
        "ConfiguredCommunityHubPreviewHandler",
        (CommunityHubPreviewHandler,),
        {"backend_origin": backend_origin.rstrip("/"), "environment": args.mode},
    )
    handler = functools.partial(handler_class, directory=str(STATIC_ROOT))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    print(f"[community-hub-preview] mode={handler_class.environment} static={STATIC_ROOT} backend_proxy={handler_class.backend_origin}")
    print(f"[community-hub-preview] listening=http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
