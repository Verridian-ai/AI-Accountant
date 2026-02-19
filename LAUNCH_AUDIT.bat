@echo off
title GoldLedger Audit Agent Team
color 0A

echo.
echo  ============================================================
echo    GoldLedger Full Audit - Agent Team Launcher
echo  ============================================================
echo.
echo  This will open a WSL2 terminal with Claude Code in agent
echo  team mode. 6 specialist agents will audit your codebase:
echo.
echo    * audit-typescript  - TS errors, any usage, strict
echo    * audit-security    - Auth, JWT, tenant isolation
echo    * audit-routes      - zValidator, middleware, naming
echo    * audit-schema      - Drizzle, currency types, FKs
echo    * audit-services    - File sizes, business logic
echo    * audit-client      - React 19, hooks, TanStack Query
echo.
echo  Cognee hive memory will store all findings.
echo.
echo  ============================================================
echo.
echo  Opening WSL2 terminal...
echo.

wsl -e bash -c "bash '/mnt/c/Users/Danie/Desktop/CBA Statements Parse/scripts/launch-audit-team.sh'"

echo.
echo  Audit session ended.
pause
