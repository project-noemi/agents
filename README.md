# NoéMI Architecture Blueprint — AI Workforce & Agents Library

> **Future-Proof Your Company Against AI, By Using AI**

---

## What This Repository Contains

This repository is the **technical reference architecture and agent specification library** inspired by **Project NoéMI**—the global AI fluency accelerator program.

It provides a structured blueprint for building a **governed Virtual Workforce** using:

* 26 AI agent specifications across 9 domains (coding, communication, education, engineering, guardian, infrastructure, marketing, operations, product)
* 8 reusable skills covering classification, verification, reporting, security, and orchestration
* 17 MCP protocol definitions for safe integration with Google Workspace (Drive, Docs, Sheets, Slides, Calendar, Gmail, Meet, Chat, Keep, Forms, Contacts, Admin), Slack, GitHub, n8n, web search, and unified logging (Loki/Grafana)
* Governance frameworks aligned with **Phase 0 Security**, **Gartner AI TRiSM**, and the **4D AI Fluency Framework** (Delegation, Description, Discernment, Diligence)
* Value lenses and operating profiles that let teams tune agents to specific business contexts without forking the specs

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

This repository includes a reference sync mechanism built around a **reviewed pull request** — upstream improvements are *proposed*, never auto-applied:

* Documentation: [docs/UPSTREAM_SYNC.md](https://github.com/project-noemi/agents/blob/main/docs/UPSTREAM_SYNC.md)
* Script: [scripts/sync-upstream.sh](https://github.com/project-noemi/agents/blob/main/scripts/sync-upstream.sh) — detects drift, merges (favouring local customizations), and opens a PR
* Test harness: [scripts/test-sync-upstream.sh](https://github.com/project-noemi/agents/blob/main/scripts/test-sync-upstream.sh) — offline verification of the sync logic (no network or `gh` required)
* Agent instruction: [docs/SYNC_AGENT_PROMPT.md](https://github.com/project-noemi/agents/blob/main/docs/SYNC_AGENT_PROMPT.md) — a drop-in prompt for a **scheduled Claude Code routine** that opens the PR for you

How it works:

* conflicting upstream hunks are auto-resolved in favour of your customizations (`-X ours`), and **every overridden file is surfaced in the PR body** for human review
* structural conflicts (rename, modify/delete) stop the run for manual resolution, then resume with `--continue`
* a duplicate guard means a daily run never piles up sync PRs — it reports the open one until a human merges it

This allows teams to:

* pull in updates from the core architecture on a daily or weekly schedule
* avoid overwriting local customizations — and see exactly what was kept vs. dropped
* keep a human in the loop on every upstream change via reviewed PRs
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
* Gemini CLI (canonical baseline pinned to Gemini 2.5 Flash)
* Claude Code
* OpenAI Codex
* LangChain
* Grok (hosted Custom Agents / Projects / Skills — the Gems and Custom GPT equivalent; see [docs/tool-usages/grok-custom-agents.md](docs/tool-usages/grok-custom-agents.md))

All reference tooling and Docker images use **Node.js 24** as the technical baseline for cross-fleet compatibility.

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

**Onboarding by Platform** — go straight to the guide for your machine and get one safe, read-only AI win in ~15 minutes:
→ [macOS / Linux](docs/examples/macos-linux-kickstart.md)
&nbsp;·&nbsp; [Windows](docs/examples/windows-kickstart.md)
&nbsp;·&nbsp; [ChromeOS](docs/examples/chromeos-kickstart.md)
(Not sure, or want the concepts first? Use the [platform chooser](docs/examples/cross-platform-kickstart.md) or [zero-to-first-agent.md](docs/examples/zero-to-first-agent.md).)

**Contributors**
→ [CONTRIBUTING.md](CONTRIBUTING.md)
(Contribution workflow, agent and skill standards)

**Visual Orientation**
→ [docs/visuals/README.md](docs/visuals/README.md)
(System maps and flows)

---

> **Working in this repo?** `CLAUDE.md` and `GEMINI.md` are **generated** context files — built from `templates/context/` plus the active agents, skills, and MCP protocols. After changing any of those sources, run `node scripts/generate_all.js` to refresh them. Don't hand-edit `CLAUDE.md` or `GEMINI.md`: regeneration overwrites manual changes, and CI checks them against golden fixtures.

---

## License & Transparency

**Category:** [Fair Source](https://fair.io/)
**License:** Functional Source License ([FSL-1.1-Apache-2.0](LICENSE))
**Promise:** [NoéMI Transparent Source Guarantee](docs/TRANSPARENT_SOURCE.md)

NoéMI uses a Fair Source distribution model. You are free to read, modify, use, and redistribute the framework; the only restriction is offering NoéMI itself as a competing commercial managed service. To ensure an ever-growing open-source commons, **each published version of NoéMI (tracked via tagged releases) automatically converts to the pure Apache 2.0 license exactly two years after its publication date.**

Beyond the license, NoéMI is built on **spec-and-governance transparency**: every agent persona, skill, value lens, operating profile, and MCP protocol is a versioned, human-readable spec, and the runtime context generated from them is deterministic and CI-verified. Read the [Transparent Source Guarantee](docs/TRANSPARENT_SOURCE.md) for the five auditable clauses behind the **NoéMI Transparent™** mark.

---

## Context

* **Project NoéMI** — the methodology, 4D framework, and GMU-backed training program
* **This repository** — the implementation blueprint for the Virtual Workforce
* **NewPush** — the founding cybersecurity and infrastructure organization

---

👉 Continue with: [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)
