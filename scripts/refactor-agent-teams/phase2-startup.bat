@echo off
title PHASE 2: EXECUTION AGENT TEAM (Haiku + Sonnet + Opus 4.6)
cd /d "%~dp0..\.."

echo.
echo ============================================================
echo   PHASE 2: EXECUTION AGENT TEAM
echo   Cost-Optimized: Haiku + Sonnet + Opus 4.6 Quality Gate
echo ============================================================
echo   Project: %CD%
echo.
echo   Model Strategy:
echo     Haiku  (cheap)  -- Zod schemas, tests, cleanup
echo     Sonnet (mid)    -- Type safety, security, Cognee, schema
echo     Opus 4.6 (gate) -- Review only, no code writing
echo.
echo ============================================================
echo.

echo Fixing line endings and permissions...
wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null"

echo.
echo Launching Phase 2 agent team in WSL2...
echo.

wsl --cd "%CD%" bash -c "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-phase2-team.sh"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED - Check WSL and Claude Code installation
    echo.
)

echo.
pause
