# Orchestration Skills

Skills for coordinating work across multiple agents.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Dispatch & Coordinate](../../../skills/orchestration/dispatch-coordinate.md) | Delegate tasks to sub-agents and aggregate outputs | Video Content Manager |

## Pattern

Orchestration skills manage the lifecycle of multi-agent tasks:
1. Prepare shared context for all sub-agents
2. Resolve execution dependencies (parallel where possible)
3. Dispatch work with agent-specific instructions
4. Validate cross-agent consistency
5. Aggregate outputs into a unified deliverable
