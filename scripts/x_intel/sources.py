from __future__ import annotations

import hashlib

from . import bootstrap as _bootstrap
from . import editorial as _editorial
from .taxonomy import (
    CARD_TYPES,
    PRODUCT_CATALOG,
    PRODUCT_IDS,
    canonical_product_ids,
    canonical_source_role,
    has_complete_product_progress_evidence,
    is_retired_source_handle,
    migrate_card_taxonomy_payload,
    normalize_record_result,
    normalize_product_progress_evidence,
    normalize_sbt_entries,
)

globals().update(vars(_bootstrap))
globals().update(vars(_editorial))

# Domain: MiniMax refine, X/Twitter providers, Discord provider, thread merge

X_SOURCE_CONFIG_FILE = "x_intel_sources.json"
X_ACCOUNT_CATEGORIES = {"official", "official_community", "other"}
X_PROJECT_IDS = {"tcg", "index", "defi", "game", "hackathon", "outreach"}
DEFAULT_X_ACCOUNT_PROJECTS = {
    "renaissxyz": "tcg",
    "renaiss_index": "index",
    "renaiss_fi": "defi",
    "vinciwld": "game",
    "tastedotmd": "hackathon",
    "renaisscltb": "outreach",
}
DISCORD_COVER_CACHE_DIR = "generated_covers"
DISCORD_COVER_MAX_BYTES = 12 * 1024 * 1024
DISCORD_COVER_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
AI_CARD_TYPES = set(CARD_TYPES)
AI_LAYOUTS = {"poster", "brief", "data", "timeline"}
AI_MIN_CONFIDENCE_DEFAULT = 0.58
AI_SPECULATION_RE = re.compile(
    r"推測|可能|通常|大概|也許|有待|待官方|待確認|尚未公布|尚未揭露|未指定|未於原文|原文未|未提供|以官方公布為準"
)
AI_RESERVED_DISPLAY_TAGS = {
    "official", "official_community", "community", "other", "events", "event",
    "product_progress", "feature", "alpha", "guides", "guide", "pokemon",
    "collectibles", "官方", "官方社群", "社群", "其他", "無", "宝可梦", "寶可夢",
}


def _normalize_ai_display_tags(values: Any) -> list[str]:
    rows = values if isinstance(values, list) else []
    out: list[str] = []
    for value in rows:
        tag = clean_text(str(value))[:16]
        if not tag or tag.lower() in AI_RESERVED_DISPLAY_TAGS or tag in {"待審核", "去重淘汰", "篩選淘汰"}:
            continue
        if tag not in out:
            out.append(tag)
    return out[:3]
AI_UNSUPPORTED_TOPIC_TERMS = {
    "Discord": re.compile(r"discord", re.I),
    "直播": re.compile(r"直播|live\s*stream|livestream", re.I),
    "線上": re.compile(r"線上|线上|online", re.I),
    "獎勵": re.compile(r"獎勵|奖励|獎品|奖品|reward|prize", re.I),
}
_DISCORD_AUTH_FAILURE_FINGERPRINT = ""
AI_TOPIC_SUPPORT_TERMS = {
    "Discord": re.compile(r"discord|discord\.com|discord-rest", re.I),
    "線上": re.compile(r"線上|线上|online|オンライン|web|www\.|https?://", re.I),
    "獎勵": re.compile(
        r"獎勵|奖励|獎品|奖品|reward|prize|sbt|badge|unlock|claim|top\s+value|value\s+up\s+to|"
        r"booster|merch|pack|抽|限量|名額|排名|top\s*\d+",
        re.I,
    ),
}
AI_CARD_TYPE_ALIASES = {
    "drop": "announcement",
    "sale": "announcement",
    "product": "announcement",
    "promo": "announcement",
    "promotion": "announcement",
    "release": "announcement",
    "launch": "announcement",
    "sbt": "announcement",
    "news": "announcement",
    "update": "announcement",
    "events": "event",
    "activity": "event",
    "campaign": "event",
    "lottery": "event",
    "raffle": "event",
    "competition": "event",
    "tournament": "event",
    "card_info": "insight",
    "card info": "insight",
    "card": "insight",
    "illustration": "insight",
    "profile": "insight",
    "opinion": "insight",
    "discussion": "insight",
    "comment": "insight",
}


def minimax_model_name() -> str:
    return str(
        os.getenv("MINIMAX_TEXT_MODEL")
        or os.getenv("MINIMAX_MODEL")
        or "MiniMax-M3"
    ).strip() or "MiniMax-M3"


def ai_min_confidence() -> float:
    try:
        return float(os.getenv("AI_CLASSIFY_MIN_CONFIDENCE") or AI_MIN_CONFIDENCE_DEFAULT)
    except Exception:
        return AI_MIN_CONFIDENCE_DEFAULT


def _valid_ai_date(value: Any) -> str:
    raw = str(value or "").strip().translate(str.maketrans({"‑": "-", "–": "-", "—": "-", "−": "-"}))
    if not raw:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    m = re.search(r"(20\d{2})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})", raw)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return "__INVALID_DATE__"


def _valid_plan_status(value: Any) -> str:
    status = str(value or "").strip().lower().replace("-", "_")
    return status if status in PLAN_STATUSES else ""


def _valid_event_region(value: Any) -> str:
    raw = str(value or "").strip().lower().replace("-", "_")
    aliases = {
        "taiwan": "tw",
        "台灣": "tw",
        "台湾": "tw",
        "korea": "kr",
        "south_korea": "kr",
        "韓國": "kr",
        "韩国": "kr",
        "malaysia": "my",
        "馬來西亞": "my",
        "马来西亚": "my",
        "vietnam": "vn",
        "越南": "vn",
        "thailand": "th",
        "泰國": "th",
        "泰国": "th",
        "worldwide": "global",
        "全球": "global",
        "multi": "multi_region",
        "multiple": "multi_region",
        "跨地區": "multi_region",
        "跨地区": "multi_region",
        "待確認": "unknown",
        "待确认": "unknown",
    }
    normalized = aliases.get(raw, raw)
    return normalized if normalized in EVENT_REGION_IDS else ""


def _clear_event_region(card: StoryCard) -> None:
    card.event_region = ""
    card.event_region_reason = ""
    card.event_region_model = ""
    card.event_region_version = ""


def _apply_event_region(card: StoryCard, *, region: Any, reason: Any, model: str) -> bool:
    if str(card.card_type or "").strip().lower() != "event":
        _clear_event_region(card)
        return False
    normalized = _valid_event_region(region)
    cleaned_reason = clean_text(str(reason or ""))[:360]
    if not normalized or not cleaned_reason:
        return False
    card.event_region = normalized
    card.event_region_reason = cleaned_reason
    card.event_region_model = str(model or minimax_model_name()).strip()
    card.event_region_version = EVENT_REGION_CLASSIFICATION_VERSION
    return True


def _apply_plan_status(
    card: StoryCard,
    *,
    status: Any,
    reason: Any,
    model: str,
    checked_at: str = "",
) -> bool:
    normalized = _valid_plan_status(status)
    cleaned_reason = clean_text(str(reason or ""))[:360]
    if not normalized or not cleaned_reason:
        return False
    card.plan_status = normalized
    card.plan_status_reason = cleaned_reason
    card.plan_status_checked_at = checked_at or datetime.now(timezone.utc).isoformat()
    card.plan_ai_model = str(model or minimax_model_name()).strip()
    card.plan_ai_version = PLAN_STATUS_CLASSIFICATION_VERSION
    return True


def migrate_official_account_role_copy_v1(payload: dict[str, Any]) -> bool:
    """Idempotently repair the historical @renaiss_fi/Finland role mix-up."""
    account = normalize_account_handle(payload.get("account"))
    if account != "renaiss_fi":
        return False
    replacements = (
        (r"Renaiss\s*(?:芬蘭|芬兰)\s*(?:區域帳號|区域账号)", "@renaiss_fi DeFi 官方帳號"),
        (r"(?:芬蘭|芬兰)\s*(?:區域帳號|区域账号)", "DeFi 官方帳號"),
        (r"Renaiss\s+Finland\s+(?:regional\s+)?account", "the official @renaiss_fi DeFi account"),
        (r"Renaiss\s*핀란드\s*(?:지역\s*)?계정", "@renaiss_fi DeFi 공식 계정"),
    )
    changed = False

    def repair(value: str) -> str:
        nonlocal changed
        result = str(value or "")
        for pattern, replacement in replacements:
            updated = re.sub(pattern, replacement, result, flags=re.I)
            if updated != result:
                changed = True
                result = updated
        return result

    for field in ("title", "summary", "glance", "detail_summary", "classification_reason", "plan_status_reason"):
        if field in payload:
            payload[field] = repair(str(payload.get(field) or ""))
    for field in ("bullets", "detail_lines"):
        values = payload.get(field)
        if isinstance(values, list):
            payload[field] = [repair(str(item or "")) for item in values]
    return changed


def normalize_official_account_role_copy(card: StoryCard) -> bool:
    """Apply the v1 role-copy data migration to a pipeline card."""
    payload = card.to_dict()
    changed = migrate_official_account_role_copy_v1(payload)
    if not changed:
        return False
    for field in ("title", "summary", "glance", "detail_summary", "classification_reason", "plan_status_reason"):
        setattr(card, field, str(payload.get(field) or ""))
    card.bullets = [str(item or "") for item in payload.get("bullets", [])]
    card.detail_lines = [str(item or "") for item in payload.get("detail_lines", [])]
    return True


def _set_ai_review_queue(
    card: StoryCard,
    error: str,
    *,
    model: str = "",
    preserve_semantics: bool = False,
) -> None:
    card.classified_by = "ai"
    card.ai_model = model or minimax_model_name()
    card.ai_version = AI_CLASSIFICATION_VERSION
    card.ai_status = "needs_review"
    card.review_status = AI_REVIEW_ADMIN_QUEUE
    card.classification_error = clean_text(str(error or "ai_needs_review"))[:220]
    if not preserve_semantics:
        _apply_plan_status(
            card,
            status="needs_review",
            reason=f"AI 分類失敗：{clean_text(str(error or 'ai_needs_review'))[:240]}",
            model=model or minimax_model_name(),
        )
    if not card.classification_reason:
        card.classification_reason = "AI 未產生可安全公開的完整分類，需管理員確認。"
    card.tags = ["待審核"]
    card.template_id = choose_template_id(card.card_type)
    card.glance = compact_point(card.summary or card.title or card.raw_text, 120)
    card.importance = score_card(card)


def _source_backed_number_facts(facts: list[dict[str, str]], raw_text: str) -> list[dict[str, str]]:
    source = strip_links_mentions(raw_text).lower()
    out: list[dict[str, str]] = []
    for fact in facts:
        text = clean_text(str(fact.get("text") or ""))
        meaning = clean_text(str(fact.get("meaning") or ""))
        if not text or not meaning:
            continue
        if not re.search(r"\d|[$€£¥]|usd|us\$|rmb|u\b", text, re.I):
            continue
        if text.lower() not in source:
            continue
        date_time_text = bool(re.search(r"月|日|時|分|點|pm|am|utc|gmt", text, re.I))
        date_time_meaning = bool(re.search(r"日期|時間|開賣|發售|發布|截止|公布|購買期間|年份|年度|月|日|pm|utc", meaning, re.I))
        value_meaning = bool(re.search(r"價格|售價|定價|美元|美金|rmb|價值|估值|數量|總量|限量|名額|上限|門檻|成交|比例|積分|排名|top|周年|第|種|款|包|盒|%|percent", meaning, re.I))
        if date_time_text:
            continue
        if date_time_meaning and not value_meaning and re.fullmatch(r"\d{1,4}", text):
            continue
        out.append({"text": text, "meaning": meaning})
    return out


def _raw_needs_number_facts(raw_text: str) -> bool:
    source = strip_links_mentions(raw_text)
    if re.search(r"(?:\$|USD|US\$|RMB)\s*\d|\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|RMB|u\b)", source, re.I):
        return True
    if re.search(r"\d+(?:\.\d+)?\s*[KMB]\+?(?![A-Za-z])", source, re.I):
        return True
    if re.search(r"\btop\s*\d+\b|前\s*\d+\s*(?:名|位|%|percent)", source, re.I):
        return True
    if re.search(r"\d+(?:,\d{3})*(?:\.\d+)?\s*(?:packs?|boxes|包|盒|張|名|slots?|spots?|points?|pts|積分|%)", source, re.I):
        return True
    return False


def _normalize_ai_routing_topics(card: StoryCard, labels: list[str], card_type: str, ai_title: str) -> list[str]:
    return normalize_routing_topics(labels)


def _record_result_has_source_signal(kind: str, raw_text: str) -> bool:
    source = clean_text(raw_text or "")
    patterns = {
        "competition_result": r"winner|won\b|congrats|results?|top\s*\d+|排名|名次|冠軍|冠军|前\s*\d+|符合資格|符合资格",
        "draw_result": r"winner|selected|draw\s+results?|得獎|得奖|中獎|中奖|名單|名单|抽選結果|抽选结果",
        "reward_claim": r"claim|eligible|redeem|領取|领取|可領|可领|開放領取|开放领取|符合資格|符合资格",
        "reward_distributed": r"distributed|sent\s+to|airdropped|發放|发放|已.{0,12}(?:送達|送达|到帳|到账)",
        "milestone_record": r"sold\s*out|milestone|volume|revenue|users?|交易額|交易额|成交|用戶|用户|完售|售罄|突破|累計|累计",
    }
    pattern = patterns.get(str(kind or "").strip().lower())
    return bool(pattern and re.search(pattern, source, re.I))


