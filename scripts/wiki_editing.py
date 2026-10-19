"""Creator Mode source-language merging and incremental Wiki translation."""
from __future__ import annotations

import copy
import hmac
import os
import re

from wiki_content import LANGUAGES, WikiEditConflictError, validate_wiki_data

I18N_MONITOR_LANGS = LANGUAGES


def _normalize_lang_tag(value: str) -> str:
    if value not in LANGUAGES:
        raise ValueError("Unsupported Wiki source language")
    return value


def _wiki_target_langs(source_lang: str) -> list[str]:
    source = _normalize_lang_tag(source_lang)
    return [lang for lang in I18N_MONITOR_LANGS if lang != source]


def _wiki_translator(rows: list[str], lang: str) -> tuple[list[str], str]:
    from website_i18n_runtime import translate_wiki_texts
    return translate_wiki_texts(rows, lang)


def _should_translate_wiki_text(value: object) -> bool:
    text = str(value or "").strip()
    if not text or re.match(r"^https?://", text, re.I):
        return False
    return bool(re.search(r"[A-Za-z\u3400-\u9fff\uac00-\ud7af]", text))


def _translate_wiki_values(values: list[object], target_lang: str) -> tuple[list[str], str]:
    rows = [str(value or "") for value in values]
    indexed = [(idx, value) for idx, value in enumerate(rows) if _should_translate_wiki_text(value)]
    if not indexed:
        return rows, "empty"
    translated_rows, mode = _wiki_translator([value for _, value in indexed], target_lang)
    if mode in {"no-key", "fallback", "passthrough", "error"} or len(translated_rows) != len(indexed):
        raise RuntimeError("Wiki translation did not complete")
    if any(not str(value or "").strip() for value in translated_rows):
        raise RuntimeError("Wiki translation returned an empty field")
    out = list(rows)
    for offset, (idx, _) in enumerate(indexed):
        out[idx] = str(translated_rows[offset]).strip()
    return out, mode


_MISSING = object()


def _path_value(node: object, path: tuple[object, ...]) -> object:
    cur = node
    for part in path:
        if isinstance(cur, dict) and isinstance(part, str) and part in cur:
            cur = cur[part]
            continue
        if isinstance(cur, list) and isinstance(part, int) and 0 <= part < len(cur):
            cur = cur[part]
            continue
        return _MISSING
    return cur


def _collect_wiki_translation_refs(
    node: object,
    refs: list[tuple[object, object, tuple[object, ...]]],
    skip_keys: set[str],
    parent: object | None = None,
    key: object | None = None,
    path: tuple[object, ...] = (),
) -> list[tuple[object, object, tuple[object, ...]]]:
    if isinstance(node, str):
        if parent is not None and key is not None and str(key) not in skip_keys and _should_translate_wiki_text(node):
            refs.append((parent, key, path))
        return refs
    if isinstance(node, list):
        for index, item in enumerate(node):
            _collect_wiki_translation_refs(item, refs, skip_keys, node, index, (*path, index))
        return refs
    if isinstance(node, dict):
        for child_key, value in node.items():
            if str(child_key) in skip_keys:
                continue
            _collect_wiki_translation_refs(value, refs, skip_keys, node, child_key, (*path, child_key))
    return refs


def _translate_wiki_clone(
    value: object,
    target_lang: str,
    skip_keys: set[str] | None = None,
    previous_source: object | None = None,
    current_target: object | None = None,
) -> tuple[object, list[str]]:
    cloned = copy.deepcopy(value)
    refs: list[tuple[object, object, tuple[object, ...]]] = []
    _collect_wiki_translation_refs(cloned, refs, skip_keys or set())
    translate_jobs: list[tuple[object, object, str]] = []
    for parent, key, path in refs:
        source_value = str(parent[key] or "")  # type: ignore[index]
        previous_value = _path_value(previous_source, path) if previous_source is not None else _MISSING
        target_value = _path_value(current_target, path) if current_target is not None else _MISSING
        if previous_value is not _MISSING and str(previous_value or "") == source_value and target_value is not _MISSING and str(target_value or "").strip():
            parent[key] = str(target_value)  # type: ignore[index]
            continue
        translate_jobs.append((parent, key, source_value))
    translated, mode = _translate_wiki_values([job[2] for job in translate_jobs], target_lang)
    for index, (parent, key, _) in enumerate(translate_jobs):
        parent[key] = translated[index]  # type: ignore[index]
    return cloned, [mode] if mode and mode != "empty" else []


def _set_localized_value(row: dict, field: str, lang: str, value: str) -> None:
    current = row.get(field)
    if not isinstance(current, dict):
        current = {}
    current[lang] = value
    row[field] = current


