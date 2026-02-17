@echo off
title PHASE 3: ERROR RESOLUTION - 4x Opus 4.6 Agents
cd /d "%~dp0..\.."

echo.
echo ============================================================
echo   PHASE 3: ERROR RESOLUTION - 4x Opus 4.6 Agents
echo ============================================================
echo   Project: %CD%
echo.
echo   Targets (from TS_ERROR_REPORT.md):
echo     119 TS errors -- 0
echo     560 :any types -- under 50
echo     299 as-any casts -- under 30
echo.
echo   Agent 1: module-fixer     (49 missing module errors)
echo   Agent 2: session-fixer    (65 sessionId + index.ts errors)
echo   Agent 3: any-killer-heavy (Top 18 files, ~323 any)
echo   Agent 4: any-killer-sweep (Remaining 62 files + verify)
echo.
echo ============================================================
echo.

echo Fixing line endings and permissions...
wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null"

echo.
echo Launching Phase 3 agent team in WSL2...
echo.

wsl --cd "%CD%" bash -c "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-phase3-errors.sh"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED - Check WSL and Claude Code installation
    echo.
)

echo.
pause
