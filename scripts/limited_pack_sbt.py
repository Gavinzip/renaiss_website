"""Public limited-pack SBT definitions, independently of social-post classification.

Pack times describe the earning window, never a wallet's badge minting deadline.
Only official public pack data and published badge requirements are joined.
"""
from __future__ import annotations

import copy
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Event, Lock, Thread

OFFICIAL_ORIGIN = "https://www.renaiss.xyz"
PACK_SOURCE = OFFICIAL_ORIGIN + "/gacha"
CATALOG_SOURCE = OFFICIAL_ORIGIN + "/profile/achievements"
PACK_API = OFFICIAL_ORIGIN + "/api/trpc/cardPack.getAll?" + urllib.parse.urlencode({
    "batch": "1", "input": json.dumps({"0": {"json": {"includeInactive": True}}}),
})
POLL_SECONDS = 60
PACK_MAX_AGE_SECONDS = 150
CATALOG_REFRESH_SECONDS = 600
_JSON_STRING = r'"(?:\\.|[^"\\])*"'


def _read_public(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Renaiss-Community-Hub/1.0", "Accept": "*/*"})
    with urllib.request.urlopen(request, timeout=8) as response:
        if urllib.parse.urlsplit(response.url).netloc != "www.renaiss.xyz":
            raise ValueError("Official source redirected outside its origin")
        body = response.read(8_000_001)
    if len(body) > 8_000_000:
        raise ValueError("Official source exceeded the size limit")
    return body.decode("utf-8")


def normalize_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).upper().split())


def parse_catalog(module: str) -> list[dict]:
    rows = []
    for match in re.finditer(r'\{id:(\d+),name:.*?canBeWhitelisted:![01](?:[^}]*)\}', module):
        row = {"id": int(match.group(1))}
        for key in ("name", "description", "howToEarn"):
            field = re.search(r'(?:[,{])' + key + ':(' + _JSON_STRING + ')', match.group())
            if field:
                row[key] = json.loads(field.group(1))
        if all(isinstance(row.get(key), str) and row[key] for key in ("name", "howToEarn")):
            rows.append(row)
    if not rows or len({row["id"] for row in rows}) != len(rows):
        raise ValueError("Official SBT catalog format could not be verified")
    return rows


def discover_catalog(read=_read_public) -> tuple[list[dict], str]:
    """Discover versioned catalog code from the official route, without pinning a hash."""
    html = read(CATALOG_SOURCE)
    paths = re.findall(r'<script\b[^>]*\bsrc=[\"\'](/_next/static/[^\"\']+\.js)[\"\']', html)
    candidates = list(dict.fromkeys(reversed(paths)))[:24]
    if not candidates:
        raise ValueError("Official SBT route did not publish its modules")

    def inspect(path):
        try:
            module = read(OFFICIAL_ORIGIN + path)
            if "howToEarn:" in module and "canBeWhitelisted:" in module:
                return parse_catalog(module), OFFICIAL_ORIGIN + path
        except (OSError, ValueError, UnicodeError):
            pass  # A non-catalog module is not an alternate badge data source.
        return None

    with ThreadPoolExecutor(max_workers=4) as executor:
        for offset in range(0, len(candidates), 4):
            results = list(executor.map(inspect, candidates[offset:offset + 4]))
            for result in results:
                if result is not None:
                    return result
    raise ValueError("Official SBT catalog is unavailable or changed format")


def parse_packs(payload: object) -> list[dict]:
    try:
        rows = payload[0]["result"]["data"]["json"]["cardPacks"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Official card-pack API format changed") from exc
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise ValueError("Official card-pack API did not return a pack list")
    return rows


def _timestamp(value: object) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Pack date has an invalid type")
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("Pack date has no time zone")
    return date


def pack_badges(pack_name: str, catalog: list[dict]) -> list[dict]:
    pack = normalize_name(pack_name)
    base = re.sub(r"\s+PACK$", "", pack)
    # Requiring both the badge prefix and the complete pack name in its earning
    # rule excludes the older 'BNB X Renaiss Lunar Pack' campaign, for example.
    pack_rule = re.compile(r"(?:\bFROM (?:THE )?|\b(?:PULL 1|OPEN ≥\s*1) )" + re.escape(pack) + r"(?![A-Z0-9])")
    matches = []
    for row in catalog:
        name, rule = normalize_name(row["name"]), normalize_name(row["howToEarn"])
        if not name.startswith(base + " ") or not pack_rule.search(rule):
            continue
        if re.search(r"S[- ](?:TIER|CARD)|THE S FROM", rule):
            category = "s_card"
        elif "TIER" in name and "TIER" in rule:
            category = "special_tier"
        elif re.search(r"AT LEAST ONE|≥\s*1|\b1\b", rule):
            category = "first_pull"
        else:
            continue
        matches.append({
            "id": row["id"], "name": row["name"], "category": category,
            "requirement": row["howToEarn"],
        })
    # Ambiguous reused names must be reviewed at the source, not guessed here.
    categories = [row["category"] for row in matches]
    if len(set(categories)) != len(categories):
        return []
    order = {"first_pull": 0, "s_card": 1, "special_tier": 2}
    return sorted(matches, key=lambda row: order[row["category"]])


def build_campaigns(packs: list[dict], catalog: list[dict], now: datetime) -> list[dict]:
    campaigns = []
    for pack in packs:
        if pack.get("packType") not in ("limited", "v3-limited") or pack.get("visibility") != "public" or pack.get("isStaging") is not False:
            continue
        stage = pack.get("stage")
        if stage not in ("active", "tease", "countdown", "archived", "soldout-or-restocking"):
            continue
        if not isinstance(pack.get("id"), str) or not isinstance(pack.get("name"), str):
            raise ValueError("Public limited pack is missing its identity")
        start, end = _timestamp(pack.get("activeFrom")), _timestamp(pack.get("activeUntil"))
        if start and end and end < start:
            raise ValueError("Limited pack has an invalid earning window")
        if stage in ("archived", "soldout-or-restocking") or (end and end <= now):
            status = "ended"
        elif stage in ("tease", "countdown") or (start and start > now):
            status = "upcoming"
        else:
            status = "open"
        badges = pack_badges(pack["name"], catalog)
        campaigns.append({
            "id": pack["id"], "name": pack["name"], "status": status,
            "earning_start": pack.get("activeFrom"), "earning_end": pack.get("activeUntil"),
            "source_url": PACK_SOURCE, "badges": badges,
            "catalog_complete": {"first_pull", "s_card"}.issubset({row["category"] for row in badges}),
        })
    return sorted(campaigns, key=lambda row: row["earning_start"] or "", reverse=True)


class LimitedPackSbtSource:
    def __init__(self, read=_read_public):
        self._read = read
        self._lock = Lock()
        self._refresh_lock = Lock()
        self._started = False
        self._packs: list[dict] = []
        self._catalog: list[dict] = []
        self._catalog_at = 0.0
        self._packs_at = 0.0
        self._catalog_url = ""
        self._checked_at = None
        self._error = ""

    def start(self) -> None:
        with self._lock:
            if self._started:
                return
            self._started = True
        Thread(target=self._run, name="limited-pack-sbt", daemon=True).start()

    def _run(self) -> None:
        wait = Event()
        while True:
            self.refresh()
            wait.wait(POLL_SECONDS)

    def refresh(self) -> None:
        with self._refresh_lock:
            try:
                packs = parse_packs(json.loads(self._read(PACK_API)))
                packs_at = time.monotonic()
                if time.monotonic() - self._catalog_at >= CATALOG_REFRESH_SECONDS or not self._catalog:
                    catalog, catalog_url = discover_catalog(self._read)
                else:
                    catalog, catalog_url = self._catalog, self._catalog_url
                campaigns = build_campaigns(packs, catalog, datetime.now(timezone.utc))
                # A newly published pack prompts a catalog check before the normal
                # interval. Missing definitions stay explicitly unpublished.
                if any(not row["catalog_complete"] and row["status"] != "ended" for row in campaigns) and catalog is self._catalog:
                    catalog, catalog_url = discover_catalog(self._read)
                with self._lock:
                    catalog_changed = catalog is not self._catalog
                    self._packs, self._catalog, self._catalog_url = packs, catalog, catalog_url
                    self._packs_at = packs_at
                    if catalog_changed or not self._catalog_at:
                        self._catalog_at = self._packs_at
                    self._checked_at = datetime.now(timezone.utc).isoformat()
                    self._error = ""
            except Exception as exc:
                with self._lock:
                    self._error = str(exc)
                print(f"[limited-pack-sbt] source verification failed: {exc}", flush=True)

    def snapshot(self) -> dict:
        with self._lock:
            status = "unavailable" if self._error or (self._packs_at and time.monotonic() - self._packs_at > PACK_MAX_AGE_SECONDS) else "ready" if self._packs_at else "loading"
            # Never continue advertising cached earning opportunities on an error.
            campaigns = build_campaigns(self._packs, self._catalog, datetime.now(timezone.utc)) if status == "ready" else []
            return copy.deepcopy({
                "ok": True, "status": status, "checked_at": self._checked_at,
                "valid_for_seconds": max(0, int(PACK_MAX_AGE_SECONDS - (time.monotonic() - self._packs_at))) if status == "ready" else 0,
                "pack_source_url": PACK_SOURCE, "catalog_source_url": CATALOG_SOURCE,
                "catalog_module_url": self._catalog_url, "campaigns": campaigns,
                "non_limited_pack_names": [row["name"] for row in self._packs if row.get("visibility") == "public" and row.get("packType") not in ("limited", "v3-limited") and isinstance(row.get("name"), str)] if status == "ready" else [],
            })


limited_pack_sbt_source = LimitedPackSbtSource()