def _raw_requires_record_result(raw_text: str) -> bool:
    source = clean_text(raw_text or "")
    return bool(re.search(
        r"\bwinners?\s+(?:are|is|were|announced|revealed)|(?:draw|giveaway)\s+results?|"
        r"(?:top\s*\d+|前\s*\d+).{0,80}(?:eligible|claim|符合資格|符合资格|領取|领取)|"
        r"(?:reward|獎勵|奖励).{0,40}(?:distributed|sent|發放|发放|到帳|到账)|"
        r"sold\s*out|gross\s+revenue|transaction\s+volume|交易額|交易额|累計交易|累计交易|"
        r"中獎名單|中奖名单|抽獎結果|抽奖结果|公布.{0,20}(?:得獎|得奖|名次|排名)",
        source,
        re.I,
    ))


def _unsupported_ai_copy_errors(text: str, raw_text: str) -> list[str]:
    errors: list[str] = []
    if AI_SPECULATION_RE.search(text):
        errors.append("speculative_copy")
    raw = raw_text or ""
    for label, pattern in AI_UNSUPPORTED_TOPIC_TERMS.items():
        raw_support_pattern = AI_TOPIC_SUPPORT_TERMS.get(label, pattern)
        if pattern.search(text) and not raw_support_pattern.search(raw):
            errors.append(f"unsupported_{label}")
    return errors


def _finalize_ai_semantics(card: StoryCard, parsed: dict[str, Any], *, model: str) -> bool:
    """Validate and persist source-backed facts without depending on public copy."""

    errors: list[str] = []
    card_type = AI_CARD_TYPE_ALIASES.get(
        str(parsed.get("card_type") or "").strip().lower(),
        str(parsed.get("card_type") or "").strip().lower(),
    )
    routing_topics = _normalize_ai_routing_topics(
        card,
        normalize_routing_topics(parsed.get("routing_topics")),
        card_type,
        "",
    )
    raw_product_ids = parsed.get("product_ids")
    product_ids = canonical_product_ids(raw_product_ids)
    event_facts = normalize_event_facts(parsed.get("event_facts"))
    product_progress_evidence = normalize_product_progress_evidence(parsed.get("product_progress_evidence"))
    raw_sbt_entries = parsed.get("sbt_entries")
    sbt_entries = normalize_sbt_entries(raw_sbt_entries)
    raw_record_result = parsed.get("record_result")
    record_result = normalize_record_result(raw_record_result)
    timeline_date = _valid_ai_date(parsed.get("timeline_date"))
    timeline_end_date = _valid_ai_date(parsed.get("timeline_end_date"))
    plan_status = _valid_plan_status(parsed.get("plan_status"))
    plan_status_reason = clean_text(str(parsed.get("plan_status_reason") or ""))[:360]
    reason = clean_text(str(parsed.get("classification_reason") or parsed.get("reasoning_note") or ""))[:360]
    number_facts = _source_backed_number_facts(
        normalize_number_facts(parsed.get("number_facts") or parsed.get("numbers")),
        card.raw_text,
    )
    try:
        confidence = float(parsed.get("confidence"))
    except Exception:
        confidence = 0.0

    if card_type not in AI_CARD_TYPES:
        errors.append("invalid_card_type")
    if not isinstance(raw_product_ids, list):
        errors.append("invalid_product_ids")
    elif any(str(value or "").strip().lower() not in PRODUCT_IDS for value in raw_product_ids):
        errors.append("invalid_product_ids")
    if card_type == "product_progress":
        if card.source_role != "official":
            errors.append("product_progress_requires_official_source")
        if not has_complete_product_progress_evidence(product_progress_evidence):
            errors.append("incomplete_product_progress_evidence")
    if timeline_date == "__INVALID_DATE__" or timeline_end_date == "__INVALID_DATE__":
        errors.append("invalid_timeline_date")
    if confidence < ai_min_confidence():
        errors.append("low_confidence")
    if not reason:
        errors.append("missing_classification_reason")
    if not plan_status:
        errors.append("missing_plan_status")
    if not plan_status_reason:
        errors.append("missing_plan_status_reason")
    if _raw_needs_number_facts(card.raw_text) and not number_facts:
        errors.append("missing_number_facts")
    if raw_record_result is not None and raw_record_result != {} and not isinstance(raw_record_result, dict):
        errors.append("invalid_record_result")
    if isinstance(raw_record_result, dict) and raw_record_result and not record_result:
        errors.append("invalid_record_result")
    if record_result and not _record_result_has_source_signal(record_result.get("kind", ""), card.raw_text):
        errors.append("unsupported_record_result")
    if not record_result and _raw_requires_record_result(card.raw_text):
        errors.append("missing_record_result")
    raw_sbt_signal = bool(re.search(r"\bSBT\b|soul\s*bound(?:\s+token)?|soulbound|靈魂綁定|灵魂绑定", card.raw_text or "", re.I))
    if raw_sbt_entries not in (None, []) and not isinstance(raw_sbt_entries, list):
        errors.append("invalid_sbt_entries")
    if isinstance(raw_sbt_entries, list) and len(sbt_entries) != len(raw_sbt_entries):
        errors.append("incomplete_sbt_entries")
    if sbt_entries and not raw_sbt_signal:
        errors.append("unsupported_sbt_entries")
    if raw_sbt_signal and not sbt_entries:
        errors.append("missing_sbt_entries")

    if errors:
        _set_ai_review_queue(card, ",".join(errors), model=model)
        if reason:
            card.classification_reason = reason
        return False

    card.card_type = card_type
    card.layout, default_tags = default_style_for_type(card_type)
    card.tags = default_tags[:]
    card.confidence = max(0.0, min(1.0, confidence))
    card.event_facts = event_facts if card_type == "event" else {}
    if card_type != "event":
        _clear_event_region(card)
    card.routing_topics = routing_topics
    card.product_ids = product_ids
    card.sbt_entries = sbt_entries
    card.record_result = record_result
    card.product_progress_evidence = product_progress_evidence if card_type == "product_progress" else {}
    card.timeline_date = "" if timeline_date == "__INVALID_DATE__" else timeline_date
    card.timeline_end_date = "" if timeline_end_date == "__INVALID_DATE__" else timeline_end_date
    card.number_facts = number_facts
    card.classified_by = "ai"
    card.ai_model = model
    card.ai_version = AI_CLASSIFICATION_VERSION
    card.ai_confidence = card.confidence
    card.ai_status = "semantic_ok"
    card.review_status = AI_REVIEW_ADMIN_QUEUE
    card.classification_reason = reason
    card.classification_error = ""
    _apply_plan_status(card, status=plan_status, reason=plan_status_reason, model=model)
    card.template_id = choose_template_id(card.card_type)
    card.urgency = compute_urgency(card.card_type, card.importance, card.timeline_date)
    card.event_wall = card.card_type == "event"
    return True


def _finalize_ai_editorial(card: StoryCard, parsed: dict[str, Any], *, model: str) -> bool:
    """Validate display copy after semantic classification has succeeded."""

    errors: list[str] = []
    title = clean_text(str(parsed.get("title") or ""))
    summary = clean_text(str(parsed.get("summary") or ""))
    bullets_raw = parsed.get("bullets") if isinstance(parsed.get("bullets"), list) else []
    bullets = [clean_text(str(value))[:120] for value in bullets_raw if clean_text(str(value))][:3]
    detail_summary = clean_text(str(parsed.get("detail_summary") or ""))[:420]
    detail_lines = normalize_detail_lines(parsed.get("detail_lines"), limit=6)
    tags = _normalize_ai_display_tags(parsed.get("tags"))
    layout = str(parsed.get("layout") or "").strip().lower()
    layout = {
        "event_poster": "poster",
        "market_signal": "data",
        "announcement_timeline": "timeline",
        "community_brief": "brief",
    }.get(layout, layout)
    if layout not in AI_LAYOUTS:
        errors.append("invalid_layout")
    if not title or not summary or len(bullets) < 3:
        errors.append("missing_public_copy")
    if not detail_summary or len(detail_lines) < 4:
        errors.append("missing_detail_copy")
    copy_for_grounding = " ".join([title, summary, " ".join(bullets), detail_summary, " ".join(detail_lines)])
    if not re.search(r"[\u4e00-\u9fff]", copy_for_grounding):
        errors.append("non_chinese_copy")
    source_for_grounding = " ".join([str(card.raw_text or ""), str(card.url or ""), str(card.provider or "")])
    errors.extend(_unsupported_ai_copy_errors(copy_for_grounding, source_for_grounding))
    if errors:
        _set_ai_review_queue(card, ",".join(errors), model=model, preserve_semantics=True)
        return False

    card.title = title[:120]
    card.summary = summary[:320]
    card.bullets = bullets
    card.detail_summary = detail_summary
    card.detail_lines = detail_lines
    card.tags = tags or default_style_for_type(card.card_type)[1]
    card.layout = layout
    card.glance = compact_point(card.summary or " ".join(card.bullets), 120)
    card.ai_status = "ok"
    card.review_status = AI_REVIEW_AUTO_APPROVED
    card.classification_error = ""
    card.importance = score_card(card)
    return True


def build_ai_pending_card(
    *,
    card_id: str,
    account: str,
    url: str,
    text: str,
    published_at: str,
    provider: str,
    confidence: float,
    cover_image: str = "",
    metrics: dict[str, int] | None = None,
    reply_to_id: str = "",
) -> StoryCard:
    title = compact_point(strip_links_mentions(text), 96) or "待 AI 分類"
    card = StoryCard(
        id=card_id,
        account=account,
        url=url,
        title=title[:120],
        summary="AI 尚未完成分類，需等待模型輸出後才能公開。",
        bullets=[],
        published_at=published_at,
        confidence=confidence,
        card_type="insight",
        layout="brief",
        tags=["待審核"],
        raw_text=text[:2500],
        provider=provider,
        cover_image=cover_image,
        metrics=metrics or {},
        reply_to_id=reply_to_id,
        routing_topics=[],
        product_ids=[],
        classified_by="ai",
        ai_model=minimax_model_name(),
        ai_version=AI_CLASSIFICATION_VERSION,
        ai_status="pending",
        review_status=AI_REVIEW_ADMIN_QUEUE,
        classification_error="ai_not_run",
    )
    card.template_id = choose_template_id(card.card_type)
    card.importance = score_card(card)
    return card


