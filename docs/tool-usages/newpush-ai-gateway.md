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
| `google/gemini-3.1-pro-preview` | Default Stage B′ critic and fleet reviewer pin |

Override the writer pin with `XAI_CODE_MODEL`. Grok 4.6 spends thinking
tokens. The writer sets `max_completion_tokens` (default 65536, override
`XAI_MAX_TOKENS`) so that budget is the visible file JSON, not the thinking.
This gateway is LiteLLM. It returns HTTP 400 `UnsupportedParamsError` for
`max_completion_tokens` on `xai/grok-4.6` unless the body also includes
`allowed_openai_params`. The writer names `max_completion_tokens` and
`response_format` for `xai/*` on every base other than `api.x.ai`, and sets
`response_format` to `json_object`. `max_tokens` is not sent: it counts
thinking and the visible answer together.

Do not send `allowed_openai_params` for `google/*`. LiteLLM maps
`response_format` and `max_completion_tokens` natively for Gemini; naming them
forwards `response_format` raw, and Vertex returns 400 `Unknown name "type" at
'generation_config.response_format'`. `scripts/model-chat.js` names them for
`xai/*` only.

```bash
curl -sS "https://ai-gw.newpush.com/v1/models" \
  -H "Authorization: Bearer $AI_GW_API_TOKEN"
```

## Google-native surface (Gemini only)

Base URL `https://ai-gw.newpush.com/google`. Model ids have **no** `google/`
prefix (`gemini-3.8-flash`). `scripts/model-config.js` records this base as
`gateway.googleBase`; no caller in this repository uses it yet. The critic and
the reviewer use the OpenAI surface above.

Lab / example pins in this repository remain **Gemini 3.6 Flash** on Vertex
until a dedicated decision retargets them.

## Errors

| HTTP | Meaning |
|---|---|
| 400 | Rejected parameter. `max_completion_tokens` without `allowed_openai_params` is this case for `xai/grok-4.6` |
| 401 | Missing or invalid virtual key |
| 403 | Model not allowed on the key/team, or budget/RPM/TPM exhausted |
| 422 / 429 / 400 with `type: budget_exceeded` | Budget spent. The status depends on the LiteLLM release |
| 429 | Rate limited — back off |
| 5xx | Retry with jitter |

`scripts/model-chat.js` reports a 403, and any refusal whose body type is
`budget_exceeded` or `*_model_access_denied`, as `budget-or-forbidden` with
status 403. Callers stop on it and do not retry or re-queue. It also sends
`x-litellm-timeout` so the gateway does not cut a long Gemini Pro call at its
600-second default before the client's own inactivity timeout.

This virtual key is not an xAI or Google credential. Do not open tickets with
those providers using it.

## Coding loop

```bash
infisical run --env=dev -- env AGENT_GH_USE_CLASSIC=1 \
  node coding-loop/run.js --repo newpush/newpush-agents --issue N \
  --scan --budget-ok --implement --open-pr
```

## Precedence

One config, `scripts/model-config.js`, serves the writer, the Stage B′ critic
and reviser, the doc critic, and the fleet reviewer (Decision
[2026-10-22-0001]):

- `AI_GW_API_TOKEN` or `AI_GW_API_KEY` set: every live model call goes through
  this gateway, even when `XAI_API_KEY` or `GCP_ACCESS_TOKEN` is also set.
- No gateway key: direct provider access. `XAI_API_KEY` to api.x.ai for the
  writer, application-default credentials to Vertex for Gemini.

| Stage | Env override | Gateway default |
|---|---|---|
| code (writer) | `XAI_CODE_MODEL` | `xai/grok-4.6` |
| plan (draft and revision) | `PLAN_MODEL` (any provider/id; bare id is Gemini) | `google/gemini-4-argon` |
| plan critic | `GEMINI_CRITIC_MODEL`, else `GEMINI_REVIEW_MODEL` | `google/gemini-3.1-pro-preview` |
| pull-request review | `GEMINI_REVIEW_MODEL` | `google/gemini-3.1-pro-preview` |

The override names keep their native meaning. On the gateway a bare id gets
the provider prefix, and `auto` or empty takes the gateway default. A pin the
key cannot call fails the run; nothing is substituted.
