# NoeMI System Map

This is the primary architecture visual for the repository.

It shows the major layers in the order most people need to understand them.

```mermaid
flowchart TD
    phase0["Phase 0 Security\nIdentity, data perimeter, secrets, readiness"]
    people["Human Roles\nExplorers, Practitioners, Accelerators"]
    personas["Agent Personas\nRole, mission, workflow, audit log"]
    skills["Skills\nReusable task recipes"]
    mcps["MCP Protocols and Integrations\nGoogle Workspace, Microsoft 365, Slack, GitHub, n8n, web"]
    clients["Agentic Clients and Orchestrators\nGemini CLI, Antigravity, Claude Code, Codex, n8n"]
    profiles["Operating Profiles\nLocale, subregion, sector, audience"]
    lenses["Value Lenses\nPerformance-efficiency, care-continuity, balanced-enterprise"]
    runtime["Runtime Execution\nPrompts, approvals, retries, human review"]
    governance["Governance and Guardian Layer\nTRiSM, red teaming, diligence, refusal principle"]
    audit["Audit, ROI, and Observability\nLogs, dashboards, decision traces, ROI"]

    phase0 --> people
    people --> personas
    personas --> skills
    skills --> mcps
    mcps --> clients
    clients --> runtime
    profiles --> runtime
    lenses --> runtime
    runtime --> governance
    governance --> audit
    phase0 --> governance
```

## Read It Like This

- **Phase 0 Security** is the precondition, not a later add-on.
- **Personas, skills, and MCPs** define what agents are allowed to do and how they do it.
- **Clients and orchestrators** are the runtime surfaces that consume this repository.
- **Operating profiles** adapt work to local culture.
- **Value lenses** adapt how success and tradeoffs are judged.
- **Governance, audit, and ROI** make the system reviewable and enterprise-safe.
