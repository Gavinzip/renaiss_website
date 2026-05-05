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
    "寶可夢相關分區主要收市場、開箱、實體卡與二級市場觀察；純官方 Renaiss 活動不要只因為出現 TCG 或卡包就放入 pokemon。",
]


def _normalize_card_field_overrides(raw: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(raw, dict):
        return out
    for key, value in raw.items():
        card_id = str(key or "").strip()
        if not card_id or not isinstance(value, dict):
            continue
        names = normalize_sbt_names(
            value.get("sbt_names") if value.get("sbt_names") is not None else value.get("sbt_name")
        )
        acquisition = clean_text(str(value.get("sbt_acquisition") or "")).strip()[:260]
        out[card_id] = {
            "sbt_name": names[0] if names else "",
            "sbt_names": names,
            "sbt_acquisition": acquisition,
            "updated_at": str(value.get("updated_at") or ""),
        }
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
    card_field_overrides = _normalize_card_field_overrides(raw.get("card_field_overrides"))
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
        "card_field_overrides": _normalize_card_field_overrides(state.get("card_field_overrides")),
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
        "  \"target_label\": \"event/feature/announcement/market/report/insight/events/official/sbt/pokemon/alpha/tools/other/exclude\",\n"
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
    return {
        "feedback_items": len(items),
        "rules": len(rules),
        "source_profiles": len(profiles),
        "default_rules": len(DEFAULT_MEMORY_RULES),
        "updated_at": str(state.get("updated_at") or ""),
    }


def apply_feedback_overrides(cards: list[StoryCard]) -> dict[str, Any]:
    state = read_feedback_state()
    items = state.get("items", {})
    excluded_ids: set[str] = set()
    override_count = 0
    if not isinstance(items, dict):
        return {"override_count": 0, "excluded_ids": excluded_ids}

    for card in cards:
        info = items.get(card.id)
        if not isinstance(info, dict):
            continue
        label = str(info.get("label") or "").strip().lower()
        if label == "exclude":
            excluded_ids.add(card.id)
            override_count += 1
            continue
        if label in ALLOWED_CARD_TYPES:
            if card.card_type != label:
                override_count += 1
            card.card_type = label
            card.layout, default_tags = default_style_for_type(label)
            if not card.tags:
                card.tags = default_tags[:]
            if "回饋" not in card.tags:
                card.tags = (card.tags[:2] + ["回饋"])[:3]
            card.confidence = max(0.82, float(card.confidence or 0.0))
            continue
        if label in ALLOWED_TOPIC_LABELS:
            labels = normalize_topic_labels([*(card.topic_labels or []), label])
            if label not in normalize_topic_labels(card.topic_labels):
                override_count += 1
            card.topic_labels = labels
            if "回饋" not in card.tags:
                card.tags = (card.tags[:2] + ["回饋"])[:3]
            card.confidence = max(0.82, float(card.confidence or 0.0))
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


def _normalize_timeline_edit_value(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    iso_match = re.fullmatch(r"(20\d{2})-(\d{1,2})-(\d{1,2})", raw)
    if iso_match:
        year, month, day = [int(x) for x in iso_match.groups()]
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).date().isoformat()
        except Exception as exc:
            raise ValueError(f"invalid date: {raw}") from exc
    dt = _parse_iso_safe(raw)
    if dt:
        return dt.date().isoformat()
    fuzzy = re.search(r"(20\d{2})[/-](\d{1,2})[/-](\d{1,2})", raw)
    if fuzzy:
        year, month, day = [int(x) for x in fuzzy.groups()]
        try:
            return datetime(year, month, day, tzinfo=timezone.utc).date().isoformat()
        except Exception as exc:
            raise ValueError(f"invalid date: {raw}") from exc
    raise ValueError("timeline date format invalid; use YYYY-MM-DD or ISO datetime")


def _normalize_event_wall_edit_value(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    raw = str(value or "").strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    raise ValueError("event_wall must be true/false")


def _apply_timeline_fields_to_cards(
    rows: list[dict[str, Any]],
    *,
    card_id: str,
    timeline_date: str,
    timeline_end_date: str,
) -> int:
    updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("id") or "").strip() != card_id:
            continue
        row["timeline_date"] = timeline_date
        row["timeline_end_date"] = timeline_end_date
        updated += 1
    return updated


def _apply_event_wall_field_to_cards(
    rows: list[dict[str, Any]],
    *,
    card_id: str,
    event_wall: bool,
) -> int:
    updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("id") or "").strip() != card_id:
            continue
        row["event_wall"] = bool(event_wall)
        updated += 1
    return updated


def _normalize_sbt_names_edit_value(value: Any) -> list[str]:
    if isinstance(value, list):
        return normalize_sbt_names(value)
    text = str(value or "").strip()
    if not text:
        return []
    parts = [
        chunk.strip()
        for chunk in re.split(r"[,\n/|;；、，]+", text)
        if chunk and str(chunk).strip()
    ]
    return normalize_sbt_names(parts)


def _normalize_sbt_acquisition_edit_value(value: Any) -> str:
    text = clean_text(str(value or "")).strip()
    text = re.sub(r"^\s*SBT\s*取得方式\s*[:：]\s*", "", text, flags=re.I).strip()
    return text[:260]


def _normalize_cover_image_edit_value(value: Any) -> str:
    text = clean_text(str(value or "")).strip()
    if not text:
        return ""
    if text.startswith("/data/generated_covers/"):
        return text
    if text.startswith("data/generated_covers/"):
        return f"/{text}"
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return text


def _apply_cover_image_to_cards(
    rows: list[dict[str, Any]],
    *,
    card_id: str,
    cover_image: str,
) -> int:
    updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("id") or "").strip() != card_id:
            continue
        row["cover_image"] = cover_image
        updated += 1
    return updated


def _apply_sbt_fields_to_cards(
    rows: list[dict[str, Any]],
    *,
    card_id: str,
    sbt_names: list[str],
    sbt_acquisition: str,
) -> int:
    updated = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("id") or "").strip() != card_id:
            continue
        row["sbt_names"] = list(sbt_names)
        row["sbt_name"] = sbt_names[0] if sbt_names else ""
        row["sbt_acquisition"] = sbt_acquisition
        if sbt_names or sbt_acquisition:
            labels = normalize_topic_labels(row.get("topic_labels"))
            if "sbt" not in labels:
                labels.append("sbt")
            row["topic_labels"] = labels
        updated += 1
    return updated


def update_card_cover_image(
    tweet_id: str,
    *,
    linked_card_url: str = "",
    cover_image: Any = "",
) -> dict[str, Any]:
    card_id = str(tweet_id or "").strip()
    linked_url = str(linked_card_url or "").strip()
    if not card_id and not linked_url:
        raise ValueError("tweet id or linked_card_url is required")

    cover = _normalize_cover_image_edit_value(cover_image)
    if not cover:
        raise ValueError("cover_image is required")

    feed_path = data_dir() / "x_intel_feed.json"
    feed_payload = read_json(feed_path, {})
    cards = feed_payload.get("cards") if isinstance(feed_payload, dict) else None
    if not isinstance(cards, list):
        raise ValueError("feed cards not found")

    if not card_id and linked_url:
        for row in cards:
            if not isinstance(row, dict):
                continue
            if str(row.get("url") or "").strip() == linked_url:
                card_id = str(row.get("id") or "").strip()
                break
    if not card_id:
        raise ValueError("card not found")

    updated_base = _apply_cover_image_to_cards(
        cards,
        card_id=card_id,
        cover_image=cover,
    )
    if updated_base <= 0:
        raise ValueError("card not found")

    feed_payload["cards"] = cards
    write_json(feed_path, feed_payload)

    i18n_bundle_path = data_dir() / "x_intel_feed_i18n.json"
    i18n_updated = 0
    i18n_payload = read_json(i18n_bundle_path, {})
    i18n_changed = False
    if isinstance(i18n_payload, dict):
        root_cards = i18n_payload.get("cards")
        if isinstance(root_cards, list):
            count = _apply_cover_image_to_cards(
                root_cards,
                card_id=card_id,
                cover_image=cover,
            )
            if count:
                i18n_updated += count
                i18n_changed = True
        langs = i18n_payload.get("langs")
        if isinstance(langs, dict):
            for lang_row in langs.values():
                if not isinstance(lang_row, dict):
                    continue
                lang_cards = lang_row.get("cards")
                if not isinstance(lang_cards, list):
                    continue
                count = _apply_cover_image_to_cards(
                    lang_cards,
                    card_id=card_id,
                    cover_image=cover,
                )
                if count:
                    i18n_updated += count
                    i18n_changed = True
        if i18n_changed:
            write_json(i18n_bundle_path, i18n_payload)

    return {
        "id": card_id,
        "cover_image": cover,
        "updated_cards": updated_base,
        "updated_i18n_cards": i18n_updated,
    }


