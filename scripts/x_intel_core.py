#!/usr/bin/env python3
"""Core pipeline for X account ingestion + AI digest rendering data."""

from __future__ import annotations

import json
import os
import re
import site
import subprocess
import sys
from html import unescape
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - fallback for minimal environments
    def load_dotenv(*_args: Any, **_kwargs: Any) -> bool:
        return False

DEFAULT_ACCOUNTS = ["TCGRWA", "ChenYichiao", "renaissxyz", "davidcheang99"]
DEFAULT_WINDOW_DAYS = 30
DEFAULT_MAX_POSTS_PER_ACCOUNT = 20
DEFAULT_DISCORD_MONITOR_LIMIT = 80
DEFAULT_CURATED_MAX_CARDS = 24
MINIMAX_URL = "https://api.minimax.io/v1/text/chatcompletion_v2"
SYNDICATION_TWEET_URL = "https://cdn.syndication.twimg.com/tweet-result"
DISCORD_API_BASE_URL = "https://discord.com/api/v10"
ALLOWED_CARD_TYPES = {"event", "market", "report", "announcement", "feature", "insight"}
ALLOWED_FEEDBACK_LABELS = ALLOWED_CARD_TYPES | {"exclude"}
ALLOWED_TOPIC_LABELS = {"events", "official", "sbt", "pokemon", "alpha", "tools", "other"}

STATUS_RE = re.compile(r"https?://x\.com/([A-Za-z0-9_]+)/status/(\d+)", re.I)
TITLE_RE = re.compile(r"^Title:\s*(.+?)\s*/\s*X\s*$", re.M | re.S)
PUBLISHED_RE = re.compile(r"^Published Time:\s*(.+)$", re.M)
MARKDOWN_RE = re.compile(r"Markdown Content:\s*(.*)$", re.S)
LINK_RE = re.compile(r"https?://[^\s)]+")
IMAGE_RE = re.compile(r"!\[[^\]]*\]\((https?://[^)]+)\)")
EVENT_SIGNAL_RE = re.compile(
    r"活動|\bevent\b|直播|\blive\b|\bama\b|\bspace\b|community\s*session|join us|報名|报名|\btour\b|\bfestival\b|開包活動|开包活动|参赛|參賽|竞猜|\bgathering\b|\bplaza\b|"
    r"goes live|restock(?:ing)?|poker night|get ready|drops?\b|開賣|开卖",
    re.I,
)
FEATURE_SIGNAL_RE = re.compile(
    r"progress update|roadmap|版本|version|beta|上線|上线|開放|开放|launch|功能|v2|2\.0|update|即將|coming|mfa|2fa|multi[-\s]*factor|authenticator|authentication|security|帳號安全|账号安全|登入保護|登录保护|setting page|設定頁|设置页",
    re.I,
)
GUIDE_SIGNAL_RE = re.compile(
    r"攻略|教學|教程|指南|心得|介紹|介绍|怎麼|怎么|如何|運費|运费|價格|价格|優點|缺點|集運|集运|buy and ship|分享",
    re.I,
)
LIVE_REWARD_RE = re.compile(
    r"((?:直播|live\s+(?:attendees?|session|stream)|ama|community\s*session).{0,42}(?:sbt|积分|積分|reward|rewards|奖励|獎勵|merch|周邊|周边))|"
    r"((?:sbt|积分|積分|reward|rewards|奖励|獎勵|merch|周邊|周边).{0,42}(?:直播|live\s+(?:attendees?|session|stream)|ama|community\s*session))",
    re.I,
)
PARTICIPATION_SIGNAL_RE = re.compile(
    r"join us|join on|register|signup|報名|报名|參與|参与|出席|attend|參加|参加|discord|space|直播|\blive\b|\bama\b|\bsession\b|地點|地点|venue|填表|投票|互動|互动|attendees?",
    re.I,
)
LOCATION_SIGNAL_RE = re.compile(
    r"hong\s*kong|taipei|台北|台灣|台湾|web3\s*festival|\btour\b|card\s*shop|\bplaza\b|\bvenue\b|線下|线下|\bmeetup\b|causeway\s*bay|restaurant|booth",
    re.I,
)
MARKET_SIGNAL_RE = re.compile(
    r"price|市場|市场|交易量|volume|成交|涨|漲|跌|估值|fmv|回購|回购|\$\d|sold\s+for|record\s*breaker",
    re.I,
)
ANNOUNCE_SIGNAL_RE = re.compile(
    r"announce|公告|發佈|发布|updated?|更新|official|官方|progress update|changelog|roadmap",
    re.I,
)
REPORT_SIGNAL_RE = re.compile(
    r"分析|report|投研|guide|教程|教學|教学|指南|策略|总结|總結|整理|懶人包|懒人包",
    re.I,
)
REWARD_SIGNAL_RE = re.compile(
    r"sbt|reward|rewards|獎勵|奖励|獎品|prize|airdrop|積分|积分|points?|merch|周邊|周边|coupon|白名單|whitelist",
    re.I,
)
AUDIENCE_SIGNAL_RE = re.compile(
    r"新手|玩家|觀眾|观众|社群|community|collectors?|holders?|參賽者|参赛者|all regions|多語|multi-language",
    re.I,
)
JOIN_SIGNAL_RE = re.compile(
    r"報名|报名|register|signup|join us|join on|填表|參與|参与|投票|互動|互动|discord|space|直播|\blive\b|\bama\b|\bsession\b|attendees?",
    re.I,
)
EVENT_LOCATION_RE = re.compile(
    r"香港|hong\s*kong|台北|taipei|線上|线上|discord|space|web3\s*festival|plaza|card\s*shop|場地|地点|venue",
    re.I,
)
REPORT_OPTION_START_RE = re.compile(
    r"(?:^|[\s。；;])(\d{1,2})\s*[\.、)\]]\s*([A-Za-z0-9\u4e00-\u9fff _&+\-]{2,40})\s*[:：]",
    re.I,
)
THREAD_PREFIX_RE = re.compile(r"^\s*(\d{1,2})\s*/\s*(?:\d{1,2})?\s*", re.I)
SBT_THRESHOLD_RE = re.compile(
    r"(?:(?:top|前)\s*([0-9]{1,3})\s*%[^0-9]{0,8}([0-9][0-9,]*)\s*(?:points?|pts?|分|積分)?)",
    re.I,
)
SBT_SNAPSHOT_RE = re.compile(r"(?i)(?:snapshot|快照)\s*[:：]?\s*([^\n。；;]{4,88})")
STRICT_EVENT_CALL_RE = re.compile(
    r"join us|join on|register|signup|報名|报名|參加|参加|參與|参与|attend|attendees?|live\s+(?:session|stream|ama)|community\s*session|ama|space|tour|festival|meetup|線下|线下|venue|booth|地點|地点",
    re.I,
)
SBT_THRESHOLD_NOTICE_RE = re.compile(
    r"((?:sbt|soulbound|points?|積分|积分).{0,42}(?:threshold|snapshot|top\s*\d+%|門檻|快照|排名|rank))|"
    r"((?:threshold|snapshot|top\s*\d+%|門檻|快照|排名|rank).{0,42}(?:sbt|soulbound|points?|積分|积分))",
    re.I,
)


@dataclass
class StoryCard:
    id: str
    account: str
    url: str
    title: str
    summary: str
    bullets: list[str]
    published_at: str
    confidence: float
    card_type: str
    layout: str
    tags: list[str]
    raw_text: str
    provider: str = "r.jina.ai"
    cover_image: str = ""
    metrics: dict[str, int] | None = None
    importance: float = 0.0
    template_id: str = "community_brief"
    glance: str = ""
    timeline_date: str = ""
    urgency: str = "normal"
    manual_pick: bool = False
    manual_pin: bool = False
    manual_bottom: bool = False
    event_facts: dict[str, str] | None = None
    topic_labels: list[str] | None = None
    detail_summary: str = ""
    detail_lines: list[str] | None = None
    reply_to_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "account": self.account,
            "url": self.url,
            "title": self.title,
            "summary": self.summary,
            "bullets": self.bullets,
            "published_at": self.published_at,
            "confidence": self.confidence,
            "card_type": self.card_type,
            "layout": self.layout,
            "tags": self.tags,
            "raw_text": self.raw_text,
            "provider": self.provider,
            "cover_image": self.cover_image,
            "metrics": self.metrics or {},
            "importance": self.importance,
            "template_id": self.template_id,
            "glance": self.glance,
            "timeline_date": self.timeline_date,
            "urgency": self.urgency,
            "manual_pick": self.manual_pick,
            "manual_pin": self.manual_pin,
            "manual_bottom": self.manual_bottom,
            "event_facts": self.event_facts or {},
            "topic_labels": self.topic_labels or [],
            "detail_summary": self.detail_summary,
            "detail_lines": self.detail_lines or [],
            "reply_to_id": self.reply_to_id,
        }


SYNDICATION_META_CACHE: dict[str, dict[str, Any]] = {}


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def website_root() -> Path:
    return Path(__file__).resolve().parents[1]


def data_dir() -> Path:
    path = website_root() / "data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_environment() -> None:
    load_dotenv(project_root() / ".env")
    load_dotenv(website_root() / ".env")
    load_dotenv(project_root() / "old" / "tcg_pro" / ".env")
    user_bin = Path(site.getuserbase()) / "bin"
    py_minor_bin = Path.home() / "Library" / "Python" / f"{sys.version_info.major}.{sys.version_info.minor}" / "bin"
    path_parts = os.environ.get("PATH", "").split(":")
    for candidate in (user_bin, py_minor_bin):
        c = str(candidate)
        if candidate.exists() and c not in path_parts:
            path_parts.append(c)
    os.environ["PATH"] = ":".join([p for p in path_parts if p])


def resolve_minimax_key() -> str:
    candidates = [
        "MINIMAX_API_KEY",
        "MINIMAX_KEY",
        "MINIMAX_TEXT_API_KEY",
        "MINIMAX_TOKEN",
    ]
    for name in candidates:
        value = str(os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def clean_text(text: str) -> str:
    text = unescape(str(text or ""))
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]+\]\([^)]*\)", " ", text)
    text = re.sub(r"(?i)\bshow translation\b", " ", text)
    text = re.sub(r"\bRead\\s+\\d+\\s+replies\\b", " ", text, flags=re.I)
    text = re.sub(r"\b\d{1,2}:\d{2}:\d{2}\b", " ", text)
    text = re.sub(r"(?:^|\s)[·•]\s*\d[\d,]*(?:\s+\d[\d,]*){2,6}(?=\s*(?:Read\s+\d+\s+replies\b|$))", " ", text, flags=re.I)
    text = text.replace("\\n", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def strip_links_mentions(text: str) -> str:
    t = str(text or "")
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"@\w+", " ", t)
    t = re.sub(r"#\w+", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def similarity_ratio(a: str, b: str) -> float:
    a_norm = re.sub(r"\s+", " ", strip_links_mentions(a).lower()).strip()
    b_norm = re.sub(r"\s+", " ", strip_links_mentions(b).lower()).strip()
    if not a_norm or not b_norm:
        return 0.0
    if a_norm in b_norm or b_norm in a_norm:
        return 1.0
    a_set = set(re.findall(r"[a-z0-9\u4e00-\u9fff]{2,}", a_norm))
    b_set = set(re.findall(r"[a-z0-9\u4e00-\u9fff]{2,}", b_norm))
    if not a_set or not b_set:
        return 0.0
    overlap = len(a_set & b_set)
    return overlap / max(len(a_set), len(b_set))


def split_sentences(text: str) -> list[str]:
    src = clean_text(text)
    if not src:
        return []
    parts = re.split(r"[。！？!?]|(?:\s{2,})|(?:\s*•\s*)", src)
    out: list[str] = []
    for p in parts:
        p = clean_text(p)
        p = re.sub(r"^\d+/\s*", "", p).strip()
        if len(strip_links_mentions(p)) < 8:
            continue
        out.append(p)
    return out


def pick_signal_lines(text: str, limit: int = 4) -> list[str]:
    lines = split_sentences(text)
    if not lines:
        return []
    ranked: list[tuple[float, str]] = []
    key_patterns = [
        r"\b(apr|may|jun|jul|aug|sep|oct|nov|dec)\b",
        r"\b\d{1,2}/\d{1,2}\b",
        r"\b(utc|gmt|pm|am)\b",
        r"\b(v2|2\.0|beta|launch|open|coming)\b",
        r"活動|更新|公告|功能|市場|上線|開放|報名|直播|抽卡|統計",
        r"\$\d+|\d+%",
    ]
    for line in lines:
        plain = strip_links_mentions(line)
        score = min(2.6, len(plain) / 64.0)
        for pat in key_patterns:
            if re.search(pat, line, re.I):
                score += 0.8
        if len(re.findall(r"@\w+", line)) >= 3:
            score -= 0.5
        ranked.append((score, line))
    ranked.sort(key=lambda x: x[0], reverse=True)
    result: list[str] = []
    seen: set[str] = set()
    for _, line in ranked:
        key = dedupe_key(line)
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        result.append(line)
        if len(result) >= limit:
            break
    return result


def extract_numeric_facts(text: str, limit: int = 3) -> list[str]:
    uniq: list[str] = []
    src = str(text or "")
    for m in re.finditer(r"\$?\d[\d,]*(?:\.\d+)?(?:[kKmMbB])?%?", src):
        h = clean_text(m.group(0))
        if not h:
            continue
        h = h.rstrip(",")
        if not h:
            continue
        if re.fullmatch(r"\d{1,2}", h):
            continue
        if re.fullmatch(r"\d{1,2}[:：]\d{2}", h):
            continue
        if h in {"0", "00"}:
            continue
        ctx = src[max(0, m.start() - 12) : min(len(src), m.end() + 12)].lower()
        has_unit = bool(
            re.search(
                r"card|cards|pack|packs|users|volume|成交|交易量|萬|千|億|usd|ntd|u\b|points|積分|sbt|%|billion|million|bn|mn",
                ctx,
                re.I,
            )
        )
        numeric = h.replace("$", "").replace(",", "").replace("%", "")
        scale = 1.0
        if numeric.lower().endswith("k"):
            scale = 1_000.0
            numeric = numeric[:-1]
        elif numeric.lower().endswith("m"):
            scale = 1_000_000.0
            numeric = numeric[:-1]
        elif numeric.lower().endswith("b"):
            scale = 1_000_000_000.0
            numeric = numeric[:-1]
        try:
            nval = float(numeric) * scale
        except Exception:
            nval = 0.0
        # Skip plain year-like tokens (e.g. 2023) unless they carry a financial/percentage signal.
        if 1900 <= nval <= 2099 and "$" not in h and "%" not in h and not has_unit:
            continue
        if nval and nval < 10 and "$" not in h and "%" not in h and not has_unit:
            continue
        if "%" not in h and "$" not in h and "," not in h and not has_unit and nval < 100:
            continue
        if h in uniq:
            continue
        uniq.append(h)
        if len(uniq) >= limit:
            break
    return uniq


def extract_schedule_facts(text: str, limit: int = 3) -> list[str]:
    src = clean_text(text)
    if not src:
        return []

    pats = [
        re.compile(
            r"(?<![:\d])(?:[01]?\d|2[0-3])[:：][0-5]\d\s*(?:am|pm)\b(?:\s*\(?(?:utc|gmt)\s*[+＋−-]?\d+\)?)?",
            re.I,
        ),
        re.compile(r"\b(?:apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:\s*-\s*\d{1,2})?", re.I),
        re.compile(r"\b(?:20\d{2}/)?\d{1,2}/\d{1,2}(?:\s*[-~到至]\s*\d{1,2})?", re.I),
        re.compile(r"(?:20\d{2}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号|號)?(?:\s*[-~到至]\s*\d{1,2}\s*(?:日|号|號)?)?", re.I),
        re.compile(r"(?<![:\d])(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b", re.I),
        re.compile(r"(?<![:\d])(?:[01]?\d|2[0-3])[:：][0-5]\d(?![:\d])", re.I),
        re.compile(r"\b(?:utc|gmt)\s*[+-]?\d+\b|utc[+＋−-]\d+", re.I),
        re.compile(r"(?:本週|下週|週末|明天|今晚|即將|今天|今日|稍後|稍后|tonight|tomorrow|today|live now|this week|next week)", re.I),
    ]
    found: list[str] = []
    for pat in pats:
        for match in pat.finditer(src):
            token = clean_text(match.group(0))
            if not token:
                continue
            if not _keep_schedule_fact(src, token, match.start(), match.end()):
                continue
            if token in found:
                continue
            found.append(token)
            if len(found) >= limit:
                return found
    return found


def _contains_calendar_date(text: str) -> bool:
    src = str(text or "")
    if not src:
        return False
    return bool(
        re.search(
            r"(?i)\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b|"
            r"\b(?:20\d{2}/)?\d{1,2}/\d{1,2}\b|"
            r"(?:20\d{2}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号|號)?",
            src,
        )
    )


def _keep_schedule_fact(source: str, token: str, start: int, end: int) -> bool:
    low = token.lower()
    ctx = source[max(0, start - 20) : min(len(source), end + 24)].lower()
    if re.search(r"views?|repl(?:y|ies)|播放|觀看", ctx, re.I):
        return False
    if re.fullmatch(r"(?:[01]?\d|2[0-3])[:：][0-5]\d", token):
        if re.search(rf"{re.escape(token)}\s*(?:am|pm)", source, re.I):
            return True
        if re.search(r"(?:utc|gmt)\s*[+＋−-]?\d+", source, re.I):
            return True
        if re.search(r"[-~–—至到]\s*(?:[01]?\d|2[0-3])[:：][0-5]\d", ctx):
            return True
        if re.search(r"(join us|live|session|ama|活動|event|報名|register)", source, re.I):
            return True
        return False
    if re.search(r"today|tonight|tomorrow|今天|今晚|明天|本週|下週|週末|即將|稍後|稍后", low, re.I):
        return bool(re.search(r"(join us|live|session|ama|活動|event|報名|register|discord)", source, re.I))
    return True


def snowflake_to_datetime(tweet_id: str) -> datetime:
    # Twitter Snowflake epoch: 1288834974657
    ts_ms = (int(tweet_id) >> 22) + 1288834974657
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)


