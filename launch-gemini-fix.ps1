# ============================================================
# GoldLedger — Gemini Fix Wave: Client TypeScript Error Resolution
# 4 Agents: API Stubs → Type Annotations → Type Compat → Build Verify
# ============================================================
# Fixes all 298 client TypeScript errors and gets Docker building.
# Uses Gemini CLI (--yolo mode) in PowerShell — no tmux/WSL needed.
# Run: .\launch-gemini-fix.ps1
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = Get-Location }

Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  GoldLedger — Gemini Fix Wave: TypeScript Error Resolution" -ForegroundColor Magenta
Write-Host "  4 Agents | Sequential | Gemini CLI --yolo | PowerShell" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Agent 01: API Stubs & Missing Exports (~197 errors)" -ForegroundColor Cyan
Write-Host "  Agent 02: Type Annotations (~76 errors)" -ForegroundColor Cyan
Write-Host "  Agent 03: Type Compatibility (~25 errors)" -ForegroundColor Cyan
Write-Host "  Agent 04: Build Verifier & Docker" -ForegroundColor Cyan
Write-Host ""

# Step 1: Prerequisites
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow
$geminiVersion = & gemini --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Gemini CLI not found!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Gemini CLI v$geminiVersion" -ForegroundColor Green

$nodeVersion = & node --version 2>&1
Write-Host "  OK Node.js $nodeVersion" -ForegroundColor Green

# Step 2: Verify required files
Write-Host "[2/4] Verifying task files..." -ForegroundColor Yellow
$requiredFiles = @(
    "gemini-fix-orchestration-prompt.md",
    "gemini-fix-agent-tasks/01-api-stubs.md",
    "gemini-fix-agent-tasks/02-type-annotations.md",
    "gemini-fix-agent-tasks/03-type-compatibility.md",
    "gemini-fix-agent-tasks/04-build-verifier.md"
)
$missing = 0
foreach ($f in $requiredFiles) {
    $fullPath = Join-Path $ProjectDir $f
    if (Test-Path $fullPath) {
        Write-Host "  OK $f" -ForegroundColor Green
    } else {
        Write-Host "  X MISSING: $f" -ForegroundColor Red
        $missing++
    }
}
if ($missing -gt 0) {
    Write-Host "  X $missing required files missing! Aborting." -ForegroundColor Red
    exit 1
}

# Step 3: Clean old marker files
Write-Host "[3/4] Cleaning old marker files..." -ForegroundColor Yellow
Remove-Item -Path (Join-Path $ProjectDir ".agent-done-GF-*") -ErrorAction SilentlyContinue
Write-Host "  OK Old markers cleaned" -ForegroundColor Green

# Step 4: Launch agents sequentially
Write-Host "[4/4] Launching agents..." -ForegroundColor Yellow
Write-Host ""

$agents = @(
    @{
        Name = "Agent 01: API Stubs & Missing Exports"
        Marker = ".agent-done-GF-01"
        Prompt = "You are Agent 01 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview, then read gemini-fix-agent-tasks/01-api-stubs.md for your specific task. Add ALL missing exports to client/src/api.ts. Also add missing methods to existing API objects (analyticsApi, taxApi, transactionsApi). When completely done, create a file called .agent-done-GF-01 containing DONE."
    },
    @{
        Name = "Agent 02: Type Annotations"
        Marker = ".agent-done-GF-02"
        Prompt = "You are Agent 02 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/02-type-annotations.md for your task. Fix all TS7006 implicit any types and TS18046 unknown type errors across all client component files. When completely done, create a file called .agent-done-GF-02 containing DONE."
    },
    @{
        Name = "Agent 03: Type Compatibility"
        Marker = ".agent-done-GF-03"
        Prompt = "You are Agent 03 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/03-type-compatibility.md for your task. Fix all remaining type compatibility errors (TS2322, TS2345, TS2769, TS2352, TS2304, TS2307). When completely done, create a file called .agent-done-GF-03 containing DONE."
    },
    @{
        Name = "Agent 04: Build Verifier & Docker"
        Marker = ".agent-done-GF-04"
        Prompt = "You are Agent 04 in a 4-agent team fixing TypeScript errors in a project at the current directory. Read gemini-fix-orchestration-prompt.md for overview and gemini-fix-agent-tasks/04-build-verifier.md for your task. Verify tsc passes with zero errors on both client and server, update docker-compose.yml to load all migrations, run docker compose build. When completely done, create a file called .agent-done-GF-04 containing DONE."
    }
)

$agentNum = 0
foreach ($agent in $agents) {
    $agentNum++
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  $($agent.Name)" -ForegroundColor Magenta
    Write-Host "  Started: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""

    & gemini --yolo -p $agent.Prompt

    $markerPath = Join-Path $ProjectDir $agent.Marker
    if (Test-Path $markerPath) {
        Write-Host ""
        Write-Host "  OK $($agent.Name) completed (marker found)" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  WARN $($agent.Name) finished but no marker file found" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  Gemini Fix Wave Complete!" -ForegroundColor Magenta
Write-Host "  Finished: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

# Summary
Write-Host "Marker files:" -ForegroundColor Cyan
foreach ($agent in $agents) {
    $markerPath = Join-Path $ProjectDir $agent.Marker
    if (Test-Path $markerPath) {
        Write-Host "  [X] $($agent.Marker)" -ForegroundColor Green
    } else {
        Write-Host "  [ ] $($agent.Marker)" -ForegroundColor Red
    }
}

