@echo off
title GOLDLEDGER - FINAL DELIVERY Agent Team
cd /d "%~dp0..\.."

set PHASE=%1
if "%PHASE%"=="" set PHASE=a

echo.
echo ============================================================
echo   GOLDLEDGER FINAL DELIVERY
echo ============================================================
echo   Project: %CD%
echo.
if "%PHASE%"=="a" (
    echo   Phase A: Build Fix ^(4 Opus 4.6 Agents^)
    echo.
    echo   Agent 1: module-fixer       ^(Create 25+ missing modules^)
    echo   Agent 2: session-fixer      ^(Fix sessionId + index.ts^)
    echo   Agent 3: any-killer-heavy   ^(Top 18 files, 323 any^)
    echo   Agent 4: any-killer-sweep   ^(Remaining 62 files + Docker^)
)
if "%PHASE%"=="b" (
    echo   Phase B: Neon Cloud + v4 Masking ^(3 Agents^)
    echo.
    echo   Agent 1: neon-deployer      ^(Neon setup + data migration^)
    echo   Agent 2: v4-architect       ^(Streaming pipeline^)
    echo   Agent 3: bridge-wirer       ^(Wire Neon into services^)
)
if "%PHASE%"=="c" (
    echo   Phase C: Integration Verification ^(1 Agent^)
    echo.
    echo   Agent 1: integration-verifier ^(End-to-end data flow test^)
)
if "%PHASE%"=="final" (
    echo   Phase FINAL: Zero-Any + Commit + Verify ^(3 Agents^)
    echo.
    echo   Agent 1: any-killer-client   ^(Eliminate 453 any from client^)
    echo   Agent 2: docker-verifier     ^(Rebuild + verify full stack^)
    echo   Agent 3: git-committer       ^(Commit all changes to branch^)
)
echo.
echo ============================================================
echo.

echo Fixing line endings and permissions...
wsl --cd "%CD%" bash -c "sed -i 's/\r$//' scripts/refactor-agent-teams/*.sh 2>/dev/null; chmod +x scripts/refactor-agent-teams/*.sh 2>/dev/null"

echo.
echo Launching Final Delivery %PHASE% in WSL2...
echo.

wsl --cd "%CD%" bash -c "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1; ./scripts/refactor-agent-teams/launch-final-delivery.sh %PHASE%"

if errorlevel 1 (
    echo.
    echo LAUNCH FAILED - Check WSL and Claude Code installation
    echo.
)

echo.
pause
