@echo off
title COGNEE MAXIMALIST Agent Team
cd /d "%~dp0..\.."

echo.
echo ==========================================
echo   COGNEE MAXIMALIST Agent Team
echo   Full Power Cognee - No Compromises
echo ==========================================
echo   Project: %CD%
echo.

wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-cognee-team.sh"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED - Check WSL and Claude Code installation
    echo.
)

echo.
pause