def fetch_text(url: str, timeout: int = 45) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; RenaissXIntel/1.0)",
        "Accept": "text/plain, text/markdown;q=0.9, */*;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def fetch_profile_page(username: str) -> str:
    variants = [
        f"https://r.jina.ai/http://x.com/{username}",
        f"https://r.jina.ai/http://x.com/{username}?mx=1",
    ]
    combined: list[str] = []
    for url in variants:
        try:
            combined.append(fetch_text(url))
        except Exception:
            continue
    return "\n\n".join(combined)


def fetch_account_status_ids_from_nitter_rss(username: str, limit: int = 80) -> list[str]:
    uname = str(username or "").strip().lstrip("@")
    if not uname:
        return []
    url = f"https://nitter.net/{uname}/rss"
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; RenaissXIntel/1.0)"},
            timeout=30,
        )
        if resp.status_code != 200 or not resp.text.strip():
            return []
        text = resp.text
    except Exception:
        return []

    pat = re.compile(rf"/{re.escape(uname)}/status/(\d+)", re.I)
    out: list[str] = []
    seen: set[str] = set()
    for sid in pat.findall(text):
        if sid in seen:
            continue
        seen.add(sid)
        out.append(sid)
        if len(out) >= max(1, int(limit)):
            break
    return out


def _extract_syndication_cover(data: dict[str, Any]) -> str:
    photos = data.get("photos") if isinstance(data.get("photos"), list) else []
    for item in photos:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if url.startswith("http"):
            return url

    media = data.get("mediaDetails") if isinstance(data.get("mediaDetails"), list) else []
    for item in media:
        if not isinstance(item, dict):
            continue
        url = str(item.get("media_url_https") or "").strip()
        if url.startswith("http"):
            return url

    card = data.get("card") if isinstance(data.get("card"), dict) else {}
    bindings = card.get("binding_values") if isinstance(card.get("binding_values"), dict) else {}
    for key in (
        "broadcast_thumbnail_original",
        "broadcast_thumbnail_x_large",
        "broadcast_thumbnail_large",
        "broadcast_thumbnail",
        "photo_image_full_size_original",
        "photo_image_full_size_large",
    ):
        entry = bindings.get(key)
        if not isinstance(entry, dict):
            continue
        image_value = entry.get("image_value") if isinstance(entry.get("image_value"), dict) else {}
        url = str(image_value.get("url") or "").strip()
        if url.startswith("http"):
            return url
    return ""


