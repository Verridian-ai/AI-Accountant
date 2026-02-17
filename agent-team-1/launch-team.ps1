# ============================================================
# GoldLedger Refactoring - Agent Team Quick Launcher (Windows)
# Runs the agent team setup through WSL
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  GoldLedger Refactoring - Agent Team Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ProjectDir = "C:\Users\Danie\Desktop\CBA Statements Parse"
$WslProjectDir = "/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

# Check WSL is available
Write-Host "[1/3] Checking WSL..." -ForegroundColor Yellow
try {
    $wslCheck = wsl --status 2>&1
    Write-Host "  ✓ WSL is available" -ForegroundColor Green
} catch {
    Write-Host "  ✗ WSL not found! Install from Microsoft Store." -ForegroundColor Red
    exit 1
}

# Set up the launch script permissions
Write-Host "[2/3] Preparing launch script..." -ForegroundColor Yellow
wsl bash -c "chmod +x '$WslProjectDir/agent-team/launch-team.sh'"
Write-Host "  ✓ Script permissions set" -ForegroundColor Green

# Launch via WSL
Write-Host "[3/3] Launching agent team via WSL..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Entering WSL environment..." -ForegroundColor Cyan
Write-Host "  The tmux session will open with the agent team." -ForegroundColor Cyan
Write-Host ""
Write-Host "  QUICK REFERENCE:" -ForegroundColor Yellow
Write-Host "    Ctrl+B, D     = Detach from tmux (team keeps running)" -ForegroundColor White
Write-Host "    Shift+Up/Down = Navigate between agents" -ForegroundColor White
Write-Host "    Ctrl+T        = Toggle task list" -ForegroundColor White
Write-Host "    Ctrl+C        = Interrupt current agent" -ForegroundColor White
Write-Host ""

# Launch - this will enter WSL and attach to tmux
wsl bash -c "cd '$WslProjectDir' && ./agent-team/launch-team.sh"

