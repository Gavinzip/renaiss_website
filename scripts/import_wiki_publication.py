#!/usr/bin/env python3
"""Import a verified published Wiki export without replacing existing content."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from postgres_wiki_store import wiki_store
from wiki_content import wiki_data_hash


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Saved GET /api/wiki/beginner JSON response")
    args = parser.parse_args()
    document = json.loads(args.export.read_text(encoding="utf-8"))["wiki"]
    if not document.get("exists"):
        raise ValueError("The exported publication does not exist")
    expected_hash = document["meta"]["content_hash"]
    if wiki_data_hash(document["data"]) != expected_hash:
        raise ValueError("Export hash mismatch; import refused")
    saved = wiki_store().import_document(document["data"], actor="verified-wiki-import")
    if wiki_data_hash(saved["data"]) != expected_hash:
        raise RuntimeError("Imported publication hash mismatch")
    print(json.dumps({"imported": True, "content_hash": expected_hash,
                      "revision": saved["meta"]["revision"],
                      "languages": sorted(saved["data"]["guides"])}))


if __name__ == "__main__":
    main()
