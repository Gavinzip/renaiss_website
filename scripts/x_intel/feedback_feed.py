from __future__ import annotations

from . import bootstrap as _bootstrap
from . import editorial as _editorial
from . import sources as _sources

globals().update(vars(_bootstrap))
globals().update(vars(_editorial))
globals().update(vars(_sources))

# Domain: feedback memory, manual picks, curation, feed payload, sync entrypoints

def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def manual_picks_path() -> Path:
    return data_dir() / "x_intel_manual_picks.json"


def feedback_path() -> Path:
    return data_dir() / "x_intel_feedback.json"


DEFAULT_MEMORY_RULES = [
    "只有明確有參與行為、時間、地點、直播、報名或 join/register 等訊號，才把 card_type 判成 event。",
    "只提到 SBT 門檻、快照、積分線、claim 條件時，不要只因為有日期就判成活動；這類內容通常應放入 sbt 與 alpha/topic label。",
    "同一篇內容可以同時有多個 topic_labels；例如活動獎勵包含 SBT 時，要同時標 events 與 sbt，但不同區塊摘要重點不同。",
    "官方來源與社群轉述重複時，優先保留官方來源；社群版本只在提供額外攻略或經驗時保留。",
    "寶可夢相關分區只收明確寶可夢/Pokemon/PoGo/PTCG 或寶可夢角色、寶可夢卡牌市場；純 Renaiss 卡包、One Piece、泛 TCG、PSA 或抽卡不要只靠關鍵字放入 pokemon。",
    "攻略分區使用 guides；只收教學、操作步驟、參與流程、工具用法、集運/查價/套利等可照做資訊。一般心得、市場觀點、公告、活動不放 guides。",
    "社群精選分區使用 community；只能收 X/Twitter 原始內容含 #renaiss 或 @renaissxyz 的非官方社群貼文。Discord 與官方帳號不放 community。",
    "other 代表無/待人工分類，不是社群精選，也不是 5。",
]


FORCED_COLLECTIBLES_CHANNEL_ID = "1480867987270402149"
FORCED_DISCORD_CARD_ID_RE = re.compile(r"^discord-(\d+)-\d+$", re.I)
FORCED_DISCORD_URL_RE = re.compile(r"discord\.com/channels/[^/]+/(\d+)/\d+", re.I)


def _extract_discord_channel_id_from_card(card: StoryCard) -> str:
    sid = str(card.id or "").strip()
    if sid:
        m = FORCED_DISCORD_CARD_ID_RE.match(sid)
        if m:
            return str(m.group(1) or "").strip()
    surl = str(card.url or "").strip()
    if surl:
        m2 = FORCED_DISCORD_URL_RE.search(surl)
        if m2:
            return str(m2.group(1) or "").strip()
    return ""


def _is_forced_collectibles_channel_card(card: StoryCard) -> bool:
    return _extract_discord_channel_id_from_card(card) == FORCED_COLLECTIBLES_CHANNEL_ID


def _forced_pokemon_account_handles() -> set[str]:
    return {
        normalize_account_handle(account)
        for account in resolve_pokemon_x_accounts()
        if normalize_account_handle(account)
    }


def _enforce_fixed_channel_topic_labels(cards: list[StoryCard]) -> None:
    forced_pokemon_accounts = _forced_pokemon_account_handles()
    for card in cards:
        labels = normalize_topic_labels(card.topic_labels)
        if _is_forced_collectibles_channel_card(card):
            labels = normalize_topic_labels([*labels, "collectibles"])
        else:
            labels = [label for label in labels if label != "collectibles"]
        if normalize_account_handle(card.account) in forced_pokemon_accounts:
            labels = [label for label in labels if label != "other"]
            labels = normalize_topic_labels([*labels, "pokemon"])
        card.topic_labels = labels if labels else ["other"]


def _ensure_forced_collectibles_cards_in_curated(
    source_cards: list[StoryCard],
    curated_cards: list[StoryCard],
) -> list[StoryCard]:
    if not source_cards:
        return curated_cards
    existing_ids = {str(c.id or "").strip() for c in curated_cards}
    out = list(curated_cards)
    for card in source_cards:
        if not _is_forced_collectibles_channel_card(card):
            continue
        card_id = str(card.id or "").strip()
        if not card_id or card_id in existing_ids:
            continue
        labels = normalize_topic_labels([*(card.topic_labels or []), "collectibles"])
        card.topic_labels = labels if labels else ["collectibles"]
        out.append(card)
        existing_ids.add(card_id)
    return out


def read_feedback_state() -> dict[str, Any]:
    raw = read_json(feedback_path(), {})
    if not isinstance(raw, dict):
        return {"items": {}, "rules": {}, "source_profiles": {}, "card_field_overrides": {}}
    items = raw.get("items")
    if not isinstance(items, dict):
        items = {}
    rules = raw.get("rules")
    if not isinstance(rules, dict):
        rules = {}
    source_profiles = raw.get("source_profiles")
    if not isinstance(source_profiles, dict):
        source_profiles = {}
    card_field_overrides = raw.get("card_field_overrides")
    if not isinstance(card_field_overrides, dict):
        card_field_overrides = {}
    return {
        "items": items,
        "rules": rules,
        "source_profiles": source_profiles,
        "card_field_overrides": card_field_overrides,
        "updated_at": raw.get("updated_at"),
    }


def write_feedback_state(state: dict[str, Any]) -> None:
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": state.get("items", {}),
        "rules": state.get("rules", {}),
        "source_profiles": state.get("source_profiles", {}),
        "card_field_overrides": state.get("card_field_overrides", {}),
    }
    write_json(feedback_path(), payload)


def _feedback_label_kind(label: str) -> str:
    row = str(label or "").strip().lower()
    if row == "exclude":
        return "exclude"
    if row in ALLOWED_CARD_TYPES:
        return "card_type"
    if row in ALLOWED_TOPIC_LABELS:
        return "topic_label"
    return ""


def _read_current_feed_card(tweet_id: str) -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    if not tid:
        return {}
    payload = read_json(data_dir() / "x_intel_feed.json", {})
    cards = payload.get("cards") if isinstance(payload, dict) else []
    if not isinstance(cards, list):
        return {}
    for item in cards:
        if not isinstance(item, dict):
            continue
        if str(item.get("id") or "").strip() == tid:
            return dict(item)
    return {}


def _story_card_from_payload(item: dict[str, Any], *, default_account: str = "", default_provider: str = "cache") -> StoryCard:
    published = str(item.get("published_at") or "")
    try:
        published_dt = datetime.fromisoformat(published) if published else datetime.now(timezone.utc)
        if published_dt.tzinfo is None:
            published_dt = published_dt.replace(tzinfo=timezone.utc)
        published = published_dt.isoformat()
    except Exception:
        published = datetime.now(timezone.utc).isoformat()
    return StoryCard(
        id=str(item.get("id") or ""),
        account=str(item.get("account") or default_account),
        url=str(item.get("url") or ""),
        title=str(item.get("title") or ""),
        summary=str(item.get("summary") or ""),
        bullets=[str(x) for x in item.get("bullets", []) if str(x).strip()][:3],
        published_at=published,
        confidence=float(item.get("confidence") or 0.55),
        card_type=str(item.get("card_type") or "insight"),
        layout=str(item.get("layout") or "brief"),
        tags=[str(x) for x in item.get("tags", []) if str(x).strip()][:3],
        raw_text=str(item.get("raw_text") or ""),
        provider=str(item.get("provider") or default_provider),
        cover_image=str(item.get("cover_image") or ""),
        metrics=item.get("metrics") if isinstance(item.get("metrics"), dict) else {},
        importance=float(item.get("importance") or 0.0),
        template_id=str(item.get("template_id") or "community_brief"),
        glance=str(item.get("glance") or ""),
        timeline_date=str(item.get("timeline_date") or ""),
        timeline_end_date=str(item.get("timeline_end_date") or ""),
        event_wall=bool(item.get("event_wall") is True),
        urgency=str(item.get("urgency") or "normal"),
        manual_pick=bool(item.get("manual_pick") or False),
        manual_pin=bool(item.get("manual_pin") or False),
        manual_bottom=bool(item.get("manual_bottom") or False),
        event_facts=normalize_event_facts(item.get("event_facts")),
        topic_labels=normalize_topic_labels(item.get("topic_labels")),
        detail_summary=str(item.get("detail_summary") or ""),
        detail_lines=normalize_detail_lines(item.get("detail_lines"), limit=6),
        sbt_name=str(item.get("sbt_name") or ""),
        sbt_names=[str(x) for x in item.get("sbt_names", []) if str(x).strip()][:8] if isinstance(item.get("sbt_names"), list) else [],
        sbt_acquisition=str(item.get("sbt_acquisition") or ""),
        reply_to_id=str(item.get("reply_to_id") or ""),
        dedupe_status=str(item.get("dedupe_status") or ""),
        dedupe_checked=bool(item.get("dedupe_checked") is True),
        dedupe_checked_at=str(item.get("dedupe_checked_at") or ""),
        dedupe_version=str(item.get("dedupe_version") or ""),
        dedupe_reason_code=str(item.get("dedupe_reason_code") or ""),
        dedupe_reason=str(item.get("dedupe_reason") or ""),
        dedupe_winner_post_id=str(item.get("dedupe_winner_post_id") or ""),
        dedupe_winner_url=str(item.get("dedupe_winner_url") or ""),
        dedupe_winner_title=str(item.get("dedupe_winner_title") or ""),
    )


def _read_existing_feed_cards() -> list[StoryCard]:
    payload = read_json(data_dir() / "x_intel_feed.json", {})
    rows = payload.get("cards") if isinstance(payload, dict) else []
    cards: list[StoryCard] = []
    if not isinstance(rows, list):
        return cards
    for item in rows:
        if not isinstance(item, dict):
            continue
        try:
            card = _story_card_from_payload(item)
        except Exception:
            continue
        if card.id:
            cards.append(card)
    return cards


def _read_existing_feed_card_payloads() -> dict[str, dict[str, Any]]:
    payload = read_json(data_dir() / "x_intel_feed.json", {})
    rows = payload.get("cards") if isinstance(payload, dict) else []
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(rows, list):
        return out
    for item in rows:
        if not isinstance(item, dict):
            continue
        card_id = str(item.get("id") or "").strip()
        if card_id:
            out[card_id] = dict(item)
    return out


