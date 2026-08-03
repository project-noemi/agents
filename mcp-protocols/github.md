#### Overview
This file dictates how agents interact with GitHub using the GitHub CLI (`gh`) and the GitHub REST/GraphQL APIs.

#### 1. Authentication
Always authenticate via environment variable `GH_TOKEN` injected at runtime through vault CLI wrappers (`op run` / `infisical run`). Never store tokens in config files or commit them to the repository.

#### 2. Rate Limit Awareness
Monitor `X-RateLimit-Remaining` headers on every API response. When remaining calls drop below 100, introduce a backoff delay. On `403` or `429` responses, wait for the `X-RateLimit-Reset` timestamp before retrying.

#### 3. Pagination
Always paginate API responses. Use `--paginate` with `gh api` or follow `Link` headers in raw REST calls. Never assume a single page contains all results.

#### 4. Scope Minimization
Request only the scopes and data fields necessary for the current operation. Use GraphQL queries to select specific fields rather than fetching full objects via REST when possible.

#### 5. Audit Trail
Log every mutating API call (merge, close, comment, label) with the full request and response status for traceability. Include the agent identifier in all comments and commit messages.

#### 6. PR Authorship (Machine Identity)
Agent-initiated pull requests MUST be opened under the `noemi-agent` machine identity, never with a human's credentials. GitHub blocks a pull request's author from approving it, so an agent PR opened with the reviewing human's token is unreviewable by that human and collapses the human-reviews-AI gate into an admin bypass (see `docs/MACHINE_IDENTITY.md` — the token that opens the PR is what determines authorship; commit metadata does not).

- Where the `gh` CLI is available, open PRs via `bash scripts/agent-gh.sh pr create ...`.
- In containerized or remote sessions without `gh` (e.g., cloud sandbox containers), use `node scripts/agent-pr.js` — it resolves `AGENT_GH_TOKEN` from process memory and speaks to the REST API directly.
- Both paths verify the token against `AGENT_GH_EXPECTED_LOGIN` and refuse to act if it resolves to any other account, including a human's.
- If no machine-identity token is resolvable, stop and surface the gap to the human. Do **not** fall back to opening the PR with human credentials — a mis-authored PR re-creates the exact failure this rule exists to prevent.
- Approving and merging remain human-only acts. The machine identity may do neither (identity register, `docs/MACHINE_IDENTITY.md`).