def _auto_translate_localized_rows(
    rows: list,
    previous_rows: list,
    source: str,
    target: str,
    fields: list[str],
) -> list[str]:
    modes: list[str] = []
    for field in fields:
        jobs: list[tuple[int, str]] = []
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            previous_row = previous_rows[index] if index < len(previous_rows) and isinstance(previous_rows[index], dict) else {}
            source_value = _localized_source_value(row.get(field), source)
            previous_value = _localized_source_value(previous_row.get(field), source)
            target_value = _localized_source_value(row.get(field), target)
            if source_value == previous_value and target_value:
                _set_localized_value(row, field, target, target_value)
            else:
                jobs.append((index, source_value))
        translated_values, field_mode = _translate_wiki_values([value for _, value in jobs], target)
        modes.append(field_mode)
        for offset, (index, _) in enumerate(jobs):
            if index < len(rows) and isinstance(rows[index], dict):
                _set_localized_value(rows[index], field, target, translated_values[offset])
    return modes


def _auto_translate_wiki_data(data: dict, source_lang: str, previous_data: dict | None = None) -> tuple[dict, list[str]]:
    source = _normalize_lang_tag(source_lang)
    translated_data = copy.deepcopy(data)
    guides = translated_data.get("guides") if isinstance(translated_data.get("guides"), dict) else {}
    labels = translated_data.get("labels") if isinstance(translated_data.get("labels"), dict) else {}
    topics = translated_data.get("topics") if isinstance(translated_data.get("topics"), dict) else {}
    menu_labels = translated_data.get("menuLabels") if isinstance(translated_data.get("menuLabels"), dict) else {}
    faq = translated_data.get("faq") if isinstance(translated_data.get("faq"), dict) else {}
    tools = translated_data.get("tools") if isinstance(translated_data.get("tools"), list) else []
    commands = translated_data.get("commands") if isinstance(translated_data.get("commands"), list) else []
    command_showcase = translated_data.get("commandShowcase") if isinstance(translated_data.get("commandShowcase"), dict) else {}
    sbt_items = translated_data.get("sbtItems") if isinstance(translated_data.get("sbtItems"), list) else []
    previous = previous_data if isinstance(previous_data, dict) else {}
    previous_guides = previous.get("guides") if isinstance(previous.get("guides"), dict) else {}
    previous_labels = previous.get("labels") if isinstance(previous.get("labels"), dict) else {}
    previous_topics = previous.get("topics") if isinstance(previous.get("topics"), dict) else {}
    previous_menu_labels = previous.get("menuLabels") if isinstance(previous.get("menuLabels"), dict) else {}
    previous_faq = previous.get("faq") if isinstance(previous.get("faq"), dict) else {}
    previous_tools = previous.get("tools") if isinstance(previous.get("tools"), list) else []
    previous_commands = previous.get("commands") if isinstance(previous.get("commands"), list) else []
    previous_command_showcase = previous.get("commandShowcase") if isinstance(previous.get("commandShowcase"), dict) else {}
    previous_sbt_items = previous.get("sbtItems") if isinstance(previous.get("sbtItems"), list) else []
    source_guide = guides.get(source)
    if not isinstance(source_guide, dict):
        raise ValueError(f"data.guides.{source} is required for translation")

    modes: list[str] = []
    source_labels = labels.get(source) if isinstance(labels.get(source), dict) else None
    source_topics = topics.get(source) if isinstance(topics.get(source), list) else None
    source_menu_labels = menu_labels.get(source) if isinstance(menu_labels.get(source), dict) else None
    source_faq = faq.get(source) if isinstance(faq.get(source), list) else []
    skip_section_keys = {"type", "topic", "image", "image_index", "imageUrl", "image_url", "layout"}
    for target in _wiki_target_langs(source):
        target_guide, guide_modes = _translate_wiki_clone(
            source_guide,
            target,
            skip_section_keys,
            previous_source=previous_guides.get(source),
            current_target=guides.get(target),
        )
        guides[target] = target_guide
        modes.extend(guide_modes)
        if isinstance(source_labels, dict):
            target_labels, label_modes = _translate_wiki_clone(
                source_labels,
                target,
                previous_source=previous_labels.get(source),
                current_target=labels.get(target),
            )
            labels[target] = target_labels
            modes.extend(label_modes)
        if isinstance(source_topics, list):
            target_topics, topic_modes = _translate_wiki_clone(
                source_topics,
                target,
                skip_keys={"id", "anchor", "icon"},
                previous_source=previous_topics.get(source),
                current_target=topics.get(target),
            )
            topics[target] = target_topics
            modes.extend(topic_modes)
        if isinstance(source_menu_labels, dict):
            target_menu, menu_modes = _translate_wiki_clone(
                source_menu_labels,
                target,
                skip_keys={"ids", "icon"},
                previous_source=previous_menu_labels.get(source),
                current_target=menu_labels.get(target),
            )
            menu_labels[target] = target_menu
            modes.extend(menu_modes)
        if isinstance(source_faq, list):
            target_faq, faq_modes = _translate_wiki_clone(
                source_faq,
                target,
                previous_source=previous_faq.get(source),
                current_target=faq.get(target),
            )
            faq[target] = target_faq
            modes.extend(faq_modes)
        if tools:
            name_jobs: list[tuple[int, str]] = []
            label_jobs: list[tuple[int, str]] = []
            for index, tool in enumerate(tools):
                if not isinstance(tool, dict):
                    continue
                previous_tool = previous_tools[index] if index < len(previous_tools) and isinstance(previous_tools[index], dict) else {}
                source_name = _localized_source_value(tool.get("name"), source)
                previous_name = _localized_source_value(previous_tool.get("name"), source)
                target_name = _localized_source_value(tool.get("name"), target)
                if source_name == previous_name and target_name:
                    _set_localized_value(tool, "name", target, target_name)
                else:
                    name_jobs.append((index, source_name))
                source_label = _localized_source_value(tool.get("linkLabel"), source)
                previous_label = _localized_source_value(previous_tool.get("linkLabel"), source)
                target_label = _localized_source_value(tool.get("linkLabel"), target)
                if source_label == previous_label and target_label:
                    _set_localized_value(tool, "linkLabel", target, target_label)
                else:
                    label_jobs.append((index, source_label))
            translated_names, name_mode = _translate_wiki_values([value for _, value in name_jobs], target)
            translated_labels, label_mode = _translate_wiki_values([value for _, value in label_jobs], target)
            modes.extend([name_mode, label_mode])
            for offset, (index, _) in enumerate(name_jobs):
                if index < len(tools) and isinstance(tools[index], dict):
                    _set_localized_value(tools[index], "name", target, translated_names[offset])
            for offset, (index, _) in enumerate(label_jobs):
                if index < len(tools) and isinstance(tools[index], dict):
                    _set_localized_value(tools[index], "linkLabel", target, translated_labels[offset])
        if commands:
            modes.extend(_auto_translate_localized_rows(commands, previous_commands, source, target, ["name", "desc", "meta"]))
        showcase_images = command_showcase.get("images") if isinstance(command_showcase.get("images"), list) else []
        previous_showcase_images = previous_command_showcase.get("images") if isinstance(previous_command_showcase.get("images"), list) else []
        if showcase_images:
            modes.extend(_auto_translate_localized_rows(showcase_images, previous_showcase_images, source, target, ["caption"]))
        if sbt_items:
            modes.extend(_auto_translate_localized_rows(sbt_items, previous_sbt_items, source, target, ["name", "requirement", "badge"]))

    translated_data["guides"] = guides
    translated_data["labels"] = labels
    translated_data["topics"] = topics
    translated_data["menuLabels"] = menu_labels
    translated_data["faq"] = faq
    translated_data["tools"] = tools
    translated_data["commands"] = commands
    translated_data["commandShowcase"] = command_showcase
    translated_data["sbtItems"] = sbt_items
    return translated_data, sorted(set(mode for mode in modes if mode and mode != "empty"))


