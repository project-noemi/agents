# LM Studio PII Gateway

A local PII filter for outbound LLM calls. It finds personal data with fixed patterns plus a small model served by [LM Studio](https://lmstudio.ai), and redacts it before anything leaves your machine.

Full guide, hardware figures and results: [`docs/examples/lm-studio-pii-layer.md`](../../docs/examples/lm-studio-pii-layer.md).

## Files

| File | Purpose |
| --- | --- |
| `pii-gateway.mts` | The gateway. Exports `scan(payload, context)`. |
| `run-eval.mts` | Scores the gateway against the test set: recall, over-redaction, seconds per document. |
| `test-set.json` | 10 synthetic documents (emails, bills, messages), 5 planted PII items each. All values are fictional. |

## Run

Requires Node 24 (no dependencies, no build step) and LM Studio with its server running and a model loaded.

```bash
lms server start
lms load google/gemma-4-e4b
PII_MODEL=google/gemma-4-e4b node run-eval.mts
```

Settings come from the environment: `LMSTUDIO_URL` (default `http://localhost:1234/v1`), `PII_MODEL`, and `PII_TIMEOUT_MS` (default `15000`).

## Rules

* Never add real personal data to `test-set.json`.
* If LM Studio is unreachable or answers badly, `public_api` payloads are blocked.
* Audit output carries finding types and counts only, never the values.
