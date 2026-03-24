#!/bin/bash
set -euo pipefail
# Phase 0 Security: Install Infisical CLI

echo "Installing Infisical CLI for SecretOps..."
SETUP_SCRIPT=$(curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh') \
  || { echo "❌ Failed to download Infisical setup script." >&2; exit 1; }
echo "${SETUP_SCRIPT}" | sudo -E bash
sudo apt-get update && sudo apt-get install -y infisical

# Verify Auth (Useful for debugging logs)
if infisical export > /dev/null 2>&1; then
  echo "✅ Phase 0: Guardian Layer connection established."
else
  echo "❌ Phase 0 Error: Auth Failed. Check INFISICAL_TOKEN."
fi