def update_card_sbt_fields(
    tweet_id: str,
    *,
    linked_card_url: str = "",
    sbt_names: Any = None,
    sbt_acquisition: Any = "",
) -> dict[str, Any]:
    card_id = str(tweet_id or "").strip()
    linked_url = str(linked_card_url or "").strip()
    if not card_id and not linked_url:
        raise ValueError("tweet id or linked_card_url is required")

    names = _normalize_sbt_names_edit_value(sbt_names)
    acquisition = _normalize_sbt_acquisition_edit_value(sbt_acquisition)

    feed_path = data_dir() / "x_intel_feed.json"
    feed_payload = read_json(feed_path, {})
    cards = feed_payload.get("cards") if isinstance(feed_payload, dict) else None
    if not isinstance(cards, list):
        raise ValueError("feed cards not found")

    if not card_id and linked_url:
        for row in cards:
            if not isinstance(row, dict):
                continue
            if str(row.get("url") or "").strip() == linked_url:
                card_id = str(row.get("id") or "").strip()
                break
    if not card_id:
        raise ValueError("card not found")

    updated_base = _apply_sbt_fields_to_cards(
        cards,
        card_id=card_id,
        sbt_names=names,
        sbt_acquisition=acquisition,
    )
    if updated_base <= 0:
        raise ValueError("card not found")

    feed_payload["cards"] = cards
    write_json(feed_path, feed_payload)

    i18n_bundle_path = data_dir() / "x_intel_feed_i18n.json"
    i18n_updated = 0
    i18n_payload = read_json(i18n_bundle_path, {})
    i18n_changed = False
    if isinstance(i18n_payload, dict):
        root_cards = i18n_payload.get("cards")
        if isinstance(root_cards, list):
            count = _apply_sbt_fields_to_cards(
                root_cards,
                card_id=card_id,
                sbt_names=names,
                sbt_acquisition=acquisition,
            )
            if count:
                i18n_updated += count
                i18n_changed = True
        langs = i18n_payload.get("langs")
        if isinstance(langs, dict):
            for lang_row in langs.values():
                if not isinstance(lang_row, dict):
                    continue
                lang_cards = lang_row.get("cards")
                if not isinstance(lang_cards, list):
                    continue
                count = _apply_sbt_fields_to_cards(
                    lang_cards,
                    card_id=card_id,
                    sbt_names=names,
                    sbt_acquisition=acquisition,
                )
                if count:
                    i18n_updated += count
                    i18n_changed = True
        if i18n_changed:
            write_json(i18n_bundle_path, i18n_payload)

    state = read_feedback_state()
    overrides = state.get("card_field_overrides")
    if not isinstance(overrides, dict):
        overrides = {}
    overrides[card_id] = {
        "sbt_name": names[0] if names else "",
        "sbt_names": names,
        "sbt_acquisition": acquisition,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    state["card_field_overrides"] = overrides
    write_feedback_state(state)

    return {
        "id": card_id,
        "sbt_name": names[0] if names else "",
        "sbt_names": names,
        "sbt_acquisition": acquisition,
        "updated_cards": updated_base,
        "updated_i18n_cards": i18n_updated,
    }


def update_card_timeline_fields(
    tweet_id: str,
    *,
    timeline_date: str = "",
    timeline_end_date: str = "",
) -> dict[str, Any]:
    card_id = str(tweet_id or "").strip()
    if not card_id:
        raise ValueError("tweet id is required")

    start_date = _normalize_timeline_edit_value(timeline_date)
    end_date = _normalize_timeline_edit_value(timeline_end_date)
    if start_date and end_date and end_date < start_date:
        raise ValueError("timeline_end_date must be on or after timeline_date")

    feed_path = data_dir() / "x_intel_feed.json"
    feed_payload = read_json(feed_path, {})
    cards = feed_payload.get("cards") if isinstance(feed_payload, dict) else None
    if not isinstance(cards, list):
        raise ValueError("feed cards not found")

    updated_base = _apply_timeline_fields_to_cards(
        cards,
        card_id=card_id,
        timeline_date=start_date,
        timeline_end_date=end_date,
    )
    if updated_base <= 0:
        raise ValueError("card not found")

    feed_payload["cards"] = cards
    write_json(feed_path, feed_payload)

    i18n_bundle_path = data_dir() / "x_intel_feed_i18n.json"
    i18n_updated = 0
    i18n_payload = read_json(i18n_bundle_path, {})
    i18n_changed = False
    if isinstance(i18n_payload, dict):
        root_cards = i18n_payload.get("cards")
        if isinstance(root_cards, list):
            count = _apply_timeline_fields_to_cards(
                root_cards,
                card_id=card_id,
                timeline_date=start_date,
                timeline_end_date=end_date,
            )
            if count:
                i18n_updated += count
                i18n_changed = True
        langs = i18n_payload.get("langs")
        if isinstance(langs, dict):
            for lang_row in langs.values():
                if not isinstance(lang_row, dict):
                    continue
                lang_cards = lang_row.get("cards")
                if not isinstance(lang_cards, list):
                    continue
                count = _apply_timeline_fields_to_cards(
                    lang_cards,
                    card_id=card_id,
                    timeline_date=start_date,
                    timeline_end_date=end_date,
                )
                if count:
                    i18n_updated += count
                    i18n_changed = True
        if i18n_changed:
            write_json(i18n_bundle_path, i18n_payload)

    return {
        "id": card_id,
        "timeline_date": start_date,
        "timeline_end_date": end_date,
        "updated_cards": updated_base,
        "updated_i18n_cards": i18n_updated,
    }


def update_card_event_wall_field(
    tweet_id: str,
    *,
    event_wall: Any,
) -> dict[str, Any]:
    card_id = str(tweet_id or "").strip()
    if not card_id:
        raise ValueError("tweet id is required")

    wall = _normalize_event_wall_edit_value(event_wall)

    feed_path = data_dir() / "x_intel_feed.json"
    feed_payload = read_json(feed_path, {})
    cards = feed_payload.get("cards") if isinstance(feed_payload, dict) else None
    if not isinstance(cards, list):
        raise ValueError("feed cards not found")

    updated_base = _apply_event_wall_field_to_cards(
        cards,
        card_id=card_id,
        event_wall=wall,
    )
    if updated_base <= 0:
        raise ValueError("card not found")

    feed_payload["cards"] = cards
    write_json(feed_path, feed_payload)

    i18n_bundle_path = data_dir() / "x_intel_feed_i18n.json"
    i18n_updated = 0
    i18n_payload = read_json(i18n_bundle_path, {})
    i18n_changed = False
    if isinstance(i18n_payload, dict):
        root_cards = i18n_payload.get("cards")
        if isinstance(root_cards, list):
            count = _apply_event_wall_field_to_cards(
                root_cards,
                card_id=card_id,
                event_wall=wall,
            )
            if count:
                i18n_updated += count
                i18n_changed = True
        langs = i18n_payload.get("langs")
        if isinstance(langs, dict):
            for lang_row in langs.values():
                if not isinstance(lang_row, dict):
                    continue
                lang_cards = lang_row.get("cards")
                if not isinstance(lang_cards, list):
                    continue
                count = _apply_event_wall_field_to_cards(
                    lang_cards,
                    card_id=card_id,
                    event_wall=wall,
                )
                if count:
                    i18n_updated += count
                    i18n_changed = True
        if i18n_changed:
            write_json(i18n_bundle_path, i18n_payload)

    return {
        "id": card_id,
        "event_wall": wall,
        "updated_cards": updated_base,
        "updated_i18n_cards": i18n_updated,
    }


def merge_cards(*groups: list[StoryCard]) -> list[StoryCard]:
    merged: dict[str, StoryCard] = {}
    for group in groups:
        for card in group:
            merged[card.id] = card
    return sorted(merged.values(), key=lambda c: c.published_at, reverse=True)


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


AI_DEDUPE_TITLE_SIM_THRESHOLD = float(os.getenv("INTEL_DEDUPE_TITLE_SIM_THRESHOLD", "0.62") or 0.62)
AI_DEDUPE_DATE_WINDOW_DAYS = int(os.getenv("INTEL_DEDUPE_DATE_WINDOW_DAYS", "1") or 1)
DEDUPE_VERSION = "title_glance_incremental_v1"


def _card_reference_date(card: StoryCard) -> date | None:
    dt = _parse_iso_safe(str(card.timeline_date or "")) or _parse_iso_safe(str(card.published_at or ""))
    if dt:
        return dt.date()
    ymd = (_event_date_hint(card) or "").strip()
    if ymd:
        try:
            return date.fromisoformat(ymd)
        except Exception:
            return None
    return None


def _date_distance_within(a: date | None, b: date | None, days: int) -> bool:
    if a is None or b is None:
        # Keep title-similar pairs as candidates even when one side lacks explicit date.
        return True
    return abs((a - b).days) <= max(0, int(days))


def _dedupe_seed_text(card: StoryCard) -> str:
    title = clean_text(str(card.title or ""))
    glance = clean_text(str(card.glance or card.summary or ""))
    if title and glance and glance != title:
        return f"{title} {glance}"
    return title or glance


def _dedupe_seed_similarity(a: StoryCard, b: StoryCard) -> float:
    seed_a = _dedupe_seed_text(a)
    seed_b = _dedupe_seed_text(b)
    if not seed_a or not seed_b:
        return 0.0
    sim_text = similarity_ratio(seed_a, seed_b)
    key_a = dedupe_key(seed_a)
    key_b = dedupe_key(seed_b)
    sim_key = similarity_ratio(key_a, key_b) if key_a and key_b else 0.0
    return max(sim_text, sim_key)


def _is_ai_dedupe_pair_candidate(a: StoryCard, b: StoryCard, *, strict_title: bool = True) -> bool:
    if str(a.id or "").strip() == str(b.id or "").strip():
        return False
    if str(a.card_type or "").strip().lower() != str(b.card_type or "").strip().lower():
        return False
    if not _date_distance_within(
        _card_reference_date(a),
        _card_reference_date(b),
        AI_DEDUPE_DATE_WINDOW_DAYS,
    ):
        return False
    if not strict_title:
        return True
    return _dedupe_seed_similarity(a, b) >= AI_DEDUPE_TITLE_SIM_THRESHOLD


def _collect_ai_dedupe_candidate_ids(cards: list[StoryCard], target_ids: set[str] | None = None) -> set[str]:
    candidate_ids: set[str] = set()
    id_map = {str(c.id or "").strip(): c for c in cards if str(c.id or "").strip()}
    target = {x for x in (target_ids or set()) if x in id_map}
    if target:
        for target_id in sorted(target):
            a = id_map[target_id]
            for b_id, b in id_map.items():
                if b_id == target_id:
                    continue
                # Incremental mode: broaden candidates by type/date, then let AI decide
                # by title + glance semantics.
                if _is_ai_dedupe_pair_candidate(a, b, strict_title=False):
                    candidate_ids.add(target_id)
                    candidate_ids.add(b_id)
        return candidate_ids

    n = len(cards)
    for i in range(n):
        a = cards[i]
        for j in range(i + 1, n):
            b = cards[j]
            if _is_ai_dedupe_pair_candidate(a, b, strict_title=True):
                a_id = str(a.id or "").strip()
                b_id = str(b.id or "").strip()
                if a_id:
                    candidate_ids.add(a_id)
                if b_id:
                    candidate_ids.add(b_id)
    return candidate_ids


def _dedupe_detail_features(card: StoryCard) -> list[str]:
    facts = normalize_event_facts(card.event_facts)
    flags: list[str] = []
    if card.cover_image:
        flags.append("圖片")
    if card.timeline_date:
        flags.append("時間")
    if facts.get("location"):
        flags.append("地點")
    if facts.get("schedule"):
        flags.append("時程")
    if facts.get("participation"):
        flags.append("參與方式")
    if facts.get("reward"):
        flags.append("獎勵")
    if clean_text(card.summary or ""):
        flags.append("摘要")
    if any(clean_text(str(x or "")) for x in (card.bullets or [])):
        flags.append("重點條列")
    return flags


def _dedupe_detail_score(card: StoryCard) -> int:
    return len(_dedupe_detail_features(card))


def _is_future_alpha_card(card: StoryCard) -> bool:
    labels = normalize_topic_labels(card.topic_labels)
    timeline_dt = _parse_iso_safe(str(card.timeline_date or ""))
    if timeline_dt:
        now_date = datetime.now(timezone.utc).date()
        if timeline_dt.date() >= now_date:
            return True
    blob = clean_text(" ".join(
        [
            str(card.title or ""),
            str(card.summary or ""),
            str(card.raw_text or ""),
            " ".join(str(x) for x in normalize_event_facts(card.event_facts).values()),
        ]
    ))
    if blob:
        future_re = re.compile(
            r"(即將|將於|預計|预计|soon|upcoming|on the way|targeted|next round|next phase|coming soon|launch(?:ing)? soon|release(?:ing)? soon)",
            re.I,
        )
        live_re = re.compile(
            r"(now live|is now live|already live|you can now|已上線|已开放|已開放|已發布|現已可用)",
            re.I,
        )
        if future_re.search(blob) and not (live_re.search(blob) and not future_re.search(blob)):
            return True
    return "alpha" in labels


def _is_official_update_card(card: StoryCard) -> bool:
    labels = normalize_topic_labels(card.topic_labels)
    account = str(card.account or "").strip().lower().lstrip("@")
    return account.startswith("renaiss") or "official" in labels


def _is_dedupe_protected_card(card: StoryCard) -> bool:
    return _is_official_update_card(card)


def _build_rank_cutoff_drop_record(
    loser: StoryCard,
    *,
    kept_cards: list[StoryCard],
    reason_code: str,
    max_cards: int,
) -> dict[str, Any]:
    if not kept_cards:
        return _dedupe_drop_record(
            loser,
            reason_code=reason_code,
            reason=f"排序名額淘汰（上限 {int(max_cards)}）：未進入本輪保留清單。",
        )
    loser_blob = f"{str(loser.title or '')} {str(loser.summary or '')} {str(loser.raw_text or '')}"
    best_winner: StoryCard | None = None
    best_sim = -1.0
    best_rank = (-1.0, -1, -1.0, datetime.min.replace(tzinfo=timezone.utc))
    for winner in kept_cards:
        winner_blob = f"{str(winner.title or '')} {str(winner.summary or '')} {str(winner.raw_text or '')}"
        sim = max(
            similarity_ratio(str(loser.title or ""), str(winner.title or "")),
            similarity_ratio(loser_blob, winner_blob),
        )
        rank = (
            float(sim),
            int(_dedupe_detail_score(winner)),
            float(_card_quality_score(winner)),
            _parse_iso_safe(str(winner.published_at or "")) or datetime.min.replace(tzinfo=timezone.utc),
        )
        if rank > best_rank:
            best_rank = rank
            best_winner = winner
            best_sim = sim
    if best_winner is None:
        floor = min((_card_quality_score(x) for x in kept_cards), default=0.0)
        reason = (
            f"排序名額淘汰（上限 {int(max_cards)}）：入選下限品質分 {floor:.2f}，"
            f"本貼文品質分 {float(_card_quality_score(loser)):.2f}。"
        )
        return _dedupe_drop_record(loser, reason_code=reason_code, reason=reason)
    winner_detail = _dedupe_detail_features(best_winner)
    loser_detail = _dedupe_detail_features(loser)
    winner_detail_txt = "、".join(winner_detail) if winner_detail else "無"
    loser_detail_txt = "、".join(loser_detail) if loser_detail else "無"
    winner_q = float(_card_quality_score(best_winner))
    loser_q = float(_card_quality_score(loser))
    winner_d = int(_dedupe_detail_score(best_winner))
    loser_d = int(_dedupe_detail_score(loser))
    reason = (
        f"排序名額淘汰（上限 {int(max_cards)}）：與保留貼文高度相近（sim={best_sim:.2f}）。"
        f"保留方完整度 {winner_d} > 淘汰方 {loser_d}（保留：{winner_detail_txt}；淘汰：{loser_detail_txt}），"
        f"品質分 {winner_q:.2f} > {loser_q:.2f}。"
    )
    return _dedupe_drop_record(
        loser,
        reason_code=reason_code,
        reason=reason,
        winner=best_winner,
    )


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


def _dedupe_drop_record(
    loser: StoryCard,
    *,
    reason_code: str,
    reason: str,
    winner: StoryCard | None = None,
) -> dict[str, Any]:
    return {
        "id": str(loser.id or ""),
        "url": str(loser.url or ""),
        "title": str(loser.title or ""),
        "account": str(loser.account or ""),
        "published_at": str(loser.published_at or ""),
        "stage": "dedupe_dropped",
        "reason_code": str(reason_code or "").strip(),
        "reason": str(reason or "").strip(),
        "winner_post_id": str(winner.id or "") if winner else "",
        "winner_url": str(winner.url or "") if winner else "",
        "winner_title": str(winner.title or "") if winner else "",
    }


def drop_discord_event_duplicates_preferring_x(
    cards: list[StoryCard],
    force_include_ids: set[str] | None = None,
    dropped_logs: list[dict[str, Any]] | None = None,
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
        if _is_dedupe_protected_card(card):
            kept.append(card)
            continue
        if card.id in force_ids or card.manual_pick:
            kept.append(card)
            continue

        card_date = _event_date_hint(card)
        topic_self = dedupe_key(infer_topic_phrase(card.raw_text or card.title, card.card_type) or card.title)
        blob_self = f"{card.title} {card.summary}"
        duplicate_winner: StoryCard | None = None
        duplicate_reason = ""

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
                duplicate_winner = x_card
                duplicate_reason = (
                    f"Discord 活動貼文與 X 貼文高度重複（sim={text_sim:.2f}, same_date={'yes' if same_date else 'no'}）"
                )
                break

        if duplicate_winner is not None:
            removed += 1
            if isinstance(dropped_logs, list):
                dropped_logs.append(
                    _dedupe_drop_record(
                        card,
                        reason_code="discord_event_prefers_x",
                        reason=duplicate_reason or "Discord 活動貼文被 X 來源同事件貼文取代。",
                        winner=duplicate_winner,
                    )
                )
            continue
        kept.append(card)

    return kept, removed


def drop_redundant_cards_local(
    cards: list[StoryCard],
    force_include_ids: set[str] | None = None,
    target_drop_ids: set[str] | None = None,
    dropped_logs: list[dict[str, Any]] | None = None,
) -> tuple[list[StoryCard], int]:
    force_ids = set(force_include_ids or set())
    target_ids = {str(x or "").strip() for x in (target_drop_ids or set()) if str(x or "").strip()}
    picked_by_sig: dict[str, StoryCard] = {}
    passthrough: list[StoryCard] = []
    removed = 0

    for card in cards:
        if card.id in force_ids or card.manual_pick:
            passthrough.append(card)
            continue
        if _is_dedupe_protected_card(card):
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
        if target_ids:
            prev_target = str(prev.id or "").strip() in target_ids
            now_target = str(card.id or "").strip() in target_ids
            if (not prev_target) and (not now_target):
                passthrough.append(card)
                continue
            if prev_target and not now_target:
                if isinstance(dropped_logs, list):
                    dropped_logs.append(
                        _dedupe_drop_record(
                            prev,
                            reason_code="local_signature_dedupe",
                            reason="本地去重：新增卡與舊卡同簽名，保留既有卡片。",
                            winner=card,
                        )
                    )
                picked_by_sig[sig] = card
                removed += 1
                continue
            if now_target and not prev_target:
                if isinstance(dropped_logs, list):
                    dropped_logs.append(
                        _dedupe_drop_record(
                            card,
                            reason_code="local_signature_dedupe",
                            reason="本地去重：新增卡與既有卡同簽名，保留既有卡片。",
                            winner=prev,
                        )
                    )
                removed += 1
                continue
        prev_score = _card_quality_score(prev)
        now_score = _card_quality_score(card)
        if now_score > prev_score:
            if isinstance(dropped_logs, list):
                dropped_logs.append(
                    _dedupe_drop_record(
                        prev,
                        reason_code="local_signature_dedupe",
                        reason=f"本地去重：同簽名比對後保留品質分較高卡片（winner_score={now_score:.2f}, loser_score={prev_score:.2f}）。",
                        winner=card,
                    )
                )
            picked_by_sig[sig] = card
            removed += 1
        else:
            if isinstance(dropped_logs, list):
                dropped_logs.append(
                    _dedupe_drop_record(
                        card,
                        reason_code="local_signature_dedupe",
                        reason=f"本地去重：同簽名比對後保留品質分較高卡片（winner_score={prev_score:.2f}, loser_score={now_score:.2f}）。",
                        winner=prev,
                    )
                )
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
    target_drop_ids: set[str] | None = None,
    dropped_logs: list[dict[str, Any]] | None = None,
) -> tuple[list[StoryCard], int]:
    if not cards:
        return cards, 0
    force_ids = set(force_include_ids or set())
    target_ids = {str(x or "").strip() for x in (target_drop_ids or set()) if str(x or "").strip()}
    if target_ids:
        target_ids = {x for x in target_ids if any(str(c.id or "").strip() == x for c in cards)}
        if not target_ids:
            return cards, 0
    protected_ids = {str(c.id or "").strip() for c in cards if str(c.id or "").strip() and _is_dedupe_protected_card(c)}
    candidate_ids = _collect_ai_dedupe_candidate_ids(cards, target_ids=target_ids)
    if len(candidate_ids) < 2:
        return cards, 0
    ai_cards = [c for c in cards if str(c.id or "").strip() in candidate_ids]
    if len(ai_cards) < 2:
        return cards, 0
    payload_rows: list[dict[str, Any]] = []
    for c in ai_cards:
        facts = normalize_event_facts(c.event_facts)
        payload_rows.append(
            {
                "id": c.id,
                "account": c.account,
                "type": c.card_type,
                "title": compact_point(c.title or "", 96),
                "glance": compact_point(c.glance or c.summary or "", 120),
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
        "請先以標題(title)與一句話重點(glance)做初步篩選，再判斷哪些是同一事件/同一更新的重複貼文，只輸出應該刪掉的 id。"
        "規則："
        "1) 同主題、同日期（或同場次）且內容高度重疊，跨帳號也可視為重複；"
        "2) 優先保留資訊更完整者（有時間/地點/獎勵/參與方式/圖片）；完整度相近時再優先官方來源；"
        "3) 不要刪掉跨主題卡片；"
        "4) 不可捏造。"
        "輸出 JSON：{\"drop_ids\":[...],\"notes\":[...]}。\n\n"
        f"force_keep_ids: {sorted(force_ids | protected_ids)}\n"
        f"cards: {json.dumps(payload_rows, ensure_ascii=False)}"
    )
    try:
        raw = minimax_chat(prompt, api_key)
        parsed = parse_json_block(raw) or {}
        drop_ids_raw = parsed.get("drop_ids")
        if not isinstance(drop_ids_raw, list):
            return cards, 0
        known = {c.id for c in ai_cards}
        drop_ids = {str(x).strip() for x in drop_ids_raw if str(x).strip() in known}
        drop_ids = {x for x in drop_ids if x not in force_ids and x not in protected_ids}
        if target_ids:
            drop_ids = {x for x in drop_ids if x in target_ids}
        if not drop_ids:
            return cards, 0
        out = [c for c in cards if c.id not in drop_ids]
        if len(out) < max(5, len(cards) // 2):
            return cards, 0
        if isinstance(dropped_logs, list):
            kept_by_sig: dict[str, StoryCard] = {}
            for c in out:
                sig = _dedupe_signature(c)
                if sig and sig not in kept_by_sig:
                    kept_by_sig[sig] = c
            for c in cards:
                if c.id not in drop_ids:
                    continue
                winner = kept_by_sig.get(_dedupe_signature(c))
                dropped_logs.append(
                    _dedupe_drop_record(
                        c,
                        reason_code="ai_global_dedupe",
                        reason="AI 全局去重判定為重複更新。",
                        winner=winner,
                    )
                )
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
    official = [c for c in cards if c.account.lower().startswith("renaiss")]
    community = [c for c in cards if not c.account.lower().startswith("renaiss")]
    official.sort(key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance), reverse=True)
    community.sort(key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance), reverse=True)
    official_cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    official_recent = [
        c for c in official
        if (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc)) >= official_cutoff
    ]

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
            official_recent,
            len(official_recent),
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


