# Sovereign LLM Guidelines

> **Status:** Architectural guidance for the "Great AI Pivot."
> **Audience:** Engineers, operators, and Accelerators (Pilots) deploying Project NoéMI agents.
> **Scope:** How to run the agent fleet on local, open-source, data-sovereign inference infrastructure without breaking the existing decoupled architecture (Agent Specs, Skills, Operating Profiles, MCP Protocols).

This document explains the infrastructure and governance decisions behind the move toward self-hosted open-source models, and shows how the new artifacts fit together:

| Layer | New Artifact |
|-------|--------------|
| Operating Profile | [`operating-profiles/local-sovereign-profile.json`](../operating-profiles/local-sovereign-profile.json) |
| Skill | [`skills/model-fusion-consensus/definition.json`](../skills/model-fusion-consensus/definition.json) |
| Guardian Agent | [`agents/guardian/jailbreak-monitor-agent.json`](../agents/guardian/jailbreak-monitor-agent.json) |
| MCP Protocol | [`mcp-protocols/local-inference-mcp.json`](../mcp-protocols/local-inference-mcp.json) |

These sovereign artifacts are **additive**. Existing proprietary profiles (Claude, OpenAI, Gemini) remain first-class citizens; the pivot adds a sovereign execution path alongside them rather than replacing them.

---

## 1. Introduction to the "Great AI Pivot"

For most of the early agentic era, the path of least resistance was to route every prompt to a hyperscaler API. That model is convenient, but it concentrates three structural risks that compound as a fleet scales:

- **Data sovereignty risk.** Every prompt, document, and intermediate reasoning step leaves the trust boundary. For regulated workloads (PII, PHI, contractual confidentiality), this turns routine inference into a continuous data-export event. It is difficult to prove that a third party never trained on, cached, or retained sensitive context.
- **Volatility risk.** Proprietary endpoints change pricing, deprecate model snapshots, alter rate limits, and silently adjust safety behavior. An agent fleet tuned against a moving target is brittle: a vendor-side change can break a workflow with no warning and no rollback path.
- **Vendor lock-in.** When orchestration logic, prompt formats, and tool schemas are coupled to a single vendor's SDK, the cost of leaving grows over time. Negotiating leverage erodes, and architectural decisions are made *for* you.

The **Great AI Pivot** is Project NoéMI's deliberate response: shift the center of gravity away from single-vendor hyperscaler reliance and toward **open-source data sovereignty, algorithmic efficiency, multi-model fusion, and advanced Guardian-layer governance.**

In practice this means:

- **Open-source models as the default substrate.** Models such as **DeepSeek** (e.g., `deepseek-coder`) and **Llama** (e.g., `llama3.3`) are self-hosted on owned or leased hardware. Weights are local, inference is local, and logs stay inside the unified logging backend.
- **Algorithmic efficiency over brute scale.** Rather than sending every query to the largest available model, work is routed to the *smallest sufficient* model (see §3). Efficiency becomes an engineering discipline, not a billing surprise.
- **Sovereignty as a governance posture, not a feature flag.** The [`local-sovereign-inference`](../operating-profiles/local-sovereign-profile.json) Operating Profile encodes this: `zero_data_leakage_enforced: true`, prompt logging routed to `loki-unified-logging`, and a hard `max_token_budget_per_run` ceiling.

This aligns directly with the repository's **Fetch-on-Demand** security architecture. The sovereign profile never embeds credentials; it references a vault key (`FETCH_ON_DEMAND_LOCAL_LLM_KEY`) that is resolved at runtime through `infisical run` or `op run`. Even when the model is local, the secret-handling discipline is unchanged.

**Why this is a balanced decision, not an ideological one.** Read through the Value Lens framework, the pivot is not "local good, cloud bad." It is the recognition that the *Performance-Efficiency* lens (ROI, throughput, predictability) and the *Care-Continuity* lens (trust durability, sustainable operations) **co-sustain** only when the organization controls its own inference substrate. The sovereign profile sets `cost_efficiency` and `risk_aversion` to `maximum` while accepting `latency_tolerance: medium` — an explicit, auditable trade-off rather than a hidden one.

---

## 2. Setting up Local Inference via MCP

The newly added [`local-inference-mcp.json`](../mcp-protocols/local-inference-mcp.json) protocol gives agents a **native, SDK-free interface** to self-hosted model runtimes. Instead of importing a proprietary vendor SDK, an agent speaks the Model Context Protocol over `stdio` to a thin gateway that fronts your local **Ollama** or **vLLM** deployment.

