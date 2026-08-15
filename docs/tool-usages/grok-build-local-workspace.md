# Grok Build Local Workspace

Grok Build is the **local** xAI stack: a terminal agent (`grok`) with a full-screen TUI, headless/`-p` mode, skills, MCP, hooks, and worktrees.

It is the analogue of Gemini CLI, Claude Code CLI, and Codex CLI. It is **not** the same product as grok.com Custom Agents (the Gems / Custom GPT equivalent). For hosted personas, see [`grok-custom-agents.md`](grok-custom-agents.md).

Official overview: [docs.x.ai/build/overview](https://docs.x.ai/build/overview). Product page: [x.ai/build](https://x.ai/build).

## Why It Is More Than A Coding Tool

In NoéMI, Grok Build is useful for:

- repository comprehension and local review
- documentation and operating-procedure work
- MCP-driven business operations (GitHub, Google Workspace, Slack, Microsoft 365)
- headless scripting (`grok -p`) wrapped in Fetch-on-Demand
- worktree-isolated subagent runs

It reads this repository's `AGENTS.md` and, for compatibility, `CLAUDE.md`. There is no generated `GROK.md`. Keep using `node scripts/generate_all.js` so `CLAUDE.md` stays current.

## Install Grok Build

Official installers from [docs.x.ai/build/overview](https://docs.x.ai/build/overview). After install, open a **new** terminal so `PATH` picks up `~/.grok/bin` (Windows: `%USERPROFILE%\.grok\bin`).

### macOS and Linux

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
grok --version
```

### Windows (PowerShell)

This is the native Windows path. Use it in the same PowerShell you will use for the rest of the kickstart.

```powershell
irm https://x.ai/cli/install.ps1 | iex
grok --version
```

Git Bash or MSYS2 can use the macOS/Linux installer instead. WSL installs the Linux binary via the bash installer.

### ChromeOS

Install inside the **Linux development environment** (the same terminal the ChromeOS kickstart uses):

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
grok --version
```

### Pin or update

```bash
# specific version (bash installer)
curl -fsSL https://x.ai/cli/install.sh | bash -s 0.1.42
```

```powershell
# specific version (PowerShell installer)
$env:GROK_VERSION="0.1.42"; irm https://x.ai/cli/install.ps1 | iex
```

```bash
grok update
```

Do not commit an `XAI_API_KEY` or paste one into a repo file. First launch opens a browser to sign in with grok.com. For CI or a machine without a browser, inject `XAI_API_KEY` at runtime through `infisical run` or `op run`.

## First Launch And First Win

From this repository's root:

```bash
grok --version
```

```bash
grok
```

On first launch, complete the grok.com sign-in in the browser.

Recommended first read-only prompt (interactive TUI, or headless with `-p`):

```bash
grok -p "Read AGENTS.md and CLAUDE.md, list the engineering agents in this repository, and summarize what each one does in one sentence. Then tell me which one would help first with PR review."
```

Useful local surfaces:

```bash
grok
grok -p "Explain this repository"
grok inspect
grok mcp
```

`grok inspect` shows what the current directory contributed: config, instructions, skills, plugins, hooks, and MCP servers.

## Why The CLI Matters

The CLI is the durable layer:

- launch under `infisical run` or `op run`
- run headlessly in scripts
- register MCP servers without storing secrets in config
- reproduce the same command on macOS, Linux, WSL, or Windows PowerShell

The TUI is the friendlier daily cockpit. It is not a separate philosophy.

## Recommended Configuration Pattern

### 1. Install And Authenticate The CLI First

Do not start by wiring MCP or Docker. Prove `grok --version`, a grok.com sign-in, and one read-only repo prompt.

### 2. Keep Secret Injection Outside The Client Config

```bash
infisical run --env=dev -- grok
```

```bash
op run --env-file=.env.template -- grok
```

Register MCP servers as wrapper commands, not as embedded tokens:

```bash
grok mcp add googleWorkspace -- op run --env-file=.env.template -- node path/to/server.js
```

If the immediate goal is Google Workspace on a desktop, start with [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md) so Gemini, Claude, Codex, and Grok share one local `gws` surface.

### 3. Use Project Rules Already In This Repo

Grok Build injects `AGENTS.md` (and `CLAUDE.md` for compatibility). Deeper files win. Do not hand-edit `CLAUDE.md`; regenerate it.

### 4. Treat Hosted Custom Agents As A Different Surface

A grok.com Custom Agent does not replace this CLI. Skills on grok.com and Skills in Grok Build (`SKILL.md`, `/skillify`) are related products with different install paths. See [`grok-custom-agents.md`](grok-custom-agents.md).

## Strengths

- one official installer per OS family
- strong TUI plus a real headless mode
- reads the same `AGENTS.md` / `CLAUDE.md` contract this repository already generates
- MCP, skills, hooks, and worktrees without a second product

## Weaknesses

- browser sign-in is the default; headless/CI still needs a vault-injected `XAI_API_KEY`
- this repository does not generate a Grok-specific context file
- `verify-env` `--mode=grok` exists so a Grok-first builder can target the CLI, but Grok is a documented fourth stack — not a new model baseline

## Recommended Next Docs

- [`agentic-local-workspaces.md`](agentic-local-workspaces.md)
- [`grok-custom-agents.md`](grok-custom-agents.md)
- [`../examples/macos-linux-kickstart.md`](../examples/macos-linux-kickstart.md)
- [`../examples/windows-kickstart.md`](../examples/windows-kickstart.md)
- [`../examples/chromeos-kickstart.md`](../examples/chromeos-kickstart.md)
- [`../mcp-setup/gws-cli-machine-setup.md`](../mcp-setup/gws-cli-machine-setup.md)
- [`secure-secret-management.md`](secure-secret-management.md)

## Official References

- [Grok Build overview](https://docs.x.ai/build/overview)
- [Grok Build product page](https://x.ai/build)
- [Introducing Grok Build](https://x.ai/news/grok-build-cli)