def normalize_x_account(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "://" in raw:
        parsed = urlparse(raw)
        parts = [x for x in str(parsed.path or "").split("/") if x]
        raw = parts[0] if parts else ""
    raw = raw.strip().lstrip("@").split("?")[0].split("#")[0].split("/")[0]
    raw = re.sub(r"[^A-Za-z0-9_]", "", raw)
    if not re.fullmatch(r"[A-Za-z0-9_]{1,15}", raw):
        return ""
    return raw


def normalize_x_accounts(values: Any) -> list[str]:
    rows = values if isinstance(values, list) else []
    out: list[str] = []
    seen: set[str] = set()
    for item in rows:
        account = normalize_x_account(item)
        key = account.lower()
        if not account or key in seen:
            continue
        out.append(account)
        seen.add(key)
    return out


def ensure_required_x_accounts(accounts: list[str]) -> list[str]:
    return [
        account
        for account in normalize_x_accounts([*(accounts or []), *REQUIRED_X_ACCOUNT_LABELS])
        if not is_retired_source_handle(account)
    ]


def default_x_account_category(account: str) -> str:
    normalized = normalize_x_account(account).lower()
    if normalized in DEFAULT_X_ACCOUNT_PROJECTS:
        return "official"
    if normalized in REGIONAL_COMMUNITY_X_HANDLES:
        return "official_community"
    return "other"


def normalize_x_account_categories(values: Any, accounts: list[str]) -> dict[str, str]:
    rows = values if isinstance(values, dict) else {}
    normalized_rows = {
        normalize_x_account(key).lower(): canonical_source_role(value)
        for key, value in rows.items()
        if normalize_x_account(key)
    }
    return {
        account: normalized_rows.get(account.lower(), default_x_account_category(account))
        for account in accounts
    }


def normalize_x_account_projects(values: Any, accounts: list[str]) -> dict[str, str]:
    rows = values if isinstance(values, dict) else {}
    normalized_rows = {
        normalize_x_account(key).lower(): str(value or "").strip().lower()
        for key, value in rows.items()
        if normalize_x_account(key) and str(value or "").strip().lower() in X_PROJECT_IDS
    }
    out: dict[str, str] = {}
    for account in accounts:
        normalized = account.lower()
        project_id = normalized_rows.get(normalized) or DEFAULT_X_ACCOUNT_PROJECTS.get(normalized, "")
        if project_id:
            out[account] = project_id
    return out


def x_source_config_path() -> Path:
    return data_dir() / X_SOURCE_CONFIG_FILE


def read_x_source_config() -> dict[str, Any]:
    path = x_source_config_path()
    raw = read_json(path, {}) if path.exists() else {}
    configured = isinstance(raw, dict) and isinstance(raw.get("x_accounts"), list)
    accounts = ensure_required_x_accounts(normalize_x_accounts(raw.get("x_accounts") if configured else DEFAULT_ACCOUNTS))
    account_categories = normalize_x_account_categories(
        raw.get("account_categories") if isinstance(raw, dict) else {},
        accounts,
    )
    account_projects = normalize_x_account_projects(
        raw.get("account_projects") if isinstance(raw, dict) else {},
        accounts,
    )
    updated_at = str(raw.get("updated_at") or "") if isinstance(raw, dict) else ""
    return {
        "x_accounts": accounts,
        "account_categories": account_categories,
        "account_projects": account_projects,
        "default_x_accounts": list(DEFAULT_ACCOUNTS),
        "required_x_accounts": list(REQUIRED_X_ACCOUNT_LABELS),
        "using_default": not configured,
        "updated_at": updated_at,
        "path": str(path),
    }


def write_x_source_config(
    accounts: list[str],
    account_categories: dict[str, str] | None = None,
    account_projects: dict[str, str] | None = None,
) -> dict[str, Any]:
    normalized = ensure_required_x_accounts(normalize_x_accounts(accounts))
    normalized_categories = normalize_x_account_categories(account_categories, normalized)
    normalized_projects = normalize_x_account_projects(account_projects, normalized)
    payload = {
        "x_accounts": normalized,
        "account_categories": normalized_categories,
        "account_projects": normalized_projects,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path = x_source_config_path()
    write_json(path, payload)
    result = read_x_source_config()
    result["using_default"] = False
    return result


def migrate_x_source_config() -> dict[str, Any]:
    """Persist the canonical source-role schema and remove retired sources."""
    path = x_source_config_path()
    raw = read_json(path, {}) if path.exists() else {}
    current = read_x_source_config()
    raw_accounts = normalize_x_accounts(raw.get("x_accounts") if isinstance(raw, dict) else [])
    raw_categories = raw.get("account_categories") if isinstance(raw, dict) else {}
    raw_projects = raw.get("account_projects") if isinstance(raw, dict) else {}
    needs_write = bool(
        not isinstance(raw, dict)
        or "pokemon_accounts" in raw
        or any(is_retired_source_handle(account) for account in raw_accounts)
        or any(str(value or "").strip().lower() == "ambassador" for value in (raw_categories or {}).values())
        or raw_accounts != list(current.get("x_accounts") or [])
        or raw_categories != current.get("account_categories")
        or raw_projects != current.get("account_projects")
    )
    if not needs_write:
        return current
    migrated = write_x_source_config(
        list(current.get("x_accounts") or []),
        account_categories=dict(current.get("account_categories") or {}),
        account_projects=dict(current.get("account_projects") or {}),
    )
    migrated["migrated"] = True
    return migrated


def resolve_tracked_x_accounts() -> list[str]:
    return list(migrate_x_source_config().get("x_accounts") or [])


def update_x_source_accounts(
    action: str,
    account: str = "",
    accounts: list[str] | None = None,
    category: str = "",
    project_id: str = "",
) -> dict[str, Any]:
    op = str(action or "").strip().lower()
    source_config = read_x_source_config()
    current = list(source_config.get("x_accounts") or [])
    category_current = dict(source_config.get("account_categories") or {})
    project_current = dict(source_config.get("account_projects") or {})
    changed = False
    normalized_account = normalize_x_account(account)

    if op == "add":
        if not normalized_account:
            raise ValueError("invalid X username")
        if is_retired_source_handle(normalized_account):
            raise ValueError("retired X source cannot be added")
        if normalized_account.lower() not in {x.lower() for x in current}:
            current.append(normalized_account)
            changed = True
        normalized_category = str(category or "").strip().lower()
        if normalized_category in X_ACCOUNT_CATEGORIES:
            changed = changed or category_current.get(normalized_account) != normalized_category
            category_current[normalized_account] = normalized_category
        normalized_project = str(project_id or "").strip().lower()
        if normalized_category == "official":
            normalized_project = normalized_project or DEFAULT_X_ACCOUNT_PROJECTS.get(normalized_account.lower(), "")
            if normalized_project not in X_PROJECT_IDS:
                raise ValueError("official account project id is required")
            changed = changed or project_current.get(normalized_account) != normalized_project
            project_current[normalized_account] = normalized_project
        elif normalized_category:
            next_projects = {
                key: value
                for key, value in project_current.items()
                if normalize_x_account(key).lower() != normalized_account.lower()
            }
            changed = changed or len(next_projects) != len(project_current)
            project_current = next_projects
    elif op in {"remove", "delete", "cancel"}:
        if not normalized_account:
            raise ValueError("invalid X username")
        next_rows = [x for x in current if x.lower() != normalized_account.lower()]
        changed = len(next_rows) != len(current)
        current = next_rows
        category_current = {
            key: value
            for key, value in category_current.items()
            if normalize_x_account(key).lower() != normalized_account.lower()
        }
        project_current = {
            key: value
            for key, value in project_current.items()
            if normalize_x_account(key).lower() != normalized_account.lower()
        }
    elif op == "replace":
        current = [x for x in normalize_x_accounts(accounts or []) if not is_retired_source_handle(x)]
        changed = True
    elif op in {"set_category", "set-category", "categorize"}:
        if not normalized_account or normalized_account.lower() not in {x.lower() for x in current}:
            raise ValueError("tracked X username is required")
        normalized_category = str(category or "").strip().lower()
        if normalized_category not in X_ACCOUNT_CATEGORIES:
            raise ValueError("category must be official, official_community, or other")
        current_account = next(x for x in current if x.lower() == normalized_account.lower())
        changed = category_current.get(current_account) != normalized_category
        category_current[current_account] = normalized_category
        if normalized_category == "official":
            normalized_project = str(project_id or "").strip().lower() or DEFAULT_X_ACCOUNT_PROJECTS.get(current_account.lower(), "")
            if normalized_project not in X_PROJECT_IDS:
                raise ValueError("official account project id is required")
            changed = changed or project_current.get(current_account) != normalized_project
            project_current[current_account] = normalized_project
        else:
            next_projects = {
                key: value
                for key, value in project_current.items()
                if normalize_x_account(key).lower() != current_account.lower()
            }
            changed = changed or len(next_projects) != len(project_current)
            project_current = next_projects
    elif op in {"set_project", "set-project"}:
        if not normalized_account or normalized_account.lower() not in {x.lower() for x in current}:
            raise ValueError("tracked X username is required")
        normalized_project = str(project_id or "").strip().lower()
        if normalized_project not in X_PROJECT_IDS:
            raise ValueError("unsupported project id")
        current_account = next(x for x in current if x.lower() == normalized_account.lower())
        changed = project_current.get(current_account) != normalized_project
        project_current[current_account] = normalized_project
        category_current[current_account] = "official"
    else:
        raise ValueError("unsupported source config action")

    config = write_x_source_config(
        current,
        account_categories=category_current,
        account_projects=project_current,
    )
    config["changed"] = changed
    config["action"] = op
    config["account"] = normalized_account
    return config


def _image_ext_from_url(url: str) -> str:
    try:
        path = str(urlparse(str(url or "")).path or "")
    except Exception:
        path = ""
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ""


def _cached_discord_cover_for_id(card_id: str) -> str:
    safe_id = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(card_id or "").strip()).strip(".-")
    if not safe_id:
        return ""
    cover_dir = data_dir() / DISCORD_COVER_CACHE_DIR
    for ext in (".webp", ".png", ".jpg", ".gif"):
        candidate = cover_dir / f"{safe_id}{ext}"
        if candidate.exists() and candidate.is_file():
            return f"/data/{DISCORD_COVER_CACHE_DIR}/{candidate.name}"
    return ""


def _cache_discord_cover_image(source_url: str, card_id: str) -> str:
    url = str(source_url or "").strip()
    if not url:
        return ""
    if url.startswith("/data/generated_covers/"):
        return url
    if not url.startswith("http"):
        return ""
    cached = _cached_discord_cover_for_id(card_id)
    if cached:
        return cached

    safe_id = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(card_id or "").strip()).strip(".-")
    if not safe_id:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
        safe_id = f"discord-{digest}"
    cover_dir = data_dir() / DISCORD_COVER_CACHE_DIR
    cover_dir.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "RenaissIntelDiscordImageCache/1.0"}
    try:
        resp = requests.get(url, headers=headers, stream=True, timeout=(10, 30))
        resp.raise_for_status()
        content_type = str(resp.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if not content_type.startswith("image/"):
            return ""
        ext = DISCORD_COVER_EXT_BY_TYPE.get(content_type) or _image_ext_from_url(url) or ".jpg"
        target = cover_dir / f"{safe_id}{ext}"
        tmp = cover_dir / f".{safe_id}.{os.getpid()}.tmp"
        total = 0
        with tmp.open("wb") as fh:
            for chunk in resp.iter_content(chunk_size=65536):
                if not chunk:
                    continue
                total += len(chunk)
                if total > DISCORD_COVER_MAX_BYTES:
                    raise RuntimeError("discord image exceeds cache limit")
                fh.write(chunk)
        if total <= 0:
            tmp.unlink(missing_ok=True)
            return ""
        tmp.replace(target)
        return f"/data/{DISCORD_COVER_CACHE_DIR}/{target.name}"
    except Exception:
        try:
            tmp.unlink(missing_ok=True)  # type: ignore[name-defined]
        except Exception:
            pass
        return ""

def minimax_chat(
    prompt: str,
    api_key: str,
    max_tokens: int | None = None,
    *,
    connect_timeout_override: float | None = None,
    read_timeout_override: float | None = None,
    model_override: str | None = None,
    temperature_override: float | None = None,
    use_env_max_tokens: bool = True,
) -> str:
    def extract_text(value: Any) -> str:
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    parts.append(extract_text(item.get("text") or item.get("content") or item.get("output_text")))
            return "\n".join(part for part in (p.strip() for p in parts) if part).strip()
        if isinstance(value, dict):
            return extract_text(value.get("text") or value.get("content") or value.get("output_text"))
        return ""

    model_name = str(
        model_override
        or os.getenv("MINIMAX_TEXT_MODEL")
        or os.getenv("MINIMAX_MODEL")
        or "MiniMax-M3"
    ).strip() or "MiniMax-M3"
    temperature = 0.3
    if temperature_override is not None:
        try:
            temperature = max(0.0, min(float(temperature_override), 1.0))
        except Exception:
            temperature = 0.3
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "reasoning_split": False,
    }
    token_limit = None
    if max_tokens is not None:
        try:
            token_limit = int(max_tokens)
        except Exception:
            token_limit = None
    env_limit = str(os.getenv("MINIMAX_TEXT_MAX_TOKENS") or "").strip()
    if token_limit is None and use_env_max_tokens and env_limit:
        try:
            token_limit = int(env_limit)
        except Exception:
            token_limit = None
    if token_limit is not None and token_limit > 0:
        payload["max_tokens"] = int(token_limit)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    connect_timeout = 15.0
    read_timeout = 120.0
    try:
        connect_timeout = float(os.getenv("MINIMAX_HTTP_CONNECT_TIMEOUT") or connect_timeout)
    except Exception:
        connect_timeout = 15.0
    try:
        read_timeout = float(os.getenv("MINIMAX_HTTP_READ_TIMEOUT") or read_timeout)
    except Exception:
        read_timeout = 120.0
    if connect_timeout_override is not None and connect_timeout_override > 0:
        connect_timeout = float(connect_timeout_override)
    if read_timeout_override is not None and read_timeout_override > 0:
        read_timeout = float(read_timeout_override)
    if connect_timeout <= 0:
        connect_timeout = 15.0
    if read_timeout <= 0:
        read_timeout = 120.0
    resp = requests.post(
        MINIMAX_URL,
        headers=headers,
        json=payload,
        timeout=(connect_timeout, read_timeout),
    )
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message") if isinstance(first.get("message"), dict) else {}
        content = extract_text(message.get("content"))
        if content:
            return content
        finish_reason = str(first.get("finish_reason") or "").strip().lower()
        if finish_reason == "length":
            raise RuntimeError(
                f"MiniMax response reached token limit before final content; model={model_name}; "
                "reduce prompt size or set a larger INTEL_AGENT_MAX_TOKENS only if you intentionally enabled a limit"
            )
    direct = extract_text(data.get("reply") or data.get("output_text") or data.get("text"))
    if direct:
        return direct
    base_resp = data.get("base_resp") if isinstance(data.get("base_resp"), dict) else {}
    status_msg = str(base_resp.get("status_msg") or "").strip()
    if status_msg:
        raise RuntimeError(f"MiniMax response error: {status_msg}")
    raise RuntimeError(f"MiniMax response missing content; model={model_name}")


