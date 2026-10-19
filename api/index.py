"""Vercel entrypoint for the existing Community Hub HTTP handler.

This isolated adapter uses durable Postgres feed, jobs and authentication.
Unmigrated routes fail explicitly. Importing it does not run main() or start
background schedulers.
"""

from http import HTTPStatus
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# These paths are scratch space only. Durable feed, profile and auth state use
# PostgreSQL. Unmigrated mutation routes are explicitly unavailable in this pilot.
os.environ["WEBSITE_STORAGE_BACKEND"] = "postgres"
os.environ["WEBSITE_DATA_ROOT"] = "/tmp/community-hub-pilot-cache"
os.environ["WEBSITE_STORAGE_LINK_LEGACY"] = "0"
os.environ["WEBSITE_DATA_MIGRATE_ONCE"] = "0"
os.environ["WEBSITE_DATA_RESTORE_ON_STARTUP"] = "0"
os.environ["WEBSITE_BACKUP_ENABLED"] = "0"
os.environ["X_SYNC_ENABLED"] = "0"
os.environ["X_SYNC_RUN_ON_STARTUP"] = "0"
os.environ["COMMUNITY_METRICS_ENABLED"] = "0"
os.environ["I18N_WATCHDOG_ENABLED"] = "0"
os.environ["I18N_WARM_ON_STARTUP"] = "0"
os.environ["DISCORD_MONITOR_ENABLED"] = "0"

from neon_feed_store import configure_postgres_tls, feed_store_from_environment  # noqa: E402

configure_postgres_tls()
from ai_intel_server import Handler  # noqa: E402
from hub_http_routes import handle_get, handle_post  # noqa: E402


class handler(Handler):
    """Expose the original website and a narrow, explicit migration test."""

    def do_GET(self):
        path = self._request_path()
        if handle_get(self):
            return
        if path == '/api/auth/renaiss/start' or path == '/auth/callback':
            self._send_json({'ok':False,'error':'正式 SSO 將於網域切換時接入。'},status=503)
            return
        return super().do_GET()

    def do_POST(self):
        if handle_post(self):
            return
        if self._request_path() in {"/api/auth/login", "/api/auth/logout", "/api/card-scan/recognize", "/api/card-scan/recognize-cards"} or self._request_path().startswith("/api/expo-profile/"):
            return super().do_POST()
        self._send_json(
            {"ok": False, "error": "Mutation routes are not enabled in this isolated migration pilot."},
            status=HTTPStatus.NOT_IMPLEMENTED,
        )