def build_feed_payload(cards: list[StoryCard], digest: dict[str, Any], window_days: int, accounts: list[str]) -> dict[str, Any]:
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
            "trend": sum(1 for c in cards if c.layout == "trend"),
        },
        "digest": digest,
        "cards": [c.to_dict() for c in cards],
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
            "id": "collectibles_trend",
            "name": "收藏趨勢型",
            "for": "收藏品新聞、拍賣、評級、IP 熱度",
            "blocks": ["趨勢重點", "數據線索", "影響方向", "後續追蹤"],
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


def _emit_sync_progress(progress_hook: Any, event: str, **payload: Any) -> None:
    if not callable(progress_hook):
        return
    try:
        progress_hook({"event": str(event or "").strip(), **payload})
    except Exception:
        return


def _card_progress_item(card: StoryCard) -> dict[str, Any]:
    return {
        "id": str(card.id or ""),
        "url": str(card.url or ""),
        "title": str(card.title or ""),
        "account": str(card.account or ""),
        "published_at": str(card.published_at or ""),
    }


def _story_card_from_saved_row(row: dict[str, Any], fallback: StoryCard | None = None) -> StoryCard | None:
    if not isinstance(row, dict):
        return None
    card_id = str(row.get("id") or "").strip()
    if not card_id:
        return None
    try:
        card = StoryCard(
            id=card_id,
            account=str(row.get("account") or (fallback.account if fallback else "")).strip(),
            url=str(row.get("url") or (fallback.url if fallback else "")).strip(),
            title=str(row.get("title") or (fallback.title if fallback else "")).strip(),
            summary=str(row.get("summary") or (fallback.summary if fallback else "")).strip(),
            bullets=[
                str(x).strip()
                for x in (row.get("bullets") if isinstance(row.get("bullets"), list) else (fallback.bullets if fallback else []))
                if str(x).strip()
            ][:3],
            published_at=str(row.get("published_at") or (fallback.published_at if fallback else "")).strip(),
            confidence=float(row.get("confidence") or (fallback.confidence if fallback else 0.55)),
            card_type=str(row.get("card_type") or (fallback.card_type if fallback else "insight")).strip(),
            layout=str(row.get("layout") or (fallback.layout if fallback else "brief")).strip(),
            tags=[
                str(x).strip()
                for x in (row.get("tags") if isinstance(row.get("tags"), list) else (fallback.tags if fallback else []))
                if str(x).strip()
            ][:3],
            raw_text=str(row.get("raw_text") or (fallback.raw_text if fallback else "")).strip(),
            provider=str(row.get("provider") or (fallback.provider if fallback else "r.jina.ai")).strip() or "r.jina.ai",
            cover_image=str(row.get("cover_image") or (fallback.cover_image if fallback else "")).strip(),
            metrics=row.get("metrics") if isinstance(row.get("metrics"), dict) else (fallback.metrics if fallback else {}),
            importance=float(row.get("importance") or (fallback.importance if fallback else 0.0)),
            template_id=str(row.get("template_id") or (fallback.template_id if fallback else "community_brief")).strip() or "community_brief",
            glance=str(row.get("glance") or (fallback.glance if fallback else "")).strip(),
            timeline_date=str(row.get("timeline_date") or (fallback.timeline_date if fallback else "")).strip(),
            timeline_end_date=str(row.get("timeline_end_date") or (fallback.timeline_end_date if fallback else "")).strip(),
            event_wall=(
                row.get("event_wall")
                if isinstance(row.get("event_wall"), bool)
                else (fallback.event_wall if fallback and isinstance(fallback.event_wall, bool) else None)
            ),
            urgency=str(row.get("urgency") or (fallback.urgency if fallback else "normal")).strip() or "normal",
            manual_pick=bool(row.get("manual_pick") if row.get("manual_pick") is not None else (fallback.manual_pick if fallback else False)),
            manual_pin=bool(row.get("manual_pin") if row.get("manual_pin") is not None else (fallback.manual_pin if fallback else False)),
            manual_bottom=bool(row.get("manual_bottom") if row.get("manual_bottom") is not None else (fallback.manual_bottom if fallback else False)),
            event_facts=normalize_event_facts(row.get("event_facts")),
            topic_labels=normalize_topic_labels(row.get("topic_labels")),
            detail_summary=str(row.get("detail_summary") or (fallback.detail_summary if fallback else "")).strip(),
            detail_lines=normalize_detail_lines(row.get("detail_lines"), limit=6),
            sbt_name=str(row.get("sbt_name") or (fallback.sbt_name if fallback else "")).strip(),
            sbt_names=normalize_sbt_names(row.get("sbt_names") if row.get("sbt_names") is not None else (fallback.sbt_names if fallback else row.get("sbt_name"))),
            sbt_acquisition=str(row.get("sbt_acquisition") or (fallback.sbt_acquisition if fallback else "")).strip(),
            reply_to_id=str(row.get("reply_to_id") or (fallback.reply_to_id if fallback else "")).strip(),
        )
    except Exception:
        return None
    if not card.summary and fallback:
        card.summary = fallback.summary
    if (not card.bullets) and fallback:
        card.bullets = list(fallback.bullets or [])
    if not card.raw_text and fallback:
        card.raw_text = fallback.raw_text
    return card


