"""
GoldLedger Hive Memory — Cloud Bootstrap Script
Creates the hive-memory dataset on Cognee Cloud and seeds it with
agent team knowledge, codebase structure, and GoldLedger context.

Usage:
  pip install cogwit-sdk
  python hive-memory/bootstrap-cloud.py

API Key: stored in COGWIT_API_KEY env var or server/.env
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env from server directory
env_path = Path(__file__).parent.parent / "server" / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

try:
    from cogwit_sdk import cogwit, CogwitConfig
except ImportError:
    print("ERROR: cogwit-sdk not installed. Run: pip install cogwit-sdk")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

COGWIT_API_KEY = os.getenv("COGWIT_API_KEY", "f056b134c9fe54f4adb59bf77b855af01a9ce5081886e3d7")

# Hive Memory Datasets — one per knowledge domain
HIVE_DATASETS = {
    # ── Agent Team Meta-Knowledge ──────────────────────────────────────────
    "hive_agent_decisions": "Decisions, architectural choices, and rationale made by agent teams",
    "hive_agent_patterns": "Successful patterns, workflows, and strategies used by agent teams",
    "hive_agent_errors": "Errors, bugs, and anti-patterns encountered and resolved by agents",
    "hive_agent_commits": "Commit history and change rationale from all agent team sessions",

    # ── GoldLedger Codebase Knowledge ─────────────────────────────────────
    "hive_codebase_architecture": "GoldLedger system architecture, module boundaries, and design decisions",
    "hive_codebase_routes": "API route definitions, middleware, and endpoint contracts",
    "hive_codebase_schema": "Database schema, table relationships, and migration history",
    "hive_codebase_services": "Service layer implementations, business logic, and patterns",
    "hive_codebase_types": "TypeScript type definitions, interfaces, and contracts",

    # ── Audit & Quality Knowledge ──────────────────────────────────────────
    "hive_audit_findings": "All audit findings from agent-team-4 and subsequent sweeps",
    "hive_audit_fixes": "All fixes applied, their root causes, and verification results",
    "hive_quality_rules": "Code quality rules, linting patterns, and enforcement hooks",

    # ── Australian Finance Domain Knowledge ───────────────────────────────
    "hive_gst_rules": "ATO GST rules, BAS calculations, and tax categorization logic",
    "hive_tax_knowledge": "Australian tax brackets, deductions, and compliance rules",
    "hive_financial_patterns": "Transaction patterns, merchant intelligence, and categorization",
}

# Seed content for each dataset
HIVE_SEED_CONTENT = {
    "hive_agent_decisions": """
# GoldLedger Agent Team Decision Log

## Architecture Decisions

### Decision: Neon Cloud PostgreSQL as primary database
- Date: 2026-02-17
- Rationale: Serverless scaling, built-in branching for AI/masked data, Sydney region for AU compliance
- Impact: All 128 accounting tables on Neon, local PG only for Cognee/AI tables

### Decision: Hono framework for API server
- Date: 2025-12-01
- Rationale: TypeScript-native, edge-compatible, Zod integration via @hono/zod-validator
- Impact: All routes use Hono, tenantAuthMiddleware pattern for multi-tenancy

### Decision: Drizzle ORM with SQLite-compat proxy
- Date: 2025-12-01
- Rationale: Type-safe queries, schema-as-code, wrapPgDb() proxy for .get()/.all()/.run() compat
- Impact: All DB access through typed-queries.ts helpers

### Decision: Agent teams use tmux + claude-code CLI
- Date: 2026-02-15
- Rationale: Parallel agent execution, session persistence, plan approval gates
- Impact: All agent teams launched via launch-team.sh, 3-4 wave structure

### Decision: Reviewer agent always uses claude-opus-4-5
- Date: 2026-02-18
- Rationale: Final verification requires highest reasoning capability
- Impact: Wave 3/4 reviewer in every team uses Opus, workers use Sonnet

## Code Quality Rules
- NEVER use @ts-ignore or @ts-expect-error
- NEVER use `as any` — fix types properly
- All route POST/PATCH/PUT must use zValidator
- All JWT payload access must have null guard
- All parseInt() must have radix 10
- Run tsc --noEmit after every change — 0 errors required
""",

    "hive_codebase_architecture": """
# GoldLedger Codebase Architecture

