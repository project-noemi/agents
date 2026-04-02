Write-Host "🚀 Starting Project NoéMI Pre-Flight Check..." -ForegroundColor Cyan

# Function to check dependencies
function Check-Tool ($name, $command) {
    if (Get-Command $command -ErrorAction SilentlyContinue) {
        Write-Host "✅ $name is installed." -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $name is missing. Please install it." -ForegroundColor Red
        return $false
    }
}

$allGood = $true
if (-not (Check-Tool "Git" "git")) { $allGood = $false }
if (-not (Check-Tool "Node.js" "node")) { $allGood = $false }
if (-not (Check-Tool "Docker" "docker")) { $allGood = $false }
if (-not (Check-Tool "Gemini CLI" "gemini")) { $allGood = $false }

if (-not $allGood) {
    Write-Host "`n⚠️ Please install the missing tools and run this script again." -ForegroundColor Yellow
    exit
}

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
    Write-Host "⚠️ No SecretOps CLI found. Install at least one:" -ForegroundColor Yellow
    Write-Host "   - 1Password CLI: https://developer.1password.com/docs/cli/get-started/" -ForegroundColor Yellow
    Write-Host "   - Infisical CLI: https://infisical.com/docs/cli/overview" -ForegroundColor Yellow
    Write-Host "   Secrets are injected at runtime via these tools (see AGENTS.md)." -ForegroundColor Yellow
}

Write-Host "`n🔑 Checking API Keys..." -ForegroundColor Cyan
if ($env:GEMINI_API_KEY) {
    Write-Host "✅ GEMINI_API_KEY is set in the environment." -ForegroundColor Green
} else {
    Write-Host "⚠️ GEMINI_API_KEY is not set." -ForegroundColor Yellow
    Write-Host "   Use a secrets manager to inject credentials at runtime:" -ForegroundColor Yellow
    Write-Host "     op run --env-file=.env.template -- <command>" -ForegroundColor Yellow
    Write-Host "     infisical run --env=dev -- <command>" -ForegroundColor Yellow
    Write-Host "   See AGENTS.md for the Fetch-on-Demand security policy." -ForegroundColor Yellow
}

Write-Host "`n🎉 All Systems Go! You are ready to build agents." -ForegroundColor Green
