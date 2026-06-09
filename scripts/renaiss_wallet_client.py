#!/usr/bin/env python3
"""Renaiss public API client for wallet portfolio sync."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests


TRPC_BASE = "https://www.renaiss.xyz/api/trpc"
REQUEST_TIMEOUT = 24


def sync_wallet_cards(address: str, max_cards: int = 80) -> list[dict[str, Any]]:
    clean_address = str(address or "").strip().lower()
    if not clean_address:
        return []

    activities = fetch_user_activities(clean_address, max_pages=8)
    token_ids = token_ids_from_activities(activities)
    cards: list[dict[str, Any]] = []

    for token_id in token_ids:
        if len(cards) >= max_cards:
            break
        try:
            detail = fetch_collectible_detail(token_id)
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                continue
            raise
        owner = str(detail.get("ownerAddress") or "").strip().lower()
        if owner != clean_address:
            continue
        cards.append(profile_card_from_collectible(detail, clean_address, activities))

    return cards


def fetch_user_activities(address: str, max_pages: int = 6) -> list[dict[str, Any]]:
    activities: list[dict[str, Any]] = []
    cursor = ""

    for _ in range(max(1, max_pages)):
        payload: dict[str, Any] = {
            "address": address,
            "limit": 50,
        }
        if cursor:
            payload["cursor"] = cursor

        data = trpc_get("activity.getSubgraphUserActivities", {"json": payload})
        page_items = data.get("activities") if isinstance(data, dict) else []
        if not isinstance(page_items, list) or not page_items:
            break
        activities.extend([item for item in page_items if isinstance(item, dict)])
        next_cursor = str(data.get("nextCursor") or "").strip() if isinstance(data, dict) else ""
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    return activities


def fetch_collectible_detail(token_id: str) -> dict[str, Any]:
    payload = {
        "json": {"tokenId": str(token_id)},
        "meta": {"values": {"tokenId": ["bigint"]}},
    }
    data = trpc_get("collectible.getCollectibleByTokenId", payload)
    return data if isinstance(data, dict) else {}


def trpc_get(procedure: str, input_payload: dict[str, Any]) -> dict[str, Any]:
    encoded = quote(json.dumps(input_payload, separators=(",", ":")))
    url = f"{TRPC_BASE}/{procedure}?input={encoded}"
    response = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": "renaiss-scan-profile-sync/1.0"})
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, list):
        payload = payload[0] if payload else {}
    error = payload.get("error") if isinstance(payload, dict) else None
    if error:
        message = error.get("json", {}).get("message") if isinstance(error, dict) else str(error)
        raise RuntimeError(f"{procedure} failed: {message}")
    data = payload.get("result", {}).get("data", {}).get("json") if isinstance(payload, dict) else None
    return data if isinstance(data, dict) else {}


def token_ids_from_activities(activities: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    token_ids: list[str] = []
    for activity in activities:
        candidates = [
            activity.get("tokenId"),
            (activity.get("item") or {}).get("tokenId") if isinstance(activity.get("item"), dict) else None,
        ]
        for candidate in candidates:
            token_id = str(candidate or "").strip()
            if not token_id or token_id in seen:
                continue
            seen.add(token_id)
            token_ids.append(token_id)
    return token_ids


def activity_token_id(activity: dict[str, Any]) -> str:
    direct = str(activity.get("tokenId") or "").strip()
    if direct:
        return direct
    item = activity.get("item")
    if isinstance(item, dict):
        return str(item.get("tokenId") or "").strip()
    return ""


def profile_card_from_collectible(
    collectible: dict[str, Any],
    wallet_address: str,
    activities: list[dict[str, Any]],
) -> dict[str, Any]:
    token_id = str(collectible.get("tokenId") or "").strip()
    acquisition = acquisition_from_activities(token_id, wallet_address, activities)
    ask_usd = usdt_wei_value(collectible.get("askPriceInUSDT"))
    fmv_usd = cents_value(collectible.get("fmvPriceInUSD") or collectible.get("buybackBaseValueInUSD"))
    grade = " ".join(str(x or "").strip() for x in [collectible.get("gradingCompany"), collectible.get("grade")] if str(x or "").strip())
    language = attribute_value(collectible, "Language")
    image_url = (
        collectible.get("frontImageUrl")
        or collectible.get("imageUrl")
        or collectible.get("frontWithoutStandImageUrl")
    )

    return {
        "id": f"renaiss:{token_id}",
        "source": "Renaiss",
        "token_id": token_id,
        "name": str(collectible.get("name") or f"Renaiss token {token_id[-6:]}"),
        "set_name": str(collectible.get("setName") or ""),
        "card_number": str(collectible.get("cardNumber") or attribute_value(collectible, "Card Number") or ""),
        "game": str(collectible.get("type") or ""),
        "language": language,
        "grading_company": str(collectible.get("gradingCompany") or ""),
        "grade": str(collectible.get("grade") or ""),
        "condition": grade,
        "wallet_address": wallet_address,
        "acquired_at": acquisition.get("acquired_at"),
        "acquisition_price_usd": acquisition.get("price_usd"),
        "purchase_price_usd": acquisition.get("price_usd"),
        "tx_hash": acquisition.get("tx_hash"),
        "current_price_usd": ask_usd or fmv_usd,
        "ask_price_usd": ask_usd,
        "fmv_price_usd": fmv_usd,
        "image_url": image_url,
        "url": f"https://renaiss.xyz/cards/{token_id}",
        "is_listed": bool(ask_usd),
    }


def acquisition_from_activities(
    token_id: str,
    wallet_address: str,
    activities: list[dict[str, Any]],
) -> dict[str, Any]:
    token_activities = [
        item for item in activities
        if activity_token_id(item) == token_id
    ]
    if not token_activities:
        return {}

    mint = latest_activity(token_activities, {"MintActivity", "TransferActivity", "CollectibleTransferActivity"})
    priced = latest_priced_activity(token_activities)
    source = priced or mint or token_activities[0]
    acquired_at = iso_from_timestamp((mint or source).get("timestamp"))

    return {
        "acquired_at": acquired_at,
        "price_usd": usdt_wei_value(source.get("priceInUsdt") or source.get("amount")),
        "tx_hash": source.get("txHash"),
        "buyer_address": wallet_address,
    }


def latest_activity(activities: list[dict[str, Any]], type_names: set[str]) -> dict[str, Any] | None:
    candidates = [item for item in activities if str(item.get("__typename") or item.get("type") or "") in type_names]
    return sorted(candidates, key=activity_time, reverse=True)[0] if candidates else None


def latest_priced_activity(activities: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [
        item for item in activities
        if usdt_wei_value(item.get("priceInUsdt") or item.get("amount")) is not None
    ]
    return sorted(candidates, key=activity_time, reverse=True)[0] if candidates else None


def activity_time(activity: dict[str, Any]) -> int:
    try:
        return int(str(activity.get("timestamp") or "0"))
    except Exception:
        return 0


def attribute_value(collectible: dict[str, Any], trait: str) -> str:
    attributes = collectible.get("attributes")
    if not isinstance(attributes, list):
        return ""
    for item in attributes:
        if not isinstance(item, dict):
            continue
        if str(item.get("trait") or "").strip().lower() == trait.lower():
            return str(item.get("value") or "").strip()
    return ""


def usdt_wei_value(value: Any) -> int | None:
    text = str(value or "").strip()
    if not text or text.startswith("NO-"):
        return None
    try:
        number = int(text)
    except Exception:
        return None
    return round(number / 10**18)


def cents_value(value: Any) -> int | None:
    text = str(value or "").strip()
    if not text or text.startswith("NO-"):
        return None
    try:
        number = int(text)
    except Exception:
        return None
    return round(number / 100)


def iso_from_timestamp(value: Any) -> str:
    try:
        seconds = int(str(value or "0"))
    except Exception:
        return ""
    if seconds <= 0:
        return ""
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()
