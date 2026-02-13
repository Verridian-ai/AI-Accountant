# Agent R04: Database Schema Gap Analyzer

## Role

Analyze the current database schema state and map ALL tables that Waves 1-10 need to create. Produce a complete table-by-table specification that W01 can use for migration files.

## Phase: A (Research — Start Immediately, Parallel with R01-R03, R05-R10)

## Research Tasks

### 1. Current Schema Inventory

- [ ] Read `server/src/schema.ts` — list ALL SQLite tables with column names and types
- [ ] Read `server/src/db/postgres-schema.ts` — list ALL PostgreSQL tables
- [ ] Produce GAP TABLE: tables in SQLite but NOT in PostgreSQL (the "31 missing tables" from Wave 0 analysis)
- [ ] Check for any NEW tables added by Waves 11-16 execution

### 2. Wave 1-10 Required Tables

From `docs/Agent planning chat.md`, extract ALL new tables per wave:

- [ ] **Wave 1**: No new SQLite tables, but 31 PostgreSQL tables to sync
- [ ] **Wave 2**: agent_mutations, agent_sessions, agent_audit_log (3 tables)
- [ ] **Wave 3**: cognee_user_accounts, cognee_sessions (2 tables)
- [ ] **Wave 4**: employees, employee_bank_details, employee_super_funds, employee_tax_declarations, pay_categories, pay_structures, employee_documents (7 tables)
- [ ] **Wave 5**: pay_runs, pay_run_lines, pay_run_summary, leave_types, leave_balances, leave_requests, leave_transactions (7 tables)
- [ ] **Wave 6**: stp_events, stp_employee_ytd, payslips, awards, award_rates, timesheets, timesheet_entries (7 tables)
- [ ] **Wave 7**: customers, customer_contacts, invoices, invoice_lines, invoice_number_sequences, invoice_payments (6 tables)
- [ ] **Wave 8**: recurring_invoices, payment_gateways, dunning_sequences, dunning_history, customer_subscriptions (5 tables)
- [ ] **Wave 9**: currencies, exchange_rates, invoice_templates, customer_statements (4 tables)
- [ ] **Wave 10**: suppliers, bills, bill_lines, bill_payments, purchase_orders, po_lines, po_receipts, po_receipt_lines, supplier_payment_runs, supplier_payment_run_items (10 tables)

### 3. Cross-Reference with Wave 11-24 Tables

- [ ] Check if any Wave 11-24 tables overlap with or depend on Wave 1-10 tables
- [ ] Verify migration numbering doesn't conflict (Waves 1-10: 0013-0022, Waves 11-24: 0023-0036)

### 4. Column-Level Analysis

- [ ] For each new table, verify column types follow existing patterns (UUID text IDs, amounts in cents, timestamps)
- [ ] Identify foreign key relationships between new tables and existing tables
- [ ] Note any tables that need indexes for common query patterns

## Output Format

Write findings to `wave0b-research/R04-schema-gaps.md` with:

1. **Current Schema State** — SQLite count, PostgreSQL count, gap list
2. **Wave-by-Wave New Tables** — Complete table specs with columns and types
3. **Migration Plan** — 10 migration files (0013-0022) with table assignments
4. **Foreign Key Map** — All FK relationships between new and existing tables
5. **Index Recommendations** — Suggested indexes for query performance
6. **Total New Tables** — Sum across all 10 waves

## Completion

- [ ] All tables documented with full column specifications
- [ ] Create marker file: `.agent-done-0B-R04`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Database Design | Schema analysis and table design | Expert |
| Migration Planning | SQL migration file planning | Expert |
| Schema Comparison | Diff analysis between dual schemas | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read and inventory both schema files (SQLite + PostgreSQL)
- **Sub-agent B**: Extract Wave 1-5 table specs from planning doc
- **Sub-agent C**: Extract Wave 6-10 table specs from planning doc
- **Sub-agent D**: Read Wave 11-24 migration files, check for conflicts
- R04 merges into complete schema gap analysis

