@echo off
REM ============================================================
REM  GoldLedger QA Agent Team Launcher
REM  Opens a NEW external Windows Terminal with the tmux session
REM  10 agents: 5 Auditors (Phase 1) + 5 Fixers (Phase 2)
REM ============================================================

echo.
echo  GoldLedger QA Agent Team
echo  ========================
echo  10 agents: 5 Auditors then 5 Fixers
echo  Runs OUTSIDE the IDE in Windows Terminal
echo.

REM Check if Windows Terminal is available
where wt.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  Opening Windows Terminal with tmux session...
    echo.
    wt.exe --title "GoldLedger QA Team" --window 0 new-tab --profile "Ubuntu" -- wsl -e bash -c "bash '/mnt/c/Users/Danie/Desktop/CBA Statements Parse/scripts/launch-qa-team.sh'"
    echo.
    echo  Windows Terminal is opening!
    echo.
    echo  WHAT TO DO:
    echo  1. Wait for Claude to start (you'll see the Claude prompt)
    echo  2. Paste the mission prompt from: scripts\QA_TEAM_PROMPT.txt
    echo  3. Watch 10 agents work in split panes!
    echo.
    echo  RE-ATTACH ANYTIME:
    echo  wsl -e bash -c "tmux attach -t goldledger-qa"
) else (
    REM Fallback: use cmd with WSL
    echo  Windows Terminal not found. Opening with cmd...
    echo.
    start "GoldLedger QA Team" cmd /k wsl -e bash -c "bash '/mnt/c/Users/Danie/Desktop/CBA Statements Parse/scripts/launch-qa-team.sh'"
)

echo.
echo  Mission prompt is at: scripts\QA_TEAM_PROMPT.txt
echo.
pause
