#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_ROOT = Path(__file__).resolve().parent
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

from x_intel.feedback_feed import (  # noqa: E402
    StoryCard,
    _find_best_canonical_dedupe_match,
    _public_cards,
    _queue_new_duplicates_against_existing,
    _story_card_from_payload,
    dedupe_new_cards_against_batch_canonical,
    read_json,
)
from x_intel.embedding_cache import embedding_cosine_similarity, ensure_embeddings_for_rows  # noqa: E402
from x_intel.knowledge_memory import (  # noqa: E402
    knowledge_embedding_model,
    knowledge_row_for_card,
    memory_window_for_card,
    resolve_openai_embedding_key,
)
from x_intel.bootstrap import data_dir  # noqa: E402


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _load_cards() -> list[StoryCard]:
    feed = read_json(data_dir() / "x_intel_feed.json", {})
    rows = feed.get("cards") if isinstance(feed, dict) else []
    cards: list[StoryCard] = []
    for item in rows if isinstance(rows, list) else []:
        if isinstance(item, dict):
            cards.append(_story_card_from_payload(item))
    return cards


def _pizza_target_card() -> StoryCard:
    return _story_card_from_payload(
        {
            "id": "2055243452720586928",
            "account": "RenaissMyCM",
            "url": "https://x.com/RenaissMyCM/status/2055243452720586928",
            "title": "Renaiss Pizza Day is landing in Kuala Lumpur",
            "summary": "Renaiss Pizza Day lands in Kuala Lumpur on May 22, 6-10 PM GMT+8 at Pizza Mansion @ The Five.",
            "bullets": [
                "May 22, 6-10 PM GMT+8",
                "Pizza Mansion @ The Five, Kuala Lumpur",
                "Registration required",
            ],
            "published_at": "2026-05-15T00:00:00+00:00",
            "confidence": 0.82,
            "card_type": "event",
            "layout": "timeline",
            "tags": ["events"],
            "raw_text": (
                "Renaiss Pizza Day is landing in Kuala Lumpur. May 22, 6-10 PM GMT+8. "
                "Pizza Mansion @ The Five, Kuala Lumpur. Register here. "
                "Quoting @renaissxyz: Renaiss Pizza Day is landing in Kuala Lumpur."
            ),
            "provider": "r.jina.ai",
            "topic_labels": ["events", "community"],
        }
    )


def _card_for_window(**overrides: Any) -> StoryCard:
    base = {
        "id": "window-test",
        "account": "tester",
        "url": "https://example.com/window-test",
        "title": "Window test",
        "summary": "Window test",
        "bullets": [],
        "published_at": "2026-05-01T00:00:00+00:00",
        "confidence": 0.7,
        "card_type": "event",
        "layout": "brief",
        "tags": [],
        "raw_text": "Window test",
        "provider": "test",
    }
    base.update(overrides)
    return _story_card_from_payload(base)