def _story_card_source_identity(card: StoryCard) -> tuple[str, str, str]:
    return (
        str(card.account or "").strip().lower(),
        str(card.url or "").strip(),
        str(card.published_at or "").strip(),
    )


def _saved_card_source_identity(row: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(row.get("account") or "").strip().lower(),
        str(row.get("url") or "").strip(),
        str(row.get("published_at") or "").strip(),
    )


def _retention_reference_datetime(card: StoryCard) -> datetime | None:
    return (
        _parse_iso_safe(str(card.timeline_end_date or ""))
        or _parse_iso_safe(str(card.timeline_date or ""))
        or _parse_iso_safe(str(card.published_at or ""))
    )


def _is_within_feed_retention_window(card: StoryCard, now_dt: datetime, days: int = 14) -> bool:
    ref = _retention_reference_datetime(card)
    if not ref:
        return True
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    return (now_dt - timedelta(days=days)) <= ref <= (now_dt + timedelta(days=days))


def _is_saved_card_reusable(row: dict[str, Any]) -> bool:
    if not isinstance(row, dict):
        return False
    summary = clean_text(str(row.get("summary") or "")).strip()
    bullets = [clean_text(str(x)).strip() for x in (row.get("bullets") or []) if clean_text(str(x)).strip()]
    card_type = str(row.get("card_type") or "").strip().lower()
    layout = str(row.get("layout") or "").strip().lower()
    return bool(summary and bullets and card_type and layout)