## Stack
- Server: Hono + TypeScript + Drizzle ORM + Neon PostgreSQL
- Client: React 19 + TanStack Query + Zod + TailwindCSS + shadcn/ui
- Auth: JWT + tenantAuthMiddleware (X-Tenant-Id header required)
- AI: Claude Sonnet/Opus via Anthropic SDK + 26 specialized agents
- Memory: Cognee knowledge graph (local Docker + Cloud)

## Server Structure
server/src/
├── index.ts          — Hono app, middleware, route mounts
├── schema/           — Drizzle schema (19 files, 128+ tables)
│   ├── connection.ts — Neon PostgreSQL connection + wrapPgDb proxy
│   ├── core.ts       — users, sessions
│   ├── banking.ts    — accounts, transactions
│   ├── transactions.ts — transaction history
│   └── ...
├── routes/           — Hono route handlers (63 files)
├── services/         — Business logic (modular directories + shim files)
│   ├── claude/       — AI agent orchestration
│   ├── cognee/       — Knowledge graph integration
│   ├── rbac/         — Role-based access control
│   └── ...
├── repositories/     — Data access layer
├── db/               — DB utilities, typed queries
└── validation/       — Zod schemas

## Client Structure
client/src/
├── App.tsx           — Root component, auth state, data fetching
├── routes.tsx        — Lazy route definitions
├── api/              — API client functions
├── features/         — Feature modules (transactions, accounts, tax, etc.)
└── components/       — Shared UI components

## Key Patterns
- tenantAuthMiddleware: requires JWT + X-Tenant-Id header on all protected routes
- wrapPgDb proxy: adds .get()/.all()/.run() to Drizzle Postgres for SQLite compat
- Barrel shims: loose .ts files in services/ re-export from matching directories
- Integer money: ALL currency amounts in cents (integer), never float
""",

    "hive_audit_findings": """
# GoldLedger Audit Findings Summary (agent-team-4, 2026-02-18)

## Total Issues Found: 186 across 6 domains

## Critical Issues (24 total)
- 14 critical API endpoint issues (duplicate routes, missing auth, no validation)
- 3 critical type safety issues (non-null assertions, unsafe casts)
- 4 critical middleware/security issues
- 3 critical schema/DB issues (missing migrations, missing exports)

## Key Findings by Domain

### API Endpoints (62 issues)
- tax-ext.ts: 11 routes exact duplicate of gst-tax.ts — DELETED
- agents-python.ts: orphan, duplicates agents-ext.ts — DELETED
- charts-ext.ts: orphan, duplicates charts.ts — DELETED
- ap-ext.ts: orphan, duplicates ap-extras.ts — DELETED
- 20 bare /api mounts creating route shadowing risk
- 69 unvalidated c.req.json() calls across route handlers
- Auth routes (login/register) had no Zod validation

### Type Safety (22 issues)
- c.req.query('sessionId')! — non-null assertion on undefined
- c.req.param('agentType') as AgentType — unsafe cast without runtime check
- 30+ JWT payload extractions without null guard
- 40+ parseInt() calls without radix 10

### Security (21 issues)
- CORS applied after route mounts (middleware ordering bug)
- Rate limiter not gated by NODE_ENV
- /api/invitations/accept in publicPaths (auth bypass)
- No global body size limit
- CSP unsafe-inline in production config

### Schema/DB (28 issues)
- 57 tables defined in schema but not migrated to Neon
- 7 payroll tables missing from db/index.ts exports
- Multiple real() columns for currency amounts (should be integer cents)
- Hardcoded userId = 'default' in ui.ts, cdr-schema.ts, market-schema.ts
- Missing FK constraints on cognee tables
- CURRENT_TIMESTAMP stored as literal string in PostgreSQL

## All Issues Fixed By: agent-team-5 (2026-02-18)
See: agent-team-5/FIX-SUMMARY.md
""",

    "hive_gst_rules": """
# Australian GST Rules for GoldLedger

## GST Categories
- taxable_10: Standard 10% GST (most goods and services)
- gst_free: 0% GST (fresh food, medical, education, exports)
- input_taxed: No GST credit claimable (financial services, residential rent)
- capital: Capital acquisitions (GST credits on business portion)
- private: Private/personal use (no GST credit)

