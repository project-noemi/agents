# End-to-End Example: Autonomous RFP/RFQ Responder

This guide walks you through deploying an end-to-end event-driven agent workflow using **n8n**, **Gmail**, **Google Docs**, and the **Google Gemini node**.

## The Scenario
Your organization frequently receives Requests for Proposals (RFPs) and Requests for Quotes (RFQs) via email. Reviewing these, extracting the requirements, and setting up the initial draft documents takes valuable human time. 

We will deploy an agentic workflow that:
1.  Watches a Gmail inbox for new emails.
2.  Uses the "Knowledge Manager & Researcher" agent persona to analyze the email.
3.  Determines if the email is an RFP/RFQ.
4.  If it is, extracts the core requirements and deadline.
5.  Creates a formatted Google Doc containing the analysis.
6.  Drafts a reply in Gmail containing a link to the new Google Doc for a human to review.

---

## Prerequisites
1.  An active instance of **n8n** (Cloud or Self-Hosted).
2.  Google Workspace credentials configured in n8n for:
    *   **Gmail API** (Read and Compose Drafts)
    *   **Google Docs API** (Create Documents)
3.  A Google Gemini credential configured in n8n.
4.  Review the credential split first:
    *   [`n8n-google-workspace-quickstart.md`](n8n-google-workspace-quickstart.md)
    *   [`../mcp-setup/google-n8n-credential-matrix.md`](../mcp-setup/google-n8n-credential-matrix.md)

---

## Step 1: Import the Workflow

We have provided a pre-configured, exportable n8n JSON file for this exact workflow. 

1. Navigate to the `examples/workflows/` directory in this repository.
2. Open the file `rfp-responder.json` and copy its entire contents.
3. Open your n8n interface, navigate to **Workflows**, and click **Add Workflow**.
4. Click the gear icon in the top right and select **Import from File** (or simply paste the JSON directly onto the canvas if your version supports it).

---

## Step 2: Understand the Architecture

Once imported, you will see a visual representation of the **Delegation** phase of the 4D Framework. Here is what each node does:

### 1. Gmail Trigger (New Emails)
This node acts as the **Event-Driven Trigger**. It polls the authenticated Gmail account every minute for any new, unread emails. When one arrives, it pushes the email payload down the pipeline.

### 2. Analyze Request (Gemini)
This is where the synthetic intelligence acts. It uses the current n8n Google Gemini node. 
*   **The System Prompt:** We inject instructions telling the model to act as a triage agent. It reads the email body and is strictly instructed to return structured JSON containing an `is_rfp_rfq` boolean, a `summary`, `requirements`, and a `deadline`.
*   *Note: In a production environment, use the repo personas as design input, but keep the node prompt narrowly scoped instead of pasting all of `GEMINI.md` into the workflow.*

### 3. Is RFP/RFQ? (IF Router)
This node parses the JSON returned by Gemini. 
*   If `is_rfp_rfq === true`, the workflow routes to the "True" branch.
*   If `false`, it routes to the "False" branch, hitting a No-Op node (Ignore Non-RFPs), effectively dropping the email without taking action.

### 4. Create Google Doc
For verified RFPs, this node authenticates with the Google Docs API. It creates a new document titled `RFP Draft: [Email Subject]`. 
It takes the structured JSON extracted by Gemini (the summary and bulleted requirements) and injects it directly into the body of the new Google Doc, formatting it cleanly for the human team.

### 5. Draft Gmail Reply
Following the strict **Security Hardening (HITL)** rules from our `GOVERNANCE.md` protocols, the agent *does not send the email*. 
Instead, it uses the Gmail API to create a **Draft** reply to the original sender. The draft acknowledges receipt and includes the internal URL to the newly created Google Doc so a human team member can click it, review the AI's analysis, and finalize the proposal.

---

## Step 3: Activate and Test

1.  Replace the placeholder credential IDs in [`../../examples/workflows/rfp-responder.json`](../../examples/workflows/rfp-responder.json) and link the Gmail, Google Docs, and Gemini nodes to your authenticated accounts.
2.  Click the **Test Workflow** button in n8n.
3.  Send an email to your connected Gmail account with a subject like "RFP: Enterprise Software Overhaul" and a body detailing some software requirements and a deadline.
4.  Watch the workflow execute! Within a minute, you should see a new Google Doc appear in your Drive, and a Draft reply sitting in your Gmail outbox.
