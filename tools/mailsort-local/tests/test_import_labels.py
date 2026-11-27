"""Small importer checks with fictional Gmail labels and temporary local files."""

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from noemi_mailsort import gmail_mcp, import_labels
from noemi_mailsort.prompts import load_catalog, render_prompt


LABELS = [
    {"id": "INBOX", "name": "INBOX", "type": "system"},
    {"id": "Label_fictional", "name": "Kutatás / Research", "type": "user"},
    {"id": "Label_fictional_2", "name": "Example Projects", "type": "user"},
]


class ImportTests(unittest.TestCase):
    def test_import_initializes_only_user_labels_with_disabled_empty_defaults(self) -> None:
        catalog = import_labels.imported_catalog(LABELS)
        self.assertEqual(catalog, {"max_labels_per_email": 2, "labels": [
            {"id": "Label_fictional", "name": "Kutatás / Research", "description": "", "enabled": False, "threshold": 0.5},
            {"id": "Label_fictional_2", "name": "Example Projects", "description": "", "enabled": False, "threshold": 0.5},
        ]})
        with self.assertRaisesRegex(ValueError, "Enable at least one"):
            render_prompt(catalog, "labels")
        catalog["labels"][0].update(description="Research correspondence.", enabled=True)
        for mode in ("labels", "confidence"):
            prompt = render_prompt(catalog, mode)
            self.assertIn("Kutatás / Research", prompt)
            self.assertNotIn("Example Projects", prompt)
            self.assertNotIn("Label_fictional", prompt)

    def test_local_import_creates_a_private_catalog_using_only_label_discovery(self) -> None:
        with TemporaryDirectory() as directory:
            output = Path(directory) / "labels.json"
            with patch.object(gmail_mcp, "connection_check", AsyncMock(return_value={"labels": LABELS})) as check:
                result = import_labels.import_user_labels({}, output)
            self.assertEqual(result["imported_count"], 2)
            self.assertTrue(result["file_created"])
            self.assertEqual(load_catalog(output), import_labels.imported_catalog(LABELS))
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            check.assert_awaited_once_with({})

    def test_existing_file_and_shared_template_are_preserved_without_connecting(self) -> None:
        with TemporaryDirectory() as directory:
            existing = Path(directory) / "labels.json"
            existing.write_text("user-authored settings")
            for path in (existing, Path(directory) / "labels.example.json"):
                with self.subTest(path=path), patch.object(gmail_mcp, "connection_check", AsyncMock()) as check:
                    with self.assertRaises(ValueError):
                        import_labels.import_user_labels({}, path)
                    check.assert_not_awaited()
            self.assertEqual(existing.read_text(), "user-authored settings")

    def test_exclusive_writer_cannot_overwrite_a_file_created_after_preflight(self) -> None:
        with TemporaryDirectory() as directory:
            output = Path(directory) / "labels.json"
            output.write_text("preserve this")
            with self.assertRaises(FileExistsError):
                import_labels.write_catalog(output, import_labels.imported_catalog(LABELS))
            self.assertEqual(output.read_text(), "preserve this")

    def test_no_user_labels_creates_no_empty_catalog(self) -> None:
        with TemporaryDirectory() as directory:
            output = Path(directory) / "labels.json"
            with patch.object(gmail_mcp, "connection_check", AsyncMock(return_value={"labels": LABELS[:1]})):
                self.assertEqual(import_labels.import_user_labels({}, output), {"imported_count": 0, "file_created": False})
            self.assertFalse(output.exists())

    def test_failed_discovery_or_invalid_labels_create_no_output(self) -> None:
        with TemporaryDirectory() as directory:
            output = Path(directory) / "labels.json"
            with patch.object(gmail_mcp, "connection_check", AsyncMock(side_effect=gmail_mcp.GmailMCPError("Failed discovery"))):
                with self.assertRaises(gmail_mcp.GmailMCPError):
                    import_labels.import_user_labels({}, output)
            for labels in ([LABELS[1], LABELS[1]], [{**LABELS[1], "name": ""}]):
                with patch.object(gmail_mcp, "connection_check", AsyncMock(return_value={"labels": labels})):
                    with self.assertRaises(ValueError):
                        import_labels.import_user_labels({}, output)
            self.assertFalse(output.exists())
