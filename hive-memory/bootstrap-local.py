"""
GoldLedger Hive Memory — Local Docker Bootstrap Script
Seeds the local Cognee instance (running via docker-compose.hive.yml)
with the same hive memory datasets as the cloud instance.

Usage:
  # 1. Start local stack first:
  #    docker compose -f hive-memory/docker-compose.hive.yml up -d
  # 2. Wait for healthy (30-60s), then run:
  #    python hive-memory/bootstrap-local.py

Local Cognee API: http://localhost:8000
Local MCP:       http://localhost:8001/mcp
"""

import asyncio
import os
import sys
import json
from pathlib import Path

try:
    import cognee
    USE_COGNEE_OSS = True
except ImportError:
    USE_COGNEE_OSS = False

try:
    import httpx
    USE_HTTPX = True
except ImportError:
    USE_HTTPX = False

COGNEE_API = "http://localhost:8000"

# Same datasets as cloud bootstrap
HIVE_DATASETS = {
    "hive_agent_decisions": "Decisions, architectural choices, and rationale made by agent teams",
    "hive_agent_patterns": "Successful patterns, workflows, and strategies used by agent teams",
    "hive_agent_errors": "Errors, bugs, and anti-patterns encountered and resolved by agents",
    "hive_agent_commits": "Commit history and change rationale from all agent team sessions",
    "hive_codebase_architecture": "GoldLedger system architecture, module boundaries, and design decisions",
    "hive_codebase_routes": "API route definitions, middleware, and endpoint contracts",
    "hive_codebase_schema": "Database schema, table relationships, and migration history",
    "hive_codebase_services": "Service layer implementations, business logic, and patterns",
    "hive_codebase_types": "TypeScript type definitions, interfaces, and contracts",
    "hive_audit_findings": "All audit findings from agent-team-4 and subsequent sweeps",
    "hive_audit_fixes": "All fixes applied, their root causes, and verification results",
    "hive_quality_rules": "Code quality rules, linting patterns, and enforcement hooks",
    "hive_gst_rules": "ATO GST rules, BAS calculations, and tax categorization logic",
    "hive_tax_knowledge": "Australian tax brackets, deductions, and compliance rules",
    "hive_financial_patterns": "Transaction patterns, merchant intelligence, and categorization",
}

SEED_CONTENT = {
    "hive_quality_rules": """
# GoldLedger Code Quality Rules

## Non-Negotiable Rules (enforced by hooks)
1. NEVER use @ts-ignore or @ts-expect-error — fix types properly
2. NEVER use `as any` — use proper types or `as unknown as T`
3. Run `cd server && npx tsc --noEmit` after EVERY server change — 0 errors required
4. Run `cd client && npx tsc --noEmit` after EVERY client change — 0 errors required
5. NEVER hardcode localhost URLs — use BASE_URL / API_URL constants
6. NEVER store secrets in code — use process.env.X
7. All route POST/PATCH/PUT handlers MUST use zValidator for body validation
8. All JWT payload access MUST have null guard
9. All parseInt() calls MUST have radix 10: parseInt(x, 10)
10. Commit after each logical fix: git add -A && git commit -m "fix(AREA): description"

## File Size Rules
- No file >300 lines (except tests/generated)
- Every loose .ts in services/ with matching directory MUST be a 1-line shim

## Commit Message Format
- fix(AREA): description — for bug fixes
- feat(AREA): description — for new features
- refactor(AREA): description — for refactoring
- fix(AUDIT-NNN): description — for audit fixes
- fix(TEAM6-NNN): description — for team 6 fixes

## Agent Team Rules
- Sonnet for worker agents (waves 1-2)
- Opus for reviewer agent (final wave)
- Plan approval required before any changes
- Delegate mode: lead coordinates only, does not implement
- Non-overlapping file ownership per teammate
- Message "DONE: agent-name" when complete
""",
    "hive_agent_patterns": """
# GoldLedger Agent Team Patterns

## Proven Wave Structure
Wave 1 (parallel): Independent domain workers
Wave 2 (after wave 1 done): Dependent workers (e.g., route validator after route cleaner)
Wave 3 (final): Opus reviewer — verify, fix stragglers, commit to main

## Effective Task File Structure
1. Priority/Wave declaration
2. Read First section (files to read before starting)
3. Files You Own (strict ownership)
4. Atomic Tasks with commit after each
5. Quality Gate (tsc check)
6. Done When criteria + message to lead

## Orchestration Prompt Pattern
- Specify model per agent (Sonnet workers, Opus reviewer)
- List all installed plugins and their slash commands
- Define GLOBAL RULES that all agents follow
- Define WAVE STRUCTURE explicitly
- Include PROJECT ROOT and SERVER/CLIENT ROOT paths

## Effective Fix Patterns
- Delete duplicate files before adding validation (team 5 pattern)
- Fix imports/barrels before fixing business logic
- Schema fixes before repository fixes
- Security middleware before route validation

## Anti-Patterns to Avoid
- Editing files owned by another teammate
- Making changes without reading the file first
- Committing without running tsc
- Using @ts-ignore as a shortcut
- Hardcoding values that should be env vars
""",
}


