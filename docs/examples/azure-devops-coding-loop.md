# Azure DevOps coding loop: operator guide

This guide runs the issue coding loop on Azure DevOps Boards and Repos. A new
work item starts an Azure Pipelines run. The run classifies the item, posts a
plan comment as the conductor and, when you enable it, has the producer open a
pull request.

The pipeline is a **host**. It decides when the loop starts and which
credentials the loop gets. Every verdict, the requester check and the identity
split live in `coding-loop/run.js`. See
[Product loop vs orchestration host](../architecture/issue-coding-loop.md#product-loop-vs-orchestration-host)
and the [coding loop README](../../coding-loop/README.md).

Template: [`templates/ci/azure-pipelines/coding-loop.yml`](../../templates/ci/azure-pipelines/coding-loop.yml).
It mirrors the GitHub Actions host `.github/workflows/coding-loop.yml`.

## Prerequisites

- An Azure DevOps organization with Boards and Repos, and rights to create
  service connections, service hooks, variable groups and pipelines in the
  project. Adding members to the organization needs Project Collection
  Administrator.
- An Entra ID tenant where you can register applications, and an Azure
  subscription for the two Azure Resource Manager service connections. The
  service principals need no Azure role on that subscription.
- An Azure Key Vault for the loop's secrets.
- A read-only GitHub service connection to check out `project-noemi/agents`.
- Node.js 24 on the agent. The template installs it with `UseNode@1`.

Do not use personal access tokens (PATs) for the pipeline. Global PATs stop
working on 2026-12-01. For local development, an organization-scoped PAT is
acceptable.

## 1. Create two Entra applications: conductor and producer

The loop uses two identities, and they must be different service principals:

| Role | Example name | Does |
|---|---|---|
| Conductor | `noemi-conductor` | Reads work items, posts comments, sets tags/state |
| Producer | `noemi-agent` | Pushes the branch, opens the pull request |

1. Register each app in Entra ID (**App registrations > New registration**).
   Make it **multi-tenant** ("Accounts in any organizational directory") if
   client organizations will use it.
2. Do not create client secrets. Both apps authenticate through workload
   identity federation from the pipeline (step 4).
3. Record each app's **Enterprise application object id** (the service
   principal). You need it to add the app to Azure DevOps.
4. Record the producer's Azure DevOps identity GUID once it is added to the
   organization (step 2). This is `ADO_AGENT_EXPECTED_ID`. Without it the CLI
   refuses every producer write.

Never use the pipeline's own `System.AccessToken` (the Project Collection
Build Service) as the conductor or the producer. It would collapse the
identity split, and the loop treats the Build Service as a bot author and
skips its items.

## 2. Add both service principals to the organization

In **Organization settings > Users > Add users**, add each service principal
by its Enterprise application object id.

- Access level: **Basic**. Stakeholder has no Repos access, so the producer
  cannot push with it.
- Project: the project the loop serves.
- Conductor: Contributor on Boards is enough. Do not grant it Repos write.
- Producer: Contribute and Create branch on the target repository, and
  **View builds** (Build read, `vso.build`) in the project. Before it
  commits a `.yml` or `.yaml` file, the provider lists the repository's
  build definitions and refuses (`pipeline-yaml`) to edit any pipeline
  YAML they run, or a `template:` file those include. Without build read
  the lookup fails and every YAML change is refused
  (`pipeline-lookup-failed`). Do not grant it Bypass policies.

## 3. Create the requester group

Only members of one Azure DevOps group may trigger a run.

1. In **Project settings > Permissions**, create a group such as
   `NoéMi Requesters`.
2. Add the people allowed to start runs.
3. Set `ADO_REQUESTER_GROUP` to the group's display name (step 5).

The CLI reads the work item author from the API (`--requested-by-author`) and
checks membership. The service hook payload carries no identity descriptor,
and `System.CreatedBy` in the payload is a display string, so the pipeline
never uses it.

Any project member, Stakeholders included, can edit another person's work
item. So the CLI also reads the item's edit history: everyone who set or
changed the title, Description, Repro Steps or Acceptance Criteria must be
the author or a member of the requester group. Otherwise the item is
refused (`body-edited-by-non-requester`).

## 4. Create the service connections

All under **Project settings > Service connections**.

| Connection | Type | Template name |
|---|---|---|
| Conductor | Azure Resource Manager, **workload identity federation** | `noemi-conductor-wif` |
| Producer | Azure Resource Manager, **workload identity federation**, a different app | set in `NOEMI_PRODUCER_CONNECTION` |
| Tooling | GitHub, read-only | `noemi-github-readonly` |
| Trigger | Incoming WebHook, **with a secret** | `noemi-workitem-created` |

