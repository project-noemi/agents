"""Vault-mode credential handling with fictional OAuth JSON values."""

import json
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from noemi_mailsort import gmail_mcp, vault_credentials

CLIENT = json.dumps({"installed": {"client_id": "fictional", "client_secret": "fictional"}})
TOKEN = json.dumps({"refresh_token": "fictional-refresh", "scope": "https://www.googleapis.com/auth/gmail.modify"})
FILE_SETTINGS = {"oauth_path": "/run/gmail/gcp-oauth.keys.json",
                 "credentials_path": "/run/gmail/credentials.json", "timeout_seconds": 90}


class VaultCredentialTests(unittest.TestCase):
    def setUp(self) -> None:
        vault_credentials._materialized = None
        self.addCleanup(setattr, vault_credentials, "_materialized", None)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.parent = Path(directory.name)

    def apply(self, environ: dict[str, str]) -> dict:
        return vault_credentials.apply(dict(FILE_SETTINGS), environ=environ, parent=self.parent)

    def test_without_vault_values_the_mounted_files_stay_in_use(self) -> None:
        self.assertEqual(self.apply({}), FILE_SETTINGS)
        self.assertEqual(list(self.parent.iterdir()), [])

    def test_vault_values_become_owner_only_files_and_leave_the_environment(self) -> None:
        environ = {vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: TOKEN, "OTHER": "kept"}
        settings = self.apply(environ)
        self.assertEqual(environ, {"OTHER": "kept"})
        self.assertEqual(settings["timeout_seconds"], 90)
        oauth, credentials = Path(settings["oauth_path"]), Path(settings["credentials_path"])
        self.assertEqual(oauth.parent, credentials.parent)
        self.assertEqual(oauth.parent.parent, self.parent)
        self.assertEqual(stat.S_IMODE(oauth.parent.stat().st_mode), 0o700)
        for path, expected in ((oauth, CLIENT), (credentials, TOKEN)):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(path.read_text(encoding="utf-8"), expected)
        gmail_mcp.check_credentials(settings, require_message_labeling=True)

    def test_vault_values_win_over_mounted_paths_and_are_reused_in_the_process(self) -> None:
        first = self.apply({vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: TOKEN})
        self.assertNotEqual(first["oauth_path"], FILE_SETTINGS["oauth_path"])
        # Later sessions in the same worker see no variables but keep the vault files.
        self.assertEqual(self.apply({}), first)
        self.assertEqual(len(list(self.parent.iterdir())), 1)

    def test_partial_vault_configuration_is_refused(self) -> None:
        for environ in ({vault_credentials.OAUTH_ENV: CLIENT},
                        {vault_credentials.CREDENTIALS_ENV: TOKEN},
                        {vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: ""}):
            with self.subTest(names=sorted(environ)), self.assertRaises(vault_credentials.VaultCredentialError):
                self.apply(dict(environ))
        self.assertEqual(list(self.parent.iterdir()), [])

    def test_selected_vault_overlay_without_values_fails_clearly(self) -> None:
        with self.assertRaises(vault_credentials.VaultCredentialError) as caught:
            self.apply({vault_credentials.SOURCE_ENV: "vault"})
        self.assertIn("infisical run", str(caught.exception))

    def test_invalid_values_are_refused_without_echoing_them(self) -> None:
        secret = "fictional-secret-that-must-not-appear"
        for value in (secret, json.dumps([secret]), json.dumps({"padding": "x" * vault_credentials.MAX_BYTES})):
            with self.subTest(length=len(value)):
                environ = {vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: value}
                with self.assertRaises(vault_credentials.VaultCredentialError) as caught:
                    self.apply(environ)
                self.assertNotIn(secret, str(caught.exception))
                self.assertEqual(environ, {})
        self.assertEqual(list(self.parent.iterdir()), [])

    def test_unwritable_tmpfs_is_a_safe_error(self) -> None:
        environ = {vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: TOKEN}
        with self.assertRaises(vault_credentials.VaultCredentialError):
            vault_credentials.apply(dict(FILE_SETTINGS), environ=environ, parent=self.parent / "missing")

    def test_gmail_configuration_loader_applies_vault_mode(self) -> None:
        example = Path(__file__).resolve().parents[1] / "config/gmail.example.json"
        environ = {vault_credentials.OAUTH_ENV: CLIENT, vault_credentials.CREDENTIALS_ENV: TOKEN}
        with patch.dict(vault_credentials.os.environ, environ, clear=True), \
                patch.object(vault_credentials, "TMPFS", self.parent):
            settings = gmail_mcp.load_gmail_config(example)
            remaining = dict(vault_credentials.os.environ)
        self.assertTrue(Path(settings["oauth_path"]).is_relative_to(self.parent))
        self.assertEqual(remaining, {})

    def test_gmail_configuration_loader_reports_vault_errors_safely(self) -> None:
        example = Path(__file__).resolve().parents[1] / "config/gmail.example.json"
        with patch.dict(vault_credentials.os.environ, {vault_credentials.OAUTH_ENV: CLIENT}, clear=True):
            with self.assertRaises(gmail_mcp.GmailMCPError) as caught:
                gmail_mcp.load_gmail_config(example)
        self.assertIn(vault_credentials.CREDENTIALS_ENV, gmail_mcp.safe_diagnostic(caught.exception))


if __name__ == "__main__":
    unittest.main()
