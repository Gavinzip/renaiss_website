"""HTTP integration for durable jobs; authentication stays in the original Handler."""
from __future__ import annotations

import hashlib
import gzip
import json
import mimetypes
from urllib.parse import parse_qs, unquote, urlparse

from hub_job_store import job_store
from hub_worker_actions import ACTION_PATHS
from hub_snapshot_store import safe_name, snapshot_store
from neon_feed_store import feed_store_from_environment


def handle_get(handler) -> bool:
    path = handler._request_path()
    if path == '/api/community-hub/preview-config':
        hostname = urlparse('http://' + str(handler.headers.get('Host') or '')).hostname
        environment = 'local' if hostname in {'127.0.0.1', 'localhost', '::1'} else 'production'
        handler._send_json({'ok': True, 'environment': environment})
        return True
    from hub_public_http import handle_public
    if handle_public(handler):
        return True
    if path.startswith("/data/generated_covers/"):
        name = safe_name(unquote(path).removeprefix("/data/"))
        if not name.startswith("generated_covers/"):
            handler.send_error(404)
            return True
        raw = snapshot_store().read(name)
        if raw is None:
            handler.send_error(404)
            return True
        etag = '"' + hashlib.sha256(raw).hexdigest() + '"'
        if handler.headers.get("If-None-Match") == etag:
            handler.send_response(304)
            handler.end_headers()
            return True
        handler.send_response(200)
        handler.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
        handler.send_header("Content-Length", str(len(raw)))
        from hub_cache import MEDIA_TAG
        handler.send_header("Cache-Control", "no-cache")
        handler.send_header("Vercel-CDN-Cache-Control", "public, max-age=604800")
        handler.send_header("Vercel-Cache-Tag", MEDIA_TAG)
        handler.send_header("ETag", etag)
        handler.end_headers()
        handler.wfile.write(raw)
        return True
    if path == '/api/intel/limited-pack-sbt':
        # Serverless imports do not run the legacy main() polling thread.
        # Read the same authoritative source on demand, within its original TTL.
        from limited_pack_sbt import limited_pack_sbt_source
        limited_pack_sbt_source.refresh(if_due=True)
        handler._send_json(limited_pack_sbt_source.snapshot())
        return True
    if path == "/api/pilot/status":
        handler._send_json({"ok": True, "mode": "isolated-migration-pilot", **feed_store_from_environment().status()})
        return True
    if path == "/api/auth/me":
        handler._send_json({**handler._auth_me_payload(), "password_login_available": True, "migration_pilot": True})
        return True
    if path == '/api/pilot/schedules':
        if handler._require_admin_access():
            handler._send_json({'ok':True,'schedules':job_store().schedule_status()})
        return True
    if path == "/api/pilot/jobs":
        if handler._require_admin_access():
            handler._send_json({"ok": True, "jobs": job_store().recent()})
        return True
    return False


def handle_post(handler) -> bool:
    path = handler._request_path()
    if path == "/api/wiki/beginner":
        # Keep the original same-origin, authenticated editor route. Wiki
        # operations do not enqueue or hydrate the whole feed snapshot.
        from ai_intel_server import Handler
        Handler.do_POST(handler)
        return True
    if path not in ACTION_PATHS | {"/api/intel/backup", "/api/intel/restore", "/api/intel/sync", "/api/intel/analyze-url", "/api/intel/job-status", "/api/intel/refresh-content", "/api/intel/retranslate"}:
        return False
    if not handler._is_trusted_write_origin():
        handler._send_json({"ok": False, "error": "Forbidden origin"}, status=403)
        return True
    public_actions = {'/api/intel/agent','/api/intel/translate-texts','/api/intel/public-feedback'}
    if path == '/api/wiki/beginner':
        if not handler._require_wiki_editor_access(): return True
    elif path not in public_actions | {'/api/intel/job-status'} and not handler._require_admin_access():
        return True
    try:
        length = int(handler.headers.get("Content-Length") or 0)
        if not 0 <= length <= 2*1024*1024:
            raise ValueError("Request is too large")
        payload = json.loads(handler.rfile.read(length) or b"{}")
        if not isinstance(payload, dict):
            raise ValueError("Request must be an object")
        if path == "/api/intel/job-status":
            result = job_store().get(str(payload.get("id") or ""))
            if result and result.get('created_by') not in {'public', handler._current_user()} and not handler._require_admin_access():
                return True
            handler._send_json({"ok": bool(result), "job": result}, status=200 if result else 404)
            return True
        if path in ACTION_PATHS:
            kind, data = 'action', {'path':path,'body':payload,'role':handler._current_role(),'user_agent':str(handler.headers.get('User-Agent') or ''),'referer':str(handler.headers.get('Referer') or '')}
        elif path in {'/api/intel/backup','/api/intel/restore'}:
            kind, data = path.rsplit('/',1)[1], {'backup_id':str(payload.get('backup_id') or '')}
        elif path == '/api/intel/sync':
            accounts = payload.get('accounts')
            if accounts is not None and (not isinstance(accounts,list) or not all(isinstance(a,str) for a in accounts)):
                raise ValueError('accounts must be a list of handles')
            kind, data = 'sync', {'accounts':accounts,'days':max(1,min(int(payload.get('days') or 30),365))}
        elif path == "/api/intel/analyze-url":
            from x_intel_core import normalize_x_url
            url = normalize_x_url(str(payload.get("url") or ""))
            feed = feed_store_from_environment().read()
            existing = next((c for c in feed.get("cards", []) if c.get("url") == url), None)
            kind, data = ("reanalyze", {"id": str(existing["id"])}) if existing else ("analyze_url", {"url": url})
        elif path == "/api/intel/refresh-content":
            kind, data = "reanalyze", {"id": str(payload.get("id") or "").strip()}
            if not data["id"]:
                raise ValueError("Card id is required")
        else:
            lang = str(payload.get("lang") or "all").strip()
            targets = ["zh-Hans", "en", "ko"] if lang == "all" else [v.strip() for v in lang.split(",")]
            if not targets or any(v not in {"zh-Hant", "zh-Hans", "en", "ko"} for v in targets):
                raise ValueError("Unsupported translation language")
            kind, data = "translate", {"target_langs": targets, "force": bool(payload.get("force")) or payload.get("mode") in {"full", "reset", "rebuild"}}
        job = job_store().enqueue(kind, data, handler._current_user() or "public")
        import os
        if os.getenv('HUB_JOB_CONTROL') == 'vercel':
            handler._send_json({'ok': True, 'started': True, 'job': job, 'refresh': job, 'dispatch': {'pending': False}})
            return True
        from hub_cache import runtime_request
        try:
            runtime_request({'run_jobs': True})
            dispatch = {'pending': False}
        except Exception as exc:
            print('hub_dispatch_pending', type(exc).__name__, flush=True)
            dispatch = {'pending': True, 'message': 'Job queued; dispatch pending. Scheduled runner will retry.'}
        handler._send_json({"ok": True, "started": True, "job": job, "refresh": job, 'dispatch': dispatch})
    except (ValueError, TypeError) as exc:
        handler._send_json({"ok": False, "error": str(exc)}, status=400)
    return True
