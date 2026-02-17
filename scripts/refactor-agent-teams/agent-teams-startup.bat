@echo off
title GoldLedger - Phase 1 Planning Agent Team
cd /d "%~dp0..\.."

echo.
echo ==========================================
echo   GoldLedger - Phase 1 Planning Agent Team
echo ==========================================
echo   Project: %CD%
echo.

REM Fix line endings, make executable, then launch
wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-planning-team.sh"

if errorlevel 1 (
    echo.
    echo ==========================================
    echo   LAUNCH FAILED
    echo ==========================================
    echo   1. Is WSL installed?       wsl --status
    echo   2. Is Claude installed?    wsl claude --version
    echo   3. Is tmux installed?      wsl tmux -V
    echo.
)

echo.
pause
