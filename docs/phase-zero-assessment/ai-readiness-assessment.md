# AI Readiness Assessment

This assessment answers the second executive question:

**"If this is safe enough to begin, are we ready to get real business value from AI?"**

It is the operational and business half of the Project NoeMI initial assessment. Its purpose is to determine whether the organization has the workflow clarity, ownership, measurement, and human operating model needed to turn AI into measurable productivity, higher output, and lower unit cost.

## What This Assessment Is For

Use this assessment when a business or enterprise wants to move from:

- curiosity to a real pilot
- one-off prompting to repeatable workflows
- individual task execution to human management of AI doing the task

This assessment does **not** replace the security assessment. It assumes the organization must be both **safe enough** and **ready enough**.

## The Questions It Answers

- Is there a business use case with a real owner, real volume, and real pain?
- Is the workflow stable enough to automate or augment?
- Can success be measured in speed, output, quality, capacity, or cost?
- Which human roles should stay responsible for approval, correction, and exception handling?
- Can staff move from doing every step manually to managing AI performing first-pass work?
- Which first pilot is likely to create visible value without creating unnecessary risk?

## Core Assessment Areas

### 1. Business Use-Case Clarity

- named sponsor
- named process owner
- specific workflow to improve
- reason the workflow matters now
- known pain points such as delay, backlog, inconsistency, or labor intensity

### 2. Process Stability and Repeatability

- repeatable steps
- clear inputs and outputs
- known handoffs
- low enough process chaos that AI is not being pointed at a moving target

### 3. Data and Knowledge Readiness

- source documents and systems are known
- inputs are accessible and understandable
- critical reference materials exist
- exceptions can be recognized and escalated

### 4. Human Approval and Decision Rights

- final human approver is known
- escalation path exists
- risky or customer-facing actions stay behind review gates
- the business knows which steps AI may perform and which remain human-only

### 5. Workforce Uplift and Role Design

- identify who currently performs the task
- identify which parts should shift to AI first-pass work
- define the human role after AI enters the loop
- move people from repetitive execution toward supervision, quality control, exception handling, and process improvement

This is where NoeMI creates its biggest practical shift: the team is not just learning to perform the task with AI. It is learning to **manage AI doing the task**.

### 6. Tooling and Integration Practicality

- required systems are known
- integration path is realistic
- pilot can begin with a constrained toolset
- human-led local path, n8n workflow, or governed runtime path is chosen intentionally

### 7. Change Readiness and Sponsorship

- leadership sponsor is engaged
- participants have time and authority to test
- owners will review results and approve corrections
- staff understand that AI changes the shape of work, not only the speed of work

### 8. Value Measurement and ROI Baseline

- current time spent is known or estimable
- current volume is known
- current rework or quality pain is known
- future success metrics are defined before the pilot starts

Typical measures include:

- turnaround time
- throughput
- backlog reduction
- draft quality consistency
- human hours redirected
- lower unit cost per completed item

### 9. Individual Adoption Readiness

Areas 1 through 8 measure whether the organization is ready. This area measures whether the actual workforce is ready. Org-level sponsorship and process clarity can be strong while the people who must use AI every day remain unsure, undertrained, or quietly resistant — and that gap is where pilots stall. Sample beyond the sponsor: talk to the people who will do the work.

- individual AI literacy: participants understand what AI can and cannot reliably do
- confidence: participants believe they can use AI in their own work without feeling exposed
- current usage: whether staff already use AI (sanctioned or Shadow AI) and how
- resistance and concern: fear of replacement, distrust of output, or workload skepticism is surfaced rather than hidden
- willingness: participants are open to changing how they work, not just to a faster version of the old way
- uplift need: the literacy and confidence gap that training must close before the pilot
- breadth: readiness is checked across the workforce doing the task, not inferred from the sponsor alone

### 10. AI Already in Use and Agent Permissions

Area 9 asks whether people are ready. This area asks whether the organization knows what AI is already running, whose access it uses, and what it can change. Most organizations already have AI in use that nobody approved: personal chatbot accounts, AI features a vendor switched on inside an approved SaaS tool, coding assistants on personal keys, and assistants or automations connected to email, files or the CRM. A pilot built next to ungoverned AI inherits its risk. Sort what you find by what it can reach and what it can do on its own: a tool that only drafts text is a data question; an agent that can send, change or delete is an access question.

- discovery: an inventory exists of AI tools, accounts and features in use, including personal accounts used for work
- AI inside existing SaaS: AI features in core SaaS tenants are known, reviewed and deliberately on or off; a vendor's new AI feature or AI subprocessor triggers a short review
- agents and connectors: assistants, agents, automations and tool connections (including MCP servers) that can act are listed with what they can read and change
- identity: each agent or automation runs on its own scoped identity with a named human owner, not on an employee's personal login or a shared key
- data handling: approved AI tools have known retention, training and data-location settings, and the Refusal Principle is applied to them
- policy and training: staff know which AI tools are approved, how to request a new one, and how to report one they find; requests are answered quickly enough that people do not route around them
- monitoring and review: new AI use, new high-impact permission grants and unusual automated activity are noticed; agents are reviewed on a schedule and switched off when their owner leaves or the need ends

This is where NoéMI's governed pilot path pays off twice: it gives people a sanctioned way to get the benefit they were already seeking, and it lets the organization close the risky cases without banning AI.

## Why This Assessment Matters

The AI readiness assessment goes beyond whether the technology works. It determines whether the organization is positioned to get real business value from it.

The core idea:

> This is not just about doing the task faster. It is about redesigning the workflow so AI handles repeatable first-pass work while your people manage approvals, exceptions, and quality.

The business outcome is bigger than convenience:

- more output with the same team
- faster turnaround on repetitive work
- more consistent first drafts or first-pass decisions
- less skilled human time spent on low-leverage repetition
- clearer path to measurable ROI

## How Work Changes With AI

When AI enters a workflow, the shape of work changes:

- **Before AI:** skilled people spend valuable time doing every repetitive step themselves
- **With governed AI:** AI handles the first-pass work inside defined boundaries
- **After uplift:** people spend more time reviewing, improving, deciding, and governing

This is how an organization moves from thinking about AI as labor substitution to building a **Virtual Workforce** — where the team is not just learning to perform the task with AI, but learning to manage AI doing the task.

## Recommended Output

The client should leave with:

- one or two high-confidence pilot candidates
- a clear statement of what success looks like
- the baseline metrics needed for later ROI tracking
- the approval boundary for the first pilot
- a role-uplift explanation leadership can support
- an AI readiness classification:
  `ready now`, `ready with guardrails`, or `not ready yet`

## What Good First Pilots Look Like

Strong first pilots are usually:

- high-volume
- repetitive
- low-to-medium risk
- easy to review by a human
- painful enough that the business owner already wants relief

Examples:

- inbound request triage
- draft creation
- document summarization
- action-item extraction
- internal knowledge retrieval

## What To Avoid In The First Pilot

- unstable processes with no clear owner
- emotionally sensitive or high-liability tasks with no review gate
- enterprise-wide rollouts before one team proves value
- pilots with no baseline metrics
- work where nobody agrees what "good" looks like

## Executive Summary

> The AI readiness assessment tells us whether this organization can turn AI into governed output, measurable productivity, and lower delivery cost — without confusing experimentation for transformation.