## BAS Periods (Australian Financial Year: Jul 1 - Jun 30)
- Q1: July - September
- Q2: October - December
- Q3: January - March
- Q4: April - June

## BAS Labels
- G1: Total sales (including GST)
- G2: Export sales
- G3: Other GST-free sales
- G10: Capital purchases
- G11: Non-capital purchases
- 1A: GST on sales (G1 × 1/11)
- 1B: GST credits on purchases (G10+G11 × 1/11)

## Common Merchant Categories
- Supermarkets (Woolworths, Coles, Aldi): Mixed — fresh food GST-free, other taxable
- Fuel (BP, Shell, Caltex): Taxable 10%
- Medical (doctors, hospitals): GST-free
- Insurance: Input-taxed
- Bank fees: Input-taxed
- Rent (residential): Input-taxed
- Rent (commercial): Taxable 10%
- Utilities (electricity, gas, water): Taxable 10%
- Internet/phone: Taxable 10%
- Software subscriptions: Taxable 10%

## ABN Validation (Australian Business Number)
Algorithm: subtract 1 from first digit, multiply by weights [10,1,3,5,7,9,11,13,15,17,19], sum must be divisible by 89
""",
}


async def bootstrap_cloud():
    """Create hive memory datasets on Cognee Cloud and seed with initial knowledge."""

    print("=" * 60)
    print("GoldLedger Hive Memory — Cloud Bootstrap")
    print("=" * 60)
    print(f"API Key: {COGWIT_API_KEY[:12]}...{COGWIT_API_KEY[-4:]}")
    print(f"Datasets to create: {len(HIVE_DATASETS)}")
    print()

    # Initialize SDK
    config = CogwitConfig(api_key=COGWIT_API_KEY)
    client = cogwit(config)

    created_datasets = {}
    failed_datasets = []

    # Create and seed each dataset
    for dataset_name, description in HIVE_DATASETS.items():
        print(f"Creating dataset: {dataset_name}")
        print(f"  Description: {description[:60]}...")

        try:
            # Add description as initial content
            seed_content = HIVE_SEED_CONTENT.get(
                dataset_name,
                f"# {dataset_name}\n\n{description}\n\nThis dataset will be populated by agent teams."
            )

            result = await client.add(
                data=seed_content,
                dataset_name=dataset_name,
            )

            print(f"  ✅ Created — dataset_id: {result.dataset_id}")
            created_datasets[dataset_name] = result.dataset_id

        except Exception as e:
            print(f"  ❌ Failed: {e}")
            failed_datasets.append(dataset_name)

    print()
    print("=" * 60)
    print("Cognifying seeded datasets (building knowledge graphs)...")
    print("=" * 60)

    # Cognify the seeded datasets
    seeded_ids = [
        created_datasets[name]
        for name in HIVE_SEED_CONTENT.keys()
        if name in created_datasets
    ]

    if seeded_ids:
        try:
            cognify_result = await client.cognify(dataset_ids=seeded_ids)
            for dataset_id, status in cognify_result.items():
                print(f"  {dataset_id}: {status.status}")
        except Exception as e:
            print(f"  ❌ Cognify failed: {e}")

    print()
    print("=" * 60)
    print("Bootstrap Complete")
    print("=" * 60)
    print(f"✅ Created: {len(created_datasets)} datasets")
    print(f"❌ Failed:  {len(failed_datasets)} datasets")

    if failed_datasets:
        print(f"\nFailed datasets: {', '.join(failed_datasets)}")

    # Write dataset IDs to env file for agent use
    env_output = "\n".join([
        f"HIVE_{name.upper()}_DATASET_ID={dataset_id}"
        for name, dataset_id in created_datasets.items()
    ])

    output_path = Path(__file__).parent / "hive-dataset-ids.env"
    output_path.write_text(f"# Cognee Cloud Hive Memory Dataset IDs\n# Generated by bootstrap-cloud.py\n\n{env_output}\n")
    print(f"\nDataset IDs written to: {output_path}")
    print("\nNext steps:")
    print("  1. Start local Docker: docker compose -f hive-memory/docker-compose.hive.yml up -d")
    print("  2. Wire MCP: claude mcp add --transport http cognee-hive http://localhost:8001/mcp -s project")
    print("  3. Verify: curl http://localhost:8001/health")


if __name__ == "__main__":
    asyncio.run(bootstrap_cloud())