### Protocol surface

The protocol exposes two tools:

- **`query_local_llm`** — Sends a prompt to the local gateway. Inputs:
  - `model_name` *(required)* — the cached model tag (e.g., `deepseek-coder:67b-instruct`).
  - `prompt` *(required)* — the user/system prompt payload.
  - `temperature` — defaults to `0.2` for predictable, low-variance output suitable for governed workflows.
  - `max_tokens` — bounds the response length.
- **`check_local_models`** — Lists every open-source model currently cached and running on local hardware. Use this for pre-flight verification: an agent should confirm a model is resident **before** routing work to it, rather than failing mid-task.

### Reference deployment shape

1. **Stand up the runtime.** Run Ollama or vLLM on your inference host(s) and pull the canonical models referenced by the sovereign profile (`deepseek-coder:67b-instruct` primary, `llama3.3:70b-instruct` fallback).
2. **Front it with a gateway.** Expose an OpenAI-compatible endpoint at the internal address declared in the profile (`http://local-inference-gateway.internal:11434/v1`). The gateway is the single network egress point — nothing leaves the internal network.
3. **Wire the MCP.** Register `local-inference-mcp` with the orchestrator so the `query_local_llm` and `check_local_models` tools become available to agents. Resolve the gateway credential at runtime via the vault reference; never write it to disk.
4. **Verify offline behavior.** Because both weights and gateway are internal, agents retain full reasoning capability with **no outbound internet dependency**. This is what makes air-gapped and offline operation reliable rather than aspirational.

### Resilience expectations

Per the repository's error-handling mandates, the MCP integration must degrade gracefully: if the primary model is unavailable, fall back to the declared `fallback_model`; on transient gateway errors, apply exponential backoff (`scripts/resilience_helpers.js` is the canonical reference); and emit a structured audit record to `stderr` for every routing decision so the orchestrator can observe failures.

---

## 3. Hierarchical Model Routing

A single large model for every task is the most expensive and least efficient way to operate. **Hierarchical routing** treats model size as a resource to be allocated, matching task complexity to the smallest model that can do the job well.

### The tiers

- **Tier 0 — Fast classifiers (≈8B class).** Small, high-throughput models handle deterministic, low-ambiguity work: intent detection, language identification, routing decisions, label assignment, format validation, and "is this even in scope?" gating. These run in milliseconds, cost little, and clear the bulk of fleet traffic.
- **Tier 1 — Mid-tier reasoning.** When a request needs structured synthesis but not deep multi-step reasoning, a mid-sized model handles drafting, summarization, and extraction.
- **Tier 2 — Heavy reasoning (≈70B+ class).** Reserved strictly for complex reasoning, architectural judgment, code generation, and final-quality user-facing output. The sovereign profile's `primary_model` (`deepseek-coder:67b-instruct`) and `fallback_model` (`llama3.3:70b-instruct`) live here.

### Why this is the cost-optimization core of the pivot

Routing a categorization decision to a 70B model is like dispatching a freight truck to deliver an envelope. By letting an 8B model decide *whether and where* heavier reasoning is needed, you reserve scarce GPU capacity for the small fraction of requests that genuinely require it. On owned hardware this directly translates into higher effective throughput per GPU-hour — the **algorithmic efficiency** pillar of the pivot.

### Governance interaction

Hierarchical routing is bounded by the Operating Profile. The `max_token_budget_per_run` ceiling (`500000` in the sovereign profile) prevents runaway escalation through the tiers, and every routing hop is logged to `loki-unified-logging` so the path a request took — and the cost it incurred — is fully auditable. The escalation rule is conservative by design: **when a smaller model's confidence is low or the task is ambiguous, escalate to the next tier rather than guessing.** Efficiency must never be purchased at the cost of a wrong answer slipping through.

---

## 4. The Consensus Approach