def _localized_source_value(value: object, source_lang: str) -> str:
    if isinstance(value, dict):
        return str(value.get(source_lang) or value.get("zh-Hant") or value.get("en") or "")
    return str(value or "")


def _merge_localized_source_field(latest_value: object, draft_value: object, source_lang: str) -> dict:
    merged = copy.deepcopy(latest_value) if isinstance(latest_value, dict) else {}
    merged[source_lang] = _localized_source_value(draft_value, source_lang)
    return merged


def _merge_source_language_map(latest: dict, draft: dict, key: str, source: str) -> None:
    latest_map = latest.get(key) if isinstance(latest.get(key), dict) else {}
    draft_map = draft.get(key) if isinstance(draft.get(key), dict) else {}
    merged = dict(latest_map)
    if source in draft_map:
        merged[source] = copy.deepcopy(draft_map[source])
    latest[key] = merged


def _merge_localized_row_list(
    latest_rows: list,
    draft_rows: list,
    source: str,
    fields: list[str],
) -> list[dict]:
    merged_rows: list[dict] = []
    for index, draft_row in enumerate(draft_rows):
        if not isinstance(draft_row, dict):
            continue
        latest_row = latest_rows[index] if index < len(latest_rows) and isinstance(latest_rows[index], dict) else {}
        merged_row = copy.deepcopy(draft_row)
        for field in fields:
            merged_row[field] = _merge_localized_source_field(latest_row.get(field), draft_row.get(field), source)
        merged_rows.append(merged_row)
    return merged_rows


