# Engineering Agents (Documentation)

## Overview
This directory contains documentation for agents specialized in systems architecture, software engineering, and AI systems.

## Personas
- **AI Architect**: Designs and documents the overall Project NoéMI agentic architecture.
  - Spec: `agents/engineering/ai-architect.md`
- **Orchestrator**: Routes Claude Code work across models and native multi-model bridges (Codex, Grok Build).
  - Spec: `agents/engineering/orchestrator.md`
  - Usage guide: [`orchestrator/README.md`](orchestrator/README.md)
  - Grok Build operator guide: [`../../tool-usages/grok-build-claude-code.md`](../../tool-usages/grok-build-claude-code.md)
- **Gatekeeper**: Automated pull-request triage and risk classification.
  - Spec: `agents/engineering/gatekeeper.md`
  - Usage notes: [`gatekeeper/README.md`](gatekeeper/README.md)