Single-model output carries two persistent failure modes: **hallucination** (confident fabrication) and **individual model bias** (a systematic blind spot inherited from one model's training). The [`model-fusion-consensus`](../skills/model-fusion-consensus/definition.json) skill mitigates both by refusing to trust any single model as ground truth for high-stakes output.

### How the skill works

The skill executes three steps:

1. **`parallel_query` → `execute_concurrent_llm_calls`.** The same `user_query` is dispatched concurrently to every endpoint in `target_models`. Querying multiple *distinct* models (e.g., a DeepSeek variant and a Llama variant) is deliberate: independent architectures fail in independent ways, so their agreement is more meaningful than a single model's confidence.
2. **`consensus_analysis` → `evaluate_and_judge`.** A dedicated judge model — `local-sovereign-inference`, i.e., the sovereign profile itself — receives the `raw_responses` and reconciles them. The `conflict_resolution_mode` is `majority-consensus`: claims corroborated across models are promoted, while lone-wolf assertions (a strong hallucination signal) are flagged or dropped.
3. **`consolidated_output` → `format_markdown_report`.** The reconciled findings are rendered into a single, human-readable Markdown report, with the `consolidation_style` input controlling tone and depth.

### Why a local judge matters

Using the **sovereign profile as the judge** keeps the entire fusion loop inside the trust boundary. The raw responses — which may contain sensitive context — are never shipped to a third party for adjudication. Consensus, the most context-rich step in the pipeline, is therefore also fully data-sovereign.

### When to invoke it

Consensus is more expensive than a single call (N inference passes plus a judge pass), so reserve it for high-stakes output: factual reports, compliance-sensitive summaries, security findings, and anything a human will act on directly. For routine, low-risk work, hierarchical routing (§3) to a single appropriate-tier model is the correct default. The two strategies compose: routing decides *which* models participate; consensus decides *how much to trust* their collective answer.

---

## 5. Guardian Layer Security & The 1:50 Equilibrium

Local, open-source models remove a vendor dependency — but they also remove the vendor's hosted safety layer. Self-hosting means **you own the guardrails.** That responsibility lands on the Guardian Layer, and specifically on the newly added [`jailbreak-monitor-guardian`](../agents/guardian/jailbreak-monitor-agent.json).

### The jailbreak monitor's mandate

This agent operates in **Phase 0 Security** as an *outbound guardrail and security monitor*. Its sole responsibility is to evaluate the behavior of other Virtual Coworkers — inspecting their prompts and output payloads for signs of:

- **Jailbreaking** — attempts to coax an agent outside its sanctioned role.
- **Prompt injection** — adversarial instructions smuggled in through untrusted data (documents, web content, third-party messages).
- **"Governor removal"** — attempts to disable the native safety constraints that keep an agent within its boundaries. On self-hosted open-weights models, where no vendor safety layer exists, this is the highest-priority threat.

On detection, the monitor takes decisive action: it **revokes the offending agent's MCP credentials** (via the `credential-vault-fetch` subscription) and **logs a high-severity alert** (via `unified-logging-loki`). Containment is immediate and credential-scoped — the compromised agent loses its ability to act, while the rest of the fleet continues uninterrupted.

### The 1:50 Equilibrium

The strategic reason the Guardian Layer is non-negotiable is the **1:50 equilibrium**: a single human manager is expected to supervise on the order of fifty autonomous agents. At that ratio, human-in-the-loop review of every action is impossible — a human cannot read fifty agents' prompt-and-response streams in real time.

The equilibrium only holds if **machine guardians watch the machines**, escalating to the human supervisor *by exception* rather than by default. The `jailbreak-monitor-guardian` is the mechanism that makes the ratio safe:

- **Auditability at scale.** Every inspected payload and every revocation is logged to the unified backend, producing a complete, queryable trail. The human manager supervises through the audit log and high-severity alerts, not by watching live streams.
- **Bounded blast radius.** Credential revocation contains a compromised agent without a fleet-wide shutdown, preserving throughput for the other forty-nine.
- **Sustainable oversight.** Read through the *Care-Continuity* Value Lens, exception-based supervision is what keeps the 1:50 ratio humanly sustainable. Without it, scaling the fleet would simply transfer unbounded review burden onto the human supervisor — trading a compute cost for a hidden human cost. The Guardian Layer is precisely what prevents that demographic debt.

### Defense-in-depth

The jailbreak monitor does not stand alone. It composes with the existing Guardian agents — `PromptShield` (inbound injection defense), `PIIGuard` (data-leakage prevention), and the `pii-scan` skill — to form a layered perimeter. The pivot to sovereign infrastructure *raises* the importance of this layer: when you own the model, you own the safety guarantees, and the Guardian Layer is where those guarantees are enforced and proven.

---

## Summary

The Great AI Pivot reorients Project NoéMI around infrastructure the organization controls. The four new artifacts — a sovereign Operating Profile, a consensus Skill, a jailbreak-monitoring Guardian, and a local-inference MCP — slot into the existing decoupled architecture without disturbing the proprietary profiles that remain available. Together they deliver data sovereignty, algorithmic efficiency through hierarchical routing, hallucination resistance through multi-model fusion, and the Guardian-layer governance required to keep a 1:50 human-to-agent ratio both safe and auditable.
