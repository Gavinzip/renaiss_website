from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from .bootstrap import clean_text, data_dir, similarity_ratio, strip_links_mentions


EMBED_CACHE_FILENAME = "x_intel_embedding_cache.json"


def _compact_point(text: str, max_len: int = 96) -> str:
    t = clean_text(text)
    if len(t) <= max_len:
        return t
    return t[:max_len].rsplit(" ", 1)[0].strip() + "..."


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_path() -> Path:
    return data_dir() / EMBED_CACHE_FILENAME


def _load_cache() -> dict[str, Any]:
    path = _cache_path()
    if not path.exists():
        return {"version": 1, "entries": {}, "updated_at": ""}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"version": 1, "entries": {}, "updated_at": ""}
    if not isinstance(raw, dict):
        return {"version": 1, "entries": {}, "updated_at": ""}
    entries = raw.get("entries")
    if not isinstance(entries, dict):
        entries = {}
    return {
        "version": 1,
        "entries": entries,
        "updated_at": str(raw.get("updated_at") or ""),
    }


def _save_cache(payload: dict[str, Any]) -> None:
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _semantic_text(row: dict[str, Any]) -> str:
    title = clean_text(str(row.get("title") or ""))
    summary = clean_text(str(row.get("summary") or ""))
    raw_hint = _compact_point(strip_links_mentions(str(row.get("raw_hint") or "")), 420)
    return _compact_point(" | ".join(part for part in [title, summary, raw_hint] if part), 1200)


def _cache_key(model: str, text: str) -> str:
    return hashlib.sha256(f"{model}\n{text}".encode("utf-8", "ignore")).hexdigest()


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(vec_a, vec_b):
        fx = float(x)
        fy = float(y)
        dot += fx * fy
        norm_a += fx * fx
        norm_b += fy * fy
    if norm_a <= 1e-12 or norm_b <= 1e-12:
        return 0.0
    return dot / ((norm_a ** 0.5) * (norm_b ** 0.5))


def build_title_neighbors(
    rows: list[dict[str, Any]],
    *,
    top_k: int = 8,
    sim_threshold: float = 0.44,
) -> dict[str, list[str]]:
    related_map: dict[str, list[str]] = {}
    title_map: dict[str, str] = {}
    for row in rows:
        sid = str(row.get("id") or "").strip()
        title_map[sid] = clean_text(str(row.get("title") or row.get("summary") or ""))
    for row in rows:
        sid = str(row.get("id") or "").strip()
        base_title = title_map.get(sid, "")
        if not sid:
            continue
        if not base_title:
            related_map[sid] = []
            continue
        candidates: list[tuple[float, str]] = []
        for other in rows:
            other_id = str(other.get("id") or "").strip()
            if not other_id or other_id == sid:
                continue
            other_title = title_map.get(other_id, "")
            if not other_title:
                continue
            sim = similarity_ratio(base_title, other_title)
            if sim >= sim_threshold:
                candidates.append((sim, other_id))
        candidates.sort(key=lambda x: x[0], reverse=True)
        related_map[sid] = [oid for _sim, oid in candidates[:top_k]]
    return related_map


def build_embedding_neighbors(
    rows: list[dict[str, Any]],
    *,
    api_key: str,
    model: str,
    top_k: int = 8,
    sim_threshold: float = 0.50,
    timeout_seconds: int = 80,
    batch_size: int = 40,
    cache_max_entries: int = 8000,
) -> tuple[dict[str, list[str]], dict[str, Any]]:
    cache_payload = _load_cache()
    cache_entries = cache_payload.get("entries")
    if not isinstance(cache_entries, dict):
        cache_entries = {}
        cache_payload["entries"] = cache_entries

    work_rows: list[dict[str, Any]] = []
    vectors_by_id: dict[str, list[float]] = {}
    hit = 0
    miss = 0
    now_iso = _now_iso()

    for row in rows:
        sid = str(row.get("id") or "").strip()
        if not sid:
            continue
        text = _semantic_text(row)
        if not text:
            continue
        key = _cache_key(model, text)
        work_rows.append({"id": sid, "text": text, "key": key})
        cached = cache_entries.get(key)
        if isinstance(cached, dict) and isinstance(cached.get("vector"), list) and cached.get("vector"):
            try:
                vector = [float(x) for x in cached.get("vector", [])]
            except Exception:
                vector = []
            if vector:
                vectors_by_id[sid] = vector
                cached["last_used_at"] = now_iso
                hit += 1
                continue
        miss += 1

    if miss > 0:
        pending = [row for row in work_rows if row["id"] not in vectors_by_id]
        for start in range(0, len(pending), max(1, int(batch_size))):
            chunk = pending[start:start + max(1, int(batch_size))]
            chunk_texts = [str(row["text"]) for row in chunk]
            resp = requests.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "input": chunk_texts,
                },
                timeout=max(10, int(timeout_seconds)),
            )
            if resp.status_code >= 400:
                body = clean_text(resp.text or "")[:180]
                raise RuntimeError(f"embedding_http_{resp.status_code}:{body}")
            payload = resp.json() if resp.content else {}
            data_rows = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(data_rows, list) or len(data_rows) != len(chunk):
                raise RuntimeError("embedding_bad_shape")
            for idx, item in enumerate(chunk):
                obj = data_rows[idx] if idx < len(data_rows) else {}
                emb = obj.get("embedding") if isinstance(obj, dict) else None
                if not isinstance(emb, list) or not emb:
                    raise RuntimeError("embedding_empty_vector")
                vector = [float(x) for x in emb]
                sid = str(item["id"])
                key = str(item["key"])
                vectors_by_id[sid] = vector
                cache_entries[key] = {
                    "id": sid,
                    "model": model,
                    "vector": vector,
                    "updated_at": now_iso,
                    "last_used_at": now_iso,
                }

    related_map: dict[str, list[str]] = {}
    row_ids = [str(row.get("id") or "").strip() for row in rows if str(row.get("id") or "").strip()]
    for sid in row_ids:
        base_vec = vectors_by_id.get(sid) or []
        if not base_vec:
            related_map[sid] = []
            continue
        candidates: list[tuple[float, str]] = []
        for other_id in row_ids:
            if other_id == sid:
                continue
            other_vec = vectors_by_id.get(other_id) or []
            if not other_vec:
                continue
            sim = _cosine_similarity(base_vec, other_vec)
            if sim >= sim_threshold:
                candidates.append((sim, other_id))
        candidates.sort(key=lambda x: x[0], reverse=True)
        related_map[sid] = [oid for _score, oid in candidates[:max(1, int(top_k))]]

    if cache_max_entries > 0 and len(cache_entries) > cache_max_entries:
        sortable: list[tuple[str, str]] = []
        for key, row in cache_entries.items():
            meta = row if isinstance(row, dict) else {}
            sortable.append((str(meta.get("last_used_at") or ""), key))
        sortable.sort(reverse=True)
        keep_keys = {key for _ts, key in sortable[:cache_max_entries]}
        cache_entries = {key: cache_entries[key] for key in keep_keys if key in cache_entries}
        cache_payload["entries"] = cache_entries

    cache_payload["updated_at"] = _now_iso()
    _save_cache(cache_payload)
    stats = {
        "mode": "embedding",
        "cache_hit": hit,
        "cache_miss": miss,
        "cache_size": len(cache_entries),
        "model": model,
        "top_k": int(top_k),
        "sim_threshold": float(sim_threshold),
    }
    return related_map, stats
