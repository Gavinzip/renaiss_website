#!/usr/bin/env python3
"""Zeabur entrypoint for the Renaiss website backend."""

from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCRIPTS_DIR = ROOT / "scripts"
if not SCRIPTS_DIR.exists():
    # Backward-compatible fallback for older tree layout.
    SCRIPTS_DIR = ROOT / "website" / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import ai_intel_server  # noqa: E402


def main() -> int:
    host = os.getenv("HOST") or "0.0.0.0"
    port = os.getenv("PORT") or "8787"
    news_interval = os.getenv("NEWS_INTERVAL_MINUTES") or str(ai_intel_server.DEFAULT_POKEMON_NEWS_INTERVAL_MINUTES)
    news_langs = os.getenv("NEWS_LANGS") or "zh-Hant,zh-Hans,en,ko"

    sys.argv = [
        sys.argv[0],
        "--host",
        host,
        "--port",
        str(port),
        "--news-interval-minutes",
        str(news_interval),
        "--news-langs",
        news_langs,
    ]
    return ai_intel_server.main()


if __name__ == "__main__":
    raise SystemExit(main())
