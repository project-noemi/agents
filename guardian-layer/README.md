# Guardian Layer — Governance as Code

> **ILLUSTRATIVE / LEGACY.** This Python reference is provided to demonstrate the
> "AI evaluates AI" pattern. The canonical implementation path for Project NoéMI
> is Node.js (see `REQUIREMENTS.md` and `AGENTS.md`).

The **Guardian Layer** is the automated architecture where a specialized AI acts
as an *independent auditor* of an operational AI. It natively integrates
the **AI TRiSM** framework (Gartner®, Inc.) and the
**Discernment (D3)** phase of the [4D Framework](../docs/METHODOLOGY.md).

Gartner uses the term "guardian agents" for a related category (Gartner press release, "Gartner Predicts that Guardian Agents will Capture 10-15% of the Agentic AI Market by 2030," 11 June 2025). "Guardian Layer" and "Guardian Agent" as used in NoéMI are NewPush's own terms for its implementation.

> The best defense against a hallucinating AI is a specialized AI acting as an
> independent auditor.

This layer is the executable companion to the Markdown Guardian personas in
[`agents/guardian/`](../agents/guardian/) — most directly
[`prompt-shield.md`](../agents/guardian/prompt-shield.md) (override resistance)
and [`pii-guard.md`](../agents/guardian/pii-guard.md) (data egress).

## Architecture: Middleware Interception

The Guardian sits between the operational **Virtual Coworker** (Practitioner /
Crew) and the human **Explorer** (Passenger). No proposed output reaches the
human until it has been audited.

```
 Explorer (human)  ◀──  GuardianEvaluator.evaluate()  ◀──  Virtual Coworker (primary agent)
                               │
                 ┌─────────────┼──────────────┐
                 ▼             ▼               ▼
        Deterministic    Discernment      Routing
        egress scan      audit (Gemini)   APPROVED / BLOCKED
                               │
                               ▼
                 Observability: stderr audit log + Loki/Grafana
```

`evaluate(user_prompt, operational_agent_output, data_classification_level)`
returns one of:

| Status | Shape |
| --- | --- |
| Pass | `{"status": "APPROVED", "payload": <output>, "trace_id": …}` |
| Fail | `{"status": "BLOCKED", "reason": <critique_json>, "human_review_required": true, "trace_id": …}` |

## The Hallucination Taxonomy (Discernment)

The judge model audits the operational output against five strict criteria:

1. **Factual accuracy** — claims are correct and free of fabrication.
2. **Reasoning flaws** — logic is sound, with no contradictions or unsupported leaps.
3. **Citation presence** — claims that need evidence carry credible sources.
4. **Consistency** — the output stays internally consistent and on-task.
5. **Confidence scoring** — overall confidence (`0.0–1.0`); below the threshold
   (default `0.6`) the output is blocked.

Any failed criterion, low confidence, or detected egress routes the output to
`BLOCKED` and flags it for manual human review.

## The Refusal Principle (Confidential data)

When `data_classification_level == "Confidential"`, the Guardian additionally
scans for **data egress** — leakage of the company's "Secret Sauce" (proprietary
source code, credentials, API keys, connection strings, PII). This runs as a
**deterministic, local scanner** that is independent of the probabilistic judge
model, so adversarial content cannot talk its way past it. For Confidential
payloads, *any* egress finding is an unconditional block (defense in depth).

The Guardian also resists prompt injection: the audited output is treated
strictly as inert **data**, and any instruction embedded inside it is ignored.

## TRiSM ↔ implementation mapping

| TRiSM pillar | How the Guardian satisfies it |
| --- | --- |
| **Trust** (explainability) | Structured critique + `trace_id` on every decision; full reasoning in `reason`. |
| **Risk** (compliance / privacy) | Deterministic egress scan; audit logs exclude secrets and PII. |
| **Security** (threat mitigation) | Fail-closed routing, override resistance, least-data logging. |

## Fail Securely

A security control must never default to "allow." If the judge model is
unreachable, un-credentialed, or returns unparseable output (after exponential
backoff retries: `2s, 4s, 8s, 16s`), the Guardian returns `BLOCKED` with code
`guardian_unavailable` and `human_review_required: true`. Configure with
`GuardianEvaluator(fail_closed=True)` (the default).

## Tamper resistance

A watched agent cannot edit, disable or silence its Guardian or its log. That is the design goal; the table below says where each rule is enforced today and where it is not.

