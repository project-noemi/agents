# Agent-Friendly Architecture Guide

This guide shows how to structure your repository and codebase so that AI agents can navigate, understand, and extend it effectively with minimal context.

## Key Principles from High-Trust Agent Work

- Make process boundaries visible in the repository tree.
- Ensure the easiest/shortest path is the correct path for agents.
- Use the codebase itself as durable memory (minimal always-on context).
- Clean anti-patterns so agents do not copy them.

## Implementation Steps

1. Organize directories to reflect process/feature boundaries.
2. Enforce import boundaries and strong invariants via types and structure.
3. Co-locate related code so agents find related files easily.
4. Document the structure in AGENTS.md or on-demand skills.

See related: [Codebase as Memory](codebase-as-memory.md), AGENTS.md, configuration layers.

_This is a draft implementation guide. Expand with concrete examples from your codebase._