For each workload identity federation connection, choose the manual setup and
point it at the matching app registration from step 1. Each connection adds a
federated credential to its app. The pipeline then mints an Azure DevOps
token with
`az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798`
and stores it as a secret variable.

The Incoming WebHook endpoint is **unauthenticated** unless the connection
has a secret. With a secret set, Azure DevOps checks the HMAC-SHA1 signature
header on each request. Set a long random secret and record the header name
you choose. Never wire the template to a connection without a secret.

The pipeline YAML cannot see whether the connection has a secret, so you
attest it. Webhook-triggered runs fail in **Validate inputs** unless the
plain variable `CODING_LOOP_WEBHOOK_HMAC_CONFIRMED` is exactly `true`
(step 5). Before you set it:

1. Open **Project settings > Service connections**, select the Incoming
   WebHook connection (`noemi-workitem-created`) and choose **Edit**.
2. Check that **Secret** is filled in and **Http Header** names the
   signature header (for example `X-Hub-Signature`). The secret is masked;
   if you cannot confirm it was set, enter a new one and update the service
   hook (step 6) with the same value.
3. Check that the service hook's HTTP header (step 6) names the same header.
4. Optional: send a request to the webhook URL without the header, or with
   a wrong signature. No run should start.

Re-check after anyone edits the connection. Manual runs (a person queued the
pipeline) do not need the attestation.

Add an **Exclusive Lock** check on the conductor connection. Azure Pipelines
has no per-item concurrency group, so this serializes runs. The template also
sets `lockBehavior: sequential` so queued runs wait instead of being
cancelled.

## 5. Create the variable groups

A variable group linked to Azure Key Vault can hold only vault secrets, so
the template uses two groups (**Pipelines > Library > + Variable group**).

