# Organization Board — GrokBot and Bot Coordination

This document explains how the NewPush bot system works with GrokBot, organized around a 7-division, 21-department organization board. The system routes work to bots by role, with Executive Office acting as the central coordination hub.

## 1. The Organization Board

The bot fleet is organized into **7 divisions** and **21 departments**:

### Division 1: Communications (Departments 1–3)
- Dept 1: Personnel
- Dept 2: Communications
- Dept 3: Inspection and dispatch

### Division 2: Dissemination (Departments 4–6)
- Dept 4: Promotion and marketing
- Dept 5: Sales and prospecting
- Dept 6: Customer reach

### Division 3: Treasury (Departments 7–9)
- Dept 7: Income
- Dept 8: Disbursement
- Dept 9: Materiel and admin

### Division 4: Production (Departments 10–12)
- Dept 10: Tech services
- Dept 11: Training
- Dept 12: Build and coding

### Division 5: Qualifications (Departments 13–15)
- Dept 13: Quality and validity
- Dept 14: Standards and ethics
- Dept 15: Projects and migrations

### Division 6: Public (Departments 16–18)
- Dept 16: Public information
- Dept 17: Partnerships and reputation
- Dept 18: Community

### Division 7: Executive (Departments 19–21)
- Dept 19: Executive office / planning / statistics
- Dept 20: Legal and special affairs
- Dept 21: Knowledge and analysis

### Source of Truth

The source of truth for bot-to-seat assignments is a Google Sheet (restricted to signed-in NewPush accounts, no public access):

**[Organization Board Grid](https://docs.google.com/spreadsheets/d/14gPslm46qpekqtNDOFFKlCw7Lysxe0QRd_DxsHd0UGk/edit)**

The sheet tracks:
- **Type** — bot, team member, or contractor
- **Division** — which of the 7 divisions the seat belongs to
- **Department** — which of the 21 departments the seat belongs to
- **Seat name** — the functional role
- **ID** — unique identifier for bots (used for routing)
- **Status** — active, planned, inactive
- **Notes** — additional context

The sheet does not contain sensitive credentials. Bot identifiers, people's names, and per-bot lists are not copied into public documentation.

## 2. Executive Office — The Division 7 Hub

Executive Office (Department 19) is the central routing and coordination hub. It:
- Routes requests to bots by role using the sheet's bot IDs
- Assigns work to one bot at a time
- Receives results from bots
- Decides what reaches the user directly vs. what goes through the hub

### What Goes Straight to the User
- Draft cards the user presses Send on
- Sign-ins and approvals only the user can perform
- Urgent alerts requiring immediate attention

### What Goes Through the Hub
- Status updates and summaries
- Hand-offs between bots or departments
- Results from scheduled-watch tasks

### Escalation Path

Work escalates in the following order:
1. Bot (attempts to complete the task)
2. Department lead bot (if the bot cannot complete it)
3. Executive Office (if the department cannot resolve it)
4. The owner — final escalation point

**User approval is required for:**
- Money (spending, commitments)
- Customer-facing sends (emails, messages)
- Legal commitments (contracts, agreements)

## 3. Bot Intake Process

New bots are added through a formal intake process:

### Intake Sheet

Builders add a row to the **[Bot Intake Sheet](https://docs.google.com/spreadsheets/d/1l0j742kb4Mp4EnnuQla_O2oM5DN2f136ZXZr19eOWDY/edit)** with the following information:
- Bot name
- Builder (who is creating it)
- Proposed department
- Purpose (what the bot does)
- What it can touch (data, systems, integrations)
- Whether it sends messages (must remain draft-only)
- Overlaps (other bots with similar functions)

### Approval Flow

1. Builder adds the bot to the intake sheet
2. Executive Office checks for conflicts with existing bots
3. The owner approves the bot
4. The bot is moved onto the organization board grid
5. The bot registers with Executive Office by message

## 4. Handoff Convention

All work is routed through Executive Office using a **fixed message format**. This ensures consistency and traceability.

### Message Format

Every handoff includes:
- **Task** — what needs to be done
- **Context** — background information and relevant links
- **Deadline** — when the result is needed
- **Prohibitions** — what the bot must NOT do (e.g., no direct sends, no unapproved spending)
- **Report back** — where to send the result (usually back to Executive Office)

### Communication Model

- **Fire-and-forget async messaging** — no live back-and-forth chat
- Everything routed through Executive Office
- Bots do not communicate directly with each other
- Bots do not communicate directly with the user unless instructed

## 5. Shared Rules for All Bots

All bots follow a common set of rules, documented in a **shared skill** that all bots read and follow.

### Key Rules

- **Never send email, Slack, or messages without the user's approval**
- **Autonomous drafts stay drafts** — bots may prepare messages but not send them
- **Secrets never in chat or repo** — credentials must be fetched from the vault (Infisical or 1Password)
- **Escalate when uncertain** — follow the escalation path rather than guessing
- **Document all work** — log actions in audit logs
- **Respect prohibitions** — never override prohibitions in the handoff message

The shared skill is part of the bot specification library and is loaded on demand by each bot.

## 6. Cursor as the Shared Team Environment

All GrokBot builders work in **Cursor** as the shared team environment.

### Why Cursor

- Unified environment for all builders
- Consistent tooling and workflows
- Cloud agents can collaborate on shared repositories
- Supports the NoéMI agent specification library

### How It Works

- Builders use Cursor to develop and test bots
- Bots are defined as agent personas following the NoéMI specification format
- Generated context files (`GEMINI.md`, `CLAUDE.md`) are built from the specifications
- The system follows the develop-only merge flow (all work goes through `develop`, then promoted to `main`)

---

## Related Documentation

- [AGENTS.md](../AGENTS.md) — Master agent registry and composition rules
- [docs/MACHINE_IDENTITY.md](MACHINE_IDENTITY.md) — Machine identity for bot-authored PRs
- [docs/DEV_AGENT_PROMPT.md](DEV_AGENT_PROMPT.md) — Development workflow and branch naming
- [docs/GOVERNANCE.md](GOVERNANCE.md) — Governance model for agent specifications
