"""The authoritative Wiki reader shared by website and knowledge retrieval."""
from __future__ import annotations

from pathlib import Path
import json
import os
from threading import RLock
from typing import Any

from beginner_wiki_routes import with_section_routes

WIKI_READ_LOCK = RLock()


def read_beginner_wiki_document(data_root: Path, *, lock: Any = WIKI_READ_LOCK) -> dict[str, Any]:
    if os.getenv('HUB_FORBID_DATABASE') == '1':
        # This is an explicit processing input captured from Postgres during
        # the job's load phase. Missing/corrupt input fails; never use old Wiki.
        from wiki_content import wiki_data_hash
        document = json.loads((data_root / '.published-wiki.json').read_text())
        if (not document.get('exists') or
                wiki_data_hash(document.get('data')) != (document.get('meta') or {}).get('content_hash')):
            raise RuntimeError('Worker Wiki publication checksum mismatch')
        return with_section_routes(document)
    # Public readers and the worker's load phase use the authoritative DB.
    from postgres_wiki_store import wiki_store
    return with_section_routes(wiki_store().read())