def _feedback_rule_key(label: str, reason: str, account: str = "") -> str:
    body = clean_text(reason or "")
    body = re.sub(r"\s+", " ", body).strip().lower()[:120]
    acc = str(account or "").strip().lower()
    return re.sub(r"[^a-z0-9_\u4e00-\u9fff-]+", "_", f"{label}_{acc}_{body}")[:180] or str(label)


def _distill_feedback_rule(
    *,
    tweet_id: str,
    label: str,
    reason: str,
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    """Turn one raw admin correction into a reusable memory rule.

    The raw reason is kept for audit, but future classification should receive
    only this distilled rule so the model learns the concept, not the wording.
    """

    api_key = resolve_minimax_key()
    if not api_key:
        return {"status": "pending", "error": "missing minimax key"}

    kind = _feedback_label_kind(label)
    source_payload = {
        "id": tweet_id,
        "account": str(snapshot.get("account") or ""),
        "title": clean_text(str(snapshot.get("title") or ""))[:220],
        "summary": clean_text(str(snapshot.get("summary") or snapshot.get("glance") or ""))[:420],
        "card_type_before": str(snapshot.get("card_type") or ""),
        "topic_labels_before": normalize_topic_labels(snapshot.get("topic_labels")),
        "event_facts": snapshot.get("event_facts") if isinstance(snapshot.get("event_facts"), dict) else {},
        "raw_text": clean_text(str(snapshot.get("raw_text") or ""))[:1200],
    }
    prompt = (
        "你是 Renaiss 情報站的分類記憶整理器。你的任務不是照抄管理員原因，"
        "而是理解這次修正背後的可重用分類規則。\n\n"
        "請根據「原始貼文內容、原本分類、管理員修正原因」萃取一條短規則，"
        "讓下次遇到類似貼文時可以自動判斷。\n"
        "要求：\n"
        "1. 不要逐字照抄管理員原因。\n"
        "2. 規則要可泛化，描述什麼類型內容應該或不應該放到哪個分類。\n"
        "3. 如果是 exclude，請寫清楚未來應避開哪一類誤判。\n"
        "4. 如果資訊不足，status 回 pending，不要硬編規則。\n"
        "5. 只輸出 JSON，不要 markdown。\n\n"
        f"目標修正：label={label}, label_kind={kind}\n"
        f"管理員原因：{clean_text(reason)[:600]}\n"
        f"貼文資料 JSON：{json.dumps(source_payload, ensure_ascii=False)}\n\n"
        "輸出格式：\n"
        "{\n"
        "  \"status\": \"ready\" 或 \"pending\",\n"
        "  \"rule\": \"一條繁中規則，60 字以內\",\n"
        "  \"scope\": \"適用範圍，30 字以內\",\n"
        "  \"rationale\": \"你如何理解這次修正，80 字以內\",\n"
        "  \"target_label\": \"event/feature/announcement/market/report/insight/events/official/sbt/pokemon/collectibles/alpha/guides/community/other/exclude\",\n"
        "  \"label_kind\": \"card_type/topic_label/exclude\"\n"
        "}"
    )
    try:
        raw = minimax_chat(prompt, api_key)
        parsed = parse_json_block(raw) or {}
    except Exception as error:
        return {"status": "pending", "error": str(error)[:220]}

    status = str(parsed.get("status") or "").strip().lower()
    rule = clean_text(str(parsed.get("rule") or ""))
    target_label = str(parsed.get("target_label") or label).strip().lower()
    label_kind = str(parsed.get("label_kind") or kind).strip().lower()
    if status != "ready" or not rule or target_label not in ALLOWED_FEEDBACK_LABELS:
        return {
            "status": "pending",
            "error": clean_text(str(parsed.get("rationale") or "AI did not produce a usable rule"))[:220],
        }
    if label_kind not in {"card_type", "topic_label", "exclude"}:
        label_kind = _feedback_label_kind(target_label)
    return {
        "status": "ready",
        "rule": rule[:180],
        "scope": clean_text(str(parsed.get("scope") or ""))[:120],
        "rationale": clean_text(str(parsed.get("rationale") or ""))[:220],
        "label": target_label,
        "label_kind": label_kind,
    }


def _update_feedback_memory(
    state: dict[str, Any],
    *,
    tweet_id: str,
    label: str,
    reason: str,
    snapshot: dict[str, Any],
) -> None:
    rules = state.get("rules")
    if not isinstance(rules, dict):
        rules = {}
        state["rules"] = rules
    profiles = state.get("source_profiles")
    if not isinstance(profiles, dict):
        profiles = {}
        state["source_profiles"] = profiles

    account = str(snapshot.get("account") or "").strip()
    kind = _feedback_label_kind(label)
    reason_text = clean_text(reason or "")
    title = clean_text(str(snapshot.get("title") or snapshot.get("glance") or ""))[:120]
    distilled = _distill_feedback_rule(tweet_id=tweet_id, label=label, reason=reason_text, snapshot=snapshot) if reason_text else {"status": "pending"}

    if distilled.get("status") == "ready":
        rule_label = str(distilled.get("label") or label).strip().lower()
        rule_kind = str(distilled.get("label_kind") or kind).strip().lower()
        rule_text = clean_text(str(distilled.get("rule") or ""))
        key = _feedback_rule_key(rule_label, rule_text, account)
        prev = rules.get(key, {}) if isinstance(rules.get(key), dict) else {}
        examples = [str(x) for x in (prev.get("examples") or []) if str(x).strip()]
        if tweet_id and tweet_id not in examples:
            examples = [tweet_id, *examples][:8]
        rules[key] = {
            "label": rule_label,
            "label_kind": rule_kind,
            "rule": rule_text[:360],
            "scope": clean_text(str(distilled.get("scope") or ""))[:140],
            "rationale": clean_text(str(distilled.get("rationale") or ""))[:240],
            "account": account,
            "examples": examples,
            "count": int(prev.get("count", 0) or 0) + 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    if account:
        profile = profiles.get(account, {}) if isinstance(profiles.get(account), dict) else {}
        label_counts = profile.get("label_counts") if isinstance(profile.get("label_counts"), dict) else {}
        label_counts[label] = int(label_counts.get(label, 0) or 0) + 1
        examples = profile.get("examples") if isinstance(profile.get("examples"), list) else []
        entry = {
            "id": tweet_id,
            "label": label,
            "label_kind": kind,
            "memory_status": str(distilled.get("status") or "pending"),
            "memory_rule": clean_text(str(distilled.get("rule") or ""))[:140],
            "title": title,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        examples = [entry, *[x for x in examples if isinstance(x, dict) and str(x.get("id") or "") != tweet_id]][:10]
        profiles[account] = {
            "account": account,
            "label_counts": label_counts,
            "examples": examples,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    return distilled


def add_classification_feedback(tweet_id: str, label: str, reason: str = "") -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    fb_label = str(label or "").strip().lower()
    fb_reason = clean_text(reason or "")
    if not tid:
        raise ValueError("tweet id is required")
    if fb_label not in ALLOWED_FEEDBACK_LABELS:
        raise ValueError("invalid label")

    state = read_feedback_state()
    items = state.get("items", {})
    prev = items.get(tid, {}) if isinstance(items.get(tid), dict) else {}
    count = int(prev.get("count", 0) or 0) + 1
    snapshot = _read_current_feed_card(tid)
    label_kind = _feedback_label_kind(fb_label)
    items[tid] = {
        "label": fb_label,
        "label_kind": label_kind,
        "raw_reason": fb_reason[:420],
        "count": count,
        "source_account": str(snapshot.get("account") or ""),
        "source_title": clean_text(str(snapshot.get("title") or snapshot.get("glance") or ""))[:180],
        "source_card_type": str(snapshot.get("card_type") or ""),
        "source_topic_labels": normalize_topic_labels(snapshot.get("topic_labels")),
        "source_url": str(snapshot.get("url") or ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    state["items"] = items
    distilled = _update_feedback_memory(state, tweet_id=tid, label=fb_label, reason=fb_reason, snapshot=snapshot)
    items[tid]["memory_status"] = str(distilled.get("status") or "pending")
    if distilled.get("status") == "ready":
        items[tid]["memory_rule"] = clean_text(str(distilled.get("rule") or ""))[:220]
        items[tid]["memory_scope"] = clean_text(str(distilled.get("scope") or ""))[:160]
        items[tid]["memory_rationale"] = clean_text(str(distilled.get("rationale") or ""))[:260]
    else:
        items[tid]["memory_error"] = clean_text(str(distilled.get("error") or ""))[:220]
    write_feedback_state(state)
    return {
        "id": tid,
        "label": fb_label,
        "label_kind": label_kind,
        "memory_status": items[tid].get("memory_status"),
        "memory_rule": items[tid].get("memory_rule", ""),
        "count": count,
    }


def add_classification_feedback_fields(
    tweet_id: str,
    *,
    card_type: str = "",
    topic_label: str = "",
    topic_labels: list[str] | None = None,
    reason: str = "",
) -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    next_card_type = str(card_type or "").strip().lower()
    has_topic_labels_payload = isinstance(topic_labels, list)
    raw_topic_labels = topic_labels if has_topic_labels_payload else []
    if not raw_topic_labels and str(topic_label or "").strip():
        raw_topic_labels = [topic_label]
    next_topic_labels = normalize_topic_labels(raw_topic_labels)
    if "other" in next_topic_labels:
        next_topic_labels = ["other"]
    fb_reason = clean_text(reason or "")
    if not tid:
        raise ValueError("tweet id is required")
    if next_card_type and next_card_type not in ALLOWED_CARD_TYPES:
        raise ValueError("invalid card_type")
    if (has_topic_labels_payload or str(topic_label or "").strip()) and not next_topic_labels:
        raise ValueError("invalid topic_label")
    if not next_card_type and not next_topic_labels:
        raise ValueError("card_type or topic_label is required")

    state = read_feedback_state()
    overrides = state.get("card_field_overrides")
    if not isinstance(overrides, dict):
        overrides = {}
        state["card_field_overrides"] = overrides
    prev = overrides.get(tid, {}) if isinstance(overrides.get(tid), dict) else {}
    snapshot = _read_current_feed_card(tid)

    next_override = dict(prev)
    if next_card_type:
        next_override["card_type"] = next_card_type
    if next_topic_labels:
        # A section correction stores the final section state, including multi-section cards.
        next_override["topic_labels"] = next_topic_labels
    next_override["reason"] = fb_reason[:420]
    next_override["source_account"] = str(snapshot.get("account") or "")
    next_override["source_title"] = clean_text(str(snapshot.get("title") or snapshot.get("glance") or ""))[:180]
    next_override["source_card_type"] = str(snapshot.get("card_type") or "")
    next_override["source_topic_labels"] = normalize_topic_labels(snapshot.get("topic_labels"))
    next_override["source_url"] = str(snapshot.get("url") or "")
    next_override["updated_at"] = datetime.now(timezone.utc).isoformat()
    overrides[tid] = next_override

    memory_results: list[dict[str, Any]] = []
    if fb_reason:
        if next_card_type:
            memory_results.append(add_classification_feedback(tid, next_card_type, reason=fb_reason))
            state = read_feedback_state()
            overrides = state.get("card_field_overrides") if isinstance(state.get("card_field_overrides"), dict) else {}
            current = overrides.get(tid, {}) if isinstance(overrides.get(tid), dict) else {}
            current.update(next_override)
            overrides[tid] = current
            state["card_field_overrides"] = overrides
        for topic in next_topic_labels:
            memory_results.append(add_classification_feedback(tid, topic, reason=fb_reason))
            state = read_feedback_state()
            overrides = state.get("card_field_overrides") if isinstance(state.get("card_field_overrides"), dict) else {}
            current = overrides.get(tid, {}) if isinstance(overrides.get(tid), dict) else {}
            current.update(next_override)
            overrides[tid] = current
            state["card_field_overrides"] = overrides

    write_feedback_state(state)
    return {
        "id": tid,
        "card_type": next_card_type,
        "topic_labels": next_topic_labels,
        "memory_results": memory_results,
    }


def _read_feed_payload() -> dict[str, Any]:
    payload = read_json(data_dir() / "x_intel_feed.json", {})
    return payload if isinstance(payload, dict) else {}


def _update_feed_card_fields(tweet_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    if not tid:
        raise ValueError("tweet id is required")
    payload = _read_feed_payload()
    cards = payload.get("cards")
    if not isinstance(cards, list):
        raise ValueError("feed cards are not ready")
    updated_card: dict[str, Any] | None = None
    for item in cards:
        if not isinstance(item, dict):
            continue
        if str(item.get("id") or "").strip() != tid:
            continue
        item.update(patch)
        updated_card = item
        break
    if updated_card is None:
        raise ValueError("card not found")
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(data_dir() / "x_intel_feed.json", payload)
    return {"id": tid, "patch": patch, "card": updated_card}


def update_card_timeline_fields(tweet_id: str, timeline_date: str = "", timeline_end_date: str = "") -> dict[str, Any]:
    start = str(timeline_date or "").strip()
    end = str(timeline_end_date or "").strip()
    if start and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start):
        raise ValueError("timeline_date must be YYYY-MM-DD")
    if end and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end):
        raise ValueError("timeline_end_date must be YYYY-MM-DD")
    if start and end and end < start:
        raise ValueError("timeline_end_date cannot be earlier than timeline_date")
    return _update_feed_card_fields(
        tweet_id,
        {
            "timeline_date": start,
            "timeline_end_date": end,
        },
    )


def update_card_event_wall_field(tweet_id: str, event_wall: bool) -> dict[str, Any]:
    return _update_feed_card_fields(
        tweet_id,
        {
            "event_wall": bool(event_wall),
        },
    )


def update_card_sbt_fields(tweet_id: str, sbt_names: Any = "", sbt_acquisition: str = "") -> dict[str, Any]:
    if isinstance(sbt_names, list):
        names = [clean_text(str(x)) for x in sbt_names if clean_text(str(x))]
    else:
        raw = str(sbt_names or "")
        names = [clean_text(x) for x in re.split(r"[,，、/|\\n]+", raw) if clean_text(x)]
    names = names[:8]
    acquisition = clean_text(str(sbt_acquisition or ""))[:320]
    return _update_feed_card_fields(
        tweet_id,
        {
            "sbt_name": names[0] if names else "",
            "sbt_names": names,
            "sbt_acquisition": acquisition,
        },
    )


def update_card_classification_fields(
    tweet_id: str,
    *,
    card_type: str = "",
    topic_label: str = "",
    topic_labels: list[str] | None = None,
) -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    next_card_type = str(card_type or "").strip().lower()
    has_topic_labels_payload = isinstance(topic_labels, list)
    raw_topic_labels = topic_labels if has_topic_labels_payload else []
    if not raw_topic_labels and str(topic_label or "").strip():
        raw_topic_labels = [topic_label]
    next_topic_labels = normalize_topic_labels(raw_topic_labels)
    if "other" in next_topic_labels:
        next_topic_labels = ["other"]
    if not tid:
        raise ValueError("tweet id is required")
    if next_card_type and next_card_type not in ALLOWED_CARD_TYPES:
        raise ValueError("invalid card_type")
    if (has_topic_labels_payload or str(topic_label or "").strip()) and not next_topic_labels:
        raise ValueError("invalid topic_label")
    if not next_card_type and not next_topic_labels:
        raise ValueError("card_type or topic_label is required")

    payload = _read_feed_payload()
    cards = payload.get("cards")
    if not isinstance(cards, list):
        raise ValueError("feed cards are not ready")

    updated_card: dict[str, Any] | None = None
    for item in cards:
        if not isinstance(item, dict):
            continue
        if str(item.get("id") or "").strip() != tid:
            continue
        card = _story_card_from_payload(item)
        if next_card_type:
            _apply_card_type_override(card, next_card_type)
        if next_topic_labels:
            _apply_topic_label_override(card, next_topic_labels, exact=True)
        item.update(
            {
                "card_type": card.card_type,
                "layout": card.layout,
                "tags": card.tags,
                "confidence": card.confidence,
                "template_id": card.template_id,
                "event_facts": card.event_facts or {},
                "urgency": card.urgency,
                "topic_labels": normalize_topic_labels(card.topic_labels),
            }
        )
        updated_card = item
        break

    if updated_card is None:
        raise ValueError("card not found")
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(data_dir() / "x_intel_feed.json", payload)
    return {
        "id": tid,
        "card_type": str(updated_card.get("card_type") or ""),
        "topic_labels": normalize_topic_labels(updated_card.get("topic_labels")),
        "card": updated_card,
    }


def feedback_training_text(max_items: int = 8, max_rules: int = 10, max_profiles: int = 5) -> str:
    state = read_feedback_state()
    items = state.get("items", {})
    rules = state.get("rules", {})
    profiles = state.get("source_profiles", {})

    sections: list[str] = []
    sections.append("[固定分類記憶]")
    for rule in DEFAULT_MEMORY_RULES:
        sections.append(f"- {rule}")

    if isinstance(rules, dict) and rules:
        ranked_rules = [x for x in rules.values() if isinstance(x, dict)]
        ranked_rules.sort(key=lambda row: (int(row.get("count", 0) or 0), str(row.get("updated_at") or "")), reverse=True)
        sections.append("[人工回饋歸納規則]")
        for row in ranked_rules[:max_rules]:
            rule = clean_text(str(row.get("rule") or ""))[:180]
            label = str(row.get("label") or "").strip()
            kind = str(row.get("label_kind") or "").strip()
            count = int(row.get("count", 0) or 0)
            examples = ",".join([str(x) for x in (row.get("examples") or [])[:3] if str(x).strip()])
            if rule:
                sections.append(f"- {rule} target={kind}:{label}; seen={count}; examples={examples}")

    if isinstance(profiles, dict) and profiles:
        ranked_profiles = [x for x in profiles.values() if isinstance(x, dict)]
        ranked_profiles.sort(key=lambda row: str(row.get("updated_at") or ""), reverse=True)
        sections.append("[來源輪廓記憶]")
        for profile in ranked_profiles[:max_profiles]:
            account = str(profile.get("account") or "").strip()
            counts = profile.get("label_counts") if isinstance(profile.get("label_counts"), dict) else {}
            count_text = ", ".join([f"{k}:{v}" for k, v in sorted(counts.items(), key=lambda kv: int(kv[1] or 0), reverse=True)[:4]])
            if account and count_text:
                sections.append(f"- @{account}: user_feedback_labels={count_text}")

    if isinstance(items, dict) and items:
        ranked: list[tuple[str, dict[str, Any]]] = []
        for tid, info in items.items():
            if not isinstance(info, dict):
                continue
            label = str(info.get("label") or "").strip().lower()
            if label not in ALLOWED_FEEDBACK_LABELS:
                continue
            ranked.append((tid, info))
        ranked.sort(key=lambda kv: str(kv[1].get("updated_at") or ""), reverse=True)

        sections.append("[近期人工修正樣本]")
        for tid, info in ranked[:max_items]:
            memory_rule = clean_text(str(info.get("memory_rule") or ""))[:120]
            memory_status = str(info.get("memory_status") or "pending").strip()
            label = str(info.get("label") or "")
            kind = str(info.get("label_kind") or _feedback_label_kind(label))
            source_type = str(info.get("source_card_type") or "")
            source_title = clean_text(str(info.get("source_title") or ""))[:80]
            if memory_rule:
                sections.append(f"- id={tid}: target={kind}:{label}; from={source_type}; title={source_title}; learned={memory_rule}")
            else:
                sections.append(f"- id={tid}: target={kind}:{label}; from={source_type}; title={source_title}; memory_status={memory_status}")
    return "\n".join([x for x in sections if str(x).strip()])


def feedback_memory_stats() -> dict[str, Any]:
    state = read_feedback_state()
    items = state.get("items") if isinstance(state.get("items"), dict) else {}
    rules = state.get("rules") if isinstance(state.get("rules"), dict) else {}
    profiles = state.get("source_profiles") if isinstance(state.get("source_profiles"), dict) else {}
    field_overrides = state.get("card_field_overrides") if isinstance(state.get("card_field_overrides"), dict) else {}
    return {
        "feedback_items": len(items),
        "field_overrides": len(field_overrides),
        "rules": len(rules),
        "source_profiles": len(profiles),
        "default_rules": len(DEFAULT_MEMORY_RULES),
        "updated_at": str(state.get("updated_at") or ""),
    }


def _mark_feedback_tag(card: StoryCard) -> None:
    if "回饋" not in card.tags:
        card.tags = (card.tags[:2] + ["回饋"])[:3]
    card.confidence = max(0.82, float(card.confidence or 0.0))


def _apply_card_type_override(card: StoryCard, card_type: str) -> bool:
    label = str(card_type or "").strip().lower()
    if label not in ALLOWED_CARD_TYPES:
        return False
    changed = card.card_type != label
    card.card_type = label
    card.layout, default_tags = default_style_for_type(label)
    if not card.tags:
        card.tags = default_tags[:]
    card.template_id = choose_template_id(label)
    if label == "event":
        card.event_facts = normalize_event_facts(card.event_facts) or build_event_facts(card.raw_text or card.title)
    else:
        card.event_facts = {}
    card.urgency = compute_urgency(card.card_type, card.importance, card.timeline_date)
    _mark_feedback_tag(card)
    return changed


def _apply_topic_label_override(card: StoryCard, labels: list[str], *, exact: bool) -> None:
    normalized = normalize_topic_labels(labels)
    if not normalized:
        return
    card.topic_labels = normalized if exact else normalize_topic_labels([*(card.topic_labels or []), *normalized])
    _mark_feedback_tag(card)


def apply_feedback_overrides(cards: list[StoryCard]) -> dict[str, Any]:
    state = read_feedback_state()
    items = state.get("items", {})
    field_overrides = state.get("card_field_overrides", {})
    excluded_ids: set[str] = set()
    override_count = 0
    if not isinstance(items, dict):
        items = {}
    if not isinstance(field_overrides, dict):
        field_overrides = {}
    if not items and not field_overrides:
        return {"override_count": 0, "excluded_ids": excluded_ids}

    for card in cards:
        info = items.get(card.id)
        if isinstance(info, dict):
            label = str(info.get("label") or "").strip().lower()
            if label == "exclude":
                excluded_ids.add(card.id)
                override_count += 1
                continue
            if label in ALLOWED_CARD_TYPES:
                if _apply_card_type_override(card, label):
                    override_count += 1
                continue
            if label in ALLOWED_TOPIC_LABELS:
                labels = normalize_topic_labels([*(card.topic_labels or []), label])
                if labels != normalize_topic_labels(card.topic_labels):
                    override_count += 1
                _apply_topic_label_override(card, labels, exact=False)

        field_info = field_overrides.get(card.id)
        if isinstance(field_info, dict):
            card_type = str(field_info.get("card_type") or "").strip().lower()
            if card_type in ALLOWED_CARD_TYPES and _apply_card_type_override(card, card_type):
                override_count += 1
            labels = normalize_topic_labels(field_info.get("topic_labels"))
            if labels:
                if labels != normalize_topic_labels(card.topic_labels):
                    override_count += 1
                _apply_topic_label_override(card, labels, exact=True)
    return {"override_count": override_count, "excluded_ids": excluded_ids}


def read_manual_picks() -> dict[str, set[str]]:
    raw = read_json(manual_picks_path(), {})
    include_ids = set()
    exclude_ids = set()
    pin_ids = set()
    bottom_ids = set()
    if isinstance(raw, dict):
        include_ids = {str(x).strip() for x in raw.get("include_ids", []) if str(x).strip()}
        exclude_ids = {str(x).strip() for x in raw.get("exclude_ids", []) if str(x).strip()}
        pin_ids = {str(x).strip() for x in raw.get("pin_ids", []) if str(x).strip()}
        bottom_ids = {str(x).strip() for x in raw.get("bottom_ids", []) if str(x).strip()}
    return {
        "include_ids": include_ids,
        "exclude_ids": exclude_ids,
        "pin_ids": pin_ids,
        "bottom_ids": bottom_ids,
    }


def write_manual_picks(
    include_ids: set[str],
    exclude_ids: set[str],
    pin_ids: set[str],
    bottom_ids: set[str],
) -> None:
    payload = {
        "include_ids": sorted(include_ids),
        "exclude_ids": sorted(exclude_ids),
        "pin_ids": sorted(pin_ids),
        "bottom_ids": sorted(bottom_ids),
    }
    write_json(manual_picks_path(), payload)


def set_manual_selection(tweet_id: str, action: str) -> dict[str, Any]:
    tid = str(tweet_id or "").strip()
    if not tid:
        raise ValueError("tweet id is required")
    if action not in {"include", "exclude", "clear", "pin", "unpin", "bottom", "unbottom"}:
        raise ValueError("invalid action")

    state = read_manual_picks()
    include_ids = state["include_ids"]
    exclude_ids = state["exclude_ids"]
    pin_ids = state["pin_ids"]
    bottom_ids = state["bottom_ids"]

    if action == "include":
        exclude_ids.discard(tid)
        include_ids.add(tid)
    elif action == "exclude":
        include_ids.discard(tid)
        pin_ids.discard(tid)
        bottom_ids.discard(tid)
        exclude_ids.add(tid)
    elif action == "clear":
        include_ids.discard(tid)
        exclude_ids.discard(tid)
        pin_ids.discard(tid)
        bottom_ids.discard(tid)
    elif action == "pin":
        include_ids.add(tid)
        exclude_ids.discard(tid)
        bottom_ids.discard(tid)
        pin_ids.add(tid)
    elif action == "unpin":
        pin_ids.discard(tid)
    elif action == "bottom":
        include_ids.add(tid)
        exclude_ids.discard(tid)
        pin_ids.discard(tid)
        bottom_ids.add(tid)
    elif action == "unbottom":
        bottom_ids.discard(tid)
    write_manual_picks(include_ids, exclude_ids, pin_ids, bottom_ids)
    return {
        "id": tid,
        "action": action,
        "include_count": len(include_ids),
        "exclude_count": len(exclude_ids),
        "pin_count": len(pin_ids),
        "bottom_count": len(bottom_ids),
    }


def merge_cards(*groups: list[StoryCard]) -> list[StoryCard]:
    merged: dict[str, StoryCard] = {}
    for group in groups:
        for card in group:
            merged[card.id] = card
    return sorted(merged.values(), key=lambda c: c.published_at, reverse=True)


def _apply_manual_flags_to_card(card: StoryCard, *, include_ids: set[str], pin_ids: set[str], bottom_ids: set[str]) -> None:
    card.manual_pin = card.id in pin_ids
    card.manual_bottom = card.id in bottom_ids
    if card.id in include_ids:
        card.manual_pick = True
    if card.manual_pin or card.manual_bottom:
        card.manual_pick = True


def _card_ids(cards: list[StoryCard]) -> set[str]:
    return {str(c.id or "").strip() for c in cards if str(c.id or "").strip()}


def _removed_cards(before: list[StoryCard], after: list[StoryCard], force_ids: set[str]) -> list[StoryCard]:
    kept = _card_ids(after) | set(force_ids or set())
    out: list[StoryCard] = []
    seen: set[str] = set()
    for card in before:
        cid = str(card.id or "").strip()
        if not cid or cid in kept or cid in seen:
            continue
        seen.add(cid)
        out.append(card)
    return out


def _mark_admin_queue_card(card: StoryCard, reason: str) -> StoryCard:
    reason_key = str(reason or "review").strip().lower()
    label_map = {
        "dedupe": "去重淘汰",
        "source_preference": "去重淘汰",
        "ai_dedupe": "去重淘汰",
        "local_dedupe": "去重淘汰",
        "curation": "篩選淘汰",
    }
    label = label_map.get(reason_key, "待審核")
    card.topic_labels = ["other"]
    card.event_wall = False  # type: ignore[attr-defined]
    existing_tags = [str(x).strip() for x in (card.tags or []) if str(x).strip() and str(x).strip() != label]
    card.tags = [label, *existing_tags][:3]
    card.confidence = max(0.6, float(card.confidence or 0.0))
    return card


def _queue_unique(cards: list[StoryCard]) -> list[StoryCard]:
    out: dict[str, StoryCard] = {}
    for card in cards:
        cid = str(card.id or "").strip()
        if cid:
            out[cid] = card
    return list(out.values())


def _is_admin_queue_card(card: StoryCard) -> bool:
    labels = normalize_topic_labels(card.topic_labels)
    return labels == ["other"]


def _public_cards(cards: list[StoryCard]) -> list[StoryCard]:
    return [card for card in cards if not _is_admin_queue_card(card)]


def _queue_new_duplicates_against_existing(
    new_cards: list[StoryCard],
    existing_cards: list[StoryCard],
    *,
    force_ids: set[str],
) -> tuple[list[StoryCard], list[StoryCard]]:
    def signature_candidates(card: StoryCard) -> set[str]:
        values: set[str] = set()
        primary = _dedupe_signature(card)
        if primary:
            values.add(f"primary:{primary}")
        topic = dedupe_key(infer_topic_phrase(card.raw_text or card.title, card.card_type) or card.title)
        if topic:
            values.add(f"topic:{topic[:96]}")
        text_key = dedupe_key(card.raw_text or card.title)
        if text_key:
            values.add(f"text:{text_key[:120]}")
        return values

    existing_sigs: set[str] = set()
    for card in existing_cards:
        existing_sigs.update(signature_candidates(card))
    if not existing_sigs:
        return new_cards, []
    kept: list[StoryCard] = []
    queued: list[StoryCard] = []
    for card in new_cards:
        if card.id in force_ids or card.manual_pick:
            kept.append(card)
            continue
        if signature_candidates(card) & existing_sigs:
            queued.append(_mark_admin_queue_card(card, "dedupe"))
            continue
        kept.append(card)
    return kept, queued


def compact_point(text: str, max_len: int = 96) -> str:
    t = strip_links_mentions(text)
    t = re.sub(r"^\d+/\s*", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= max_len:
        return t
    return t[:max_len].rsplit(" ", 1)[0].strip() + "..."


def dedupe_key(text: str) -> str:
    t = strip_links_mentions(text).lower()
    t = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", t)
    words = [w for w in t.split() if len(w) >= 2]
    return " ".join(words[:16])


def curate_cards(
    cards: list[StoryCard],
    max_cards: int = 14,
    force_include_ids: set[str] | None = None,
) -> tuple[list[StoryCard], int]:
    force_ids = set(force_include_ids or set())
    filtered: list[StoryCard] = []
    removed = 0
    for c in cards:
        c.importance = score_card(c)
        if c.id and (c.id in force_ids or c.manual_pick):
            c.importance = max(c.importance, 99.0)
            filtered.append(c)
            continue
        if is_noise_text(c.raw_text or c.title):
            removed += 1
            continue
        if c.importance < 1.8:
            removed += 1
            continue
        filtered.append(c)

    filtered.sort(key=lambda x: (x.importance, x.published_at), reverse=True)
    result: list[StoryCard] = []
    seen_signatures: set[str] = set()
    for c in filtered:
        key = dedupe_key(c.raw_text or c.title)
        if c.id and (c.id in force_ids or c.manual_pick):
            result.append(c)
            if len(result) >= max_cards:
                break
            continue
        if key and key in seen_signatures:
            removed += 1
            continue
        if key:
            seen_signatures.add(key)
        result.append(c)
        if len(result) >= max_cards:
            break
    return result, removed


def _event_date_hint(card: StoryCard) -> str:
    timeline_dt = _parse_iso_safe(card.timeline_date)
    if timeline_dt:
        return timeline_dt.date().isoformat()
    facts = normalize_event_facts(card.event_facts)
    schedule = str(facts.get("schedule") or "").strip()
    if schedule:
        m = re.search(r"\b(?:20\d{2}/)?(\d{1,2})/(\d{1,2})\b", schedule)
        if m:
            return f"{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        m = re.search(r"(?:20\d{2}\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})", schedule)
        if m:
            return f"{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        m = re.search(r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b", schedule)
        if m:
            month_map = {
                "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
            }
            mon = month_map.get(m.group(1).lower()[:3], 0)
            if mon:
                return f"{mon:02d}-{int(m.group(2)):02d}"
    pub_dt = _parse_iso_safe(card.published_at)
    if pub_dt:
        return pub_dt.date().isoformat()
    return ""


def _dedupe_signature(card: StoryCard) -> str:
    if card.card_type not in {"event", "feature", "announcement"}:
        return ""
    topic = infer_topic_phrase(card.raw_text or card.title, card.card_type)
    topic_key = dedupe_key(topic or card.title)
    date_hint = _event_date_hint(card)
    # Events are often reposted by different accounts for the same session.
    # Cross-account dedupe should still collapse those into one best card.
    if card.card_type == "event":
        return "|".join(["event", date_hint, topic_key[:56]])
    account = str(card.account or "").strip().lower()
    return "|".join([account, card.card_type, date_hint, topic_key[:56]])


def _card_quality_score(card: StoryCard) -> float:
    facts = normalize_event_facts(card.event_facts)
    score = float(card.importance or 0.0)
    if card.cover_image:
        score += 4.0
    if card.timeline_date:
        score += 2.4
    if facts.get("schedule"):
        score += 1.8
    if facts.get("reward"):
        score += 1.2
    if facts.get("participation"):
        score += 0.8
    score += min(1.6, len(clean_text(card.summary or "")) / 220.0)
    if card.manual_pick:
        score += 20.0
    return round(score, 3)


def _is_discord_source_card(card: StoryCard) -> bool:
    provider = str(card.provider or "").strip().lower()
    url = str(card.url or "").strip().lower()
    return provider.startswith("discord") or "discord.com/channels/" in url


def _is_x_source_card(card: StoryCard) -> bool:
    provider = str(card.provider or "").strip().lower()
    url = str(card.url or "").strip().lower()
    if any(domain in url for domain in ("x.com/", "twitter.com/")):
        return True
    return provider in {"twitter-cli", "tweet-result", "r.jina.ai"}


def drop_discord_event_duplicates_preferring_x(
    cards: list[StoryCard],
    force_include_ids: set[str] | None = None,
) -> tuple[list[StoryCard], int]:
    force_ids = set(force_include_ids or set())
    x_event_cards = [c for c in cards if c.card_type == "event" and _is_x_source_card(c)]
    if not x_event_cards:
        return cards, 0

    kept: list[StoryCard] = []
    removed = 0
    for card in cards:
        if card.card_type != "event" or not _is_discord_source_card(card):
            kept.append(card)
            continue
        if card.id in force_ids or card.manual_pick:
            kept.append(card)
            continue

        card_date = _event_date_hint(card)
        topic_self = dedupe_key(infer_topic_phrase(card.raw_text or card.title, card.card_type) or card.title)
        blob_self = f"{card.title} {card.summary}"
        duplicate = False

        for x_card in x_event_cards:
            if x_card.id == card.id:
                continue
            x_date = _event_date_hint(x_card)
            same_date = bool(card_date and x_date and card_date == x_date)
            topic_x = dedupe_key(infer_topic_phrase(x_card.raw_text or x_card.title, x_card.card_type) or x_card.title)
            topic_overlap = bool(topic_self and topic_x and (topic_self == topic_x or topic_self in topic_x or topic_x in topic_self))
            text_sim = max(
                similarity_ratio(blob_self, f"{x_card.title} {x_card.summary}"),
                similarity_ratio(card.raw_text or card.title, x_card.raw_text or x_card.title),
            )
            if (same_date and (topic_overlap or text_sim >= 0.40)) or text_sim >= 0.74:
                duplicate = True
                break

        if duplicate:
            removed += 1
            continue
        kept.append(card)

    return kept, removed


def drop_redundant_cards_local(cards: list[StoryCard], force_include_ids: set[str] | None = None) -> tuple[list[StoryCard], int]:
    force_ids = set(force_include_ids or set())
    picked_by_sig: dict[str, StoryCard] = {}
    passthrough: list[StoryCard] = []
    removed = 0

    for card in cards:
        if card.id in force_ids or card.manual_pick:
            passthrough.append(card)
            continue
        sig = _dedupe_signature(card)
        if not sig:
            passthrough.append(card)
            continue
        prev = picked_by_sig.get(sig)
        if prev is None:
            picked_by_sig[sig] = card
            continue
        prev_score = _card_quality_score(prev)
        now_score = _card_quality_score(card)
        if now_score > prev_score:
            picked_by_sig[sig] = card
            removed += 1
        else:
            removed += 1

    result = passthrough + list(picked_by_sig.values())
    result.sort(key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance), reverse=True)
    uniq: dict[str, StoryCard] = {}
    for c in result:
        uniq[c.id] = c
    return list(uniq.values()), removed


def apply_minimax_global_dedupe(
    cards: list[StoryCard],
    api_key: str,
    force_include_ids: set[str] | None = None,
) -> tuple[list[StoryCard], int]:
    if not cards:
        return cards, 0
    force_ids = set(force_include_ids or set())
    payload_rows: list[dict[str, Any]] = []
    for c in cards:
        facts = normalize_event_facts(c.event_facts)
        payload_rows.append(
            {
                "id": c.id,
                "account": c.account,
                "type": c.card_type,
                "title": compact_point(c.title or "", 96),
                "summary": compact_point(c.summary or "", 160),
                "event_date": _event_date_hint(c),
                "schedule": facts.get("schedule", ""),
                "reward": facts.get("reward", ""),
                "participation": facts.get("participation", ""),
                "has_image": bool(c.cover_image),
                "importance": float(c.importance or 0.0),
            }
        )

    prompt = (
        "你是社群情報總編，任務是『去重』而不是重寫內容。"
        "請從候選卡片中判斷哪些是同一事件/同一更新的重複貼文，只輸出應該刪掉的 id。"
        "規則："
        "1) 同主題、同日期（或同場次）且內容高度重疊，跨帳號也可視為重複；"
        "2) 優先保留資訊更完整者（有時間/地點/獎勵/參與方式/圖片）；完整度相近時再優先官方來源；"
        "3) 不要刪掉跨主題卡片；"
        "4) 不可捏造。"
        "輸出 JSON：{\"drop_ids\":[...],\"notes\":[...]}。\n\n"
        f"force_keep_ids: {sorted(force_ids)}\n"
        f"cards: {json.dumps(payload_rows, ensure_ascii=False)}"
    )
    try:
        raw = minimax_chat(prompt, api_key)
        parsed = parse_json_block(raw) or {}
        drop_ids_raw = parsed.get("drop_ids")
        if not isinstance(drop_ids_raw, list):
            return cards, 0
        known = {c.id for c in cards}
        drop_ids = {str(x).strip() for x in drop_ids_raw if str(x).strip() in known}
        drop_ids = {x for x in drop_ids if x not in force_ids}
        if not drop_ids:
            return cards, 0
        out = [c for c in cards if c.id not in drop_ids]
        if len(out) < max(5, len(cards) // 2):
            return cards, 0
        return out, len(drop_ids)
    except Exception:
        return cards, 0


def extract_key_terms(cards: list[StoryCard], top_n: int = 14) -> list[str]:
    stop = {
        "renaiss", "http", "https", "from", "with", "that", "this", "will", "have", "just", "about",
        "今天", "最近", "我們", "你們", "可以", "真的", "這個", "那個", "以及", "還有", "目前",
    }
    freq: dict[str, int] = {}
    for c in cards:
        text = strip_links_mentions(c.raw_text)
        for token in re.findall(r"[A-Za-z][A-Za-z0-9_+#-]{3,}|[\u4e00-\u9fff]{2,6}", text):
            tk = token.lower().strip()
            if tk in stop:
                continue
            if tk.startswith("tco"):
                continue
            freq[tk] = freq.get(tk, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
    return [k for k, _ in ranked[:top_n]]


def make_section_items(cards: list[StoryCard], limit: int = 4) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for c in cards[:limit]:
        metrics = c.metrics or {}
        engagement = f"❤️{metrics.get('likes',0)} 🔁{metrics.get('retweets',0)} 💬{metrics.get('replies',0)}"
        items.append(
            {
                "headline": compact_point(c.title or c.raw_text, 88),
                "point": compact_point(c.glance or c.summary or c.raw_text, 108),
                "when": c.published_at,
                "account": c.account,
                "url": c.url,
                "engagement": engagement,
                "importance": c.importance,
                "urgency": c.urgency,
            }
        )
    return items


def build_intel_sections(cards: list[StoryCard]) -> dict[str, list[dict[str, Any]]]:
    official = [c for c in cards if c.account.lower() == "renaissxyz"]
    community = [c for c in cards if is_community_pick_source_card(c)]
    official.sort(key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance), reverse=True)
    community.sort(key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance), reverse=True)

    def event_key(card: StoryCard) -> tuple[int, datetime]:
        t = _parse_iso_safe(card.timeline_date)
        if t:
            return (0, t)
        return (1, datetime.max.replace(tzinfo=timezone.utc))

    events = [c for c in cards if c.card_type == "event" and _parse_iso_safe(c.timeline_date)]
    features = [c for c in cards if c.card_type == "feature" and _parse_iso_safe(c.timeline_date)]
    events.sort(key=event_key)
    features.sort(key=event_key)

    sections = {
        "official_updates": make_section_items(
            [c for c in official if c.card_type in {"announcement", "report", "market", "feature", "event"}], 5
        ),
        "upcoming_events": make_section_items(events, 5),
        "upcoming_features": make_section_items(features, 5),
        "community_highlights": make_section_items(
            [c for c in community if c.card_type in {"market", "report", "insight", "event"}], 5
        ),
    }
    return sections


def _parse_iso_safe(value: str) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _agenda_item(card: StoryCard, timeline_dt: datetime | None = None) -> dict[str, Any]:
    event_dt = timeline_dt or _parse_iso_safe(card.timeline_date)
    event_label = event_dt.strftime("%m/%d") if event_dt else (date_hint_from_text(card.raw_text or card.title) or "--")
    days_left = None
    if event_dt:
        days_left = (event_dt.date() - datetime.now(timezone.utc).date()).days
    return {
        "id": card.id,
        "label": event_label,
        "days_left": days_left,
        "headline": compact_point(card.title, 76),
        "glance": compact_point(card.glance or card.summary, 96),
        "account": card.account,
        "url": card.url,
        "type": card.card_type,
        "urgency": card.urgency,
        "published_at": card.published_at,
    }


def build_intel_agenda(cards: list[StoryCard]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    event_future: list[tuple[datetime, StoryCard]] = []
    event_past: list[tuple[datetime, StoryCard]] = []
    future_watch: list[StoryCard] = []
    growth_signals: list[StoryCard] = []
    recent_updates: list[StoryCard] = []
    caution_watch: list[StoryCard] = []

    for card in cards:
        pub_dt = _parse_iso_safe(card.published_at) or now
        if card.account.lower() == "renaissxyz" and (now - pub_dt).days <= 7:
            recent_updates.append(card)
        if card.card_type in {"market", "report"}:
            growth_signals.append(card)
        if re.search(r"注意|風險|warn|scam|慎防|不要|avoid", card.raw_text or "", re.I):
            caution_watch.append(card)

        if card.card_type == "event":
            event_dt = _parse_iso_safe(card.timeline_date)
            if not event_dt:
                continue
            delta = (event_dt.date() - now.date()).days
            if delta >= 0:
                event_future.append((event_dt, card))
            else:
                event_past.append((event_dt, card))
            continue
        if card.card_type in {"feature", "announcement"}:
            future_watch.append(card)

    event_future.sort(key=lambda x: x[0])
    event_past.sort(key=lambda x: x[0], reverse=True)
    growth_signals.sort(key=lambda c: (c.importance, c.published_at), reverse=True)
    recent_updates.sort(key=lambda c: c.published_at, reverse=True)
    future_watch.sort(key=lambda c: (c.importance, c.published_at), reverse=True)
    caution_watch.sort(key=lambda c: (c.importance, c.published_at), reverse=True)

    return {
        "event_timeline_future": [_agenda_item(card, dt) for dt, card in event_future[:10]],
        "event_timeline_past": [_agenda_item(card, dt) for dt, card in event_past[:10]],
        "upcoming_timeline": [_agenda_item(card, dt) for dt, card in event_future[:8]],
        "growth_signals": [_agenda_item(card) for card in growth_signals[:6]],
        "future_watch": [_agenda_item(card) for card in future_watch[:6]],
        "recent_updates": [_agenda_item(card) for card in recent_updates[:6]],
        "attention_watch": [_agenda_item(card) for card in caution_watch[:5]],
    }


def _official_impact_line(card: StoryCard) -> str:
    facts = normalize_event_facts(card.event_facts)
    source = clean_text(" ".join([card.raw_text or "", card.summary or "", " ".join(card.bullets or [])]))
    if card.card_type == "event":
        reward = facts.get("reward", "")
        if reward:
            return f"直接提高參與動機，獎勵重點在 {reward}。"
        return "可直接影響活動參與率與社群互動熱度。"
    if card.card_type in {"feature", "announcement"}:
        return "會影響玩家後續操作節奏，需提早確認開放條件與時間。"
    if card.card_type == "market":
        if re.search(r"\$|成交|record|交易量|volume", source, re.I):
            return "提供市場定價與熱度參考，會影響短期決策與討論方向。"
        return "可作為市場觀測訊號，建議搭配其他來源比對。"
    if card.card_type == "report":
        return "有助於快速比較方案，降低決策成本。"
    return "有助於掌握社群當前關注議題與互動方向。"


def _official_where_line(card: StoryCard) -> str:
    facts = normalize_event_facts(card.event_facts)
    if facts.get("location"):
        return facts["location"]
    source = clean_text(" ".join([card.raw_text or "", card.summary or "", card.title or ""]))
    if re.search(r"hong\s*kong|香港", source, re.I):
        return "香港"
    if re.search(r"discord|space|live|直播|線上|线上", source, re.I):
        return "線上社群"
    return "待官方補充"


def _official_when_line(card: StoryCard) -> str:
    facts = normalize_event_facts(card.event_facts)
    if facts.get("schedule"):
        raw = facts["schedule"]
        raw = re.sub(r"(?i)\btoday\b", "今日", raw)
        raw = re.sub(r"(?i)\btonight\b", "今晚", raw)
        raw = re.sub(r"(?i)\btomorrow\b", "明日", raw)
        return raw
    timeline_dt = _parse_iso_safe(card.timeline_date)
    if timeline_dt:
        return timeline_dt.strftime("%m/%d")
    pub_dt = _parse_iso_safe(card.published_at)
    if pub_dt:
        return pub_dt.strftime("%m/%d")
    return "近期"


def _official_overview_fallback(recent: list[StoryCard]) -> dict[str, Any]:
    type_counts: dict[str, int] = {}
    topic_counts: dict[str, int] = {}
    for card in recent:
        type_counts[card.card_type] = type_counts.get(card.card_type, 0) + 1
        topic = infer_topic_phrase(card.raw_text or card.title, card.card_type)
        topic_counts[topic] = topic_counts.get(topic, 0) + 1

    ordered_types = sorted(type_counts.items(), key=lambda kv: kv[1], reverse=True)
    ordered_topics = sorted(topic_counts.items(), key=lambda kv: kv[1], reverse=True)
    top_topics = [name for name, _ in ordered_topics[:3]]
    type_label_map = {
        "event": "活動",
        "feature": "功能",
        "announcement": "公告",
        "market": "市場",
        "report": "報告",
        "insight": "社群",
    }
    type_brief = "、".join([f"{type_label_map.get(t, t)} {n}" for t, n in ordered_types[:4]])
    topic_brief = "、".join(top_topics) if top_topics else "官方動態"
    summary = (
        f"近 7 天官方重點集中在 {topic_brief}，更新型態以 {type_brief} 為主。"
        "整體看起來，官方目前同時在推活動參與與功能節奏，對玩家最直接的影響是："
        "需要同時關注活動時程、參與門檻與後續功能開放條件。"
    )

    bullets: list[str] = []
    seen_topics: set[str] = set()
    for card in recent:
        who = "Renaiss 官方"
        topic = infer_topic_phrase(card.raw_text or card.title, card.card_type)
        topic_sig = dedupe_key(topic)
        if topic_sig and topic_sig in seen_topics:
            continue
        if topic_sig:
            seen_topics.add(topic_sig)
        when = _official_when_line(card)
        where = _official_where_line(card)
        impact = _official_impact_line(card)
        title_clean = re.sub(r"^[^｜|:：]{1,12}[｜|:：]\s*", "", card.title or "").strip()
        event_text = compact_point(title_clean or topic, 46)
        bullets.append(
            f"{who}在 {when} 釋出「{event_text}」，場域在 {where}；"
            f"核心事件是 {topic}，{impact}"
        )
        if len(bullets) >= 4:
            break

    return {
        "title": "近 7 天官方重點整理",
        "summary": summary,
        "bullets": bullets or ["目前尚未整理出可顯示的官方重點。"],
    }


def build_official_overview(cards: list[StoryCard], api_key: str | None = None) -> dict[str, Any]:
    official = [c for c in cards if c.account.lower().startswith("renaiss")]
    if not official:
        return {
            "title": "近 7 天官方重點整理",
            "summary": "目前尚未抓到足夠的官方更新資料。",
            "bullets": ["完成同步後，會在這裡顯示官方近期重點。"],
        }

    official.sort(key=lambda c: _parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    latest_dt = _parse_iso_safe(official[0].published_at) or datetime.now(timezone.utc)
    window_start = latest_dt - timedelta(days=7)
    recent = [
        c for c in official
        if (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc)) >= window_start
    ][:12]
    if not recent:
        recent = official[:8]
    fallback = _official_overview_fallback(recent)
    if not api_key:
        return fallback

    rows = []
    for c in recent[:10]:
        rows.append(
            {
                "id": c.id,
                "type": c.card_type,
                "title": compact_point(c.title, 92),
                "summary": compact_point(c.summary, 180),
                "published_at": c.published_at,
                "timeline_date": c.timeline_date,
                "event_facts": normalize_event_facts(c.event_facts),
                "has_image": bool(c.cover_image),
            }
        )
    prompt = (
        "你是官方情報站主編，請把資料整理成真正可讀的重點摘要。"
        "要求："
        "1) 內容必須是繁體中文；"
        "2) 不是改寫標題，而是做整合；"
        "3) 每條重點都要包含「人、事、時、地、影響」五個面向（可自然句，不用標籤格式）；"
        "4) 禁止空泛句（例如建議交叉驗證、可持續追蹤）；"
        "5) 不可捏造。"
        "請輸出 JSON：{\"title\":str,\"summary\":str,\"bullets\":[str,str,str,str]}。\n\n"
        f"cards={json.dumps(rows, ensure_ascii=False)}"
    )
    try:
        raw = minimax_chat(prompt, api_key)
        parsed = parse_json_block(raw) or {}
        title = clean_text(str(parsed.get("title") or ""))[:48]
        summary = clean_text(str(parsed.get("summary") or ""))[:360]
        bullets_raw = parsed.get("bullets") if isinstance(parsed.get("bullets"), list) else []
        bullets = [clean_text(str(x))[:180] for x in bullets_raw if clean_text(str(x))]
        if not title:
            title = str(fallback.get("title") or "近 7 天官方重點整理")
        if len(summary) < 40:
            summary = str(fallback.get("summary") or "")
        if len(bullets) < 3:
            bullets = list(fallback.get("bullets") or [])
        return {
            "title": title or "近 7 天官方重點整理",
            "summary": summary or str(fallback.get("summary") or ""),
            "bullets": bullets[:4],
        }
    except Exception:
        return fallback


PRESERVED_CARD_MUTABLE_FIELDS = {
    "card_type",
    "layout",
    "tags",
    "confidence",
    "importance",
    "template_id",
    "timeline_date",
    "timeline_end_date",
    "event_wall",
    "urgency",
    "manual_pick",
    "manual_pin",
    "manual_bottom",
    "event_facts",
    "topic_labels",
    "sbt_name",
    "sbt_names",
    "sbt_acquisition",
}

LEGACY_CARD_FIELDS = {
    "manual_classification",
    "manual_type_override",
    "manual_topic_override",
    "admin_queue_reason",
    "admin_queue_label",
}


def _strip_legacy_card_fields(row: dict[str, Any]) -> dict[str, Any]:
    cleaned = dict(row)
    for key in LEGACY_CARD_FIELDS:
        cleaned.pop(key, None)
    return cleaned


def _preserved_card_changed(card: StoryCard, raw: dict[str, Any]) -> bool:
    row = card.to_dict()
    for key in PRESERVED_CARD_MUTABLE_FIELDS:
        if row.get(key) != raw.get(key):
            return True
    return any(key in raw for key in LEGACY_CARD_FIELDS)


def _serialize_feed_cards(cards: list[StoryCard], preserved_raw: dict[str, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    raw_by_id = preserved_raw or {}
    rows: list[dict[str, Any]] = []
    for card in cards:
        card_id = str(card.id or "").strip()
        raw = raw_by_id.get(card_id)
        if raw is not None and not _preserved_card_changed(card, raw):
            rows.append(_strip_legacy_card_fields(raw))
            continue
        row = card.to_dict()
        if raw is not None:
            merged = _strip_legacy_card_fields(raw)
            for key in PRESERVED_CARD_MUTABLE_FIELDS:
                if key in row or key in merged:
                    merged[key] = row.get(key)
            rows.append(merged)
            continue
        rows.append(_strip_legacy_card_fields(row))
    return rows


def build_feed_payload(
    cards: list[StoryCard],
    digest: dict[str, Any],
    window_days: int,
    accounts: list[str],
    preserved_raw: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    return {
        "generated_at": generated_at,
        "window_days": window_days,
        "accounts": accounts,
        "total_cards": len(cards),
        "layout_counts": {
            "poster": sum(1 for c in cards if c.layout == "poster"),
            "brief": sum(1 for c in cards if c.layout == "brief"),
            "data": sum(1 for c in cards if c.layout == "data"),
            "timeline": sum(1 for c in cards if c.layout == "timeline"),
        },
        "digest": digest,
        "cards": _serialize_feed_cards(cards, preserved_raw),
    }


def default_format_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": "event_poster",
            "name": "活動海報型",
            "for": "活動、直播、線下聚會",
            "blocks": ["活動主軸", "時間線索", "參與方式", "原文入口"],
        },
        {
            "id": "market_signal",
            "name": "市場訊號型",
            "for": "數據、成交量、價格變化",
            "blocks": ["這則在說什麼", "提到哪些數據", "可能影響", "下一步要看什麼"],
        },
        {
            "id": "announcement_timeline",
            "name": "公告時間線型",
            "for": "功能開放、版本進度、官方更新",
            "blocks": ["更新主題", "目前進度", "下一步", "時間節點"],
        },
        {
            "id": "community_brief",
            "name": "社群觀點型",
            "for": "社群討論與經驗分享",
            "blocks": ["觀點摘要", "可採用做法", "風險提醒", "延伸閱讀"],
        },
    ]


def sync_accounts(
    accounts: list[str] | None = None,
    window_days: int = DEFAULT_WINDOW_DAYS,
    max_posts_per_account: int = DEFAULT_MAX_POSTS_PER_ACCOUNT,
) -> dict[str, Any]:
    load_environment()
    api_key = resolve_minimax_key()
    twitter_cli_ready = bool(shutil_which("twitter"))

    target_accounts = normalize_x_accounts(accounts) if accounts is not None else resolve_tracked_x_accounts()
    since_dt = datetime.now(timezone.utc) - timedelta(days=window_days)
    preserved_raw_by_id = _read_existing_feed_card_payloads()
    existing_cards = _read_existing_feed_cards()
    existing_ids = _card_ids(existing_cards)

    account_cards: list[StoryCard] = []
    account_stats: dict[str, int] = {}
    for username in target_accounts:
        cards = collect_account_cards(username, since_dt=since_dt, max_posts=max_posts_per_account)
        account_cards.extend(cards)
        account_stats[username] = len(cards)

    discord_cfg = resolve_discord_monitor_config()
    discord_cards: list[StoryCard] = []
    discord_stats: dict[str, int] = {}
    discord_errors: list[str] = []
    if discord_cfg.get("enabled"):
        configured_ids = [str(x) for x in discord_cfg.get("channel_ids", []) if str(x).strip()]
        token = str(discord_cfg.get("token") or "")
        base_limit = int(discord_cfg.get("limit") or DEFAULT_DISCORD_MONITOR_LIMIT)
        forced_ids = [cid for cid in configured_ids if cid == FORCED_COLLECTIBLES_CHANNEL_ID]
        normal_ids = [cid for cid in configured_ids if cid != FORCED_COLLECTIBLES_CHANNEL_ID]

        if normal_ids:
            cards_part, stats_part, errors_part = collect_discord_cards(
                channel_ids=normal_ids,
                token=token,
                since_dt=since_dt,
                limit_per_channel=base_limit,
            )
            discord_cards.extend(cards_part)
            discord_stats.update(stats_part)
            discord_errors.extend(errors_part)

        # Forced collectibles channel: include the whole channel window (no since_dt clipping).
        if forced_ids:
            cards_part, stats_part, errors_part = collect_discord_cards(
                channel_ids=forced_ids,
                token=token,
                since_dt=datetime(1970, 1, 1, tzinfo=timezone.utc),
                limit_per_channel=max(base_limit, 100),
            )
            discord_cards.extend(cards_part)
            discord_stats.update(stats_part)
            discord_errors.extend(errors_part)

        uniq_discord: dict[str, StoryCard] = {}
        for card in discord_cards:
            uniq_discord[card.id] = card
        discord_cards = list(uniq_discord.values())
        discord_cards.sort(key=lambda c: c.published_at, reverse=True)
        for cid, count in discord_stats.items():
            account_stats[f"discord:{cid}"] = int(count)

    picks = read_manual_picks()
    include_ids = set(picks["include_ids"])
    exclude_ids = set(picks["exclude_ids"])
    pin_ids = set(picks["pin_ids"])
    bottom_ids = set(picks["bottom_ids"])
    force_ids = include_ids | pin_ids | bottom_ids

    manual_path = data_dir() / "x_intel_manual_entries.json"
    manual_raw = read_json(manual_path, [])
    manual_cards: list[StoryCard] = []
    for item in manual_raw:
        if not isinstance(item, dict):
            continue
        try:
            card = _story_card_from_payload(item, default_account="manual", default_provider="manual")
            card.manual_pick = True
            manual_cards.append(card)
        except Exception:
            continue

    def _only_new(cards: list[StoryCard]) -> list[StoryCard]:
        out: list[StoryCard] = []
        seen: set[str] = set()
        for card in cards:
            cid = str(card.id or "").strip()
            if not cid or cid in existing_ids or cid in seen:
                continue
            seen.add(cid)
            out.append(card)
        return out

    new_account_cards = _only_new(account_cards)
    new_manual_cards = _only_new(manual_cards)
    new_discord_cards = _only_new(discord_cards)
    merged_new_cards = merge_cards(new_account_cards, new_manual_cards, new_discord_cards)
    merged_cards = merge_cards(existing_cards, merged_new_cards)
    merged_total = len(existing_cards) + len(merged_new_cards)

    feedback_result = apply_feedback_overrides(existing_cards)
    feedback_excluded_ids = set(feedback_result.get("excluded_ids", set()))
    preserved_cards: list[StoryCard] = []
    removed_by_selection = 0
    removed_by_feedback = 0
    for c in existing_cards:
        _apply_manual_flags_to_card(c, include_ids=include_ids, pin_ids=pin_ids, bottom_ids=bottom_ids)
        if c.id in feedback_excluded_ids and c.id not in force_ids:
            removed_by_feedback += 1
            continue
        if c.id in exclude_ids and c.id not in force_ids:
            removed_by_selection += 1
            continue
        preserved_cards.append(c)

    if merged_new_cards:
        normalize_cards_semantics(merged_new_cards)
        _enforce_fixed_channel_topic_labels(merged_new_cards)
    new_feedback_result = apply_feedback_overrides(merged_new_cards)
    if int(new_feedback_result.get("override_count", 0) or 0):
        feedback_result["override_count"] = int(feedback_result.get("override_count", 0) or 0) + int(new_feedback_result.get("override_count", 0) or 0)
    feedback_excluded_ids |= set(new_feedback_result.get("excluded_ids", set()))

    new_source_cards: list[StoryCard] = []
    for c in merged_new_cards:
        _apply_manual_flags_to_card(c, include_ids=include_ids, pin_ids=pin_ids, bottom_ids=bottom_ids)
        if c.id in feedback_excluded_ids and c.id not in force_ids:
            removed_by_feedback += 1
            continue
        if c.id in exclude_ids and c.id not in force_ids:
            removed_by_selection += 1
            continue
        new_source_cards.append(c)

    queue_cards: list[StoryCard] = []
    new_source_cards, queued_existing_dupes = _queue_new_duplicates_against_existing(
        new_source_cards,
        preserved_cards,
        force_ids=force_ids,
    )
    queue_cards.extend(queued_existing_dupes)
    removed_by_existing_dedupe = len(queued_existing_dupes)

    before_source_pref = list(new_source_cards)
    new_source_cards, _source_pref_count = drop_discord_event_duplicates_preferring_x(
        new_source_cards,
        force_include_ids=force_ids,
    )
    source_pref_removed_cards = _removed_cards(before_source_pref, new_source_cards, force_ids)
    queue_cards.extend(_mark_admin_queue_card(card, "source_preference") for card in source_pref_removed_cards)
    removed_by_source_pref = len(source_pref_removed_cards)

    before_curation = list(new_source_cards)
    curated_cards, _curation_removed = curate_cards(
        new_source_cards,
        max_cards=DEFAULT_CURATED_MAX_CARDS,
        force_include_ids=force_ids,
    )
    curation_removed_cards = _removed_cards(before_curation, curated_cards, force_ids)
    queue_cards.extend(_mark_admin_queue_card(card, "curation") for card in curation_removed_cards)
    removed_count = len(curation_removed_cards)

    feedback_context = feedback_training_text()
    ai_deduped = 0
    local_deduped = 0
    if api_key and curated_cards:
        apply_minimax_story_refine(curated_cards, api_key, feedback_context=feedback_context)
        normalize_cards_semantics(curated_cards, preserve_type=True)
        _enforce_fixed_channel_topic_labels(curated_cards)
        refined_feedback_result = apply_feedback_overrides(curated_cards)
        if int(refined_feedback_result.get("override_count", 0) or 0):
            feedback_result["override_count"] = int(feedback_result.get("override_count", 0) or 0) + int(refined_feedback_result.get("override_count", 0) or 0)
        normalize_cards_semantics(curated_cards, preserve_type=True)
        _enforce_fixed_channel_topic_labels(curated_cards)
        before_ai_dedupe = list(curated_cards)
        curated_cards, _ai_deduped_count = apply_minimax_global_dedupe(curated_cards, api_key, force_include_ids=force_ids)
        ai_removed_cards = _removed_cards(before_ai_dedupe, curated_cards, force_ids)
        queue_cards.extend(_mark_admin_queue_card(card, "ai_dedupe") for card in ai_removed_cards)
        ai_deduped = len(ai_removed_cards)

        before_local_dedupe = list(curated_cards)
        curated_cards, _local_deduped_count = drop_redundant_cards_local(curated_cards, force_include_ids=force_ids)
        local_removed_cards = _removed_cards(before_local_dedupe, curated_cards, force_ids)
        queue_cards.extend(_mark_admin_queue_card(card, "local_dedupe") for card in local_removed_cards)
        local_deduped = len(local_removed_cards)

        before_final_curation = list(curated_cards)
        curated_cards, _final_curation_removed = curate_cards(
            curated_cards,
            max_cards=DEFAULT_CURATED_MAX_CARDS,
            force_include_ids=force_ids,
        )
        final_curation_removed_cards = _removed_cards(before_final_curation, curated_cards, force_ids)
        queue_cards.extend(_mark_admin_queue_card(card, "curation") for card in final_curation_removed_cards)
        removed_count += len(final_curation_removed_cards)
    else:
        apply_editorial_fallback(curated_cards)
        before_local_dedupe = list(curated_cards)
        curated_cards, _local_deduped_count = drop_redundant_cards_local(curated_cards, force_include_ids=force_ids)
        local_removed_cards = _removed_cards(before_local_dedupe, curated_cards, force_ids)
        queue_cards.extend(_mark_admin_queue_card(card, "local_dedupe") for card in local_removed_cards)
        local_deduped = len(local_removed_cards)
    curated_cards = _ensure_forced_collectibles_cards_in_curated(new_source_cards, curated_cards)
    _enforce_fixed_channel_topic_labels(curated_cards)
    for card in curated_cards:
        card.manual_pick = card.manual_pick or (card.id in include_ids)
        card.manual_pin = card.id in pin_ids
        card.manual_bottom = card.id in bottom_ids
        card.importance = score_card(card)
        enrich_card_metadata(card)
        enrich_detail_view(card)
        apply_quality_guard(card)
        normalize_card_semantics(card, preserve_type=True)
        _enforce_fixed_channel_topic_labels([card])
        card.importance = score_card(card)
    final_feedback_result = apply_feedback_overrides(curated_cards)
    if int(final_feedback_result.get("override_count", 0) or 0):
        feedback_result["override_count"] = int(feedback_result.get("override_count", 0) or 0) + int(final_feedback_result.get("override_count", 0) or 0)
        for card in curated_cards:
            card.importance = score_card(card)
    curated_cards.sort(
        key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance),
        reverse=True,
    )
    public_candidate_ids = _card_ids(preserved_cards + curated_cards)
    queue_cards = [card for card in _queue_unique(queue_cards) if card.id not in public_candidate_ids]
    source_cards = merge_cards(preserved_cards, new_source_cards)
    final_cards = merge_cards(preserved_cards, curated_cards, queue_cards)
    public_cards = _public_cards(final_cards)

    key_terms = extract_key_terms(public_cards, top_n=14)
    sections = build_intel_sections(public_cards)
    agenda = build_intel_agenda(public_cards)
    digest = aggregate_digest(public_cards, sections, key_terms, api_key=api_key or None)
    if not api_key:
        event_count = sum(1 for c in public_cards if c.card_type == "event")
        feature_count = sum(1 for c in public_cards if c.card_type == "feature")
        announcement_count = sum(1 for c in public_cards if c.card_type == "announcement")
        growth_count = len(agenda.get("growth_signals", []))
        future_count = len(agenda.get("future_watch", []))
        digest["headline"] = f"Spring AI 主時間軸：活動 {event_count} / 功能 {feature_count} / 公告 {announcement_count}"
        digest["conclusion"] = (
            f"已整理出活動 {event_count} 件、功能 {feature_count} 件、公告 {announcement_count} 件、增長訊號 {growth_count} 件、未來觀察 {future_count} 件，"
            "可直接用於社群公告與行動排程。"
        )
        digest["takeaways"] = [
            "先看主時間軸，把活動與功能安排到行事曆。",
            "活動類優先確認時間、地點與參與方式。",
            "再看「增長訊號」確認社群熱度與市場脈動。",
        ]
    payload = build_feed_payload(final_cards, digest, window_days, target_accounts, preserved_raw=preserved_raw_by_id)
    payload["raw_total_cards"] = merged_total
    payload["source_total_cards"] = len(source_cards)
    payload["excluded_cards"] = removed_count
    payload["excluded_by_selection"] = removed_by_selection
    payload["excluded_by_feedback"] = removed_by_feedback
    payload["excluded_by_existing_dedupe"] = int(removed_by_existing_dedupe)
    payload["excluded_by_source_preference"] = int(removed_by_source_pref)
    payload["key_terms"] = key_terms
    payload["intel_sections"] = sections
    payload["intel_agenda"] = agenda
    payload["official_overview"] = build_official_overview(public_cards, api_key=api_key or None)
    payload["format_templates"] = default_format_templates()
    payload["template_counts"] = {
        "event_poster": sum(1 for c in public_cards if c.template_id == "event_poster"),
        "market_signal": sum(1 for c in public_cards if c.template_id == "market_signal"),
        "announcement_timeline": sum(1 for c in public_cards if c.template_id == "announcement_timeline"),
        "community_brief": sum(1 for c in public_cards if c.template_id == "community_brief"),
    }
    payload["image_cards"] = sum(1 for c in public_cards if c.cover_image)
    payload["manual_picks"] = {
        "include_ids": sorted(include_ids),
        "exclude_ids": sorted(exclude_ids),
        "pin_ids": sorted(pin_ids),
        "bottom_ids": sorted(bottom_ids),
        "include_count": len(include_ids),
        "exclude_count": len(exclude_ids),
        "pin_count": len(pin_ids),
        "bottom_count": len(bottom_ids),
    }
    payload["feedback_stats"] = {
        "override_count": int(feedback_result.get("override_count", 0) or 0),
        "excluded_count": len(feedback_excluded_ids),
    }
    payload["dedupe_stats"] = {
        "existing_duplicate_removed": int(removed_by_existing_dedupe),
        "source_preference_removed": int(removed_by_source_pref),
        "ai_removed": int(ai_deduped),
        "local_removed": int(local_deduped),
    }
    payload["pipeline_counts"] = {
        "merged_total": int(merged_total),
        "preserved_total": int(len(existing_cards)),
        "preserved_visible_total": int(len(preserved_cards)),
        "new_candidate_total": int(len(merged_new_cards)),
        "new_source_total": int(len(new_source_cards)),
        "new_curated_total": int(len(curated_cards)),
        "admin_queue_total": int(len(queue_cards)),
        "public_total": int(len(public_cards)),
        "final_total": int(len(final_cards)),
        "source_total": int(len(source_cards)),
        "curated_total": int(len(public_cards)),
        "removed_by_selection": int(removed_by_selection),
        "removed_by_feedback": int(removed_by_feedback),
        "removed_by_existing_dedupe": int(removed_by_existing_dedupe),
        "removed_by_source_preference": int(removed_by_source_pref),
        "removed_by_ai_dedupe": int(ai_deduped),
        "removed_by_local_dedupe": int(local_deduped),
        "removed_by_curation": int(removed_count),
    }
    payload["source_stats"] = account_stats
    payload["new_source_stats"] = {
        "x": len(new_account_cards),
        "discord": len(new_discord_cards),
        "manual": len(new_manual_cards),
    }
    quality: dict[str, str] = {}
    for username in target_accounts:
        providers = {c.provider for c in merged_cards if c.account.lower() == username.lower() and c.provider}
        if not providers:
            quality[username] = "no-data"
        elif len(providers) == 1:
            quality[username] = next(iter(providers))
        else:
            quality[username] = "mixed"
    payload["source_quality"] = quality
    payload["discord_monitor"] = {
        "enabled": bool(discord_cfg.get("enabled")),
        "configured": bool(discord_cfg.get("configured")),
        "channel_ids": [str(x) for x in discord_cfg.get("channel_ids", [])],
        "limit_per_channel": int(discord_cfg.get("limit") or DEFAULT_DISCORD_MONITOR_LIMIT),
        "cards_total": len(discord_cards),
        "channel_stats": discord_stats,
        "errors": discord_errors[:6],
    }
    payload["notes"] = {
        "fallback": "若某帳號無法公開抓取，系統會保留該帳號並等待後續可讀資料。",
        "provider": "twitter-cli (若可用) / tweet-result / r.jina.ai / nitter-rss fallback / discord-rest(可選)",
        "twitter_cli_ready": twitter_cli_ready,
        "discord_monitor_enabled": bool(discord_cfg.get("enabled")),
    }

    write_json(data_dir() / "x_intel_feed.json", payload)
    return payload


def add_manual_tweet(tweet_url: str) -> dict[str, Any]:
    load_environment()
    api_key = resolve_minimax_key() or None

    card = build_card_from_url(tweet_url, api_key=api_key)
    manual_path = data_dir() / "x_intel_manual_entries.json"
    current = read_json(manual_path, [])

    filtered = [item for item in current if str(item.get("id")) != card.id]
    card.manual_pick = True
    filtered.append(card.to_dict())
    write_json(manual_path, filtered)
    set_manual_selection(card.id, "include")

    payload = sync_accounts()
    return {
        "ok": True,
        "added": card.to_dict(),
        "feed": payload,
    }


if __name__ == "__main__":
    result = sync_accounts()
    print(json.dumps({
        "generated_at": result.get("generated_at"),
        "total_cards": result.get("total_cards"),
        "source_stats": result.get("source_stats", {}),
    }, ensure_ascii=False, indent=2))