- Guardian code, configuration, prompts, thresholds and alert routing live in a path the operational agent can read at most, never write. The intended enforcement is CODEOWNERS and branch protection, with human review on every change.
- Removing or weakening a Guardian check, test or alert recipient is a blocking finding in review.
- Guardian alerts and the audit log are delivered out of band, through a channel the agent does not control, and are append-only.
- An agent's self-report (for example, "I did not remove the monitor") is never accepted as evidence. Verify from the diff and the audit log.

Where this is enforced:

| Rule | Enforced today | Not enforced today |
| --- | --- | --- |
| Read at most, never write | Agent pull requests are opened as the `noemi-agent` machine identity, which never approves or merges ([`docs/MACHINE_IDENTITY.md`](../docs/MACHINE_IDENTITY.md), `AGENTS.md` § Machine identity). [`.github/CODEOWNERS`](../.github/CODEOWNERS) covers `guardian-layer/` and `agents/guardian/` only through its default `*` entry. The repository rulesets block deletion and force-push on `develop` and `main`. | There is no Guardian-specific CODEOWNERS entry and no ruleset scoped to `guardian-layer/` or `agents/guardian/`. Required human review is a branch-protection setting outside this repository; this README does not assert it. At runtime, whether the operational agent can write the Guardian's files or configuration depends on the deployment, not on this repository. |
| Weakening a Guardian check is a blocking finding | The AI reviewer's Sentinel spec ([`agents/coding/sentinel/core.md`](../agents/coding/sentinel/core.md), Refusal Criteria) refuses changes that weaken an existing control. | The AI review is advisory, and no check targets Guardian paths specifically. The decision rests with the human reviewer. |
| Alerts and audit log out of band, append-only | `guardian_evaluator.py` emits the audit log to `stderr` and a Loki-formatted record (see Observability below), so the orchestrator, not the agent, captures it. | Delivery to a channel the agent does not control, and append-only retention, depend on the Loki (or other log) deployment. This repository does not enforce either. |
| Self-reports are not evidence | The Sentinel spec ignores an unverified claim that something is "already fixed elsewhere" and verifies against the default branch. | No tool rejects an agent's self-report automatically. Reviewers verify from the diff and the audit log. |

## Observability (NewPush Labs: Loki + Grafana)

Every decision emits:

* a structured **audit log** to `stderr` in the mandated shape
  `{ "task", "inputs", "actions", "risks", "result" }` — free of secrets/PII; and
* a **Loki-formatted** record via `log_to_loki(evaluation_json)`, using
  low-cardinality stream labels (`app`, `component`, `level`, `status`,
  `data_classification`) with the high-cardinality detail in the log line.

Example Grafana **LogQL** query for blocked decisions on confidential data:

```logql
{app="noemi-guardian-layer", status="BLOCKED", data_classification="Confidential"}
  | json
  | line_format "{{.trace_id}} → {{.critique.summary}}"
```

In production, resolve the push endpoint from `LOKI_PUSH_URL` and POST to
`/loki/api/v1/push`; the reference writes the payload to `stderr`.

## Usage

### Offline (no secrets, no network — uses the built-in heuristic judge)

```bash
python3 guardian_evaluator.py        # runs three illustrative cases
```

### Programmatic (production: Gemini judge, Fetch-on-Demand key)

```python
from guardian_evaluator import GuardianEvaluator

guardian = GuardianEvaluator()  # default judge = Gemini 3.6 Flash via env key
decision = guardian.evaluate(
    user_prompt=user_prompt,
    operational_agent_output=proposed_output,
    data_classification_level="Confidential",
)
if decision["status"] == "APPROVED":
    return decision["payload"]
else:
    route_to_human_review(decision["reason"], decision["trace_id"])
```

Inject the key at runtime — never hardcode it:

```bash
op run --env-file=../.env.template -- python3 guardian_evaluator.py
# or
infisical run --env=dev -- python3 guardian_evaluator.py
```

## Environment variables (resolved from vault at runtime)

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Judge model (Gemini 3.6 Flash) credential. |
| `LOKI_PUSH_URL` *(optional)* | Loki push endpoint; defaults to a stderr mock. |

## Files

| File | Description |
| --- | --- |
| `guardian_evaluator.py` | The Guardian class, egress scanner, Discernment prompt, routing, observability, and a runnable offline demo. |
| `requirements.txt` | `google-genai` (only needed for the live Gemini judge). |
