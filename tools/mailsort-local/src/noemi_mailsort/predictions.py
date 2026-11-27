# ILLUSTRATIVE — Python reference implementation of the MailSort Local agent
# (agents/communication/mailsort-local.md). The canonical Project NoéMI
# implementation path is Node.js; see AGENTS.md and docs/REQUIREMENTS.md.
"""Validate predictions and select eligible labels before Gmail checks."""

import json
from collections.abc import Collection
from typing import Any, NoReturn


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON keys are not allowed in a prediction")
        result[key] = value
    return result


def _reject_constant(value: str) -> NoReturn:
    raise ValueError("Non-standard JSON numbers are not allowed in a prediction")


def parse_prediction(
    response: str,
    mode: str,
    enabled_label_names: Collection[str],
) -> list[str] | dict[str, float]:
    """Return validated labels or scores; raise ValueError for invalid predictions.

    Pass names from an already validated catalog, including only enabled labels.
    Matching is exact. No thresholds, label limits, or Gmail operations are applied.
    A parsed name is not proof that the label exists in the user's Gmail account.
    """
    if mode not in ("labels", "confidence"):
        raise ValueError("Prediction mode must be labels or confidence")
    if not isinstance(response, str):
        raise ValueError("Prediction response must be JSON text")
    if isinstance(enabled_label_names, str) or not enabled_label_names:
        raise ValueError("Provide a non-empty collection of enabled label names")
    allowed = set(enabled_label_names)

    try:
        prediction = json.loads(
            response, object_pairs_hook=_unique_object, parse_constant=_reject_constant,
        )
    except json.JSONDecodeError:
        raise ValueError("Prediction must be valid JSON without Markdown or extra text") from None

    field = "predicted_labels" if mode == "labels" else "scores"
    if not isinstance(prediction, dict) or set(prediction) != {field}:
        raise ValueError(f"Prediction must be an object with exactly one field: {field}")
    values = prediction[field]

    if mode == "labels":
        if not isinstance(values, list):
            raise ValueError("predicted_labels must be an array")
        if any(not isinstance(name, str) or name not in allowed for name in values):
            raise ValueError("Prediction contains an unknown, disabled, or invalid label name")
        if len(values) != len(set(values)):
            raise ValueError("Repeated predicted labels are not allowed")
        return values

    if not isinstance(values, dict) or set(values) != allowed:
        raise ValueError("scores must contain exactly one entry for every enabled label")
    scores: dict[str, float] = {}
    for name, score in values.items():
        if type(score) not in (int, float) or not 0 <= score <= 1:
            raise ValueError("Each score must be a number between 0 and 1")
        scores[name] = float(score)
    return scores


def select_labels(response: str, mode: str, catalog: dict[str, Any]) -> list[str]:
    """Validate a response and return eligible names using a validated catalog.

    Load the catalog with load_catalog before calling this function. Confidence
    scores equal to their threshold qualify; labels-only predictions ignore
    thresholds. Check the maximum after filtering and raise ValueError on overflow.
    An empty list is a valid no-match result. No Gmail existence check or write
    is performed here.
    """
    enabled = {label["name"]: label for label in catalog["labels"] if label["enabled"]}
    prediction = parse_prediction(response, mode, enabled.keys())
    if isinstance(prediction, list):
        selected = prediction
    else:
        selected = [
            name for name, score in prediction.items()
            if score >= enabled[name]["threshold"]
        ]
    maximum = catalog["max_labels_per_email"]
    if len(selected) > maximum:
        raise ValueError(f"Prediction exceeds max_labels_per_email ({maximum}); no labels selected")
    return selected
