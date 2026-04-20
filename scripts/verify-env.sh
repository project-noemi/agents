#!/bin/bash

MODE="builder"

print_usage() {
    cat <<'EOF'
Usage: bash scripts/verify-env.sh [--mode builder|gemini|claude|codex|docker|n8n]

Modes:
  builder  Default beginner path. Requires Git, Node.js, and at least one supported local AI client.
  gemini   Gemini CLI local path.
  claude   Claude Code CLI local path.
  codex    OpenAI Codex CLI local path.
  docker   Docker home and runtime verification path.
  n8n      n8n automation path without assuming a local AI client or Docker.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            MODE="$1"
            shift
            ;;
    esac
done

MODE="$(printf '%s' "$MODE" | tr '[:upper:]' '[:lower:]')"

case "$MODE" in
    builder|gemini|claude|codex|docker|n8n)
        ;;
    *)
        echo -e "❌ Unknown mode: $MODE"
        print_usage
        exit 1
        ;;
esac

echo -e "\n🚀 Starting Project NoéMI Pre-Flight Check ($MODE mode)...\n"

ALL_GOOD=true

check_tool() {
    if command -v "$2" >/dev/null 2>&1; then
        echo -e "✅ $1 is installed."
        return 0
    else
        echo -e "❌ $1 is missing. Please install it."
        return 1
    fi
}

note_tool() {
    if command -v "$2" >/dev/null 2>&1; then
        echo -e "✅ $1 is installed."
    else
        echo -e "ℹ️  $1 is not installed."
    fi
}

check_any_local_client() {
    local found_clients=()

    for tool in gemini claude codex; do
        if command -v "$tool" >/dev/null 2>&1; then
            found_clients+=("$tool")
        fi
    done

    if [ "${#found_clients[@]}" -gt 0 ]; then
        echo -e "✅ Found supported local AI client(s): ${found_clients[*]}."
        return 0
    fi

    echo -e "❌ No supported local AI client found."
    echo -e "   Install at least one of: Gemini CLI, Claude Code CLI, or OpenAI Codex."
    return 1
}

check_tool "Git" "git" || ALL_GOOD=false
check_tool "Node.js" "node" || ALL_GOOD=false

case "$MODE" in
    builder)
        check_any_local_client || ALL_GOOD=false
        note_tool "Docker" "docker"
        ;;
    gemini)
        check_tool "Gemini CLI" "gemini" || ALL_GOOD=false
        note_tool "Docker" "docker"
        ;;
    claude)
        check_tool "Claude Code CLI" "claude" || ALL_GOOD=false
        note_tool "Docker" "docker"
        ;;
    codex)
        check_tool "OpenAI Codex CLI" "codex" || ALL_GOOD=false
        note_tool "Docker" "docker"
        ;;
    docker)
        check_tool "Docker" "docker" || ALL_GOOD=false
        note_tool "Gemini CLI" "gemini"
        note_tool "Claude Code CLI" "claude"
        note_tool "OpenAI Codex CLI" "codex"
        ;;
    n8n)
        note_tool "Docker" "docker"
        note_tool "Gemini CLI" "gemini"
        note_tool "Claude Code CLI" "claude"
        note_tool "OpenAI Codex CLI" "codex"
        ;;
esac

# Mandate SecretOps CLIs
echo -e "\n🔐 Checking SecretOps CLIs..."
HAS_INFISICAL=false
HAS_OP=false
command -v infisical >/dev/null 2>&1 && HAS_INFISICAL=true
command -v op >/dev/null 2>&1 && HAS_OP=true

if [ "$HAS_INFISICAL" = true ]; then
    echo -e "✅ Infisical CLI is installed."
elif [ "$HAS_OP" = true ]; then
    echo -e "✅ 1Password CLI (op) is installed."
else
    echo -e "❌ Missing SecretOps CLI. Please install either 'infisical' or 'op'."
    echo -e "   This is required for the Fetch-on-Demand security policy."
    ALL_GOOD=false
fi

if [ "$ALL_GOOD" = false ]; then
    echo -e "\n⚠️ Please install the missing tools for the selected path and run this script again.\n"
    exit 1
fi

NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "${NODE_MAJOR}" -lt 24 ]; then
    echo -e "❌ Node.js $(node -v) is too old. Install Node.js 24.x LTS for this repository."
    exit 1
fi
echo -e "✅ Node.js $(node -v) meets the 24.x LTS baseline."

echo -e "\n🔒 Checking SecretOps CLI (Fetch-on-Demand)..."
SECRETS_CLI=false
if command -v op >/dev/null 2>&1; then
    echo -e "✅ 1Password CLI (op) is installed."
    SECRETS_CLI=true
fi
if command -v infisical >/dev/null 2>&1; then
    echo -e "✅ Infisical CLI is installed."
    SECRETS_CLI=true
fi
if [ "$SECRETS_CLI" = false ]; then
    echo -e "⚠️ No SecretOps CLI found. Install at least one before you connect business systems:"
    echo -e "   - 1Password CLI: https://developer.1password.com/docs/cli/get-started/"
    echo -e "   - Infisical CLI: https://infisical.com/docs/cli/overview"
    echo -e "   Local repo-only prompts can still work without secrets, but Gmail, GitHub, n8n, and Workspace flows should use Fetch-on-Demand wrappers."
fi

echo -e "\n🔑 Checking common API key env vars in the current shell..."
check_env_var() {
    if [ -n "${!1}" ]; then
        echo -e "✅ $1 is set in the current environment."
    else
        echo -e "ℹ️  $1 is not set in the current environment."
    fi
}

check_env_var "GEMINI_API_KEY"
check_env_var "ANTHROPIC_API_KEY"
check_env_var "OPENAI_API_KEY"

echo -e "\n🧭 Recommended next step for $MODE mode:"
case "$MODE" in
    builder)
        echo -e "   Read docs/examples/zero-to-first-agent.md and prove one safe local task first."
        ;;
    gemini|claude|codex)
        echo -e "   Generate context with node scripts/generate_all.js and run one read-only local task first."
        ;;
    docker)
        echo -e "   Generate context, run npm run validate, then npm run test:e2e on this Docker-capable host."
        ;;
    n8n)
        echo -e "   Follow docs/examples/n8n-google-workspace-quickstart.md and keep human approval on the last mutating step."
        ;;
esac

echo -e "\n🎉 Pre-flight complete.\n"
