#!/usr/bin/env python3
"""Directus adapter for the Renaiss Beginner Wiki.

The website keeps its own visual system. Directus owns content editing,
roles, images, ordering, and publication state.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable


LANGS = ("zh-Hant", "zh-Hans", "en", "ko")
PAGE_JSON_FIELDS = {
    "sbtItems": "sbt_items",
    "images": "images",
    "labels": "labels",
    "topics": "topics",
    "menuLabels": "menu_labels",
    "commands": "commands",
    "commandShowcase": "command_showcase",
}

_CACHE: dict[str, Any] = {"key": "", "at": 0.0, "value": None}


class DirectusWikiError(RuntimeError):
    """Raised when Directus is configured but wiki data cannot be loaded."""


def wiki_data_hash(data: Any) -> str:
    raw = json.dumps(data or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clear_directus_wiki_cache() -> None:
    _CACHE.update({"key": "", "at": 0.0, "value": None})


def _env(name: str, default: str = "") -> str:
    return str(os.getenv(name) or default).strip()


def directus_wiki_enabled() -> bool:
    return bool(_env("DIRECTUS_URL") and (_env("DIRECTUS_TOKEN") or _env("DIRECTUS_WRITE_TOKEN")))


def directus_wiki_write_enabled() -> bool:
    return bool(_env("DIRECTUS_URL") and (_env("DIRECTUS_WRITE_TOKEN") or _env("DIRECTUS_TOKEN")))


def directus_studio_url() -> str:
    return (_env("DIRECTUS_STUDIO_URL") or _env("DIRECTUS_URL")).rstrip("/")


def directus_wiki_slug() -> str:
    return _env("DIRECTUS_WIKI_SLUG", "beginner") or "beginner"


def _collection(name: str, default: str) -> str:
    return _env(name, default) or default


def _collections() -> dict[str, str]:
    return {
        "pages": _collection("DIRECTUS_WIKI_PAGES_COLLECTION", "wiki_pages"),
        "guide_translations": _collection("DIRECTUS_WIKI_GUIDE_TRANSLATIONS_COLLECTION", "wiki_guide_translations"),
        "stats": _collection("DIRECTUS_WIKI_STATS_COLLECTION", "wiki_stats"),
        "sections": _collection("DIRECTUS_WIKI_SECTIONS_COLLECTION", "wiki_sections"),
        "section_content": _collection("DIRECTUS_WIKI_SECTION_CONTENT_COLLECTION", "wiki_section_content"),
        "section_items": _collection("DIRECTUS_WIKI_SECTION_ITEMS_COLLECTION", "wiki_section_items"),
        "tools": _collection("DIRECTUS_WIKI_TOOLS_COLLECTION", "wiki_tools"),
        "tool_translations": _collection("DIRECTUS_WIKI_TOOL_TRANSLATIONS_COLLECTION", "wiki_tool_translations"),
        "faqs": _collection("DIRECTUS_WIKI_FAQS_COLLECTION", "wiki_faqs"),
        "faq_translations": _collection("DIRECTUS_WIKI_FAQ_TRANSLATIONS_COLLECTION", "wiki_faq_translations"),
    }


def _directus_base() -> str:
    return _env("DIRECTUS_URL").rstrip("/")


def _directus_token(write: bool = False) -> str:
    if write:
        return _env("DIRECTUS_WRITE_TOKEN") or _env("DIRECTUS_TOKEN")
    return _env("DIRECTUS_TOKEN") or _env("DIRECTUS_WRITE_TOKEN")


def _truthy_env(name: str, default: bool = False) -> bool:
    raw = _env(name)
    if not raw:
        return default
    return raw.lower() not in {"0", "false", "no", "off"}


def _read_with_write_token() -> bool:
    """Use one server-side authority for reads and writes when available.

    Directus can serve stale item reads for a lower-privilege read token after a
    write. Keeping the read-after-write path on the server-side write token
    avoids false conflict checks without exposing that token to the browser.
    """

    return _truthy_env("DIRECTUS_WIKI_READ_WITH_WRITE_TOKEN", bool(_env("DIRECTUS_WRITE_TOKEN")))


def _cache_seconds() -> int:
    try:
        return max(0, int(_env("DIRECTUS_WIKI_CACHE_SECONDS", "60") or "60"))
    except Exception:
        return 60


def _request_timeout_seconds() -> int:
    try:
        return max(5, int(_env("DIRECTUS_WIKI_TIMEOUT_SECONDS", "30") or "30"))
    except Exception:
        return 30


def _json_request(
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | list[Any] | None = None,
    write: bool = False,
) -> Any:
    query = urllib.parse.urlencode(params or {}, doseq=True)
    url = f"{_directus_base()}{path}"
    if query:
        url = f"{url}?{query}"
    body = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {_directus_token(write=write)}",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method.upper(),
    )
    try:
        with urllib.request.urlopen(request, timeout=_request_timeout_seconds()) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise DirectusWikiError(f"Directus HTTP {exc.code}: {detail[:500]}") from exc
    except Exception as exc:
        raise DirectusWikiError(f"Directus request failed: {exc}") from exc
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except Exception as exc:
        raise DirectusWikiError(f"Directus returned invalid JSON: {exc}") from exc
    if isinstance(payload, dict) and "errors" in payload:
        raise DirectusWikiError(f"Directus error: {payload['errors']}")
    return payload


def _json_get(path: str, params: dict[str, Any] | None = None) -> Any:
    return _json_request("GET", path, params=params, write=_read_with_write_token())


def _json_post(path: str, payload: dict[str, Any] | list[Any]) -> Any:
    return _json_request("POST", path, payload=payload, write=True)


def _json_patch(path: str, payload: dict[str, Any]) -> Any:
    return _json_request("PATCH", path, payload=payload, write=True)


def _json_delete(path: str) -> Any:
    return _json_request("DELETE", path, write=True)


def _items(collection: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    payload = _json_get(f"/items/{collection}", params)
    data = payload.get("data") if isinstance(payload, dict) else None
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _status_filter(params: dict[str, Any]) -> dict[str, Any]:
    status = _env("DIRECTUS_WIKI_STATUS", "published")
    if status:
        params["filter[status][_eq]"] = status
    return params


def _sort_key(item: dict[str, Any]) -> tuple[int, str]:
    try:
        sort_value = int(item.get("sort") or 0)
    except Exception:
        sort_value = 0
    return (sort_value, str(item.get("id") or ""))


def _language(item: dict[str, Any]) -> str:
    return str(item.get("language") or item.get("languages_code") or "zh-Hant").strip() or "zh-Hant"


def _id_value(item: dict[str, Any] | Any) -> Any:
    if isinstance(item, dict):
        return item.get("id")
    return item


def _relation_id(item: dict[str, Any], field: str) -> Any:
    return _id_value(item.get(field))


def _id_key(value: Any) -> str:
    raw = _id_value(value)
    return "" if raw is None else str(raw)


def _quote_id(value: Any) -> str:
    return urllib.parse.quote(str(value), safe="")


def _text(item: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if value is not None:
            return str(value)
    return ""


def _authors(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value or "")
    return [part.strip() for part in text.replace("、", ",").replace("，", ",").split(",") if part.strip()]


def _directus_asset_url(value: Any) -> str:
    file_id = _id_value(value)
    if not file_id:
        return ""
    raw = str(file_id)
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return f"{_directus_base()}/assets/{urllib.parse.quote(raw)}"


def _ensure_guide(data: dict[str, Any], lang: str) -> dict[str, Any]:
    guides = data.setdefault("guides", {})
    guide = guides.setdefault(lang, {"title": "", "subtitle": "", "eyebrow": "", "stats": [], "sections": []})
    guide.setdefault("stats", [])
    guide.setdefault("sections", [])
    return guide


def _page_item(collections: dict[str, str], slug: str) -> dict[str, Any]:
    page_fields = ",".join(["id", "slug", "status", *PAGE_JSON_FIELDS.values()])
    rows = _items(
        collections["pages"],
        _status_filter({
            "filter[slug][_eq]": slug,
            "limit": 1,
            "fields": page_fields,
        }),
    )
    if not rows:
        raise DirectusWikiError(f"Directus wiki page not found: {slug}")
    return rows[0]


def _find_one(collection: str, filters: dict[str, Any], fields: str = "id") -> dict[str, Any] | None:
    params: dict[str, Any] = {"limit": 1, "fields": fields}
    for key, value in filters.items():
        params[f"filter[{key}][_eq]"] = value
    rows = _items(collection, params)
    return rows[0] if rows else None


def _create_item(collection: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = _json_post(f"/items/{collection}", payload)
    data = response.get("data") if isinstance(response, dict) else None
    return data if isinstance(data, dict) else {}


def _create_items(collection: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [payload for payload in payloads if isinstance(payload, dict)]
    if not rows:
        return []
    response = _json_post(f"/items/{collection}", rows)
    data = response.get("data") if isinstance(response, dict) else None
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _update_item(collection: str, item_id: Any, payload: dict[str, Any]) -> dict[str, Any]:
    response = _json_patch(f"/items/{collection}/{_quote_id(item_id)}", payload)
    data = response.get("data") if isinstance(response, dict) else None
    return data if isinstance(data, dict) else {}


def _delete_item(collection: str, item_id: Any) -> None:
    if item_id is None:
        return
    _json_delete(f"/items/{collection}/{_quote_id(item_id)}")


def _delete_items(collection: str, item_ids: list[Any]) -> None:
    ids = [item_id for item_id in item_ids if item_id is not None]
    if not ids:
        return
    if len(ids) == 1:
        _delete_item(collection, ids[0])
        return
    _json_request("DELETE", f"/items/{collection}", payload=ids, write=True)


def _delete_items_individual(collection: str, item_ids: list[Any]) -> int:
    ids = [item_id for item_id in item_ids if item_id is not None]
    for item_id in ids:
        _delete_item(collection, item_id)
    return len(ids)


def _upsert_item(collection: str, filters: dict[str, Any], payload: dict[str, Any]) -> str:
    existing = _find_one(collection, filters)
    if existing and existing.get("id") is not None:
        _update_item(collection, existing["id"], payload)
        return "updated"
    _create_item(collection, {**filters, **payload})
    return "created"


_RELATION_FIELDS = {"page", "section", "tool", "faq"}
_INTEGER_FIELDS = {"sort", "image_index"}
_JSON_FIELDS = set(PAGE_JSON_FIELDS.values())


def _field_equal(field: str, existing_value: Any, desired_value: Any) -> bool:
    if field in _JSON_FIELDS:
        existing_json = json.dumps(existing_value or None, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        desired_json = json.dumps(desired_value or None, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return existing_json == desired_json
    if field in _RELATION_FIELDS:
        return _id_key(existing_value) == _id_key(desired_value)
    if field in _INTEGER_FIELDS:
        try:
            existing_int = int(existing_value or 0)
        except Exception:
            existing_int = 0
        try:
            desired_int = int(desired_value or 0)
        except Exception:
            desired_int = 0
        return existing_int == desired_int
    return str(existing_value or "") == str(desired_value or "")


def _diff_payload(existing: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    diff: dict[str, Any] = {}
    for key, value in payload.items():
        if key == "languages_code" and key not in existing:
            continue
        if not _field_equal(key, existing.get(key), value):
            diff[key] = value
    return diff


def _save_item_delta(collection: str, existing: dict[str, Any] | None, payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
    if not existing or existing.get("id") is None:
        created = _create_item(collection, payload)
        return created, "created"
    diff = _diff_payload(existing, payload)
    if not diff:
        return existing, "unchanged"
    updated = _update_item(collection, existing["id"], diff)
    next_row = {**existing, **diff}
    if updated:
        next_row.update(updated)
    return next_row, "updated"


def _record_change(changed: dict[str, int], result: str) -> None:
    if result not in changed:
        changed[result] = 0
    changed[result] += 1


def _delete_extra_rows(collection: str, rows: list[dict[str, Any]]) -> int:
    ids = [row.get("id") for row in rows if isinstance(row, dict) and row.get("id") is not None]
    if not ids:
        return 0
    return _delete_items_individual(collection, ids)


def _published_reusable_rows(
    collection: str,
    params: dict[str, Any],
    keep_count: int,
    status: str,
    changed: dict[str, int],
) -> list[dict[str, Any]]:
    rows = sorted(
        _items(collection, params),
        key=lambda item: (0 if _text(item, "status") == status else 1, *_sort_key(item)),
    )
    for row in rows[keep_count:]:
        if row.get("id") is None or _text(row, "status") != status:
            continue
        _, result = _save_item_delta(collection, row, {"status": "archived"})
        _record_change(changed, result)
    return rows[:keep_count]


def _filter_params(filters: dict[str, Any], fields: str = "id") -> dict[str, Any]:
    params: dict[str, Any] = {"limit": -1, "fields": fields}
    for key, value in filters.items():
        params[f"filter[{key}][_eq]"] = value
    return params


def _in_filter_params(field: str, values: list[Any], fields: str, sort: str | None = None) -> dict[str, Any]:
    ids = [str(value) for value in values if value is not None and str(value) != ""]
    params: dict[str, Any] = {
        "filter[%s][_in]" % field: ",".join(ids),
        "limit": -1,
        "fields": fields,
    }
    if sort:
        params["sort"] = sort
    return params


def _delete_filtered(collection: str, filters: dict[str, Any]) -> int:
    rows = _items(collection, _filter_params(filters, fields="id"))
    if rows:
        _json_request(
            "DELETE",
            f"/items/{collection}",
            payload={"query": {"filter": {key: {"_eq": value} for key, value in filters.items()}}},
            write=True,
        )
    return len(rows)


def _delete_filtered_in(collection: str, field: str, values: list[Any]) -> int:
    ids = [str(value) for value in values if value is not None and str(value) != ""]
    if not ids:
        return 0
    rows = _items(
        collection,
        {
            "filter[%s][_in]" % field: ",".join(ids),
            "limit": -1,
            "fields": "id",
        },
    )
    _json_request(
        "DELETE",
        f"/items/{collection}",
        payload={"query": {"filter": {field: {"_in": ids}}}},
        write=True,
    )
    return len(rows)


def _build_beginner_wiki(slug: str) -> dict[str, Any]:
    collections = _collections()
    page = _page_item(collections, slug)
    page_id = page.get("id")
    data: dict[str, Any] = {"guides": {}, "tools": [], "faq": {}}
    for data_key, field in PAGE_JSON_FIELDS.items():
        value = page.get(field)
        if isinstance(value, (dict, list)):
            data[data_key] = value

    guide_rows = _items(
        collections["guide_translations"],
        {"filter[page][_eq]": page_id, "limit": -1, "fields": "id,page,language,languages_code,title,subtitle,eyebrow"},
    )
    for row in guide_rows:
        lang = _language(row)
        guide = _ensure_guide(data, lang)
        guide["title"] = _text(row, "title")
        guide["subtitle"] = _text(row, "subtitle")
        guide["eyebrow"] = _text(row, "eyebrow")

    stat_rows = sorted(
        _items(collections["stats"], {"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,sort,language,languages_code,label,value"}),
        key=_sort_key,
    )
    for row in stat_rows:
        lang = _language(row)
        _ensure_guide(data, lang)["stats"].append([_text(row, "label"), _text(row, "value")])

    section_rows = sorted(
        _items(
            collections["sections"],
            _status_filter({
                "filter[page][_eq]": page_id,
                "limit": -1,
                "sort": "sort",
                "fields": "id,page,status,sort,topic,type,image_index,image_url,image_file,layout",
            }),
        ),
        key=_sort_key,
    )
    section_ids = [_id_key(row.get("id")) for row in section_rows]
    section_base: dict[Any, dict[str, Any]] = {}
    for section in section_rows:
        section_key = _id_key(section.get("id"))
        image_index = section.get("image_index")
        try:
            image_index = int(image_index)
        except Exception:
            image_index = 0
        base = {
            "type": _text(section, "type") or "intro",
            "topic": _text(section, "topic") or "start",
            "image": image_index,
            "layout": _text(section, "layout") or "image-left",
        }
        image_url = _text(section, "image_url") or _directus_asset_url(section.get("image_file"))
        if image_url:
            base["imageUrl"] = image_url
        section_base[section_key] = base

    section_content_by_id: dict[Any, list[dict[str, Any]]] = {section_id: [] for section_id in section_ids}
    section_items_by_id: dict[Any, list[dict[str, Any]]] = {section_id: [] for section_id in section_ids}
    if section_ids:
        for row in _items(
            collections["section_content"],
            _in_filter_params(
                "section",
                section_ids,
                "id,section,language,languages_code,title,text,intro,intro_title",
            ),
        ):
            section_content_by_id.setdefault(_id_key(row.get("section")), []).append(row)
        for row in sorted(
            _items(
                collections["section_items"],
                _in_filter_params(
                    "section",
                    section_ids,
                    "id,section,sort,language,languages_code,item_group,title,body",
                    sort="sort",
                ),
            ),
            key=lambda item: (_id_key(item.get("section")), *_sort_key(item)),
        ):
            section_items_by_id.setdefault(_id_key(row.get("section")), []).append(row)

    for section_id in section_ids:
        content_rows = list(section_content_by_id.get(section_id) or [])
        item_rows = sorted(section_items_by_id.get(section_id) or [], key=_sort_key)
        items_by_lang_group: dict[tuple[str, str], list[list[str] | str]] = {}
        for item in item_rows:
            lang = _language(item)
            group = _text(item, "item_group") or "items"
            if group == "bullets":
                value: list[str] | str = _text(item, "body", "title")
            else:
                value = [_text(item, "title"), _text(item, "body")]
            items_by_lang_group.setdefault((lang, group), []).append(value)

        if not content_rows:
            for lang in LANGS:
                content_rows.append({"language": lang})

        for content in content_rows:
            lang = _language(content)
            section = copy.deepcopy(section_base.get(section_id, {"type": "intro", "topic": "start"}))
            section_type = section.get("type") or "intro"
            section["title"] = _text(content, "title")
            text = _text(content, "text")
            intro = _text(content, "intro")
            intro_title = _text(content, "intro_title", "introTitle")
            if text:
                section["text"] = text
            if intro:
                section["intro"] = intro
            if intro_title:
                section["introTitle"] = intro_title
            if section_type in {"intro", "sbtChecklist"}:
                section["bullets"] = items_by_lang_group.get((lang, "bullets"), [])
            if section_type in {"steps", "cards", "ratings"}:
                section["items"] = items_by_lang_group.get((lang, "items"), [])
            if section_type == "sbtChecklist":
                section["primer"] = items_by_lang_group.get((lang, "primer"), [])
            _ensure_guide(data, lang)["sections"].append(section)

    tool_rows = sorted(
        _items(collections["tools"], _status_filter({"limit": -1, "sort": "sort", "fields": "id,status,sort,link,authors"})),
        key=_sort_key,
    )
    tool_ids = [_id_key(tool.get("id")) for tool in tool_rows]
    tool_translations_by_id: dict[Any, list[dict[str, Any]]] = {tool_id: [] for tool_id in tool_ids}
    if tool_ids:
        for row in _items(
            collections["tool_translations"],
            _in_filter_params("tool", tool_ids, "id,tool,language,languages_code,name,link_label"),
        ):
            tool_translations_by_id.setdefault(_id_key(row.get("tool")), []).append(row)
    for tool in tool_rows:
        tool_id = _id_key(tool.get("id"))
        entry = {"name": {}, "linkLabel": {}, "link": _text(tool, "link"), "authors": _authors(tool.get("authors"))}
        translations = tool_translations_by_id.get(tool_id) or []
        for row in translations:
            lang = _language(row)
            entry["name"][lang] = _text(row, "name")
            entry["linkLabel"][lang] = _text(row, "link_label", "linkLabel")
        data["tools"].append(entry)

    faq_rows = sorted(
        _items(
            collections["faqs"],
            _status_filter({"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,status,sort"}),
        ),
        key=_sort_key,
    )
    faq_ids = [_id_key(faq.get("id")) for faq in faq_rows]
    faq_translations_by_id: dict[Any, list[dict[str, Any]]] = {faq_id: [] for faq_id in faq_ids}
    if faq_ids:
        for row in _items(
            collections["faq_translations"],
            _in_filter_params("faq", faq_ids, "id,faq,language,languages_code,question,answer"),
        ):
            faq_translations_by_id.setdefault(_id_key(row.get("faq")), []).append(row)
    for faq in faq_rows:
        translations = faq_translations_by_id.get(_id_key(faq.get("id"))) or []
        for row in translations:
            lang = _language(row)
            data.setdefault("faq", {}).setdefault(lang, []).append([_text(row, "question"), _text(row, "answer")])

    if not data.get("guides"):
        raise DirectusWikiError("Directus returned no wiki guide translations")
    return data


def read_directus_beginner_wiki(slug: str | None = None, force: bool = False) -> dict[str, Any]:
    if not directus_wiki_enabled():
        raise DirectusWikiError("Directus is not configured")
    safe_slug = slug or directus_wiki_slug()
    cache_key = f"{_directus_base()}::{safe_slug}"
    ttl = _cache_seconds()
    now = time.monotonic()
    if not force and ttl and _CACHE.get("key") == cache_key and _CACHE.get("value") is not None and now - float(_CACHE.get("at") or 0) < ttl:
        return copy.deepcopy(_CACHE["value"])
    data = _build_beginner_wiki(safe_slug)
    result = {
        "exists": True,
        "data": data,
        "meta": {
            "provider": "directus",
            "source": "directus",
            "slug": safe_slug,
            "studio_url": directus_studio_url(),
            "cache_seconds": ttl,
            "content_hash": wiki_data_hash(data),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }
    _CACHE.update({"key": cache_key, "at": now, "value": copy.deepcopy(result)})
    return result


def _read_directus_until_hash(slug: str, expected_hash: str, timeout_seconds: float = 5.0) -> dict[str, Any]:
    deadline = time.monotonic() + max(0.5, timeout_seconds)
    last: dict[str, Any] | None = None
    while True:
        clear_directus_wiki_cache()
        last = read_directus_beginner_wiki(slug, force=True)
        current_hash = str((last.get("meta") or {}).get("content_hash") or "")
        if not expected_hash or current_hash == expected_hash:
            return last
        if time.monotonic() >= deadline:
            raise DirectusWikiError(
                "Directus write verification failed: read-after-write content hash did not match"
            )
        time.sleep(0.25)


def _normalize_lang(raw: Any) -> str:
    value = str(raw or "").strip()
    if value in {"zh-Hant", "zh-TW", "zh-HK", "zh-MO", "繁體中文"}:
        return "zh-Hant"
    if value in {"zh-Hans", "zh-CN", "zh-SG", "简体中文"}:
        return "zh-Hans"
    if value == "en" or value.startswith("en-"):
        return "en"
    if value == "ko" or value.startswith("ko-"):
        return "ko"
    return "zh-Hant"


def _localized_value(value: Any, lang: str, fallback: str = "") -> str:
    if isinstance(value, dict):
        return str(value.get(lang) or value.get("zh-Hant") or value.get("en") or fallback or "")
    return str(value or fallback or "")


def _string_pair(row: Any) -> list[str]:
    if isinstance(row, list) or isinstance(row, tuple):
        return [str(row[0] if len(row) > 0 else ""), str(row[1] if len(row) > 1 else "")]
    if isinstance(row, dict):
        return [str(row.get("title") or row.get("label") or ""), str(row.get("body") or row.get("value") or "")]
    return ["", str(row or "")]


def _section_lang_value(guides: dict[str, Any], lang: str, index: int) -> dict[str, Any]:
    guide = guides.get(lang)
    if not isinstance(guide, dict):
        return {}
    sections = guide.get("sections")
    if not isinstance(sections, list) or index >= len(sections):
        return {}
    section = sections[index]
    return section if isinstance(section, dict) else {}


def _canonical_sections(guides: dict[str, Any], source_lang: str) -> tuple[str, list[dict[str, Any]]]:
    preferred = [source_lang, "zh-Hant", "zh-Hans", "en", "ko"]
    preferred.extend(str(lang) for lang in guides.keys())
    seen: set[str] = set()
    for lang in preferred:
        safe_lang = _normalize_lang(lang)
        if safe_lang in seen:
            continue
        seen.add(safe_lang)
        guide = guides.get(safe_lang)
        sections = guide.get("sections") if isinstance(guide, dict) else None
        if isinstance(sections, list) and sections:
            return safe_lang, [section for section in sections if isinstance(section, dict)]
    raise DirectusWikiError("No guide sections available to write")


def _section_item_groups(section: dict[str, Any]) -> list[tuple[str, list[Any]]]:
    groups: list[tuple[str, list[Any]]] = []
    if isinstance(section.get("bullets"), list):
        groups.append(("bullets", section.get("bullets") or []))
    if isinstance(section.get("primer"), list):
        groups.append(("primer", section.get("primer") or []))
    if isinstance(section.get("items"), list):
        groups.append(("items", section.get("items") or []))
    return groups


def _clear_page_rows(collections: dict[str, str], page_id: Any) -> dict[str, int]:
    deleted = {
        "section_content": 0,
        "section_items": 0,
        "sections": 0,
        "stats": 0,
        "tool_translations": 0,
        "tools": 0,
        "faq_translations": 0,
        "faqs": 0,
    }
    old_sections = _items(collections["sections"], _filter_params({"page": page_id}, fields="id"))
    old_section_ids = [section.get("id") for section in old_sections if section.get("id") is not None]
    deleted["section_content"] += _delete_filtered_in(collections["section_content"], "section", old_section_ids)
    deleted["section_items"] += _delete_filtered_in(collections["section_items"], "section", old_section_ids)
    deleted["sections"] += _delete_items_individual(collections["sections"], old_section_ids)

    deleted["stats"] += _delete_filtered(collections["stats"], {"page": page_id})

    old_tools = _items(collections["tools"], {"limit": -1, "fields": "id"})
    old_tool_ids = [tool.get("id") for tool in old_tools if tool.get("id") is not None]
    deleted["tool_translations"] += _delete_filtered_in(collections["tool_translations"], "tool", old_tool_ids)
    deleted["tools"] += _delete_items_individual(collections["tools"], old_tool_ids)

    old_faqs = _items(collections["faqs"], _filter_params({"page": page_id}, fields="id"))
    old_faq_ids = [faq.get("id") for faq in old_faqs if faq.get("id") is not None]
    deleted["faq_translations"] += _delete_filtered_in(collections["faq_translations"], "faq", old_faq_ids)
    deleted["faqs"] += _delete_items_individual(collections["faqs"], old_faq_ids)

    return deleted


def write_directus_beginner_wiki(
    data: dict[str, Any],
    user: str = "creator",
    role: str = "creator",
    source_lang: str | None = None,
    slug: str | None = None,
) -> dict[str, Any]:
    """Write the frontend Creator Mode draft back into Directus.

    Directus remains the source of truth. The browser posts a draft to the
    Renaiss backend, and this function uses the server-side write token.
    """

    if not directus_wiki_write_enabled():
        raise DirectusWikiError("Directus write access is not configured")
    if not isinstance(data, dict):
        raise DirectusWikiError("Wiki data must be an object")
    guides = data.get("guides")
    if not isinstance(guides, dict) or not guides:
        raise DirectusWikiError("Wiki data.guides must be a non-empty object")

    collections = _collections()
    safe_slug = slug or directus_wiki_slug()
    source = _normalize_lang(source_lang or "zh-Hant")
    canonical_lang, sections = _canonical_sections(guides, source)
    page = _page_item(collections, safe_slug)
    page_id = page.get("id")
    status = _env("DIRECTUS_WIKI_STATUS", "published") or "published"

    changed = {"created": 0, "updated": 0, "deleted": 0, "unchanged": 0}
    page_payload = {
        field: data.get(data_key)
        for data_key, field in PAGE_JSON_FIELDS.items()
        if isinstance(data.get(data_key), (dict, list))
    }
    if page_payload:
        _, result = _save_item_delta(collections["pages"], page, page_payload)
        _record_change(changed, result)
    write_langs = [lang for lang in LANGS if isinstance(guides.get(lang), dict)]
    if canonical_lang not in write_langs:
        write_langs.insert(0, canonical_lang)
    write_langs = list(dict.fromkeys(write_langs))

    for safe_lang in write_langs:
        guide = guides.get(safe_lang)
        if not isinstance(guide, dict):
            continue
        payload = {
            "page": page_id,
            "language": safe_lang,
            "languages_code": safe_lang,
            "title": str(guide.get("title") or ""),
            "subtitle": str(guide.get("subtitle") or ""),
            "eyebrow": str(guide.get("eyebrow") or ""),
        }
        existing = _find_one(
            collections["guide_translations"],
            {"page": page_id, "language": safe_lang},
            fields="id,page,language,languages_code,title,subtitle,eyebrow",
        )
        _, result = _save_item_delta(collections["guide_translations"], existing, payload)
        _record_change(changed, result)

    stat_rows = sorted(
        _items(
            collections["stats"],
            {"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,sort,language,languages_code,label,value"},
        ),
        key=lambda item: (_language(item), *_sort_key(item)),
    )
    stats_by_lang: dict[str, list[dict[str, Any]]] = {}
    for row in stat_rows:
        stats_by_lang.setdefault(_language(row), []).append(row)
    for safe_lang in write_langs:
        guide = guides.get(safe_lang)
        stats = guide.get("stats") if isinstance(guide, dict) and isinstance(guide.get("stats"), list) else []
        existing_rows = stats_by_lang.pop(safe_lang, [])
        for index, row in enumerate(stats):
            label, value = _string_pair(row)
            payload = {
                "page": page_id,
                "sort": index + 1,
                "language": safe_lang,
                "languages_code": safe_lang,
                "label": label,
                "value": value,
            }
            existing = existing_rows[index] if index < len(existing_rows) else None
            _, result = _save_item_delta(collections["stats"], existing, payload)
            _record_change(changed, result)
        changed["deleted"] += _delete_extra_rows(collections["stats"], existing_rows[len(stats):])

    old_sections = _published_reusable_rows(
        collections["sections"],
        {"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,status,sort,topic,type,image_index,image_url,layout"},
        len(sections),
        status,
        changed,
    )
    tools = data.get("tools") if isinstance(data.get("tools"), list) else []
    old_tools = _published_reusable_rows(
        collections["tools"],
        {"limit": -1, "sort": "sort", "fields": "id,status,sort,link,authors"},
        len(tools),
        status,
        changed,
    )
    faq = data.get("faq") if isinstance(data.get("faq"), dict) else {}
    canonical_faq = faq.get(source) if isinstance(faq.get(source), list) else None
    if canonical_faq is None:
        canonical_faq = faq.get(canonical_lang) if isinstance(faq.get(canonical_lang), list) else []
    faq_count = len(canonical_faq or [])
    old_faqs = _published_reusable_rows(
        collections["faqs"],
        {"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,status,sort"},
        faq_count,
        status,
        changed,
    )

    created_sections: list[dict[str, Any]] = []
    for index, base_section in enumerate(sections):
        section_type = str(base_section.get("type") or "intro")
        image_raw = base_section.get("image", base_section.get("image_index", 0))
        try:
            image_index = int(image_raw)
        except Exception:
            image_index = 0
        image_url = str(base_section.get("imageUrl") or base_section.get("image_url") or "").strip()
        payload = {
            "page": page_id,
            "status": status,
            "sort": index + 1,
            "topic": str(base_section.get("topic") or "start"),
            "type": section_type,
            "image_index": image_index,
            "image_url": image_url,
            "layout": str(base_section.get("layout") or "image-left"),
        }
        existing = old_sections[index] if index < len(old_sections) else None
        row, result = _save_item_delta(collections["sections"], existing, payload)
        created_sections.append(row)
        _record_change(changed, result)

    section_ids = [section.get("id") for section in created_sections if section.get("id") is not None]
    section_content_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    section_items_by_group: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    if section_ids:
        for row in _items(
            collections["section_content"],
            _in_filter_params(
                "section",
                section_ids,
                "id,section,language,languages_code,title,text,intro,intro_title",
            ),
        ):
            section_content_by_key.setdefault((_id_key(row.get("section")), _language(row)), []).append(row)
        for row in sorted(
            _items(
                collections["section_items"],
                _in_filter_params(
                    "section",
                    section_ids,
                    "id,section,sort,language,languages_code,item_group,title,body",
                    sort="sort",
                ),
            ),
            key=lambda item: (_id_key(item.get("section")), _language(item), _text(item, "item_group"), *_sort_key(item)),
        ):
            key = (_id_key(row.get("section")), _language(row), _text(row, "item_group") or "items")
            section_items_by_group.setdefault(key, []).append(row)

    for index, section_item in enumerate(created_sections):
        if index >= len(sections):
            break
        section_id = section_item.get("id")
        section_key = _id_key(section_id)
        for lang in write_langs:
            localized_section = _section_lang_value(guides, lang, index)
            content_payload = {
                "section": section_id,
                "language": lang,
                "languages_code": lang,
                "title": str(localized_section.get("title") or ""),
                "text": str(localized_section.get("text") or ""),
                "intro": str(localized_section.get("intro") or ""),
                "intro_title": str(localized_section.get("introTitle") or localized_section.get("intro_title") or ""),
            }
            existing_content = section_content_by_key.pop((section_key, lang), [])
            existing = existing_content[0] if existing_content else None
            _, result = _save_item_delta(collections["section_content"], existing, content_payload)
            _record_change(changed, result)
            changed["deleted"] += _delete_extra_rows(collections["section_content"], existing_content[1:])
            for group, rows in _section_item_groups(localized_section):
                group_key = (section_key, lang, group)
                existing_rows = section_items_by_group.pop(group_key, [])
                for row_index, row in enumerate(rows):
                    title, body = _string_pair(row)
                    if group == "bullets":
                        title = ""
                        body = str(row or "")
                    payload = {
                        "section": section_id,
                        "sort": row_index + 1,
                        "language": lang,
                        "languages_code": lang,
                        "item_group": group,
                        "title": title,
                        "body": body,
                    }
                    existing = existing_rows[row_index] if row_index < len(existing_rows) else None
                    _, result = _save_item_delta(collections["section_items"], existing, payload)
                    _record_change(changed, result)
                changed["deleted"] += _delete_extra_rows(collections["section_items"], existing_rows[len(rows):])
    for (section_key, lang, _group), rows in section_items_by_group.items():
        if lang in write_langs:
            changed["deleted"] += _delete_extra_rows(collections["section_items"], rows)
    for (_section_key, lang), rows in section_content_by_key.items():
        if lang in write_langs:
            changed["deleted"] += _delete_extra_rows(collections["section_content"], rows)

    created_tools: list[dict[str, Any]] = []
    tool_sources: list[dict[str, Any]] = []
    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            continue
        tool_sources.append(tool)
        payload = {
            "status": status,
            "sort": index + 1,
            "link": str(tool.get("link") or ""),
            "authors": ", ".join(_authors(tool.get("authors"))),
        }
        existing = old_tools[index] if index < len(old_tools) else None
        row, result = _save_item_delta(collections["tools"], existing, payload)
        created_tools.append(row)
        _record_change(changed, result)

    tool_ids = [tool.get("id") for tool in created_tools if tool.get("id") is not None]
    tool_translations_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    if tool_ids:
        for row in _items(
            collections["tool_translations"],
            _in_filter_params("tool", tool_ids, "id,tool,language,languages_code,name,link_label"),
        ):
            tool_translations_by_key.setdefault((_id_key(row.get("tool")), _language(row)), []).append(row)
    for index, tool_item in enumerate(created_tools):
        if index >= len(tool_sources):
            break
        tool = tool_sources[index]
        tool_id = tool_item.get("id")
        tool_key = _id_key(tool_id)
        for lang in write_langs:
            payload = {
                "tool": tool_id,
                "language": lang,
                "languages_code": lang,
                "name": _localized_value(tool.get("name"), lang),
                "link_label": _localized_value(tool.get("linkLabel"), lang),
            }
            existing_rows = tool_translations_by_key.pop((tool_key, lang), [])
            existing = existing_rows[0] if existing_rows else None
            _, result = _save_item_delta(collections["tool_translations"], existing, payload)
            _record_change(changed, result)
            changed["deleted"] += _delete_extra_rows(collections["tool_translations"], existing_rows[1:])
    for (_tool_key, lang), rows in tool_translations_by_key.items():
        if lang in write_langs:
            changed["deleted"] += _delete_extra_rows(collections["tool_translations"], rows)

    faq_payloads = [{"page": page_id, "status": status, "sort": index + 1} for index in range(faq_count)]
    created_faqs: list[dict[str, Any]] = []
    for index, payload in enumerate(faq_payloads):
        existing = old_faqs[index] if index < len(old_faqs) else None
        row, result = _save_item_delta(collections["faqs"], existing, payload)
        created_faqs.append(row)
        _record_change(changed, result)

    faq_ids = [faq_item.get("id") for faq_item in created_faqs if faq_item.get("id") is not None]
    faq_translations_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    if faq_ids:
        for row in _items(
            collections["faq_translations"],
            _in_filter_params("faq", faq_ids, "id,faq,language,languages_code,question,answer"),
        ):
            faq_translations_by_key.setdefault((_id_key(row.get("faq")), _language(row)), []).append(row)
    faq_langs = [lang for lang in LANGS if isinstance(faq.get(lang), list)]
    if not faq_langs and isinstance(faq.get(canonical_lang), list):
        faq_langs = [canonical_lang]
    for index, faq_item in enumerate(created_faqs):
        faq_id = faq_item.get("id")
        faq_key = _id_key(faq_id)
        for lang in faq_langs:
            rows = faq.get(lang) if isinstance(faq.get(lang), list) else []
            row = rows[index] if index < len(rows) else []
            question, answer = _string_pair(row)
            payload = {
                "faq": faq_id,
                "language": lang,
                "languages_code": lang,
                "question": question,
                "answer": answer,
            }
            existing_rows = faq_translations_by_key.pop((faq_key, lang), [])
            existing = existing_rows[0] if existing_rows else None
            _, result = _save_item_delta(collections["faq_translations"], existing, payload)
            _record_change(changed, result)
            changed["deleted"] += _delete_extra_rows(collections["faq_translations"], existing_rows[1:])
    for (_faq_key, lang), rows in faq_translations_by_key.items():
        if lang in faq_langs:
            changed["deleted"] += _delete_extra_rows(collections["faq_translations"], rows)

    target_hash = wiki_data_hash(data)
    fresh = _read_directus_until_hash(safe_slug, target_hash)
    fresh["meta"].update(
        {
            "updated_by": str(user or "creator"),
            "updated_role": str(role or "creator"),
            "source_lang": source,
            "canonical_lang": canonical_lang,
            "write_mode": "frontend-creator-delta",
            "directus_created": changed["created"],
            "directus_updated": changed["updated"],
            "directus_deleted": changed["deleted"],
            "directus_unchanged": changed["unchanged"],
        }
    )
    return fresh


def _translate_values(
    values: list[str],
    target_lang: str,
    translator: Callable[[list[str], str], tuple[list[str], str]],
) -> tuple[list[str], str]:
    translated = list(values)
    indexed = [(idx, value) for idx, value in enumerate(values) if str(value or "").strip()]
    if not indexed:
        return translated, "empty"
    rows, mode = translator([value for _, value in indexed], target_lang)
    if mode == "no-key":
        raise DirectusWikiError(f"Translation key is missing for target language: {target_lang}")
    for offset, (idx, fallback) in enumerate(indexed):
        candidate = str(rows[offset] if offset < len(rows) else fallback).strip()
        translated[idx] = candidate or fallback
    return translated, mode


def _translate_payload(
    payload: dict[str, Any],
    fields: list[str],
    target_lang: str,
    translator: Callable[[list[str], str], tuple[list[str], str]],
) -> tuple[dict[str, Any], str]:
    values = [str(payload.get(field) or "") for field in fields]
    translated, mode = _translate_values(values, target_lang, translator)
    return {field: translated[idx] for idx, field in enumerate(fields)}, mode


def _relation_filter(field: str, value: Any) -> dict[str, Any]:
    return {field: _id_value(value)}


def translate_directus_beginner_wiki(
    source_lang: str,
    target_langs: list[str] | tuple[str, ...] | None,
    translator: Callable[[list[str], str], tuple[list[str], str]],
    slug: str | None = None,
) -> dict[str, Any]:
    """Translate the Directus beginner wiki from one language into the others.

    This is designed for a Directus Flow webhook. Creators keep editing in
    Directus Studio; the Renaiss backend only fills the sibling translation rows.
    """

    if not directus_wiki_write_enabled():
        raise DirectusWikiError("Directus write access is not configured")
    source = str(source_lang or "zh-Hant").strip() or "zh-Hant"
    targets = [str(lang or "").strip() for lang in (target_langs or LANGS)]
    targets = [lang for lang in targets if lang and lang != source]
    if not targets:
        raise DirectusWikiError("No target languages selected")

    collections = _collections()
    page = _page_item(collections, slug or directus_wiki_slug())
    page_id = page.get("id")
    stats = {"created": 0, "updated": 0, "modes": []}

    def record(result: str, mode: str) -> None:
        if result == "created":
            stats["created"] += 1
        elif result == "updated":
            stats["updated"] += 1
        if mode:
            stats["modes"].append(mode)

    source_guide = _find_one(
        collections["guide_translations"],
        {"page": page_id, "language": source},
        fields="id,page,language,languages_code,title,subtitle,eyebrow",
    )
    if source_guide:
        guide_payload = {
            "title": _text(source_guide, "title"),
            "subtitle": _text(source_guide, "subtitle"),
            "eyebrow": _text(source_guide, "eyebrow"),
        }
        for target in targets:
            translated, mode = _translate_payload(guide_payload, ["title", "subtitle", "eyebrow"], target, translator)
            result = _upsert_item(collections["guide_translations"], {"page": page_id, "language": target}, translated)
            record(result, mode)

    source_stats = sorted(
        _items(
            collections["stats"],
            {
                "filter[page][_eq]": page_id,
                "filter[language][_eq]": source,
                "limit": -1,
                "sort": "sort",
                "fields": "id,page,sort,language,languages_code,label,value",
            },
        ),
        key=_sort_key,
    )
    for row in source_stats:
        row_payload = {"label": _text(row, "label"), "value": _text(row, "value"), "sort": row.get("sort") or 0}
        for target in targets:
            translated, mode = _translate_payload(row_payload, ["label", "value"], target, translator)
            translated["sort"] = row_payload["sort"]
            result = _upsert_item(collections["stats"], {"page": page_id, "language": target, "sort": row_payload["sort"]}, translated)
            record(result, mode)

    section_rows = sorted(
        _items(
            collections["sections"],
            _status_filter({"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,status,sort"}),
        ),
        key=_sort_key,
    )
    for section in section_rows:
        section_id = section.get("id")
        content = _find_one(
            collections["section_content"],
            {"section": section_id, "language": source},
            fields="id,section,language,languages_code,title,text,intro,intro_title",
        )
        if content:
            content_payload = {
                "title": _text(content, "title"),
                "text": _text(content, "text"),
                "intro": _text(content, "intro"),
                "intro_title": _text(content, "intro_title", "introTitle"),
            }
            for target in targets:
                translated, mode = _translate_payload(content_payload, ["title", "text", "intro", "intro_title"], target, translator)
                result = _upsert_item(collections["section_content"], {"section": section_id, "language": target}, translated)
                record(result, mode)

        source_items = sorted(
            _items(
                collections["section_items"],
                {
                    "filter[section][_eq]": section_id,
                    "filter[language][_eq]": source,
                    "limit": -1,
                    "sort": "sort",
                    "fields": "id,section,sort,language,languages_code,item_group,title,body",
                },
            ),
            key=_sort_key,
        )
        for item in source_items:
            item_group = _text(item, "item_group") or "items"
            sort = item.get("sort") or 0
            item_payload = {
                "sort": sort,
                "item_group": item_group,
                "title": _text(item, "title"),
                "body": _text(item, "body"),
            }
            for target in targets:
                translated, mode = _translate_payload(item_payload, ["title", "body"], target, translator)
                translated["sort"] = sort
                translated["item_group"] = item_group
                result = _upsert_item(
                    collections["section_items"],
                    {"section": section_id, "language": target, "item_group": item_group, "sort": sort},
                    translated,
                )
                record(result, mode)

    tool_rows = sorted(
        _items(collections["tools"], _status_filter({"limit": -1, "sort": "sort", "fields": "id,status,sort"})),
        key=_sort_key,
    )
    for tool in tool_rows:
        tool_id = tool.get("id")
        source_tool = _find_one(
            collections["tool_translations"],
            {"tool": tool_id, "language": source},
            fields="id,tool,language,languages_code,name,link_label",
        )
        if not source_tool:
            continue
        tool_payload = {"name": _text(source_tool, "name"), "link_label": _text(source_tool, "link_label", "linkLabel")}
        for target in targets:
            translated, mode = _translate_payload(tool_payload, ["name", "link_label"], target, translator)
            result = _upsert_item(collections["tool_translations"], {"tool": tool_id, "language": target}, translated)
            record(result, mode)

    faq_rows = sorted(
        _items(
            collections["faqs"],
            _status_filter({"filter[page][_eq]": page_id, "limit": -1, "sort": "sort", "fields": "id,page,status,sort"}),
        ),
        key=_sort_key,
    )
    for faq in faq_rows:
        faq_id = faq.get("id")
        source_faq = _find_one(
            collections["faq_translations"],
            {"faq": faq_id, "language": source},
            fields="id,faq,language,languages_code,question,answer",
        )
        if not source_faq:
            continue
        faq_payload = {"question": _text(source_faq, "question"), "answer": _text(source_faq, "answer")}
        for target in targets:
            translated, mode = _translate_payload(faq_payload, ["question", "answer"], target, translator)
            result = _upsert_item(collections["faq_translations"], {"faq": faq_id, "language": target}, translated)
            record(result, mode)

    clear_directus_wiki_cache()
    return {
        "source_lang": source,
        "target_langs": targets,
        "created": stats["created"],
        "updated": stats["updated"],
        "modes": sorted(set(str(mode) for mode in stats["modes"] if mode)),
    }