def _merge_wiki_source_language(latest_data: object, draft_data: dict, source_lang: str) -> dict:
    """Apply only the creator's current source language onto the latest Wiki.

    The browser still submits a full draft because it is editing a rich page,
    but the server must not trust stale sibling translations from that draft.
    """

    source = _normalize_lang_tag(source_lang)
    latest = copy.deepcopy(latest_data) if isinstance(latest_data, dict) else {}
    draft = copy.deepcopy(draft_data)

    latest_guides = latest.get("guides") if isinstance(latest.get("guides"), dict) else {}
    draft_guides = draft.get("guides") if isinstance(draft.get("guides"), dict) else {}
    source_guide = draft_guides.get(source)
    if not isinstance(source_guide, dict):
        raise ValueError(f"data.guides.{source} is required for source language save")
    latest["guides"] = dict(latest_guides)
    latest["guides"][source] = source_guide

    for key in ["labels", "topics", "menuLabels"]:
        _merge_source_language_map(latest, draft, key, source)
    if isinstance(draft.get("images"), list):
        latest["images"] = copy.deepcopy(draft["images"])

    latest_faq = latest.get("faq") if isinstance(latest.get("faq"), dict) else {}
    draft_faq = draft.get("faq") if isinstance(draft.get("faq"), dict) else {}
    latest["faq"] = dict(latest_faq)
    if isinstance(draft_faq.get(source), list):
        latest["faq"][source] = copy.deepcopy(draft_faq[source])

    latest_tools = latest.get("tools") if isinstance(latest.get("tools"), list) else []
    draft_tools = draft.get("tools") if isinstance(draft.get("tools"), list) else []
    latest["tools"] = _merge_localized_row_list(latest_tools, draft_tools, source, ["name", "linkLabel"])

    if isinstance(draft.get("commands"), list):
        latest_commands = latest.get("commands") if isinstance(latest.get("commands"), list) else []
        latest["commands"] = _merge_localized_row_list(latest_commands, draft["commands"], source, ["name", "desc", "meta"])

    if isinstance(draft.get("commandShowcase"), dict):
        latest_showcase = latest.get("commandShowcase") if isinstance(latest.get("commandShowcase"), dict) else {}
        draft_showcase = copy.deepcopy(draft["commandShowcase"])
        latest_images = latest_showcase.get("images") if isinstance(latest_showcase.get("images"), list) else []
        draft_images = draft_showcase.get("images") if isinstance(draft_showcase.get("images"), list) else []
        draft_showcase["images"] = _merge_localized_row_list(latest_images, draft_images, source, ["caption"])
        latest["commandShowcase"] = draft_showcase

    latest_sbt = latest.get("sbtItems") if isinstance(latest.get("sbtItems"), list) else []
    draft_sbt = draft.get("sbtItems") if isinstance(draft.get("sbtItems"), list) else []
    merged_sbt = _merge_localized_row_list(latest_sbt, draft_sbt, source, ["name", "requirement", "badge"])
    if isinstance(draft.get("sbtItems"), list):
        latest["sbtItems"] = merged_sbt
    return latest


def save_beginner_wiki(data: dict, *, user: str, role: str, source_lang: str,
                       base_hash: str, auto_translate: bool = True) -> dict:
    from postgres_wiki_store import wiki_store
    if role not in {"admin", "creator"}:
        raise PermissionError("Wiki editor role is required")
    validate_wiki_data(data)
    source = _normalize_lang_tag(source_lang or "zh-Hant")
    if not base_hash:
        raise ValueError("base_hash is required; reload the Wiki before saving")
    store = wiki_store()
    current = store.read()
    if not current["exists"]:
        raise ValueError("Wiki is not imported; import verified content before editing")
    meta = current["meta"]
    if not hmac.compare_digest(str(base_hash), meta["content_hash"]):
        raise WikiEditConflictError("Wiki 已被其他人更新，請重新載入後再儲存，避免覆蓋對方。")
    merged = _merge_wiki_source_language(current["data"], data, source)
    should_translate = auto_translate and os.getenv("WIKI_AUTO_TRANSLATE_ON_SAVE", "1").lower() not in {"0", "false", "no", "off"}
    modes = []
    if should_translate:
        merged, modes = _auto_translate_wiki_data(merged, source, previous_data=current["data"])
    # Translation runs before the transaction. Compare both revision and hash
    # atomically afterwards so another process cannot be overwritten.
    return store.save(merged, expected_revision=meta["revision"], expected_hash=meta["content_hash"],
                      user=user, role=role, source_lang=source,
                      translation={"auto_translate": bool(should_translate), "translation_modes": modes})