**`noemi-coding-loop-secrets`**, linked to Azure Key Vault ("Link secrets
from an Azure key vault as variables"). Secrets stay in the vault and are
fetched at run time (Fetch-on-Demand). Key Vault names allow no underscores,
so the template maps the dashed names to the environment names the CLI reads:

| Key Vault secret | Environment name | Meaning |
|---|---|---|
| `AI-GW-API-TOKEN` | `AI_GW_API_TOKEN` | AI gateway key for the planner, critic and writer |
| `NOEMI-CLIENT-REGISTRY` | `NOEMI_CLIENT_REGISTRY` | Client registry JSON (NewPush-run pipelines only) |

**`noemi-coding-loop`**, plain variables:

| Variable | Meaning |
|---|---|
| `ADO_AGENT_EXPECTED_ID` | Producer identity GUID |
| `ADO_REQUESTER_GROUP` | Requester group display name |
| `CODING_LOOP_REPO` | `org/project/repo` the pipeline serves |
| `CODING_LOOP_BUDGET_OK` | `true` asserts budget capacity |
| `CODING_LOOP_LIVE_CRITIC` | `true` runs the live Gemini critic |
| `CODING_LOOP_WEBHOOK_HMAC_CONFIRMED` | `true` attests the Incoming WebHook connection has a secret (step 4); webhook runs fail without it |

Both switches fail closed. Any value other than `true` means no
`--budget-ok` (the CLI then refuses the item) and no `--live-critic`.
Setting `CODING_LOOP_LIVE_CRITIC=true` without `AI_GW_API_TOKEN` fails the
run instead of silently falling back.

**Alternative: Infisical.** If the project uses Infisical, install the CLI on
a self-hosted agent and wrap the run step in `infisical run --env=prod --`
with a machine identity. Do not do both; pick one secret source.

## 6. Create the service hook

In **Project settings > Service hooks > + Create subscription**, choose
**Web Hooks**.

- Event: **Work item created** (`workitem.created`) only. The loop's own
  comments and field edits fire `workitem.updated` and `workitem.commented`.
  Subscribing to those would make the loop trigger itself.
- Filters: the area path the loop serves, and the work item type (for
  example, Issue or User Story).
- URL:
  `https://dev.azure.com/{org}/_apis/public/distributedtask/webhooks/NoemiWorkItemCreated?api-version=6.0-preview`
- HTTP header: the signature header with the same secret as the Incoming
  WebHook connection.

The pipeline reads only three payload values: the work item id, its project
and the event type. It validates them before anything else runs. The CLI
re-reads everything else from the API.

## 7. Create the pipeline

1. Commit `templates/ci/azure-pipelines/coding-loop.yml` to a repository in
   the project, for example as `pipelines/coding-loop.yml`.
2. Edit the `variables:` block:
   - `NOEMI_CONDUCTOR_CONNECTION`: the conductor connection name.
   - `NOEMI_PRODUCER_CONNECTION`: the producer connection name. Leave it
     empty to run without `--implement`.
   These are compile-time values, and people who queue a run cannot override
   them.
3. Create the pipeline from that file and authorize it to use both
   variable groups and the four service connections.
4. Pin `resources.repositories[noemi].ref` to a release tag for production.

The template passes `--post` only when a conductor token was minted. It
passes `--implement` only when a producer token was minted and
`ADO_AGENT_EXPECTED_ID` is set.

**Manual run:** queue the pipeline and enter the work item id. The id must be
a positive integer.

## 8. Check repository settings

- **Auto-complete pull requests by default:** if it is on, a loop pull request
  could merge itself. The provider clears auto-complete on the pull requests it
  opens, but turn this setting off on loop repositories anyway.
- **Commit mention work item resolution:** controls whether `Fixes #id` in a
  merged commit moves the work item to Done. Decide whether you want that.
- Branch policies on the target branch: require a human reviewer. The loop
  never approves or merges.

## 9. Onboard a client organization

For a client that runs NewPush's loop in its own Azure DevOps organization:

1. The client's Entra admin grants **admin consent** for the multi-tenant
   conductor and producer apps in the client tenant.
2. The client adds both service principals to its Azure DevOps organization
   with Basic access (step 2), and creates its requester group (step 3).
3. NewPush adds an active row to the client registry in the vault:

   ```json
   {
     "provider": "azure-devops",
     "account_id": "<client organization GUID>",
     "tenant_id": "<client Entra tenant id>",
     "login": "client-org-name",
     "status": "active",
     "repos": ["azure-devops:client-org/Project/repo"],
     "requester_group": "NoéMi Requesters"
   }
   ```

   The row format is defined in
   [`docs/client-registry.schema.json`](../client-registry.schema.json).
   `account_id` is the organization GUID, not its name, so renames do not
   break the match. Never commit the registry.

## Dry run from a workstation

Use an organization-scoped PAT or `az login` for read access, with secrets
injected from the vault:

```bash
infisical run --env=dev -- node coding-loop/run.js \
  --repo ado:your-org/YourProject/your-repo --item 123 \
  --scan --budget-ok --requested-by-author
```

Without `--post` and `--implement`, the run only prints its verdict. It
writes nothing.

## Troubleshooting

| Symptom or reason code | Cause | Fix |
|---|---|---|
| Run never starts | Service hook not on `workitem.created`, filter mismatch, or wrong webhook name in the URL | Check the subscription history under Service hooks |
| `Validate inputs` fails | Non-numeric id, project not matching `CODING_LOOP_REPO`, or a non-create event | Check `CODING_LOOP_REPO` (`org/project/repo`) and the hook filters |
| Conductor/producer connections must differ | Both variables name the same connection | Use two connections backed by two apps |
| `trigger-unverified` | The CLI could not resolve the work item author, read its edit history, or check an editor's membership | Check the conductor's read access to the work item and the requester group |
| `requester-group-unset` | `ADO_REQUESTER_GROUP` is empty | Set it in the variable group |
| Requester refused | The author is not in the requester group | Add the person to the group, then file a new item |
| `body-edited-by-non-requester` | Someone outside the requester group edited the title, Description, Repro Steps or Acceptance Criteria | A requester-group member re-files the item in their own words |
| `hidden-instructions` | The item has hidden HTML (a comment, hidden or white-on-white text) with instruction-like content | Remove the hidden content, or re-file the item |
| `pipeline-yaml` / `pipeline-lookup-failed` | The plan edits a pipeline YAML (or a template it includes), or the producer cannot read build definitions | Pipeline files are carved out; grant the producer View builds for other YAML |
| `identity-split` | The conductor and producer credentials resolve to the same identity at run time | Use two different apps |
| Webhook run fails in `Validate inputs` with `CODING_LOOP_WEBHOOK_HMAC_CONFIRMED` | The attestation variable is not `true` | Verify the connection secret (step 4), then set it |
| `app-not-installed` | Service principal missing from the organization, or no active registry row for the organization GUID | Add the SP (step 2); check the registry row |
| `mode-unsupported` | A flag combination the Azure DevOps provider does not support | Remove the flag; see the CLI usage |
| `producer-is-conductor` | Both tokens resolve to the same identity | Use two different apps |
| Producer writes refused | `ADO_AGENT_EXPECTED_ID` unset or not the producer's GUID | Set it to the producer identity GUID |
| `budget-unverified` | `CODING_LOOP_BUDGET_OK` is not `true` | Set it once you have checked capacity |
| Token mint fails | Federated credential missing, or the SP has no access to the subscription scope | Re-verify the service connection |
| 401 mid-run | The Entra token expired (lifetime 60 to 90 minutes) | Keep runs under the 60-minute job timeout |
