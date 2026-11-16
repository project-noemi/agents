# Codebase as Memory + Correction Hierarchy Guide

Treat the codebase as the primary persistent memory for agents. Encode decisions, rules, and constraints into the code, types, and structure rather than relying solely on prose.

## Correction Hierarchy

When correcting an agent (or yourself), prefer in this order:

1. **Codebase / invariants / types** — make the bad thing impossible or hard.
2. **Static analysis** (lint, compiler, CI) — catch issues automatically.
3. **Rules / bugbot** (AGENTS.md, layered rules).
4. **Skills** — teach the correct procedure.
5. **Style guide** — soft preferences.

## Benefits

- Agents copy good patterns instead of anti-patterns.
- Reduces token usage and hallucination risk.
- Compounds trust over time.

Integrate with existing NoéMI AGENTS.md, configuration layers, and Guardian agents.

_Draft guide — expand with examples of turning feedback into enforceable checks._
