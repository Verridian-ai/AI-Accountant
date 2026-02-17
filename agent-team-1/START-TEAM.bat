@echo off
echo.
echo ============================================================
echo   GoldLedger Refactoring - Agent Team Launcher
echo ============================================================
echo.
echo Launching agent team via WSL + tmux...
echo.
wsl bash -c "cd '/mnt/c/Users/Danie/Desktop/CBA Statements Parse' && chmod +x agent-team/launch-team.sh && ./agent-team/launch-team.sh"
pause

