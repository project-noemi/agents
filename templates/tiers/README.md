# Service Tier Templates

This directory holds reusable tier templates consumed by the `Client Onboarding`
agent (`agents/operations/client-onboarding.md`) and downstream provisioning
workflows.

Unlike `clients/` (which holds tenant-specific runtime state and is git-ignored),
this directory is **tracked normally** because the tier templates themselves
are part of the reference architecture: they document what each service tier
includes, what MCPs/skills it provisions, and what onboarding checks it runs.

## Status

Tier templates have not yet been authored. Persona specifications reference
this directory; this README confirms the path exists so orchestrators can mount
or read it without error, and so contributors know where to add tier files
(e.g., `basic.md`, `standard.md`, `premium.md`) when ready.

## Decision Reference

- `docs/DECISION_LOG.md` → [2026-05-28-0002] Onboarding and Configuration
  Directory Bootstrap.

## Related Clarifications

- `docs/CLARIFICATIONS.md` Q [2026-04-04] Onboarding Directory Drift (resolved).
