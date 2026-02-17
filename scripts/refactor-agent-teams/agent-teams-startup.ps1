# Agent Teams Startup - Opens external terminal window
# Usage: Right-click > Run with PowerShell
#   OR:  powershell -ExecutionPolicy Bypass -File agent-teams-startup.ps1

$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  GoldLedger - Phase 1 Planning Agent Team" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Project: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# Build the WSL command
$WslCmd = @(
    "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null"
    "chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null"
    "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
    "./scripts/refactor-agent-teams/launch-planning-team.sh"
) -join "; "

# Try Windows Terminal first, fall back to cmd
$wtPath = Get-Command wt -ErrorAction SilentlyContinue
if ($wtPath) {
    Write-Host "Opening Windows Terminal..." -ForegroundColor Green
    Start-Process wt -ArgumentList "new-tab", "--title", "Agent Teams", "wsl", "--cd", $ProjectRoot, "bash", "-c", $WslCmd
} else {
    Write-Host "Opening CMD window..." -ForegroundColor Green
    $CmdArg = "cd /d `"$ProjectRoot`" && wsl --cd `"$ProjectRoot`" bash -c `"$WslCmd`" & echo. & pause"
    Start-Process cmd -ArgumentList "/k", $CmdArg
}

Write-Host ""
Write-Host "Agent team launching in external window." -ForegroundColor Yellow
Write-Host "Switch to that window to interact with Claude Code." -ForegroundColor Yellow
Write-Host ""
