@echo off
echo ============================================
echo  GoldLedger Routing Fix — Agent Team Launch
echo  7 agents: rfx-lead + 6 specialists
echo  52 tasks from ROUTING_DB_PLAN.md
echo ============================================
echo.

REM Launch tmux session in WSL2
powershell.exe -Command "& wsl.exe bash '/mnt/c/Users/Danie/Desktop/CBA Statements Parse/scripts/_start-routing-fix-tmux.sh'"

echo.
echo Waiting 18s for Claude to receive the prompt...
timeout /t 18 /nobreak > nul

echo Opening Windows Terminal attached to gl-routing-fix...
Start-Process -Wait -FilePath "powershell.exe" -ArgumentList "Start-Process wt -ArgumentList 'wsl.exe bash /mnt/c/Users/Danie/Desktop/_gl_routing_fix_attach.sh'"

echo Done.
