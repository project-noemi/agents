# High-Quality Verification Skills Guide

Build portable skills (SKILL.md) that teach agents real software engineering practices so they can verify their own work.

## Inspired By

- pstack-style engineering loops (understand → design → build → verify → ship → learn)
- Chrome DevTools Protocol / Control Glass for UI and performance verification
- Standardized verification harnesses that all agents use
- Feature maps for complete user-flow coverage

## How to Create a Verification Skill

1. Define a single, reproducible verification command or process.
2. Make it CLI-first and evidence-based (logs, traces, screenshots).
3. Integrate with NoéMI skills format and skills-dist/.
4. Require verification evidence before marking a task done.

This enables fearless parallelism once trust is established.

_Draft — add concrete SKILL.md examples and integration with existing coding-loop._
