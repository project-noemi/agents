# Machine Identity for Agent-Authored Pull Requests

## Why this exists

Project NoéMI's review model is **humans review AI work**. That is the operative
4D Diligence control and the Accelerator (Pilot) responsibility described in
`METHODOLOGY.md`: a human authorizes what an agent produced.

GitHub blocks a pull request's author from approving it. So when an agent opens a
PR using a human's credentials, the PR is authored by that human, and the control
collapses into one of two non-controls:

| Situation | Outcome |
|---|---|
| Human tries to approve their "own" agent PR | Impossible — GitHub refuses |
| Human admin-bypasses the gate to merge it | No review happened at all |

Neither is review. The fix is to give agent-initiated writes a **distinct
identity** so producer ≠ reviewer, which makes `required_approving_review_count`
enforceable and restores `.github/CODEOWNERS` as a real control.

### The trap: commit metadata is not authorship

`git config user.email` and `Co-Authored-By:` trailers change who *wrote the
commits*. GitHub's self-approval check looks only at who *opened the PR* — the
identity of the token that called `POST /repos/{owner}/{repo}/pulls`. Changing
commit metadata alone does **not** unblock review. Only the token matters.

## Identity register

Recorded here to satisfy the Phase Zero baseline requirement that machine
identities have named owners (`docs/phase-zero-assessment/weighted-assessment-spec.md`
**S1.3**) and are scoped to least privilege
(`docs/PHASE_ZERO_SECURITY_BASELINE.md`).

| Field | Value |
|---|---|
| **Identity** | `noemi-agent` (GitHub user, machine account) |
| **GitHub user ID** | `311935378` |
| **Status** | **Provisioned** 2026-08-02 |
| **Purpose** | Open branches and pull requests on behalf of AI agents |
| **Named owner** | `@WSwarm` (Balazs Nagy) |
| **Credential type** | Fine-grained personal access token |
| **Credential store** | Infisical — secret `AGENT_GH_TOKEN` |
| **Repo permission** | `write` on `project-noemi/agents` |
| **Rotation** | 90 days, or immediately on suspected exposure |
| **First rotation due** | 2026-10-31 |
| **May approve PRs?** | **No.** Approval is a human-only act |
| **May merge PRs?** | **No.** Merge follows human approval |

### Reviewer identity — `noemi-reviewer`

Separation of duties needs two identities, not one. `noemi-agent` produces;
`noemi-reviewer` reviews. A shared account fails mechanically (GitHub blocks
self-approval) and destroys attribution even where it does not fail.

| Field | Value |
|---|---|
| **Identity** | `noemi-reviewer` (GitHub user, machine account) |
| **GitHub user ID** | `312384097` |
| **Status** | **Provisioned** 2026-08-03, capabilities verified |
| **First rotation due** | 2026-11-01 |
| **Purpose** | Post three-gate review findings on agent-authored PRs |
| **Model family** | Gemini — deliberately *not* Claude (see below) |
| **Named owner** | `@WSwarm` (Balazs Nagy) |
| **Credential store** | Infisical — secret `REVIEWER_GH_TOKEN` |
| **Repo permission** | `read` (pull) + `Pull requests: write` |
| **Rotation** | 90 days, or immediately on suspected exposure |
| **May author code?** | **No.** `Contents: read` only — enforced by token |
| **May approve PRs?** | **No** in phase 1 — enforced by CODEOWNERS, not by token |

Cross-model is the point: two instances of one model share training and blind
spots, so a misreading made while writing is likely repeated while reviewing.
See `docs/AI_REVIEW_GOVERNANCE.md`.

#### Least-privilege scoping

| Permission | Level | Why |
|---|---|---|
| Contents | **Read** | Read the diff. Not write — a reviewer that can push can fix what it reviews, collapsing the separation |
| Pull requests | Read and write | Post review comments |
| Metadata | Read | Mandatory for fine-grained tokens |

`Contents: read` is a real, token-enforced boundary: this identity is
structurally incapable of authoring code.

#### Verified capabilities (2026-08-03)

Probed at provisioning. Re-run these after any token rotation — a rotation is
the most likely moment for scoping to drift wider than intended.

| Probe | Expected | Observed |
|---|---|---|
| Read repository metadata | succeeds | ✅ succeeded |
| Create a git ref (Contents: write) | **denied** | 🔒 `403 Resource not accessible` |
| Create a PR review (Pull requests: write) | permitted | `404` on a nonexistent PR — permission present |

The `403` on ref creation is the boundary that matters: it is enforced by token
scoping, not by persona instruction, so it holds regardless of what the
reviewing model is told or persuaded to do.

On the third probe, `403` would mean the permission is missing and `404` means
it is present but the pull request does not exist — a nonexistent PR number is
therefore a non-destructive way to confirm write capability without posting
anything.

