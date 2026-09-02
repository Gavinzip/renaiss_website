#!/usr/bin/env python3
"""Zeabur entrypoint for the Renaiss website backend."""

from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCRIPTS_DIR = ROOT / "scripts"
if not SCRIPTS_DIR.exists():
    raise FileNotFoundError(f"Missing runtime scripts directory: {SCRIPTS_DIR}")
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import ai_intel_server  # noqa: E402


def main() -> int:
    host = os.getenv("HOST") or "0.0.0.0"
    port = os.getenv("PORT") or "8787"
    os.environ.setdefault("X_SYNC_RUN_ON_STARTUP", "1")

    sys.argv = [
        sys.argv[0],
        "--host",
        host,
        "--port",
        str(port),
    ]
    return ai_intel_server.main()


if __name__ == "__main__":
    raise SystemExit(main())
