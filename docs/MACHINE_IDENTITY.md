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

### Effective-permission caveat

The direct collaborator grant is `push` (write), but GitHub resolves a user's
access as the **highest** of all grants. `noemi-agent` is an organization member
of the `developers` team, which holds `maintain` on this repository, so its
effective permission is `maintain` — broader than this register intends.

`maintain` cannot change branch protection, manage secrets, or add
collaborators (`admin: false`), so it cannot bypass the review gate. It can,
however, adjust repository settings and delete branches.

To hold the identity at true least privilege, remove it from the `developers`
team and rely on the direct `push` grant:

```bash
gh api --method DELETE orgs/project-noemi/teams/developers/memberships/noemi-agent
gh api repos/project-noemi/agents/collaborators/noemi-agent/permission --jq .permission
```

Verify effective access after any org or team change — a team grant added later
will silently widen this identity again.

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

Branch protection currently runs with `enforce_admins: false` on `main` and
`develop`, which is what permits an admin bypass merge. That was the only way to
land a human-authored agent PR while this gap existed.

Once agent PRs are reliably bot-authored, close the bypass:

```bash
gh api --method PATCH repos/project-noemi/agents/branches/develop/protection/enforce_admins
gh api --method PATCH repos/project-noemi/agents/branches/main/protection/enforce_admins
```

Do **not** enable this before the machine identity is working. With
`enforce_admins: true` and no bot identity, every agent PR becomes unmergeable
and admins have no escape hatch.

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
    "enforce_admins remains false until bot authorship is verified"
  ],
  "result": "Producer and reviewer identities separated; approval gate enforceable"
}
```