#### The comment-vs-approve gap

GitHub has **no permission distinguishing "may comment on a PR" from "may
approve a PR."** Both are `Pull requests: write`. So the phase-1 rule that the
reviewer posts findings but never approves cannot be enforced by token scoping.

It is enforced structurally instead, by `.github/CODEOWNERS` plus
`require_code_owner_reviews`: a reviewer approval never satisfies a code-owner
requirement, because the reviewer is not an owner. Without that, a
`noemi-reviewer` approval would satisfy `required_approving_review_count: 1` on
its own and phase 1 would silently behave as phase 2.

#### Provisioning

Same shape as `noemi-agent` above — register the account with 2FA, mint a
fine-grained PAT **while signed in as `noemi-reviewer`** scoped to
`project-noemi/agents` with exactly the three permissions above, then:

```bash
infisical secrets set REVIEWER_GH_TOKEN="<paste-in-your-terminal>" --env=dev

gh api --method PUT repos/project-noemi/agents/collaborators/noemi-reviewer \
  -f permission=pull
```

Watch for the org approval hold that delayed `noemi-agent`: a fine-grained token
against an org resource owner stays read-only until an owner approves it at
Settings → Third-party Access → Personal access tokens.

Verify without provisioning a new wrapper — `scripts/agent-gh.sh` is already
parameterized:

```bash
AGENT_GH_TOKEN_SECRET=REVIEWER_GH_TOKEN \
AGENT_GH_EXPECTED_LOGIN=noemi-reviewer \
bash scripts/agent-gh.sh whoami        # expect: noemi-reviewer (User)
```

⚠ `$AGENT_GH_TOKEN` takes precedence over `AGENT_GH_TOKEN_SECRET` in the
resolver, so a producer token already in the environment wins silently. The
`AGENT_GH_EXPECTED_LOGIN` guard catches this and refuses rather than acting
under the wrong identity — always set it.

### Effective-permission posture — the token is the boundary

GitHub resolves a user's access as the **highest** of all grants. Both bot
identities are organization members of the `developers` team, which holds
`maintain` on this repository, so both resolve to `maintain` regardless of the
direct collaborator grants recorded above (`push` for the producer, `pull` for
the reviewer).

**Decision (2026-08-03, repository owner): the bots remain in `developers` and
`coders`.** The team memberships are accepted as-is and the account-level
permission is not narrowed.

`maintain` cannot change branch protection, manage secrets, or add collaborators
(`admin: false`), so it cannot bypass the review gate. It can adjust repository
settings and delete branches.

#### What this decision means

Account-level permission is **not** a limiting factor for these identities.
Every constraint in this register is therefore enforced by **token scoping
alone** — it is the boundary, not a second layer behind one. The reviewer's
inability to author code is real (verified `403`) precisely and only because its
token lacks `Contents: write`.

Three rules follow, and they are load-bearing rather than advisory:

1. **Fine-grained tokens only. Never a classic PAT.** A classic token with
   `repo` scope on either account inherits the full `maintain` grant and
   silently voids every scoping decision in this document. Classic tokens have
   no per-permission granularity, so there is no safe way to issue one here.
2. **Re-probe capabilities after every rotation.** Rotation is when scoping
   drifts wider than intended. See the reviewer's verified-capabilities table
   for the probe set.
3. **Never widen a token to clear a failure.** A `403` from one of these
   identities is the control functioning. Diagnose what asked for the
   permission before granting it.

An organization or team change can still widen these identities without touching
this repository. Re-verify effective access after any such change:

```bash
for u in noemi-agent noemi-reviewer; do
  gh api "repos/project-noemi/agents/collaborators/$u/permission" --jq '"\(.user.login): \(.role_name)"'
done
```

A machine *user* consumes a paid seat on the Enterprise plan. This is the
accepted cost of having a bot identity that can be a PR author.

## Least-privilege token scoping

Create a **fine-grained** PAT (not classic), scoped to the single repository:

| Permission | Level | Why |
|---|---|---|
| Contents | Read and write | Push agent branches |
| Pull requests | Read and write | Open and update PRs |
| Metadata | Read | Mandatory for fine-grained tokens |
| Workflows | *Read and write — only if needed* | See caveat below |

**Workflows caveat.** Without `Workflows: write`, any push whose diff touches
`.github/workflows/**` is rejected outright. Granting it lets agents modify CI —
including the `require-develop-source` merge gate, which
`.github/CODEOWNERS` deliberately restricts to owner review precisely because
automation edited that gate during 2026-07 to unblock its own PRs
(Decision [2026-08-01-0002]).

Prefer to **leave `Workflows` unchecked**. Let workflow changes fail loudly and
be made by a human. Grant it only if you accept that CODEOWNERS review is the
sole remaining guard on CI definitions.

