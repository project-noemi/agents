#!/bin/bash

echo -e "\n🚀 Starting Project NoéMI Pre-Flight Check...\n"

# Function to check dependencies
check_tool() {
    if command -v "$2" >/dev/null 2>&1; then
        echo -e "✅ $1 is installed."
        return 0
    else
        echo -e "❌ $1 is missing. Please install it."
        return 1
    fi
}

ALL_GOOD=true
check_tool "Git" "git" || ALL_GOOD=false
check_tool "Node.js" "node" || ALL_GOOD=false
check_tool "Docker" "docker" || ALL_GOOD=false
check_tool "Gemini CLI" "gemini" || ALL_GOOD=false

if [ "$ALL_GOOD" = false ]; then
    echo -e "\n⚠️ Please install the missing tools and run this script again.\n"
    exit 1
fi

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
    echo -e "⚠️ No SecretOps CLI found. Install at least one:"
    echo -e "   - 1Password CLI: https://developer.1password.com/docs/cli/get-started/"
    echo -e "   - Infisical CLI: https://infisical.com/docs/cli/overview"
    echo -e "   Secrets are injected at runtime via these tools (see AGENTS.md)."
fi

echo -e "\n🔑 Checking API Keys..."
if [ -n "$GEMINI_API_KEY" ]; then
    echo -e "✅ GEMINI_API_KEY is set in the environment."
else
    echo -e "⚠️ GEMINI_API_KEY is not set."
    echo -e "   Use a secrets manager to inject credentials at runtime:"
    echo -e "     op run --env-file=.env.template -- <command>"
    echo -e "     infisical run --env=dev -- <command>"
fi

echo -e "\n🎉 All Systems Go! You are ready to build agents.\n"