async def check_health():
    """Check if local Cognee is running."""
    if not USE_HTTPX:
        print("WARNING: httpx not installed. Run: pip install httpx")
        return False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{COGNEE_API}/api/v1/settings")
            return r.status_code == 200
    except Exception:
        return False


async def add_dataset_via_api(dataset_name: str, content: str) -> dict:
    """Add data to local Cognee via REST API."""
    async with httpx.AsyncClient(timeout=60) as client:
        # Use multipart form upload
        files = {"data": (f"{dataset_name}.txt", content.encode(), "text/plain")}
        data = {"dataset_name": dataset_name}
        r = await client.post(f"{COGNEE_API}/api/v1/add", files=files, data=data)
        r.raise_for_status()
        return r.json()


async def cognify_via_api(dataset_ids: list) -> dict:
    """Trigger cognify on local Cognee."""
    async with httpx.AsyncClient(timeout=300) as client:
        payload = {"dataset_ids": dataset_ids} if dataset_ids else {}
        r = await client.post(f"{COGNEE_API}/api/v1/cognify", json=payload)
        r.raise_for_status()
        return r.json()


async def bootstrap_local():
    print("=" * 60)
    print("GoldLedger Hive Memory — Local Docker Bootstrap")
    print("=" * 60)
    print(f"Cognee API: {COGNEE_API}")
    print()

    # Health check
    print("Checking local Cognee health...")
    healthy = await check_health()
    if not healthy:
        print("❌ Local Cognee is not running!")
        print()
        print("Start it with:")
        print("  docker compose -f hive-memory/docker-compose.hive.yml up -d")
        print("  # Wait 30-60 seconds for startup, then re-run this script")
        sys.exit(1)
    print("✅ Local Cognee is healthy")
    print()

    created = []
    failed = []

    for dataset_name, description in HIVE_DATASETS.items():
        print(f"Seeding: {dataset_name}")
        content = SEED_CONTENT.get(
            dataset_name,
            f"# {dataset_name}\n\n{description}\n\nThis dataset will be populated by agent teams as they work."
        )
        try:
            result = await add_dataset_via_api(dataset_name, content)
            print(f"  ✅ Added — {result}")
            created.append(dataset_name)
        except Exception as e:
            print(f"  ❌ Failed: {e}")
            failed.append(dataset_name)

    print()
    print("Triggering cognify on seeded datasets...")
    try:
        await cognify_via_api([])  # cognify all
        print("  ✅ Cognify triggered")
    except Exception as e:
        print(f"  ⚠️  Cognify error (may still be processing): {e}")

    print()
    print("=" * 60)
    print("Local Bootstrap Complete")
    print("=" * 60)
    print(f"✅ Seeded: {len(created)} datasets")
    print(f"❌ Failed: {len(failed)} datasets")
    print()
    print("MCP server available at: http://localhost:8001/mcp")
    print()
    print("Wire into Claude Code:")
    print("  claude mcp add --transport http cognee-hive http://localhost:8001/mcp -s project")
    print()
    print("Test search:")
    print('  curl -X POST http://localhost:8000/api/v1/search \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"query_text": "What are the code quality rules?", "query_type": "GRAPH_COMPLETION"}\'')


if __name__ == "__main__":
    asyncio.run(bootstrap_local())
