param(
    [ValidateSet("builder", "gemini", "claude", "codex", "docker", "n8n")]
    [string]$Mode = "builder"
)

Write-Host "🚀 Starting Project NoéMI Pre-Flight Check ($Mode mode)..." -ForegroundColor Cyan

function Check-Tool($Name, $Command) {
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "✅ $Name is installed." -ForegroundColor Green
        return $true
    }

    Write-Host "❌ $Name is missing. Please install it." -ForegroundColor Red
    return $false
}

function Note-Tool($Name, $Command) {
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "✅ $Name is installed." -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $Name is not installed." -ForegroundColor Cyan
    }
}

function Check-AnyLocalClient {
    $clients = @()

    if (Get-Command gemini -ErrorAction SilentlyContinue) { $clients += "gemini" }
    if (Get-Command claude -ErrorAction SilentlyContinue) { $clients += "claude" }
    if (Get-Command codex -ErrorAction SilentlyContinue) { $clients += "codex" }

    if ($clients.Count -gt 0) {
        Write-Host "✅ Found supported local AI client(s): $($clients -join ', ')." -ForegroundColor Green
        return $true
    }

    Write-Host "❌ No supported local AI client found." -ForegroundColor Red
    Write-Host "   Install at least one of: Gemini CLI, Claude Code CLI, or OpenAI Codex." -ForegroundColor Yellow
    return $false
}

function Check-EnvVar($Name) {
    if ([Environment]::GetEnvironmentVariable($Name)) {
        Write-Host "✅ $Name is set in the current environment." -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $Name is not set in the current environment." -ForegroundColor Cyan
    }
}

$allGood = $true
if (-not (Check-Tool "Git" "git")) { $allGood = $false }
if (-not (Check-Tool "Node.js" "node")) { $allGood = $false }

switch ($Mode) {
    "builder" {
        if (-not (Check-AnyLocalClient)) { $allGood = $false }
        Note-Tool "Docker" "docker"
    }
    "gemini" {
        if (-not (Check-Tool "Gemini CLI" "gemini")) { $allGood = $false }
        Note-Tool "Docker" "docker"
    }
    "claude" {
        if (-not (Check-Tool "Claude Code CLI" "claude")) { $allGood = $false }
        Note-Tool "Docker" "docker"
    }
    "codex" {
        if (-not (Check-Tool "OpenAI Codex CLI" "codex")) { $allGood = $false }
        Note-Tool "Docker" "docker"
    }
    "docker" {
        if (-not (Check-Tool "Docker" "docker")) { $allGood = $false }
        Note-Tool "Gemini CLI" "gemini"
        Note-Tool "Claude Code CLI" "claude"
        Note-Tool "OpenAI Codex CLI" "codex"
    }
    "n8n" {
        Note-Tool "Docker" "docker"
        Note-Tool "Gemini CLI" "gemini"
        Note-Tool "Claude Code CLI" "claude"
        Note-Tool "OpenAI Codex CLI" "codex"
    }
}

# Mandate SecretOps CLIs
Write-Host "`n🔐 Checking SecretOps CLIs..." -ForegroundColor Cyan
$hasInfisical = if (Get-Command "infisical" -ErrorAction SilentlyContinue) { $true } else { $false }
$hasOp = if (Get-Command "op" -ErrorAction SilentlyContinue) { $true } else { $false }

if ($hasInfisical) {
    Write-Host "✅ Infisical CLI is installed." -ForegroundColor Green
} elseif ($hasOp) {
    Write-Host "✅ 1Password CLI (op) is installed." -ForegroundColor Green
} else {
    Write-Host "❌ Missing SecretOps CLI. Please install either 'infisical' or 'op'." -ForegroundColor Red
    Write-Host "   This is required for the Fetch-on-Demand security policy." -ForegroundColor Red
    $allGood = $false
}

if (-not $allGood) {
    Write-Host "`n⚠️ Please install the missing tools for the selected path and run this script again." -ForegroundColor Yellow
    exit 1
}

$nodeMajor = [int]((node --version) -replace '^v([0-9]+).*$','$1')
if ($nodeMajor -lt 24) {
    Write-Host "❌ Node.js $(node --version) is too old. Install Node.js 24.x LTS for this repository." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $(node --version) meets the 24.x LTS baseline." -ForegroundColor Green

Write-Host "`n🔒 Checking SecretOps CLI (Fetch-on-Demand)..." -ForegroundColor Cyan
$secretsCli = $false
if (Get-Command op -ErrorAction SilentlyContinue) {
    Write-Host "✅ 1Password CLI (op) is installed." -ForegroundColor Green
    $secretsCli = $true
}
if (Get-Command infisical -ErrorAction SilentlyContinue) {
    Write-Host "✅ Infisical CLI is installed." -ForegroundColor Green
    $secretsCli = $true
}
if (-not $secretsCli) {
    Write-Host "⚠️ No SecretOps CLI found. Install at least one before you connect business systems:" -ForegroundColor Yellow
    Write-Host "   - 1Password CLI: https://developer.1password.com/docs/cli/get-started/" -ForegroundColor Yellow
    Write-Host "   - Infisical CLI: https://infisical.com/docs/cli/overview" -ForegroundColor Yellow
    Write-Host "   Local repo-only prompts can still work without secrets, but Gmail, GitHub, n8n, and Workspace flows should use Fetch-on-Demand wrappers." -ForegroundColor Yellow
}

Write-Host "`n🔑 Checking common API key env vars in the current shell..." -ForegroundColor Cyan
Check-EnvVar "GEMINI_API_KEY"
Check-EnvVar "ANTHROPIC_API_KEY"
Check-EnvVar "OPENAI_API_KEY"

Write-Host "`n🧭 Recommended next step for $Mode mode:" -ForegroundColor Cyan
switch ($Mode) {
    "builder" {
        Write-Host "   Read docs/examples/zero-to-first-agent.md and prove one safe local task first." -ForegroundColor White
    }
    "gemini" {
        Write-Host "   Generate context with node scripts/generate_all.js and run one read-only local task first." -ForegroundColor White
    }
    "claude" {
        Write-Host "   Generate context with node scripts/generate_all.js and run one read-only local task first." -ForegroundColor White
    }
    "codex" {
        Write-Host "   Generate context with node scripts/generate_all.js and run one read-only local task first." -ForegroundColor White
    }
    "docker" {
        Write-Host "   Generate context, run npm run validate, then npm run test:e2e on this Docker-capable host." -ForegroundColor White
    }
    "n8n" {
        Write-Host "   Follow docs/examples/n8n-google-workspace-quickstart.md and keep human approval on the last mutating step." -ForegroundColor White
    }
}

Write-Host "`n🎉 Pre-flight complete." -ForegroundColor Green
