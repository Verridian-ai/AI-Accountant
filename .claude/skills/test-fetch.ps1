# Test fetch script
$ErrorActionPreference = "SilentlyContinue"
$SKILLS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$OK = 0
$FAIL = 0

function Get-Skill {
    param(
        [string]$name,
        [string]$repo,
        [string]$path,
        [string]$branch = "main"
    )
    
    $out = Join-Path $SKILLS_DIR "$name.md"
    
    if (Test-Path $out) {
        Write-Host "  ✓ (exists) $name" -ForegroundColor Green
        $script:OK++
        return
    }
    
    $url = "https://raw.githubusercontent.com/$repo/$branch/$path"
    
    try {
        $content = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $content.Content | Out-File -FilePath $out -Encoding UTF8
        Write-Host "  ✓ $name" -ForegroundColor Green
        $script:OK++
    }
    catch {
        # Try master branch
        $url = "https://raw.githubusercontent.com/$repo/master/$path"
        try {
            $content = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            $content.Content | Out-File -FilePath $out -Encoding UTF8
            Write-Host "  ✓ $name" -ForegroundColor Green
            $script:OK++
        }
        catch {
            Write-Host "  ✗ $name (failed to fetch)" -ForegroundColor Red
            $script:FAIL++
        }
    }
}

Write-Host ""
Write-Host "=== Testing Skill Fetch ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[ Test Skills ]" -ForegroundColor Yellow
Get-Skill "neon-postgres" "neondatabase/agent-skills" "skills/neon-postgres/SKILL.md"
Get-Skill "obra-tdd" "obra/superpowers" "skills/test-driven-development/SKILL.md"

Write-Host ""
Write-Host "Done: $OK fetched, $FAIL failed"
$TOTAL = (Get-ChildItem "$SKILLS_DIR\*.md" -ErrorAction SilentlyContinue).Count
Write-Host "Total .md files in skills/: $TOTAL"