def fetch_status_metadata(tweet_id: str, force: bool = False) -> dict[str, Any] | None:
    sid = str(tweet_id or "").strip()
    if not sid:
        return None
    if not force and sid in SYNDICATION_META_CACHE:
        cached = SYNDICATION_META_CACHE.get(sid) or {}
        return dict(cached) if cached else None
    params = {"id": sid, "token": "a"}
    try:
        resp = requests.get(SYNDICATION_TWEET_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if not isinstance(data, dict) or not data:
        return None

    user = data.get("user") if isinstance(data.get("user"), dict) else {}
    account = str(user.get("screen_name") or "").strip()
    display_name = str(user.get("name") or "").strip()
    note_tweet = data.get("note_tweet") if isinstance(data.get("note_tweet"), dict) else {}
    note_text = str(note_tweet.get("text") or "").strip()
    text = str(data.get("text") or "").strip()
    if len(note_text) > len(text):
        text = note_text

    created_raw = str(data.get("created_at") or "").strip()
    created_dt = parse_datetime_guess(created_raw)
    created_iso = created_dt.isoformat() if created_dt else ""

    reply_to_id = str(
        data.get("in_reply_to_status_id_str")
        or data.get("in_reply_to_status_id")
        or data.get("parent_tweet_id_str")
        or ""
    ).strip()
    reply_to_account = str(data.get("in_reply_to_screen_name") or "").strip()

    parent = data.get("parent") if isinstance(data.get("parent"), dict) else {}
    parent_id = str(parent.get("id_str") or "").strip()
    parent_user = parent.get("user") if isinstance(parent.get("user"), dict) else {}
    parent_account = str(parent_user.get("screen_name") or "").strip()
    parent_text = str(parent.get("text") or "").strip()
    if not reply_to_id and parent_id:
        reply_to_id = parent_id
    if not reply_to_account and parent_account:
        reply_to_account = parent_account

    meta = {
        "id": str(data.get("id_str") or sid),
        "account": account,
        "display_name": display_name,
        "text": clean_text(text),
        "created_at": created_raw,
        "created_at_iso": created_iso,
        "reply_to_id": reply_to_id,
        "reply_to_account": reply_to_account,
        "parent_id": parent_id,
        "parent_account": parent_account,
        "parent_text": clean_text(parent_text),
        "conversation_count": int(data.get("conversation_count") or 0),
        "cover_image": _extract_syndication_cover(data),
    }
    SYNDICATION_META_CACHE[sid] = meta
    return dict(meta)


def build_markdown_from_status_meta(meta: dict[str, Any], url: str) -> str:
    text = clean_text(str(meta.get("text") or ""))
    account = str(meta.get("account") or "x_user").strip()
    display_name = str(meta.get("display_name") or account).strip()
    created = str(meta.get("created_at") or "").strip()
    title = f'Title: {display_name} on X: "{text}" / X\n\nURL Source: {url}\n'
    if created:
        title += f"\nPublished Time: {created}\n"
    title += f"\nMarkdown Content:\n{text}\n"
    return title


def extract_status_ids(page_text: str, username: str) -> list[str]:
    if not page_text:
        return []
    wanted = username.lower().lstrip("@")
    seen: set[str] = set()
    result: list[str] = []
    for owner, sid in STATUS_RE.findall(page_text):
        if owner.lower().lstrip("@") != wanted:
            continue
        if sid in seen:
            continue
        seen.add(sid)
        result.append(sid)
    return result


def _extract_title(title_line: str) -> str:
    # pattern: user on X: "tweet text"
    marker = ' on X: '
    if marker in title_line:
        body = title_line.split(marker, 1)[1].strip()
        if body.startswith('"') and body.endswith('"'):
            body = body[1:-1]
        return clean_text(body)
    return clean_text(title_line)


def extract_focus_content(markdown_body: str) -> str:
    body = str(markdown_body or "")
    if not body:
        return ""

    for marker in ("# Conversation", "## Conversation", "# Post", "## Post"):
        if marker in body:
            body = body.split(marker, 1)[1]
            break

    for stop in ("## New to X?", "## Trending now", "Terms of Service", "© 2026 X Corp."):
        if stop in body:
            body = body.split(stop, 1)[0]

    boilerplate = [
        "Don’t miss what’s happening",
        "People on X are the first to know",
        "See new posts",
        "Sign up with Apple",
        "Sign up with Google",
    ]
    for token in boilerplate:
        body = body.replace(token, " ")

    body = re.sub(r"^#+\\s*", "", body, flags=re.M)
    body = re.sub(r"https://t\\.co/\\S+", " ", body)
    return clean_text(body)


def is_noise_text(text: str) -> bool:
    plain = strip_links_mentions(text)
    plain_lower = plain.lower()
    if len(plain) < 18:
        return True
    if re.fullmatch(r"[\W_]+", plain):
        return True
    if re.match(r"^(恭喜|讚|wow+|nice+|哈哈|lol|both~?)$", plain, re.I):
        return True
    has_signal_kw = bool(
        re.search(
            r"活動|event|update|公告|feature|launch|上線|即將|coming|tour|festival|market|price|volume|抽卡|空投|sbt|2\.0|v2",
            plain_lower,
            re.I,
        )
    )
    has_number = bool(re.search(r"\d", plain))
    token_count = len(re.findall(r"[a-z0-9\u4e00-\u9fff]{2,}", plain_lower))
    if token_count <= 3 and not has_signal_kw and not has_number:
        return True
    if plain.strip().startswith("@") and len(plain) < 64 and not has_signal_kw:
        return True
    return False


def extract_first_image(media: Any) -> str:
    if not isinstance(media, list):
        return ""
    for item in media:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if url.startswith("http"):
            return url
    return ""


def date_hint_from_text(text: str) -> str:
    t = str(text or "")
    patterns = [
        r"(?i)\b(apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:\s*-\s*\d{1,2})?",
        r"\b(?:20\d{2}/)?\d{1,2}/\d{1,2}(?:\s*-\s*\d{1,2})?",
        r"(?:20\d{2}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号|號)?(?:\s*[-~到至]\s*\d{1,2}\s*(?:日|号|號)?)?",
        r"(?:本週|下週|週末|明天|今晚|今天|今日)",
    ]
    for p in patterns:
        m = re.search(p, t)
        if m:
            return m.group(0)
    return ""


def choose_template_id(card_type: str) -> str:
    mapping = {
        "event": "event_poster",
        "market": "market_signal",
        "announcement": "announcement_timeline",
        "feature": "announcement_timeline",
        "report": "community_brief",
        "insight": "community_brief",
    }
    return mapping.get(card_type, "community_brief")


def compute_urgency(card_type: str, importance: float, timeline_date: str = "") -> str:
    if card_type in {"event", "feature", "announcement"} and timeline_date:
        try:
            dt = datetime.fromisoformat(timeline_date)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            days = (dt.date() - datetime.now(timezone.utc).date()).days
            if 0 <= days <= 3:
                return "high"
            if 4 <= days <= 10:
                return "medium"
        except Exception:
            pass
    if importance >= 10:
        return "high"
    if importance >= 6:
        return "medium"
    return "normal"


def extract_timeline_date(text: str, base_dt: datetime | None = None) -> tuple[str, str]:
    src = str(text or "")
    now = (base_dt or datetime.now(timezone.utc)).astimezone(timezone.utc)
    year = now.year
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    def _build_date(y: int, mon: int, day: int, day_end: int | None = None) -> tuple[str, str]:
        if not (1 <= mon <= 12 and 1 <= day <= 31):
            return "", ""
        try:
            dt = datetime(y, mon, day, 0, 0, tzinfo=timezone.utc)
            if dt < now - timedelta(days=120):
                dt = datetime(y + 1, mon, day, 0, 0, tzinfo=timezone.utc)
            label = f"{mon:02d}/{day:02d}"
            if day_end and day_end >= day:
                label = f"{label}-{day_end:02d}"
            return dt.isoformat(), label
        except Exception:
            return "", ""

    m = re.search(r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?", src)
    if m:
        mon = month_map.get(m.group(1).lower()[:3], 0)
        day = int(m.group(2))
        day_end = int(m.group(3)) if m.group(3) else None
        iso, label = _build_date(year, mon, day, day_end=day_end)
        if iso:
            return iso, label

    m = re.search(
        r"(?i)\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*-\s*(\d{1,2}))?",
        src,
    )
    if m:
        day = int(m.group(1))
        mon = month_map.get(m.group(2).lower()[:3], 0)
        day_end = int(m.group(3)) if m.group(3) else None
        iso, label = _build_date(year, mon, day, day_end=day_end)
        if iso:
            return iso, label

    m = re.search(r"\b((?:20\d{2})/)?(\d{1,2})/(\d{1,2})(?:\s*[-~到至]\s*(\d{1,2}))?", src)
    if m:
        year_hint = year
        if m.group(1):
            try:
                year_hint = int(str(m.group(1)).strip("/"))
            except Exception:
                year_hint = year
        mon = int(m.group(2))
        day = int(m.group(3))
        day_end = int(m.group(4)) if m.group(4) else None
        iso, label = _build_date(year_hint, mon, day, day_end=day_end)
        if iso:
            return iso, label

    m = re.search(
        r"(?:\b(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号|號)?(?:\s*[-~到至]\s*(\d{1,2})\s*(?:日|号|號)?)?",
        src,
    )
    if m:
        year_hint = int(m.group(1)) if m.group(1) else year
        mon = int(m.group(2))
        day = int(m.group(3))
        day_end = int(m.group(4)) if m.group(4) else None
        iso, label = _build_date(year_hint, mon, day, day_end=day_end)
        if iso:
            return iso, label

    src_low = clean_text(src).lower()
    time_context = bool(
        re.search(
            r"(join us|live|session|ama|活動|event|報名|register|discord|goes live|launch|release|snapshot|開放|上線|上线|提醒)",
            src_low,
            re.I,
        )
    )

    def _build_relative(days: int, label: str) -> tuple[str, str]:
        dt = (now + timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        return dt.isoformat(), label

    if time_context and re.search(r"(後天|后天|day after tomorrow)", src_low, re.I):
        return _build_relative(2, "後天")
    if time_context and re.search(r"(明天|tomorrow)", src_low, re.I):
        return _build_relative(1, "明天")
    if time_context and re.search(r"(今天|今日|今晚|今夜|today|tonight|live now)", src_low, re.I):
        return _build_relative(0, "今天")

    weekday_map = {
        "mon": 0, "monday": 0, "週一": 0, "周一": 0,
        "tue": 1, "tues": 1, "tuesday": 1, "週二": 1, "周二": 1,
        "wed": 2, "wednesday": 2, "週三": 2, "周三": 2,
        "thu": 3, "thur": 3, "thurs": 3, "thursday": 3, "週四": 3, "周四": 3,
        "fri": 4, "friday": 4, "週五": 4, "周五": 4,
        "sat": 5, "saturday": 5, "週六": 5, "周六": 5,
        "sun": 6, "sunday": 6, "週日": 6, "周日": 6, "週天": 6, "周天": 6,
    }

    wk = re.search(
        r"(?i)\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b|(?:週|周)([一二三四五六日天])",
        src,
    )
    if wk and time_context:
        token = (wk.group(1) or "").lower()
        if not token and wk.group(2):
            token = f"週{wk.group(2)}"
        target = weekday_map.get(token)
        if target is not None:
            delta = (target - now.weekday()) % 7
            if delta == 0 and re.search(r"(next week|下週|下周)", src_low, re.I):
                delta = 7
            dt = (now + timedelta(days=delta)).replace(hour=0, minute=0, second=0, microsecond=0)
            return dt.isoformat(), dt.strftime("%m/%d")

    if time_context and re.search(r"(this week|本週|本周|this weekend|週末|周末)", src_low, re.I):
        dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return dt.isoformat(), "本週"
    if time_context and re.search(r"(next week|下週|下周|next weekend)", src_low, re.I):
        dt = (now + timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        return dt.isoformat(), "下週"
    return "", ""


def parse_status_page(
    markdown: str,
    username: str,
    tweet_id: str,
    url: str,
    provider: str = "r.jina.ai",
    tweet_meta: dict[str, Any] | None = None,
) -> StoryCard | None:
    title_match = TITLE_RE.search(markdown)
    if not title_match:
        return None

    published_match = PUBLISHED_RE.search(markdown)
    markdown_match = MARKDOWN_RE.search(markdown)

    title = _extract_title(title_match.group(1))
    raw = markdown_match.group(1).strip() if markdown_match else ""
    raw_clean = extract_focus_content(raw) or clean_text(raw)

    if len(raw_clean) < 8 and len(title) < 8:
        return None

    content_source = raw_clean if len(raw_clean) > len(title) else title
    meta_text = ""
    if isinstance(tweet_meta, dict):
        meta_text = clean_text(str(tweet_meta.get("text") or ""))
    if len(meta_text) > max(24, len(content_source)):
        content_source = meta_text
    if is_noise_text(content_source):
        return None
    card_type, layout, tags = classify_story(content_source)
    shaped = build_editorial_copy(content_source, card_type, username)
    summary = str(shaped.get("summary") or summarize_naive(content_source, max_len=220))
    bullets = shaped.get("bullets") if isinstance(shaped.get("bullets"), list) else extract_bullets(content_source)
    normalized_title = str(shaped.get("title") or "").strip()

    published_at = ""
    if published_match:
        try:
            dt = datetime.strptime(published_match.group(1).strip(), "%a, %d %b %Y %H:%M:%S %Z")
            published_at = dt.replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            published_at = ""
    if not published_at and isinstance(tweet_meta, dict):
        meta_iso = str(tweet_meta.get("created_at_iso") or "").strip()
        if meta_iso:
            published_at = meta_iso
    if not published_at:
        published_at = snowflake_to_datetime(tweet_id).isoformat()

    cover = ""
    for img in IMAGE_RE.findall(markdown):
        if "pbs.twimg.com/media/" in img:
            cover = img
            break
    if not cover and isinstance(tweet_meta, dict):
        cover = str(tweet_meta.get("cover_image") or "").strip()

    reply_to_id = ""
    if isinstance(tweet_meta, dict):
        reply_to_id = str(tweet_meta.get("reply_to_id") or tweet_meta.get("parent_id") or "").strip()

    card = StoryCard(
        id=tweet_id,
        account=username,
        url=url,
        title=normalized_title or title or f"@{username} update",
        summary=summary,
        bullets=bullets,
        published_at=published_at,
        confidence=0.56,
        card_type=card_type,
        layout=layout,
        tags=tags,
        raw_text=content_source[:2500],
        provider=provider,
        cover_image=cover,
        metrics={},
        reply_to_id=reply_to_id,
    )
    card.importance = score_card(card)
    enrich_card_metadata(card)
    enrich_detail_view(card)
    return card


def _has_event_evidence(text: str, timeline_iso: str = "") -> bool:
    source = clean_text(text)
    has_time = bool(timeline_iso) or _has_actionable_event_schedule(source)
    has_event_signal = bool(EVENT_SIGNAL_RE.search(source))
    has_participation = bool(PARTICIPATION_SIGNAL_RE.search(source))
    has_location = bool(LOCATION_SIGNAL_RE.search(source))
    has_live_reward = bool(LIVE_REWARD_RE.search(source))
    has_explicit_event = bool(STRICT_EVENT_CALL_RE.search(source))
    has_recap_signal = bool(
        re.search(
            r"(that'?s a wrap|thanks to everyone who joined|活動回顧|行程回顧|回顧|結束回顧|tour recap|after the tour|during web3 festival)",
            source,
            re.I,
        )
    )
    looks_like_feature_update = bool(
        re.search(
            r"(threshold|snapshot|beta|v\d|2\.0|mfa|authentication|security|progress update|版本|功能|更新)",
            source,
            re.I,
        )
    )
    looks_like_sbt_threshold_notice = bool(SBT_THRESHOLD_NOTICE_RE.search(source))
    hypothetical = bool(re.search(r"\bwhat if\b|會不會|会不会|\bif\b.{0,18}\bama\b", source, re.I))
    explicit_call = bool(
        re.search(
            r"join us|live now|今晚|tonight|報名|register|discord|space|goes live|drop now|open now|開賣|开卖|參加|参加|attend",
            source,
            re.I,
        )
    )
    if hypothetical and not explicit_call:
        return False
    evidence_score = 0
    if has_event_signal:
        evidence_score += 1
    if has_time:
        evidence_score += 1
    if has_participation:
        evidence_score += 2
    if has_location:
        evidence_score += 1
    if has_live_reward:
        evidence_score += 1
    if has_explicit_event or explicit_call:
        evidence_score += 2
    if has_recap_signal and has_location:
        evidence_score += 1

    # 功能/快照類貼文不是一律排除；若同時有明確參與語意，仍可被判定為活動。
    if looks_like_sbt_threshold_notice and evidence_score < 4:
        return False
    if looks_like_feature_update and evidence_score < 4 and not has_location:
        return False
    if has_event_signal and has_location and has_recap_signal:
        return True
    return bool(
        evidence_score >= 3
        and has_time
        and (has_participation or has_location or has_live_reward or explicit_call or has_explicit_event)
    )


def _has_actionable_event_schedule(text: str) -> bool:
    src = clean_text(text)
    if not src:
        return False
    facts = extract_schedule_facts(src, limit=6)
    if not facts:
        return False
    joined = " ".join(facts)
    has_date = _contains_calendar_date(joined)
    has_time = bool(re.search(r"\b\d{1,2}\s*(?:am|pm)\b|(?<![:\d])(?:[01]?\d|2[0-3])[:：][0-5]\d(?![:\d])", joined, re.I))
    has_zone = bool(re.search(r"(?:utc|gmt)\s*[+＋−-]?\d+", joined, re.I))
    has_relative = bool(re.search(r"tonight|today|tomorrow|今晚|今天|明天|本週|下週|週末|即將", src, re.I))
    has_event_context = bool(STRICT_EVENT_CALL_RE.search(src))
    if has_date:
        return True
    if has_time and (has_zone or has_relative):
        return True
    if has_time and has_event_context:
        return True
    if has_relative and has_event_context:
        return True
    return False


def classify_story(text: str) -> tuple[str, str, list[str]]:
    source = clean_text(text)
    plain = strip_links_mentions(source)
    timeline_iso, _ = extract_timeline_date(plain)
    lower = plain.lower()
    has_event = _has_event_evidence(plain, timeline_iso=timeline_iso)
    has_guide = bool(GUIDE_SIGNAL_RE.search(plain))
    has_feature = bool(FEATURE_SIGNAL_RE.search(plain))
    has_announce = bool(ANNOUNCE_SIGNAL_RE.search(plain))
    has_market = bool(MARKET_SIGNAL_RE.search(plain))
    has_report = bool(REPORT_SIGNAL_RE.search(plain))
    has_numbers = bool(re.search(r"\d", plain))
    has_sbt_feature = bool(
        re.search(
            r"(\bsbt\b|soulbound|積分|积分|points?).{0,38}(threshold|snapshot|top\s*\d+%|排名|rank|門檻|快照|unlock|claim|mint|發放|领取|領取|取得|獲得)|"
            r"(threshold|snapshot|top\s*\d+%|排名|rank|門檻|快照).{0,38}(\bsbt\b|soulbound|積分|积分|points?)",
            plain,
            re.I,
        )
    )
    has_sbt_unlock = bool(
        re.search(
            r"(pull|open|mint|claim|join|attend|share|hold|buy|參加|参与|完成|快照|排名).{0,48}(\bsbt\b|soulbound|認證|认证)|"
            r"(\bsbt\b|soulbound).{0,48}(unlock|claim|get|receive|領取|领取|取得|獲得|解鎖|解锁)",
            plain,
            re.I,
        )
    )

    # 攻略/經驗分享優先，避免被「開放、活動」字眼誤判。
    if has_guide and not has_event:
        return "report", "brief", ["分析", "內容"]

    # 活動需要可辨識時間 + 參與/地點/直播獎勵等語意證據。
    if has_event:
        return "event", "poster", ["活動", "參與"]

    # SBT 門檻/快照/取得條件優先視為功能或公告，不落入市場模板。
    if has_sbt_feature or has_sbt_unlock:
        if has_announce and not has_feature:
            return "announcement", "timeline", ["更新", "公告"]
        return "feature", "timeline", ["功能", "即將開放"]

    # 市場訊號需搭配數字或明確交易語境。
    if has_market and has_numbers:
        return "market", "data", ["市場", "數據"]

    # 功能進度與公告分流：產品/版本/開放屬 feature，制度公告屬 announcement。
    if has_feature and not has_guide:
        return "feature", "timeline", ["功能", "即將開放"]
    if has_announce:
        return "announcement", "timeline", ["更新", "公告"]

    if has_report:
        return "report", "brief", ["分析", "內容"]

    # 純短互動或回覆訊息，統一走 insight。
    if len(re.findall(r"[a-z0-9\u4e00-\u9fff]{2,}", lower)) <= 5 and not has_numbers:
        return "insight", "brief", ["觀點"]
    return "insight", "brief", ["觀點"]


def default_style_for_type(card_type: str) -> tuple[str, list[str]]:
    mapping = {
        "event": ("poster", ["活動", "參與"]),
        "feature": ("timeline", ["功能", "即將開放"]),
        "market": ("data", ["市場", "數據"]),
        "report": ("brief", ["分析", "內容"]),
        "announcement": ("timeline", ["更新", "公告"]),
        "insight": ("brief", ["觀點"]),
    }
    return mapping.get(card_type, ("brief", ["觀點"]))


def score_card(card: StoryCard) -> float:
    score = 0.0
    if card.account.lower() == "renaissxyz":
        score += 5.0
    type_weight = {
        "event": 4.5,
        "feature": 4.2,
        "announcement": 3.8,
        "market": 3.4,
        "report": 3.0,
        "insight": 1.5,
    }
    score += type_weight.get(card.card_type, 1.0)

    text = card.raw_text or card.title
    if date_hint_from_text(text):
        score += 1.2
    if card.card_type == "event" and card.timeline_date:
        score += 0.9
    if LIVE_REWARD_RE.search(text or ""):
        score += 0.8
    if card.cover_image:
        score += 0.8

    metrics = card.metrics or {}
    likes = int(metrics.get("likes", 0) or 0)
    retweets = int(metrics.get("retweets", 0) or 0)
    replies = int(metrics.get("replies", 0) or 0)
    views = int(metrics.get("views", 0) or 0)
    score += min(4.0, likes / 25.0 + retweets / 8.0 + replies / 15.0 + views / 6000.0)

    # Penalize low-information short replies
    if len(strip_links_mentions(text)) < 28:
        score -= 2.2
    return round(score, 3)


def summarize_naive(text: str, max_len: int = 200) -> str:
    cleaned = clean_text(text)
    if len(cleaned) <= max_len:
        return cleaned
    snippet = cleaned[:max_len].rsplit(" ", 1)[0].strip()
    return snippet + "..."


def extract_bullets(text: str, limit: int = 3) -> list[str]:
    cleaned = clean_text(text)
    chunks = re.split(r"[。.!?！？]\s*", cleaned)
    items: list[str] = []
    for chunk in chunks:
        chunk = chunk.strip()
        if len(chunk) < 18:
            continue
        items.append(chunk[:110])
        if len(items) >= limit:
            break
    if not items and cleaned:
        items = [cleaned[:120]]
    return items


def _headline_prefix(card_type: str) -> str:
    mapping = {
        "event": "活動重點",
        "market": "市場訊號",
        "announcement": "官方公告",
        "feature": "功能進度",
        "report": "重點分析",
        "insight": "社群觀點",
    }
    return mapping.get(card_type, "情報重點")


def _unique_non_empty(items: list[str], limit: int = 3) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        t = compact_point(raw, 120)
        if not t:
            continue
        k = dedupe_key(t)
        if k and k in seen:
            continue
        if k:
            seen.add(k)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def _pick_fact_line(lines: list[str], patterns: list[re.Pattern[str]], max_len: int = 84) -> str:
    for line in lines:
        cleaned = clean_text(line)
        if not cleaned:
            continue
        for pat in patterns:
            if pat.search(cleaned):
                return compact_point(cleaned, max_len=max_len)
    return ""


def _clean_fact_value(text: str, max_len: int = 84) -> str:
    t = clean_text(str(text or ""))
    t = re.sub(r"^[\-\u2022•./:：()\s]+", "", t)
    t = re.sub(r"\s+", " ", t).strip(" ;；,.。、")
    return compact_point(t, max_len=max_len)


def normalize_event_facts(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    allowed = ("reward", "participation", "audience", "location", "schedule")
    out: dict[str, str] = {}
    for key in allowed:
        raw = value.get(key)
        text = _clean_fact_value(str(raw or ""), max_len=92)
        if text:
            out[key] = text
    return out


def normalize_topic_labels(value: Any) -> list[str]:
    if isinstance(value, str):
        raw_items = re.split(r"[,，/|\\\s]+", value)
    elif isinstance(value, list):
        raw_items = [str(x) for x in value]
    else:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in raw_items:
        label = str(raw or "").strip().lower()
        if not label or label in seen:
            continue
        if label not in ALLOWED_TOPIC_LABELS:
            continue
        seen.add(label)
        out.append(label)
        if len(out) >= 6:
            break
    return out


def _event_token_summary(text: str, token_map: list[tuple[re.Pattern[str], str]], max_items: int = 4) -> str:
    out: list[str] = []
    seen: set[str] = set()
    for pat, label in token_map:
        if pat.search(text):
            if label in seen:
                continue
            seen.add(label)
            out.append(label)
            if len(out) >= max_items:
                break
    return "、".join(out)


def _extract_number_values(text: str) -> list[int]:
    values: list[int] = []
    for n in re.findall(r"(\d{2,5})", str(text or "")):
        try:
            values.append(int(n))
        except Exception:
            continue
    return values


def _compact_clause(text: str, max_items: int = 2, max_len: int = 52) -> str:
    chunks = re.split(r"[，,。；;｜|]", clean_text(text))
    picked: list[str] = []
    for chunk in chunks:
        c = _clean_fact_value(chunk, max_len=48)
        if not c:
            continue
        if c in picked:
            continue
        picked.append(c)
        if len(picked) >= max_items:
            break
    if not picked:
        return ""
    return compact_point("、".join(picked), max_len=max_len)


def _normalize_price_text(raw: str) -> str:
    src = clean_text(raw)
    if not src:
        return ""
    pkg = "包稅" if re.search(r"包稅|含稅", src, re.I) else ""
    m = re.search(r"(\d{2,5})\s*(ntd|twd|usd|u|元)?", src, re.I)
    if not m:
        return _clean_fact_value(src, max_len=26)
    num = m.group(1)
    unit = str(m.group(2) or "")
    if unit.lower() in {"ntd", "twd", "usd"}:
        unit = unit.upper()
    elif unit.lower() == "u":
        unit = "U"
    core = f"{num}{unit}"
    return f"{pkg}{core}" if pkg else core


def extract_report_options(text: str, limit: int = 4) -> list[dict[str, str]]:
    src = clean_text(text)
    if not src:
        return []
    matches = list(REPORT_OPTION_START_RE.finditer(src))
    if not matches:
        return []

    options: list[dict[str, str]] = []
    for i, m in enumerate(matches[:limit]):
        name = _clean_fact_value(m.group(2), max_len=28)
        if not name:
            continue
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        segment = clean_text(src[start:end])
        if not segment:
            continue

        price = ""
        pm = re.search(
            r"(?:價格|价格|價位|价位|費用|费用|運費|运费)[:：]?\s*([^。；;]{1,40}?)(?=(?:優點|优点|缺點|缺点|$))",
            segment,
            re.I,
        )
        if pm:
            price = _normalize_price_text(pm.group(1))
        if not price:
            pn = re.search(r"(\d{2,5}\s*(?:ntd|twd|usd|u|元)?)", segment, re.I)
            if pn:
                price = _normalize_price_text(pn.group(1))

        pros = ""
        pros_m = re.search(
            r"(?:優點|优点|優勢|优势|好處|好处)[:：]?\s*([^。；;]{2,72}?)(?=(?:缺點|缺点|價格|价格|$))",
            segment,
            re.I,
        )
        if pros_m:
            pros = _compact_clause(pros_m.group(1), max_items=2, max_len=54)

        cons = ""
        cons_m = re.search(
            r"(?:缺點|缺点|風險|风险|限制|缺陷)[:：]?\s*([^。；;]{2,72}?)(?=(?:價格|价格|使用方式|$))",
            segment,
            re.I,
        )
        if cons_m:
            cons = _compact_clause(cons_m.group(1), max_items=2, max_len=54)

        detail_parts: list[str] = []
        if price:
            detail_parts.append(f"價格 {price}")
        if pros:
            detail_parts.append(f"優點 {pros}")
        if cons:
            detail_parts.append(f"缺點 {cons}")
        if not detail_parts:
            detail_parts.append(_compact_clause(segment, max_items=2, max_len=88) or compact_point(segment, max_len=88))

        deduped_parts: list[str] = []
        seen_parts: set[str] = set()
        for part in detail_parts:
            key = dedupe_key(part)
            if key and key in seen_parts:
                continue
            if key:
                seen_parts.add(key)
            deduped_parts.append(part)

        options.append(
            {
                "name": name,
                "price": price,
                "pros": pros,
                "cons": cons,
                "detail": "｜".join(deduped_parts),
            }
        )
    return options


def build_report_digest(text: str) -> dict[str, Any]:
    src = clean_text(text)
    options = extract_report_options(src, limit=4)
    if not options:
        return {"summary": "", "bullets": []}

    names = [o["name"] for o in options if o.get("name")]
    summary_parts: list[str] = [f"整理出 {len(options)} 個方案：{' / '.join(names[:4])}。"]

    values: list[int] = []
    for o in options:
        for v in _extract_number_values(o.get("price", "")):
            if v < 20:
                continue
            values.append(v)
    if values:
        lo, hi = min(values), max(values)
        if lo == hi:
            summary_parts.append(f"主要價格落點約 {lo}。")
        else:
            summary_parts.append(f"價格區間約 {lo} - {hi}。")

    if any(o.get("pros") for o in options) or any(o.get("cons") for o in options):
        summary_parts.append("差異重點在速度、覆蓋範圍與額外費用。")

    bullets = [f"{o['name']}：{o['detail']}" for o in options if o.get("name")][:3]
    return {"summary": clean_text(" ".join(summary_parts))[:280], "bullets": bullets}


def build_event_facts(text: str) -> dict[str, str]:
    src = clean_text(text)
    if not src:
        return {}
    lines = pick_signal_lines(src, limit=8)
    if not lines:
        lines = split_sentences(src)[:8]

    schedule_items = extract_schedule_facts(src, limit=3)
    schedule = _clean_fact_value("、".join(schedule_items[:3]), max_len=56)

    reward = _event_token_summary(
        src,
        [
            (re.compile(r"\bsbt\b", re.I), "SBT"),
            (re.compile(r"積分|积分|points?", re.I), "積分"),
            (re.compile(r"merch|周邊|周边", re.I), "周邊"),
            (re.compile(r"airdrop|空投", re.I), "空投"),
            (re.compile(r"獎勵|奖励|獎品|prize|reward", re.I), "活動獎勵"),
        ],
        max_items=4,
    )

    participation_tokens = _event_token_summary(
        src,
        [
            (re.compile(r"discord", re.I), "Discord"),
            (re.compile(r"live|直播", re.I), "直播"),
            (re.compile(r"session|community\s*session", re.I), "社群 Session"),
            (re.compile(r"join us|join", re.I), "參與活動"),
            (re.compile(r"報名|报名|register|signup", re.I), "報名"),
            (re.compile(r"填表", re.I), "填表"),
            (re.compile(r"投票|互動|互动", re.I), "互動投票"),
        ],
        max_items=4,
    )
    participation = participation_tokens
    if not participation:
        participation = _pick_fact_line(lines, [JOIN_SIGNAL_RE, PARTICIPATION_SIGNAL_RE], max_len=72)
    if participation and len(participation) > 40:
        compact_participation = _event_token_summary(
            src,
            [
                (re.compile(r"discord", re.I), "Discord"),
                (re.compile(r"live|直播", re.I), "直播"),
                (re.compile(r"session|community\s*session", re.I), "社群 Session"),
                (re.compile(r"join us|join", re.I), "參與活動"),
                (re.compile(r"報名|报名|register|signup", re.I), "報名"),
                (re.compile(r"填表", re.I), "填表"),
                (re.compile(r"投票|互動|互动", re.I), "互動投票"),
            ],
            max_items=4,
        )
        if compact_participation:
            participation = compact_participation

    audience_parts: list[str] = []
    m = re.search(r"(\d+\s*位?(?:參賽者|参赛者))", src, re.I)
    if m:
        audience_parts.append(_clean_fact_value(m.group(1), max_len=24))
    if re.search(r"觀眾|观众", src, re.I):
        audience_parts.append("觀眾")
    if re.search(r"all regions|多語|multi-language", src, re.I):
        audience_parts.append("多語社群")
    if re.search(r"community|社群", src, re.I):
        audience_parts.append("社群玩家")
    audience = "、".join(list(dict.fromkeys([x for x in audience_parts if x]))[:3])

    location = ""
    if re.search(r"web3\s*festival", src, re.I) and re.search(r"hong\s*kong|香港", src, re.I):
        location = "香港 Web3 Festival"
    elif re.search(r"arcadia\s+restaurant", src, re.I):
        location = "Arcadia Restaurant & Bar（香港銅鑼灣）"
    elif re.search(r"causeway\s*bay|銅鑼灣", src, re.I):
        location = "香港銅鑼灣"
    elif re.search(r"midtown", src, re.I):
        location = "香港 Midtown"
    elif re.search(r"hong\s*kong|香港", src, re.I):
        location = "香港"
    elif re.search(r"discord|space|直播|live", src, re.I):
        location = "線上（Discord / Live）"
    elif re.search(r"plaza", src, re.I):
        location = "Renaiss Plaza"

    if not location and re.search(r"discord|space|live|直播", src, re.I):
        location = "線上（Discord / Live）"

    return normalize_event_facts(
        {
            "reward": reward,
            "participation": participation,
            "audience": audience,
            "location": location,
            "schedule": schedule,
        }
    )


def extract_sbt_threshold_facts(text: str) -> dict[str, Any]:
    src = clean_text(text)
    if not src:
        return {"tiers": [], "snapshot": "", "dynamic_hint": ""}

    tiers: list[str] = []
    seen_tiers: set[str] = set()
    for m in SBT_THRESHOLD_RE.finditer(src):
        percentile = str(m.group(1) or "").strip()
        points = str(m.group(2) or "").replace(",", "").strip()
        if not percentile or not points:
            continue
        line = f"前 {percentile}%：{points} 分"
        key = dedupe_key(line)
        if key and key in seen_tiers:
            continue
        if key:
            seen_tiers.add(key)
        tiers.append(line)
        if len(tiers) >= 4:
            break

    def _normalize_snapshot(raw: str) -> str:
        snap = clean_text(raw)
        if not snap:
            return ""
        snap = re.split(r"\b(?:keep\s+pushing|keep\s+climbing|join\s+us|thanks|see\s+you)\b", snap, maxsplit=1, flags=re.I)[0]
        tz_hit = re.search(r"(.+?\b(?:gmt|utc)\s*[+-]?\d{1,2}\)?)", snap, re.I)
        if tz_hit:
            snap = tz_hit.group(1)
        snap = snap.strip(" ，,;；。")
        return _clean_fact_value(snap, max_len=72)

    snapshot = ""
    snap_match = SBT_SNAPSHOT_RE.search(src)
    if snap_match:
        snapshot = _normalize_snapshot(snap_match.group(1))
    if not snapshot:
        schedule = extract_schedule_facts(src, limit=4)
        if schedule:
            snapshot = _normalize_snapshot("、".join(schedule[:3]))

    dynamic_hint = ""
    if re.search(r"live reference thresholds?|not fixed|keep climbing|bar can keep climbing|動態|浮動|非固定", src, re.I):
        dynamic_hint = "門檻為動態參考值，會隨參與人數與分數變化而上調。"

    return {"tiers": tiers, "snapshot": snapshot, "dynamic_hint": dynamic_hint}


def has_sbt_signal(text: str) -> bool:
    src = clean_text(text)
    if not src:
        return False
    return bool(
        re.search(
            r"\bsbt\b|soulbound|積分|积分|points?|snapshot|快照|threshold|門檻|top\s*\d+%|rank(?:ing)?",
            src,
            re.I,
        )
    )


def infer_sbt_acquisition_line(source: str, facts: dict[str, str] | None = None) -> str:
    src = clean_text(source)
    if not has_sbt_signal(src):
        return ""

    threshold = extract_sbt_threshold_facts(src)
    tiers = [clean_text(str(x)) for x in threshold.get("tiers", []) if clean_text(str(x))]
    snapshot = _clean_fact_value(str(threshold.get("snapshot") or ""), max_len=72)
    if tiers:
        tier_text = "、".join(tiers[:3])
        line = f"SBT 取得方式：快照時達到 {tier_text}"
        if snapshot:
            line += f"，快照時間 {snapshot}"
        return clean_text(line)

    pull_once = re.search(
        r"pull\s+([a-z0-9 +\-]{3,36})\s+once\s+before\s+([a-z0-9 ,:+\-]{2,28})\s+to\s+unlock",
        src,
        re.I,
    )
    if pull_once:
        pack = _clean_fact_value(pull_once.group(1), max_len=26)
        date_hint = _clean_fact_value(pull_once.group(2), max_len=24)
        return f"SBT 取得方式：在 {date_hint} 前完成 1 次「{pack}」抽卡以解鎖。"

    join_claim = re.search(
        r"(?:join|attend|participate|參加|参与|完成)\s+([^\n。；;]{4,42})\s*(?:to|即可|後|后).{0,18}(?:get|claim|receive|領取|领取|取得|獲得).{0,10}(?:sbt|soulbound)",
        src,
        re.I,
    )
    if join_claim:
        task = _clean_fact_value(join_claim.group(1), max_len=44)
        return f"SBT 取得方式：完成「{task}」後依規則領取。"

    lines = split_sentences(src)
    candidate = ""
    patt = re.compile(
        r"(pull|open|mint|claim|join|attend|share|hold|buy|參加|参与|完成|報名|报名|快照|排名).{0,56}(sbt|soulbound|認證|认证)|"
        r"(sbt|soulbound).{0,56}(unlock|claim|get|receive|領取|领取|取得|獲得|解鎖|解锁|發放|发放)",
        re.I,
    )
    for row in lines:
        if patt.search(row):
            candidate = _clean_fact_value(row, max_len=96)
            break
    if candidate:
        candidate = re.sub(
            r"(?i)^.*?(?=(pull|open|mint|claim|join|attend|share|hold|buy|參加|参与|完成|報名|报名|快照|排名|sbt|soulbound))",
            "",
            candidate,
        ).strip(" ，,;；。")
        return f"SBT 取得方式：{candidate}"

    facts_map = normalize_event_facts(facts or {})
    reward = clean_text(str(facts_map.get("reward") or ""))
    participation = clean_text(str(facts_map.get("participation") or ""))
    if re.search(r"\bsbt\b|soulbound", reward, re.I):
        if participation:
            return f"SBT 取得方式：完成「{participation}」並符合活動條件後領取。"
        return "SBT 取得方式：依官方貼文的參與條件完成任務後領取。"
    return "SBT 取得方式：依官方公布的快照、排名或任務條件取得。"


def infer_topic_phrase(text: str, card_type: str) -> str:
    t = strip_links_mentions(clean_text(text))
    keyword_topics = [
        (r"\bmfa\b|2fa|multi[-\s]*factor|authenticator|authentication|帳號安全|账号安全|setting page|設定頁|设置页", "帳號安全與 MFA"),
        (r"threshold update|thresholds?|snapshot|top\s*\d{1,3}\s*%|分位門檻|門檻更新", "SBT 快照門檻更新"),
        (r"web3\s*festival|hong\s*kong", "香港 Web3 Festival 行程"),
        (r"korea|community\s*gathering|gathering|meetup", "社群線下聚會"),
        (r"\bplaza\b|space|community\s*session|ama|discord|直播", "社群直播與互動"),
        (r"\btour\b|card\s*shop", "卡店巡迴與交流活動"),
        (r"ambassador|大使", "Ambassador 計畫進度"),
        (r"sbt|points|積分", "SBT 與積分機制"),
        (r"one\s*piece|luffy", "One Piece 卡牌動向"),
        (r"volume|成交|交易量|\$\d", "交易量與市場成長"),
        (r"pack|卡包|抽卡", "卡包與抽卡表現"),
        (r"reward|airdrop|獎勵", "獎勵與發放進度"),
        (r"update|公告|progress", "最新官方更新"),
    ]
    for pat, label in keyword_topics:
        if re.search(pat, t, re.I):
            return label
    t = re.sub(r"^[^\w\u4e00-\u9fff]+", "", t)
    t = re.sub(
        r"\b(we|we're|we are|join us|welcome|excited|progress|update|community|project|results?|announcement)\b",
        " ",
        t,
        flags=re.I,
    )
    t = re.sub(r"\s+", " ", t).strip(" ,.:;|-")
    if not t:
        return _headline_prefix(card_type)
    if _is_mostly_ascii(t):
        fallback = {
            "event": "社群活動更新",
            "market": "市場訊號更新",
            "announcement": "官方公告更新",
            "feature": "功能進度更新",
            "report": "分析整理更新",
            "insight": "社群互動更新",
        }
        return fallback.get(card_type, _headline_prefix(card_type))
    return compact_point(t, 46)


def _contains_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", str(text or "")))


def _is_mostly_ascii(text: str) -> bool:
    src = str(text or "")
    ascii_count = len(re.findall(r"[A-Za-z0-9]", src))
    cjk_count = len(re.findall(r"[\u4e00-\u9fff]", src))
    if ascii_count < 12:
        return False
    return ascii_count >= max(18, cjk_count * 3)


def _abstract_focus_line(text: str, max_len: int = 84) -> str:
    src = strip_links_mentions(clean_text(text))
    if not src:
        return ""
    src = re.sub(r"^\d+\s*[/、.)\]]\s*", "", src)
    src = re.sub(
        r"(?i)\b("
        r"live from|join us|we(?:'re| are)? excited(?: to)?|looking ahead|"
        r"reminder|tonight(?:'s)?|we would like to|come find us(?: and let'?s)?|"
        r"thanks for|we're thrilled|we are thrilled"
        r")\b",
        " ",
        src,
    )
    src = re.sub(r"\s+", " ", src).strip(" ,.;:!?-")
    if not src:
        return ""

    clauses = re.split(r"[，,。；;:：|｜]", src)
    chosen: list[str] = []
    for clause in clauses:
        c = clean_text(clause)
        if not c:
            continue
        if len(strip_links_mentions(c)) < 6:
            continue
        if len(re.findall(r"[A-Za-z0-9\u4e00-\u9fff]", c)) < 4:
            continue
        if c in chosen:
            continue
        chosen.append(c)
        if len(chosen) >= 2:
            break
    if not chosen:
        chosen = [src]
    return compact_point("；".join(chosen), max_len=max_len)


def _account_actor_label(account: str) -> str:
    handle = str(account or "").strip().lstrip("@").lower()
    if not handle:
        return "來源帳號"
    if handle.startswith("renaiss"):
        return "Renaiss 官方"
    return f"@{handle}"


def _infer_why_line(source: str, card_type: str) -> str:
    src = clean_text(source).lower()
    if card_type == "event":
        if re.search(r"sbt|reward|獎勵|积分|積分|merch|周邊|周边", src, re.I):
            return "這類活動有明確誘因，通常會提高參與率與社群擴散。"
        if re.search(r"join us|community|gathering|ama|session|discord|live|直播", src, re.I):
            return "這是社群動員型資訊，重點是把人導向直播或現場互動。"
        return "這則主要用來通知參與資訊，關鍵在時間、地點與參加方式。"
    if card_type in {"feature", "announcement"}:
        if re.search(r"\bmfa\b|2fa|multi[-\s]*factor|authenticator|authentication|security|帳號安全|账号安全|setting page|設定頁|设置页", src, re.I):
            return "這會直接改變登入流程並提升帳號安全門檻。"
        if re.search(r"(sbt|points?).{0,36}(threshold|top\s*\d+%|snapshot)|threshold update", src, re.I):
            return "這會直接影響 Beta 參與者在快照前的衝分策略與 SBT 等級判定。"
        if re.search(r"launch|release|coming|roadmap|progress|開放|上線|上线|更新", src, re.I):
            return "這代表產品進度往下一個節點前進，需留意正式開放時間與條件。"
        return "這則更新會影響後續使用流程，需追蹤官方下一則細節。"
    if card_type == "market":
        if re.search(r"record|成交|sold|price|交易量|volume|涨|漲|跌", src, re.I):
            return "這會把討論焦點集中在成交價、供需與估值區間。"
        return "這則訊息反映市場觀察點，適合與其他來源一起比對。"
    if card_type == "report":
        return "這份整理可直接拿來比較方案差異與執行成本。"
    return "這則貼文提供社群現場脈絡，可用來補齊討論背景。"


def build_fivew_brief(
    source: str,
    card_type: str,
    account: str,
    topic: str,
    lead_focus: str,
    event_facts: dict[str, str],
    schedule: list[str],
) -> dict[str, str]:
    who = _account_actor_label(account)
    what = _clean_fact_value(lead_focus or topic, max_len=96)
    when = _clean_fact_value(str(event_facts.get("schedule") or ""), max_len=56)
    where = _clean_fact_value(str(event_facts.get("location") or ""), max_len=56)
    if not when and schedule:
        schedule_joined = _clean_fact_value("、".join(schedule[:2]), max_len=56)
        if card_type in {"event", "feature", "announcement"}:
            when = schedule_joined
        elif card_type == "insight" and _contains_calendar_date(schedule_joined):
            when = schedule_joined
    if not where and card_type in {"event", "insight"}:
        if re.search(r"hong\s*kong|香港", source, re.I):
            where = "香港"
        elif re.search(r"discord|space|live|直播|線上|线上", source, re.I):
            where = "線上社群"
    why = _infer_why_line(source, card_type)
    return {
        "who": who,
        "what": what,
        "when": when,
        "where": where,
        "why": why,
    }


def build_universal_digest_frame(
    source: str,
    card_type: str,
    account: str,
    topic: str,
    lead_focus: str,
    fivew: dict[str, str],
    schedule: list[str],
    numbers: list[str],
    event_facts: dict[str, str] | None = None,
    report_digest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    who = str(fivew.get("who") or _account_actor_label(account)).strip() or _account_actor_label(account)
    what = _clean_fact_value(str(fivew.get("what") or lead_focus or topic), max_len=96) or _clean_fact_value(topic, max_len=96)
    when = _clean_fact_value(str(fivew.get("when") or ""), max_len=72)
    where = _clean_fact_value(str(fivew.get("where") or ""), max_len=72)
    why = _clean_fact_value(str(fivew.get("why") or _infer_why_line(source, card_type)), max_len=110)
    facts = normalize_event_facts(event_facts or {})
    if not facts and has_sbt_signal(source):
        facts = build_event_facts(source)
    sbt_how = infer_sbt_acquisition_line(source, facts=facts)
    digest = report_digest if isinstance(report_digest, dict) else {}

    if not when and schedule:
        when = _clean_fact_value("、".join(schedule[:2]), max_len=72)

    def _finish(summary: str, bullets: list[str], detail_summary: str, detail_lines: list[str]) -> dict[str, Any]:
        summary_clean = clean_text(summary)[:320]
        detail_summary_clean = clean_text(detail_summary)[:420]
        bullet_rows = [clean_text(str(x))[:120] for x in bullets if clean_text(str(x))][:3]
        if len(bullet_rows) < 3:
            for pad in detail_lines:
                if len(bullet_rows) >= 3:
                    break
                p = clean_text(str(pad))[:120]
                if not p:
                    continue
                if p in bullet_rows:
                    continue
                bullet_rows.append(p)
        detail_rows = normalize_detail_lines(detail_lines, limit=6)
        return {
            "summary": summary_clean,
            "bullets": bullet_rows[:3],
            "detail_summary": detail_summary_clean,
            "detail_lines": detail_rows[:6],
        }

    def _append_sentence(base: str, piece: str) -> str:
        head = clean_text(base)
        tail = clean_text(piece)
        if not tail:
            return head
        if head and not re.search(r"[。！？!?]$", head):
            head += "。"
        if tail and not re.search(r"[。！？!?]$", tail):
            tail += "。"
        return f"{head}{tail}"

    if card_type == "event":
        reward = _clean_fact_value(str(facts.get("reward") or ""), max_len=72)
        participation = _clean_fact_value(str(facts.get("participation") or ""), max_len=72)
        summary = f"{who}釋出「{topic}」活動資訊。"
        if when:
            summary += f"時間為 {when}。"
        if where:
            summary += f"地點在 {where}。"
        if reward:
            summary += f"主要誘因是 {reward}。"
        if sbt_how and re.search(r"\bsbt\b|soulbound", clean_text(reward), re.I):
            summary = _append_sentence(summary, sbt_how)
        summary = _append_sentence(summary, why)
        bullets = [
            f"活動重點：{what}",
            f"時間與地點：{when}{('／' + where) if where else ''}" if when or where else "時間與地點：請以原文公告為準",
            f"參與方式：{participation}" if participation else "參與方式：先看原文確認報名與參與門檻",
        ]
        if sbt_how:
            bullets = [f"SBT 取得方式：{sbt_how.replace('SBT 取得方式：', '').strip()}"] + bullets[:2]
        detail_summary = (
            f"{who} 這則活動主軸是「{what}」，"
            f"{('時間在 ' + when + '，') if when else ''}"
            f"{('地點在 ' + where + '，') if where else ''}"
            f"{('主要誘因是 ' + reward + '，') if reward else ''}"
            f"{('參與方式為 ' + participation + '。') if participation else '參與方式請以原文公告為準。'}"
            f"{why}"
        )
        detail_lines = [
            f"活動主軸：{what}",
            f"時間與地點：{when}{('／' + where) if where else ''}" if when or where else "時間與地點：待官方補充",
            f"獎勵重點：{reward}" if reward else "獎勵重點：請以原文獎勵說明為準",
            f"參與方式：{participation}" if participation else "參與方式：先確認報名方式、截止時間與名額。",
            f"影響：{why}",
        ]
        if sbt_how:
            detail_lines.insert(3, sbt_how)
        return _finish(summary, bullets, detail_summary, detail_lines)

    if card_type in {"feature", "announcement"}:
        threshold_facts = extract_sbt_threshold_facts(source)
        tiers = [str(x) for x in threshold_facts.get("tiers", []) if str(x).strip()]
        snapshot = _clean_fact_value(str(threshold_facts.get("snapshot") or ""), max_len=72)
        dynamic_hint = _clean_fact_value(str(threshold_facts.get("dynamic_hint") or ""), max_len=90)
        is_threshold_update = bool(
            tiers and re.search(r"(sbt|points?).{0,36}(threshold|top\s*\d+%|snapshot)|threshold update", source, re.I)
        )
        security_update = bool(
            re.search(
                r"\bmfa\b|2fa|multi[-\s]*factor|authenticator|authentication|security|帳號安全|账号安全|setting page|設定頁|设置页",
                source,
                re.I,
            )
        )
        if is_threshold_update:
            tier_text = "、".join(tiers[:3])
            summary = f"{who}更新了「{topic}」功能規則。門檻分數為 {tier_text}。"
            if snapshot:
                summary += f"快照時間：{snapshot}。"
            summary = _append_sentence(summary, dynamic_hint or "門檻屬動態參考值，會隨參與人數與分數分布調整")
            summary = _append_sentence(summary, why)
            detail_summary = f"{who} 這則是 SBT 門檻更新：{tier_text}。"
            if snapshot:
                detail_summary += f"快照時間為 {snapshot}。"
            detail_summary = _append_sentence(detail_summary, dynamic_hint or "分位門檻是動態參考值，會隨分數分布上修")
            detail_summary = _append_sentence(detail_summary, "重點是快照前的衝分策略與快照後的最終分位確認")
            bullets = [
                f"門檻分數：{tier_text}",
                f"快照時間：{snapshot}" if snapshot else "快照時間：請以官方公告時間為準",
                "你要做什麼：快照前持續拉分，快照後核對最終門檻與 SBT 等級。",
            ]
            if sbt_how:
                bullets[2] = sbt_how
            detail_lines = [
                f"更新主軸：{what}",
                f"本次門檻：{tier_text}",
                f"快照時間：{snapshot or '待官方補充'}",
                f"規則說明：{dynamic_hint or '門檻為參考值，會隨分布變動。'}",
                "影響對象：Beta 參與者（依分位對應等級）。",
                "下一步：快照前提升分數，快照後回看官方最終分位公告。",
            ]
            if sbt_how:
                detail_lines.insert(4, sbt_how)
            return _finish(summary, bullets, detail_summary, detail_lines)

        if security_update:
            summary = f"{who}發布「{topic}」功能更新。MFA 已可啟用，登入需驗證器動態碼。{why}"
            if sbt_how:
                summary = _append_sentence(summary, sbt_how)
            detail_summary = (
                f"{who} 這則更新重點是 MFA 登入保護。"
                "啟用後會在登入流程增加驗證器動態碼步驟，"
                "可降低帳號被盜風險，但使用流程會多一次驗證。"
            )
            bullets = [
                "更新重點：MFA（二階段驗證）已上線",
                "影響流程：登入需輸入驗證器 6 位數動態碼",
                "你要做什麼：到設定頁啟用 MFA，並準備備援登入方式",
            ]
            if sbt_how:
                bullets[2] = sbt_how
            detail_lines = [
                "更新主軸：帳號安全驗證升級",
                "機制重點：新增驗證器動態碼步驟",
                "適用對象：目前使用 Privy 登入的使用者",
                "影響：安全性提升，但登入流程增加一次驗證",
                "下一步：完成 MFA 設定並測試備援流程",
            ]
            if sbt_how:
                detail_lines.insert(3, sbt_how)
            return _finish(summary, bullets, detail_summary, detail_lines)

        summary = f"{who}發布「{topic}」{('官方公告' if card_type == 'announcement' else '功能更新')}。"
        summary += f"重點是 {what}。"
        if when:
            summary += f"時間節點：{when}。"
        summary += why
        detail_summary = (
            f"{who} 這則屬於{('官方公告' if card_type == 'announcement' else '功能更新')}，"
            f"核心為「{what}」。"
            f"{('主要時間節點在 ' + when + '。') if when else ''}"
            f"對使用者的直接影響是：{why}"
        )
        bullets = [
            f"更新重點：{what}",
            f"時間節點：{when}" if when else "時間節點：待官方公告",
            "你要做什麼：先確認生效時間與開放條件，再安排操作。",
        ]
        if sbt_how:
            bullets[2] = sbt_how
        detail_lines = [
            f"更新主軸：{what}",
            f"時間節點：{when or '待官方公告'}",
            f"影響：{why}",
            "下一步：追蹤官方下一則公告確認最終規則。",
        ]
        if sbt_how:
            detail_lines.insert(2, sbt_how)
        return _finish(summary, bullets, detail_summary, detail_lines)

    if card_type == "market":
        meanings = _market_number_meanings(source, numbers)
        meaning_line = "；".join([clean_text(x).rstrip("。；; ") for x in meanings[:2]]) if meanings else ""
        if not meaning_line and numbers:
            pretty = [_number_with_unit(x, _find_number_context(source, x)) for x in numbers[:2]]
            meaning_line = f"文中提到 { '、'.join(pretty) }。"
        summary = f"{who}發布「{topic}」市場訊號。重點是 {what}。"
        if meaning_line:
            summary += f"數字意義：{meaning_line}。"
        if sbt_how:
            summary = _append_sentence(summary, sbt_how)
        summary = _append_sentence(summary, _market_impact_line(source))
        detail_summary = f"{who} 這則市場更新主軸是「{what}」。"
        if meaning_line:
            detail_summary = _append_sentence(detail_summary, f"貼文數字代表：{meaning_line}")
        else:
            detail_summary = _append_sentence(detail_summary, "此則以市場風向觀測為主")
        detail_summary = _append_sentence(detail_summary, f"影響面：{_market_impact_line(source)}")
        bullets = [
            f"市場重點：{what}",
            f"數字解讀：{meanings[0]}" if meanings else (f"數字脈絡：{_number_with_unit(numbers[0], _find_number_context(source, numbers[0]))}" if numbers else "數字脈絡：此貼文以市場觀察為主"),
            f"可能影響：{_market_impact_line(source)}",
        ]
        if sbt_how:
            bullets = [sbt_how, bullets[0], bullets[2]]
        detail_lines = [
            f"市場主軸：{what}",
            f"數字解讀：{meanings[0]}" if meanings else "數字解讀：請搭配原文上下文理解數字用途。",
            f"補充：{meanings[1]}" if len(meanings) > 1 else "補充：留意是否有後續供給、價格或成交更新。",
            f"影響：{_market_impact_line(source)}",
            "下一步：比對至少兩個來源後再做判斷。",
        ]
        if sbt_how:
            detail_lines.insert(3, sbt_how)
        return _finish(summary, bullets, detail_summary, detail_lines)

    if card_type == "report":
        digest_summary = clean_text(str(digest.get("summary") or ""))
        digest_bullets = [clean_text(str(x))[:120] for x in (digest.get("bullets") or []) if clean_text(str(x))][:3]
        summary = digest_summary or f"{who}整理了「{topic}」攻略重點。重點是 {what}。{why}"
        detail_summary = summary
        if digest_summary:
            detail_summary = f"{digest_summary} 可直接拿來做方案比較與執行規劃。"
        bullets = digest_bullets or [
            f"整理主軸：{what}",
            f"時間參考：{when}" if when else "時間參考：近期整理內容",
            "使用方式：先對照需求與成本，再選方案。",
        ]
        detail_lines = digest_bullets[:]
        if not detail_lines:
            detail_lines = [
                f"重點主題：{what}",
                f"補充：{why}",
                "下一步：依預算與時程篩選可執行方案。",
            ]
        return _finish(summary, bullets, detail_summary, detail_lines)

    summary = f"{who}分享了「{topic}」社群近況，重點是 {what}。"
    if when:
        summary += f"時間參考：{when}。"
    if where:
        summary += f"場景：{where}。"
    summary = _append_sentence(summary, why)
    if sbt_how:
        summary = _append_sentence(summary, sbt_how)
    detail_summary = (
        f"{who} 這則社群內容的核心是「{what}」。"
        f"{('時間參考為 ' + when + '。') if when else ''}"
        f"{('主要場景在 ' + where + '。') if where else ''}"
        f"判讀建議：{why}"
    )
    bullets = [
        f"貼文重點：{what}",
        f"時間/場景：{when}{('／' + where) if where else ''}" if when or where else "時間/場景：原文未提供明確時間地點",
        "下一步：看原文與同帳號續篇，確認是否有規則或活動補充。",
    ]
    if sbt_how:
        bullets = [sbt_how, bullets[0], bullets[1]]
    detail_lines = [
        f"社群主軸：{what}",
        f"時間參考：{when}" if when else "時間參考：以原文更新為準",
        f"場景：{where}" if where else "場景：線上社群討論",
        f"影響：{why}",
        "下一步：持續追蹤官方或同帳號後續補充。",
    ]
    if sbt_how:
        detail_lines.insert(3, sbt_how)
    return _finish(summary, bullets, detail_summary, detail_lines)


def _english_focus_hint(text: str, card_type: str, topic: str) -> str:
    src = strip_links_mentions(clean_text(text)).lower()
    hints = [
        (r"(?:sbt|points?).{0,36}(?:threshold|top\s*\d+%|snapshot)|threshold update", "SBT 分位門檻與快照時間更新"),
        (r"\bmfa\b|multi[-\s]*factor|authenticator|setting page|secure your account", "MFA 帳號安全驗證已上線"),
        (r"first card shop.*hong kong tcg tour|hong kong tcg tour.*first card shop", "香港 TCG Tour 首站卡店現場更新"),
        (r"community gathering.*korea|korea.*community gathering", "韓國社群聚會活動公告"),
        (r"rip packs together|take photos|chat about tcg", "現場一起開包、拍照並交流卡市觀點"),
        (r"line(?:d|s)? up for packs|reacting to pulls|collecting stories", "玩家現場交流抽卡成果，社群互動熱度提升"),
        (r"entertainment rwa night|kicking off", "Entertainment RWA Night 現場活動進行中"),
        (r"record breaker|sold for", "高價成交案例釋出"),
        (r"pokemon[^$]*\$857\s*million|\$857\s*million[^$]*pokemon", "官方引用研究指出寶可夢單一市場營收達 8.57 億美元"),
        (r"market size[^$]*\$11\.8\s*billion|\$11\.8\s*billion[^$]*market size", "研究預估全球 TCG 市場規模可達 118 億美元"),
        (r"beta\s*2\.0.*ending|points will be reset", "Beta 2.0 即將結束，積分將重置"),
        (r"one piece.*infinite gacha|moving deeper into one piece", "One Piece Infinite Gacha 進度更新"),
        (r"legacy pack", "Legacy Pack 卡包上新與價格區間更新"),
        (r"ama|community session|plaza", "社群直播與互動預告"),
        (r"web3 festival", "Web3 Festival 社群行程更新"),
    ]
    for pat, label in hints:
        if re.search(pat, src, re.I):
            return _clean_fact_value(label, max_len=84)
    if card_type == "market":
        return _clean_fact_value(f"{topic}（英文原文）", max_len=84)
    if card_type in {"feature", "announcement"}:
        return _clean_fact_value("功能規則已更新，請依貼文列出的時間與條件操作", max_len=84)
    if card_type == "event":
        return _clean_fact_value("活動資訊已釋出，請先確認時間地點", max_len=84)
    if card_type == "insight":
        return _clean_fact_value("社群互動更新", max_len=84)
    return _clean_fact_value(topic, max_len=84)


def _find_number_context(source: str, token: str) -> str:
    src = clean_text(source)
    low = src.lower()
    token_l = str(token or "").lower()
    idx = low.find(token_l)
    if idx < 0 and token_l.startswith("$"):
        idx = low.find(token_l[1:])
    if idx < 0:
        return src[:140]
    return src[max(0, idx - 70): min(len(src), idx + 100)]


def _expand_dollar_suffix(raw: str) -> str:
    compact = clean_text(raw).replace(",", "").replace(" ", "")
    m = re.fullmatch(r"\$?(\d+(?:\.\d+)?)([kmb])", compact, re.I)
    if not m:
        return ""
    try:
        base = float(m.group(1))
    except Exception:
        return ""
    suffix = m.group(2).lower()
    multiplier = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}.get(suffix)
    if not multiplier:
        return ""
    value = base * multiplier
    if abs(value - round(value)) < 0.001:
        value_text = f"{int(round(value)):,}"
    else:
        value_text = f"{value:,.2f}".rstrip("0").rstrip(".")
    return f"{raw}（約 {value_text} 美元）"


def _expand_dollar_by_context(raw: str, context: str) -> str:
    token = clean_text(raw)
    if not token or not token.startswith("$"):
        return ""
    m = re.match(r"^\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)$", token)
    if not m:
        return ""
    try:
        base = float(m.group(1).replace(",", ""))
    except Exception:
        return ""

    ctx = clean_text(context)
    num_raw = m.group(1)
    num_alt = num_raw.replace(",", "")
    num_pat = f"(?:{re.escape(num_raw)}|{re.escape(num_alt)})"

    scale_hit = re.search(
        rf"\$?\s*{num_pat}\s*(billion|bn|million|mn|thousand|十億|十亿|百萬|百万|千)(?:\b)?",
        ctx,
        re.I,
    )
    if not scale_hit:
        scale_hit = re.search(
            rf"(billion|bn|million|mn|thousand|十億|十亿|百萬|百万|千)\s*\$?\s*{num_pat}(?:\b)?",
            ctx,
            re.I,
        )

    if not scale_hit:
        return ""

    scale_word = str(scale_hit.group(1) or "").lower()
    multiplier = 0.0
    label = ""
    if scale_word in {"billion", "bn", "十億", "十亿"}:
        multiplier = 1_000_000_000.0
        label = "billion"
    elif scale_word in {"million", "mn", "百萬", "百万"}:
        multiplier = 1_000_000.0
        label = "million"
    elif scale_word in {"thousand", "千"}:
        multiplier = 1_000.0
        label = "thousand"

    if not multiplier:
        return ""

    value = base * multiplier
    if abs(value - round(value)) < 0.001:
        value_text = f"{int(round(value)):,}"
    else:
        value_text = f"{value:,.2f}".rstrip("0").rstrip(".")

    return f"{token} {label}（約 {value_text} 美元）"


def _number_with_unit(token: str, context: str) -> str:
    raw = clean_text(token)
    if not raw:
        return raw
    ctx = clean_text(context).lower()
    plain = re.sub(r"[^0-9.]", "", raw)
    if "%" in raw:
        return raw
    if raw.startswith("$"):
        expanded = _expand_dollar_suffix(raw)
        if expanded:
            return expanded
        contextual = _expand_dollar_by_context(raw, ctx)
        if contextual:
            return contextual
        return f"{raw}（美元）"
    if re.search(r"(legacy\s*pack|pack\s*\d+\.\d+|版本|version|series)", ctx, re.I) and re.fullmatch(r"\d+(?:\.\d+)?", plain):
        return f"{raw}（版本）"
    if re.fullmatch(r"(19|20)\d{2}", plain) and re.search(r"年|year|timeline|roadmap|forecast|預估", ctx, re.I):
        return f"{raw}（年份）"
    if re.search(r"serialized|限量|編號|编号|/\s*\d+", ctx, re.I) and re.fullmatch(r"\d+(?:\.\d+)?", plain):
        return f"{raw}（序號）"
    if re.search(r"\bntd\b|台幣|新台幣", ctx, re.I):
        return f"{raw}（NTD）"
    if re.search(r"\busdt\b", ctx, re.I):
        return f"{raw}（USDT）"
    if re.search(r"\busd\b|美元", ctx, re.I):
        return f"{raw}（美元）"
    if re.search(r"\bpoints?\b|積分|分位|threshold|門檻", ctx, re.I):
        return f"{raw}（積分）"
    if re.search(r"physical cards|cards?|張卡|卡片總量|發行總量", ctx, re.I):
        if re.search(r"\bbillion\b|十億|亿", ctx, re.I):
            return f"{raw}（十億張卡）"
        if re.search(r"\bmillion\b|百萬", ctx, re.I):
            return f"{raw}（百萬張卡）"
        return f"{raw}（張卡）"
    if re.search(r"per\s*(pack|pull)|每包|每抽|單包", ctx, re.I):
        return f"{raw}（每抽/每包）"
    return raw


def _market_number_meanings(source: str, numbers: list[str]) -> list[str]:
    src = clean_text(source)
    low = src.lower()
    out: list[str] = []
    seen: set[str] = set()
    for n in numbers[:4]:
        token = str(n)
        display_n = _number_with_unit(token, _find_number_context(src, token))
        token_l = token.lower()
        is_money = "$" in token_l
        idx = low.find(token_l)
        if idx < 0 and token_l.startswith("$"):
            idx = low.find(token_l[1:])
        context = src[max(0, idx - 64): min(len(src), idx + 96)] if idx >= 0 else src[:120]
        line = ""
        plain_num = re.sub(r"[^0-9.]", "", token_l)
        if re.search(r"(legacy\s*pack|pack\s*\d+\.\d+|版本|version|series)", context, re.I) and re.fullmatch(r"\d+\.\d+", plain_num):
            line = f"{display_n} 在這裡是版本編號，不是價格。"
        elif not is_money and re.search(r"serialized|限量|編號|编号|/\s*\d+", context, re.I):
            line = f"{display_n} 代表限量編號或稀有度門檻。"
        elif (not is_money) and re.search(r"produced|累計|累计|cumulatively|physical cards|卡片總量|發行總量", context, re.I):
            line = f"{display_n} 代表已發行實體卡數量規模。"
        elif re.search(r"revenue|營收|收入|generated", context, re.I):
            line = f"{display_n} 在這則貼文裡代表營收規模。"
        elif re.search(r"flipping|flip|profit|收益|利潤|赚", context, re.I):
            line = f"{display_n} 代表單筆交易收益或利潤規模。"
        elif re.search(r"market size|市場規模|forecast|預估|by\s*2030|2030", context, re.I):
            line = f"{display_n} 代表市場規模的預估值。"
        elif re.search(r"sold|sale|成交|售出|拍出|record|acquired|deal|交易", context, re.I):
            line = f"{display_n} 代表成交金額或價格里程碑。"
        elif re.search(r"per\s*(pack|pull)|每包|每抽|單包|售價|price|top value|最高價值", context, re.I):
            line = f"{display_n} 代表產品售價或價值區間。"
        elif re.fullmatch(r"\d+(?:\.\d+)?", str(n)) and re.search(r"pack|版本|series|legacy|卡包", low, re.I):
            line = f"{display_n} 多半是版本或批次編號。"
        else:
            line = f"{display_n} 是貼文提到的市場參考數據。"
        key = dedupe_key(line)
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(line)
        if len(out) >= 3:
            break
    return out


def _market_impact_line(source: str) -> str:
    src = clean_text(source)
    if re.search(r"one piece|black label|champion prize|high-end move|top collectors", src, re.I):
        return "這會強化高端收藏市場信心，並提高 One Piece 相關標的的關注度。"
    if re.search(r"market size|forecast|預估|成長|growth", src, re.I):
        return "這則內容會提高社群對市場成長議題的關注度。"
    if re.search(r"sold|成交|拍出|record", src, re.I):
        return "這則內容會把討論焦點拉到高價成交與估值區間。"
    if re.search(r"pack|卡包|launch|上新|release", src, re.I):
        return "這則內容直接影響玩家對入場時機與開包策略的判斷。"
    return "這則內容反映當前市場討論方向，建議搭配原文脈絡判讀。"


def _market_is_number_dump(summary: str, bullets: list[str]) -> bool:
    text = clean_text(" ".join([summary] + bullets))
    if not text:
        return True
    has_number = bool(re.search(r"\$?\d[\d,]*(?:\.\d+)?%?", text))
    has_meaning = bool(
        re.search(
            r"代表|意指|用來|售價|成交|營收|市場規模|版本|單位|區間|預估|預測|影響|帶動|反映|說明",
            text,
            re.I,
        )
    )
    has_template = bool(re.search(r"(提到的數據包含|數據[:：])", text))
    return has_number and (not has_meaning or has_template)


def build_editorial_copy(text: str, card_type: str, account: str) -> dict[str, Any]:
    source = clean_text(text)
    lines = pick_signal_lines(source, limit=5)
    lead = lines[0] if lines else source
    second_line = lines[1] if len(lines) > 1 else ""
    schedule = extract_schedule_facts(source, limit=3)
    numbers = extract_numeric_facts(source, limit=3)
    event_facts = build_event_facts(source) if card_type == "event" else {}
    report_digest = build_report_digest(source) if card_type == "report" else {}
    prefix = _headline_prefix(card_type)
    topic = infer_topic_phrase(lead, card_type)
    lead_focus = _abstract_focus_line(lead, max_len=84) or compact_point(lead, 84)
    second_focus = _abstract_focus_line(second_line, max_len=72) if second_line else ""
    lead_focus_cn = "" if _is_mostly_ascii(lead_focus) else lead_focus
    second_focus_cn = "" if _is_mostly_ascii(second_focus) else second_focus
    if not lead_focus_cn and lead_focus:
        lead_focus_cn = _english_focus_hint(source, card_type, topic)
    if not second_focus_cn and second_focus:
        second_focus_cn = _english_focus_hint(second_line or source, card_type, topic)
    if card_type == "insight" and dedupe_key(lead_focus_cn) in {"社群互動更新", "社群互動貼文重點在現場動態與回饋"}:
        fallback_focus = _abstract_focus_line(source, max_len=88) or compact_point(strip_links_mentions(source), 88)
        if fallback_focus:
            lead_focus_cn = fallback_focus
    if second_focus_cn and lead_focus_cn and similarity_ratio(second_focus_cn, lead_focus_cn) >= 0.66:
        second_focus_cn = ""

    title_seed = _abstract_focus_line(lead, max_len=72) or compact_point(source, 72) or f"@{account} update"
    title_body = topic if _is_mostly_ascii(title_seed) else title_seed
    title = f"{prefix}｜{title_body}"
    fivew = build_fivew_brief(
        source=source,
        card_type=card_type,
        account=account,
        topic=topic,
        lead_focus=(lead_focus_cn or lead_focus or topic),
        event_facts=event_facts,
        schedule=schedule,
    )
    frame = build_universal_digest_frame(
        source=source,
        card_type=card_type,
        account=account,
        topic=topic,
        lead_focus=(lead_focus_cn or lead_focus or topic),
        fivew=fivew,
        schedule=schedule,
        numbers=numbers,
        event_facts=event_facts,
        report_digest=report_digest,
    )

    summary = clean_text(str(frame.get("summary") or ""))
    bullets_seed = frame.get("bullets") if isinstance(frame.get("bullets"), list) else []
    bullets = _unique_non_empty([clean_text(str(x)) for x in bullets_seed], limit=3)
    fallback_by_type = {
        "event": ["建議動作：先看原文確認時間、地點與參與方式。"],
        "market": ["影響：這則內容會影響社群對市場價格與熱度的判讀。"],
        "announcement": ["下一步：留意官方後續公告。"],
        "feature": ["下一步：確認正式開放條件與時間。"],
        "report": ["使用建議：先比較方案差異再採用。"],
        "insight": ["延伸追蹤：觀察後續是否出現明確規則。"],
    }
    for pad in fallback_by_type.get(card_type, []):
        if len(bullets) >= 3:
            break
        bullets.append(pad)

    if not summary:
        summary = clean_text(f"{prefix}已完成重整，主軸為「{topic}」，可查看下方重點與原文連結。")
    if similarity_ratio(summary, source) > 0.82 or not _contains_cjk(summary):
        summary = clean_text(f"{prefix}已完成重整，主軸為「{topic}」，可查看下方重點與原文連結。")
    return {
        "title": title,
        "summary": summary[:280],
        "bullets": bullets[:3],
    }


def normalize_detail_lines(lines: Any, limit: int = 6) -> list[str]:
    if not isinstance(lines, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in lines:
        text = clean_text(str(raw))
        if not text:
            continue
        sig = dedupe_key(text)
        if sig and sig in seen:
            continue
        if sig:
            seen.add(sig)
        out.append(text[:180])
        if len(out) >= limit:
            break
    return out


def build_detail_copy(
    text: str,
    card_type: str,
    account: str,
    event_facts_override: dict[str, str] | None = None,
) -> dict[str, Any]:
    source = clean_text(text)
    if not source:
        return {"detail_summary": "", "detail_lines": []}

    lines = pick_signal_lines(source, limit=8)
    lead = lines[0] if lines else source
    second = lines[1] if len(lines) > 1 else ""
    topic = infer_topic_phrase(lead, card_type)
    lead_focus = _abstract_focus_line(lead, max_len=90) or compact_point(lead, 90)
    second_focus = _abstract_focus_line(second, max_len=80) if second else ""
    if _is_mostly_ascii(lead_focus):
        lead_focus = _english_focus_hint(source, card_type, topic)
    if _is_mostly_ascii(second_focus):
        second_focus = _english_focus_hint(second or source, card_type, topic)
    if second_focus and similarity_ratio(second_focus, lead_focus) >= 0.7:
        second_focus = ""

    schedule = extract_schedule_facts(source, limit=4)
    numbers = extract_numeric_facts(source, limit=4)
    event_facts = normalize_event_facts(event_facts_override or {})
    if card_type == "event":
        inferred = build_event_facts(source)
        merged = inferred.copy()
        merged.update(event_facts)
        event_facts = merged

    fivew = build_fivew_brief(
        source=source,
        card_type=card_type,
        account=account,
        topic=topic,
        lead_focus=lead_focus or topic,
        event_facts=event_facts,
        schedule=schedule,
    )
    report_digest = build_report_digest(source) if card_type == "report" else {}
    frame = build_universal_digest_frame(
        source=source,
        card_type=card_type,
        account=account,
        topic=topic,
        lead_focus=(lead_focus or topic),
        fivew=fivew,
        schedule=schedule,
        numbers=numbers,
        event_facts=event_facts,
        report_digest=report_digest,
    )

    detail_summary = clean_text(str(frame.get("detail_summary") or frame.get("summary") or ""))
    detail_lines = normalize_detail_lines(frame.get("detail_lines"), limit=6)
    if not detail_lines:
        detail_lines = normalize_detail_lines(frame.get("bullets"), limit=6)

    if second_focus:
        second_line = f"補充脈絡：{second_focus}"
        if not any(dedupe_key(second_line) == dedupe_key(row) for row in detail_lines):
            detail_lines.append(second_line)
    detail_lines = normalize_detail_lines(detail_lines, limit=6)

    who = fivew.get("who") or f"@{account}"
    if not detail_summary:
        detail_summary = clean_text(f"{who} 這篇內容主軸是「{topic}」，建議搭配原文查看完整脈絡。")[:420]
    elif len(strip_links_mentions(detail_summary)) < 36 and detail_lines:
        pad = "；".join(detail_lines[:2])
        detail_summary = clean_text(f"{detail_summary} 重點補充：{pad}")[:420]
    return {
        "detail_summary": detail_summary,
        "detail_lines": detail_lines[:6],
    }


def enrich_detail_view(card: StoryCard) -> None:
    base_text = clean_text(card.raw_text or card.summary or card.title)
    if not base_text:
        return
    built = build_detail_copy(
        base_text,
        card.card_type,
        card.account,
        event_facts_override=normalize_event_facts(card.event_facts),
    )
    built_summary = clean_text(str(built.get("detail_summary") or ""))
    built_lines = normalize_detail_lines(built.get("detail_lines"), limit=6)

    existing_summary = clean_text(str(card.detail_summary or ""))
    existing_lines = normalize_detail_lines(card.detail_lines, limit=6)
    generic_line_hits = sum(1 for x in existing_lines if GENERIC_DETAIL_RE.search(clean_text(x)))
    has_generic_detail = bool(GENERIC_DETAIL_RE.search(existing_summary)) or generic_line_hits > 0
    weak_summary = (
        not existing_summary
        or len(strip_links_mentions(existing_summary)) < 36
        or similarity_ratio(existing_summary, clean_text(card.summary or "")) >= 0.92
        or bool(GENERIC_DETAIL_RE.search(existing_summary))
    )
    weak_lines = len(existing_lines) < 3 or generic_line_hits >= max(1, len(existing_lines) - 1)
    if card.card_type in {"event", "insight", "feature", "announcement"} and has_generic_detail:
        weak_summary = True
        weak_lines = True
    if card.card_type in {"feature", "announcement"}:
        leaked_event_frame = any(
            re.search(r"(活動主軸|時間與地點|獎勵重點|參與方式)", clean_text(x), re.I)
            for x in existing_lines
        )
        if leaked_event_frame:
            weak_summary = True
            weak_lines = True

    if card.card_type == "market":
        card.detail_summary = built_summary or existing_summary[:420]
        card.detail_lines = built_lines[:6]
        return

    if weak_summary and built_summary:
        card.detail_summary = built_summary
    elif existing_summary:
        card.detail_summary = existing_summary[:420]
    elif built_summary:
        card.detail_summary = built_summary

    if weak_lines and built_lines:
        card.detail_lines = built_lines
    else:
        card.detail_lines = existing_lines[:6]

def build_glance_line(card: StoryCard) -> str:
    raw = card.raw_text or card.title
    schedule = extract_schedule_facts(raw, limit=2)
    numbers = extract_numeric_facts(raw, limit=2)
    topic = infer_topic_phrase(card.title or raw, card.card_type)
    if card.card_type == "event":
        facts = card.event_facts or build_event_facts(raw)
        if facts.get("schedule") and facts.get("reward"):
            return f"活動 {topic}，時間 {facts['schedule']}，重點獎勵 {facts['reward']}。"
        if facts.get("schedule"):
            return f"活動 {topic}，時間 {facts['schedule']}，建議提前安排參與。"
        if schedule and facts.get("reward"):
            return f"活動 {topic}，時間 {schedule[0]}，重點獎勵 {facts['reward']}。"
        if schedule:
            return f"活動 {topic}，時間 {schedule[0]}，建議提前安排參與。"
        return f"活動 {topic}，建議追蹤報名與地點資訊。"
    if card.card_type == "feature":
        threshold = extract_sbt_threshold_facts(raw)
        tiers = [str(x) for x in threshold.get("tiers", []) if str(x).strip()]
        snapshot = str(threshold.get("snapshot") or "").strip()
        if tiers:
            tier_text = "、".join(tiers[:3])
            if snapshot:
                return f"功能更新 {topic}，門檻 {tier_text}，快照 {snapshot}。"
            return f"功能更新 {topic}，門檻 {tier_text}，需留意快照時間。"
        if schedule:
            return f"功能進度 {topic}，時間節點 {schedule[0]}，留意開放條件。"
        return f"功能進度 {topic}，留意下一則官方公告。"
    if card.card_type == "announcement":
        return f"官方公告 {topic}，請以原文作為最終版本。"
    if card.card_type == "market":
        meanings = _market_number_meanings(raw, numbers)
        if meanings:
            return f"市場重點：{topic}。{meanings[0]}"
        if numbers:
            return f"市場重點：{topic}。貼文提到 {numbers[0]}，請搭配原文判讀。"
        return f"這則在談 {topic}，可作為市場熱度與價格走勢的觀測參考。"
    bullets = [clean_text(str(x)) for x in (card.bullets or []) if str(x).strip()]
    for b in bullets:
        stripped = re.sub(r"^(核心重點|提及數字|補充內容|追蹤方向)[:：]\s*", "", b).strip()
        if stripped:
            return compact_point(stripped, 88)
    if numbers:
        return f"社群焦點 {topic}，提及數字 {numbers[0]}。"
    return f"社群焦點 {topic}。"


def infer_topic_labels(card: StoryCard) -> list[str]:
    # 分類信號只看原文/標題/結構化事實，避免被 AI 摘要文案反向污染。
    source = clean_text(" ".join(
        [
            str(card.raw_text or ""),
            str(card.title or ""),
            " ".join(str(x) for x in (normalize_event_facts(card.event_facts).values())),
        ]
    ))
    labels: list[str] = []

    def add(label: str) -> None:
        if label not in labels and label in ALLOWED_TOPIC_LABELS:
            labels.append(label)

    account = str(card.account or "").strip().lower().lstrip("@")
    if account.startswith("renaiss"):
        add("official")

    strict_event_call = bool(STRICT_EVENT_CALL_RE.search(source))
    has_threshold_notice = bool(SBT_THRESHOLD_NOTICE_RE.search(source))
    has_event_signal = card.card_type == "event" or _has_event_evidence(source, timeline_iso=str(card.timeline_date or ""))
    facts = normalize_event_facts(card.event_facts)
    if card.card_type == "event" and (facts.get("schedule") or facts.get("participation") or facts.get("location")):
        has_event_signal = True
    if has_threshold_notice and not strict_event_call:
        # 門檻/快照資訊本身不等於活動；除非同文具備明確參與語意。
        has_event_signal = _has_event_evidence(source, timeline_iso=str(card.timeline_date or ""))
    if has_event_signal:
        add("events")

    def _has_sbt_evidence(text: str, card_type: str, facts_map: dict[str, str]) -> bool:
        src = clean_text(text)
        if not src:
            return False
        reward_txt = clean_text(" ".join(str(v) for v in facts_map.values()))
        if re.search(r"\bsbt\b|soulbound", src, re.I):
            return True
        if reward_txt and re.search(r"\bsbt\b|soulbound|積分|积分|points?|reward|獎勵|奖励|airdrop|snapshot|快照|threshold|門檻", reward_txt, re.I):
            return True
        if re.search(r"(threshold|snapshot|top\s*\d+%|快照|門檻).{0,28}(points?|積分|分)", src, re.I):
            return True
        if re.search(r"(points?|積分|分).{0,28}(threshold|snapshot|top\s*\d+%|快照|門檻)", src, re.I):
            return True
        if card_type in {"event", "feature", "announcement"}:
            if re.search(r"(reward|rewards|獎勵|奖励|airdrop|merch|周邊|周边).{0,24}(sbt|積分|积分|points?)", src, re.I):
                return True
            if re.search(r"(sbt|積分|积分|points?).{0,24}(reward|rewards|獎勵|奖励|airdrop|merch|周邊|周边)", src, re.I):
                return True
        return False

    if _has_sbt_evidence(source, card.card_type, facts):
        add("sbt")

    if re.search(
        r"pokemon|寶可夢|宝可梦|one\s*piece|tcg|卡牌|卡片|pack|luffy|psa|snkrdunk|pricecharting|collectr|op\d{1,2}",
        source,
        re.I,
    ):
        add("pokemon")

    if card.card_type in {"feature", "announcement"} or re.search(
        r"coming|upcoming|roadmap|launch|release|版本|上線|上线|開放|开放|即將|预告|progress",
        source,
        re.I,
    ):
        add("alpha")

    if card.card_type == "report" or (
        GUIDE_SIGNAL_RE.search(source) and not account.startswith("renaiss")
    ):
        add("tools")

    if not labels:
        add("other")
    return labels


def assign_topic_labels(card: StoryCard, keep_existing: bool = True) -> None:
    existing = normalize_topic_labels(card.topic_labels)
    inferred = infer_topic_labels(card)
    if keep_existing and existing:
        merged = existing + [x for x in inferred if x not in existing]
    else:
        merged = inferred if inferred else existing
    source = clean_text(" ".join(
        [
            str(card.raw_text or ""),
            str(card.title or ""),
            " ".join(str(x) for x in (normalize_event_facts(card.event_facts).values())),
        ]
    ))
    account = str(card.account or "").strip().lower().lstrip("@")

    if "events" in merged:
        strict_event_call = bool(STRICT_EVENT_CALL_RE.search(source))
        has_threshold_notice = bool(SBT_THRESHOLD_NOTICE_RE.search(source))
        if card.card_type in {"feature", "announcement"} and not _has_event_evidence(source, timeline_iso=str(card.timeline_date or "")):
            merged = [x for x in merged if x != "events"]
        if has_threshold_notice and not strict_event_call and not _has_event_evidence(source, timeline_iso=str(card.timeline_date or "")):
            merged = [x for x in merged if x != "events"]

    if "tools" in merged:
        allow_tools = card.card_type == "report" or (bool(GUIDE_SIGNAL_RE.search(source)) and not account.startswith("renaiss"))
        if not allow_tools:
            merged = [x for x in merged if x != "tools"]

    if "sbt" in merged:
        facts = normalize_event_facts(card.event_facts)
        sbt_ok = False
        if re.search(r"\bsbt\b|soulbound", source, re.I):
            sbt_ok = True
        elif re.search(r"(threshold|snapshot|top\s*\d+%|快照|門檻).{0,28}(points?|積分|分)", source, re.I):
            sbt_ok = True
        elif re.search(r"(points?|積分|分).{0,28}(threshold|snapshot|top\s*\d+%|快照|門檻)", source, re.I):
            sbt_ok = True
        else:
            reward_txt = clean_text(" ".join(str(v) for v in facts.values()))
            if reward_txt and re.search(r"\bsbt\b|soulbound|snapshot|快照|threshold|門檻", reward_txt, re.I):
                sbt_ok = True
        if not sbt_ok:
            merged = [x for x in merged if x != "sbt"]

    if account.startswith("renaiss") and "official" not in merged:
        merged.append("official")

    card.topic_labels = merged if merged else ["other"]


def enrich_card_metadata(card: StoryCard) -> None:
    base_dt = _parse_iso_safe(card.published_at) or datetime.now(timezone.utc)
    timeline_iso, _timeline_label = extract_timeline_date(card.raw_text or card.title, base_dt=base_dt)
    card.template_id = choose_template_id(card.card_type)
    card.timeline_date = timeline_iso
    card.event_facts = build_event_facts(card.raw_text or card.title) if card.card_type == "event" else {}
    card.glance = compact_point(build_glance_line(card), 120)
    card.urgency = compute_urgency(card.card_type, card.importance, timeline_iso)
    assign_topic_labels(card, keep_existing=True)


def normalize_card_semantics(card: StoryCard, preserve_type: bool = False) -> None:
    source = card.raw_text or card.summary or card.title
    base_dt = _parse_iso_safe(card.published_at) or datetime.now(timezone.utc)
    timeline_iso, _ = extract_timeline_date(source, base_dt=base_dt)
    inferred_type, inferred_layout, inferred_tags = classify_story(source)

    if not preserve_type or card.card_type not in ALLOWED_CARD_TYPES:
        card.card_type = inferred_type
    elif card.card_type in {"event", "insight"} and inferred_type != card.card_type:
        # 允許用語意規則修正 AI 在 event/insight 之間的誤分，避免「活動被判成觀點」或反向誤判。
        card.card_type = inferred_type
    if not str(card.layout or "").strip() or str(card.layout).lower() not in {"poster", "brief", "data", "timeline"}:
        card.layout = inferred_layout
    if not card.tags or card.tags == ["觀點"]:
        card.tags = inferred_tags[:]
    if timeline_iso:
        card.timeline_date = timeline_iso
    elif not card.timeline_date:
        card.timeline_date = ""

    card.template_id = choose_template_id(card.card_type)
    if card.card_type == "event":
        inferred_facts = build_event_facts(source)
        existing_facts = normalize_event_facts(card.event_facts)
        merged_facts = inferred_facts.copy()
        merged_facts.update(existing_facts)
        card.event_facts = merged_facts
    else:
        card.event_facts = {}
    card.glance = compact_point(build_glance_line(card), 120)
    card.urgency = compute_urgency(card.card_type, card.importance, card.timeline_date)
    assign_topic_labels(card, keep_existing=True)


def normalize_cards_semantics(cards: list[StoryCard], preserve_type: bool = False) -> None:
    for card in cards:
        normalize_card_semantics(card, preserve_type=preserve_type)


GENERIC_SUMMARY_RE = re.compile(
    r"^這則內容(?:屬於|偏向)|^重點摘要[:：]|主題脈絡[:：]|內容屬社群互動貼文|可作為討論基礎|適合當作趨勢參考|建議關注後續公告|需與其他來源交叉驗證|核心事件[:：]|關鍵數字[:：]|判讀建議[:：]|市場訊號[:：]|貼文提到的數據包含|這類資訊通常會直接影響市場預期與討論熱度|可先視為社群風向參考|官方更新方向已釋出，細節待後續公告|重點在(?:提升|同步|擴大|釋出|補充|反映)|若後續出現規則、獎勵或價格條件",
    re.I,
)
GENERIC_BULLET_RE = re.compile(
    r"^(分析主題|文中數據|使用方式|活動主軸|行動建議|觀點定位|追蹤方式|訊號定位|判讀建議|核心訊號|關鍵數字|決策建議|核心事件|提及數字|可見數字)[:：]",
    re.I,
)
LOW_VALUE_BULLET_RE = re.compile(
    r"(可持續追蹤後續官方或社群回應|作為社群趨勢參考|持續追蹤|可作為研究線索，不直接當結論)",
    re.I,
)
BAD_MONEY_UNIT_RE = re.compile(r"\$\s*\d[\d,]*(?:\.\d+)?[kmb]?\s*（(?:版本|序號|張卡|年份)）", re.I)
GENERIC_DETAIL_RE = re.compile(
    r"(分享了社群現場觀察|可當風向參考|風向參考|若涉及規則、獎勵或價格|有機會延伸成後續活動或功能公告|現場重點[:：]|補充觀察[:：]|可能影響[:：]|下一步[:：]留意官方是否補充具體規則|先記錄生效時間，並追蹤下一則官方公告確認規則|重點在(?:提升|同步|擴大|釋出|補充|反映))",
    re.I,
)


def _summary_needs_rewrite(summary: str, source: str) -> bool:
    s = clean_text(summary)
    if not s:
        return True
    if BAD_MONEY_UNIT_RE.search(s):
        return True
    if GENERIC_SUMMARY_RE.search(s):
        return True
    if len(strip_links_mentions(s)) < 14:
        return True
    if similarity_ratio(s, source) >= 0.72:
        return True
    if not _contains_cjk(s):
        return True
    return False


def _bullets_need_rewrite(bullets: list[str], source: str) -> bool:
    if not bullets:
        return True
    generic = 0
    low_value = 0
    copied = 0
    bad_money_unit = 0
    for raw in bullets:
        b = clean_text(raw)
        if not b:
            generic += 1
            continue
        if BAD_MONEY_UNIT_RE.search(b):
            bad_money_unit += 1
        if GENERIC_BULLET_RE.search(b):
            generic += 1
        if LOW_VALUE_BULLET_RE.search(b):
            low_value += 1
        if similarity_ratio(b, source) >= 0.8:
            copied += 1
    if bad_money_unit >= 1:
        return True
    if generic >= max(1, len(bullets) - 1):
        return True
    if low_value >= 1:
        return True
    if copied >= max(1, len(bullets) - 1):
        return True
    return False


def denoise_editorial_text(card: StoryCard) -> None:
    source = card.raw_text or card.summary or card.title
    if not source:
        return
    shaped = build_editorial_copy(source, card.card_type, card.account)
    shaped_summary = str(shaped.get("summary") or "").strip()
    shaped_bullets = shaped.get("bullets") if isinstance(shaped.get("bullets"), list) else []

    if card.card_type == "market":
        summary = clean_text(card.summary or "")
        bullets = [clean_text(str(x))[:120] for x in (card.bullets or []) if str(x).strip()]
        needs_rewrite = (
            _summary_needs_rewrite(summary, source)
            or _bullets_need_rewrite(bullets, source)
            or _market_is_number_dump(summary, bullets)
        )
        if needs_rewrite:
            if shaped_summary:
                card.summary = shaped_summary[:320]
            if shaped_bullets:
                card.bullets = [clean_text(str(x))[:120] for x in shaped_bullets if str(x).strip()][:3]
        else:
            card.summary = summary[:320]
            card.bullets = bullets[:3]
        return

    summary = clean_text(card.summary or "")
    if _summary_needs_rewrite(summary, source) and shaped_summary:
        card.summary = shaped_summary[:320]

    bullets = [clean_text(str(x))[:120] for x in (card.bullets or []) if str(x).strip()]
    if _bullets_need_rewrite(bullets, source):
        card.bullets = [clean_text(str(x))[:120] for x in shaped_bullets if str(x).strip()][:3]
    elif card.card_type == "report":
        # 報告類固定用方案重點，避免退回模板句。
        card.bullets = [clean_text(str(x))[:120] for x in shaped_bullets if str(x).strip()][:3]
        if shaped_summary:
            card.summary = shaped_summary[:320]


def apply_editorial_fallback(cards: list[StoryCard]) -> None:
    for card in cards:
        text = card.raw_text or card.summary or card.title
        if not text:
            continue
        shaped = build_editorial_copy(text, card.card_type, card.account)
        new_title = str(shaped.get("title") or "").strip()
        new_summary = str(shaped.get("summary") or "").strip()
        new_bullets = shaped.get("bullets") if isinstance(shaped.get("bullets"), list) else []

        if new_title:
            card.title = new_title[:120]
        if new_summary:
            card.summary = new_summary[:320]
        if new_bullets:
            card.bullets = [clean_text(str(x))[:120] for x in new_bullets if str(x).strip()][:3]
        enrich_card_metadata(card)
        normalize_card_semantics(card)
        enrich_detail_view(card)


def _detail_needs_rewrite(card: StoryCard) -> bool:
    source = clean_text(card.raw_text or card.summary or card.title)
    summary = clean_text(card.detail_summary or "")
    lines = normalize_detail_lines(card.detail_lines, limit=6)
    if not summary or len(strip_links_mentions(summary)) < 36:
        return True
    if similarity_ratio(summary, clean_text(card.summary or "")) >= 0.92:
        return True
    if GENERIC_DETAIL_RE.search(summary):
        return True
    if not lines or len(lines) < 3:
        return True
    generic_hits = sum(1 for x in lines if GENERIC_DETAIL_RE.search(clean_text(x)))
    if generic_hits >= max(1, len(lines) - 1):
        return True
    if source and all(similarity_ratio(clean_text(x), source) >= 0.94 for x in lines):
        return True
    return False


def _threshold_update_needs_rewrite(card: StoryCard) -> bool:
    source = clean_text(card.raw_text or card.summary or card.title)
    if not re.search(r"(sbt|points?).{0,36}(threshold|top\s*\d+%|snapshot)|threshold update", source, re.I):
        return False
    facts = extract_sbt_threshold_facts(source)
    tiers = [str(x) for x in facts.get("tiers", []) if str(x).strip()]
    snapshot = str(facts.get("snapshot") or "").strip()
    if not tiers:
        return False
    merged_text = clean_text(" ".join(
        [
            str(card.summary or ""),
            " ".join(str(x) for x in (card.bullets or [])),
            str(card.detail_summary or ""),
            " ".join(str(x) for x in (card.detail_lines or [])),
        ]
    ))
    tier_hit = any(tier in merged_text for tier in tiers[:2])
    snapshot_hit = (not snapshot) or (snapshot in merged_text) or bool(re.search(r"(snapshot|快照)", merged_text, re.I))
    return not (tier_hit and snapshot_hit)


def _sbt_acquisition_missing(card: StoryCard) -> bool:
    labels = normalize_topic_labels(card.topic_labels)
    source = clean_text(card.raw_text or card.summary or card.title)
    if "sbt" not in labels and not has_sbt_signal(source):
        return False
    merged = clean_text(
        " ".join(
            [
                str(card.summary or ""),
                " ".join(str(x) for x in (card.bullets or [])),
                str(card.detail_summary or ""),
                " ".join(str(x) for x in (card.detail_lines or [])),
            ]
        )
    )
    if re.search(r"SBT\s*取得方式", merged, re.I):
        return False
    return True


def apply_quality_guard(card: StoryCard) -> None:
    source = clean_text(card.raw_text or card.summary or card.title)
    if not source:
        return

    shaped = build_editorial_copy(source, card.card_type, card.account)
    fallback_summary = clean_text(str(shaped.get("summary") or ""))
    fallback_bullets = [clean_text(str(x))[:120] for x in (shaped.get("bullets") or []) if str(x).strip()][:3]

    summary_now = clean_text(card.summary or "")
    bullets_now = [clean_text(str(x))[:120] for x in (card.bullets or []) if str(x).strip()]

    if card.card_type == "market":
        if _summary_needs_rewrite(summary_now, source) or _market_is_number_dump(summary_now, bullets_now):
            if fallback_summary:
                card.summary = fallback_summary[:320]
        if _bullets_need_rewrite(bullets_now, source) or _market_is_number_dump(summary_now, bullets_now):
            if fallback_bullets:
                card.bullets = fallback_bullets[:3]
    else:
        if _summary_needs_rewrite(summary_now, source):
            if fallback_summary:
                card.summary = fallback_summary[:320]
        if _bullets_need_rewrite(bullets_now, source):
            if fallback_bullets:
                card.bullets = fallback_bullets[:3]
        if card.card_type == "report" and fallback_bullets:
            if len(card.bullets or []) < 3:
                card.bullets = fallback_bullets[:3]

    if _detail_needs_rewrite(card):
        rebuilt = build_detail_copy(
            source,
            card.card_type,
            card.account,
            event_facts_override=normalize_event_facts(card.event_facts),
        )
        rebuilt_summary = clean_text(str(rebuilt.get("detail_summary") or ""))
        rebuilt_lines = normalize_detail_lines(rebuilt.get("detail_lines"), limit=6)
        if rebuilt_summary:
            card.detail_summary = rebuilt_summary[:420]
        if rebuilt_lines:
            card.detail_lines = rebuilt_lines[:6]

    if _threshold_update_needs_rewrite(card):
        rebuilt = build_editorial_copy(source, card.card_type, card.account)
        rebuilt_summary = clean_text(str(rebuilt.get("summary") or ""))
        rebuilt_bullets = [clean_text(str(x))[:120] for x in (rebuilt.get("bullets") or []) if str(x).strip()][:3]
        if rebuilt_summary:
            card.summary = rebuilt_summary[:320]
        if rebuilt_bullets:
            card.bullets = rebuilt_bullets
        rebuilt_detail = build_detail_copy(
            source,
            card.card_type,
            card.account,
            event_facts_override=normalize_event_facts(card.event_facts),
        )
        rd_summary = clean_text(str(rebuilt_detail.get("detail_summary") or ""))
        rd_lines = normalize_detail_lines(rebuilt_detail.get("detail_lines"), limit=6)
        if rd_summary:
            card.detail_summary = rd_summary[:420]
        if rd_lines:
            card.detail_lines = rd_lines[:6]

    if _sbt_acquisition_missing(card):
        rebuilt = build_editorial_copy(source, card.card_type, card.account)
        rebuilt_summary = clean_text(str(rebuilt.get("summary") or ""))
        rebuilt_bullets = [clean_text(str(x))[:120] for x in (rebuilt.get("bullets") or []) if str(x).strip()][:3]
        if rebuilt_summary:
            card.summary = rebuilt_summary[:320]
        if rebuilt_bullets:
            card.bullets = rebuilt_bullets
        rebuilt_detail = build_detail_copy(
            source,
            card.card_type,
            card.account,
            event_facts_override=normalize_event_facts(card.event_facts),
        )
        rd_summary = clean_text(str(rebuilt_detail.get("detail_summary") or ""))
        rd_lines = normalize_detail_lines(rebuilt_detail.get("detail_lines"), limit=6)
        if rd_summary:
            card.detail_summary = rd_summary[:420]
        if rd_lines:
            card.detail_lines = rd_lines[:6]

def minimax_chat(prompt: str, api_key: str, max_tokens: int = 1400) -> str:
    model_name = str(
        os.getenv("MINIMAX_TEXT_MODEL")
        or os.getenv("MINIMAX_MODEL")
        or "MiniMax-M2.7"
    ).strip() or "MiniMax-M2.7"
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "reasoning_split": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    resp = requests.post(MINIMAX_URL, headers=headers, json=payload, timeout=90)
    resp.raise_for_status()
    data = resp.json()
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message") if isinstance(first.get("message"), dict) else {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    direct = data.get("reply") or data.get("output_text") or data.get("text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    base_resp = data.get("base_resp") if isinstance(data.get("base_resp"), dict) else {}
    status_msg = str(base_resp.get("status_msg") or "").strip()
    if status_msg:
        raise RuntimeError(f"MiniMax response error: {status_msg}")
    raise RuntimeError(f"MiniMax response missing content; model={model_name}")


def apply_minimax_story_refine(cards: list[StoryCard], api_key: str, feedback_context: str = "") -> None:
    for card in cards:
        prompt = (
            "你是TCG社群編輯。請先完整讀懂內容，再輸出『非抄寫』重整版本。"
            "輸出必須是 JSON，欄位固定為："
            "title,summary,bullets(長度3),card_type(layout可選:poster/brief/data/timeline),"
            "confidence(0~1),tags(最多3),event_facts(可選，僅 event 使用: reward/participation/audience/location/schedule),"
            "topic_labels(可多選: events/official/sbt/pokemon/alpha/tools/other)。"
            "限制："
            "1) 不可逐句複製原文；"
            "2) summary 要用第三人稱重述；"
            "3) bullets 每條都要是可行動或可追蹤的資訊；"
            "4) card_type 只能是 event/feature/announcement/market/report/insight；"
            "5) 必須用語意判斷分類，不可只用關鍵字；"
            "6) 只有含明確活動訊號（時間/地點/報名/參與方式）才可標為 event；"
            "7) 產品進度、版本更新、開放計畫優先標為 feature 或 announcement，不算 event；"
            "8) 單句互動、祝賀、表情、聊天回覆通常是 insight；"
            "9) topic_labels 可以多選，允許同時屬於 events 與 sbt（例如活動獎勵包含 SBT）；"
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
            "20) 整份 JSON 請控制在約 800 字元內。\n\n"
            + (f"[使用者回饋分類樣本]\n{feedback_context}\n\n" if feedback_context else "")
            + f"來源帳號: @{card.account}\n"
            f"來源URL: {card.url}\n"
            f"內容: {card.raw_text[:4200]}"
        )
        try:
            raw = minimax_chat(prompt, api_key, max_tokens=900)
            parsed = parse_json_block(raw)
            if not parsed:
                compact_retry_prompt = (
                    "請直接輸出合法 JSON，不要任何前後文字，不要 ```。"
                    "欄位固定：title,summary,bullets(3),card_type,layout,tags,confidence,event_facts,topic_labels。"
                    "全部繁體中文，且每欄位要短：title<=40字、summary<=120字、每條bullet<=30字。"
                    "不可捏造，需依據提供內容。\n\n"
                    f"帳號:@{card.account}\n"
                    f"URL:{card.url}\n"
                    f"內容:{card.raw_text[:3200]}"
                )
                raw = minimax_chat(compact_retry_prompt, api_key, max_tokens=700)
                parsed = parse_json_block(raw)
            if not parsed:
                continue
            title = str(parsed.get("title") or "").strip()
            summary = str(parsed.get("summary") or "").strip()
            bullets = parsed.get("bullets") if isinstance(parsed.get("bullets"), list) else []
            card_type = str(parsed.get("card_type") or "").strip().lower()
            layout = str(parsed.get("layout") or "").strip().lower()
            tags = parsed.get("tags") if isinstance(parsed.get("tags"), list) else []
            confidence = parsed.get("confidence")
            event_facts = normalize_event_facts(parsed.get("event_facts"))
            topic_labels = normalize_topic_labels(parsed.get("topic_labels"))
            detail_summary = clean_text(str(parsed.get("detail_summary") or ""))[:420]
            detail_lines = normalize_detail_lines(parsed.get("detail_lines"), limit=6)

            if title:
                card.title = title[:120]
            if summary:
                card.summary = summary[:320]
            if bullets:
                card.bullets = [clean_text(str(x))[:120] for x in bullets if str(x).strip()][:3] or card.bullets
            if card_type in {"event", "market", "report", "announcement", "feature", "insight"}:
                card.card_type = card_type
            if layout in {"poster", "brief", "data", "timeline"}:
                card.layout = layout
            if tags:
                card.tags = [clean_text(str(x))[:16] for x in tags if str(x).strip()][:3]
            if isinstance(confidence, (int, float)):
                card.confidence = float(max(0.0, min(1.0, confidence)))
            if card.card_type == "event" and event_facts:
                card.event_facts = event_facts
            if topic_labels:
                card.topic_labels = topic_labels
            if detail_summary:
                card.detail_summary = detail_summary
            if detail_lines:
                card.detail_lines = detail_lines
            if (
                similarity_ratio(card.summary, card.raw_text) > 0.92
                or _summary_needs_rewrite(card.summary, card.raw_text)
                or _bullets_need_rewrite([clean_text(str(x)) for x in (card.bullets or [])], card.raw_text)
                or (card.card_type == "market" and _market_is_number_dump(card.summary, [clean_text(str(x)) for x in (card.bullets or [])]))
            ):
                fallback = build_editorial_copy(card.raw_text, card.card_type, card.account)
                card.summary = str(fallback.get("summary") or card.summary)[:320]
                fb = fallback.get("bullets")
                if isinstance(fb, list) and fb:
                    card.bullets = [clean_text(str(x))[:120] for x in fb if str(x).strip()][:3]
            enrich_detail_view(card)
            card.importance = score_card(card)
            enrich_card_metadata(card)
            normalize_card_semantics(card, preserve_type=True)
        except Exception:
            continue


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
        + "\n\n[upcoming_features]\n"
        + "\n".join(f"- {x['headline']}" for x in sections.get("upcoming_features", [])[:4])
    )
    try:
        raw = minimax_chat(prompt, api_key, max_tokens=800)
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
        "likes": int(metrics_raw.get("likes", item.get("favorite_count", 0)) or 0),
        "retweets": int(metrics_raw.get("retweets", item.get("retweet_count", 0)) or 0),
        "replies": int(metrics_raw.get("replies", item.get("reply_count", 0)) or 0),
        "quotes": int(metrics_raw.get("quotes", item.get("quote_count", 0)) or 0),
        "views": int(metrics_raw.get("views", 0) or 0),
    }
    cover = extract_first_image(item.get("media"))
    reply_to_id = str(
        item.get("in_reply_to_status_id_str")
        or item.get("in_reply_to_status_id")
        or item.get("inReplyToStatusId")
        or ""
    ).strip()

    card_type, layout, tags = classify_story(text)
    shaped = build_editorial_copy(text, card_type, username)
    card = StoryCard(
        id=sid,
        account=username,
        url=url,
        title=str(shaped.get("title") or summarize_naive(text, 180)),
        summary=str(shaped.get("summary") or summarize_naive(text, 280)),
        bullets=shaped.get("bullets") if isinstance(shaped.get("bullets"), list) else extract_bullets(text),
        published_at=created_dt.isoformat(),
        confidence=0.7,
        card_type=card_type,
        layout=layout,
        tags=tags,
        raw_text=text[:2500],
        provider="twitter-cli",
        cover_image=cover,
        metrics=metrics,
        reply_to_id=reply_to_id,
    )
    card.importance = score_card(card)
    enrich_card_metadata(card)
    enrich_detail_view(card)
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


def fetch_discord_channel_messages(channel_id: str, token: str, limit: int = DEFAULT_DISCORD_MONITOR_LIMIT) -> list[dict[str, Any]]:
    headers = {
        "Authorization": f"Bot {token}",
        "User-Agent": "RenaissIntelDiscordMonitor/1.0",
    }
    params = {"limit": max(1, min(limit, 100))}
    url = f"{DISCORD_API_BASE_URL}/channels/{channel_id}/messages"
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    if resp.status_code >= 400:
        body = clean_text(resp.text or "")[:120]
        raise RuntimeError(f"HTTP {resp.status_code} {body}".strip())
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

    card_type, layout, tags = classify_story(text)
    shaped = build_editorial_copy(text, card_type, account)
    card = StoryCard(
        id=f"discord-{channel_id}-{mid}",
        account=account,
        url=_discord_message_url(item, channel_id, mid),
        title=str(shaped.get("title") or summarize_naive(text, 180)),
        summary=str(shaped.get("summary") or summarize_naive(text, 280)),
        bullets=shaped.get("bullets") if isinstance(shaped.get("bullets"), list) else extract_bullets(text),
        published_at=created_dt.isoformat(),
        confidence=0.66,
        card_type=card_type,
        layout=layout,
        tags=tags,
        raw_text=text[:2500],
        provider="discord-rest",
        cover_image=_discord_first_image(item),
        metrics={},
        reply_to_id=reply_to_id,
    )
    card.importance = score_card(card)
    enrich_card_metadata(card)
    enrich_detail_view(card)
    return card


def collect_discord_cards(
    channel_ids: list[str],
    token: str,
    since_dt: datetime,
    limit_per_channel: int = DEFAULT_DISCORD_MONITOR_LIMIT,
) -> tuple[list[StoryCard], dict[str, int], list[str]]:
    cards: list[StoryCard] = []
    stats: dict[str, int] = {}
    errors: list[str] = []

    for cid in channel_ids:
        produced = 0
        try:
            messages = fetch_discord_channel_messages(cid, token=token, limit=limit_per_channel)
        except Exception as exc:
            errors.append(f"{cid}: {clean_text(str(exc))[:120]}")
            stats[cid] = 0
            continue

        for item in messages:
            created_raw = str(item.get("timestamp") or item.get("edited_timestamp") or "").strip()
            created_dt = parse_datetime_guess(created_raw)
            if created_dt and created_dt < since_dt:
                continue
            card = build_storycard_from_discord_message(item, channel_id=cid)
            if not card:
                continue
            cards.append(card)
            produced += 1
        stats[cid] = produced

    uniq: dict[str, StoryCard] = {}
    for c in cards:
        uniq[c.id] = c
    ordered = list(uniq.values())
    ordered.sort(key=lambda c: c.published_at, reverse=True)
    return ordered, stats, errors


def collect_account_cards(username: str, since_dt: datetime, max_posts: int = DEFAULT_MAX_POSTS_PER_ACCOUNT) -> list[StoryCard]:
    cached_payload = read_json(data_dir() / "x_intel_feed.json", {})
    cached_cards_raw = cached_payload.get("cards") if isinstance(cached_payload, dict) else []
    cached_cards: list[StoryCard] = []
    if isinstance(cached_cards_raw, list):
        for item in cached_cards_raw:
            try:
                if str(item.get("account", "")).lower() != username.lower():
                    continue
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
                        metrics=item.get("metrics") if isinstance(item.get("metrics"), dict) else {},
                        importance=float(item.get("importance") or 0.0),
                        template_id=str(item.get("template_id") or "community_brief"),
                        glance=str(item.get("glance") or ""),
                        timeline_date=str(item.get("timeline_date") or ""),
                        urgency=str(item.get("urgency") or "normal"),
                        manual_pick=bool(item.get("manual_pick") or False),
                        manual_pin=bool(item.get("manual_pin") or False),
                        manual_bottom=bool(item.get("manual_bottom") or False),
                        event_facts=normalize_event_facts(item.get("event_facts")),
                        topic_labels=normalize_topic_labels(item.get("topic_labels")),
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

    ids: list[str] = []
    for _ in range(3):
        profile_text = fetch_profile_page(username)
        ids = extract_status_ids(profile_text, username)
        if ids:
            break

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

    max_fetch_rounds = max(max_posts * 8, 48)
    max_collected = max(max_posts * 3, 24)
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
                meta_text = clean_text(str(tweet_meta.get("text") or ""))
                if meta_text and len(meta_text) > len(clean_text(existing.raw_text or "")):
                    existing.raw_text = meta_text[:2500]
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
    out: dict[str, int] = {"likes": 0, "retweets": 0, "replies": 0, "quotes": 0, "views": 0}
    for card in cards:
        metrics = card.metrics if isinstance(card.metrics, dict) else {}
        for key in out:
            out[key] += int(metrics.get(key, 0) or 0)
    return out


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
        metrics=_sum_metrics(rows),
        reply_to_id=str(first.reply_to_id or ""),
    )
    merged.importance = max(float(c.importance or 0.0) for c in rows) + 0.8
    enrich_card_metadata(merged)
    enrich_detail_view(merged)
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


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def manual_picks_path() -> Path:
    return data_dir() / "x_intel_manual_picks.json"


def feedback_path() -> Path:
    return data_dir() / "x_intel_feedback.json"


def read_feedback_state() -> dict[str, Any]:
    raw = read_json(feedback_path(), {})
    if not isinstance(raw, dict):
        return {"items": {}}
    items = raw.get("items")
    if not isinstance(items, dict):
        items = {}
    return {"items": items, "updated_at": raw.get("updated_at")}


def write_feedback_state(state: dict[str, Any]) -> None:
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "items": state.get("items", {}),
    }
    write_json(feedback_path(), payload)


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
    items[tid] = {
        "label": fb_label,
        "reason": fb_reason[:220],
        "count": count,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    state["items"] = items
    write_feedback_state(state)
    return {"id": tid, "label": fb_label, "reason": fb_reason[:220], "count": count}


def feedback_training_text(max_items: int = 8) -> str:
    state = read_feedback_state()
    items = state.get("items", {})
    if not isinstance(items, dict) or not items:
        return ""

    ranked: list[tuple[str, dict[str, Any]]] = []
    for tid, info in items.items():
        if not isinstance(info, dict):
            continue
        label = str(info.get("label") or "").strip().lower()
        if label not in ALLOWED_CARD_TYPES:
            continue
        ranked.append((tid, info))
    ranked.sort(key=lambda kv: str(kv[1].get("updated_at") or ""), reverse=True)

    lines: list[str] = []
    for tid, info in ranked[:max_items]:
        reason = clean_text(str(info.get("reason") or ""))[:100]
        label = str(info.get("label") or "")
        if reason:
            lines.append(f"- id={tid}: classify={label}; reason={reason}")
        else:
            lines.append(f"- id={tid}: classify={label}")
    return "\n".join(lines)


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
        if label not in ALLOWED_CARD_TYPES:
            continue
        if card.card_type != label:
            override_count += 1
        card.card_type = label
        card.layout, default_tags = default_style_for_type(label)
        if not card.tags:
            card.tags = default_tags[:]
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
        "1) 同帳號、同主題、同日期（或同場次）且內容高度重疊，視為重複；"
        "2) 優先保留資訊更完整者（有時間/地點/獎勵/參與方式/圖片）；"
        "3) 不要刪掉跨主題卡片；"
        "4) 不可捏造。"
        "輸出 JSON：{\"drop_ids\":[...],\"notes\":[...]}。\n\n"
        f"force_keep_ids: {sorted(force_ids)}\n"
        f"cards: {json.dumps(payload_rows, ensure_ascii=False)}"
    )
    try:
        raw = minimax_chat(prompt, api_key, max_tokens=900)
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
    community = [c for c in cards if c.account.lower() != "renaissxyz"]
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
        raw = minimax_chat(prompt, api_key, max_tokens=900)
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

    target_accounts = accounts or DEFAULT_ACCOUNTS
    since_dt = datetime.now(timezone.utc) - timedelta(days=window_days)

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
        discord_cards, discord_stats, discord_errors = collect_discord_cards(
            channel_ids=[str(x) for x in discord_cfg.get("channel_ids", []) if str(x).strip()],
            token=str(discord_cfg.get("token") or ""),
            since_dt=since_dt,
            limit_per_channel=int(discord_cfg.get("limit") or DEFAULT_DISCORD_MONITOR_LIMIT),
        )
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
                    reply_to_id=str(item.get("reply_to_id") or ""),
                )
            )
        except Exception:
            continue

    merged_cards = merge_cards(account_cards, manual_cards, discord_cards)
    normalize_cards_semantics(merged_cards)
    feedback_result = apply_feedback_overrides(merged_cards)
    feedback_excluded_ids = set(feedback_result.get("excluded_ids", set()))
    source_cards: list[StoryCard] = []
    removed_by_selection = 0
    removed_by_feedback = 0
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
            continue
        if c.id in exclude_ids and c.id not in force_ids:
            removed_by_selection += 1
            continue
        source_cards.append(c)

    source_cards, removed_by_source_pref = drop_discord_event_duplicates_preferring_x(
        source_cards,
        force_include_ids=force_ids,
    )

    curated_cards, removed_count = curate_cards(
        source_cards,
        max_cards=DEFAULT_CURATED_MAX_CARDS,
        force_include_ids=force_ids,
    )
    feedback_context = feedback_training_text()
    ai_deduped = 0
    local_deduped = 0
    if api_key and curated_cards:
        apply_minimax_story_refine(curated_cards, api_key, feedback_context=feedback_context)
        normalize_cards_semantics(curated_cards, preserve_type=True)
        apply_feedback_overrides(curated_cards)
        normalize_cards_semantics(curated_cards, preserve_type=True)
        curated_cards, ai_deduped = apply_minimax_global_dedupe(curated_cards, api_key, force_include_ids=force_ids)
        curated_cards, local_deduped = drop_redundant_cards_local(curated_cards, force_include_ids=force_ids)
        curated_cards, removed_count = curate_cards(
            curated_cards,
            max_cards=DEFAULT_CURATED_MAX_CARDS,
            force_include_ids=force_ids,
        )
    else:
        apply_editorial_fallback(curated_cards)
        curated_cards, local_deduped = drop_redundant_cards_local(curated_cards, force_include_ids=force_ids)
    for card in curated_cards:
        card.manual_pick = card.manual_pick or (card.id in include_ids)
        card.manual_pin = card.id in pin_ids
        card.manual_bottom = card.id in bottom_ids
        card.importance = score_card(card)
        enrich_card_metadata(card)
        enrich_detail_view(card)
        apply_quality_guard(card)
        normalize_card_semantics(card, preserve_type=True)
        card.importance = score_card(card)
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
    payload = build_feed_payload(curated_cards, digest, window_days, target_accounts)
    payload["raw_total_cards"] = len(source_cards)
    payload["excluded_cards"] = removed_count
    payload["excluded_by_selection"] = removed_by_selection
    payload["excluded_by_feedback"] = removed_by_feedback
    payload["excluded_by_source_preference"] = int(removed_by_source_pref)
    payload["key_terms"] = key_terms
    payload["intel_sections"] = sections
    payload["intel_agenda"] = agenda
    payload["official_overview"] = build_official_overview(curated_cards, api_key=api_key or None)
    payload["format_templates"] = default_format_templates()
    payload["template_counts"] = {
        "event_poster": sum(1 for c in curated_cards if c.template_id == "event_poster"),
        "market_signal": sum(1 for c in curated_cards if c.template_id == "market_signal"),
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
    payload["source_stats"] = account_stats
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
