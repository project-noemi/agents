# Guardian Layer Documentation

This directory contains the documentation and usage guidelines for the **Guardian Agents** within Project NoéMI.

## What is a Guardian Agent?
Guardian Agents are an implementation of the "Discernment" phase of the 4D AI Fluency Framework. They are supervisory LLM personas designed specifically to monitor, audit, and constrain the outputs of *other* AI agents.

Because AI output is probabilistic, an agent executing a workflow (e.g., summarizing an email) might hallucinate or leak data. A Guardian Agent is a secondary AI whose sole system prompt instructs it to be skeptical, analytical, and strictly enforce security rules.

## Available Guardian Agents

1.  **[PIIGuard](../../../agents/guardian/pii-guard.md)**: Analyzes data payloads for Personally Identifiable Information (PII) before they leave the "Phase 0" security perimeter. Capable of blocking or automatically redacting sensitive data.
2.  **[PromptShield](../../../agents/guardian/prompt-shield.md)**: Analyzes incoming user instructions for prompt injection attacks (e.g., "Ignore previous instructions", "DAN").

## Implementation Pattern (The "Airgap")

Guardian Agents should be deployed within an orchestrator (like n8n) *before* the main agent is executed, creating an architectural airgap.

**Example Flow:**
1.  User submits a prompt.
2.  Orchestrator sends prompt to `PromptShield`.
3.  If `PromptShield` returns `status: BLOCKED`, orchestrator halts and alerts the Accelerator.
4.  If `PromptShield` returns `status: APPROVED`, orchestrator passes the prompt to the main agent (e.g., `ai-architect`).
5.  Main agent generates a response payload.
6.  Orchestrator sends payload to `PIIGuard`.
7.  If `PIIGuard` detects a leaked SSN, it redacts it.
8.  Orchestrator returns the redacted payload to the user.