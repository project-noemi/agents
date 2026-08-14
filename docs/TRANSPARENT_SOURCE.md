# The NoéMI Transparent Source Guarantee

Project NoéMI is distributed as **Fair Source** software. The code is legally governed by the Functional Source License ([FSL-1.1-Apache-2.0](../LICENSE)), which allows anyone to read, use, modify, and redistribute it, with a temporary two-year restriction on offering a competing commercial NoéMI-as-a-service. Each published version automatically converts to the Apache 2.0 open-source license two years after its publication date; tagged GitHub releases are the canonical published versions for that timeline.

A legal license does not by itself create architectural trust. In the era of AI, trust requires operational transparency. To bridge that gap, NoéMI establishes the **Transparent Source Guarantee**.

## What "Transparency" Means for NoéMI

In AI contexts, "transparency" often refers to model weights or training data. Project NoéMI is an **agent specification library and reference architecture — not a runtime, an execution engine, or a Large Language Model**. External orchestrators (Gemini CLI, Claude Code, Codex, Grok Build, n8n, LangChain) consume the specifications defined here. Our guarantee is therefore scoped strictly to **spec-and-governance transparency**: you can always inspect exactly what an agent is instructed to do, what it refuses, and how it is audited.

## The Five Clauses

If a deployment carries the **NoéMI Transparent™** mark, it guarantees five auditable clauses:

1. **Public Specs** — Every element of an agent's behavior — its persona, skills, value lenses, operating profiles, and MCP protocols — is defined in versioned, human-readable specification files. There are no compiled artifacts or hidden prompts defining behavior.
2. **Verifiable Context** — The generated runtime context (`CLAUDE.md`, `GEMINI.md`) is produced deterministically by `scripts/generate_all.js` and enforced by CI through golden-fixture and determinism tests. What you read in the repository is exactly what the agent is given.
3. **Structured Auditing** — Every agent persona carries a mandatory Audit Log contract (task, inputs, actions, risks, result), and deployments carrying the mark must emit those logs in operation.
4. **Public Governance** — Architectural and governance decisions are recorded publicly in [`docs/DECISION_LOG.md`](DECISION_LOG.md), including the blind-spot and drift records that make the framework's own gaps visible.
5. **Deployment Disclosure** — Any organization deploying a NoéMI Transparent agent must allow its end users to inspect the complete, deployment-specific specification set driving that agent, including any local overlays or modifications to the published specs.

## Usage of the Term

Anyone may use the NoéMI code under the terms of the FSL — no permission needed. However, you may only describe your deployment or architecture as **"NoéMI Transparent"** if it adheres to all five clauses above. Legal rights flow from the FSL; trust and norms flow from the Transparent Source Guarantee. NewPush maintains this definition and is the arbiter of the mark's use.
