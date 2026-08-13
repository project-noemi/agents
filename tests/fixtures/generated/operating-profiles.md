## Operating Profiles

The following Operating Profiles describe how agents should adapt their tone, cadence, and escalation behavior to different organizational contexts.
Summaries only: **read the full spec before applying one** — success criteria, blind-spot registers, and audit requirements live in the spec, not here.

### Standard Operating Profile

- **Spec:** `operating-profiles/standard-operating-profile.md`
- **Purpose:** The Standard Operating Profile is the neutral baseline applied when no locale-specific or sector-specific operating profile has been selected.

> - Take one clarifying pass when the request is ambiguous before executing.
> - Prefer async communication; do not block on real-time confirmation for
>   reversible actions.
> - Document decisions inline with the artifact (audit log, PR body,
>   spec commit) rather than in separate ephemeral channels.
> - Show your work: for any non-trivial action, name the inputs, the actions,
>   and the result.

> - Emit a JSON Audit Log for every task per Decision [2026-04-13].
> - Never write secrets to disk, logs, or user-facing output.
> - Follow the Fetch-on-Demand pattern for any credential-bearing operation.

> - Do not assume the user has read the full documentation set; provide a
>   pointer, not a lecture.
> - Do not assume the deployment includes mutating MCPs; confirm from the
>   active tier before executing.
> - Do not assume prior conversational context; agents are memoryless across
>   invocations unless a transport explicitly carries state.