_PRESERVE_STRING_FIELDS = (
    "title",
    "summary",
    "glance",
    "detail_summary",
    "sbt_name",
    "sbt_acquisition",
    "raw_text",
    "cover_image",
    "timeline_date",
    "timeline_end_date",
    "published_at",
    "card_type",
    "layout",
    "template_id",
    "urgency",
    "account",
    "url",
    "provider",
    "reply_to_id",
)
_PRESERVE_LIST_FIELDS = (
    "bullets",
    "tags",
    "detail_lines",
    "topic_labels",
    "sbt_names",
)
_PRESERVE_DICT_FIELDS = (
    "event_facts",
    "metrics",
)
_PRESERVE_BOOL_FIELDS = (
    "event_wall",
)

_EVENT_WALL_CARD_TYPES = {"event", "announcement"}


def _default_event_wall_value(row: dict[str, Any]) -> bool:
    if not isinstance(row, dict):
        return False
    card_type = str(row.get("card_type") or "").strip().lower()
    if card_type not in _EVENT_WALL_CARD_TYPES:
        return False
    return bool(
        _parse_iso_safe(str(row.get("timeline_end_date") or ""))
        or _parse_iso_safe(str(row.get("timeline_date") or ""))
    )


def _is_blank_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _clone_preserved_value(value: Any) -> Any:
    if isinstance(value, list):
        return list(value)
    if isinstance(value, dict):
        return dict(value)
    return value