Do **not** grant: Administration (branch protection), Secrets, Actions
variables, or any organization-level permission.

## Provisioning runbook

Steps 1–3 require a human. They cannot be delegated to an agent, because an
agent creating its own credential defeats the separation this document exists to
establish.

### 1. Create the machine account

Register `noemi-agent` on GitHub with a mailbox the owner controls (a distribution
or alias address, not a personal inbox) and enable 2FA. Set the profile name to
something unmistakably non-human, e.g. `NoéMI Agent (bot)`.

### 2. Mint the fine-grained token

Signed in **as `noemi-agent`**: Settings → Developer settings → Personal access
tokens → Fine-grained tokens → Generate new token.

- Resource owner: `project-noemi`
- Repository access: **Only select repositories** → `project-noemi/agents`
- Permissions: exactly the table above
- Expiration: 90 days

### 3. Store the token in Infisical

Never paste the token into a chat session, a file, or a commit
(`CLAUDE.md` → Mandatory Security Rules).

```bash
infisical secrets set AGENT_GH_TOKEN="<paste-in-your-terminal>" --env=dev
```

Verify it resolves without printing it:

```bash
bash scripts/agent-gh.sh whoami     # expect: noemi-agent (User)
```

`.infisical.json` is gitignored (org-specific — each clone runs `infisical
init`), so a fresh clone or a CI job has no project link and secret lookup fails.
Set the project ID explicitly where running `init` is not practical:

```bash
export INFISICAL_PROJECT_ID=<your-workspace-id>
```

A project ID is not a secret. In GitHub Actions it belongs in **Variables**, not
Secrets — putting non-secrets in Secrets makes it harder to see what genuinely
needs protecting.

### 4. Grant repository access

Run as a repo admin:

```bash
gh api --method PUT repos/project-noemi/agents/collaborators/noemi-agent \
  -f permission=push
```

`push` is `write` — enough to open PRs, insufficient to change protection.

### 5. Pin the expected identity

Add to your shell profile or the project env so the wrapper refuses to act if
the token ever resolves to a human account:

```bash
export AGENT_GH_EXPECTED_LOGIN=noemi-agent
```

## Usage

```bash
# Open an agent PR under the machine identity
bash scripts/agent-gh.sh pr create --base develop \
  --title "fix(scope): subject" --body "..."

# Verify which identity a token resolves to
bash scripts/agent-gh.sh whoami
```

Agents push branches and open PRs through this wrapper. Humans then review and
merge with their own credentials — the separation is the point.

## Re-tightening after rollout

`main` is configured with `enforce_admins: true` and empty PR bypass allowances
via `scripts/setup-branch-protection.sh`: no direct pushes and no admin/bot
bypass of the promotion PR path. That is intentional — promotion is only through
a `develop` → `main` PR with required `check-source-branch` (and validate)
checks. Approvals on main default to zero (`MAIN_REQUIRE_APPROVALS=0`) because
review already happened on `develop`.

`develop` still runs with `enforce_admins: false` so humans can land exceptional
integration fixes if needed; day-to-day agent work still goes through bot-authored
PRs into `develop` with a human approval.

To re-apply the full policy (including enabling repository auto-merge):

```bash
bash scripts/setup-branch-protection.sh
# optional one-approval gate on the release PR only:
MAIN_REQUIRE_APPROVALS=1 bash scripts/setup-branch-protection.sh
```

Do **not** turn `enforce_admins: true` on `develop` until agent PRs are reliably
bot-authored. With that flag and no bot identity, every agent PR into `develop`
becomes unmergeable and admins have no escape hatch.

## Rotation and revocation

- **Rotate** every 90 days: mint a new token as `noemi-agent`, update the
  Infisical secret, confirm with `agent-gh.sh whoami`, then delete the old token.
- **Revoke immediately** if a token appears in logs, a commit, a chat
  transcript, or CI output. Revoking is safe — it only stops agents from opening
  PRs; it cannot affect merged history.
- **Audit** what the identity did: `gh search prs --author=noemi-agent --repo project-noemi/agents`

## Audit Log

```json
{
  "task": "Provision machine identity for agent-authored pull requests",
  "inputs": ["repo: project-noemi/agents", "identity: noemi-agent"],
  "actions": [
    "created fine-grained PAT scoped to single repo",
    "stored credential in Infisical as AGENT_GH_TOKEN",
    "granted write (push) permission on repository"
  ],
  "risks": [
    "machine user consumes a paid Enterprise seat",
    "Workflows:write would let agents edit the merge gate — left ungranted",
    "main enforce_admins is true (no direct push/bypass); develop remains false until bot path is the only integration path"
  ],
  "result": "Producer and reviewer identities separated; approval gate enforceable"
}
```
