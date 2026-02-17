@echo off
title Finish Cognee Plan - Solo Agent
cd /d "%~dp0..\.."

echo.
echo ==========================================
echo   Finishing Cognee Plan - Solo Agent
echo   Updating PHASE2 + Verifying Plans
echo ==========================================
echo   Project: %CD%
echo.

wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null; export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-finish-cognee.sh"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED
    echo.
)

echo.
pause
