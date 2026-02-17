# Run Phase 2 Execution Agent Team from Windows
# Usage: powershell -ExecutionPolicy Bypass -File run-phase2-from-windows.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path

Write-Host "Project root: $ProjectRoot"
Write-Host ""
Write-Host "Launching Phase 2 Execution Agent Team via WSL..."
Write-Host ""

wsl --cd "$ProjectRoot" bash -c "chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; ./scripts/refactor-agent-teams/launch-execution-team.sh"
