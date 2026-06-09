#!/usr/bin/env python3
"""Privy access-token verification for the Expo profile API."""

from __future__ import annotations

import os
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any


class PrivyAuthError(Exception):
    def __init__(self, message: str, status: HTTPStatus = HTTPStatus.UNAUTHORIZED):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class PrivyClaims:
    subject: str
    email: str = ""
    name: str = ""
    payload: dict[str, Any] | None = None


def claims_from_authorization_header(header_value: str | None) -> PrivyClaims:
    token = _bearer_token(header_value)
    if not token:
        raise PrivyAuthError("Missing Privy bearer token.", HTTPStatus.UNAUTHORIZED)

    if _dev_auth_enabled() and token.startswith("dev:"):
        subject = token.removeprefix("dev:").strip()
        if not subject:
            raise PrivyAuthError("Invalid development auth token.", HTTPStatus.UNAUTHORIZED)
        return PrivyClaims(subject=f"did:privy:dev:{subject}", email="", name="Development user", payload={"dev": True})

    app_id = str(os.getenv("PRIVY_APP_ID") or "").strip()
    verification_key = _verification_key()
    if not app_id or not verification_key:
        raise PrivyAuthError(
            "Privy verification is not configured. Set PRIVY_APP_ID and PRIVY_VERIFICATION_KEY.",
            HTTPStatus.SERVICE_UNAVAILABLE,
        )

    try:
        import jwt
    except Exception as exc:  # pragma: no cover - depends on deployment deps
        raise PrivyAuthError(f"PyJWT is not installed for Privy verification: {exc}", HTTPStatus.SERVICE_UNAVAILABLE) from exc

    try:
        payload = jwt.decode(
            token,
            verification_key,
            algorithms=["ES256"],
            audience=app_id,
            issuer="privy.io",
        )
    except Exception as exc:
        raise PrivyAuthError(f"Invalid Privy access token: {exc}", HTTPStatus.UNAUTHORIZED) from exc

    subject = str(payload.get("sub") or "").strip()
    if not subject:
        raise PrivyAuthError("Privy token is missing subject.", HTTPStatus.UNAUTHORIZED)

    return PrivyClaims(
        subject=subject,
        email=str(payload.get("email") or "").strip(),
        name=str(payload.get("name") or "").strip(),
        payload=payload,
    )


def _bearer_token(header_value: str | None) -> str:
    raw = str(header_value or "").strip()
    if not raw:
        return ""
    scheme, _, value = raw.partition(" ")
    if scheme.lower() != "bearer":
        return ""
    return value.strip()


def _verification_key() -> str:
    raw = str(
        os.getenv("PRIVY_VERIFICATION_KEY")
        or os.getenv("PRIVY_PUBLIC_KEY")
        or ""
    ).strip()
    return raw.replace("\\n", "\n")


def _dev_auth_enabled() -> bool:
    return str(os.getenv("EXPO_PROFILE_DEV_AUTH") or "").strip().lower() in {"1", "true", "yes", "on"}
