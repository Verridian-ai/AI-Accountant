# Run Phase 1 Planning Agent Team from Windows
# Usage: powershell -ExecutionPolicy Bypass -File run-phase1-from-windows.ps1
# Or from project root: wsl ./scripts/refactor-agent-teams/launch-planning-team.sh

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "Project root: $ProjectRoot"
Write-Host ""
Write-Host "Launching Phase 1 Planning Agent Team via WSL..."
Write-Host ""

# Use wsl --cd with Windows path (WSL converts automatically)
wsl --cd "$ProjectRoot" bash -c "chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; ./scripts/refactor-agent-teams/launch-planning-team.sh"
