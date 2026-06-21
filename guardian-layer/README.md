# Guardian Layer — Governance as Code

> **ILLUSTRATIVE / LEGACY.** This Python reference is provided to demonstrate the
> "AI evaluates AI" pattern. The canonical implementation path for Project NoéMI
> is Node.js (see `REQUIREMENTS.md` and `AGENTS.md`).

The **Guardian Layer** is the automated architecture where a specialized AI acts
as an *independent auditor* of an operational AI. It natively integrates
Gartner's **AI TRiSM** (Trust, Risk, and Security Management) framework and the
**Discernment (D3)** phase of the [4D Framework](../docs/METHODOLOGY.md).

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

guardian = GuardianEvaluator()  # default judge = Gemini 2.5 Flash via env key
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
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Judge model (Gemini 2.5 Flash) credential. |
| `LOKI_PUSH_URL` *(optional)* | Loki push endpoint; defaults to a stderr mock. |

## Files

| File | Description |
| --- | --- |
| `guardian_evaluator.py` | The Guardian class, egress scanner, Discernment prompt, routing, observability, and a runnable offline demo. |
| `requirements.txt` | `google-genai` (only needed for the live Gemini judge). |
