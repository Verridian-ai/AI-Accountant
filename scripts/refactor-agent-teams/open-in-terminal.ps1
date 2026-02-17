# Open a new Windows Terminal tab and run the Phase 1 agent team launcher
# Usage: Right-click -> Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File open-in-terminal.ps1

$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "Opening Windows Terminal with WSL..."
Write-Host "Project: $ProjectRoot"
Write-Host ""

# wt = Windows Terminal CLI. wsl --cd uses Windows path (no manual conversion).
if (Get-Command wt -ErrorAction SilentlyContinue) {
  $wslArgs = "new-tab", "wsl", "--cd", "`"$ProjectRoot`"", "bash", "-c", "chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; ./scripts/refactor-agent-teams/launch-planning-team.sh"
  Start-Process wt -ArgumentList $wslArgs
} else {
  Write-Host "Windows Terminal (wt) not found. Run manually from PowerShell:"
  Write-Host "  cd `"$ProjectRoot`""
  Write-Host "  wsl --cd `"$ProjectRoot`" bash -c `"./scripts/refactor-agent-teams/launch-planning-team.sh`""
}
