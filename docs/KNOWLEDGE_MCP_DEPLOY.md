# Knowledge MCP deploy (`mcp.noemi.newpush.com`)

The NoéMI Knowledge MCP (`services/noemi-knowledge-mcp`) is a Cloudflare Worker. Its corpus is built from this repository (the Bible, governance, methodology, the Phase 0 baseline, the public getting-started guides and `skills-dist`), so the live service is only as current as its last deploy. `.github/workflows/deploy-knowledge-mcp.yml` ("Deploy Knowledge MCP") deploys it from a published agents release.

## Release order

1. **Agents release.** `release.yml` stamps the CalVer tag and GitHub Release on `main` ([RELEASE_PROCESS.md](RELEASE_PROCESS.md)).
2. **Knowledge MCP redeploy.** "Deploy Knowledge MCP" deploys that tag and rebuilds the corpus.
3. **Website FAQ republish.** project-noemi/website "Deploy Production". The website build quotes the live Knowledge MCP, so it runs after step 2, or it quotes the previous corpus.

Record this order in the release notes when a release changes the Bible or another corpus source.

## What runs

The workflow starts in three ways:

- **`release: published`**: a release created by a person or a GitHub App token.
- **After each successful "Release (CalVer date-versioned)" run (`workflow_run`)**: `release.yml` creates releases with `GITHUB_TOKEN`, and GitHub does not start `release` workflows for events created with `GITHUB_TOKEN`. A Release run that tagged nothing leaves the latest tag unchanged; the live service already reports that tag, so the run stops without deploying.
- **Manual `workflow_dispatch`** from `develop` or `main`, with an optional `tag` (empty means the latest published release). A manual run always deploys, for example to rebuild the corpus.

The `resolve` job reads the tag, checks that it is a published CalVer release (not a draft or pre-release), and compares it with the `version` that `/health` reports. The `deploy` job runs in GitHub Environment `knowledge-mcp-production`, waits for its required reviewers, and then:

1. Refuses a workflow ref other than `develop`, `main` or a release tag, and stops with the missing secret names if the Environment is not set up.
2. Checks out the release tag and refuses it if its commit is not on `main`, before any credential is used.
3. Runs `npm ci` and `npm test` in `services/noemi-knowledge-mcp`. The test script rebuilds the corpus and runs the FAQ retrieval contract (`eval/faq-questions.json`); a failure stops the deploy.
4. Rebuilds the corpus and runs `wrangler deploy --var SERVICE_VERSION:<tag>`, so `/health` and the server card report the release tag as `version`.
5. Checks `https://mcp.noemi.newpush.com/health` up to six times: `status` is `ok`, `version` is the tag, and `corpus.generatedAt` is from this run.

Runs are serialized (`concurrency: deploy-knowledge-mcp`, no cancel-in-progress). A deploy from a laptop (`npm run deploy`) still works and reports the `SERVICE_VERSION` in `wrangler.toml`.

## One-time setup

Merging the workflow does not deploy anything. Until the Environment and its secrets exist, an automatic run stops at "Check Environment secrets" with the missing names. The secrets owner (Dep 10 Secret Manager Bot) and a repository admin do this once. Names only; values never go into this repository, an issue or a chat.

### 1. Cloudflare API token

Create an API token for the account that owns the `noemi-knowledge-mcp` Worker with **Account → Workers Scripts → Edit**, limited to that one account. Cloudflare does not accept GitHub OIDC tokens, so the website's keyless Workload Identity Federation pattern does not apply here; the token lives only in the Environment secret below. Give it an expiry and add the rotation date to the secret inventory.

### 2. GitHub Environment `knowledge-mcp-production`

In **Settings → Environments → New environment**, create `knowledge-mcp-production`:

1. **Required reviewers:** add the release approver(s).
2. **Deployment branches and tags:** **Selected branches and tags**, with branch rules `develop` and `main` and tag rule `20*`. A `workflow_run` run uses the default branch (`develop`); a `release` run uses the release tag.
3. **Environment secrets:**
   - `CLOUDFLARE_API_TOKEN`: the token from step 1.
   - `CLOUDFLARE_ACCOUNT_ID`: the account that owns the Worker.

No repository-level secret or variable is used. The custom domain `mcp.noemi.newpush.com` stays attached to the Worker in Cloudflare; `wrangler.toml` declares no routes, so a deploy does not change them.

## Running a deploy by hand

**Actions → Deploy Knowledge MCP → Run workflow**, from `develop` or `main`, with `tag` empty for the latest release. Approve the pending `knowledge-mcp-production` deployment when prompted, then check `/health`.

## Not covered

- The website FAQ republish (step 3 of the release order) stays a separate run in project-noemi/website.
- DNS, the custom domain and Cloudflare rate-limiting rules are managed in Cloudflare, not by this workflow.
