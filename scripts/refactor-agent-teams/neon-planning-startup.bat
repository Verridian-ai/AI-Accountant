@echo off
title NEON + COGNEE + DATA MASKING PLANNING TEAM
cd /d "%~dp0..\.."

echo.
echo ============================================================
echo   NEON + COGNEE + DATA MASKING PLANNING TEAM
echo   3x Opus 4.6 Agents
echo ============================================================
echo   Project: %CD%
echo.
echo   Agent 1: neon-architect         (Neon DB integration)
echo   Agent 2: masking-architect      (PII protection + redaction)
echo   Agent 3: cognee-neon-integrator (Bridge plan)
echo.
echo ============================================================
echo.

echo Fixing line endings and permissions...
wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null"

echo.
echo Launching Neon planning team in WSL2...
echo.

wsl --cd "%CD%" bash -c "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-neon-planning-v2.sh"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED - Check WSL and Claude Code installation
    echo.
)

echo.
pause
