"""The published Wiki reader shared by the website and knowledge retrieval."""
from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Any

from directus_wiki import directus_wiki_enabled, read_directus_beginner_wiki, wiki_data_hash

WIKI_READ_LOCK = RLock()


def read_beginner_wiki_document(data_root: Path, *, lock: Any = WIKI_READ_LOCK) -> dict[str, Any]:
    if directus_wiki_enabled():
        return read_directus_beginner_wiki()
    path = data_root / "beginner_wiki_content.json"
    with lock:
        if not path.exists():
            return {"exists": False, "data": None, "meta": {"provider": "local"}}
        raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("data"), dict):
        raise RuntimeError("beginner wiki data format invalid")
    data = raw["data"]
    meta = {key: raw[key] for key in ("version", "updated_at", "updated_by", "updated_role", "revision") if key in raw}
    meta.update(provider="local", source="local-json", content_hash=wiki_data_hash(data))
    return {"exists": True, "data": data, "meta": meta}
