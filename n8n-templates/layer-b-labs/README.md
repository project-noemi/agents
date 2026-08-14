# Layer B Dynamic Labs — n8n Templates

Production-ready, importable n8n workflow templates for **Project NoéMI Layer B (Dynamic Labs)** — the experiential, "just-in-time microburst" curriculum for **Practitioners (the Crew)**.

These templates follow the Gartner mandate for *embedded* pedagogy: instead of heavy external manuals, the lesson lives **inside the tool**. Every operational node carries an adjacent `stickyNote` "microburst" that teaches the *why* using the **4D AI Fluency Framework** (Delegation, Description, Discernment, Diligence — adapting Dakan & Feller) and NoéMI's role model (Explorer → Practitioner → Accelerator).

## Templates

| File | Lab | Nodes | 4D dimensions taught |
|------|-----|-------|----------------------|
| `customer-inquiry-router.json` | Customer Inquiry Router (Vibe Coding) | Webhook → Gemini LLM → Switch → mock outputs | Delegation, Description, the Agentic Shift, Discernment & Diligence |
| `customer-inquiry-router-grok.json` | Same lab, Grok variant | Webhook → Basic LLM Chain + xAI Grok Chat Model → Switch → mock outputs | Same 4D sequence. Optional companion — Gemini remains the baseline. |

## How to use

1. **Deploy n8n on your NewPush Labs instance.** n8n is not baked into the base appliance — spin it up via the Labs Portainer templates or a Dockge stack, alongside the pre-installed Casdoor (SSO), Traefik (ingress), and Grafana/Loki (observability).
2. **Import the template.** In n8n, *Import from File* (or paste the JSON onto the canvas). If your Labs n8n is older than the node versions below, n8n will offer to migrate them on import.
3. **Read each coloured microburst sticky** *before* you configure the node beside it.
4. **Attach your own model credential** — Gemini on the baseline file, xAI on the Grok variant. Replace the `REPLACE_WITH_YOUR_…` placeholder with a **test/sandbox** key, never a production secret (see [NewPush Labs](../../docs/tool-usages/newpush-labs.md)).
5. **Send a test request.** Once active, the webhook is exposed through Traefik, e.g.
   `POST https://<your-n8n-host>/webhook/customer-inquiry-router` with body
   `{ "message": "My invoice looks wrong" }`. Watch the routing decision flow left → right.

## How this maps to the NewPush Labs stack

The lab is designed to exercise capabilities the Labs appliance already provides:

| Labs component | Role in this lab |
|----------------|------------------|
| **Traefik** (ingress) | Exposes the n8n webhook at a Labs domain (behind Casdoor SSO). |
| **Casdoor** (SSO) | Gates access to the n8n editor and ingress. |
| **Promtail → Loki → Grafana** (observability) | Captures n8n stdout/stderr. Each mock output emits an `audit_log` object (NoéMI's canonical `{ task, inputs, actions, risks, result }` shape) so routing decisions are queryable in Grafana — making the **Diligence** lesson real, not theoretical. |
| **Portainer / Dockge** (deployment) | How n8n itself is provisioned into the instance. |
| **MAFL** (dashboard) | Where the running n8n service surfaces for the cohort. |

## Conventions

- **AI model baseline:** `models/gemini-3.6-flash` via `@n8n/n8n-nodes-langchain.googleGemini` in `customer-inquiry-router.json`.
- **Grok companion:** n8n has no standalone Grok root node. `customer-inquiry-router-grok.json` uses Basic LLM Chain (`chainLlm@1.7`) plus `@n8n/n8n-nodes-langchain.lmChatXAiGrok` and reads `$json.text`. Pick the current Grok chat model in the UI if `grok-4` is not listed. This does **not** change the dual-track AI Model Baseline.
- **Node versions:** built for current n8n core nodes — `webhook@2.1`, `switch@3.2`, `set@3.4`, plus `googleGemini@1.1` (baseline) or `chainLlm` + `lmChatXAiGrok` (Grok variant). n8n's import migration handles older instances.
- **AI model baseline:** `models/gemini-3.6-flash` via `@n8n/n8n-nodes-langchain.googleGemini`.
- **Node versions:** built for current n8n core nodes — `webhook@2.1`, `switch@3.2`, `set@3.4`, plus `googleGemini@1.1`. n8n's import migration handles older instances.
- **No hardcoded secrets:** credentials are referenced by placeholder ID only (Fetch-on-Demand). Real secrets stay in the vault.
- **Audit logging:** mutating/routing branches emit a structured `audit_log` to the item payload (and, in production, to stderr → Loki), excluding secrets and PII.
- **Naming:** English-first, slug-based filenames.
- **Promotion path:** `LABS (prototype) → peer review → PROD cluster` — promote only after logic is validated and a human approver signs off.
