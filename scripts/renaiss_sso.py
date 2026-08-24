#!/usr/bin/env python3
"""Server-side Renaiss OIDC client for the website editor session."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from threading import Lock
from typing import Any
from urllib.parse import urlencode, urlparse

import jwt
import requests


class RenaissSsoError(RuntimeError):
    """A sanitized Renaiss SSO failure safe to show to the application."""


_DISCOVERY_LOCK = Lock()
_DISCOVERY_CACHE: tuple[float, dict[str, Any]] | None = None
_JWKS_CLIENTS: dict[str, jwt.PyJWKClient] = {}
_CHALLENGES_LOCK = Lock()
_CHALLENGES: dict[str, dict[str, Any]] = {}


def _env(name: str, default: str = "") -> str:
    return str(os.getenv(name, default) or default).strip()


def _csv(name: str) -> set[str]:
    return {part.strip().lower() for part in _env(name).split(",") if part.strip()}


def renaiss_sso_enabled() -> bool:
    return bool(_env("RENAISS_ISSUER") and _env("RENAISS_CLIENT_ID") and _env("RENAISS_CLIENT_SECRET"))


def renaiss_sso_admin_configured() -> bool:
    return bool(_csv("RENAISS_SSO_ADMIN_SUBS") or _csv("RENAISS_SSO_ADMIN_EMAILS"))


def _issuer() -> str:
    return _env("RENAISS_ISSUER", "https://www.renaiss.xyz/api/auth").rstrip("/")


def _request_timeout() -> float:
    try:
        return max(3.0, min(float(_env("RENAISS_HTTP_TIMEOUT_SECONDS", "12")), 30.0))
    except ValueError:
        return 12.0


def _discovery(force: bool = False) -> dict[str, Any]:
    global _DISCOVERY_CACHE
    now = time.monotonic()
    with _DISCOVERY_LOCK:
        if not force and _DISCOVERY_CACHE and now - _DISCOVERY_CACHE[0] < 3600:
            return dict(_DISCOVERY_CACHE[1])
        if not renaiss_sso_enabled():
            raise RenaissSsoError("Renaiss SSO is not configured")
        try:
            response = requests.get(f"{_issuer()}/.well-known/openid-configuration", timeout=_request_timeout())
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            raise RenaissSsoError("Renaiss discovery is unavailable") from exc
        if not isinstance(payload, dict) or str(payload.get("issuer") or "").rstrip("/") != _issuer():
            raise RenaissSsoError("Renaiss discovery issuer mismatch")
        required = ("authorization_endpoint", "token_endpoint", "jwks_uri")
        if any(not str(payload.get(key) or "").startswith("https://") for key in required):
            raise RenaissSsoError("Renaiss discovery is incomplete")
        _DISCOVERY_CACHE = (now, dict(payload))
        return dict(payload)


def _safe_return_to(value: str | None) -> str:
    raw = str(value or "/community-hub/").strip()
    parsed = urlparse(raw)
    if parsed.scheme or parsed.netloc or not raw.startswith("/") or raw.startswith("//"):
        return "/community-hub/"
    return raw[:2048]


def _redirect_uri(request_origin: str) -> str:
    configured = _env("RENAISS_REDIRECT_URI")
    if configured:
        return configured
    origin = _env("PUBLIC_APP_ORIGIN") or str(request_origin or "").strip()
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RenaissSsoError("Renaiss callback origin is not configured")
    return f"{origin.rstrip('/')}/auth/callback"


def _purge_challenges(now: float | None = None) -> None:
    current = now if now is not None else time.time()
    stale = [state for state, item in _CHALLENGES.items() if float(item.get("expires_at") or 0) <= current]
    for state in stale:
        _CHALLENGES.pop(state, None)


def begin_login(request_origin: str, return_to: str | None = None) -> dict[str, str]:
    discovery = _discovery()
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    redirect_uri = _redirect_uri(request_origin)
    with _CHALLENGES_LOCK:
        _purge_challenges()
        _CHALLENGES[state] = {
            "verifier": verifier,
            "nonce": nonce,
            "redirect_uri": redirect_uri,
            "return_to": _safe_return_to(return_to),
            "expires_at": time.time() + 600,
        }
    params = {
        "response_type": "code",
        "client_id": _env("RENAISS_CLIENT_ID"),
        "redirect_uri": redirect_uri,
        "scope": _env("RENAISS_SCOPE", "openid profile email safe x"),
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "consent",
    }
    return {
        "authorization_url": f"{discovery['authorization_endpoint']}?{urlencode(params)}",
        "redirect_uri": redirect_uri,
        "return_to": _safe_return_to(return_to),
        "state": state,
    }


def _consume_challenge(state: str) -> dict[str, Any]:
    supplied = str(state or "").strip()
    if not supplied:
        raise RenaissSsoError("Invalid OAuth state")
    with _CHALLENGES_LOCK:
        _purge_challenges()
        matched_state = next((key for key in _CHALLENGES if hmac.compare_digest(key, supplied)), "")
        challenge = _CHALLENGES.pop(matched_state, None) if matched_state else None
    if not isinstance(challenge, dict):
        raise RenaissSsoError("Invalid OAuth state")
    return challenge


def _token_request(discovery: dict[str, Any], code: str, challenge: dict[str, Any]) -> dict[str, Any]:
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": challenge["redirect_uri"],
        "client_id": _env("RENAISS_CLIENT_ID"),
        "code_verifier": challenge["verifier"],
    }
    method = _env("RENAISS_TOKEN_AUTH_METHOD", "post").lower()
    kwargs: dict[str, Any] = {"data": form, "timeout": _request_timeout(), "headers": {"Accept": "application/json"}}
    if method in {"basic", "client_secret_basic"}:
        kwargs["auth"] = (_env("RENAISS_CLIENT_ID"), _env("RENAISS_CLIENT_SECRET"))
    else:
        form["client_secret"] = _env("RENAISS_CLIENT_SECRET")
    try:
        response = requests.post(str(discovery["token_endpoint"]), **kwargs)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise RenaissSsoError("Renaiss token exchange failed") from exc
    if not isinstance(payload, dict) or not str(payload.get("id_token") or ""):
        raise RenaissSsoError("Renaiss token response is incomplete")
    return payload


def _verified_claims(discovery: dict[str, Any], token_payload: dict[str, Any], nonce: str) -> dict[str, Any]:
    id_token = str(token_payload.get("id_token") or "")
    jwks_uri = str(discovery.get("jwks_uri") or "")
    try:
        client = _JWKS_CLIENTS.setdefault(jwks_uri, jwt.PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600))
        signing_key = client.get_signing_key_from_jwt(id_token)
        algorithms = discovery.get("id_token_signing_alg_values_supported") or ["RS256"]
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=[str(value) for value in algorithms],
            audience=_env("RENAISS_CLIENT_ID"),
            issuer=_issuer(),
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except Exception as exc:
        raise RenaissSsoError("Renaiss identity verification failed") from exc
    if not hmac.compare_digest(str(claims.get("nonce") or ""), str(nonce or "")):
        raise RenaissSsoError("Renaiss identity nonce mismatch")
    return dict(claims)


def _userinfo(discovery: dict[str, Any], access_token: str) -> dict[str, Any]:
    endpoint = str(discovery.get("userinfo_endpoint") or "")
    if not endpoint or not access_token:
        return {}
    try:
        response = requests.get(
            endpoint,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=_request_timeout(),
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise RenaissSsoError("Renaiss user profile is unavailable") from exc
    return dict(payload) if isinstance(payload, dict) else {}


def _normalize_identity(claims: dict[str, Any]) -> dict[str, Any]:
    sub = str(claims.get("sub") or "").strip()
    if not sub:
        raise RenaissSsoError("Renaiss identity is missing a subject")
    safe_wallet = str(claims.get("safe_wallet_address") or "").strip().lower()
    legacy_wallet = str(claims.get("legacy_wallet_address") or "").strip().lower()
    return {
        "sub": sub,
        "name": str(claims.get("name") or claims.get("preferred_username") or "").strip(),
        "picture": str(claims.get("picture") or "").strip(),
        "email": str(claims.get("email") or "").strip().lower(),
        "email_verified": bool(claims.get("email_verified")),
        "safe_wallet_address": safe_wallet or None,
        "legacy_wallet_address": legacy_wallet or None,
        "chain_id": claims.get("chain_id"),
        "twitter_username": str(claims.get("twitter_username") or "").strip().lstrip("@").lower() or None,
    }


def complete_login(code: str, state: str) -> dict[str, Any]:
    challenge = _consume_challenge(state)
    auth_code = str(code or "").strip()
    if not auth_code:
        raise RenaissSsoError("Renaiss authorization code is missing")
    discovery = _discovery()
    token_payload = _token_request(discovery, auth_code, challenge)
    claims = _verified_claims(discovery, token_payload, str(challenge.get("nonce") or ""))
    profile = _userinfo(discovery, str(token_payload.get("access_token") or ""))
    if profile:
        profile_sub = str(profile.get("sub") or "").strip()
        if profile_sub and profile_sub != str(claims.get("sub") or ""):
            raise RenaissSsoError("Renaiss user profile subject mismatch")
        claims.update(profile)
    return {"identity": _normalize_identity(claims), "return_to": _safe_return_to(challenge.get("return_to"))}


def role_for_identity(identity: dict[str, Any]) -> str:
    sub = str(identity.get("sub") or "").strip().lower()
    email = str(identity.get("email") or "").strip().lower()
    twitter = str(identity.get("twitter_username") or "").strip().lstrip("@").lower()
    if sub in _csv("RENAISS_SSO_ADMIN_SUBS") or email in _csv("RENAISS_SSO_ADMIN_EMAILS"):
        return "admin"
    if (
        sub in _csv("RENAISS_SSO_CREATOR_SUBS")
        or email in _csv("RENAISS_SSO_CREATOR_EMAILS")
        or twitter in _csv("RENAISS_SSO_CREATOR_X_USERNAMES")
    ):
        return "creator"
    default_role = _env("RENAISS_SSO_DEFAULT_ROLE", "viewer").lower()
    return default_role if default_role in {"viewer", "creator"} else "viewer"


def public_identity(identity: dict[str, Any] | None) -> dict[str, Any]:
    source = identity if isinstance(identity, dict) else {}
    return {key: source.get(key) for key in (
        "sub",
        "name",
        "picture",
        "email",
        "email_verified",
        "safe_wallet_address",
        "legacy_wallet_address",
        "chain_id",
        "twitter_username",
    )}
