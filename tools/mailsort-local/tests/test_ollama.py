"""Small Ollama boundary checks with mocked HTTP; no real inference."""

import json
import socket
import tempfile
import unittest
import urllib.error
from copy import deepcopy
from pathlib import Path
from unittest.mock import MagicMock, patch

from noemi_mailsort import ollama
from noemi_mailsort.prompts import load_catalog, render_prompt


ROOT = Path(__file__).resolve().parents[1]


class OllamaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = ollama.load_model_config(ROOT / "config/model.example.json")

    def test_model_configuration_rejects_bad_values(self) -> None:
        original = deepcopy(self.settings)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            for field, value in (
                ("endpoint", "http://user:secret@localhost:11434"),
                ("endpoint", "http://localhost:11434/api"),
                ("timeout_seconds", True), ("timeout_seconds", float("nan")),
                ("keep_alive", "0"), ("body_max_characters", 0),
                ("unload_after_batch", "true"), ("think", "false"),
            ):
                with self.subTest(field=field):
                    settings = {**original, field: value}
                    path.write_text(json.dumps(settings), encoding="utf-8")
                    with self.assertRaises(ValueError):
                        ollama.load_model_config(path)

    def test_transport_posts_json_and_reports_timeout_without_response_contents(self) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"done":true}'
        opener = MagicMock()
        opener.open.return_value = response
        with patch("noemi_mailsort.ollama.urllib.request.build_opener", return_value=opener):
            self.assertEqual(ollama.request_json(self.settings, "/api/chat", {"test": "value"}), {"done": True})
            request = opener.open.call_args.args[0]
            self.assertEqual(json.loads(request.data), {"test": "value"})
            self.assertEqual(opener.open.call_args.kwargs["timeout"], 120)
            opener.open.side_effect = urllib.error.URLError(socket.timeout())
            with self.assertRaisesRegex(ValueError, "timed out"):
                ollama.request_json(self.settings, "/api/chat", {})

    def test_context_size_tracks_truncation_changes_loaded_from_json(self) -> None:
        catalog = load_catalog(ROOT / "config/labels.example.json")
        prompt = render_prompt(catalog, "confidence")
        schema = ollama.response_schema([label["name"] for label in catalog["labels"]], "confidence")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            for limit, expected in ((1000, 16384), (2000, 20480)):
                with self.subTest(limit=limit):
                    path.write_text(json.dumps({**self.settings, "body_max_characters": limit}))
                    settings = ollama.load_model_config(path)
                    self.assertEqual(ollama.context_size(settings, prompt, schema), expected)
                    self.assertEqual(settings["options"]["num_ctx"], 40960)

    def test_context_size_accounts_for_enabled_labels_mode_schema_and_headroom(self) -> None:
        catalog = load_catalog(ROOT / "config/labels.example.json")

        def size(mode):
            names = [label["name"] for label in catalog["labels"] if label["enabled"]]
            return ollama.context_size(self.settings, render_prompt(catalog, mode), ollama.response_schema(names, mode))

        self.assertEqual(size("labels"), 12288)
        baseline = size("confidence")
        self.assertEqual(baseline, 16384)
        catalog["labels"][0]["description"] += " Additional classification guidance." * 200
        self.assertGreater(size("confidence"), baseline)
        catalog["labels"][0]["enabled"] = False
        self.assertLessEqual(size("confidence"), baseline)
        self.settings["context_safety_tokens"] += 4096
        self.assertEqual(ollama.context_size(self.settings, "instructions", {}),
                         ollama.context_size({**self.settings, "context_safety_tokens": 256}, "instructions", {}) + 4096)
        self.assertGreater(ollama.context_size(self.settings, "instructions", {"description": "x" * 5000}),
                           ollama.context_size(self.settings, "instructions", {}))

    def test_chat_uses_reference_settings_and_schema_without_tools(self) -> None:
        schema = ollama.response_schema(["Custom"], "labels")
        data = {"done": True, "done_reason": "stop", "model": "qwen3:8b", "prompt_eval_count": 100,
                "message": {"role": "assistant", "content": '{"predicted_labels":["Custom"]}'}}
        email = {"sender": "sender@example.test", "subject": "Example", "body": "body"}
        with patch("noemi_mailsort.ollama.request_json", return_value=data) as request:
            self.assertIn("Custom", ollama.chat(self.settings, "instructions", email, schema))
            payload = request.call_args.args[2]
            self.assertEqual(payload["keep_alive"], "5m")
            self.assertIs(payload["think"], False)
            self.assertIs(payload["stream"], False)
            self.assertEqual(payload["format"], schema)
            self.assertEqual(json.loads(payload["messages"][1]["content"]), email)
            self.assertEqual(payload["messages"][0], {"role": "system", "content": "instructions"})
            self.assertNotIn("tools", payload)

    def test_incomplete_outputs_and_context_pressure_are_rejected(self) -> None:
        valid = {"done": True, "done_reason": "stop", "model": "qwen3:8b", "prompt_eval_count": 100,
                 "message": {"role": "assistant", "content": "{}"}}
        for field, value in (("done", False), ("done_reason", "length"),
                             ("prompt_eval_count", None), ("prompt_eval_count", 40900)):
            with self.subTest(field=field):
                with patch("noemi_mailsort.ollama.request_json", return_value={**valid, field: value}):
                    with self.assertRaises(ValueError):
                        ollama.chat(self.settings, "instructions", {}, {})

    def test_model_check_rejects_cloud_and_unsupported_context(self) -> None:
        for info in ({"remote_host": "remote.example"}, {"model_info": {"test.context_length": 4096}}):
            with self.subTest(info=info):
                with patch("noemi_mailsort.ollama.request_json", return_value=info):
                    with self.assertRaises(ValueError):
                        ollama.verify_model(self.settings)

    def test_unload_targets_only_the_configured_model_with_zero_keep_alive(self) -> None:
        with patch("noemi_mailsort.ollama.request_json", return_value={"done": True}) as request:
            ollama.unload_model(self.settings)
            self.assertEqual(request.call_args.args[1], "/api/generate")
            self.assertEqual(request.call_args.args[2], {"model": "qwen3:8b", "keep_alive": 0, "stream": False})
            self.assertLessEqual(request.call_args.args[0]["timeout_seconds"], 30)

    def test_dynamic_confidence_schema_requires_each_category(self) -> None:
        schema = ollama.response_schema(["One", "Two"], "confidence")
        scores = schema["properties"]["scores"]
        self.assertEqual(scores["required"], ["One", "Two"])
        self.assertFalse(scores["additionalProperties"])
        self.assertEqual(set(scores["properties"]), {"One", "Two"})


if __name__ == "__main__":
    unittest.main()
