# Agent R08: Database Schema Gap Researcher

## Role

Perform a comprehensive audit of both database schemas (SQLite and PostgreSQL), identify all gaps, and design the schema strategy for Waves 11-24.

## Phase: A (Research — Start Immediately, Parallel with R01-R07, R09-R10)

## Research Tasks

### 1. SQLite Schema Audit

- [ ] Read `server/src/schema.ts` — list ALL 52 tables with:
  - Table name
  - Column names and types
  - Foreign key relationships
  - Indexes
- [ ] Group tables by domain: auth, accounts, transactions, tax, payroll, analytics, RAG, etc.
- [ ] Identify any schema inconsistencies or missing indexes

### 2. PostgreSQL Schema Audit

- [ ] Read `server/src/db/postgres-schema.ts` — list ALL 21 tables with same detail
- [ ] Produce the EXACT gap list: which 31 tables exist in SQLite but NOT in PostgreSQL
- [ ] For each missing table, note if it's critical (used by agents/routes) or secondary

### 3. PostgreSQL Sync Strategy

- [ ] Propose approach: Should we sync all 31 missing tables at once (dedicated wave) or incrementally per wave?
- [ ] Assess: Which missing tables are blocking current functionality?
- [ ] Assess: Are there tables in PostgreSQL that DON'T exist in SQLite? (e.g., userCategories, debtPayoffScenarios)
- [ ] Propose: Should PostgreSQL be the primary database going forward? Or keep dual-schema?

### 4. Schema Projections for Waves 11-24

- [ ] Based on existing wave plans (1-10) and new requirements, project ALL new tables needed:
  - Wave 11: inventory_items, inventory_stock, inventory_movements, warehouses, bank_recon_rules, bank_recon_sessions, bank_recon_matches (already partially defined)
  - Wave 12: fixed_assets, asset_depreciation, entities, entity_relationships, inter_entity_transactions
  - Wave 13: financial_reports, budget_categories, budget_items, budget_vs_actual
  - Wave 14: ocr_documents, ocr_results, payment_matches, match_rules
  - Wave 15: predictions, compliance_checks, compliance_rules
  - Wave 16: custom_datapoints, datapoint_relationships (Cognee-side, may not need SQL tables)
  - Wave 17: temporal_queries, cross_module_links (may be Cognee-side)
  - Wave 18: admin_settings, agent_configs, agent_logs, system_health
  - Wave 19: graph_snapshots, graph_layouts (for 3D viz persistence)
  - Wave 20: cdr_data_holders, cdr_products, cdr_lending_rates, cdr_fees, cdr_features
  - Wave 21: market_data, market_indicators, market_news
  - Wave 22: (schema changes depend on SDK choice)
  - Wave 23: trading_accounts, investment_positions, universal_knowledge_cache
  - Wave 24: tenants, tenant_users, roles, permissions, user_sessions
- [ ] Estimate total new tables: ~50-60 additional tables

### 5. Migration Strategy

- [ ] Current migrations: 0009-0011 (existing), 0012-0022 (planned in Waves 1-10)
- [ ] Project migration numbers for Waves 11-24: 0023-0036+
- [ ] Propose: Should we use Drizzle migrations instead of raw SQL?
- [ ] Document the dual-schema pattern: every table in BOTH schema.ts AND postgres-schema.ts

### 6. ID Strategy & Conventions

- [ ] Document current ID strategy: UUID text strings
- [ ] Document amount convention: cents (integer)
- [ ] Document timestamp convention: text (SQLite) vs timestamptz (PostgreSQL)
- [ ] Identify any inconsistencies in naming conventions across tables

## Output Format

Write findings to `wave0-research/R08-database-schema-gaps.md` with these sections:

1. **SQLite Inventory** — All 52 tables grouped by domain
2. **PostgreSQL Inventory** — All 21 tables
3. **Gap Analysis** — 31 missing tables with criticality assessment
4. **Sync Strategy** — Recommended approach for closing the gap
5. **New Table Projections** — Tables needed per wave (11-24)
6. **Migration Plan** — Numbering, approach, dual-schema compliance
7. **Conventions** — ID, amount, timestamp, naming standards

## Completion

- [ ] All sections populated with specific table names and column details
- [ ] Create marker file: `.agent-done-R08`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Drizzle ORM Schema Reading** | Parse sqliteTable/pgTable definitions, understand column types, relations | Expert |
| **SQL Table Comparison** | Diff two schema files, identify missing tables, columns, indexes | Expert |
| **Migration Strategy** | Design sequential migration files, handle dual-schema sync | Expert |
| **Schema Projection** | Estimate new tables needed based on feature requirements | Advanced |
| **Database Normalization** | Assess normalization levels, identify redundancy, propose improvements | Advanced |
| **Performance Index Design** | Recommend indexes for common query patterns (userId+date, category agg) | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel schema analysis | Advanced |

## Sub-Agent Delegation Plan

```
R08 (Database Schema Gap Researcher):
├── Sub-agent A: SQLite Schema Inventory
│   ├── Read server/src/schema.ts (all 52 tables)
│   ├── List every table: name, columns, types, FKs, indexes
│   ├── Group by domain (auth, accounts, transactions, tax, payroll, etc.)
│   └── Output: wave0-research/.scratch-R08-sqlite.md
│
├── Sub-agent B: PostgreSQL Schema Inventory
│   ├── Read server/src/db/postgres-schema.ts (all 21 tables)
│   ├── List every table with same detail as Sub-agent A
│   ├── Identify tables in PG but NOT in SQLite
│   └── Output: wave0-research/.scratch-R08-postgres.md
│
├── Sub-agent C: New Table Projections (Waves 11-24)
│   ├── Based on wave plans and new requirements, list all new tables
│   ├── For each: table name, estimated columns, which wave creates it
│   ├── Project migration numbering (0023+)
│   └── Output: wave0-research/.scratch-R08-projections.md
│
└── R08 Parent: Produce gap analysis and sync strategy
    ├── Read all .scratch-R08-*.md files
    ├── Diff SQLite vs PostgreSQL to produce exact 31-table gap list
    ├── Recommend sync strategy (batch vs incremental)
    ├── Write final wave0-research/R08-database-schema-gaps.md
    └── Delete scratch files
```

### Delegation Rules for R08

- Sub-agents write ONLY to `wave0-research/.scratch-R08-*.md` files
- Sub-agents A and B must use identical table format for easy diffing
- Sub-agent C should cross-reference with R06's wave plan analysis

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
