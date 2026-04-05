# n8n + Google Workspace Quickstart

This is the supported path for repeatable, event-driven workflows that use Google Workspace and Gemini inside n8n.

Use this guide when you want:

- Gmail-triggered workflows
- Google Docs or Sheets updates inside a workflow
- recurring or webhook-driven automations
- human approval gates before sending, writing, or mutating data

This path uses **n8n credentials**, not the Gemini CLI Workspace extension.

If you want ad-hoc human-led work in the terminal, use [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md) instead.

## Recommended Starting Shape

Start with one event source, one Gemini classification step, one Google Workspace write, and one human-reviewed action.

That is exactly the shape shown by:

- [`../../examples/workflows/rfp-responder.json`](../../examples/workflows/rfp-responder.json)
- [`rfp-responder.md`](rfp-responder.md)

## Prerequisites

- an n8n instance
- Google Workspace access for the Google nodes you plan to use
- a Google Gemini API credential in n8n for the Gemini model node
- a clear human-approval boundary for any mutating action

If you also want to manage workflows through the n8n API, you additionally need the n8n API enabled and an API key. That is a separate concern from Gmail, Docs, Sheets, and Gemini node credentials.

## Credentials You Usually Need

For a Gmail-to-Docs flow like the RFP responder, expect at least:

- Gmail credential in n8n
- Google Docs credential in n8n
- Google Gemini credential in n8n

For spreadsheet-driven work, add:

- Google Sheets credential in n8n

For a full matrix of which credential surface applies where, use [`../mcp-setup/google-n8n-credential-matrix.md`](../mcp-setup/google-n8n-credential-matrix.md).

## Step 1: Import the Reference Workflow

Import [`../../examples/workflows/rfp-responder.json`](../../examples/workflows/rfp-responder.json) into n8n.

This example uses:

- `n8n-nodes-base.gmailTrigger`
- `@n8n/n8n-nodes-langchain.googleGemini`
- `n8n-nodes-base.if`
- `n8n-nodes-base.googleDocs`
- `n8n-nodes-base.gmail`

## Step 2: Replace the Placeholder Credentials

The workflow JSON contains obvious placeholder credential IDs and names where applicable. Replace them with credentials from your own n8n instance before activating the workflow.

At minimum, check:

- Gmail Trigger node
- Analyze Request (Gemini) node
- Draft Gmail Reply node
- Create Google Doc node

## Step 3: Validate the Workflow Shape in n8n

Before activating:

- confirm the Gmail trigger can load labels
- confirm the Gemini node can see the intended model
- confirm the Google Docs node can create a test document
- confirm the final Gmail node creates a **draft**, not a sent message

## Step 4: Keep the Persona Context Narrow

Do not paste the entire generated `GEMINI.md` into an n8n system prompt.

Instead:

- use the repository personas as design guidance
- extract only the minimal prompt text the node needs for the task
- keep the node prompt focused on one outcome and one JSON shape

This reduces token bloat and makes node behavior easier to debug.

## Step 5: Add Human Approval at the Last Mutating Step

The default safe pattern is:

1. classify with Gemini
2. write a Google Doc draft or structured record
3. create a Gmail draft or queue a review task
4. let a human approve the final outbound action

Do not start with fully autonomous send flows.

## Common Mistakes

- assuming the n8n API key configures Gmail, Docs, or Gemini nodes
- assuming Gemini CLI Workspace auth carries over into n8n
- using service accounts without configuring impersonation where Gmail access is required
- using outdated Gemini node types from older examples
- putting too much persona text into the Gemini node prompt

## Good First Workflow Types

- Gmail triage with draft creation
- Drive or Docs summarization for internal knowledge work
- Sheets append/update workflows with human review before outbound messaging

## Related Guides

- [`rfp-responder.md`](rfp-responder.md)
- [`../mcp-setup/n8n.md`](../mcp-setup/n8n.md)
- [`../mcp-setup/google-n8n-credential-matrix.md`](../mcp-setup/google-n8n-credential-matrix.md)
- [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md)
