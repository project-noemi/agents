# Provider streaming (Sprint 4, Part B)

All provider calls are server-side. The Studio browser receives only the
existing SSE event contract: `start`, zero or more `token` deltas, and
`done`; a provider failure is an `error`. The `done` event carries the
answering provider/runtime, model, usage counts, latency, and fallback history.

## Gateway configuration placeholders

This package follows `AGENTS.md`: secrets are injected on demand, not loaded
from a local `.env` file. Configure your NewPush gateway credential in
Infisical or 1Password and inject it at runtime.

For local setup, the non-secret model configuration can use these values:

```sh
AI_GW_API_KEY=REPLACE_WITH_NEWPUSH_GATEWAY_KEY
GEMINI_MODEL=gemini-3.8-flash
XAI_MODEL=xai/grok-4.6
NOEMI_PREFERRED_PROVIDER=gemini
NOEMI_FALLBACK_PROVIDERS=xai,mock
NOEMI_RUNTIME=direct
```

`AI_GW_API_KEY` is a placeholder only; do not commit a real credential or
store it in a tracked file. Use the team's approved `infisical run` / `op run`
workflow to provide the actual value. Both live providers use the gateway
credential and never receive a browser-supplied key.

## Fallback and errors

The provider chain is validated before the first provider starts. A transient
failure may advance to the next configured provider only while no text has been
emitted. Once a `token` event has been sent, later stream failures are returned
as errors; the runtime must not splice a second provider's answer into the first.

The mock provider emits deterministic deltas without network access. Offline
tests use fake SSE responses and assert both pre-output fallback and the
no-fallback-after-output rule.

## Usage and timing

Each successful run returns the provider's reported input/output token counts
when the gateway supplies them, elapsed latency in milliseconds, and the
existing cost field (currently `0` until pricing is added). A stream that fails
after partial output emits an error rather than a successful `done` event.
