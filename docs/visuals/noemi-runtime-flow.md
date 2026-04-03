# NoeMI Runtime Flow

This visual shows how one real task moves through the system once the architecture is in place.

```mermaid
sequenceDiagram
    participant H as Human Operator
    participant C as Agentic Client
    participant P as Persona and Skills
    participant O as Operating Profile
    participant V as Value Lens
    participant M as MCP Tools
    participant G as Guardian and Governance
    participant A as Audit and ROI

    H->>C: Submit goal, constraints, and context
    C->>P: Load persona, workflow, and skills
    C->>O: Apply local execution overlay when needed
    C->>V: Apply explicit success and tradeoff lens
    P->>M: Execute through MCP protocols and integrations
    M-->>P: Return data, actions, or errors
    P-->>C: Produce draft result or recommendation
    C->>G: Run policy checks, diligence, and review gates
    G-->>H: Escalate if blocked, risky, or ambiguous
    G-->>C: Approve or require revision
    C->>A: Emit audit summary, observability events, and ROI evidence
    C-->>H: Deliver final output or handoff package
```

## What This Clarifies

- the client is the execution surface, not the repository itself
- operating profiles and value lenses are overlays, not replacements for the persona
- governance and audit happen around execution, not only after the fact