def apply_minimax_story_refine(
    cards: list[StoryCard],
    api_key: str,
    feedback_context: str = "",
    *,
    connect_timeout_override: float | None = None,
    read_timeout_override: float | None = None,
    progress_callback: Any | None = None,
) -> None:
    model_name = minimax_model_name()

    def _emit(event_name: str, **payload: Any) -> None:
        if not progress_callback:
            return
        try:
            progress_callback(event_name, payload)
        except Exception:
            return

    total_cards = len(cards)
    call_index = 0
    regional_cm_accounts = ", ".join(REGIONAL_COMMUNITY_X_HANDLE_LABELS)
    official_product_accounts = "；".join(f"@{account}={role}" for account, role in OFFICIAL_X_ACCOUNT_ROLES.items())
    product_catalog_text = "；".join(f"{product_id}={name}" for product_id, name in PRODUCT_CATALOG.items())
    classification_date = datetime.now(timezone.utc).date().isoformat()

    def _call_minimax(card: StoryCard, prompt: str, *, attempt: int, purpose: str) -> str:
        nonlocal call_index
        call_index += 1
        started = time.monotonic()
        _emit(
            "minimax_start",
            call_index=call_index,
            attempt=attempt,
            purpose=purpose,
            card_id=str(card.id or ""),
            account=str(card.account or ""),
            title=str(card.title or "")[:140],
            url=str(card.url or ""),
            prompt_len=len(str(prompt or "")),
            model=model_name,
        )
        try:
            raw_text = minimax_chat(
                prompt,
                api_key,
                connect_timeout_override=connect_timeout_override,
                read_timeout_override=read_timeout_override,
            )
            _emit(
                "minimax_done",
                call_index=call_index,
                attempt=attempt,
                purpose=purpose,
                card_id=str(card.id or ""),
                account=str(card.account or ""),
                title=str(card.title or "")[:140],
                url=str(card.url or ""),
                elapsed_ms=max(0, int(round((time.monotonic() - started) * 1000))),
                output_len=len(str(raw_text or "")),
                model=model_name,
            )
            return raw_text
        except Exception as exc:
            _emit(
                "minimax_error",
                call_index=call_index,
                attempt=attempt,
                purpose=purpose,
                card_id=str(card.id or ""),
                account=str(card.account or ""),
                title=str(card.title or "")[:140],
                url=str(card.url or ""),
                elapsed_ms=max(0, int(round((time.monotonic() - started) * 1000))),
                error=f"{type(exc).__name__}: {exc}"[:280],
                model=model_name,
            )
            raise

    for index, card in enumerate(cards):
        _emit(
            "refine_card_start",
            done_cards=index,
            total_cards=total_cards,
            card_id=str(card.id or ""),
            account=str(card.account or ""),
            title=str(card.title or "")[:140],
            url=str(card.url or ""),
            model=model_name,
        )
        prompt = (
            "你是TCG社群編輯與分類員。請先完整讀懂內容，再一次完成語意分類、日期解析、數字解讀與公開文案。"
            "輸出必須是單一 JSON 物件，必須包含以下所有欄位："
            "{\"title\":\"\",\"summary\":\"\",\"bullets\":[\"\",\"\",\"\"],\"card_type\":\"event|product_progress|announcement|market|report|guide|insight\","
            "\"layout\":\"poster|brief|data|timeline\",\"confidence\":0.0,\"tags\":[\"\"],"
            "\"event_facts\":{\"participation\":\"\",\"audience\":\"\",\"location\":\"\",\"schedule\":\"\"},"
            "\"routing_topics\":[\"collectibles\"],"
            "\"product_ids\":[],"
            "\"sbt_entries\":[{\"name\":\"\",\"acquisition\":\"\",\"status\":\"unknown|upcoming|available|ended|distributed\",\"start_date\":\"YYYY-MM-DD或空字串\",\"end_date\":\"YYYY-MM-DD或空字串\",\"evidence\":\"\"}],"
            "\"record_result\":null或{\"kind\":\"competition_result|draw_result|reward_claim|reward_distributed|milestone_record\",\"status\":\"confirmed|claim_open|distributed|completed\",\"subject\":\"\",\"evidence\":\"\"},"
            "\"product_progress_evidence\":{\"product_or_capability\":\"\",\"state_change\":\"\",\"user_or_platform_impact\":\"\",\"source_evidence\":\"\"},"
            "\"timeline_date\":\"YYYY-MM-DD或空字串\",\"timeline_end_date\":\"YYYY-MM-DD或空字串\","
            "\"plan_status\":\"upcoming|in_progress|completed|cancelled|not_plan|needs_review\",\"plan_status_reason\":\"\","
            "\"number_facts\":[{\"text\":\"原文數字\",\"meaning\":\"這個數字代表什麼\"}],"
            "\"classification_reason\":\"\",\"detail_summary\":\"\",\"detail_lines\":[\"\",\"\",\"\",\"\"]}。"
            "限制："
            "1) 不可逐句複製原文；"
            "2) summary 要用第三人稱重述；"
            "3) bullets 每條都要是可行動或可追蹤的資訊；"
            "4) card_type 只能是 event/product_progress/announcement/market/report/guide/insight；"
            "5) 必須用語意判斷分類，不可只用關鍵字；"
            "6) 只有含明確活動訊號（時間/地點/報名/參與方式）才可標為 event；"
            "7) product_progress 只給官方來源，而且必須同時回答四問：明確產品或能力、相較之前的狀態改變、使用者或平台影響、原文證據；任一不足就標 announcement；"
            "8) 單句互動、祝賀、表情、聊天回覆通常是 insight；"
            "9) routing_topics 是內部導頁欄位，只能是 collectibles 或空陣列，不可放 SBT；來源身分、活動、教學、產品進度都不是 routing topic；"
            f"9a) product_ids 是獨立的產品歸屬事實，只能使用此清單中的 ID：{product_catalog_text}；原文沒有足夠證據時輸出空陣列，不可從摘要或帳號自行補產品；"
            "9c) tags 只能是讀者看得懂的具體內容關鍵詞，例如產品名、卡牌名、合作方或技術名稱；不可填 official/community/event/product_progress/alpha/pokemon/collectibles/guide/other 等系統分類詞；原文明確提到 SBT 時可把 SBT 當技術名稱；"
            "10) 繁體中文，不可捏造；"
            "11) 禁止使用『核心訊號/關鍵數字/決策建議/判讀建議/分析主題/文中數據/使用方式』這種模板詞；"
            "12) 若出現數字，必須說明它代表什麼（單位/情境/用途），不能只列數字；"
            "13) summary 需涵蓋『發生了什麼、為何重要、影響誰、下一步該看什麼』；"
            "14) 若為串文(thread)或多段內容，先整合後再輸出單一版本；"
            "15) 禁止空話（例如『社群互動貼文、重點在現場動態與回饋』），必須寫出實際更新內容；"
            "16) 禁止猜測語氣（例如『可能/通常/推測/大概』），除非原文明確使用該語氣；"
            "17) 若提到數字，必須同句交代該數字對應的對象與意義（例如價格、版本、名額、成交）；"
            "18) 不可使用 Markdown code fence（```）；"
            "19) 長度限制：title<=40字、summary<=150字、每條bullet<=34字；"
            "20) 若使用者回饋記憶與原始推斷衝突，以使用者回饋記憶優先；"
            "21) 寶可夢/Pokemon/PTCG 不是獨立 topic；若內容屬收藏卡或收藏品，可標 collectibles；"
            "22) 教學、攻略、操作步驟、參與流程、工具用法、集運/查價/套利等可照做資訊使用 card_type=guide；"
            "23) 來源身分由系統的 source_role 決定，不可輸出 official/community topic；"
            "24) 只有系統已標為 source_role=official 的來源可判為 product_progress；一般情報、媒體、零售商與 official_community/other 來源不可使用 product_progress；"
            f"24b) 以下是目前已知官方帳號的產品身分對照：{official_product_accounts}。這份對照只協助理解產品線，來源身分仍以系統 source_role 為準，不可從帳號尾碼猜國家或地區；"
            f"24a) {regional_cm_accounts} 是 regional/community CM 帳號，不是官方 X；除非原文有 #renaiss 或 @renaissxyz，否則不要標 community，也永遠不要因帳號名標 official；"
            "25) 若不符合 collectibles，routing_topics 輸出空陣列；SBT 必須寫入 sbt_entries，不得再寫成 routing topic；"
            "25a) 官方 pack/drop/sale/release、Costume Pack、SBT unlock、badge、claim、one-pull 或 S-card 公告，若沒有四問完整證據，card_type 用 announcement；"
            "原文明確出現 SBT 或 Soul Bound Token 才建立 sbt_entries；每筆必須有 name、status 與貼近原文的 evidence；原文只寫 SBT 時 name 可原樣填 SBT，沒有原文詞時不得自行命名；"
            "record_result 只用於已公布或已發生的比賽結果、抽獎結果、獎勵領取/發放或正式里程碑；只提到未來獎勵、參與條件或 completed 字樣時必須為 null；"
            "寶可夢卡牌內容可加 collectibles；"
            "這類有發售日期但沒有 join/register/直播/聚會參與流程時，不要標 event；"
            "26) 活動貼文的 title 必須優先抓活動名稱、參與方式、獎勵或截止條件；不要把主辦/主持身份（例如 Ambassador、hosted by）當成主題；"
            "27) 活動摘要要保留關鍵獎勵、名額、報名限制與操作提醒，例如 Top 100、SBT、booster box、merch、chip bonus、late registration；"
            "28) detail_summary 要重寫成完整詳情導言，不可沿用舊 summary 或模板句；"
            "29) detail_lines 要列出活動名稱、時間、參與方式、獎勵、限制/注意事項、下一步；"
            "30) 原文沒有年份時，不可自行補錯年份；若需要年份，沿用發布時間/活動時間所在年份；"
            "31) 禁止把純數字 Discord ID、錢包地址或未具名帳號當成人名/主持人名稱；"
            "32) 禁止自行補充原文未提到的物流、轉運、代購、國籍限制或付款條件；"
            "33) 相對日期（例如 This Friday）必須以發布時間推算成 YYYY-MM-DD；無法確認就留空；"
            "33a) 發售日、開賣日、claim/unlock 日期也要填 timeline_date；欄位只輸出 YYYY-MM-DD，不要輸出時間或時區；"
            "34) 不可把 t.co 或其他短網址尾碼、Discord ID、tweet id、雜湊片段當成 number_facts；"
            "35) classification_reason 要說明為什麼是該 card_type、product_ids、routing_topics、sbt_entries 與 record_result；所有 evidence 必須引用或緊貼原文證據；"
            "36) number_facts.text 必須是原文中實際出現的數字字串；只收價格、數量、名額、比例、成交價、積分門檻等有解讀價值的數字，不要放發布日期、發售日、推算日期、時間、時區或純年份；"
            "37) 原文沒有 Discord、直播、線上、報名連結、獎勵或限制時，不可自行補這些資訊；"
            "38) detail_lines 只列原文有根據的活動名稱、時間、參與方式、獎勵、限制與下一步；缺少的項目直接省略，不要寫未公布/未提供；"
            "39) number_facts 每項都必須有 meaning，說明該數字在原文的對象與意義；"
            f"40) 規劃狀態以 {classification_date} 為判斷日；plan_status 不會單獨使貼文成為 product_progress；"
            "upcoming 只給判斷日之後尚未發生的明確計畫，in_progress 給已開始且仍持續的測試/開放/開發，"
            "completed 給已上線、售罄、完售、認領完畢、已結束，或原文所述單日發售/啟動日期已過的項目，"
            "cancelled 給明確取消或終止，not_plan 給教學、回顧、一般資訊與沒有後續行動的公告，證據不足才用 needs_review；"
            "41) plan_status_reason 必須引用原文中的狀態訊號或日期，不可只說因為是產品進度；"
            "42) 整份 JSON 請控制在約 1500 字元內。\n\n"
            + (f"[使用者回饋記憶]\n{feedback_context}\n\n" if feedback_context else "")
            + f"來源帳號: @{card.account}\n"
            f"來源帳號固定身分: {OFFICIAL_X_ACCOUNT_ROLES.get(normalize_account_handle(card.account), '非官方或社群來源')}\n"
            f"來源URL: {card.url}\n"
            f"發布時間: {card.published_at}\n"
            f"既有標題: {card.title}\n"
            f"內容: {card.raw_text[:4200]}"
        )
        semantic_ok = False
        try:
            raw = _call_minimax(card, prompt, attempt=1, purpose="initial_refine")
            parsed = parse_json_block(raw)
            if not parsed:
                compact_retry_prompt = (
                    "請直接輸出合法 JSON，不要任何前後文字，不要 ```。"
                    "欄位固定：title,summary,bullets(3),card_type,layout,tags,confidence,event_facts,routing_topics,product_ids,sbt_entries,record_result,product_progress_evidence,"
                    "timeline_date,timeline_end_date,plan_status,plan_status_reason,number_facts,classification_reason,detail_summary,detail_lines。"
                    "全部繁體中文，且每欄位要短：title<=40字、summary<=120字、每條bullet<=30字。"
                    "detail_summary 與 detail_lines 必須重新整理詳情，不可沿用模板句。"
                    "不要捏造年份、人名、物流、轉運、代購或限制條件。"
                    "活動標題要抓活動名稱與主要獎勵/參與條件，不要把 Ambassador、hosted by 這種主辦身份當主題。"
                    "相對日期要依發布時間推算成 YYYY-MM-DD；短網址尾碼不可當成數字。"
                    "number_facts.text 只能放原文實際出現的價格、數量、名額、比例、成交價、積分門檻，不要放日期/時間/時區/純年份；原文沒有 Discord、直播、線上或獎勵時不可補。"
                    "routing_topics 只能是 collectibles 或空陣列；SBT 要放 sbt_entries；record_result 只有原文已公布結果或實際發放/里程碑證據時才能填。"
                    f"product_ids 只能使用此清單且證據不足要留空：{product_catalog_text}。"
                    f"官方產品帳號固定身分：{official_product_accounts}。不可從帳號尾碼猜國家或地區。"
                    f"{regional_cm_accounts} 是 regional/community CM 帳號，不是官方 X，不可因帳號名標 official。"
                    "官方 pack/drop/sale/release、Costume Pack、SBT unlock、badge、claim、one-pull 或 S-card 公告，card_type 用 announcement，不要因為發售日標 event。"
                    f"規劃狀態以 {classification_date} 為判斷日；product_progress 必須是官方來源且四問證據完整。已上線、售罄、完售、認領完畢或已過單日發售日期用 completed；"
                    "仍在測試/開放/開發用 in_progress；未來明確日期用 upcoming；一般資訊用 not_plan；證據不足用 needs_review。"
                    "不可捏造，需依據提供內容。\n\n"
                    f"帳號:@{card.account}\n"
                    f"帳號固定身分:{OFFICIAL_X_ACCOUNT_ROLES.get(normalize_account_handle(card.account), '非官方或社群來源')}\n"
                    f"URL:{card.url}\n"
                    f"發布時間:{card.published_at}\n"
                    f"既有標題:{card.title}\n"
                    f"內容:{card.raw_text[:3200]}"
                )
                raw = _call_minimax(card, compact_retry_prompt, attempt=2, purpose="compact_json_retry")
                parsed = parse_json_block(raw)
            if not parsed:
                _set_ai_review_queue(card, "ai_json_parse_failed", model=model_name)
                _emit(
                    "refine_card_failed",
                    done_cards=index + 1,
                    total_cards=total_cards,
                    card_id=str(card.id or ""),
                    account=str(card.account or ""),
                    title=str(card.title or "")[:140],
                    url=str(card.url or ""),
                    error="ai_json_parse_failed",
                    ai_status=str(card.ai_status or ""),
                    review_status=str(card.review_status or ""),
                    model=model_name,
                )
                continue
            semantic_ok = _finalize_ai_semantics(card, parsed, model=model_name)
            if not semantic_ok:
                retry_reason = card.classification_error
                strict_retry_prompt = (
                    "上一版 JSON 未通過資料驗證，原因："
                    f"{retry_reason}。請重新輸出合法 JSON，不要任何前後文字，不要 ```。"
                    "必須包含所有欄位：title,summary,bullets(3),card_type,layout,tags,confidence,event_facts,routing_topics,product_ids,sbt_entries,record_result,product_progress_evidence,"
                    "timeline_date,timeline_end_date,plan_status,plan_status_reason,number_facts,classification_reason,detail_summary,detail_lines。"
                    "routing_topics 必須是陣列，只能包含 collectibles，也可以是空陣列；SBT 只放 sbt_entries。"
                    f"product_ids 必須是陣列，只能使用此清單且證據不足要留空：{product_catalog_text}。"
                    "Pokemon Center、零售商、媒體或一般情報帳號不算 official。"
                    f"{regional_cm_accounts} 是 regional/community CM 帳號，不是官方 X，不可因帳號名標 official。"
                    "官方 pack/drop/sale/release、Costume Pack、SBT unlock、badge、claim、one-pull 或 S-card 公告，card_type 用 announcement；"
                    f"規劃狀態以 {classification_date} 為判斷日；product_progress 必須是官方來源且四問證據完整。已上線、售罄、完售、認領完畢或已過單日發售日期用 completed；"
                    "仍在測試/開放/開發用 in_progress；未來明確日期用 upcoming；一般資訊用 not_plan；證據不足用 needs_review。"
                    "寶可夢卡牌可加 collectibles；明確出現 SBT 才建立有 evidence 的 sbt_entries；record_result 沒有已發生結果證據就必須為 null；有發售日但沒有 join/register/直播/聚會參與流程時，不要標 event。"
                    "所有公開文字必須是繁體中文；detail_summary 必填，detail_lines 必須 4 到 6 條。"
                    "layout 只能是 poster/brief/data/timeline，不可輸出 event_poster 等 template 名稱。"
                    "只能依原文，不可補 Discord、直播、線上、報名連結、獎勵或限制；"
                    "不得使用推測/可能/待官方/尚未公布/以官方公布為準等語氣。"
                    "缺少地點、獎勵、限制時直接不要列那一項，不要寫未提供。"
                    "number_facts.text 只能是原文實際出現的價格、數量、名額、比例、成交價、積分門檻，meaning 不可空白；不能放發布日、發售日、推算日、時間、時區、純年份，不能取短網址尾碼。"
                    "如果 event 資訊不足，就只列原文有的活動名稱、時間、社群聚會與下一步。\n\n"
                    f"來源帳號:@{card.account}\nURL:{card.url}\n發布時間:{card.published_at}\n既有標題:{card.title}\n內容:{card.raw_text[:3200]}"
                )
                raw = _call_minimax(card, strict_retry_prompt, attempt=3, purpose="validation_retry")
                parsed = parse_json_block(raw)
                if parsed:
                    semantic_ok = _finalize_ai_semantics(card, parsed, model=model_name)
            if semantic_ok:
                editorial_ok = _finalize_ai_editorial(card, parsed, model=model_name)
                if not editorial_ok:
                    semantic_context = json.dumps(
                        {
                            "card_type": card.card_type,
                            "event_facts": card.event_facts or {},
                            "routing_topics": card.routing_topics or [],
                            "product_ids": card.product_ids or [],
                            "sbt_entries": card.sbt_entries or [],
                            "record_result": card.record_result or None,
                            "product_progress_evidence": card.product_progress_evidence or {},
                            "timeline_date": card.timeline_date,
                            "timeline_end_date": card.timeline_end_date,
                            "plan_status": card.plan_status,
                        },
                        ensure_ascii=False,
                    )
                    editorial_retry_prompt = (
                        "你是繁體中文社群編輯。語意分類已通過驗證，現在只重寫公開文案，不得改變分類事實。"
                        "只輸出合法 JSON："
                        "{\"title\":\"\",\"summary\":\"\",\"bullets\":[\"\",\"\",\"\"],"
                        "\"layout\":\"poster|brief|data|timeline\",\"tags\":[\"\"],\"detail_summary\":\"\",\"detail_lines\":[\"\",\"\",\"\",\"\"]}。"
                        "title<=40字、summary<=150字、每條 bullet<=34字；detail_lines 4到6條。"
                        "只能使用原文與已驗證分類資料，不得新增原文沒有的年份、人名、地點、獎勵、限制、Discord、直播或推測。"
                        "tags 只放產品名、卡牌名、合作方或技術名稱，不得放 official、event、product_progress、collectibles 等系統分類詞；原文明確提到 SBT 時可使用 SBT。\n\n"
                        f"已驗證分類：{semantic_context}\n"
                        f"來源帳號:@{card.account}\nURL:{card.url}\n發布時間:{card.published_at}\n原文:{card.raw_text[:4200]}"
                    )
                    editorial_raw = _call_minimax(card, editorial_retry_prompt, attempt=1, purpose="editorial_retry")
                    editorial_parsed = parse_json_block(editorial_raw)
                    if not editorial_parsed:
                        _set_ai_review_queue(card, "editorial_json_parse_failed", model=model_name, preserve_semantics=True)
                    else:
                        _finalize_ai_editorial(card, editorial_parsed, model=model_name)
            _emit(
                "refine_card_done",
                done_cards=index + 1,
                total_cards=total_cards,
                card_id=str(card.id or ""),
                account=str(card.account or ""),
                title=str(card.title or "")[:140],
                url=str(card.url or ""),
                ai_status=str(card.ai_status or ""),
                review_status=str(card.review_status or ""),
                classification_error=str(card.classification_error or "")[:220],
                model=model_name,
            )
        except Exception as exc:
            _set_ai_review_queue(
                card,
                f"ai_request_failed:{type(exc).__name__}",
                model=model_name,
                preserve_semantics=semantic_ok,
            )
            _emit(
                "refine_card_failed",
                done_cards=index + 1,
                total_cards=total_cards,
                card_id=str(card.id or ""),
                account=str(card.account or ""),
                title=str(card.title or "")[:140],
                url=str(card.url or ""),
                error=f"{type(exc).__name__}: {exc}"[:280],
                ai_status=str(card.ai_status or ""),
                review_status=str(card.review_status or ""),
                model=model_name,
            )
            continue


