"""One OpenAI Responses transport for all website text features.

No provider/model substitution. Existing feature-specific validators decide
whether generated JSON is safe to publish; translation arrays stay arrays.
"""
from __future__ import annotations

import os
from typing import Any

import requests

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_TEXT_MODEL = "gpt-6-luna"
REASONING_EFFORTS = frozenset({"none", "low", "medium", "high", "xhigh", "max"})


class TextAIError(RuntimeError):
    """A safe error code: never include credentials or request bodies."""


def resolve_text_ai_key() -> str:
    for name in ("INTEL_OPENAI_TEXT_API_KEY", "OPENAI_TEXT_API_KEY", "OPENAI_API_KEY"):
        value = str(os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def text_ai_model_name() -> str:
    return str(os.getenv("OPENAI_TEXT_MODEL") or DEFAULT_TEXT_MODEL).strip()


def _positive_float(name: str, default: float, override: float | None = None) -> float:
    raw = override if override is not None else os.getenv(name, default)
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise TextAIError(f"OPENAI_INVALID_SETTING:{name}") from None
    if not 0 < value <= 300:
        raise TextAIError(f"OPENAI_INVALID_SETTING:{name}")
    return value


def extract_response_text(data: Any) -> str:
    if not isinstance(data, dict) or data.get("status") != "completed":
        reason = (data.get("incomplete_details") or {}).get("reason", "not_completed") if isinstance(data, dict) else "invalid_response"
        raise TextAIError("OPENAI_OUTPUT_INCOMPLETE:" + ("max_output_tokens" if reason == "max_output_tokens" else "not_completed"))
    parts = []
    for item in data.get("output", []):
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "refusal":
                raise TextAIError("OPENAI_REFUSAL")
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                parts.append(content["text"])
    answer = "\n".join(parts).strip()
    if not answer:
        raise TextAIError("OPENAI_EMPTY_RESPONSE")
    return answer


def text_ai_chat(
    prompt: str,
    api_key: str,
    max_output_tokens: int | None = None,
    *,
    connect_timeout_override: float | None = None,
    read_timeout_override: float | None = None,
    model_override: str | None = None,
    use_env_max_tokens: bool = True,
) -> str:
    if not api_key:
        raise TextAIError("missing_openai_api_key")
    model = str(model_override or text_ai_model_name()).strip()
    if not model.startswith("gpt-"):
        raise TextAIError("OPENAI_INVALID_MODEL")
    effort = str(os.getenv("OPENAI_TEXT_REASONING_EFFORT") or "low").strip()
    if effort not in REASONING_EFFORTS:
        raise TextAIError("OPENAI_INVALID_REASONING_EFFORT")
    raw_limit = max_output_tokens if max_output_tokens is not None else (
        os.getenv("OPENAI_TEXT_MAX_OUTPUT_TOKENS", 8192) if use_env_max_tokens else 8192)
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        raise TextAIError("OPENAI_INVALID_OUTPUT_LIMIT") from None
    if not 16 <= limit <= 128000:
        raise TextAIError("OPENAI_INVALID_OUTPUT_LIMIT")
    payload = {"model": model, "input": prompt, "store": False,
               "reasoning": {"effort": effort}, "max_output_tokens": limit}
    # Luna reasoning requests do not carry MiniMax's reasoning_split,
    # temperature, max_tokens, or chatcompletion_v2 response assumptions.
    response = requests.post(OPENAI_RESPONSES_URL,
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        json=payload, timeout=(
            _positive_float("OPENAI_TEXT_CONNECT_TIMEOUT_SECONDS", 15, connect_timeout_override),
            _positive_float("OPENAI_TEXT_READ_TIMEOUT_SECONDS", 120, read_timeout_override)),
        allow_redirects=False)
    if response.status_code != 200:
        raise TextAIError(f"OPENAI_HTTP_{response.status_code}")
    try:
        data = response.json()
    except ValueError:
        raise TextAIError("OPENAI_INVALID_RESPONSE_JSON") from None
    return extract_response_text(data)
