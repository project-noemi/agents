# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Standard-library Ollama transport and explicit model resource management."""

import json
import math
import re
import socket
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_model_config(path: Path) -> dict[str, Any]:
    settings = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("Model configuration must be a JSON object")
    endpoint = settings.get("endpoint")
    if not isinstance(endpoint, str):
        raise ValueError("endpoint must be an HTTP(S) origin")
    parsed = urlsplit(endpoint)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")):
        raise ValueError("endpoint must be an HTTP(S) origin without credentials or a path")
    parsed.port  # Validate any explicit port before making requests.
    if not isinstance(settings.get("model"), str) or not settings["model"].strip():
        raise ValueError("model must be a non-empty model name")
    timeout = settings.get("timeout_seconds")
    if type(timeout) not in (int, float) or not 0 < timeout < math.inf:
        raise ValueError("timeout_seconds must be a positive finite number")
    if not isinstance(settings.get("keep_alive"), str) or not re.fullmatch(
        r"[1-9][0-9]*(?:ms|s|m|h)", settings["keep_alive"],
    ):
        raise ValueError("keep_alive must be a positive duration such as 5m or 300s")
    if not isinstance(settings.get("unload_after_batch"), bool):
        raise ValueError("unload_after_batch must be true or false")
    if "think" not in settings or (settings["think"] is not None and type(settings["think"]) is not bool):
        raise ValueError("think must be true, false, or null")
    for name in ("body_max_characters", "context_safety_tokens"):
        if type(settings.get(name)) is not int or settings[name] < 1:
            raise ValueError(f"{name} must be a positive integer")
    options = settings.get("options")
    if not isinstance(options, dict):
        raise ValueError("options must be an object")
    for name in ("num_ctx", "num_predict", "top_k"):
        if type(options.get(name)) is not int or options[name] < 1:
            raise ValueError(f"options.{name} must be a positive integer")
    if type(options.get("seed")) is not int:
        raise ValueError("options.seed must be an integer")
    for name in ("temperature", "top_p", "repeat_penalty"):
        value = options.get(name)
        if type(value) not in (int, float) or not 0 <= value < math.inf:
            raise ValueError(f"options.{name} must be a non-negative finite number")
    if options["top_p"] > 1 or options["repeat_penalty"] == 0:
        raise ValueError("top_p must be at most 1 and repeat_penalty must be positive")
    if options["num_predict"] + settings["context_safety_tokens"] + 1024 >= options["num_ctx"]:
        raise ValueError("num_ctx must leave room for input, output, and context safety margins")
    return settings


def model_name(settings: dict[str, Any]) -> str:
    name = settings["model"]
    return name if ":" in name.rsplit("/", 1)[-1] else name + ":latest"


