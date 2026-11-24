"""Essential checks for configurable labels and prompt validation."""

import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from noemi_mailsort.prompts import build_prompt


ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "config/labels.example.json"


class PromptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "labels.json"

    def render(self, mode: str = "labels") -> str:
        self.path.write_text(json.dumps(self.catalog), encoding="utf-8")
        return build_prompt(self.path, mode)

    def test_disabling_each_label_omits_its_definition_and_dependent_rules(self) -> None:
        for index in range(len(self.catalog["labels"])):
            for mode in ("labels", "confidence"):
                with self.subTest(label=index, mode=mode):
                    self.catalog["labels"][index]["enabled"] = False
                    label = self.catalog["labels"][index]
                    prompt = self.render(mode)
                    self.assertNotIn(f"**{label['name']}** —", prompt)
                    self.assertNotIn(label["description"], prompt)
                    for group in self.catalog["guidance"]:
                        for rule in group["rules"]:
                            if label["id"] in rule["requires"]:
                                self.assertNotIn(rule["text"], prompt)
                    self.catalog["labels"][index]["enabled"] = True

    def test_custom_label_works_without_extra_guidance_or_template_edits(self) -> None:
        self.catalog = {"max_labels_per_email": 1, "labels": [{
            "id": "research", "name": "Research", "description": "Research project correspondence.",
            "enabled": True, "threshold": 0.75,
        }]}
        for mode in ("labels", "confidence"):
            prompt = self.render(mode)
            self.assertIn("**Research** — Research project correspondence.", prompt)
            self.assertNotIn("Promotions", prompt)
            self.assertNotIn("threshold", prompt)
            self.assertNotIn("0.75", prompt)

    def test_invalid_label_settings_and_guidance_are_rejected(self) -> None:
        original = deepcopy(self.catalog)
        for field, value in (
            ("id", ""), ("name", ""), ("description", ""),
            ("enabled", "false"), ("threshold", True), ("threshold", -0.1),
            ("threshold", 1.1), ("threshold", float("nan")),
        ):
            with self.subTest(field=field, value=value):
                self.catalog = deepcopy(original)
                self.catalog["labels"][0][field] = value
                with self.assertRaises(ValueError):
                    self.render()
        self.catalog = deepcopy(original)
        self.catalog["guidance"][0]["rules"][0]["requires"] = ["unknown"]
        with self.assertRaisesRegex(ValueError, "existing label IDs"):
            self.render()

    def test_duplicate_ids_and_names_are_rejected(self) -> None:
        for field in ("id", "name"):
            with self.subTest(field=field):
                original = self.catalog["labels"][1][field]
                self.catalog["labels"][1][field] = self.catalog["labels"][0][field]
                with self.assertRaisesRegex(ValueError, "unique"):
                    self.render()
                self.catalog["labels"][1][field] = original

    def test_disabled_labels_may_have_empty_descriptions_but_enabled_labels_may_not(self) -> None:
        self.catalog["labels"][0]["description"] = ""
        self.catalog["labels"][0]["enabled"] = False
        self.assertNotIn("**Promotions**", self.render())
        self.catalog["labels"][0]["enabled"] = True
        with self.assertRaisesRegex(ValueError, "description"):
            self.render()
        self.catalog["labels"][0]["enabled"] = False
        self.catalog["labels"][0]["description"] = None
        with self.assertRaisesRegex(ValueError, "description"):
            self.render()

    def test_maximum_labels_requires_a_positive_integer(self) -> None:
        for maximum in (None, 0, -1, True, False, 1.5, "5"):
            with self.subTest(maximum=maximum):
                self.catalog["max_labels_per_email"] = maximum
                with self.assertRaisesRegex(ValueError, "positive integer"):
                    self.render()
        self.catalog.pop("max_labels_per_email")
        with self.assertRaisesRegex(ValueError, "positive integer"):
            self.render()

    def test_no_enabled_labels_and_unknown_modes_are_rejected(self) -> None:
        for label in self.catalog["labels"]:
            label["enabled"] = False
        with self.assertRaisesRegex(ValueError, "Enable at least one"):
            self.render()
        with self.assertRaisesRegex(ValueError, "labels or confidence"):
            self.render("unknown")


if __name__ == "__main__":
    unittest.main()
