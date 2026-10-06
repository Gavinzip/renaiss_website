"""Versioned evergreen knowledge, independent of the social feed's retention/cache.

Read the same published Wiki as the UI and an explicit list of official product
documents. Changed content is re-embedded before it becomes queryable. Failed
reads/builds raise an error; they never silently serve a social-only answer.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

from beginner_wiki import read_beginner_wiki_document
from .bootstrap import clean_text, data_dir
from .embedding_cache import ensure_embeddings_for_rows

INDEX_SCHEMA = 1
DOCUMENT_PARSER_VERSION = 2
CHUNK_SIZE = 1600
INDEX_LOCK = RLock()


def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def _read(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"official_knowledge_invalid_file:{path.name}")
    return value


def _write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def _text_blocks(value: Any) -> list[str]:
    if isinstance(value, str):
        text = clean_text(value)
        return [text] if text else []
    if isinstance(value, list):
        if all(isinstance(part, str) for part in value):
            return [" — ".join(_text_blocks(part)[0] for part in value if _text_blocks(part))]
        return [text for part in value for text in _text_blocks(part)]
    if isinstance(value, dict):
        return [text for key, part in value.items() if key in {"text", "intro", "introTitle", "items", "bullets", "primer", "title", "body"} for text in _text_blocks(part)]
    return []


def _chunks(blocks: list[str]) -> list[str]:
    """Keep paragraphs/rows intact where possible; never drop a long tail."""
    chunks: list[str] = []
    current = ""
    for block in blocks:
        for start in range(0, len(block), CHUNK_SIZE):
            part = block[start:start + CHUNK_SIZE]
            if current and len(current) + len(part) + 1 > CHUNK_SIZE:
                chunks.append(current)
                current = ""
            current = f"{current}\n{part}".strip()
    if current:
        chunks.append(current)
    return chunks


def _rows(*, document: str, title: str, blocks: list[str], url: str, language: str,
          version: str, provider: str, section: str, kind: str, status: str = "published") -> list[dict[str, Any]]:
    result = []
    for index, text in enumerate(_chunks(blocks)):
        result.append({
            "id": f"{document}:{language}:{section}:{index}",
            "account": "Renaiss Wiki" if kind == "wiki" else "Renaiss",
            "url": url, "title": title, "summary": text[:240],
            "knowledge_text": text, "semantic_text": f"{title}\n{text}",
            "card_type": "guide", "source_role": "official",
            "knowledge_kind": kind, "language": language,
            "source_version": version, "source_provider": provider,
            "document_id": document, "section_id": section,
            "document_status": status, "memory_visibility": "public_site",
            "memory_expires_at": "", "date_role": "evergreen",
        })
    return result


def wiki_rows(document: dict[str, Any]) -> list[dict[str, Any]]:
    if not document.get("exists") or not isinstance(document.get("data"), dict):
        raise RuntimeError("official_knowledge_wiki_missing")
    data, meta = document["data"], document.get("meta") or {}
    version = str(meta.get("content_hash") or _hash(data))
    result: list[dict[str, Any]] = []

    def add(language: str, section: str, title: str, blocks: list[str], topic: str = "") -> None:
        url = "/beginner.html?" + urlencode({"lang": language, **({"topic": topic} if topic else {})})
        result.extend(_rows(document="beginner", title=f"Renaiss 新手教學 — {title}", blocks=blocks,
                            url=url, language=language, version=version,
                            provider=str(meta.get("provider") or ""), section=section, kind="wiki"))

    for language, guide in (data.get("guides") or {}).items():
        if not isinstance(guide, dict):
            continue
        sections = guide.get("sections") or []
        explicit_topics = {section.get("topic") for section in sections if isinstance(section, dict) and section.get("topic")}
        for index, section in enumerate(sections):
            if isinstance(section, dict):
                # Mirror the published reader's grouping for the legacy Wiki,
                # whose sections all carry topic=start in Directus.
                topic = str(section.get("topic") or "") if len(explicit_topics) > 1 else (
                    "start" if index <= 1 else "packs" if index <= 3 else "market" if index == 4 else "sbt" if index == 5 else "tcg")
                add(language, f"section-{index}", str(section.get("title") or guide.get("title") or "Guide"),
                    _text_blocks(section), topic)
        for index, faq in enumerate((data.get("faq") or {}).get(language) or []):
            blocks = _text_blocks(faq)
            add(language, f"faq-{index}", str(faq[0]) if isinstance(faq, list) and faq else "FAQ", blocks, "faq")
        for index, item in enumerate(data.get("sbtItems") or []):
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or {}).get(language) or item.get("key") or "SBT"
            requirement = (item.get("requirement") or {}).get(language) or ""
            add(language, f"sbt-{index}", f"SBT — {name}",
                [f"{name}: {requirement}", f"status={item.get('status') or ''}; difficulty={item.get('difficulty') or ''}"], "sbt")
        for index, item in enumerate(data.get("tools") or []):
            if isinstance(item, dict):
                name = (item.get("name") or {}).get(language) or "Tool"
                add(language, f"tool-{index}", name, [f"{name}: {item.get('link') or ''}; authors={', '.join(item.get('authors') or [])}"], "tools")
        for index, item in enumerate(data.get("commands") or []):
            if not isinstance(item, dict):
                continue
            def localized(key: str) -> str:
                value = item.get(key) or ""
                return str(value.get(language) or "") if isinstance(value, dict) else str(value)
            name = localized("name")
            add(language, f"command-{index}", f"TCG Pro — {name}",
                [" — ".join(localized(key) for key in ("name", "command", "meta", "desc") if localized(key))], "tools")
        captions = [str((image.get("caption") or {}).get(language) or "")
                    for image in (data.get("commandShowcase") or {}).get("images", []) if isinstance(image, dict)]
        add(language, "command-showcase", "TCG Pro 分析流程", [text for text in captions if text], "tools")
    if not result:
        raise RuntimeError("official_knowledge_wiki_empty")
    return result


def _product_document(source: dict[str, Any], root: Path) -> dict[str, Any]:
    path = root / "documents" / f"{source['id']}.json"
    cached = _read(path)
    ttl = max(0, int(os.getenv("INTEL_OFFICIAL_DOCUMENT_CACHE_SECONDS") or "3600"))
    if cached.get("url") == source["url"] and cached.get("parser_version") == DOCUMENT_PARSER_VERSION and time.time() - float(cached.get("fetched_at") or 0) < ttl:
        return cached
    response = requests.get(source["url"], timeout=(10, 30), headers={"User-Agent": "Renaiss-Knowledge/1.0"})
    response.raise_for_status()
    if "text/html" not in response.headers.get("Content-Type", "") or len(response.content) > 4_000_000:
        raise RuntimeError(f"official_knowledge_invalid_document:{source['id']}")
    soup = BeautifulSoup(response.text, "html.parser")
    main = soup.find("main") or soup.find("article") or soup.body or soup
    for node in main.select("script,style,nav,footer,button"):
        node.decompose()
    blocks = [clean_text(text) for text in main.stripped_strings if clean_text(text)]
    if len(" ".join(blocks)) < 200:
        raise RuntimeError(f"official_knowledge_document_empty:{source['id']}")
    document = {"url": source["url"], "parser_version": DOCUMENT_PARSER_VERSION, "blocks": blocks, "content_hash": _hash(blocks),
                "fetched_at": time.time(), "etag": response.headers.get("ETag", "")}
    # Preserve every source version as well as the latest read-through copy.
    _write(root / "documents" / f"{source['id']}-{document['content_hash']}.json", document)
    _write(path, document)
    return document


def load_official_knowledge(model: str, api_key: str) -> tuple[list[dict[str, Any]], dict[str, list[float]], dict[str, Any]]:
    with INDEX_LOCK:
        root = data_dir() / "official_knowledge"
        wiki = read_beginner_wiki_document(data_dir())
        rows = wiki_rows(wiki)
        manifest_path = Path(__file__).with_name("official_sources.json")
        sources = json.loads(manifest_path.read_text(encoding="utf-8"))
        for source in sources:
            document = _product_document(source, root)
            rows.extend(_rows(document=source["id"], title=source["title"], blocks=document["blocks"],
                              url=source["url"], language=source["language"], version=document["content_hash"],
                              provider="official-product-page", section="page", kind="product_document", status=source["status"]))
        revision = _hash({"schema": INDEX_SCHEMA, "model": model, "rows": rows})
        path = root / "indexes" / f"{revision}.json"
        index = _read(path)
        cache_hit = bool(index)
        if not index:
            vectors_by_id, stats = ensure_embeddings_for_rows(rows, api_key=api_key, model=model,
                cache_path=root / "embeddings.json", cache_max_entries=0)
            vectors = {}
            for row in rows:
                embedded = vectors_by_id.get(row["id"]) or {}
                if not embedded.get("vector"):
                    raise RuntimeError("official_knowledge_embedding_incomplete")
                row["embedding_key"] = embedded["key"]
                row["embedding_ready"] = True
                vectors[embedded["key"]] = embedded["vector"]
            index = {"version": revision, "schema": INDEX_SCHEMA, "embedding_model": model,
                     "generated_at": datetime.now(timezone.utc).isoformat(),
                     "wiki_version": wiki["meta"]["content_hash"], "items": rows, "vectors": vectors, "embedding_stats": stats}
            _write(path, index)
        if index.get("embedding_model") != model or not index.get("vectors"):
            raise RuntimeError("official_knowledge_index_invalid")
        return index["items"], index["vectors"], {
            "version": revision, "wiki_version": index["wiki_version"], "items": len(index["items"]),
            "generated_at": index["generated_at"], "index_cache_hit": cache_hit,
            "documents": [{"id": source["id"], "url": source["url"]} for source in sources],
        }


def authority_score(item: dict[str, Any], question: str, semantic_score: float) -> tuple[float, list[str]]:
    if not item.get("knowledge_kind") or semantic_score < 0.18:
        return 0.0, []
    q = clean_text(question).lower()
    # Only concept/usage questions prefer evergreen evidence. Recent updates keep
    # their social ranking; temporal eligibility is handled before top-k.
    if any(term in q for term in ("最近", "最新", "今天", "recent", "latest", "today")):
        return 0.0, []
    title = str(item.get("title") or "").lower()
    terms = {term for term in re.findall(r"[a-z][a-z0-9-]+", q) if term not in {"renaiss", "the", "what", "is", "a", "an", "of", "about"}}
    matches = sum(term in title for term in terms)
    return 0.14 + min(0.16, matches * 0.08), ["evergreen_official", *(["title_match"] if matches else [])]
