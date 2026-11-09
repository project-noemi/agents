<!--
  org/example/AGENTS.md: configuration layer TEMPLATE.

  Copy this file to org/<your-org>/AGENTS.md (an MSP/MSSP layer) or to
  org/<customer>/AGENTS.md (a customer layer), replace the example rules with
  your own, and add the path to AGENTS.layers. Guide:
  docs/configuration-layers.md.

  How a layer is read:
  - It loads AFTER the upstream AGENTS.md and after every layer listed above it
    in AGENTS.layers. On conflict, this layer wins over everything loaded
    before it. AGENTS.local.md, if present, still wins over this layer.
  - Write deltas, not a copy of the baseline. Restating upstream rules makes
    the next upstream change look like a conflict.
  - When you replace an upstream rule, say so in "Overrides of earlier layers"
    so agents (and reviewers) do not have to guess which rule applies.
  - Baseline rules that compliance tracks carry a stable ID in AGENTS.md
    (an HTML comment of the form "rule: secrets.no-hardcode").
    Core rules (secrets.*, refusal.*) cannot be relaxed by any layer: you may
    clarify or tighten them, never loosen them, and there is no waiver.
    Preference rules (tagged "(preference)") may be replaced. Put an HTML
    comment of the form "override: <rule-id> relax" (or clarify / tighten) on
    the line with the replacement text; the entries below show the syntax.
    `npm run audit` checks this layer:
      - any attempt to relax a core rule, by marker or by wording: FAIL
      - relaxing a preference rule: WARN
      - clarify / tighten: PASS
    Agents also ignore layer text that would loosen a core rule.
  - Never put secrets, tokens, customer PII, or internal hostnames that are
    themselves sensitive in a layer. Reference vault paths or SecretOps
    project names instead.
  - Keep it short. Every layer is loaded into every session, and Codex stops
    reading instructions at project_doc_max_bytes (32 KiB by default).
  - Paths in this file are relative to the repository root. If you add
    `@path` imports here, Claude Code and Gemini CLI resolve them relative to
    this file's directory.

  These HTML comments are guidance for maintainers. Claude Code strips them
  before loading; other tools may still see them.
-->

# Example organization layer

**Layer:** example organization (template). **Owner:** the organization's platform or AI enablement team. **Scope:** every repository and agent session that lists this file in `AGENTS.layers`.

## Organization context

<!-- One or two sentences an agent needs in every session. -->
- This repository is the organization's working copy of Project NoéMI. Upstream rules in `AGENTS.md` still apply unless this layer replaces them below.
- Primary audience for generated artifacts: the organization's service desk and engineering staff.

## Change control

- Every pull request links its tracking ticket in the PR body (`Ticket: <system>-<id>`). Agents that cannot find a ticket ask for one instead of opening the PR.
- Changes that alter customer-facing behaviour, data retention, or access control need a named human approver in the PR description before review is requested.
- Agents never merge, approve, or force-push. Humans merge.

## Branches and commits

- Keep the upstream `<type>/<area>-<slice>` branch format. Add the organization prefix to `<area>` when a change is organization-specific, for example `feat/example-helpdesk-routing`.
- Commit messages follow Conventional Commits, as upstream does.

## Tooling and registries

- Install Node.js packages from the organization's internal registry mirror when one is configured (`npm config get registry` shows it). Do not add public registries to project config files.
- Container images come from the organization's approved registry list. A new base image needs a ticket.

## Data handling

- Treat ticket bodies, mailbox content, and RMM/PSA exports as confidential. Summaries may leave the session; raw content may not be pasted into issues, PRs, or chat.
- Customer identifiers in logs and audit records are pseudonymised (tenant slug, not company name).

## Secrets

- Secrets resolve at runtime from the organization's vault project through `infisical run` or `op run`, exactly as the baseline requires. This layer only names where to look: the SecretOps project for this repository is recorded in the repository README, never in this file. <!-- override: secrets.fetch-on-demand clarify -->

## Escalation

- Security-relevant findings (exposed credential, suspicious access, failed safety gate) go to the organization's security on-call channel named in the README, and stop the current task.
- Ambiguous instructions between layers: stop and ask the human operator; do not pick one silently.

## Overrides of earlier layers

<!--
  List every upstream (or MSP) rule this layer replaces, with the replacement.
  Leave the list empty rather than deleting the section, so agents can see
  that nothing is overridden. Mark each entry with its rule ID. Example entry
  (a preference rule, so compliance reports it as WARN):
-->
- Replaces upstream "AI Model Baseline" for this organization's interactive sessions only: use the model routing configured by the organization's gateway. Reference workflows, lab examples, and smoke tests keep the upstream pin. <!-- override: coding.model-baseline relax -->