def _preserve_existing_nonempty_card_fields(
    cards: list[dict[str, Any]],
    existing_map: dict[str, dict[str, Any]],
    card_field_overrides: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Never overwrite previously written card fields with blank values."""
    override_map = card_field_overrides if isinstance(card_field_overrides, dict) else {}
    merged_rows: list[dict[str, Any]] = []
    for row in cards:
        if not isinstance(row, dict):
            continue
        cur = dict(row)
        card_id = str(cur.get("id") or "").strip()
        prev = existing_map.get(card_id) if card_id else None
        if isinstance(prev, dict):
            for key in _PRESERVE_STRING_FIELDS:
                if _is_blank_value(cur.get(key)) and not _is_blank_value(prev.get(key)):
                    cur[key] = prev.get(key)
            for key in _PRESERVE_LIST_FIELDS:
                if _is_blank_value(cur.get(key)) and not _is_blank_value(prev.get(key)):
                    prior = prev.get(key)
                    if isinstance(prior, list):
                        cur[key] = list(prior)
            for key in _PRESERVE_DICT_FIELDS:
                if _is_blank_value(cur.get(key)) and not _is_blank_value(prev.get(key)):
                    prior = prev.get(key)
                    if isinstance(prior, dict):
                        cur[key] = dict(prior)
            for key in _PRESERVE_BOOL_FIELDS:
                if cur.get(key) is None and isinstance(prev.get(key), bool):
                    cur[key] = bool(prev.get(key))
            # Future-proof preservation:
            # if an old field exists but the new mapping omitted it,
            # carry it forward so scheduled sync will not silently drop it.
            for key, prior in prev.items():
                if key in cur:
                    continue
                if _is_blank_value(prior):
                    continue
                if isinstance(prior, (str, int, float, bool, list, dict)):
                    cur[key] = _clone_preserved_value(prior)
        override = override_map.get(card_id) if card_id else None
        if isinstance(override, dict):
            names = normalize_sbt_names(
                override.get("sbt_names") if override.get("sbt_names") is not None else override.get("sbt_name")
            )
            acquisition = clean_text(str(override.get("sbt_acquisition") or "")).strip()[:260]
            cur["sbt_names"] = list(names)
            cur["sbt_name"] = names[0] if names else ""
            cur["sbt_acquisition"] = acquisition
            if names or acquisition:
                labels = normalize_topic_labels(cur.get("topic_labels"))
                if "sbt" not in labels:
                    labels.append("sbt")
                cur["topic_labels"] = labels
        if not isinstance(cur.get("event_wall"), bool):
            cur["event_wall"] = _default_event_wall_value(cur)
        merged_rows.append(cur)
    return merged_rows


def sync_accounts(
    accounts: list[str] | None = None,
    window_days: int = DEFAULT_WINDOW_DAYS,
    max_posts_per_account: int = DEFAULT_MAX_POSTS_PER_ACCOUNT,
    progress_hook: Any = None,
) -> dict[str, Any]:
    load_environment()
    api_key = resolve_minimax_key()
    twitter_cli_ready = bool(shutil_which("twitter"))

    target_accounts = accounts or DEFAULT_ACCOUNTS
    since_dt = datetime.now(timezone.utc) - timedelta(days=window_days)
    lifecycle_rows: dict[str, dict[str, Any]] = {}
    lifecycle_order: list[str] = []

    def _lifecycle_key(row: dict[str, Any]) -> str:
        card_id = str(row.get("id") or "").strip()
        if card_id:
            return f"id:{card_id}"
        card_url = str(row.get("url") or "").strip()
        if card_url:
            return f"url:{card_url}"
        fallback = f"{str(row.get('account') or '').strip().lower()}|{str(row.get('published_at') or '').strip()}|{str(row.get('title') or '').strip()}"
        return fallback

    def _upsert_lifecycle(row: dict[str, Any], *, stage: str, reason_code: str = "", reason: str = "", winner_post_id: str = "", winner_url: str = "", winner_title: str = "") -> None:
        key = _lifecycle_key(row)
        if not key:
            return
        current = lifecycle_rows.get(key, {})
        merged = {
            "id": str(row.get("id") or current.get("id") or ""),
            "url": str(row.get("url") or current.get("url") or ""),
            "title": str(row.get("title") or current.get("title") or ""),
            "account": str(row.get("account") or current.get("account") or ""),
            "published_at": str(row.get("published_at") or current.get("published_at") or ""),
            "scan": str(current.get("scan") or "pending"),
            "curation": str(current.get("curation") or "pending"),
            "translation": str(current.get("translation") or "pending"),
            "stage": str(current.get("stage") or ""),
            "reason_code": str(current.get("reason_code") or ""),
            "reason": str(current.get("reason") or ""),
            "winner_post_id": str(current.get("winner_post_id") or ""),
            "winner_url": str(current.get("winner_url") or ""),
            "winner_title": str(current.get("winner_title") or ""),
            "dedupe_status": str(current.get("dedupe_status") or "pending"),
            "dedupe_checked_at": str(current.get("dedupe_checked_at") or ""),
            "dedupe_version": str(current.get("dedupe_version") or DEDUPE_VERSION),
        }
        stage_norm = str(stage or "").strip().lower()
        if stage_norm == "scanned":
            merged["scan"] = "done"
            merged["curation"] = "pending"
            merged["translation"] = "pending"
            merged["dedupe_status"] = "pending"
            merged["dedupe_checked_at"] = ""
        elif stage_norm == "analyzing":
            merged["scan"] = "done"
            merged["curation"] = "running"
            merged["translation"] = "pending"
            merged["dedupe_status"] = "pending"
            merged["dedupe_checked_at"] = ""
        elif stage_norm == "dedupe_dropped":
            merged["scan"] = "done"
            merged["curation"] = "done"
            merged["translation"] = "idle"
            merged["dedupe_status"] = "dropped"
            merged["dedupe_checked_at"] = datetime.now(timezone.utc).isoformat()
            merged["dedupe_version"] = DEDUPE_VERSION
        elif stage_norm == "selected":
            merged["scan"] = "done"
            merged["curation"] = "done"
            merged["translation"] = "pending"
            merged["dedupe_status"] = "kept"
            merged["dedupe_checked_at"] = datetime.now(timezone.utc).isoformat()
            merged["dedupe_version"] = DEDUPE_VERSION
        elif stage_norm == "failed":
            merged["scan"] = "done"
            merged["curation"] = "failed"
            merged["translation"] = "failed"
        merged["stage"] = stage_norm
        if reason_code:
            merged["reason_code"] = str(reason_code).strip()
        if reason:
            merged["reason"] = str(reason).strip()
        if winner_post_id or winner_url or winner_title:
            merged["winner_post_id"] = str(winner_post_id or "").strip()
            merged["winner_url"] = str(winner_url or "").strip()
            merged["winner_title"] = str(winner_title or "").strip()
        if stage_norm in {"selected", "scanned", "analyzing"}:
            merged["reason_code"] = ""
            merged["reason"] = ""
            merged["winner_post_id"] = ""
            merged["winner_url"] = ""
            merged["winner_title"] = ""
        lifecycle_rows[key] = merged
        if key not in lifecycle_order:
            lifecycle_order.append(key)

    def _apply_dropped_logs(rows: list[dict[str, Any]]) -> None:
        for dropped in rows:
            if not isinstance(dropped, dict):
                continue
            _upsert_lifecycle(
                dropped,
                stage="dedupe_dropped",
                reason_code=str(dropped.get("reason_code") or "").strip(),
                reason=str(dropped.get("reason") or "").strip(),
                winner_post_id=str(dropped.get("winner_post_id") or "").strip(),
                winner_url=str(dropped.get("winner_url") or "").strip(),
                winner_title=str(dropped.get("winner_title") or "").strip(),
            )

    def _emit_lifecycle_progress() -> None:
        rows = [lifecycle_rows.get(key, {}) for key in lifecycle_order if isinstance(lifecycle_rows.get(key), dict)]
        _emit_sync_progress(
            progress_hook,
            "lifecycle_update",
            rows=rows[:180],
        )

    account_cards: list[StoryCard] = []
    account_stats: dict[str, int] = {}
    scan_sources = [f"@{str(username).lstrip('@')}" for username in target_accounts]
    _done_sources: list[str] = []
    scanned_cards = 0
    discord_cfg = resolve_discord_monitor_config()
    if discord_cfg.get("enabled"):
        scan_sources.append("Discord monitor")
    _emit_sync_progress(
        progress_hook,
        "scan_start",
        total_sources=len(scan_sources),
        done_sources=0,
        found_cards=0,
        latest_source="",
        latest_source_cards=0,
        done_source_names=[],
        pending_source_names=list(scan_sources),
    )
    account_cards = []
    account_stats = {}
    account_source_errors: list[str] = []
    for username in target_accounts:
        cards: list[StoryCard] = []
        try:
            cards = collect_account_cards(username, since_dt=since_dt, max_posts=max_posts_per_account)
        except Exception as account_error:
            account_source_errors.append(f"@{str(username).lstrip('@')}: {clean_text(str(account_error))[:160]}")
            cards = []
        account_cards.extend(cards)
        account_stats[username] = len(cards)
        scanned_cards += len(cards)
        label = f"@{str(username).lstrip('@')}"
        _done_sources.append(label)
        _emit_sync_progress(
            progress_hook,
            "scan_progress",
            total_sources=len(scan_sources),
            done_sources=len(_done_sources),
            found_cards=scanned_cards,
            latest_source=label,
            latest_source_cards=len(cards),
            done_source_names=list(_done_sources),
            pending_source_names=[x for x in scan_sources if x not in _done_sources],
        )

    discord_cards: list[StoryCard] = []
    discord_stats: dict[str, int] = {}
    discord_errors: list[str] = []
    if discord_cfg.get("enabled"):
        try:
            discord_cards, discord_stats, discord_errors = collect_discord_cards(
                channel_ids=[str(x) for x in discord_cfg.get("channel_ids", []) if str(x).strip()],
                token=str(discord_cfg.get("token") or ""),
                since_dt=since_dt,
                limit_per_channel=int(discord_cfg.get("limit") or DEFAULT_DISCORD_MONITOR_LIMIT),
            )
        except Exception as discord_error:
            err_msg = clean_text(str(discord_error))[:220]
            discord_errors = [err_msg] if err_msg else ["discord collect failed"]
            account_source_errors.append(f"discord: {discord_errors[0]}")
            discord_cards = []
            discord_stats = {}
        for cid, count in discord_stats.items():
            account_stats[f"discord:{cid}"] = int(count)
        scanned_cards += len(discord_cards)
        _done_sources.append("Discord monitor")
        _emit_sync_progress(
            progress_hook,
            "scan_progress",
            total_sources=len(scan_sources),
            done_sources=len(_done_sources),
            found_cards=scanned_cards,
            latest_source="Discord monitor",
            latest_source_cards=len(discord_cards),
            done_source_names=list(_done_sources),
            pending_source_names=[x for x in scan_sources if x not in _done_sources],
        )
    _emit_sync_progress(
        progress_hook,
        "scan_done",
        total_sources=len(scan_sources),
        done_sources=len(_done_sources),
        found_cards=scanned_cards,
        latest_source="",
        latest_source_cards=0,
        done_source_names=list(_done_sources),
        pending_source_names=[x for x in scan_sources if x not in _done_sources],
    )

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
        try:
            manual_cards.append(
                StoryCard(
                    id=str(item.get("id") or ""),
                    account=str(item.get("account") or "manual"),
                    url=str(item.get("url") or ""),
                    title=str(item.get("title") or ""),
                    summary=str(item.get("summary") or ""),
                    bullets=[str(x) for x in item.get("bullets", []) if str(x).strip()][:3],
                    published_at=str(item.get("published_at") or datetime.now(timezone.utc).isoformat()),
                    confidence=float(item.get("confidence") or 0.55),
                    card_type=str(item.get("card_type") or "insight"),
                    layout=str(item.get("layout") or "brief"),
                    tags=[str(x) for x in item.get("tags", []) if str(x).strip()][:3],
                    raw_text=str(item.get("raw_text") or ""),
                    provider=str(item.get("provider") or "manual"),
                    cover_image=str(item.get("cover_image") or ""),
                    metrics=item.get("metrics") if isinstance(item.get("metrics"), dict) else {},
                    importance=float(item.get("importance") or 0.0),
                    template_id=str(item.get("template_id") or "community_brief"),
                    glance=str(item.get("glance") or ""),
                    timeline_date=str(item.get("timeline_date") or ""),
                    urgency=str(item.get("urgency") or "normal"),
                    manual_pick=bool(item.get("manual_pick") or True),
                    manual_pin=bool(item.get("manual_pin") or False),
                    manual_bottom=bool(item.get("manual_bottom") or False),
                    event_facts=normalize_event_facts(item.get("event_facts")),
                    topic_labels=normalize_topic_labels(item.get("topic_labels")),
                    detail_summary=str(item.get("detail_summary") or ""),
                    detail_lines=normalize_detail_lines(item.get("detail_lines"), limit=6),
                    sbt_name=str(item.get("sbt_name") or ""),
                    sbt_names=normalize_sbt_names(item.get("sbt_names") if item.get("sbt_names") is not None else item.get("sbt_name")),
                    sbt_acquisition=str(item.get("sbt_acquisition") or ""),
                    reply_to_id=str(item.get("reply_to_id") or ""),
                )
            )
        except Exception:
            continue

    merged_cards = merge_cards(account_cards, manual_cards, discord_cards)
    merged_total = len(merged_cards)
    normalize_cards_semantics(merged_cards)
    feedback_result = apply_feedback_overrides(merged_cards)
    feedback_excluded_ids = set(feedback_result.get("excluded_ids", set()))
    retention_now = datetime.now(timezone.utc)
    source_cards: list[StoryCard] = []
    removed_by_selection = 0
    removed_by_feedback = 0
    removed_by_retention = 0
    for c in merged_cards:
        c.manual_pin = c.id in pin_ids
        c.manual_bottom = c.id in bottom_ids
        if c.id in include_ids:
            c.manual_pick = True
        if c.manual_pin:
            c.manual_pick = True
        if c.manual_bottom:
            c.manual_pick = True
        if c.id in feedback_excluded_ids and c.id not in force_ids:
            removed_by_feedback += 1
            _upsert_lifecycle(
                _card_progress_item(c),
                stage="dedupe_dropped",
                reason_code="feedback_exclude",
                reason="因管理員回饋規則淘汰。",
            )
            continue
        if c.id in exclude_ids and c.id not in force_ids:
            removed_by_selection += 1
            _upsert_lifecycle(
                _card_progress_item(c),
                stage="dedupe_dropped",
                reason_code="manual_exclude",
                reason="因手動排除規則淘汰。",
            )
            continue
        if c.id not in force_ids and not _is_within_feed_retention_window(c, retention_now):
            removed_by_retention += 1
            _upsert_lifecycle(
                _card_progress_item(c),
                stage="dedupe_dropped",
                reason_code="retention_window_expired",
                reason="超出保留時間窗（今天前後 14 天）而移除。",
            )
            continue
        source_cards.append(c)
    protected_ids = {
        str(card.id or "").strip()
        for card in source_cards
        if str(card.id or "").strip() and _is_dedupe_protected_card(card)
    }
    force_ids |= protected_ids
    existing_payload = read_json(data_dir() / "x_intel_feed.json", {})
    existing_rows_raw = existing_payload.get("cards") if isinstance(existing_payload, dict) else []
    existing_rows = [row for row in existing_rows_raw if isinstance(row, dict)]
    existing_map: dict[str, dict[str, Any]] = {}
    existing_story_cards: list[StoryCard] = []
    for row in existing_rows:
        card_id = str(row.get("id") or "").strip()
        if card_id and card_id not in existing_map:
            existing_map[card_id] = row
        restored = _story_card_from_saved_row(row)
        if restored:
            existing_story_cards.append(restored)
    source_ids = {str(card.id or "").strip() for card in source_cards if str(card.id or "").strip()}
    carried_forward_cards = 0
    preserved_discord_ids: set[str] = set()
    for old_card in existing_story_cards:
        old_id = str(old_card.id or "").strip()
        if not old_id or old_id in source_ids:
            continue
        if old_id in exclude_ids and old_id not in force_ids:
            removed_by_selection += 1
            _upsert_lifecycle(
                _card_progress_item(old_card),
                stage="dedupe_dropped",
                reason_code="manual_exclude",
                reason="因手動排除規則淘汰。",
            )
            continue
        if _is_within_feed_retention_window(old_card, retention_now):
            source_cards.append(old_card)
            source_ids.add(old_id)
            carried_forward_cards += 1
            if discord_errors and _is_discord_source_card(old_card):
                preserved_discord_ids.add(old_id)
    if preserved_discord_ids:
        force_ids |= preserved_discord_ids

    for card in source_cards:
        _upsert_lifecycle(_card_progress_item(card), stage="scanned")
    _emit_lifecycle_progress()
    for card in source_cards:
        _upsert_lifecycle(_card_progress_item(card), stage="analyzing")
    _emit_lifecycle_progress()

    dedupe_drop_logs: list[dict[str, Any]] = []
    source_cards, removed_by_source_pref = drop_discord_event_duplicates_preferring_x(
        source_cards,
        force_include_ids=force_ids,
        dropped_logs=dedupe_drop_logs,
    )
    _apply_dropped_logs(dedupe_drop_logs)
    dedupe_drop_logs = []
    _emit_lifecycle_progress()

    curated_cards = list(source_cards)
    removed_count = 0
    _emit_lifecycle_progress()

    reused_done_items: list[dict[str, Any]] = []
    cards_to_refine: list[StoryCard] = []
    resolved_cards: list[StoryCard] = []
    for card in curated_cards:
        restored: StoryCard | None = None
        prev = existing_map.get(str(card.id or "").strip())
        if isinstance(prev, dict):
            restored = _story_card_from_saved_row(prev, fallback=card)
        if restored:
            # Scheduled sync must not rewrite old cards. Preserve the saved card
            # payload exactly unless the admin explicitly changes manual controls.
            restored.manual_pick = card.manual_pick or restored.manual_pick
            restored.manual_pin = card.manual_pin or restored.manual_pin
            restored.manual_bottom = card.manual_bottom or restored.manual_bottom
            resolved_cards.append(restored)
            reused_done_items.append(_card_progress_item(restored))
        else:
            resolved_cards.append(card)
            cards_to_refine.append(card)
    curated_cards = resolved_cards
    new_card_ids = {str(card.id or "").strip() for card in cards_to_refine if str(card.id or "").strip()}
    curation_total = len(curated_cards)
    reused_count = len(reused_done_items)
    _emit_sync_progress(
        progress_hook,
        "curation_start",
        total_cards=curation_total,
        done_cards=reused_count,
        current_item={},
        done_items=list(reused_done_items),
        pending_items=[_card_progress_item(card) for card in cards_to_refine],
        phase="incremental_reuse",
    )
    feedback_context = feedback_training_text()
    ai_deduped = 0
    local_deduped = 0
    if api_key and curated_cards:
        def _refine_progress(done_count: int, total_count: int, card: StoryCard) -> None:
            total_cards = max(0, int(curation_total or len(curated_cards)))
            done_from_refine = max(0, min(int(total_count or len(cards_to_refine)), int(done_count or 0)))
            done_cards = max(0, min(total_cards, reused_count + done_from_refine))
            done_rows = list(reused_done_items) + [_card_progress_item(x) for x in cards_to_refine[:done_from_refine]]
            pending_rows = [_card_progress_item(x) for x in cards_to_refine[done_from_refine:]]
            _emit_sync_progress(
                progress_hook,
                "curation_progress",
                total_cards=total_cards,
                done_cards=done_cards,
                current_item=_card_progress_item(card),
                done_items=done_rows,
                pending_items=pending_rows,
                phase="ai_refine",
            )

        if cards_to_refine:
            apply_minimax_story_refine(
                cards_to_refine,
                api_key,
                feedback_context=feedback_context,
                progress_cb=_refine_progress,
            )
        _emit_sync_progress(
            progress_hook,
            "curation_progress",
            total_cards=curation_total,
            done_cards=curation_total,
            current_item={"id": "", "url": "", "title": "[AI] 語意正規化中", "account": "", "published_at": ""},
            done_items=[_card_progress_item(card) for card in curated_cards[:curation_total]],
            pending_items=[],
            phase="normalize",
        )
        normalize_cards_semantics(curated_cards, preserve_type=True)
        apply_feedback_overrides(curated_cards)
        normalize_cards_semantics(curated_cards, preserve_type=True)
        _emit_sync_progress(
            progress_hook,
            "curation_progress",
            total_cards=curation_total,
            done_cards=curation_total,
            current_item={"id": "", "url": "", "title": "[AI] 全局去重中", "account": "", "published_at": ""},
            done_items=[_card_progress_item(card) for card in curated_cards[:curation_total]],
            pending_items=[],
            phase="global_dedupe",
        )
        curated_cards, ai_deduped = apply_minimax_global_dedupe(
            curated_cards,
            api_key,
            force_include_ids=force_ids,
            target_drop_ids=new_card_ids,
            dropped_logs=dedupe_drop_logs,
        )
        _apply_dropped_logs(dedupe_drop_logs)
        dedupe_drop_logs = []
        curated_cards, local_deduped = drop_redundant_cards_local(
            curated_cards,
            force_include_ids=force_ids,
            target_drop_ids=new_card_ids,
            dropped_logs=dedupe_drop_logs,
        )
        _apply_dropped_logs(dedupe_drop_logs)
        dedupe_drop_logs = []
        removed_count = 0
    else:
        apply_editorial_fallback(curated_cards)
        curated_cards, local_deduped = drop_redundant_cards_local(
            curated_cards,
            force_include_ids=force_ids,
            target_drop_ids=new_card_ids,
            dropped_logs=dedupe_drop_logs,
        )
        _apply_dropped_logs(dedupe_drop_logs)
        dedupe_drop_logs = []
    _emit_lifecycle_progress()
    curation_total = len(curated_cards)
    finalize_progress = not bool(api_key)
    curation_done_items: list[dict[str, Any]] = []
    reused_ids = {str(item.get("id") or "").strip() for item in reused_done_items if isinstance(item, dict)}
    for idx, card in enumerate(curated_cards, start=1):
        _upsert_lifecycle(_card_progress_item(card), stage="selected")
        if str(card.id or "").strip() in reused_ids:
            curation_done_items.append(_card_progress_item(card))
            continue
        card.manual_pick = card.manual_pick or (card.id in include_ids)
        card.manual_pin = card.id in pin_ids
        card.manual_bottom = card.id in bottom_ids
        card.importance = score_card(card)
        enrich_card_metadata(card)
        enrich_detail_view(card)
        apply_quality_guard(card)
        normalize_card_semantics(card, preserve_type=True)
        card.importance = score_card(card)
        curation_done_items.append(_card_progress_item(card))
        if finalize_progress:
            pending_items = [_card_progress_item(x) for x in curated_cards[idx:]]
            _emit_sync_progress(
                progress_hook,
                "curation_progress",
                total_cards=curation_total,
                done_cards=idx,
                current_item=_card_progress_item(card),
                done_items=list(curation_done_items),
                pending_items=pending_items,
                phase="finalize",
            )
    _emit_sync_progress(
        progress_hook,
        "curation_done",
        total_cards=curation_total,
        done_cards=curation_total,
        current_item={},
        done_items=list(curation_done_items),
        pending_items=[],
    )
    _emit_lifecycle_progress()
    curated_cards.sort(
        key=lambda c: (_parse_iso_safe(c.published_at) or datetime.min.replace(tzinfo=timezone.utc), c.importance),
        reverse=True,
    )
    key_terms = extract_key_terms(curated_cards, top_n=14)
    sections = build_intel_sections(curated_cards)
    agenda = build_intel_agenda(curated_cards)
    digest = aggregate_digest(curated_cards, sections, key_terms, api_key=api_key or None)
    if not api_key:
        event_count = sum(1 for c in curated_cards if c.card_type == "event")
        feature_count = sum(1 for c in curated_cards if c.card_type == "feature")
        announcement_count = sum(1 for c in curated_cards if c.card_type == "announcement")
        trend_count = sum(1 for c in curated_cards if c.card_type == "trend")
        growth_count = len(agenda.get("growth_signals", []))
        future_count = len(agenda.get("future_watch", []))
        digest["headline"] = f"Spring AI 主時間軸：活動 {event_count} / 功能 {feature_count} / 公告 {announcement_count} / 收藏 {trend_count}"
        digest["conclusion"] = (
            f"已整理出活動 {event_count} 件、功能 {feature_count} 件、公告 {announcement_count} 件、收藏趨勢 {trend_count} 件、增長訊號 {growth_count} 件、未來觀察 {future_count} 件，"
            "可直接用於社群公告與行動排程。"
        )
        digest["takeaways"] = [
            "先看主時間軸，把活動與功能安排到行事曆。",
            "活動類優先確認時間、地點與參與方式。",
            "再看「增長訊號」確認社群熱度與市場脈動。",
        ]
    payload = build_feed_payload(curated_cards, digest, window_days, target_accounts)
    payload["raw_total_cards"] = merged_total
    payload["source_total_cards"] = len(source_cards)
    payload["excluded_cards"] = removed_count
    payload["excluded_by_selection"] = removed_by_selection
    payload["excluded_by_feedback"] = removed_by_feedback
    payload["excluded_by_retention"] = removed_by_retention
    payload["excluded_by_source_preference"] = int(removed_by_source_pref)
    payload["key_terms"] = key_terms
    payload["intel_sections"] = sections
    payload["intel_agenda"] = agenda
    payload["official_overview"] = build_official_overview(curated_cards, api_key=api_key or None)
    payload["format_templates"] = default_format_templates()
    payload["template_counts"] = {
        "event_poster": sum(1 for c in curated_cards if c.template_id == "event_poster"),
        "market_signal": sum(1 for c in curated_cards if c.template_id == "market_signal"),
        "collectibles_trend": sum(1 for c in curated_cards if c.template_id == "collectibles_trend"),
        "announcement_timeline": sum(1 for c in curated_cards if c.template_id == "announcement_timeline"),
        "community_brief": sum(1 for c in curated_cards if c.template_id == "community_brief"),
    }
    payload["image_cards"] = sum(1 for c in curated_cards if c.cover_image)
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
        "ai_removed": int(ai_deduped),
        "local_removed": int(local_deduped),
    }
    payload["pipeline_counts"] = {
        "merged_total": int(merged_total),
        "source_total": int(len(source_cards)),
        "curated_total": int(len(curated_cards)),
        "carried_forward": int(carried_forward_cards),
        "removed_by_selection": int(removed_by_selection),
        "removed_by_feedback": int(removed_by_feedback),
        "removed_by_retention": int(removed_by_retention),
        "removed_by_source_preference": int(removed_by_source_pref),
        "removed_by_ai_dedupe": int(ai_deduped),
        "removed_by_local_dedupe": int(local_deduped),
        "removed_by_curation": int(removed_count),
    }
    lifecycle_snapshot = [lifecycle_rows.get(key, {}) for key in lifecycle_order if isinstance(lifecycle_rows.get(key), dict)]
    lifecycle_snapshot.sort(
        key=lambda row: (_parse_iso_safe(str(row.get("published_at") or "")) or datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )
    payload["post_lifecycle"] = lifecycle_snapshot[:180]
    payload["dedupe_decisions"] = [row for row in lifecycle_snapshot if str(row.get("stage") or "") == "dedupe_dropped"][:180]
    payload["source_stats"] = account_stats
    if account_source_errors:
        payload["source_errors"] = account_source_errors[:12]
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
    feedback_state = read_feedback_state()
    card_field_overrides = (
        feedback_state.get("card_field_overrides")
        if isinstance(feedback_state.get("card_field_overrides"), dict)
        else {}
    )
    payload["cards"] = _preserve_existing_nonempty_card_fields(
        payload.get("cards") if isinstance(payload.get("cards"), list) else [],
        existing_map,
        card_field_overrides=card_field_overrides,
    )
    lifecycle_by_id: dict[str, dict[str, Any]] = {}
    lifecycle_by_url: dict[str, dict[str, Any]] = {}
    for row in lifecycle_snapshot:
        if not isinstance(row, dict):
            continue
        rid = str(row.get("id") or "").strip()
        rurl = str(row.get("url") or "").strip()
        if rid:
            lifecycle_by_id[rid] = row
        if rurl:
            lifecycle_by_url[rurl] = row
    cards_payload = payload.get("cards") if isinstance(payload.get("cards"), list) else []
    for row in cards_payload:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id") or "").strip()
        curl = str(row.get("url") or "").strip()
        life = lifecycle_by_id.get(cid) or lifecycle_by_url.get(curl) or {}
        dedupe_status = str(life.get("dedupe_status") or "pending").strip().lower() or "pending"
        dedupe_checked_at = str(life.get("dedupe_checked_at") or "").strip()
        row["dedupe_status"] = dedupe_status
        row["dedupe_checked"] = bool(dedupe_checked_at)
        row["dedupe_checked_at"] = dedupe_checked_at
        row["dedupe_version"] = str(life.get("dedupe_version") or DEDUPE_VERSION).strip() or DEDUPE_VERSION
        row["dedupe_reason_code"] = str(life.get("reason_code") or "").strip()
        row["dedupe_reason"] = str(life.get("reason") or "").strip()
        row["dedupe_winner_post_id"] = str(life.get("winner_post_id") or "").strip()
        row["dedupe_winner_url"] = str(life.get("winner_url") or "").strip()
        row["dedupe_winner_title"] = str(life.get("winner_title") or "").strip()

    write_json(data_dir() / "x_intel_feed.json", payload)
    return payload


def add_manual_tweet(tweet_url: str) -> dict[str, Any]:
    load_environment()
    api_key = resolve_minimax_key() or None

    card = build_card_from_url(tweet_url, api_key=api_key)
    manual_path = data_dir() / "x_intel_manual_entries.json"
    current = read_json(manual_path, [])

    filtered = [item for item in current if str(item.get("id")) != card.id]
    # Manual URL submit should enter normal analysis pipeline first.
    # Do not pre-arrange keep/pin/bottom here.
    card.manual_pick = False
    card.manual_pin = False
    card.manual_bottom = False
    filtered.append(card.to_dict())
    write_json(manual_path, filtered)

    payload = sync_accounts()
    return {
        "ok": True,
        "tweet": card.to_dict(),
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