def plan_status_review_due(card: StoryCard, *, now: datetime | None = None) -> bool:
    if str(card.card_type or "").strip().lower() != "product_progress":
        return False
    if str(card.source_role or "").strip().lower() != "official":
        return False
    status = _valid_plan_status(card.plan_status)
    if card.plan_ai_version != PLAN_STATUS_CLASSIFICATION_VERSION or not status or status == "needs_review":
        return True
    if status not in {"upcoming", "in_progress"}:
        return False
    checked = parse_datetime_guess(card.plan_status_checked_at)
    current = now or datetime.now(timezone.utc)
    return checked is None or checked.date() < current.date()


def event_region_review_due(card: StoryCard) -> bool:
    if str(card.card_type or "").strip().lower() != "event":
        return False
    return bool(
        card.event_region_version != EVENT_REGION_CLASSIFICATION_VERSION
        or not _valid_event_region(card.event_region)
        or not clean_text(card.event_region_reason)
        or not str(card.event_region_model or "").strip()
    )


def apply_minimax_event_region_review(
    cards: list[StoryCard],
    api_key: str,
    *,
    progress_callback: Any | None = None,
) -> int:
    """Classify only event geography without rewriting article content."""
    model_name = minimax_model_name()
    updated = 0
    event_cards = [card for card in cards if str(card.card_type or "").strip().lower() == "event"]
    total = len(event_cards)

    for index, card in enumerate(event_cards):
        facts = normalize_event_facts(card.event_facts)
        prompt = (
            "你是 Renaiss 活動地區分類員。只判斷活動所屬地區，不改寫標題、摘要或任何文章內容。"
            "請綜合原文、活動地點、受眾、參與限制與發文帳號，輸出單一合法 JSON："
            "{\"event_region\":\"tw|kr|my|vn|th|global|multi_region|unknown\",\"event_region_reason\":\"\"}。"
            "規則："
            "1) 原文明確出現國家、城市、場地、地址、在地受眾或參加資格時，以文章證據優先；"
            "2) @renaissxyz 是全球主帳號，本身不代表 global；它發布台北實體活動仍應是 tw；"
            "3) @RenaissTwCM/@RenaissKrCM/@RenaissMyCM/@renaiss_vn/@Renaiss_TH 只作為地區線索，"
            "不能推翻原文明確地點；"
            "4) 純線上活動只有在沒有任何地區語言、受眾、資格或帳號限制時才標 global；"
            "5) 線上活動若明確限定某地區，仍標該地區；"
            "6) tw=台灣、kr=韓國、my=馬來西亞、vn=越南、th=泰國、global=全球、"
            "multi_region=原文明確涵蓋兩個以上地區但不等於全球、unknown=證據不足；"
            "7) event_region_reason 必須指出採用的文章證據與帳號線索，不可只重複分類結果；"
            "8) 不可從語言、表情、網路用語或一般發文者所在地單獨推定活動地區；私人帳號不是地區線索；"
            "9) 同時提到兩個以上明確地區時不可任選其中一個當代表，應標 multi_region；不可捏造。\n\n"
            f"來源帳號：@{card.account}\n"
            f"發布時間：{card.published_at}\n"
            f"既有標題：{card.title}\n"
            f"既有摘要：{card.summary}\n"
            f"活動欄位：{json.dumps(facts, ensure_ascii=False)}\n"
            f"原文：{str(card.raw_text or '')[:4200]}"
        )
        try:
            parsed = parse_json_block(minimax_chat(prompt, api_key)) or {}
            if _apply_event_region(
                card,
                region=parsed.get("event_region"),
                reason=parsed.get("event_region_reason"),
                model=model_name,
            ):
                updated += 1
            else:
                card.event_region = "unknown"
                card.event_region_reason = "MiniMax 未回傳有效的活動地區與判斷理由，保留待重新分類狀態。"
                card.event_region_model = model_name
                card.event_region_version = ""
        except Exception as exc:
            card.event_region = "unknown"
            card.event_region_reason = f"MiniMax 活動地區分類失敗：{type(exc).__name__}"
            card.event_region_model = model_name
            card.event_region_version = ""
        if progress_callback:
            try:
                progress_callback(
                    "event_region_review",
                    {
                        "done_cards": index + 1,
                        "total_cards": total,
                        "card_id": str(card.id or ""),
                        "event_region": str(card.event_region or ""),
                        "model": model_name,
                    },
                )
            except Exception:
                pass
    return updated


def apply_minimax_plan_status_review(
    cards: list[StoryCard],
    api_key: str,
    *,
    progress_callback: Any | None = None,
) -> int:
    """Refresh AI-owned lifecycle metadata without rewriting editorial copy."""
    model_name = minimax_model_name()
    checked_at = datetime.now(timezone.utc).isoformat()
    as_of = checked_at[:10]
    updated = 0
    total = len(cards)

    for index, card in enumerate(cards):
        account = normalize_account_handle(card.account)
        account_role = OFFICIAL_X_ACCOUNT_ROLES.get(account, "Renaiss 官方產品帳號")
        prompt = (
            "你是 Renaiss 產品進度分類員。資料來自 Renaiss 的官方產品帳號。"
            "只判斷這則原始貼文在指定日期的產品生命週期，不改寫任何文案。"
            "請輸出單一合法 JSON："
            "{\"plan_status\":\"upcoming|in_progress|completed|cancelled|not_plan|needs_review\",\"plan_status_reason\":\"\"}。"
            f"判斷基準日：{as_of}。"
            "規則：官方來源與 plan_status 都不必然代表產品進度；upcoming 只給基準日之後尚未發生的明確產品計畫；"
            "in_progress 給已開始且原文證明仍持續的測試、開放或開發；"
            "completed 給已上線、售罄、完售、認領完畢、已結束，或原文所述單日發售/啟動日期已經過去的項目；"
            "cancelled 只給明確取消或終止；not_plan 給教學、回顧、一般資訊及沒有剩餘行動的公告；"
            "只有原文與日期仍不足以判斷時才用 needs_review。理由必須引用原文狀態訊號或日期。\n\n"
            f"來源帳號：@{card.account}\n"
            f"來源帳號固定身分：{account_role}\n"
            f"發布時間：{card.published_at}\n"
            f"時間欄位：開始={card.timeline_date or '空'}；結束={card.timeline_end_date or '空'}\n"
            f"標題：{card.title}\n"
            f"摘要：{card.summary}\n"
            f"原文：{card.raw_text[:3600]}"
        )
        try:
            parsed = parse_json_block(minimax_chat(prompt, api_key)) or {}
            if not _apply_plan_status(
                card,
                status=parsed.get("plan_status"),
                reason=parsed.get("plan_status_reason"),
                model=model_name,
                checked_at=checked_at,
            ):
                _apply_plan_status(
                    card,
                    status="needs_review",
                    reason="MiniMax 未回傳有效的規劃狀態與判斷理由。",
                    model=model_name,
                    checked_at=checked_at,
                )
            else:
                updated += 1
        except Exception as exc:
            _apply_plan_status(
                card,
                status="needs_review",
                reason=f"MiniMax 規劃狀態分類失敗：{type(exc).__name__}",
                model=model_name,
                checked_at=checked_at,
            )
        if progress_callback:
            try:
                progress_callback(
                    "plan_status_review",
                    {
                        "done_cards": index + 1,
                        "total_cards": total,
                        "card_id": str(card.id or ""),
                        "plan_status": str(card.plan_status or ""),
                        "model": model_name,
                    },
                )
            except Exception:
                pass
    return updated


