"""Canonical visible source shared by HTTP reads and translation jobs."""
from __future__ import annotations

import re
from x_intel_core import (
    OFFICIAL_DISCORD_CHANNEL_IDS, is_retired_source_handle,
    migrate_card_taxonomy_payload, normalize_account_handle,
    public_event_metadata, read_x_source_config,
)


def canonical_feed_source(feed: dict) -> dict:
    if not isinstance(feed, dict):
        return feed
    source_config = read_x_source_config()
    account_projects = source_config.get("account_projects")
    if not isinstance(account_projects, dict):
        account_projects = {}
    account_source_roles = source_config.get("account_categories")
    if not isinstance(account_source_roles, dict):
        account_source_roles = {}
    roles_by_handle = {
        normalize_account_handle(account): str(role or "other")
        for account, role in account_source_roles.items()
        if normalize_account_handle(account)
    }
    enriched = dict(feed)
    enriched["account_projects"] = {
        str(account): str(project_id)
        for account, project_id in account_projects.items()
        if str(account).strip() and str(project_id).strip()
    }
    enriched["account_source_roles"] = {
        str(account): str(role)
        for account, role in account_source_roles.items()
        if str(account).strip() and str(role).strip()
    }
    cards = feed.get("cards") if isinstance(feed.get("cards"), list) else []
    canonical_cards: list[dict] = []
    for raw in cards:
        if not isinstance(raw, dict) or is_retired_source_handle(raw.get("account")):
            continue
        row = dict(raw)
        account = normalize_account_handle(row.get("account"))
        source_role = roles_by_handle.get(account, row.get("source_role") or "other")
        discord_match = re.search(r"discord\.com/channels/[^/]+/(\d+)/\d+", str(row.get("url") or ""), re.I)
        if discord_match and str(discord_match.group(1) or "") in OFFICIAL_DISCORD_CHANNEL_IDS:
            source_role = "official"
        migrate_card_taxonomy_payload(row, source_role)
        row.update(public_event_metadata(row))
        canonical_cards.append(row)
    enriched["cards"] = canonical_cards
    enriched["total_cards"] = len(canonical_cards)
    enriched["accounts"] = [
        str(account)
        for account in (feed.get("accounts") or [])
        if str(account).strip() and not is_retired_source_handle(account)
    ]
    for key in ("source_stats", "source_quality"):
        values = feed.get(key)
        if isinstance(values, dict):
            enriched[key] = {
                account: value
                for account, value in values.items()
                if not is_retired_source_handle(account)
            }
    return enriched
