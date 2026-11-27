"""Essential truncation, batch lifecycle, and existing-policy integration checks."""

import json
import unittest
from pathlib import Path
from unittest.mock import patch

from noemi_mailsort.classify import classification_run, classify_batch, prepare_email
from noemi_mailsort.ollama import load_model_config
from noemi_mailsort.prompts import load_catalog


ROOT = Path(__file__).resolve().parents[1]


class ClassifyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = load_model_config(ROOT / "config/model.example.json")
        self.catalog = load_catalog(ROOT / "config/labels.example.json")
        self.email = {"sender": "sender@example.test", "subject": "Example", "body": "Fictional text"}

    def test_truncation_preserves_unicode_prefix_sender_subject_and_source(self) -> None:
        source = {"sender": "  Sender <sender@example.test> ", "subject": "  Subject\n", "body": " é🌍\nmore"}
        prepared = prepare_email(source, 4)
        self.assertEqual(prepared, {**source, "body": " é🌍\n"})
        self.assertEqual(source["body"], " é🌍\nmore")
        for body in ("", "short", "a" * 1000):
            self.assertEqual(prepare_email({**source, "body": body}, 1000)["body"], body)

    def test_batch_keeps_model_between_calls_then_unloads_once(self) -> None:
        events = []
        def answer(*args):
            events.append("chat")
            return '{"predicted_labels":["Promotions"]}'
        with patch("noemi_mailsort.classify.ollama.verify_model"), \
                patch("noemi_mailsort.classify.ollama.chat", side_effect=answer), \
                patch("noemi_mailsort.classify.ollama.unload_model", side_effect=lambda *args: events.append("unload")):
            result = classify_batch([self.email, self.email], self.settings, self.catalog, "labels")
        self.assertEqual(events, ["chat", "chat", "unload"])
        self.assertEqual([r["eligible_labels"] for r in result], [["Promotions"], ["Promotions"]])
        self.assertNotIn("body", result[0])

    def test_failure_still_unloads_and_invalid_prediction_is_not_an_empty_result(self) -> None:
        with patch("noemi_mailsort.classify.ollama.verify_model"), \
                patch("noemi_mailsort.classify.ollama.chat", return_value="invalid JSON"), \
                patch("noemi_mailsort.classify.ollama.unload_model") as unload:
            with self.assertRaises(ValueError):
                classify_batch([self.email], self.settings, self.catalog, "labels")
            unload.assert_called_once()

    def test_run_sends_one_context_for_all_lengths_and_groups_without_changing_ceiling(self) -> None:
        scores = {label["name"]: 0.1 for label in self.catalog["labels"]}
        response = {"done": True, "done_reason": "stop", "model": "qwen3:8b", "prompt_eval_count": 2000,
                    "message": {"role": "assistant", "content": json.dumps({"scores": scores})}}
        # The model supports the selected allocation, even though the ceiling is larger.
        with patch("noemi_mailsort.ollama.request_json", side_effect=[
            {"model_info": {"qwen3.context_length": 16384}}, response, response, {"done": True},
        ]) as request:
            with classification_run(self.settings, self.catalog, "confidence") as classify:
                classify([{**self.email, "body": ""}])
                classify([{**self.email, "body": "🌍" * 2000}])
        calls = request.call_args_list
        self.assertEqual([call.args[1] for call in calls], ["/api/show", "/api/chat", "/api/chat", "/api/generate"])
        self.assertEqual([call.args[2]["options"]["num_ctx"] for call in calls[1:3]], [16384, 16384])
        self.assertEqual(json.loads(calls[2].args[2]["messages"][1]["content"])["body"], "🌍" * 1000)
        self.assertEqual(self.settings["options"]["num_ctx"], 40960)

    def test_context_ceiling_failure_does_not_contact_model(self) -> None:
        self.settings["options"]["num_ctx"] = 12288
        with patch("noemi_mailsort.ollama.request_json") as request:
            with self.assertRaisesRegex(ValueError, "ceiling"):
                classify_batch([self.email], self.settings, self.catalog, "confidence")
        request.assert_not_called()

    def test_response_headroom_uses_selected_context_and_failure_unloads(self) -> None:
        response = {"done": True, "done_reason": "stop", "model": "qwen3:8b", "prompt_eval_count": 16000,
                    "message": {"role": "assistant", "content": "{}"}}
        with patch("noemi_mailsort.ollama.request_json", side_effect=[
            {"model_info": {}}, response, {"done": True},
        ]) as request:
            with self.assertRaisesRegex(ValueError, "headroom"):
                classify_batch([self.email], self.settings, self.catalog, "confidence")
        self.assertEqual(request.call_args.args[1], "/api/generate")

    def test_confidence_pipeline_applies_existing_threshold_policy(self) -> None:
        scores = {label["name"]: 0.1 for label in self.catalog["labels"]}
        scores["Promotions"] = 0.50
        with patch("noemi_mailsort.classify.ollama.verify_model"), \
                patch("noemi_mailsort.classify.ollama.chat", return_value=json.dumps({"scores": scores})), \
                patch("noemi_mailsort.classify.ollama.unload_model"):
            result = classify_batch([self.email], self.settings, self.catalog, "confidence")
        self.assertEqual(result[0]["eligible_labels"], ["Promotions"])
        self.assertEqual(result[0]["prediction"], scores)

    def test_empty_and_invalid_inputs_do_not_invoke_model(self) -> None:
        with patch("noemi_mailsort.classify.ollama.verify_model") as verify, \
                patch("noemi_mailsort.classify.ollama.chat") as chat, \
                patch("noemi_mailsort.classify.ollama.unload_model") as unload:
            self.assertEqual(classify_batch([], self.settings, self.catalog, "labels"), [])
            for emails in ({}, [{**self.email, "extra": "not model input"}], [{**self.email, "subject": "a" * 50000}]):
                with self.subTest(emails_type=type(emails)):
                    with self.assertRaises(ValueError):
                        classify_batch(emails, self.settings, self.catalog, "labels")
            verify.assert_not_called()
            chat.assert_not_called()
            unload.assert_not_called()

    def test_unload_can_be_disabled_and_cleanup_failure_does_not_hide_primary_error(self) -> None:
        with patch("noemi_mailsort.classify.ollama.verify_model"), \
                patch("noemi_mailsort.classify.ollama.chat", return_value="bad prediction"), \
                patch("noemi_mailsort.classify.ollama.unload_model", side_effect=ValueError("cleanup failed")):
            with self.assertLogs("noemi_mailsort.classify", level="WARNING"):
                with self.assertRaisesRegex(ValueError, "valid JSON"):
                    classify_batch([self.email], self.settings, self.catalog, "labels")
        self.settings["unload_after_batch"] = False
        with patch("noemi_mailsort.classify.ollama.verify_model"), \
                patch("noemi_mailsort.classify.ollama.chat", return_value='{"predicted_labels":[]}'), \
                patch("noemi_mailsort.classify.ollama.unload_model") as unload:
            classify_batch([self.email], self.settings, self.catalog, "labels")
            unload.assert_not_called()


if __name__ == "__main__":
    unittest.main()
