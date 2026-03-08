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

Write-Host "`n🔒 Checking API Keys..." -ForegroundColor Cyan
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