def run_checks() -> dict[str, Any]:
    cards = _load_cards()
    public_cards = _public_cards(cards)
    official_pizza = next((c for c in public_cards if c.id == "2054911961507205452"), None)
    _assert(official_pizza is not None, "missing official Pizza Day canonical card 2054911961507205452")

    target = _pizza_target_card()
    winner, score, basis = _find_best_canonical_dedupe_match(target, [official_pizza])
    _assert(winner is not None, "Pizza Day target did not match any canonical card")
    _assert(winner.id == official_pizza.id, f"Pizza Day target matched wrong winner: {winner.id if winner else ''}")
    _assert(score >= 0.72, f"Pizza Day score too low: {score}")

    kept, queued, existing_embedding_stats = _queue_new_duplicates_against_existing(
        [target],
        [official_pizza],
        force_ids=set(),
        return_stats=True,
    )
    _assert(not kept, "Pizza Day target should not remain public after canonical dedupe")
    _assert(len(queued) == 1, "Pizza Day target should enter admin queue as dedupe evidence")
    queued_card = queued[0]
    _assert(queued_card.dedupe_winner_post_id == official_pizza.id, "queued Pizza target missing winner post id")
    _assert(bool(queued_card.dedupe_basis), "queued Pizza target missing dedupe basis")

    embedding_result: dict[str, Any] = {
        "checked": False,
        "dedupe_status": str(existing_embedding_stats.get("status") or ""),
    }
    embedding_api_key = resolve_openai_embedding_key()
    if embedding_api_key:
        model = knowledge_embedding_model()
        target_row = knowledge_row_for_card(target, embedding_model=model)
        official_row = knowledge_row_for_card(official_pizza, embedding_model=model)
        vectors_by_id, vector_stats = ensure_embeddings_for_rows(
            [target_row, official_row],
            api_key=embedding_api_key,
            model=model,
            timeout_seconds=80,
            batch_size=2,
        )
        target_vec = (vectors_by_id.get(target.id) or {}).get("vector")
        official_vec = (vectors_by_id.get(official_pizza.id) or {}).get("vector")
        _assert(isinstance(target_vec, list) and target_vec, "target embedding vector missing")
        _assert(isinstance(official_vec, list) and official_vec, "official embedding vector missing")
        embedding_similarity = embedding_cosine_similarity(target_vec, official_vec)
        _assert(embedding_similarity >= 0.65, f"embedding similarity too low: {embedding_similarity}")
        _assert(existing_embedding_stats.get("status") == "ready", "dedupe embedding stats should be ready when API key exists")
        _assert(
            any(str(part).startswith("embedding_similarity:") for part in queued_card.dedupe_basis),
            "queued Pizza target missing embedding similarity basis",
        )
        embedding_result = {
            "checked": True,
            "model": model,
            "similarity": round(float(embedding_similarity), 4),
            "dedupe_status": str(existing_embedding_stats.get("status") or ""),
            "dedupe_candidate_pairs": int(existing_embedding_stats.get("candidate_pair_count", 0) or 0),
            "cache_hit": int(vector_stats.get("cache_hit", 0) or 0),
            "cache_miss": int(vector_stats.get("cache_miss", 0) or 0),
        }

    event_card = _card_for_window(
        timeline_date="2026-05-22T00:00:00+00:00",
        timeline_end_date="2026-05-22T00:00:00+00:00",
    )
    before_window = memory_window_for_card(
        event_card,
        now=datetime(2026, 4, 21, tzinfo=timezone.utc),
        retention_days=30,
    )
    on_window = memory_window_for_card(
        event_card,
        now=datetime(2026, 4, 22, tzinfo=timezone.utc),
        retention_days=30,
    )
    after_window = memory_window_for_card(
        event_card,
        now=datetime(2026, 6, 22, tzinfo=timezone.utc),
        retention_days=30,
    )
    _assert(before_window["pre_window"] is True and before_window["expired"] is False, "event pre-window should not be expired")
    _assert(on_window["active"] is True, "event should be active at event_start - 30 days")
    _assert(after_window["expired"] is True, "event should expire after event_end + 30 days")

    no_date_card = _card_for_window(card_type="insight", timeline_date="", timeline_end_date="")
    no_date_active = memory_window_for_card(
        no_date_card,
        now=datetime(2026, 5, 30, tzinfo=timezone.utc),
        retention_days=30,
    )
    no_date_expired = memory_window_for_card(
        no_date_card,
        now=datetime(2026, 6, 1, tzinfo=timezone.utc),
        retention_days=30,
    )
    _assert(no_date_active["basis"] == "published_at" and no_date_active["expired"] is False, "undated item should use published_at")
    _assert(no_date_expired["expired"] is True, "undated item should expire after published_at + 30 days")

    batch_a = _story_card_from_payload(
        {
            "id": "batch-official",
            "account": "renaissxyz",
            "url": "https://x.com/renaissxyz/status/batch-official",
            "title": "Renaiss Pizza Day Kuala Lumpur",
            "summary": "Renaiss Pizza Day is landing in Kuala Lumpur on May 22 at Pizza Mansion.",
            "published_at": "2026-05-14T00:00:00+00:00",
            "card_type": "event",
            "layout": "brief",
            "tags": ["events"],
            "raw_text": "Renaiss Pizza Day is landing in Kuala Lumpur. May 22, Pizza Mansion @ The Five.",
            "provider": "r.jina.ai",
            "topic_labels": ["events", "official"],
        }
    )
    batch_b = _story_card_from_payload(
        {
            "id": "batch-community",
            "account": "RenaissMyCM",
            "url": "https://x.com/RenaissMyCM/status/batch-community",
            "title": "Renaiss Pizza Day in Kuala Lumpur",
            "summary": "Renaiss Pizza Day lands in Kuala Lumpur on May 22 at Pizza Mansion.",
            "published_at": "2026-05-15T00:00:00+00:00",
            "card_type": "event",
            "layout": "brief",
            "tags": ["events"],
            "raw_text": "Renaiss Pizza Day is landing in Kuala Lumpur. May 22, Pizza Mansion @ The Five.",
            "provider": "r.jina.ai",
            "topic_labels": ["events", "community"],
        }
    )
    batch_kept, batch_queued, batch_embedding_stats = dedupe_new_cards_against_batch_canonical(
        [batch_b, batch_a],
        force_ids=set(),
        return_stats=True,
    )
    _assert(len(batch_kept) == 1 and batch_kept[0].id == batch_a.id, "batch dedupe should keep protected official candidate")
    _assert(len(batch_queued) == 1 and batch_queued[0].dedupe_winner_post_id == batch_a.id, "batch dedupe loser missing official winner")

    return {
        "ok": True,
        "public_cards": len(public_cards),
        "pizza_winner": winner.id,
        "pizza_similarity": round(score, 4),
        "pizza_basis": basis,
        "embedding": embedding_result,
        "event_window": {
            "before": before_window,
            "on": on_window,
            "after": after_window,
        },
        "undated_window": {
            "active": no_date_active,
            "expired": no_date_expired,
        },
        "batch": {
            "kept": [card.id for card in batch_kept],
            "embedding_status": str(batch_embedding_stats.get("status") or ""),
            "embedding_candidate_pairs": int(batch_embedding_stats.get("candidate_pair_count", 0) or 0),
            "queued": [
                {
                    "id": card.id,
                    "winner": card.dedupe_winner_post_id,
                    "similarity": card.dedupe_similarity,
                    "basis": card.dedupe_basis,
                }
                for card in batch_queued
            ],
        },
    }


def main() -> int:
    result = run_checks()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
