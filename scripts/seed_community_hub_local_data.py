#!/usr/bin/env python3
"""Seed an isolated Community Hub data directory from the public live feed."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import urllib.request
from pathlib import Path


DEFAULT_SOURCE_URL = "https://renaiss.zeabur.app/api/intel/feed?lang=zh-Hant"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, help="Isolated local data directory used by WEBSITE_DATA_ROOT")
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--replace", action="store_true", help="Replace an existing local feed snapshot")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_path = output_dir / "x_intel_feed.json"
    if output_path.exists() and not args.replace:
        raise SystemExit(f"Local feed already exists: {output_path}; pass --replace to refresh it")

    request = urllib.request.Request(str(args.source_url), headers={"User-Agent": "Renaiss-Community-Hub-Local-Seed/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    feed = payload.get("feed") if isinstance(payload, dict) else None
    cards = feed.get("cards") if isinstance(feed, dict) else None
    if not isinstance(feed, dict) or not isinstance(cards, list):
        raise SystemExit("Source did not return a valid Community Hub feed")

    output_dir.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(prefix=".x_intel_feed.", suffix=".tmp", dir=output_dir)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as handle:
            json.dump(feed, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, output_path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

    print(f"Seeded {len(cards)} public cards into {output_path}")


if __name__ == "__main__":
    main()
