"""Essential prediction checks using synthetic responses and configuration names."""

import json
import unittest
from pathlib import Path

from noemi_mailsort.predictions import parse_prediction, select_labels
from noemi_mailsort.prompts import load_catalog


ENABLED = {"Promotions", "Newsletters"}


class PredictionTests(unittest.TestCase):
    def test_labels_preserve_order_and_allow_no_match_and_custom_names(self) -> None:
        for names in (["Newsletters", "Promotions"], ["Promotions"], []):
            with self.subTest(names=names):
                response = json.dumps({"predicted_labels": names})
                self.assertEqual(parse_prediction(response, "labels", ENABLED), names)
        self.assertEqual(
            parse_prediction('{"predicted_labels":["Custom Category"]}', "labels", {"Custom Category"}),
            ["Custom Category"],
        )

    def test_labels_reject_wrong_types_unknown_disabled_and_duplicate_names(self) -> None:
        for names in (
            "Promotions", None, {}, [42], [True], [None], [[]],
            ["Unknown"], ["Accounts & Security"], ["promotions"],
            [" Promotions"], ["Promotions", "Promotions"],
        ):
            with self.subTest(names=names):
                with self.assertRaises(ValueError):
                    parse_prediction(json.dumps({"predicted_labels": names}), "labels", ENABLED)

    def test_scores_accept_boundaries_and_independent_scores_without_filtering(self) -> None:
        for scores in (
            {"Promotions": 0, "Newsletters": 1},
            {"Promotions": 0.49, "Newsletters": 0.50},
            {"Promotions": 0.9, "Newsletters": 0.9},
            {"Promotions": 0, "Newsletters": 0},
        ):
            with self.subTest(scores=scores):
                self.assertEqual(
                    parse_prediction(json.dumps({"scores": scores}), "confidence", ENABLED),
                    scores,
                )

    def test_scores_require_exactly_the_enabled_names(self) -> None:
        for scores in (
            [], None, {}, {"Promotions": 0.8},
            {"Promotions": 0.8, "Newsletters": 0.7, "Unknown": 0.9},
            {"Promotions": 0.8, "Newsletters": 0.7, "Accounts & Security": 0.9},
        ):
            with self.subTest(scores=scores):
                with self.assertRaises(ValueError):
                    parse_prediction(json.dumps({"scores": scores}), "confidence", ENABLED)

    def test_scores_reject_invalid_numbers_and_types(self) -> None:
        for score in (-0.1, 1.1, True, False, "0.8", None, [], {}, float("nan"), float("inf")):
            with self.subTest(score=score):
                response = json.dumps({"scores": {"Promotions": score, "Newsletters": 0.2}})
                with self.assertRaises(ValueError):
                    parse_prediction(response, "confidence", ENABLED)
        with self.assertRaises(ValueError):
            parse_prediction('{"scores":{"Promotions":1e999,"Newsletters":0.2}}', "confidence", ENABLED)

    def test_wrong_top_level_objects_and_extra_fields_are_rejected(self) -> None:
        for mode, field, value in (
            ("labels", "predicted_labels", []),
            ("confidence", "scores", {"Promotions": 0.5, "Newsletters": 0.5}),
        ):
            for payload in (None, [], "text", True, 1, {}, {"wrong": value}, {field: value, "action": "apply"}):
                with self.subTest(mode=mode, payload=payload):
                    with self.assertRaises(ValueError):
                        parse_prediction(json.dumps(payload), mode, ENABLED)

    def test_malformed_json_extra_text_and_duplicate_keys_are_rejected(self) -> None:
        for response in (
            "", "{", '{"predicted_labels":[],}',
            '```json\n{"predicted_labels":[]}\n```',
            'Here are the labels: {"predicted_labels":[]}',
            '{"predicted_labels":[]} trailing text',
            '{"predicted_labels":[]} {"predicted_labels":[]}',
            '{"predicted_labels":[],"predicted_labels":["Promotions"]}',
        ):
            with self.subTest(response=response):
                with self.assertRaises(ValueError):
                    parse_prediction(response, "labels", ENABLED)
        with self.assertRaisesRegex(ValueError, "Duplicate JSON keys"):
            parse_prediction(
                '{"scores":{"Promotions":0.1,"Promotions":0.9,"Newsletters":0.2}}',
                "confidence", ENABLED,
            )

    def test_invalid_mode_response_type_and_empty_enabled_names_are_rejected(self) -> None:
        for response, mode, names in (
            ('{"predicted_labels":[]}', "unknown", ENABLED),
            ({"predicted_labels": []}, "labels", ENABLED),
            ('{"predicted_labels":[]}', "labels", set()),
            ('{"predicted_labels":[]}', "labels", "Promotions"),
        ):
            with self.subTest(mode=mode, names=names):
                with self.assertRaises(ValueError):
                    parse_prediction(response, mode, names)


