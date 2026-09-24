# NewPush generative AI gateway

Call xAI Grok and Google Gemini through NewPush. You authenticate with a
**virtual key**. Provider credentials stay with NewPush. Do not send this key
to api.x.ai or to Google.

Client contract (September 2026): OpenAI-compatible `https://ai-gw.newpush.com/v1`
and Google-native `https://ai-gw.newpush.com/google`.

## Auth

Infisical secret **`AI_GW_API_TOKEN`** (guide name `AI_GW_API_KEY` is an alias).
Optional override **`AI_GW_BASE_URL`**. Unset, the coding-loop writer uses
`https://ai-gw.newpush.com/v1`.

```bash
infisical run --env=dev -- node -e 'process.stdout.write(process.env.AI_GW_API_TOKEN ? "gateway key present\n" : "missing\n")'
```

Do not paste the key into chat. Do not commit it.

Header: `Authorization: Bearer sk-...`

## OpenAI-compatible surface (Grok and Gemini)

| | |
|---|---|
| Base URL | `https://ai-gw.newpush.com/v1` |
| List models | `GET /models` |
| Chat | `POST /chat/completions` (streaming supported) |

`model` is always `provider/id`. Do not send a bare `grok-4.6` or
`gemini-3.8-flash` on `/v1`. Do not send `vertex_ai/...`.

| Pin | Use |
|---|---|
| `xai/grok-4.6` | Default coding / agents / long jobs (coding-loop Stage C) |
| `xai/grok-build-0.1` | Faster, cheaper coding loops |
| `xai/grok-4.3` | Longer context, lower price |
| `google/gemini-3.8-flash` | Gemini on the OpenAI surface |

Override the writer pin with `XAI_CODE_MODEL`. Grok 4.6 spends thinking
tokens; the writer sets `max_tokens` (default 16384, override `XAI_MAX_TOKENS`).

```bash
curl -sS "https://ai-gw.newpush.com/v1/models" \
  -H "Authorization: Bearer $AI_GW_API_TOKEN"
```

## Google-native surface (Gemini only)

Base URL `https://ai-gw.newpush.com/google`. Model ids have **no** `google/`
prefix (`gemini-3.8-flash`). This repo's live critic still uses Vertex ADC, not
this surface, unless you change `--live-critic` separately.

Lab / example pins in this repository remain **Gemini 3.6 Flash** on Vertex
until a dedicated decision retargets them.

## Errors

| HTTP | Meaning |
|---|---|
| 401 | Missing or invalid virtual key |
| 403 | Model not allowed on the key/team, or budget/RPM/TPM exhausted |
| 429 | Rate limited — back off |
| 5xx | Retry with jitter |

This virtual key is not an xAI or Google credential. Do not open tickets with
those providers using it.

## Coding loop

```bash
infisical run --env=dev -- env AGENT_GH_USE_CLASSIC=1 \
  node coding-loop/run.js --repo newpush/newpush-agents --issue N \
  --scan --budget-ok --implement --open-pr
```

`XAI_API_KEY` (native api.x.ai) still wins if both are set.
