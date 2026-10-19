"""Storage-independent Wiki document rules shared by readers and editors."""
from __future__ import annotations

import hashlib
import json
from typing import Any

LANGUAGES = ("zh-Hant", "zh-Hans", "en", "ko")


class WikiEditConflictError(RuntimeError):
    """The creator's loaded revision is no longer current."""


def wiki_data_hash(data: Any) -> str:
    raw = json.dumps(data or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def validate_wiki_data(data: Any) -> dict:
    if not isinstance(data, dict):
        raise ValueError("data must be an object")
    guides = data.get("guides")
    if not isinstance(guides, dict) or not guides:
        raise ValueError("data.guides must be a non-empty object")
    for lang, guide in guides.items():
        if lang not in LANGUAGES or not isinstance(guide, dict):
            raise ValueError(f"Unsupported Wiki guide: {lang}")
        if not isinstance(guide.get("sections"), list):
            raise ValueError(f"data.guides.{lang}.sections must be an array")
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > 2 * 1024 * 1024:
        raise ValueError("Wiki document exceeds 2 MiB")
    return data
