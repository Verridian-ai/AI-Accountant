@echo off
title GoldLedger - Final Delivery
cd /d "%~dp0"

echo.
echo ============================================================
echo   GOLDLEDGER FINAL DELIVERY
echo   Usage: RUN_FINAL_DELIVERY.bat [a/b/c/final]
echo.
echo   a     = Phase A: Build Fix (4 agents) - DEFAULT
echo   b     = Phase B: Neon Cloud + v4 Masking (3 agents)
echo   c     = Phase C: Integration Verification (1 agent)
echo   final = Phase FINAL: Zero-Any + Commit + Verify (3 agents)
echo ============================================================
echo.

set PHASE=%1
if "%PHASE%"=="" set PHASE=a

call scripts\refactor-agent-teams\final-delivery-startup.bat %PHASE%
