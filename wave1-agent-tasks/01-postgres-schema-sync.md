# Agent 1: PostgreSQL Schema Sync

## Role
Synchronize the 33 SQLite tables missing from PostgreSQL by creating migration 0013 and adding matching `pgTable()` definitions to `postgres-schema.ts`.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0013_postgres_schema_sync.sql`
**Purpose**: PostgreSQL migration syncing all 33 missing tables + adding missing columns to 2 existing tables
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes, wrap in `BEGIN; ... COMMIT;`

**CRITICAL**: This is the largest migration in the project. All DDL must be idempotent.

**REVISION NOTE (D01-CRIT-02 / D04-DEP-01 — Migration Sequencing)**: Migrations 0023-0029 (from Waves 11-17) already exist on disk and MAY have already been applied to the database. Some of those later migrations may reference tables that this migration (0013) creates. Therefore:
1. ALL `CREATE TABLE` statements MUST use `CREATE TABLE IF NOT EXISTS`
2. ALL `ALTER TABLE ... ADD COLUMN` statements MUST use `ADD COLUMN IF NOT EXISTS`
3. ALL `CREATE INDEX` statements MUST use `CREATE INDEX IF NOT EXISTS`
4. The migration runner applies in numeric filename order — 0013 will run BEFORE 0023, but the tables from 0023+ might already exist if those migrations were previously applied out-of-order
5. This migration MUST be completely idempotent — safe to run multiple times with no side effects

#### Part A: CREATE 33 new tables

- [ ] `business_profiles`: id TEXT PK, user_id TEXT FK→users ON DELETE CASCADE, business_name TEXT, abn TEXT, entity_type TEXT, industry TEXT, bas_frequency TEXT, gst_registered BOOLEAN DEFAULT false, financial_year_end TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(). UNIQUE INDEX on `(user_id)`.

- [ ] `bas_periods`: id TEXT PK, user_id TEXT FK→users, financial_year TEXT, quarter TEXT, period_type TEXT, start_date TEXT, end_date TEXT, due_date TEXT, lodgement_due TEXT, lodgement_date TEXT, accounting_method TEXT, status TEXT, lodged_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(). UNIQUE INDEX on `(user_id, financial_year, quarter)`.

- [ ] `bas_calculations`: id TEXT PK, bas_period_id TEXT FK→bas_periods, period_id TEXT, label TEXT, value REAL, label_g1 REAL, label_g2 REAL, label_g3 REAL, label_g9 REAL, label_g10 REAL, label_g11 REAL, label_1a REAL, label_1b REAL, label_w1 REAL, label_w2 REAL, label_5a REAL, label_7c REAL, label_7d REAL, amount_owing REAL, refund_due REAL, calculated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(). INDEX on `(bas_period_id)`, `(period_id)`.

- [ ] `tax_codes`: id TEXT PK, code TEXT, description TEXT, rate REAL, is_active BOOLEAN DEFAULT true.

- [ ] `tax_brackets`: id TEXT PK, tax_year TEXT, financial_year TEXT, min_income REAL, max_income REAL, base_tax REAL, rate REAL.

- [ ] `deductions`: id TEXT PK, user_id TEXT FK→users, tax_year TEXT, financial_year TEXT, category TEXT, subcategory TEXT, calculation_method TEXT, description TEXT, amount REAL, transaction_id TEXT, is_verified BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(). INDEX on `(user_id, tax_year)`.

- [ ] `cgt_assets`: id TEXT PK, user_id TEXT FK→users, asset_name TEXT, asset_type TEXT, quantity REAL, unit_cost REAL, acquisition_date TEXT, acquisition_cost REAL, acquisition_costs_incidental REAL, improvements_cost REAL, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(). INDEX on `(user_id, status)`.

- [ ] `cgt_events`: id TEXT PK, user_id TEXT FK→users, asset_id TEXT FK→cgt_assets, tax_year TEXT, event_type TEXT, event_date TEXT, disposal_date TEXT, disposal_proceeds REAL, proceeds REAL, cost_base REAL, capital_gain_loss REAL, capital_gain_gross REAL, capital_gain_net REAL, capital_loss REAL, discount_applied BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(). INDEX on `(user_id, tax_year)`, `(asset_id)`.

- [ ] `depreciable_assets`: id TEXT PK, user_id TEXT FK→users, asset_name TEXT, asset_category TEXT, purchase_date TEXT, purchase_cost REAL, effective_life TEXT, effective_life_years REAL, depreciation_method TEXT, opening_value REAL, opening_written_down_value REAL, current_value REAL, current_written_down_value REAL, business_use_percentage REAL, is_instant_write_off BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `depreciation_schedule`: id TEXT PK, asset_id TEXT FK→depreciable_assets, financial_year TEXT, opening_value REAL, depreciation_amount REAL, closing_value REAL, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `tax_year_summary`: id TEXT PK, user_id TEXT FK→users, tax_year TEXT, financial_year TEXT, gross_income REAL, total_deductions REAL, taxable_income REAL, tax_payable REAL, medicare_levy REAL, tax_offsets REAL, net_tax REAL, calculated_at TIMESTAMPTZ. UNIQUE INDEX on `(user_id, tax_year)`.

- [ ] `audit_log`: id TEXT PK, user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, old_value TEXT, new_value TEXT, ip_address TEXT, user_agent TEXT, request_path TEXT, request_method TEXT, status_code INTEGER, duration_ms INTEGER, error_message TEXT, timestamp TIMESTAMPTZ DEFAULT NOW(). INDEX on `(user_id)`, `(timestamp)`, `(entity_type, entity_id)`.

- [ ] `sessions`: id TEXT PK, user_id TEXT FK→users, refresh_token_hash TEXT, device_fingerprint TEXT, ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ. INDEX on `(user_id)`, `(expires_at)`.

- [ ] `teams`: id TEXT PK, name TEXT, owner_id TEXT FK→users, description TEXT, settings TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `team_members`: id TEXT PK, team_id TEXT FK→teams ON DELETE CASCADE, user_id TEXT FK→users, role TEXT, joined_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `team_invitations`: id TEXT PK, team_id TEXT FK→teams ON DELETE CASCADE, email TEXT, role TEXT, token TEXT, invited_by TEXT FK→users, status TEXT, expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `subscriptions`: id TEXT PK, user_id TEXT FK→users, stripe_customer_id TEXT, stripe_subscription_id TEXT, plan TEXT, status TEXT, current_period_start TEXT, current_period_end TEXT, cancel_at_period_end BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `export_history`: id TEXT PK, user_id TEXT FK→users, export_type TEXT, format TEXT, parameters TEXT, filters TEXT, date_range TEXT, file_path TEXT, file_size TEXT, file_size_bytes INTEGER, record_count INTEGER, status TEXT, error_message TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ.

- [ ] `parser_metrics`: id TEXT PK, statement_id TEXT, bank_name TEXT, parser_used TEXT, extraction_time_ms INTEGER, transaction_count INTEGER, confidence_score REAL, errors_count INTEGER, warnings_count INTEGER, used_vision_fallback BOOLEAN DEFAULT false, bank_id TEXT, total_duration_ms INTEGER, parse_error_count INTEGER, transactions_parsed INTEGER, detection_confidence REAL, high_confidence_count INTEGER, low_confidence_count INTEGER, extraction_method TEXT, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `parser_accuracy_aggregates`: id TEXT PK, bank_name TEXT, parser_version TEXT, period_start TEXT, period_end TEXT, total_statements INTEGER, successful_statements INTEGER, avg_confidence_score REAL, avg_extraction_time_ms REAL, vision_fallback_rate REAL, bank_id TEXT, period_type TEXT, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `parser_feedback`: id TEXT PK, user_id TEXT FK→users, statement_id TEXT, transaction_id TEXT, feedback_type TEXT, original_value TEXT, corrected_value TEXT, field_name TEXT, notes TEXT, ai_confidence REAL, user_notes TEXT, status TEXT, bank_id TEXT, reviewed_at TIMESTAMPTZ, review_notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `chart_of_accounts`: id TEXT PK, user_id TEXT FK→users, code TEXT, name TEXT, type TEXT, parent_id TEXT, is_system BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true, account_code TEXT, account_name TEXT, account_type TEXT, normal_balance TEXT, tax_code TEXT, bas_label TEXT, created_at TIMESTAMPTZ DEFAULT NOW(). UNIQUE INDEX on `(user_id, code)`.

- [ ] `journal_entries`: id TEXT PK, user_id TEXT FK→users, entry_date TEXT, reference TEXT, description TEXT, transaction_id TEXT, is_auto BOOLEAN DEFAULT false, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), posted_at TIMESTAMPTZ. INDEX on `(user_id, entry_date)`, `(transaction_id)`.

- [ ] `journal_entry_lines`: id TEXT PK, entry_id TEXT FK→journal_entries ON DELETE CASCADE, account_id TEXT, debit REAL, credit REAL, description TEXT, line_order INTEGER, journal_entry_id TEXT, debit_amount REAL, credit_amount REAL. INDEX on `(entry_id)`, `(account_id)`.

- [ ] `accounting_periods`: id TEXT PK, user_id TEXT FK→users, name TEXT, start_date TEXT, end_date TEXT, status TEXT, closed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `account_balances`: id TEXT PK, chart_account_id TEXT FK→chart_of_accounts, period_id TEXT FK→accounting_periods, opening_balance REAL, debits REAL, credits REAL, closing_balance REAL, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `rag_namespaces`: id TEXT PK, user_id TEXT FK→users, name TEXT, description TEXT, chunk_count INTEGER DEFAULT 0, embedding_model TEXT, embedding_dimensions INTEGER, document_count INTEGER DEFAULT 0, last_indexed_at TIMESTAMPTZ, status TEXT, settings TEXT, last_updated TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `rag_chunks`: id TEXT PK, namespace_id TEXT FK→rag_namespaces ON DELETE CASCADE, user_id TEXT FK→users, content TEXT, content_hash TEXT, chunk_type TEXT, metadata TEXT, embedding TEXT, source_id TEXT, source_type TEXT, document_id TEXT, category TEXT, account_id TEXT, date_start TEXT, date_end TEXT, content_tokens INTEGER, total_amount REAL, transaction_count INTEGER, merchant_normalized TEXT, created_at TIMESTAMPTZ DEFAULT NOW(). INDEX on `(namespace_id)`, `(content_hash)`.

- [ ] `rag_documents`: id TEXT PK, namespace_id TEXT FK→rag_namespaces ON DELETE CASCADE, user_id TEXT FK→users, title TEXT, source_type TEXT, source_id TEXT, version INTEGER DEFAULT 1, chunk_count INTEGER DEFAULT 0, status TEXT, content_hash TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `rag_citations`: id TEXT PK, user_id TEXT FK→users, query_id TEXT, chunk_id TEXT FK→rag_chunks, relevance_score REAL, used_in_response BOOLEAN DEFAULT false, document_id TEXT, rerank_score REAL, position INTEGER, excerpt_used TEXT, was_helpful BOOLEAN, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `tax_offsets`: id TEXT PK, user_id TEXT FK→users, tax_year TEXT, offset_type TEXT, amount REAL, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `capital_losses`: id TEXT PK, user_id TEXT FK→users, tax_year TEXT, asset_description TEXT, acquisition_date TEXT, disposal_date TEXT, loss_amount REAL, applied_amount REAL DEFAULT 0, carried_forward REAL, created_at TIMESTAMPTZ DEFAULT NOW().

- [ ] `upload_queue`: id TEXT PK, user_id TEXT FK→users, batch_id TEXT, filename TEXT, original_name TEXT, size INTEGER, mime_type TEXT, state TEXT, priority INTEGER DEFAULT 0, statement_id TEXT, error TEXT, retry_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), processed_at TIMESTAMPTZ. INDEX on `(user_id, state)`, `(batch_id)`.

#### Part B: ALTER existing tables (add missing columns)

- [ ] `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership_tag TEXT;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_amount REAL;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gst_category TEXT;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_hash TEXT;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS parser_version TEXT;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS extraction_hash TEXT;`
- [ ] `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_owner_contribution BOOLEAN DEFAULT false;`

## Files to MODIFY

### 2. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching `pgTable()` definitions for all 33 new tables
**Pattern**: Follow existing tables — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`, include indexes

