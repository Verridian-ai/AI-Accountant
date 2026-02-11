@echo off
echo.
echo ============================================================
echo   CBA Statements Parse - Agent Team Launcher
echo   Verridian AI
echo ============================================================
echo.
echo Launching agent team via WSL + tmux...
echo.
wsl bash -c "cd '/mnt/c/Users/Danie/Desktop/CBA Statements Parse/cba-statements' && chmod +x agent-team/launch-team.sh && ./agent-team/launch-team.sh"
pause
