# NoéMI Architecture Blueprint — AI Workforce & Agents Library

> **Future-Proof Your Company Against AI, By Using AI**

---

## What This Repository Contains

This repository is the **technical reference architecture and agent specification library** inspired by **Project NoéMI**—the global AI fluency accelerator program.

It provides a structured blueprint for building a **governed Virtual Workforce** using:

* 20+ AI agent specifications across 8 domains (marketing, engineering, operations, security, etc.)
* Reusable skills for classification, validation, reporting, and orchestration
* MCP protocol definitions for safe integration with tools like Google Workspace, Slack, GitHub, and n8n
* Governance frameworks aligned with **Phase 0 Security** and **Gartner AI TRiSM**

These components are designed to move organizations from **unstructured, high-risk AI usage** to a **controlled, auditable, and scalable operating model**.

> This is not a runtime. It is the blueprint that orchestrators execute.

---

## How Organizations Use This Repository

Organizations typically **fork or copy this repository into a private environment**, then adapt it progressively as they implement AI agents within their own systems.

This enables them to:

* customize agents, workflows, and integrations for their specific business context
* protect internal logic and intellectual property
* move at their own pace without blocking on upstream changes

In practice:

* teams start with a small number of agents and workflows
* validate them against real business use cases
* gradually extend the system with additional agents, skills, and integrations

---

### Staying Aligned with a Moving Architecture

Project NoéMI is not a static framework.
It evolves continuously as AI capabilities, tooling, and best practices change.

To support this, organizations maintain a **private working copy** of the repository while selectively syncing improvements from upstream.

This repository includes a reference sync mechanism:

* Documentation: [docs/UPSTREAM_SYNC.md](https://github.com/project-noemi/agents/blob/main/docs/UPSTREAM_SYNC.md)
* Script: [scripts/sync-upstream.sh](https://github.com/project-noemi/agents/blob/main/scripts/sync-upstream.sh)

This allows teams to:

* pull in updates from the core architecture
* avoid overwriting local customizations
* stay aligned with the evolving NoéMI model

This model combines:

* **stability** (your controlled internal implementation)
* with
* **adaptability** (continuous improvements from upstream)

The result is a system that does not become obsolete as the AI landscape evolves.

---

## Why This Exists

AI adoption is already happening inside most organizations, but either without structure, or with too many constraints driving people toward Shadow AI.

Common patterns include:

* fragmented tool usage across teams ("Shadow AI")
* inconsistent outputs and quality
* unclear security boundaries and data leakage risks
* no reliable way to measure ROI or operational impact

Project NoéMI addresses this by rejecting the **Replacement Trap**—the idea that AI's primary value is reducing headcount.

Instead, it introduces a **Virtual Workforce model**, where:

* **AI Agents (Virtual Coworkers)** handle repeatable, data-intensive, first-pass work
* **Humans** handle review, exceptions, and decision-making
* The **Guardian Layer** (AI monitoring AI) ensures continuous control, compliance, and safety

This is not about experimentation.
This is about **operationalizing AI securely and at scale**.

---

## The Core Idea

This is not a software tool.
This is a **system for redesigning how work gets done**.

Instead of individuals using AI tools in isolation, you get:

* defined AI roles (Virtual Coworkers)
* structured task execution (Skills)
* controlled system interaction (Protocols)
* enforced governance (Phase 0 Security + Guardian Layer)

---

## The 1:50 Equilibrium & Human Workforce Model

While AI agents perform execution, humans govern the system.

Project NoéMI introduces the **1:50 Equilibrium**—a scalable organizational model:

* **Accelerators (Pilots):** design architecture, implement security, and govern the AI ecosystem
* **Practitioners (Crew):** build and orchestrate agent workflows ("vibe coding")
* **Explorers (Passengers):** domain experts who define problems and validate outputs

In practice, one trained Accelerator can guide AI usage across dozens of users safely.

This model is reinforced through the NoéMI training program, where participants earn **Badges of Completion (micro-credentials)** issued with **George Mason University (GMU)** across three levels:

* AI Fluent Professional
* AI Implementation Specialist
* AI Governance Architect

The objective is not to turn everyone into an AI engineer, but to create a **governed system where AI can scale safely across the organization**.

---

## Security First: Phase 0 Security

Before deploying any agents, organizations must establish a **security baseline**.

Most AI initiatives start with prompting.
NoéMI starts with **control of the data perimeter**.

Phase 0 addresses:

* Shadow AI (unauthorized tool usage)
* data classification and boundary definition
* credential and access management (Fetch-on-Demand secrets)
* deployment of Guardian agents for monitoring

Without Phase 0, scaling AI introduces risk faster than value.

👉 Start here: [docs/PHASE_ZERO_SECURITY_BASELINE.md](docs/PHASE_ZERO_SECURITY_BASELINE.md)

---

## What This Repository Is (And Isn't)

### This IS:

* a reference architecture
* an AI Virtual Workforce blueprint
* a library of governed agent specifications
* a foundation for building production systems

### This is NOT:

* a SaaS product
* a no-code automation tool
* a runtime or execution engine
* the NoéMI training program itself

It is designed to work with orchestrators such as:

* n8n (primary orchestration layer in the NewPush Labs stack)
* Gemini CLI
* Claude Code
* OpenAI Codex
* LangChain

---

## Getting Started

**Business / Decision Makers**
→ [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
(Strategy, Virtual Workforce model, organizational impact)

**Security / IT Leaders**
→ [docs/PHASE_ZERO_SECURITY_BASELINE.md](docs/PHASE_ZERO_SECURITY_BASELINE.md)
(Security foundation and readiness)

**Practitioners / Builders**
→ [docs/examples/zero-to-first-agent.md](docs/examples/zero-to-first-agent.md)
(Building your first Virtual Coworker)

**Visual Orientation**
→ [docs/visuals/README.md](docs/visuals/README.md)
(System maps and flows)

---

## Context

* **Project NoéMI** — the methodology, 4D framework, and GMU-backed training program
* **This repository** — the implementation blueprint for the Virtual Workforce
* **NewPush** — the founding cybersecurity and infrastructure organization

---

👉 Continue with: [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