class AcceptanceTests(unittest.TestCase):
    def setUp(self) -> None:
        example = Path(__file__).resolve().parents[1] / "config/labels.example.json"
        self.catalog = load_catalog(example)

    def confidence_response(self, overrides: dict[str, float]) -> str:
        scores = {label["name"]: 0.0 for label in self.catalog["labels"] if label["enabled"]}
        scores.update(overrides)
        return json.dumps({"scores": scores})

    def test_confidence_uses_inclusive_individual_thresholds(self) -> None:
        response = self.confidence_response({
            "Promotions": 0.49, "Newsletters": 0.50, "Receipts & Delivery": 0.51,
        })
        self.assertEqual(
            select_labels(response, "confidence", self.catalog),
            ["Newsletters", "Receipts & Delivery"],
        )
        self.catalog["labels"][0]["threshold"] = 0.8
        self.catalog["labels"][1]["threshold"] = 0.3
        response = self.confidence_response({"Promotions": 0.79, "Newsletters": 0.3})
        self.assertEqual(select_labels(response, "confidence", self.catalog), ["Newsletters"])
        self.catalog["labels"][0]["threshold"] = 0.0
        self.catalog["labels"][1]["threshold"] = 1.0
        response = self.confidence_response({"Promotions": 0.0, "Newsletters": 1.0})
        self.assertEqual(select_labels(response, "confidence", self.catalog), ["Promotions", "Newsletters"])

    def test_labels_mode_ignores_thresholds_and_preserves_prediction_order(self) -> None:
        for label in self.catalog["labels"]:
            label["threshold"] = 1.0
        response = '{"predicted_labels":["Newsletters","Promotions"]}'
        self.assertEqual(select_labels(response, "labels", self.catalog), ["Newsletters", "Promotions"])

    def test_maximum_is_checked_after_filtering_and_allows_exact_limit(self) -> None:
        self.catalog["max_labels_per_email"] = 1
        response = self.confidence_response({"Promotions": 0.8, "Newsletters": 0.49})
        self.assertEqual(select_labels(response, "confidence", self.catalog), ["Promotions"])
        self.assertEqual(
            select_labels('{"predicted_labels":["Promotions"]}', "labels", self.catalog),
            ["Promotions"],
        )

    def test_over_limit_results_are_rejected_in_both_modes(self) -> None:
        self.catalog["max_labels_per_email"] = 1
        for mode, response in (
            ("labels", '{"predicted_labels":["Promotions","Newsletters"]}'),
            ("confidence", self.confidence_response({"Promotions": 0.9, "Newsletters": 0.8})),
        ):
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(ValueError, "exceeds max_labels_per_email"):
                    select_labels(response, mode, self.catalog)

    def test_no_qualifying_labels_is_valid_in_both_modes(self) -> None:
        self.assertEqual(select_labels('{"predicted_labels":[]}', "labels", self.catalog), [])
        self.assertEqual(select_labels(self.confidence_response({}), "confidence", self.catalog), [])

    def test_invalid_predictions_are_rejected_before_acceptance(self) -> None:
        self.catalog["labels"][0]["enabled"] = False
        for mode, response in (
            ("labels", '{"predicted_labels":["Promotions"]}'),
            ("confidence", self.confidence_response({"Promotions": 0.1})),
            ("confidence", self.confidence_response({"Newsletters": -0.1})),
        ):
            with self.subTest(mode=mode):
                with self.assertRaises(ValueError):
                    select_labels(response, mode, self.catalog)


if __name__ == "__main__":
    unittest.main()