def parse_json_block(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    text = text.strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def aggregate_digest(
    cards: list[StoryCard],
    sections: dict[str, list[dict[str, Any]]],
    key_terms: list[str],
    api_key: str | None = None,
) -> dict[str, Any]:
    cards_sorted = sorted(cards, key=lambda c: c.published_at, reverse=True)
    top_titles = [f"- @{c.account}: {c.title}" for c in cards_sorted[:8]]

    digest = {
        "headline": "Spring AI 關鍵情報總結",
        "conclusion": "已從高訊號貼文中整理出官方更新、近期活動、即將開放與社群焦點，避免被零散回覆淹沒。",
        "takeaways": [
            "先看官方更新，確認產品與活動方向。",
            "近期活動用時間與參與方式呈現，減少漏看。",
            "社群焦點只保留有訊息密度的貼文，不再全貼。",
        ],
        "accounts_active": sorted({c.account for c in cards_sorted}),
        "key_terms": key_terms[:12],
    }

    if not api_key or not cards_sorted:
        return digest

    prompt = (
        "你是TCG情報總編。請根據貼文標題與四個情報分類，輸出 JSON：headline,conclusion,takeaways(長度3)。"
        "語氣要像『春季資訊刊』，但保持專業，繁體中文，不可捏造。\n\n"
        + "\n".join(top_titles)
        + "\n\n[official_updates]\n"
        + "\n".join(f"- {x['headline']}" for x in sections.get("official_updates", [])[:4])
        + "\n\n[upcoming_events]\n"
        + "\n".join(f"- {x['headline']}" for x in sections.get("upcoming_events", [])[:4])
        + "\n\n[product_progress]\n"
        + "\n".join(f"- {x['headline']}" for x in sections.get("product_progress", [])[:4])
    )
    try:
        raw = minimax_chat(prompt, api_key)
        parsed = parse_json_block(raw)
        if parsed:
            digest["headline"] = str(parsed.get("headline") or digest["headline"])[:80]
            digest["conclusion"] = str(parsed.get("conclusion") or digest["conclusion"])[:220]
            tks = parsed.get("takeaways")
            if isinstance(tks, list) and tks:
                digest["takeaways"] = [clean_text(str(x))[:90] for x in tks if str(x).strip()][:3]
    except Exception:
        pass

    return digest


def fetch_status_with_twitter_cli(url: str) -> str | None:
    if not shutil_which("twitter"):
        return None
    try:
        proc = subprocess.run(
            ["twitter", "tweet", url, "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=35,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        data = json.loads(proc.stdout)
        content = str(data.get("full_text") or data.get("text") or "").strip()
        if not content:
            return None
        created = str(data.get("created_at") or "").strip()
        title = f'Title: X on X: "{content}" / X\n\nURL Source: {url}\n'
        if created:
            title += f"\nPublished Time: {created}\n"
        title += f"\nMarkdown Content:\n{content}\n"
        return title
    except Exception:
        return None


def parse_datetime_guess(value: str) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None

    candidates = [raw]
    if raw.endswith("Z"):
        candidates.append(raw.replace("Z", "+00:00"))

    for cand in candidates:
        try:
            dt = datetime.fromisoformat(cand)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            pass

    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            continue

    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def parse_twitter_cli_output(stdout: str) -> list[dict[str, Any]]:
    text = (stdout or "").strip()
    if not text:
        return []

    parsed_objects: list[Any] = []
    try:
        parsed = json.loads(text)
        parsed_objects.append(parsed)
    except Exception:
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                parsed_objects.append(json.loads(line))
            except Exception:
                continue

    items: list[dict[str, Any]] = []
    for obj in parsed_objects:
        if isinstance(obj, list):
            for x in obj:
                if isinstance(x, dict):
                    items.append(x)
            continue
        if isinstance(obj, dict):
            candidate_lists = [
                obj.get("tweets"),
                obj.get("items"),
                obj.get("data"),
                obj.get("results"),
                obj.get("statuses"),
            ]
            expanded = False
            for arr in candidate_lists:
                if isinstance(arr, list):
                    expanded = True
                    for x in arr:
                        if isinstance(x, dict):
                            items.append(x)
            if not expanded:
                items.append(obj)
    return items


def build_storycard_from_twitter_cli_item(item: dict[str, Any], username: str) -> StoryCard | None:
    sid = str(item.get("id_str") or item.get("id") or item.get("tweet_id") or "").strip()
    if not sid:
        return None

    text = (
        item.get("full_text")
        or item.get("text")
        or item.get("content")
        or item.get("note_tweet", {}).get("text")
        or ""
    )
    text = clean_text(str(text))
    if len(text) < 8 or is_noise_text(text):
        return None

    created_raw = str(item.get("createdAt") or item.get("created_at") or item.get("date") or item.get("time") or "").strip()
    created_dt = parse_datetime_guess(created_raw) or snowflake_to_datetime(sid)
    url = str(item.get("url") or "").strip()
    if not url:
        url = f"https://x.com/{username}/status/{sid}"

    metrics_raw = item.get("metrics") if isinstance(item.get("metrics"), dict) else {}
    metrics = {
        "likes": int(metrics_raw.get("likes", item.get("favorite_count", item.get("likes", 0))) or 0),
        "replies": int(metrics_raw.get("replies", item.get("reply_count", item.get("conversation_count", item.get("replies", 0)))) or 0),
    }
    cover = extract_first_image(item.get("media"))
    reply_to_id = str(
        item.get("in_reply_to_status_id_str")
        or item.get("in_reply_to_status_id")
        or item.get("inReplyToStatusId")
        or ""
    ).strip()

    card = build_ai_pending_card(
        card_id=sid,
        account=username,
        provider="twitter-cli",
        url=url,
        text=text,
        published_at=created_dt.isoformat(),
        confidence=0.7,
        cover_image=cover,
        metrics=metrics,
        reply_to_id=reply_to_id,
    )
    return card


def fetch_account_cards_with_twitter_cli(
    username: str,
    since_dt: datetime,
    max_posts: int = DEFAULT_MAX_POSTS_PER_ACCOUNT,
) -> list[StoryCard]:
    if not shutil_which("twitter"):
        return []

    target_n = max(max_posts * 4, 36)
    commands = [
        ["twitter", "user-posts", username, "--json", "-n", str(target_n)],
        ["twitter", "search", "--from", username, "--json", "-n", str(target_n), "--exclude", "retweets"],
    ]

    cards: list[StoryCard] = []
    seen_ids: set[str] = set()
    for cmd in commands:
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=45,
                check=False,
            )
        except Exception:
            continue

        if proc.returncode != 0 or not proc.stdout.strip():
            continue

        for item in parse_twitter_cli_output(proc.stdout):
            card = build_storycard_from_twitter_cli_item(item, username=username)
            if not card:
                continue
            try:
                if datetime.fromisoformat(card.published_at) < since_dt:
                    continue
            except Exception:
                pass
            if card.id in seen_ids:
                continue
            seen_ids.add(card.id)
            cards.append(card)
            if len(cards) >= max_posts:
                return sorted(cards, key=lambda c: c.published_at, reverse=True)

        if cards:
            break

    cards.sort(key=lambda c: c.published_at, reverse=True)
    return cards[:max_posts]


def shutil_which(cmd: str) -> str | None:
    from shutil import which

    return which(cmd)


def fetch_status_markdown(username: str, tweet_id: str) -> tuple[str | None, str, dict[str, Any] | None]:
    url = f"https://x.com/{username}/status/{tweet_id}"
    meta = fetch_status_metadata(tweet_id)

    is_article = bool(
        isinstance(meta, dict)
        and (str(meta.get("article_id") or "").strip() or str(meta.get("article_title") or "").strip())
    )
    if is_article:
        article_urls = [
            f"https://r.jina.ai/http://x.com/{username}/status/{tweet_id}",
            f"https://r.jina.ai/http://x.com/{username}/status/{tweet_id}?mx=1",
        ]
        best_markdown = ""
        best_score = (0, 0, 0)
        for article_url in article_urls:
            try:
                candidate = fetch_text(article_url)
            except Exception:
                continue
            blocks = extract_article_blocks(candidate)
            text_chars = sum(len(str(row.get("text") or "")) for row in blocks if isinstance(row, dict))
            image_count = sum(1 for row in blocks if isinstance(row, dict) and row.get("type") == "image")
            score = (1 if text_chars >= 240 else 0, image_count, text_chars)
            if score > best_score:
                best_markdown = candidate
                best_score = score
            if score[0] and image_count:
                break
        if best_markdown and best_score[0]:
            meta["article_fetch_status"] = "complete"
            meta["article_inline_image_count"] = best_score[1]
            return best_markdown, "r.jina.ai", meta
        meta["article_fetch_status"] = "partial"

    twitter_cli_data = fetch_status_with_twitter_cli(url)
    if twitter_cli_data:
        return twitter_cli_data, "twitter-cli", meta

    if isinstance(meta, dict):
        owner = str(meta.get("account") or "").strip().lower().lstrip("@")
        wanted = str(username or "").strip().lower().lstrip("@")
        if owner == wanted and str(meta.get("text") or "").strip():
            return build_markdown_from_status_meta(meta, url), "tweet-result", meta

    try:
        return fetch_text(f"https://r.jina.ai/http://x.com/{username}/status/{tweet_id}"), "r.jina.ai", meta
    except Exception:
        return None, "none", meta


def resolve_discord_monitor_config() -> dict[str, Any]:
    token = str(os.getenv("DISCORD_BOT_TOKEN") or os.getenv("DISCORD_TOKEN") or "").strip()
    raw_channels = str(
        os.getenv("DISCORD_MONITOR_CHANNEL_IDS")
        or os.getenv("DISCORD_MONITOR_CHANNEL_ID")
        or ""
    ).strip()
    channels: list[str] = []
    for piece in re.split(r"[,\s]+", raw_channels):
        cid = piece.strip()
        if not cid or not re.fullmatch(r"\d{6,}", cid):
            continue
        channels.append(cid)
    channels = list(dict.fromkeys(channels))

    raw_limit = str(os.getenv("DISCORD_MONITOR_LIMIT") or DEFAULT_DISCORD_MONITOR_LIMIT).strip()
    try:
        limit = int(raw_limit)
    except Exception:
        limit = DEFAULT_DISCORD_MONITOR_LIMIT
    limit = max(10, min(100, limit))

    enabled_raw = str(os.getenv("DISCORD_MONITOR_ENABLED") or "").strip().lower()
    if enabled_raw in {"0", "false", "off", "no"}:
        enabled = False
    elif enabled_raw in {"1", "true", "on", "yes"}:
        enabled = True
    else:
        enabled = bool(token and channels)

    configured = bool(token and channels)
    return {
        "enabled": bool(enabled and configured),
        "configured": configured,
        "token": token,
        "channel_ids": channels,
        "limit": limit,
    }


def _discord_message_text(item: dict[str, Any]) -> str:
    parts: list[str] = [str(item.get("content") or "")]
    embeds = item.get("embeds") if isinstance(item.get("embeds"), list) else []
    for embed in embeds:
        if not isinstance(embed, dict):
            continue
        for key in ("title", "description"):
            val = str(embed.get(key) or "").strip()
            if val:
                parts.append(val)
        fields = embed.get("fields") if isinstance(embed.get("fields"), list) else []
        for field in fields:
            if not isinstance(field, dict):
                continue
            name = str(field.get("name") or "").strip()
            value = str(field.get("value") or "").strip()
            merged = " ".join(x for x in [name, value] if x)
            if merged:
                parts.append(merged)
    return clean_text(" ".join(parts))


def _discord_first_image(item: dict[str, Any]) -> str:
    attachments = item.get("attachments") if isinstance(item.get("attachments"), list) else []
    for att in attachments:
        if not isinstance(att, dict):
            continue
        content_type = str(att.get("content_type") or "").lower()
        is_image = content_type.startswith("image/") or bool(att.get("width"))
        if not is_image:
            continue
        url = str(att.get("proxy_url") or att.get("url") or "").strip()
        if url.startswith("http"):
            return url
    embeds = item.get("embeds") if isinstance(item.get("embeds"), list) else []
    for embed in embeds:
        if not isinstance(embed, dict):
            continue
        image = embed.get("image") if isinstance(embed.get("image"), dict) else {}
        thumbnail = embed.get("thumbnail") if isinstance(embed.get("thumbnail"), dict) else {}
        for source in (image, thumbnail):
            url = str(source.get("proxy_url") or source.get("url") or "").strip()
            if url.startswith("http"):
                return url
    return ""


def _discord_message_url(item: dict[str, Any], channel_id: str, message_id: str) -> str:
    guild_id = str(item.get("guild_id") or "").strip()
    if guild_id:
        return f"https://discord.com/channels/{guild_id}/{channel_id}/{message_id}"
    return f"https://discord.com/channels/@me/{channel_id}/{message_id}"


def fetch_discord_channel_messages(
    channel_id: str,
    token: str,
    limit: int = DEFAULT_DISCORD_MONITOR_LIMIT,
    after_message_id: str = "",
) -> list[dict[str, Any]]:
    global _DISCORD_AUTH_FAILURE_FINGERPRINT
    token_fingerprint = hashlib.sha256(str(token or "").encode("utf-8", "ignore")).hexdigest()
    if token_fingerprint and token_fingerprint == _DISCORD_AUTH_FAILURE_FINGERPRINT:
        raise RuntimeError("discord_auth_invalid")
    headers = {
        "Authorization": f"Bot {token}",
        "User-Agent": "RenaissIntelDiscordMonitor/1.0",
    }
    params = {"limit": max(1, min(limit, 100))}
    after_id = str(after_message_id or "").strip()
    if re.fullmatch(r"\d{6,}", after_id):
        params["after"] = after_id
    url = f"{DISCORD_API_BASE_URL}/channels/{channel_id}/messages"
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    if resp.status_code >= 400:
        if resp.status_code in {401, 403}:
            _DISCORD_AUTH_FAILURE_FINGERPRINT = token_fingerprint
            raise RuntimeError("discord_auth_invalid")
        body = clean_text(resp.text or "")[:120]
        raise RuntimeError(f"discord_http_{resp.status_code}:{body}".strip())
    data = resp.json()
    if not isinstance(data, list):
        return []
    return [x for x in data if isinstance(x, dict)]


def build_storycard_from_discord_message(item: dict[str, Any], channel_id: str) -> StoryCard | None:
    mid = str(item.get("id") or "").strip()
    if not mid:
        return None

    text = _discord_message_text(item)
    if len(text) < 8 or is_noise_text(text):
        return None

    created_raw = str(item.get("timestamp") or item.get("edited_timestamp") or "").strip()
    created_dt = parse_datetime_guess(created_raw) or datetime.now(timezone.utc)
    author = item.get("author") if isinstance(item.get("author"), dict) else {}
    account = str(author.get("global_name") or author.get("username") or author.get("id") or "discord").strip()
    reply_to_id = ""
    message_ref = item.get("message_reference") if isinstance(item.get("message_reference"), dict) else {}
    if message_ref:
        reply_to_id = str(message_ref.get("message_id") or "").strip()
    if not reply_to_id:
        referenced = item.get("referenced_message") if isinstance(item.get("referenced_message"), dict) else {}
        reply_to_id = str(referenced.get("id") or "").strip()

    card_id = f"discord-{channel_id}-{mid}"
    cover_image = _cache_discord_cover_image(_discord_first_image(item), card_id)

    card = build_ai_pending_card(
        card_id=card_id,
        account=account,
        url=_discord_message_url(item, channel_id, mid),
        text=text,
        published_at=created_dt.isoformat(),
        confidence=0.66,
        provider="discord-rest",
        cover_image=cover_image,
        metrics={},
        reply_to_id=reply_to_id,
    )
    card.source_channel_id = str(channel_id or "")
    card.source_message_id = mid
    card.source_message_timestamp = created_dt.isoformat()
    return card


def collect_discord_cards(
    channel_ids: list[str],
    token: str,
    since_dt: datetime,
    limit_per_channel: int = DEFAULT_DISCORD_MONITOR_LIMIT,
    after_by_channel: dict[str, str] | None = None,
    since_by_channel: dict[str, datetime] | None = None,
) -> tuple[list[StoryCard], dict[str, int], list[str], dict[str, dict[str, Any]]]:
    cards: list[StoryCard] = []
    stats: dict[str, int] = {}
    errors: list[str] = []
    meta: dict[str, dict[str, Any]] = {}
    after_map = after_by_channel if isinstance(after_by_channel, dict) else {}
    since_map = since_by_channel if isinstance(since_by_channel, dict) else {}

    for cid in channel_ids:
        produced = 0
        fetched_count = 0
        latest_message_id = ""
        latest_message_timestamp = ""
        after_id = str(after_map.get(str(cid)) or "").strip()
        channel_since_dt = since_map.get(str(cid))
        if not isinstance(channel_since_dt, datetime):
            channel_since_dt = since_dt
        try:
            messages = fetch_discord_channel_messages(
                cid,
                token=token,
                limit=limit_per_channel,
                after_message_id=after_id,
            )
        except Exception as exc:
            errors.append(f"{cid}: {clean_text(str(exc))[:120]}")
            stats[cid] = 0
            meta[cid] = {
                "fetched_count": 0,
                "produced_count": 0,
                "after_message_id": after_id,
                "since_timestamp": channel_since_dt.isoformat(),
                "latest_message_id": "",
                "latest_message_timestamp": "",
                "error": clean_text(str(exc))[:160],
            }
            continue

        for item in messages:
            fetched_count += 1
            created_raw = str(item.get("timestamp") or item.get("edited_timestamp") or "").strip()
            created_dt = parse_datetime_guess(created_raw)
            mid = str(item.get("id") or "").strip()
            if created_dt and (
                not latest_message_timestamp
                or created_dt > (parse_datetime_guess(latest_message_timestamp) or datetime.min.replace(tzinfo=timezone.utc))
            ):
                latest_message_timestamp = created_dt.isoformat()
                latest_message_id = mid
            if created_dt and created_dt < channel_since_dt:
                continue
            card = build_storycard_from_discord_message(item, channel_id=cid)
            if not card:
                continue
            cards.append(card)
            produced += 1
        stats[cid] = produced
        meta[cid] = {
            "fetched_count": fetched_count,
            "produced_count": produced,
            "after_message_id": after_id,
            "since_timestamp": channel_since_dt.isoformat(),
            "latest_message_id": latest_message_id,
            "latest_message_timestamp": latest_message_timestamp,
        }

    uniq: dict[str, StoryCard] = {}
    for c in cards:
        uniq[c.id] = c
    ordered = list(uniq.values())
    ordered.sort(key=lambda c: c.published_at, reverse=True)
    return ordered, stats, errors, meta


def merge_article_refresh(existing: StoryCard, refreshed: StoryCard) -> None:
    existing.cover_image = refreshed.cover_image or existing.cover_image
    existing.article_id = refreshed.article_id or existing.article_id
    existing.article_title = refreshed.article_title or existing.article_title
    existing.article_preview = refreshed.article_preview or existing.article_preview
    has_complete_refresh = refreshed.article_fetch_status == "complete" and bool(refreshed.article_blocks)
    has_complete_existing = existing.article_fetch_status == "complete" and bool(existing.article_blocks)
    if not has_complete_refresh and has_complete_existing:
        return
    existing.provider = refreshed.provider
    existing.media_images = refreshed.media_images
    existing.article_blocks = refreshed.article_blocks
    existing.article_fetch_status = refreshed.article_fetch_status
    if len(clean_text(refreshed.raw_text or "")) > len(clean_text(existing.raw_text or "")):
        existing.raw_text = refreshed.raw_text


def collect_account_cards(
    username: str,
    since_dt: datetime,
    max_posts: int = DEFAULT_MAX_POSTS_PER_ACCOUNT,
    diagnostics: dict[str, Any] | None = None,
) -> list[StoryCard]:
    scan_started = time.monotonic()
    scan_errors: list[str] = []
    cached_payload = read_json(data_dir() / "x_intel_feed.json", {})
    cached_cards_raw = cached_payload.get("cards") if isinstance(cached_payload, dict) else []
    cached_cards: list[StoryCard] = []
    if isinstance(cached_cards_raw, list):
        for item in cached_cards_raw:
            try:
                if str(item.get("account", "")).lower() != username.lower():
                    continue
                item = dict(item)
                migrate_card_taxonomy_payload(item, item.get("source_role"))
                published = str(item.get("published_at") or "")
                published_dt = datetime.fromisoformat(published) if published else datetime.now(timezone.utc)
                if published_dt.tzinfo is None:
                    published_dt = published_dt.replace(tzinfo=timezone.utc)
                if published_dt < since_dt:
                    continue
                provider_raw = str(item.get("provider") or "cache")
                if provider_raw.startswith("twitter-cli") and not shutil_which("twitter"):
                    provider_raw = "cache"
                cached_cards.append(
                    StoryCard(
                        id=str(item.get("id") or ""),
                        account=str(item.get("account") or username),
                        url=str(item.get("url") or ""),
                        title=str(item.get("title") or ""),
                        summary=str(item.get("summary") or ""),
                        bullets=[str(x) for x in item.get("bullets", []) if str(x).strip()][:3],
                        published_at=published_dt.isoformat(),
                        confidence=float(item.get("confidence") or 0.55),
                        card_type=str(item.get("card_type") or "insight"),
                        layout=str(item.get("layout") or "brief"),
                        tags=[str(x) for x in item.get("tags", []) if str(x).strip()][:3],
                        raw_text=str(item.get("raw_text") or ""),
                        provider=provider_raw,
                        cover_image=str(item.get("cover_image") or ""),
                        media_images=normalize_media_images(item.get("media_images")),
                        article_id=str(item.get("article_id") or ""),
                        article_title=str(item.get("article_title") or ""),
                        article_preview=str(item.get("article_preview") or ""),
                        article_blocks=normalize_article_blocks(item.get("article_blocks")),
                        article_fetch_status=str(item.get("article_fetch_status") or ""),
                        metrics=item.get("metrics") if isinstance(item.get("metrics"), dict) else {},
                        importance=float(item.get("importance") or 0.0),
                        template_id=str(item.get("template_id") or "community_brief"),
                        glance=str(item.get("glance") or ""),
                        timeline_date=str(item.get("timeline_date") or ""),
                        timeline_end_date=str(item.get("timeline_end_date") or ""),
                        urgency=str(item.get("urgency") or "normal"),
                        manual_pick=bool(item.get("manual_pick") or False),
                        manual_pin=bool(item.get("manual_pin") or False),
                        manual_bottom=bool(item.get("manual_bottom") or False),
                        official_update_kind=str(item.get("official_update_kind") or ""),
                        partner_names=[str(x) for x in item.get("partner_names", []) if str(x).strip()][:8] if isinstance(item.get("partner_names"), list) else [],
                        event_facts=normalize_event_facts(item.get("event_facts")),
                        event_region=str(item.get("event_region") or ""),
                        event_region_reason=str(item.get("event_region_reason") or ""),
                        event_region_model=str(item.get("event_region_model") or ""),
                        event_region_version=str(item.get("event_region_version") or ""),
                        routing_topics=normalize_routing_topics(item.get("routing_topics")),
                        product_ids=canonical_product_ids(item.get("product_ids")),
                        sbt_entries=normalize_sbt_entries(item.get("sbt_entries")),
                        record_result=normalize_record_result(item.get("record_result")) or None,
                        detail_summary=str(item.get("detail_summary") or ""),
                        detail_lines=normalize_detail_lines(item.get("detail_lines"), limit=6),
                        reply_to_id=str(item.get("reply_to_id") or ""),
                    )
                )
            except Exception:
                continue

    cards: list[StoryCard] = fetch_account_cards_with_twitter_cli(
        username=username,
        since_dt=since_dt,
        max_posts=max_posts,
    )

    profile_text = fetch_profile_page(username, errors=scan_errors)
    ids: list[str] = extract_status_ids(profile_text, username)

    if len(ids) < max_posts:
        rss_ids = fetch_account_status_ids_from_nitter_rss(
            username,
            limit=max(max_posts * 10, 60),
        )
        if rss_ids:
            existing = set(ids)
            for sid in rss_ids:
                if sid in existing:
                    continue
                existing.add(sid)
                ids.append(sid)

    # fallback: keep previously cached IDs for stability when profile page is rate-limited
    if not ids:
        if isinstance(cached_cards_raw, list):
            for item in cached_cards_raw:
                if str(item.get("account", "")).lower() == username.lower() and item.get("id"):
                    ids.append(str(item["id"]))
        deduped: list[str] = []
        seen_ids: set[str] = set()
        for sid in ids:
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            deduped.append(sid)
        ids = deduped

    seen_card_ids: set[str] = {c.id for c in cards if c.id}
    queue: list[str] = []
    queued: set[str] = set()
    processed: set[str] = set()

    def enqueue_status_id(value: str) -> None:
        sid = str(value or "").strip()
        if not sid or sid in queued:
            return
        queued.add(sid)
        queue.append(sid)

    for sid in ids:
        enqueue_status_id(sid)
    for c in cards:
        if c.id:
            enqueue_status_id(c.id)

    try:
        max_fetch_rounds = int(os.getenv("X_STATUS_FETCH_MAX_ROUNDS") or "0")
    except Exception:
        max_fetch_rounds = 0
    if max_fetch_rounds <= 0:
        max_fetch_rounds = max(max_posts * 4, 12)
    try:
        max_collected = int(os.getenv("X_STATUS_FETCH_MAX_COLLECTED") or "0")
    except Exception:
        max_collected = 0
    if max_collected <= 0:
        max_collected = max(max_posts * 2, max_posts + 4)
    while queue and len(processed) < max_fetch_rounds:
        tweet_id = queue.pop(0)
        if tweet_id in processed:
            continue
        processed.add(tweet_id)

        try:
            if snowflake_to_datetime(tweet_id) < (since_dt - timedelta(days=2)):
                continue
        except Exception:
            continue

        status_markdown, provider, tweet_meta = fetch_status_markdown(username, tweet_id)
        if isinstance(tweet_meta, dict):
            reply_to_id = str(tweet_meta.get("reply_to_id") or tweet_meta.get("parent_id") or "").strip()
            reply_to_account = str(tweet_meta.get("reply_to_account") or tweet_meta.get("parent_account") or "").strip().lower().lstrip("@")
            if reply_to_id and reply_to_account == username.lower().lstrip("@"):
                enqueue_status_id(reply_to_id)

        if status_markdown:
            for rid in extract_status_ids(status_markdown, username):
                if rid != tweet_id:
                    enqueue_status_id(rid)

        if tweet_id in seen_card_ids:
            existing = next((x for x in cards if x.id == tweet_id), None)
            if existing and isinstance(tweet_meta, dict):
                if not existing.reply_to_id:
                    existing.reply_to_id = str(tweet_meta.get("reply_to_id") or tweet_meta.get("parent_id") or "").strip()
                if not existing.cover_image:
                    existing.cover_image = str(tweet_meta.get("cover_image") or "").strip()
                existing.metrics = _merge_metrics(existing.metrics, _metrics_from_tweet_meta(tweet_meta))
                meta_text = clean_text(str(tweet_meta.get("text") or ""))
                if meta_text and len(meta_text) > len(clean_text(existing.raw_text or "")):
                    existing.raw_text = meta_text[:2500]
                if str(tweet_meta.get("article_id") or "").strip() and status_markdown:
                    refreshed = parse_status_page(
                        status_markdown,
                        username=username,
                        tweet_id=tweet_id,
                        url=f"https://x.com/{username}/status/{tweet_id}",
                        provider=provider,
                        tweet_meta=tweet_meta,
                    )
                    if refreshed:
                        merge_article_refresh(existing, refreshed)
            continue

        if not status_markdown:
            continue

        card = parse_status_page(
            status_markdown,
            username=username,
            tweet_id=tweet_id,
            url=f"https://x.com/{username}/status/{tweet_id}",
            provider=provider,
            tweet_meta=tweet_meta,
        )
        if not card:
            continue
        cards.append(card)
        seen_card_ids.add(card.id)
        if len(cards) >= max_collected:
            break

    if cached_cards:
        merged: dict[str, StoryCard] = {c.id: c for c in cached_cards if c.id}
        for c in cards:
            merged[c.id] = c
        cards = list(merged.values())

    cards = merge_reply_chain_cards(cards)
    cards = merge_numbered_thread_cards(cards)
    cards.sort(key=lambda c: c.published_at, reverse=True)
    if diagnostics is not None:
        diagnostics.update({
            "account": username,
            "elapsed_ms": max(0, int(round((time.monotonic() - scan_started) * 1000))),
            "discovered_ids": len(ids),
            "cached_cards": len(cached_cards),
            "result_cards": min(len(cards), max_posts),
            "errors": list(dict.fromkeys(scan_errors))[:6],
        })
    return cards[:max_posts]


def _thread_index(text: str) -> int | None:
    src = strip_links_mentions(clean_text(text))
    if not src:
        return None
    m = THREAD_PREFIX_RE.match(src)
    if not m:
        return None
    try:
        idx = int(m.group(1))
    except Exception:
        return None
    if 1 <= idx <= 20:
        return idx
    return None


def _thread_seed(text: str) -> str:
    src = strip_links_mentions(clean_text(text))
    src = THREAD_PREFIX_RE.sub("", src)
    return compact_point(src, 180)


def _content_token_set(text: str) -> set[str]:
    src = strip_links_mentions(clean_text(text)).lower()
    tokens = set(re.findall(r"[a-z0-9\u4e00-\u9fff]{3,}", src))
    stop = {
        "renaiss", "protocol", "official", "community", "today", "tonight",
        "我們", "今天", "今晚", "這次", "活動", "更新", "分享",
    }
    return {x for x in tokens if x not in stop}


def _token_overlap_ratio(a: str, b: str) -> float:
    a_set = _content_token_set(a)
    b_set = _content_token_set(b)
    if not a_set or not b_set:
        return 0.0
    return len(a_set & b_set) / max(1, min(len(a_set), len(b_set)))


def _sum_metrics(cards: list[StoryCard]) -> dict[str, int]:
    out: dict[str, int] = {"likes": 0, "replies": 0}
    for card in cards:
        metrics = card.metrics if isinstance(card.metrics, dict) else {}
        for key in out:
            out[key] += int(metrics.get(key, 0) or 0)
    return out


def _metrics_from_tweet_meta(tweet_meta: dict[str, Any] | None) -> dict[str, int]:
    if not isinstance(tweet_meta, dict):
        return {}
    metrics = tweet_meta.get("metrics") if isinstance(tweet_meta.get("metrics"), dict) else {}
    return {
        "likes": int(metrics.get("likes", 0) or 0),
        "replies": int(metrics.get("replies", tweet_meta.get("conversation_count", 0)) or 0),
    }


def _merge_metrics(existing_metrics: dict[str, Any] | None, incoming_metrics: dict[str, int]) -> dict[str, int]:
    keys = ("likes", "replies")
    existing = existing_metrics if isinstance(existing_metrics, dict) else {}
    merged: dict[str, int] = {}
    for key in keys:
        merged[key] = max(int(existing.get(key, 0) or 0), int(incoming_metrics.get(key, 0) or 0))
    return merged


def _merge_thread_group(group: list[StoryCard]) -> StoryCard:
    rows = sorted(group, key=lambda c: parse_datetime_guess(c.published_at) or datetime.now(timezone.utc))
    parts: list[str] = []
    for card in rows:
        idx = _thread_index(card.raw_text or card.title)
        prefix = f"{idx}/ " if idx else ""
        body = clean_text(card.raw_text or card.summary or card.title)
        if body:
            parts.append(f"{prefix}{body}")
    merged_raw = "\n\n".join(parts)[:7000]
    first = rows[0]
    last = rows[-1]
    tag_seen: set[str] = set()
    tags: list[str] = []
    for card in rows:
        for tag in card.tags or []:
            t = str(tag or "").strip()
            if not t or t in tag_seen:
                continue
            tag_seen.add(t)
            tags.append(t)
            if len(tags) >= 4:
                break
        if len(tags) >= 4:
            break
    cover = ""
    for card in rows:
        if card.cover_image:
            cover = card.cover_image
            break
    merged = StoryCard(
        id=first.id,
        account=first.account,
        url=first.url,
        title=first.title,
        summary=last.summary or first.summary,
        bullets=(last.bullets or first.bullets)[:3],
        published_at=last.published_at,
        confidence=max(float(c.confidence or 0.0) for c in rows),
        card_type=last.card_type,
        layout=last.layout,
        tags=tags[:3] if tags else (last.tags or first.tags or ["觀點"]),
        raw_text=merged_raw,
        provider=last.provider or first.provider,
        cover_image=cover,
        media_images=next((c.media_images for c in rows if c.media_images), []),
        article_id=next((c.article_id for c in rows if c.article_id), ""),
        article_title=next((c.article_title for c in rows if c.article_title), ""),
        article_preview=next((c.article_preview for c in rows if c.article_preview), ""),
        article_blocks=next((c.article_blocks for c in rows if c.article_blocks), []),
        article_fetch_status=next((c.article_fetch_status for c in rows if c.article_fetch_status), ""),
        metrics=_sum_metrics(rows),
        reply_to_id=str(first.reply_to_id or ""),
        routing_topics=[],
        product_ids=[],
        classified_by="ai",
        ai_model=last.ai_model or first.ai_model or minimax_model_name(),
        ai_version=AI_CLASSIFICATION_VERSION,
        ai_status="pending",
        review_status=AI_REVIEW_ADMIN_QUEUE,
        classification_error="ai_not_run",
    )
    merged.importance = max(float(c.importance or 0.0) for c in rows) + 0.8
    return merged


def merge_reply_chain_cards(cards: list[StoryCard]) -> list[StoryCard]:
    if not cards:
        return cards

    by_account: dict[str, list[StoryCard]] = {}
    for card in cards:
        by_account.setdefault(card.account.lower(), []).append(card)

    merged_cards: list[StoryCard] = []
    member_ids: set[str] = set()

    for _account, rows in by_account.items():
        id_map: dict[str, StoryCard] = {c.id: c for c in rows if c.id}
        if len(id_map) < 2:
            continue

        dsu_parent: dict[str, str] = {sid: sid for sid in id_map}

        def find(x: str) -> str:
            while dsu_parent[x] != x:
                dsu_parent[x] = dsu_parent[dsu_parent[x]]
                x = dsu_parent[x]
            return x

        def union(a: str, b: str) -> None:
            ra = find(a)
            rb = find(b)
            if ra != rb:
                dsu_parent[rb] = ra

        for card in rows:
            sid = card.id
            parent_id = str(card.reply_to_id or "").strip()
            if not sid or not parent_id or parent_id == sid:
                continue
            if parent_id in id_map:
                union(sid, parent_id)

        groups: dict[str, list[StoryCard]] = {}
        for sid, card in id_map.items():
            root = find(sid)
            groups.setdefault(root, []).append(card)

        for group in groups.values():
            if len(group) < 2:
                continue
            ordered = sorted(group, key=lambda c: parse_datetime_guess(c.published_at) or datetime.now(timezone.utc))
            dt_min = parse_datetime_guess(ordered[0].published_at) or datetime.now(timezone.utc)
            dt_max = parse_datetime_guess(ordered[-1].published_at) or dt_min
            # 避免把跨太久的不同討論硬合併成一張卡。
            if (dt_max - dt_min).total_seconds() > 5 * 24 * 3600:
                continue
            merged = _merge_thread_group(ordered)
            merged_cards.append(merged)
            for row in ordered:
                member_ids.add(row.id)

    if not merged_cards:
        return cards

    merged_by_id = {m.id: m for m in merged_cards}
    out: list[StoryCard] = []
    inserted_ids: set[str] = set()
    for card in cards:
        if card.id not in member_ids:
            out.append(card)
            continue
        replacement = merged_by_id.get(card.id)
        if replacement is None:
            continue
        if replacement.id in inserted_ids:
            continue
        out.append(replacement)
        inserted_ids.add(replacement.id)

    for merged in merged_cards:
        if merged.id in inserted_ids:
            continue
        if any(c.id == merged.id for c in out):
            continue
        out.append(merged)
        inserted_ids.add(merged.id)
    return out


def _find_neighbor_non_indexed(
    rows_sorted: list[StoryCard],
    pivot: StoryCard,
    direction: int,
    used_ids: set[str],
    max_hours: int = 12,
) -> StoryCard | None:
    if not rows_sorted:
        return None
    try:
        idx = rows_sorted.index(pivot)
    except ValueError:
        return None
    if direction not in {-1, 1}:
        return None

    base_dt = parse_datetime_guess(pivot.published_at) or datetime.now(timezone.utc)
    base_seed = _thread_seed(pivot.raw_text or pivot.title)
    base_topic = infer_topic_phrase(pivot.raw_text or pivot.title, pivot.card_type)
    p = idx + direction
    while 0 <= p < len(rows_sorted):
        cand = rows_sorted[p]
        p += direction
        if cand.id in used_ids:
            continue
        if _thread_index(cand.raw_text or cand.title):
            continue
        cand_dt = parse_datetime_guess(cand.published_at) or datetime.now(timezone.utc)
        if abs((cand_dt - base_dt).total_seconds()) > max_hours * 3600:
            continue
        cand_seed = _thread_seed(cand.raw_text or cand.title)
        cand_topic = infer_topic_phrase(cand.raw_text or cand.title, cand.card_type)
        overlap = _token_overlap_ratio(base_seed, cand_seed)
        topic_match = dedupe_key(base_topic) == dedupe_key(cand_topic)
        if overlap >= 0.18 or topic_match:
            return cand
    return None


def merge_numbered_thread_cards(cards: list[StoryCard]) -> list[StoryCard]:
    if not cards:
        return cards

    by_account: dict[str, list[StoryCard]] = {}
    for card in cards:
        by_account.setdefault(card.account.lower(), []).append(card)

    member_ids_in_merged: set[str] = set()
    merged_cards: list[StoryCard] = []

    for _account, rows in by_account.items():
        rows_sorted = sorted(rows, key=lambda c: parse_datetime_guess(c.published_at) or datetime.now(timezone.utc))
        n = len(rows_sorted)
        i = 0
        while i < n:
            base = rows_sorted[i]
            base_idx = _thread_index(base.raw_text or base.title)
            if not base_idx:
                i += 1
                continue
            base_dt = parse_datetime_guess(base.published_at) or datetime.now(timezone.utc)
            base_seed = _thread_seed(base.raw_text or base.title)
            base_topic = infer_topic_phrase(base.raw_text or base.title, base.card_type)

            group = [base]
            last_idx = base_idx
            j = i + 1
            while j < n:
                cand = rows_sorted[j]
                cand_idx = _thread_index(cand.raw_text or cand.title)
                if not cand_idx:
                    j += 1
                    continue
                cand_dt = parse_datetime_guess(cand.published_at) or datetime.now(timezone.utc)
                if abs((cand_dt - base_dt).total_seconds()) > 48 * 3600:
                    j += 1
                    continue
                cand_seed = _thread_seed(cand.raw_text or cand.title)
                cand_topic = infer_topic_phrase(cand.raw_text or cand.title, cand.card_type)
                overlap = _token_overlap_ratio(base_seed, cand_seed)
                topic_match = dedupe_key(base_topic) == dedupe_key(cand_topic)
                index_related = (
                    abs(cand_idx - last_idx) <= 10
                    or abs(cand_idx - base_idx) <= 10
                )
                if (overlap >= 0.2 or topic_match) and index_related:
                    group.append(cand)
                    last_idx = max(last_idx, cand_idx)
                    if len(group) >= 6:
                        break
                j += 1

            if group:
                group_sorted = sorted(group, key=lambda c: parse_datetime_guess(c.published_at) or datetime.now(timezone.utc))
                head = group_sorted[0]
                tail = group_sorted[-1]
                root_neighbor = _find_neighbor_non_indexed(rows_sorted, head, direction=-1, used_ids=member_ids_in_merged)
                tail_neighbor = _find_neighbor_non_indexed(rows_sorted, tail, direction=1, used_ids=member_ids_in_merged)
                if root_neighbor and all(root_neighbor.id != c.id for c in group):
                    group.append(root_neighbor)
                if tail_neighbor and all(tail_neighbor.id != c.id for c in group):
                    group.append(tail_neighbor)

            if len(group) >= 2:
                merged = _merge_thread_group(group)
                merged_cards.append(merged)
                for c in group:
                    member_ids_in_merged.add(c.id)
            i += 1

    if not merged_cards:
        return cards

    out: list[StoryCard] = []
    inserted_ids: set[str] = set()
    for card in cards:
        if card.id in member_ids_in_merged:
            if card.id in inserted_ids:
                continue
            replacement = next((m for m in merged_cards if m.id == card.id), None)
            if replacement is not None:
                out.append(replacement)
                inserted_ids.add(card.id)
            continue
        out.append(card)
    for merged in merged_cards:
        if merged.id not in inserted_ids and all(c.id != merged.id for c in out):
            out.append(merged)
            inserted_ids.add(merged.id)
    return out


def normalize_x_url(input_url: str) -> str:
    raw = (input_url or "").strip()
    if not raw:
        raise ValueError("empty URL")
    if raw.startswith("http://"):
        raw = "https://" + raw[len("http://") :]
    if not raw.startswith("https://"):
        raw = "https://" + raw

    parsed = urlparse(raw)
    if parsed.netloc not in {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}:
        raise ValueError("only x.com/twitter.com URLs are supported")
    path = parsed.path.strip("/")
    match = STATUS_RE.search(f"https://x.com/{path}")
    if not match:
        raise ValueError("invalid tweet URL")

    username, tweet_id = match.group(1), match.group(2)
    return f"https://x.com/{username}/status/{tweet_id}"


def build_card_from_url(tweet_url: str, api_key: str | None = None) -> StoryCard:
    normalized = normalize_x_url(tweet_url)
    match = STATUS_RE.search(normalized)
    if not match:
        raise ValueError("invalid tweet URL")
    username, tweet_id = match.group(1), match.group(2)

    status_markdown, provider, tweet_meta = fetch_status_markdown(username, tweet_id)
    if not status_markdown:
        raise RuntimeError("unable to fetch tweet")
    card = parse_status_page(
        status_markdown,
        username,
        tweet_id,
        normalized,
        provider=provider,
        tweet_meta=tweet_meta,
    )
    if not card:
        raise RuntimeError("unable to parse tweet")

    if api_key:
        apply_minimax_story_refine([card], api_key, feedback_context=feedback_training_text())

    return card


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default
