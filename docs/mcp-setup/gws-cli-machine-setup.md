# GWS CLI Machine Setup

This is the **beginner-proof machine setup guide** for `gws`, the Google Workspace CLI from [`googleworkspace/cli`](https://github.com/googleworkspace/cli).

Use this guide when your goal is:

- Google Workspace access on a **real desktop or laptop**
- one shared Google Workspace command surface that Gemini CLI, Claude Code, and Codex can all use
- a safe first setup before you move into background automation or n8n

## What `gws` Is

`gws` is a Google Workspace command-line tool that can talk to Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, and other Google Workspace APIs.

Why it matters in NoeMI:

- it gives you one **machine-level Google Workspace tool**
- Gemini CLI can use it through the official `gws` Gemini extension
- Claude Code and Codex can use it through normal shell access on the same machine
- it is often easier for beginners to debug one shared CLI than three separate Google auth stories

Important honesty note:

- according to the upstream README, `gws` is **not an officially supported Google product**
- it is, however, an actively maintained open-source Google Workspace CLI with a documented auth flow and Gemini extension

## Fast Decision Rule

Use this guide if all three statements are true:

- the user works on a desktop or laptop
- the user needs Google Workspace in Gemini, Claude, or Codex
- the user wants the cleanest **shared local** setup first

Do **not** start here if you actually need:

- webhook-driven automation
- headless background jobs
- multi-user shared runtime credentials
- n8n workflow credentials

For those cases, keep this guide as the machine baseline and then move to:

- [`google-workspace-agentic-clients.md`](google-workspace-agentic-clients.md)
- [`google-n8n-credential-matrix.md`](google-n8n-credential-matrix.md)
- [`../examples/n8n-google-workspace-quickstart.md`](../examples/n8n-google-workspace-quickstart.md)

## Before You Start

### What you need

- a Google account or Google Workspace account
- a local machine where you can install CLI tools
- Node.js 18 or newer
  - if you are already following this repository, Node 24 is fine
- one local AI client if you want to use AI immediately:
  - Gemini CLI
  - Claude Code
  - OpenAI Codex

### What makes life easier

- `gcloud` installed and authenticated

This is optional, but it makes the quickest `gws` setup path work:

```bash
gws auth setup
```

If you do **not** have `gcloud`, you can still finish the setup with the manual Google Cloud Console path below.

## Step 1: Install `gws`

Choose **one** install method.

### Option A: Homebrew on macOS or Linux

```bash
brew install googleworkspace-cli
```

### Option B: npm on macOS, Linux, or Windows

```bash
npm install -g @googleworkspace/cli
```

### Option C: Download the prebuilt binary

Use the releases page:

[googleworkspace/cli releases](https://github.com/googleworkspace/cli/releases)

This is the best option for users who do not want a global npm install.

## Step 2: Verify The Install

Open a **new terminal** window after installation and run:

```bash
gws --help
```

You should see help text.

If you want a quick version check:

```bash
gws --version
```

If the command is not found:

- restart the terminal
- confirm the install method completed successfully
- check that the install location is in your `PATH`

## Step 3: Choose The Authentication Path

You have two beginner-safe local-machine options:

### Option A: Fastest path with `gcloud`

Use this if you already have `gcloud` installed and can sign in with it.

```bash
gws auth setup
```

This is the fastest beginner path because it helps create or configure the Google Cloud project and OAuth setup for you.

Then log in with the scopes you actually need:

```bash
gws auth login -s drive,gmail,sheets
```

Why the narrow scope list matters:

- the upstream docs warn that unverified OAuth apps in testing mode can fail if you request too many scopes at once
- it is better to start narrow and add scopes later

If you only need Drive and Docs at first, keep it even smaller.

### Option B: Manual setup through Google Cloud Console

Use this if `gcloud` is not installed or `gws auth setup` cannot complete on your machine.

1. Open Google Cloud Console in the target project.
2. Open the OAuth consent screen.
3. Set the app type to **External**.
4. Keep it in **testing mode** if this is an internal or pilot setup.
5. Add your own Google account under **Test users**.
6. Open **Credentials**.
7. Create an OAuth client of type **Desktop app**.
8. Download the client JSON.
9. Save it to:
   - macOS / Linux: `~/.config/gws/client_secret.json`
   - Windows PowerShell: `$HOME/.config/gws/client_secret.json`

Then run:

```bash
gws auth login
```

Important:

- if you skip the **Test users** step, Google often shows a generic "Access blocked" style failure

## Step 4: Prove Read Access Before You Touch AI

Do **not** start with write actions.

Prove that `gws` works with one low-risk read:

```bash
gws drive files list --params '{"pageSize": 5}'
```

If you want help understanding the request shape:

```bash
gws schema drive.files.list
```

If this command works, your machine-level Google Workspace foundation is in place.

## Step 5: Connect It To Gemini CLI

If you want Gemini CLI to use `gws`, install the `gws` Gemini extension:

```bash
gemini extensions install https://github.com/googleworkspace/cli
```

Then start Gemini normally:

```bash
gemini
```

Good first prompt:

> Use gws to list my 5 most recent Drive files and summarize what they appear to be.

Why this is a good first prompt:

- read-only
- easy to verify
- no email sending or document editing yet

## Step 6: Connect It To Claude Code

For Claude Code, the beginner-proof local-machine path is simpler than MCP:

1. make sure `gws` works in the same terminal where you launch Claude
2. launch Claude Code normally
3. ask Claude to use the `gws` CLI for read-only Google Workspace work first

Example prompt:

> Use the `gws` CLI to list my 5 most recent Drive files, then summarize the result for me before taking any write action.

This works because Claude Code can use local shell commands on the machine.

When to move beyond this:

- if you want a shared team-managed transport
- if you want project-scoped reusable tool definitions
- if you need HTTP or stdio MCP for a broader integration architecture

Then move to [`google-workspace-agentic-clients.md`](google-workspace-agentic-clients.md).

## Step 7: Connect It To Codex

For Codex, the same beginner rule applies:

1. make sure `gws` is on `PATH`
2. make sure your Google login is already working through `gws`
3. launch Codex and instruct it to use `gws` for the first read-only task

Example prompt:

> Use `gws` to list my 5 most recent Drive files and explain the result. Do not make any changes yet.

This is often the easiest way to get Google Workspace working in Codex without making the user debug a separate Google transport layer first.

## Step 8: Only Then Allow Controlled Writes

Once read operations work, test one controlled write.

Good examples:

- create a draft
- create a test spreadsheet
- create a test document in a non-sensitive location

Avoid starting with:

- sending Gmail messages
- editing critical shared documents
- broad mailbox operations
- admin actions on a production Workspace domain

## Step 9: Keep The Security Rules Straight

- do not paste OAuth client secrets into chat
- do not save raw Google tokens in repo files
- let `gws` manage its encrypted local credentials for desktop use
- use narrow scopes first
- use human review before write actions

Inside Project NoeMI, the broader secret-management rule still applies for other credentials:

- [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)

## Troubleshooting

### `gws: command not found`

Usually means:

- the install did not finish
- the install location is not in `PATH`
- the terminal needs to be restarted

### `gws auth setup` fails

Usually means:

- `gcloud` is not installed
- `gcloud` is installed but not authenticated

Fix:

- use the manual Google Cloud Console flow instead

### Google says the app is blocked or unverified

Usually means:

- you were not added as a **Test user**
- the app is still in testing mode and the current account is not allowed

### Too many scopes requested

The upstream docs warn that testing-mode apps can fail when too many scopes are requested at once.

Fix:

```bash
gws auth login -s drive,gmail,sheets
```

Start smaller, then add scopes later if needed.

### Read works, but one service fails with permissions or scope errors

Usually means:

- the login did not include the needed scopes

Fix:

- rerun `gws auth login` with the specific service scopes you need

### Gemini works, but Claude or Codex does not

Usually means:

- `gws` is installed, but not visible in the shell environment used by that client

Fix:

- confirm `gws --help` works in the same terminal or shell context
- restart the client after confirming the command is on `PATH`

## Recommended Next Docs

- [`google-workspace-agentic-clients.md`](google-workspace-agentic-clients.md)
- [`google-n8n-credential-matrix.md`](google-n8n-credential-matrix.md)
- [`../tool-usages/google-local-workspace.md`](../tool-usages/google-local-workspace.md)
- [`../tool-usages/gemini-workspace-quickstart.md`](../tool-usages/gemini-workspace-quickstart.md)
- [`../tool-usages/claude-code-local-workspace.md`](../tool-usages/claude-code-local-workspace.md)
- [`../tool-usages/openai-codex-local-workspace.md`](../tool-usages/openai-codex-local-workspace.md)

## Official References

- [googleworkspace/cli README](https://github.com/googleworkspace/cli)
- [googleworkspace/cli releases](https://github.com/googleworkspace/cli/releases)
- [Google Workspace developer tools](https://developers.google.com/workspace/guides/developer-tools)
