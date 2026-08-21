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
- **Issue Conductor**: Fleet issue-coding loop (triage, plan, plan red-team, dispatch). Product loop is in `coding-loop/`; CLI + Actions host it today. Mastra is optional later.
  - Spec: `agents/engineering/issue-conductor.md`
  - Usage notes: [`issue-conductor/README.md`](issue-conductor/README.md)
  - Architecture: [`../../architecture/issue-coding-loop.md`](../../architecture/issue-coding-loop.md)
