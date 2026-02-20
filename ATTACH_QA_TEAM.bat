@echo off
REM Re-attach to the running GoldLedger QA agent team
echo Attaching to goldledger-qa tmux session...
wsl -e bash -c "tmux attach -t goldledger-qa || echo 'Session not found. Run LAUNCH_QA_TEAM.bat first.'"
