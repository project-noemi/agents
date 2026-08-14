# LEGACY/ILLUSTRATIVE — This Python example is provided for teaching and historical reference only.
# The canonical implementation path for Project NoéMI is Node.js.
# See REQUIREMENTS.md Section 8 and AGENTS.md for details.
"""Phase 0 Security — Fetch-on-Demand Execution Boilerplate (NewPush Labs).

WHAT THIS IS
------------
A reference "Virtual Workforce" entrypoint. It initializes an LLM client and
runs a trivial agentic task, but its real job is to *demonstrate the security
perimeter that must exist before any AI deployment* — what Project NoéMI calls
**Phase 0 Security**. We explicitly reject the "Replacement Trap": this code is
scaffolding for a governed agent, not a human replacement.

HOW TO RUN IT SAFELY (the only supported launch path)
-----------------------------------------------------
Secrets are NEVER read from disk. They are injected into *process memory* at
launch time by the Infisical CLI, which authenticates with a scoped **Machine
Identity** (an `INFISICAL_TOKEN`, never a human session, in headless runtimes):

    infisical run --env=dev -- python agent_logic.py

The 1Password-based equivalent (vault-reference manifest, not a plaintext file):

    op run --env-file=.env.template -- python agent_logic.py

THE "FETCH-ON-DEMAND" CONTRACT
------------------------------
  1. Storage   — secrets live ONLY in the SecretOps vault (Infisical / 1Password).
  2. Access    — the vault CLI injects them into env vars at launch.
  3. Governance— they are never written to disk, committed to Git, or pasted into chat.

WHY THIS STOPS "SHADOW AI" AND PROTECTS THE "SECRET SAUCE"
----------------------------------------------------------
"Shadow AI" is what happens when a developer, under deadline pressure, pastes a
production key into a `.env` file, a notebook, or a chat window just to make the
model work. That key — and the proprietary data it unlocks (the org's "Secret
Sauce": customer records, ERP data, pricing models, IP) — then leaks into git
history, prompt logs, and third-party LLM training sets, forever.

This script makes that shortcut *impossible by construction*:
  • It refuses to parse `.env` files or import `python-dotenv`.
  • It has no default keys and no local fallback.
  • If the vault wrapper was bypassed, it does not "try its best" — it dies loudly
    (see `Phase0SecurityError` below). A failed run is the secure run; a silent
    run on a hardcoded key is the breach.

LOGGING NOTE (intentional, governed deviation from a naive spec)
----------------------------------------------------------------
Per AGENTS.md / CLAUDE.md ("Standardized Logging"), all diagnostics and the
structured audit log are written to **stderr**, not stdout, so the external
orchestrator can capture execution failures cleanly and stdout stays reserved
for real program output. Secret *values* are never logged anywhere.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

# --- Required secrets ---------------------------------------------------------
# These are the NAMES we expect Infisical to have injected. We never store their
# values anywhere except the short-lived local variables in load_secrets().
# OPENAI_API_KEY  -> unlocks the reasoning engine (the LLM).
# ERP_DATABASE_URL-> unlocks the "Secret Sauce" (proprietary business data).
REQUIRED_SECRETS = ("OPENAI_API_KEY", "ERP_DATABASE_URL")

# Non-secret runtime config (safe to default; carries no proprietary value).
# NOTE: Project NoéMI's canonical model baseline is Gemini 3.6 Flash
# (models/gemini-3.6-flash). We use an OpenAI client here only because
# OPENAI_API_KEY is the secret named in this Phase 0 exercise — the
# Fetch-on-Demand pattern is identical regardless of which provider you swap in.
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

# Diagnostics go to stderr so the orchestrator can separate logs from output.
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s | %(levelname)-8s | phase0 | %(message)s",
)
log = logging.getLogger("phase0.secret-ops")


class Phase0SecurityError(RuntimeError):
    """Fatal: the Phase 0 perimeter was breached or bypassed.

    Raised when the Fetch-on-Demand contract is not satisfied (e.g. a required
    secret is absent because the Infisical/1Password wrapper was skipped). It is
    deliberately *not* recoverable: there is no safe local fallback for a missing
    production secret, so the only correct response is to terminate.
    """


def _emit_audit_log(task, inputs, actions, risks, result):
    """Emit the lightweight, secret-free JSON audit record to stderr.

    Shape mandated by AGENTS.md: { task, inputs, actions, risks, result }.
    `inputs` lists secret NAMES only — never values — so the audit trail can be
    captured by the orchestrator without itself becoming a leak vector.
    """
    record = {
        "task": task,
        "inputs": inputs,
        "actions": actions,
        "risks": risks,
        "result": result,
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": "ILLUSTRATIVE",  # canonical path is Node.js; see AGENTS.md
    }
    # A distinct prefix lets the orchestrator grep audit events out of stderr.
    print("AUDIT " + json.dumps(record, sort_keys=True), file=sys.stderr)


def _redact_connection_url(url):
    """Return a logging-safe shadow of a connection URL.

    Shows the scheme so an operator can see *what kind* of system was reached,
    while masking everything that could expose the Secret Sauce (credentials,
    host, database name). We never log the raw value.
    """
    scheme = url.split("://", 1)[0] if "://" in url else "opaque"
    return f"{scheme}://***:***@***/***"


def load_secrets():
    """Fetch secrets from process memory only — the Fetch-on-Demand core.

    Reads exclusively from os.environ (populated by the vault CLI at launch).
    There is intentionally NO .env parsing, NO python-dotenv, and NO default
    value: if Infisical/1Password was bypassed, the secret is simply absent and
    we fail deadly rather than degrade into an insecure state.
    """
    # os.environ.get() returns None for anything the vault did not inject.
    resolved = {name: os.environ.get(name) for name in REQUIRED_SECRETS}
    missing = [name for name, value in resolved.items() if not value]

    if missing:
        # FAIL DEADLY. Log a loud, unmistakable Phase 0 warning (to stderr, per
        # the Standardized Logging rule) and raise. We do NOT continue, retry on
        # a default, or read any local file.
        log.critical("=" * 72)
        log.critical("PHASE 0 SECURITY BREACH — required secrets are NOT in process memory.")
        log.critical("Missing: %s", ", ".join(missing))
        log.critical("This almost always means the Infisical wrapper was bypassed.")
        log.critical("Re-run via:  infisical run --env=dev -- python agent_logic.py")
        log.critical("Refusing to run on hardcoded or default credentials. Aborting.")
        log.critical("=" * 72)
        raise Phase0SecurityError(
            "Missing required secret(s): " + ", ".join(missing)
        )

    # Confirm WITHOUT echoing any value — presence only.
    log.info("Phase 0 OK: %d secret(s) resolved from process memory.", len(resolved))
    log.info("ERP target (redacted): %s", _redact_connection_url(resolved["ERP_DATABASE_URL"]))
    return resolved


def _with_backoff(fn, *, attempts=3, base_delay=1.0):
    """Minimal exponential-backoff retry for transient/rate-limited calls.

    Canonical reference implementation is scripts/resilience_helpers.js (Node.js);
    this is the illustrative Python mirror. Only transient failures are retried —
    a missing secret is never "transient" and is handled by load_secrets().
    """
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - illustrative breadth
            if attempt == attempts:
                raise
            delay = base_delay * (2 ** (attempt - 1))
            log.warning("Transient failure (attempt %d/%d): %s — retrying in %.1fs",
                        attempt, attempts, exc, delay)
            time.sleep(delay)


def run_agentic_task(api_key):
    """Initialize the LLM client and run one trivial agentic self-test.

    Graceful Degradation (AGENTS.md): the SDK or the network may be unavailable
    in a lab/CI sandbox. That is NOT a security failure, so we explain it and
    continue. The only fatal condition in this script is a missing secret.
    """
    try:
        from openai import OpenAI  # imported lazily so the security path runs SDK-free
    except ImportError:
        log.warning("openai SDK not installed; skipping live LLM call "
                    "(install with `pip install openai`). Security perimeter unaffected.")
        return "sdk-unavailable"

    # The key lives only in this local; it is passed to the client and never logged.
    client = OpenAI(api_key=api_key)

    def _call():
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a NoéMI virtual-workforce agent. Reply in one short sentence."},
                {"role": "user", "content": "Confirm the secure execution perimeter is active."},
            ],
            temperature=0.2,  # low temperature -> predictable, auditable output
        )
        return completion.choices[0].message.content

    try:
        reply = _with_backoff(_call)
        log.info("Agent self-test reply: %s", reply)
        return "ok"
    except Exception as exc:  # noqa: BLE001 - illustrative breadth
        # Degrade gracefully: report clearly, do not crash the perimeter demo.
        log.error("LLM call failed after retries: %s", exc)
        return "llm-error"


def main():
    """Orchestrate the secure run and enforce Fail-Deadly semantics."""
    log.info("Initializing Project NoéMI Phase 0 agent (Fetch-on-Demand)...")
    try:
        secrets = load_secrets()
    except Phase0SecurityError as exc:
        # Terminal path: record the breach (secret-free) and exit non-zero so the
        # orchestrator treats the run as a hard failure.
        _emit_audit_log(
            task="phase0-secure-execution",
            inputs=list(REQUIRED_SECRETS),
            actions=["validate-process-memory-secrets"],
            risks=["secrets-absent", "possible-vault-wrapper-bypass"],
            result=f"FATAL: {exc}",
        )
        sys.exit(1)

    # Perimeter is intact — proceed with the (illustrative) agentic work.
    task_result = run_agentic_task(secrets["OPENAI_API_KEY"])

    _emit_audit_log(
        task="phase0-secure-execution",
        inputs=list(REQUIRED_SECRETS),
        actions=["validate-process-memory-secrets", "init-llm-client", "run-agentic-self-test"],
        risks=[],
        result=f"OK: perimeter intact, agentic task -> {task_result}",
    )
    log.info("Done. Secrets remained in process memory only; nothing written to disk.")


if __name__ == "__main__":
    main()