- [ ] Add all 33 `pgTable()` definitions with PG-native types:
  - SQLite `integer('col', { mode: 'boolean' })` → PG `boolean('col')`
  - SQLite `text('created_at').default('CURRENT_TIMESTAMP')` → PG `timestamp('created_at', { withTimezone: true }).defaultNow()`
  - SQLite `real('col')` → PG `real('col')`
  - SQLite `integer('col')` → PG `integer('col')`
- [ ] Add type exports for all new tables at the bottom of the file

**DO NOT modify `server/src/schema.ts`** — all 33 tables already exist there as `sqliteTable()` definitions.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean (no new errors from PG schema additions)
- [ ] Migration file `0013_postgres_schema_sync.sql` is valid PostgreSQL syntax
- [ ] All 33 `pgTable()` definitions compile correctly
- [ ] Column types match their SQLite counterparts (with appropriate PG type mappings)
- [ ] All indexes specified in migration match R04 recommendations
- [ ] Migration is wrapped in `BEGIN; ... COMMIT;`
- [ ] REVISION: ALL DDL uses IF NOT EXISTS (tables, columns, indexes) for idempotency
- [ ] Create marker file: `.agent-done-W01-01` (REVISION: zero-padded per D04/D05)

## Dependencies
- **None** — can start immediately
- **Reuses**: postgres-schema.ts patterns, existing migration file conventions
