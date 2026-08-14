#!/usr/bin/env python3
"""Stamp a deterministic frontend release ID into the static website package."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEBSITE_ROOT = ROOT / "website"
MANIFEST_PATH = WEBSITE_ROOT / "client-release.json"
RELEASE_TOKEN = "__RENAISS_CLIENT_RELEASE__"
RELEASE_ATTR_RE = re.compile(r'(data-client-release=")[^"]+(")')
RELEASE_QUERY_RE = re.compile(r'(release=)[^"&]+')
PROFILE_CACHE_RE = re.compile(r"renaiss-profile-shell-(?:[a-f0-9]{12,64}|__RENAISS_CLIENT_RELEASE__)", re.IGNORECASE)
RELEASE_TAG_RE = re.compile(
    r'<script defer src="[^"]*assets/release-integrity\.js\?release=[^"]+" '
    r'data-client-release="[^"]+"></script>'
)


def html_files() -> list[Path]:
    return sorted(WEBSITE_ROOT.rglob("*.html"))


def release_tag(relative_path: Path, release: str) -> str:
    prefix = "../" * len(relative_path.parent.parts)
    return (
        f'<script defer src="{prefix}assets/release-integrity.js?release={release}" '
        f'data-client-release="{release}"></script>'
    )


def ensure_release_tags() -> bool:
    changed = False
    for path in html_files():
        content = path.read_text(encoding="utf-8")
        if "data-client-release=" in content:
            continue
        relative_path = path.relative_to(WEBSITE_ROOT)
        tag = release_tag(relative_path, RELEASE_TOKEN)
        content, inserted = re.subn(
            r"(?m)^([ \t]*)</head>",
            lambda match: f"{match.group(1)}{tag}\n{match.group(1)}</head>",
            content,
            count=1,
        )
        if inserted != 1:
            raise RuntimeError(f"missing </head> in {relative_path}")
        path.write_text(content, encoding="utf-8")
        changed = True
    return changed


def normalized_content(path: Path) -> bytes:
    data = path.read_bytes()
    relative_path = path.relative_to(WEBSITE_ROOT)
    if path.suffix.lower() == ".html":
        text = data.decode("utf-8")
        text = RELEASE_ATTR_RE.sub(rf"\g<1>{RELEASE_TOKEN}\2", text)
        text = RELEASE_QUERY_RE.sub(rf"\g<1>{RELEASE_TOKEN}", text)
        return text.encode("utf-8")
    if relative_path.as_posix() == "profile-sw.js":
        text = data.decode("utf-8")
        return PROFILE_CACHE_RE.sub(f"renaiss-profile-shell-{RELEASE_TOKEN}", text).encode("utf-8")
    return data


def release_id() -> str:
    digest = hashlib.sha256()
    for path in sorted(WEBSITE_ROOT.rglob("*")):
        if not path.is_file() or path == MANIFEST_PATH or path.name == ".DS_Store":
            continue
        relative_path = path.relative_to(WEBSITE_ROOT).as_posix()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(normalized_content(path))
        digest.update(b"\0")
    return digest.hexdigest()[:20]


def stamp(release: str) -> bool:
    changed = False
    for path in html_files():
        content = path.read_text(encoding="utf-8")
        relative_path = path.relative_to(WEBSITE_ROOT)
        replacement = release_tag(relative_path, release)
        updated, replacements = RELEASE_TAG_RE.subn(replacement, content, count=1)
        if replacements != 1:
            raise RuntimeError(f"missing release integrity tag in {relative_path}")
        if updated != content:
            path.write_text(updated, encoding="utf-8")
            changed = True

    profile_sw = WEBSITE_ROOT / "profile-sw.js"
    sw_content = profile_sw.read_text(encoding="utf-8")
    sw_updated = PROFILE_CACHE_RE.sub(f"renaiss-profile-shell-{release}", sw_content, count=1)
    if PROFILE_CACHE_RE.search(sw_content) is None:
        raise RuntimeError("missing profile service worker release marker")
    if sw_updated != sw_content:
        profile_sw.write_text(sw_updated, encoding="utf-8")
        changed = True

    manifest = {"schema": 1, "release": release}
    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if not MANIFEST_PATH.exists() or MANIFEST_PATH.read_text(encoding="utf-8") != manifest_text:
        MANIFEST_PATH.write_text(manifest_text, encoding="utf-8")
        changed = True
    return changed


def is_current(release: str) -> bool:
    if not MANIFEST_PATH.exists():
        return False
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    if manifest != {"schema": 1, "release": release}:
        return False
    for path in html_files():
        content = path.read_text(encoding="utf-8")
        if f'data-client-release="{release}"' not in content or f"release={release}" not in content:
            return False
    return f"renaiss-profile-shell-{release}" in (WEBSITE_ROOT / "profile-sw.js").read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when release metadata is stale instead of writing it")
    args = parser.parse_args()

    if not WEBSITE_ROOT.is_dir():
        raise SystemExit(f"missing website root: {WEBSITE_ROOT}")
    if args.check:
        release = release_id()
        if not is_current(release):
            raise SystemExit("frontend release metadata is stale; run scripts/stamp_client_release.py")
        print(f"frontend release metadata is current: {release}")
        return 0

    ensure_release_tags()
    release = release_id()
    changed = stamp(release)
    print(f"frontend release stamped: {release} ({'updated' if changed else 'unchanged'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