def request_json(settings: dict[str, Any], path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST JSON directly to Ollama; never log bodies or follow redirects/proxies."""
    request = urllib.request.Request(
        settings["endpoint"].rstrip("/") + path,
        data=json.dumps(payload, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _NoRedirect())
    try:
        with opener.open(request, timeout=settings["timeout_seconds"]) as response:
            raw = response.read(1024 * 1024 + 1)
    except urllib.error.HTTPError as error:
        raise ValueError(f"Ollama HTTP error {error.code}; check the endpoint and installed model") from None
    except (TimeoutError, socket.timeout):
        raise ValueError("Ollama request timed out") from None
    except urllib.error.URLError as error:
        if isinstance(error.reason, (TimeoutError, socket.timeout)):
            raise ValueError("Ollama request timed out") from None
        raise ValueError("Cannot connect to Ollama; check its endpoint and container networking") from None
    if len(raw) > 1024 * 1024:
        raise ValueError("Ollama response exceeded the size limit")
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ValueError("Ollama returned invalid transport JSON") from None
    if not isinstance(data, dict) or "error" in data:
        raise ValueError("Ollama returned a server error or invalid response")
    return data


def context_size(settings: dict[str, Any], prompt: str, schema: dict[str, Any]) -> int:
    """Choose one conservative allocation from the configured maximum body length."""
    # Count UTF-8 bytes as budget slots, not exact model tokens. A Unicode body
    # character uses up to four bytes; actual JSON-escaped input is checked later.
    budget = (len(prompt.encode("utf-8"))
              + len(json.dumps(schema, ensure_ascii=False).encode("utf-8"))
              + 4 * settings["body_max_characters"]
              + 1024  # Sender, subject, and email JSON allowance.
              + 1024  # Model message-wrapper allowance.
              + settings["options"]["num_predict"]
              + settings["context_safety_tokens"])
    # Leave strictly positive headroom even when the budget is block-aligned.
    size = (budget // 4096 + 1) * 4096
    if size > settings["options"]["num_ctx"]:
        raise ValueError(f"Calculated context {size} exceeds options.num_ctx ceiling "
                         f"{settings['options']['num_ctx']}; reduce input settings or raise the ceiling")
    return size


def verify_model(settings: dict[str, Any]) -> None:
    info = request_json(settings, "/api/show", {"model": model_name(settings)})
    if info.get("remote_model") or info.get("remote_host"):
        raise ValueError("Use an installed local model, not a cloud-backed model")
    model_info = info.get("model_info", {})
    if not isinstance(model_info, dict):
        raise ValueError("Ollama returned invalid model metadata")
    limits = [value for key, value in model_info.items()
              if key.endswith(".context_length") and type(value) is int]
    if limits and settings["options"]["num_ctx"] > min(limits):
        raise ValueError("Configured num_ctx exceeds the model's advertised context length")


def response_schema(names: list[str], mode: str) -> dict[str, Any]:
    if mode == "labels":
        field = "predicted_labels"
        value = {"type": "array", "items": {"type": "string", "enum": names}, "uniqueItems": True}
    elif mode == "confidence":
        field = "scores"
        value = {"type": "object", "additionalProperties": False, "required": names,
                 "properties": {name: {"type": "number", "minimum": 0, "maximum": 1} for name in names}}
    else:
        raise ValueError("Prompt mode must be labels or confidence")
    return {"type": "object", "additionalProperties": False,
            "required": [field], "properties": {field: value}}


def chat(settings: dict[str, Any], prompt: str, email: dict[str, str], schema: dict[str, Any]) -> str:
    payload = {
        "model": model_name(settings), "stream": False, "keep_alive": settings["keep_alive"],
        "format": schema, "options": settings["options"],
        "messages": [{"role": "system", "content": prompt},
                     {"role": "user", "content": json.dumps(email, ensure_ascii=False, sort_keys=True, allow_nan=False)}],
    }
    if settings["think"] is not None:
        payload["think"] = settings["think"]
    data = request_json(settings, "/api/chat", payload)
    message = data.get("message")
    if (data.get("done") is not True or data.get("done_reason") != "stop"
            or data.get("model") != model_name(settings)
            or not isinstance(message, dict) or message.get("role") != "assistant"
            or message.get("tool_calls") or not isinstance(message.get("content"), str)):
        raise ValueError("Ollama response was incomplete, truncated, or had an invalid message")
    count = data.get("prompt_eval_count")
    if type(count) is not int or count < 0:
        raise ValueError("Ollama response is missing a valid prompt token count")
    if count + settings["options"]["num_predict"] + settings["context_safety_tokens"] >= settings["options"]["num_ctx"]:
        raise ValueError("Ollama response indicates insufficient context headroom")
    return message["content"]


def unload_model(settings: dict[str, Any]) -> None:
    # Bound cleanup waiting, including when classification has already failed.
    cleanup = {**settings, "timeout_seconds": min(settings["timeout_seconds"], 30)}
    data = request_json(cleanup, "/api/generate", {"model": model_name(settings), "keep_alive": 0, "stream": False})
    if data.get("done") is not True:
        raise ValueError("Ollama did not confirm the model unload request")
