# Layer B Dynamic Labs — n8n Templates

Production-ready, importable n8n workflow templates for **Project NoéMI Layer B (Dynamic Labs)** — the experiential, "just-in-time microburst" curriculum for **Practitioners (the Crew)**.

These templates follow the Gartner mandate for *embedded* pedagogy: instead of heavy external manuals, the lesson lives **inside the tool**. Every operational node carries an adjacent `stickyNote` "microburst" that teaches the *why* using the **4D AI Fluency Framework** (Delegation, Description, Discernment, Diligence — adapting Dakan & Feller) and NoéMI's role model (Explorer → Practitioner → Accelerator).

## Templates

| File | Lab | Nodes | 4D dimensions taught |
|------|-----|-------|----------------------|
| `customer-inquiry-router.json` | Customer Inquiry Router (Vibe Coding) | Webhook → Gemini LLM → Switch → mock outputs | Delegation, Description, the Agentic Shift, Discernment & Diligence |

## How to use

1. Import the `.json` file into your **NewPush Labs** n8n instance (Import from File, or paste onto the canvas).
2. Read each coloured microburst sticky **before** configuring the node beside it.
3. Replace every `REPLACE_WITH_YOUR_…` placeholder with your own **test/sandbox** credential — never a production secret (see [NewPush Labs](../../docs/tool-usages/newpush-labs.md)).
4. Send a sample request and watch the routing decision flow.

## Conventions

- **AI model baseline:** `models/gemini-2.5-flash` via `@n8n/n8n-nodes-langchain.googleGemini`.
- **No hardcoded secrets:** credentials are referenced by placeholder ID only (Fetch-on-Demand). Real secrets stay in the vault.
- **Naming:** English-first, slug-based filenames.
- **Promotion path:** `LABS (prototype) → peer review → PROD cluster` — promote only after logic is validated and a human approver signs off.
