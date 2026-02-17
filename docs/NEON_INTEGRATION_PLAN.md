# Neon DB Integration Plan for GoldLedger

> **Author**: Neon DB Integration Architect
> **Date**: 2026-02-17
> **Status**: DRAFT — Pending team review
> **Branch**: `refactor/REFACTOR-018-account-service`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture](#2-current-architecture)
3. [Docker Topology Change](#3-docker-topology-change)
4. [Database Split Strategy](#4-database-split-strategy)
5. [Connection Management](#5-connection-management)
6. [Migration Strategy](#6-migration-strategy)
7. [Branching Strategy](#7-branching-strategy)
8. [Environment Variables](#8-environment-variables)
9. [Data Masking Integration Points](#9-data-masking-integration-points)
10. [Cognee Bridge Architecture](#10-cognee-bridge-architecture)
11. [Rollback Strategy](#11-rollback-strategy)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Executive Summary

GoldLedger currently uses a single PostgreSQL 17 + pgvector instance (Docker service `postgres`) that hosts:
- **`ai_accountant`** database — 120+ tables for the core accounting application
- **`cognee_db`** database — Cognee's knowledge graph, vector embeddings, and internal tables

This plan introduces **Neon** as the primary database for core accounting data, while the existing local PostgreSQL remains for Cognee/AI workloads that require pgvector, graph storage, and high-throughput vector operations.

### Why Neon?

| Benefit | Detail |
|---------|--------|
| **Branching** | Instant copy-on-write database branches for dev, staging, AI/LLM operations |
| **Serverless scaling** | Auto-suspend on idle, scale to zero, scale up for BAS lodgement periods |
| **Managed backups** | Point-in-time recovery (PITR) without manual pg_dump |
| **Connection pooling** | Built-in PgBouncer with connection multiplexing |
| **Data masking** | Neon branches + custom views enable PII-masked copies for AI operations |

### What Stays Local?

Cognee requires pgvector for embedding storage and low-latency vector similarity search. Cognee's internal tables, graph data, and all AI/ML processing tables remain on the local pgvector instance to avoid cross-network latency for high-frequency embedding lookups.

---

## 2. Current Architecture

### 2.1 Docker Services (5 total)

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ postgres │  │  cognee   │  │  redis   │  │  server  │  │  client  │
│ :5432    │  │  :8000   │  │  :6379   │  │  :3501   │  │  :8080   │
│ pgvector │  │ AI graph │  │  cache   │  │  Hono    │  │  nginx   │
│ pg17     │  │          │  │  7-alpine│  │  Node.js │  │  React   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### 2.2 Database Connection Flow

```
schema.ts:createDb()
  ├── usePostgres=true → pg.Pool → drizzlePg(pool) → wrapPgDb(pgDb) → db (any)
  └── usePostgres=false → @libsql/client → drizzleSqlite(client) → db

db-adapter.ts:
  └── isProduction → Pool → drizzlePg(pool) → db (separate, unused by most services)

db/postgres-connection.ts:
  └── getDb() → NodePgDatabase<typeof schema> (typed, used by admin-schema consumers)
```

**Key issue**: `schema.ts` exports `db` as `any` due to `wrapPgDb()`. All 100+ services import `db` from `schema.ts`.

### 2.3 Migration Files

| Range | Location | Count |
|-------|----------|-------|
| 0006–0008 | `server/drizzle/` | 3 |
| 0009–0036 | `docker/migrations/` | 28 |
| **Total** | | **31 migration files** |

---

## 3. Docker Topology Change

### 3.1 New Service: `neon-proxy`

Neon Local is a Docker-based TCP proxy that routes PostgreSQL wire protocol to Neon Cloud. It is **not** a self-hosted PostgreSQL — it's a connection proxy that authenticates against Neon's API.

Add the following service to `docker-compose.yml`:

```yaml
  # ---------------------------------------------------------------------------
  # Neon Proxy — TCP proxy to Neon Cloud database
  # ---------------------------------------------------------------------------
  neon-proxy:
    image: ghcr.io/neondatabase/neon-proxy:latest
    container_name: cba-neon-proxy
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      - NEON_API_KEY=${NEON_API_KEY}
      - NEON_PROJECT_ID=${NEON_PROJECT_ID}
      - NEON_BRANCH_ID=${NEON_BRANCH_ID:-main}
    networks:
      - cba-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h localhost -p 5432 -U ${NEON_DB_USER:-neondb_owner} || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
```

### 3.2 Updated Service Dependencies

```yaml
  server:
    depends_on:
      postgres:
        condition: service_healthy
      neon-proxy:
        condition: service_healthy
```

### 3.3 Updated Volumes (add backups directory)

```yaml
volumes:
  postgres-data:
    driver: local
  cognee-data:
    driver: local
  redis-data:
    driver: local
  neon-backups:
    driver: local
```

### 3.4 Final Topology (6 services)

```
┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ neon-proxy │  │ postgres │  │  cognee   │  │  redis   │  │  server  │  │  client  │
│ :5433→Neon │  │ :5432    │  │  :8000   │  │  :6379   │  │  :3501   │  │  :8080   │
│ Accounting │  │ pgvector │  │ AI graph │  │  cache   │  │  Hono    │  │  nginx   │
│ data (core)│  │ Cognee   │  │          │  │  7-alpine│  │  Node.js │  │  React   │
└────────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 4. Database Split Strategy

### 4.1 Guiding Principles

1. **Core accounting data → Neon**: Anything that represents the business's financial state of record (transactions, accounts, BAS, tax, invoices, payroll, etc.)
2. **AI/ML operational data → Local PG**: Cognee's vector embeddings, graph schemas, knowledge graph, RAG chunks, temporal caches
3. **Admin/system metadata → Neon**: User management, audit logs, feature flags, agent execution tracking
4. **CDR public data → Neon**: Open Banking product data is accounting-adjacent reference data

### 4.2 Complete Table Categorization

#### NEON TABLES (95 tables) — Core Accounting + Admin + Reference

| # | Table Name | Schema File | Category | PII? |
|---|-----------|-------------|----------|------|
| 1 | `users` | schema.ts:132 | Auth | YES — username |
| 2 | `user_settings` | schema.ts:140 | Auth | NO |
| 3 | `accounts` | schema.ts:159 | Banking | YES — account_number |
| 4 | `account_balance_history` | schema.ts:182 | Banking | NO |
| 5 | `statements` | schema.ts:199 | Banking | NO |
| 6 | `statement_accounts` | schema.ts:219 | Banking | NO |
| 7 | `transactions` | schema.ts:232 | Core | NO (descriptions may have merchant PII) |
| 8 | `transaction_history` | schema.ts:258 | Core | NO |
| 9 | `transfer_links` | schema.ts:271 | Core | NO |
| 10 | `merchant_memory` | schema.ts:295 | Categorization | NO |
| 11 | `pending_categorization` | schema.ts:310 | Categorization | NO |
| 12 | `reconciliation_alerts` | schema.ts:332 | Reconciliation | NO |
| 13 | `business_profiles` | schema.ts:356 | Business | YES — abn, business_name |
| 14 | `bas_periods` | schema.ts:376 | Tax/BAS | NO |
| 15 | `bas_calculations` | schema.ts:396 | Tax/BAS | NO |
| 16 | `tax_codes` | schema.ts:423 | Tax | NO |
| 17 | `tax_brackets` | schema.ts:431 | Tax | NO |
| 18 | `deductions` | schema.ts:441 | Tax | NO |
| 19 | `cgt_assets` | schema.ts:458 | Tax/CGT | NO |
| 20 | `cgt_events` | schema.ts:475 | Tax/CGT | NO |
| 21 | `depreciable_assets` | schema.ts:498 | Tax/Depreciation | NO |
| 22 | `depreciation_schedule` | schema.ts:520 | Tax/Depreciation | NO |
| 23 | `tax_year_summary` | schema.ts:532 | Tax | NO |
| 24 | `audit_log` | schema.ts:553 | Security | YES — ip_address, user_agent |
| 25 | `sessions` | schema.ts:571 | Auth | YES — ip_address, device_fingerprint |
| 26 | `teams` | schema.ts:589 | Multi-tenant | NO |
| 27 | `team_members` | schema.ts:601 | Multi-tenant | NO |
| 28 | `team_invitations` | schema.ts:613 | Multi-tenant | YES — email |
| 29 | `subscriptions` | schema.ts:630 | Billing | YES — stripe IDs |
| 30 | `export_history` | schema.ts:650 | Reports | NO |
| 31 | `parser_metrics` | schema.ts:675 | System | NO |
| 32 | `parser_accuracy_aggregates` | schema.ts:697 | System | NO |
| 33 | `parser_feedback` | schema.ts:713 | System | NO |
| 34 | `chart_of_accounts` | schema.ts:738 | Ledger | NO |
| 35 | `journal_entries` | schema.ts:758 | Ledger | NO |
| 36 | `journal_entry_lines` | schema.ts:773 | Ledger | NO |
| 37 | `accounting_periods` | schema.ts:790 | Ledger | NO |
| 38 | `account_balances` | schema.ts:803 | Ledger | NO |
| 39 | `tax_offsets` | schema.ts:909 | Tax | NO |
| 40 | `capital_losses` | schema.ts:919 | Tax | NO |
| 41 | `upload_queue` | schema.ts:936 | System | NO |
| 42 | `dashboard_layouts` | schema.ts:959 | UI/Dashboards | NO |
| 43 | `saved_charts` | schema.ts:974 | UI/Dashboards | NO |
| 44 | `agent_sessions` | schema.ts:1081 | Agent/AI | NO |
| 45 | `agent_mutations` | schema.ts:1096 | Agent/AI | NO |
| 46 | `agent_audit_log` | schema.ts:1124 | Agent/AI | YES — ip_address |
| 47 | `tenants` | schema.ts:1144 | Multi-tenant | YES — primary_contact_email, abn |
| 48 | `tenant_members` | schema.ts:1161 | Multi-tenant | NO |
| 49 | `tenant_invitations` | schema.ts:1179 | Multi-tenant | YES — email |
| 50 | `permissions` | schema.ts:1196 | RBAC | NO |
| 51 | `role_permissions` | schema.ts:1206 | RBAC | NO |
| 52 | `subscription_plans` | schema.ts:1219 | Billing | NO |
| 53 | `subscription_history` | schema.ts:1238 | Billing | NO |
| 54 | `api_rate_limits` | schema.ts:1261 | System | NO |
| 55 | `owner_equity_events` | schema.ts:1280 | Accounting | NO |
| 56 | `economic_data_cache` | schema.ts:1297 | Market | NO |
| 57 | `report_snapshots` | schema.ts:1310 | Reports | NO |
| 58 | `budgets` | schema.ts:1325 | Budgets | NO |
| 59 | `budget_lines` | schema.ts:1343 | Budgets | NO |
| 60 | `budget_vs_actual` | schema.ts:1356 | Budgets | NO |
| 61 | `forecast_scenarios` | schema.ts:1368 | Forecasting | NO |
| 62 | `forecast_periods` | schema.ts:1384 | Forecasting | NO |
| 63 | `kpi_metrics` | schema.ts:1397 | Reporting | NO |
| 64 | `ocr_documents` | schema.ts:1415 | Documents | YES — vendor_abn |
| 65 | `ocr_line_items` | schema.ts:1444 | Documents | NO |
| 66 | `payment_match_rules` | schema.ts:1461 | Matching | NO |
| 67 | `payment_matches` | schema.ts:1482 | Matching | NO |
| 68 | `document_queue` | schema.ts:1502 | Documents | NO |
| 69 | `cash_flow_forecasts` | schema.ts:1526 | Forecasting | NO |
| 70 | `cash_flow_forecast_periods` | schema.ts:1545 | Forecasting | NO |
| 71 | `anomaly_alerts` | schema.ts:1566 | Analytics | NO |
| 72 | `compliance_checks` | schema.ts:1584 | Compliance | NO |
| 73 | `compliance_schedules` | schema.ts:1603 | Compliance | NO |
| 74 | `suppliers` | schema.ts:1699 | AP | YES — abn, bank_bsb, bank_account_number, email, phone |
| 75 | `bills` | schema.ts:1719 | AP | NO |
| 76 | `bill_lines` | schema.ts:1742 | AP | NO |
| 77 | `bill_payments` | schema.ts:1757 | AP | NO |
| 78 | `purchase_orders` | schema.ts:1771 | AP | NO |
| 79 | `po_lines` | schema.ts:1791 | AP | NO |
| 80 | `po_receipts` | schema.ts:1803 | AP | NO |
| 81 | `po_receipt_lines` | schema.ts:1814 | AP | NO |
| 82 | `supplier_payment_runs` | schema.ts:1825 | AP | NO |
| 83 | `supplier_payment_run_items` | schema.ts:1837 | AP | NO |
| 84 | `push_subscriptions` | schema.ts:1852 | PWA | YES — endpoint (device URL) |
| 85 | `notification_preferences` | schema.ts:1871 | PWA | NO |
| 86 | `offline_sync_log` | schema.ts:1900 | PWA | NO |
| 87 | `customers` | schema.ts:1928 | AR | YES — email, phone, address, abn |
| 88 | `customer_contacts` | schema.ts:1949 | AR | YES — name, email, phone |
| 89 | `invoices` | schema.ts:1962 | AR | NO |
| 90 | `invoice_lines` | schema.ts:1988 | AR | NO |
| 91 | `invoice_number_sequences` | schema.ts:2003 | AR | NO |
| 92 | `invoice_payments` | schema.ts:2013 | AR | NO |
| 93 | `employees` | schema.ts:2037 | Payroll | YES — tax_file_number (encrypted), email, phone, date_of_birth, address |
| 94 | `employee_bank_details` | schema.ts:2057 | Payroll | YES — bsb (encrypted), account_number (encrypted) |
| 95 | `employee_super_funds` | schema.ts:2070 | Payroll | YES — member_number |
| 96 | `employee_tax_declarations` | schema.ts:2083 | Payroll | NO |
| 97 | `pay_categories` | schema.ts:2097 | Payroll | NO |
| 98 | `pay_structures` | schema.ts:2113 | Payroll | NO |
| 99 | `employee_documents` | schema.ts:2128 | Payroll | NO |
| 100 | `admin_users` | admin-schema.ts:13 | Admin | YES — email, password_hash |
| 101 | `agent_executions` | admin-schema.ts:36 | Admin | NO |
| 102 | `agent_configurations` | admin-schema.ts:64 | Admin | NO |
| 103 | `system_metrics` | admin-schema.ts:89 | Admin | NO |
| 104 | `system_health_checks` | admin-schema.ts:105 | Admin | NO |
| 105 | `user_activity_log` | admin-schema.ts:121 | Admin | YES — ip_address |
| 106 | `feature_flags` | admin-schema.ts:140 | Admin | NO |
| 107 | `cdr_data_holders` | cdr-schema.ts:13 | CDR/Reference | NO |
| 108 | `cdr_products` | cdr-schema.ts:34 | CDR/Reference | NO |
| 109 | `cdr_lending_rates` | cdr-schema.ts:60 | CDR/Reference | NO |
| 110 | `cdr_deposit_rates` | cdr-schema.ts:84 | CDR/Reference | NO |
| 111 | `cdr_fees` | cdr-schema.ts:104 | CDR/Reference | NO |
| 112 | `cdr_features` | cdr-schema.ts:128 | CDR/Reference | NO |
| 113 | `cdr_eligibility` | cdr-schema.ts:145 | CDR/Reference | NO |
| 114 | `cdr_crawl_log` | cdr-schema.ts:161 | CDR/Reference | NO |
| 115 | `cdr_rate_alerts` | cdr-schema.ts:178 | CDR/Reference | NO |
| 116 | `market_data_feeds` | market-schema.ts:13 | Market | NO |
| 117 | `economic_indicators` | market-schema.ts:35 | Market | NO |
| 118 | `market_prices` | market-schema.ts:59 | Market | NO |
| 119 | `sentiment_snapshots` | market-schema.ts:86 | Market | NO |
| 120 | `market_alerts` | market-schema.ts:110 | Market | NO |
| 121 | `economic_calendar` | market-schema.ts:132 | Market | NO |
| 122 | `entities` | consolidation.ts:20 | Multi-entity | NO |
| 123 | `entity_accounts` | consolidation.ts:33 | Multi-entity | NO |
| 124 | `inter_entity_transactions` | consolidation.ts:41 | Multi-entity | NO |
| 125 | `consolidation_rules` | consolidation.ts:57 | Multi-entity | NO |
| 126 | `consolidation_snapshots` | consolidation.ts:72 | Multi-entity | NO |
| 127 | `consolidation_snapshot_lines` | consolidation.ts:91 | Multi-entity | NO |
| 128 | `entity_settings` | multi-entity.ts:48 | Multi-entity | NO |

#### LOCAL PG TABLES (12 tables) — Cognee/AI/Knowledge Graph

| # | Table Name | Schema File | Reason for Local |
|---|-----------|-------------|-----------------|
| 1 | `cognee_user_accounts` | schema.ts:995 | Cognee auth tokens, synced with Cognee service |
| 2 | `cognee_sessions` | schema.ts:1010 | Cognee session state, ephemeral |
| 3 | `datapoint_configs` | schema.ts:1028 | Cognee DataPoint definitions |
| 4 | `graph_schemas` | schema.ts:1046 | Cognee ontology/graph schema definitions |
| 5 | `cognee_feedback` | schema.ts:1063 | Cognee search feedback loop |
| 6 | `rag_namespaces` | schema.ts:822 | RAG vector namespace metadata |
| 7 | `rag_chunks` | schema.ts:840 | RAG text chunks + embeddings (pgvector) |
| 8 | `rag_documents` | schema.ts:867 | RAG document tracking |
| 9 | `rag_citations` | schema.ts:886 | RAG citation tracking |
| 10 | `temporal_queries` | schema.ts:1622 | Temporal search cache (Cognee-linked) |
| 11 | `cross_module_insights` | schema.ts:1645 | Cross-module intelligence (Cognee scanners) |
| 12 | `intelligence_subscriptions` | schema.ts:1665 | Intelligence notification triggers |
| 13 | `module_connections` | schema.ts:1681 | Module relationship metadata |

**Reasoning**: These tables either contain vector embeddings (requires pgvector), are tightly coupled to Cognee's internal operations, or serve as caches for AI search operations where local latency is critical.

#### TABLES IN BOTH (Read Replicas / Sync)

No tables need to exist in both databases simultaneously. Instead, AI operations that need accounting data will:
1. Query Neon through the `neonDb` connection for source data
2. Index results into Cognee via the Cognee HTTP API (which uses local PG internally)

This eliminates cross-database joins and keeps data flow unidirectional: **Neon → (server process) → Cognee API → Local PG**.

### 4.3 Migration File Assignment

| Migration | Target DB | Tables Created |
|-----------|-----------|---------------|
| 0006_postgres_migration.sql | **Neon** | Core schema (accounts, transactions, statements, etc.) |
| 0007_missing_tables.sql | **Neon** | 31 additional core tables |
| 0008_account_ownership.sql | **Neon** | ALTER TABLE additions |
| 0009_complete_schema.sql | **Neon** | Schema sync |
| 0010_add_missing_columns.sql | **Neon** | Column additions |
| 0011_final_schema_sync.sql | **Neon** | Schema sync |
| 0012_tax_return_platform.sql | **Neon** | Tax return tables |
| 0013_postgres_schema_sync.sql | **Neon** | Schema sync |
| 0014_agent_mutations.sql | **Neon** | agent_sessions, agent_mutations, agent_audit_log |
| 0015_cognee_multi_user.sql | **Local PG** | cognee_user_accounts, cognee_sessions |
| 0016_employee_management.sql | **Neon** | employees, employee_bank_details, etc. |
| 0017_pay_runs_leave.sql | **Neon** | pay_runs, leave_balances, etc. |
| 0018_stp_payslips_timesheets.sql | **Neon** | STP reporting, payslips |
| 0019_customers_invoices.sql | **Neon** | customers, invoices, invoice_lines |
| 0020_recurring_payments.sql | **Neon** | Recurring payment schedules |
| 0021_ar_multicurrency.sql | **Neon** | AR + multicurrency |
| 0022_ap_purchase_orders.sql | **Neon** | suppliers, bills, purchase_orders |
| 0023_inventory_bank_recon.sql | **Neon** | Inventory + bank reconciliation |
| 0024_fixed_assets_multi_entity.sql | **Neon** | Fixed assets + entities |
| 0025_financial_reporting.sql | **Neon** | report_snapshots, budgets, forecasts |
| 0026_ai_ocr_payment_matching.sql | **Neon** | ocr_documents, payment_matches |
| 0027_predictive_analytics.sql | **Neon** | cash_flow_forecasts, anomaly_alerts, compliance |
| 0028_cognee_datapoints.sql | **Local PG** | datapoint_configs, graph_schemas, cognee_feedback |
| 0029_temporal_intelligence.sql | **Split** | temporal_queries, cross_module_insights → Local PG; intelligence_subscriptions, module_connections → Local PG |
| 0030_cdr_open_banking.sql | **Neon** | CDR tables |
| 0031_market_intelligence.sql | **Neon** | Market data tables |
| 0032_admin_backend.sql | **Neon** | Admin tables |
| 0033_vercel_ai_sdk.sql | **Neon** | Vercel AI SDK tables |
| 0034_custom_dashboards.sql | **Neon** | dashboard_layouts, saved_charts |
| 0035_multi_tenant.sql | **Neon** | tenants, permissions, subscriptions |
| 0036_pwa_support.sql | **Neon** | push_subscriptions, notification_preferences, offline_sync_log |

---

## 5. Connection Management

### 5.1 New Connection Architecture

```
server/src/
├── schema.ts          → MODIFIED: exports neonDb + localDb instead of single db
├── db-adapter.ts      → DEPRECATED: remove after migration
├── db/
│   ├── postgres-connection.ts → RENAMED: local-pg-connection.ts (Cognee only)
│   ├── neon-connection.ts     → NEW: Neon connection via @neondatabase/serverless
│   └── connection-manager.ts  → NEW: Unified connection selector
```

### 5.2 New File: `server/src/db/neon-connection.ts`

```typescript
/**
 * Neon Database Connection
 * Uses @neondatabase/serverless for HTTP-based queries (serverless-friendly)
 * Falls back to standard pg Pool via neon-proxy for transaction support
 */
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// For serverless/HTTP queries (read-heavy, auto-scaling)
export function createNeonHttpDb() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  return drizzleNeon(sql);
}

// For transactional queries (writes, multi-statement transactions)
export function createNeonPoolDb() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    // Neon proxy runs at neon-proxy:5432 inside Docker
    // or use NEON_DATABASE_URL directly for cloud connection
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NEON_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  return drizzlePg(pool);
}

let neonDb: ReturnType<typeof createNeonPoolDb> | null = null;

export function getNeonDb() {
  if (!neonDb) {
    neonDb = createNeonPoolDb();
    console.log('[Neon] Connection pool initialized');
  }
  return neonDb;
}
```

### 5.3 New File: `server/src/db/connection-manager.ts`

```typescript
/**
 * Unified Connection Manager
 * Provides access to both Neon (accounting) and Local PG (Cognee/AI) databases.
 *
 * Convention:
 *   - Import { neonDb } for accounting/business data queries
 *   - Import { localDb } for Cognee/RAG/AI data queries
 *   - Import { db } for backwards-compatible default (points to Neon)
 */

import { getNeonDb } from './neon-connection.js';
import { getLocalPgDb } from './local-pg-connection.js';

// Primary accounting database (Neon)
export const neonDb = getNeonDb();

// AI/Cognee database (local pgvector)
export const localDb = getLocalPgDb();

// Backwards-compatible alias — points to Neon (most services use this)
export const db = neonDb;

// Re-export for explicit usage
export { getNeonDb, getLocalPgDb };
```

### 5.4 Changes to `schema.ts`

The critical change is in `createDb()`. Instead of a single database, it returns the Neon connection as default:

```typescript
// BEFORE (current):
export const db = createDb(); // single PG or SQLite

// AFTER:
import { getNeonDb } from './db/neon-connection.js';
import { getLocalPgDb } from './db/local-pg-connection.js';

const useNeon = !!process.env.NEON_DATABASE_URL;

function createDb() {
  if (useNeon) {
    console.log('[DB] Using Neon (primary) + Local PG (Cognee)');
    return wrapPgDb(getNeonDb());
  }
  // Fallback: existing behavior for local development without Neon
  if (usePostgres) {
    console.log('[DB] Using Local PostgreSQL (single-database mode)');
    const pool = new pg.Pool({ /* existing config */ });
    return wrapPgDb(drizzlePg(pool));
  }
  console.log('[DB] Using SQLite (local development)');
  const client = createClient({ url: dbUrl });
  return drizzleSqlite(client);
}

// Default export = Neon (or fallback)
export const db = createDb();

// Explicit Cognee/AI database
export const cogneeDb = useNeon
  ? wrapPgDb(getLocalPgDb())
  : db; // In single-DB mode, same as default
```

### 5.5 Service Selection Convention

Services will use the following import convention:

```typescript
// Services that query accounting data (95% of services):
import { db } from '../schema.js'; // → Neon

// Services that query Cognee/AI data:
import { cogneeDb } from '../schema.js'; // → Local PG

// Services that need both (cross-module-intelligence, rag, etc.):
import { db, cogneeDb } from '../schema.js';
```

**Files that need `cogneeDb` import change** (13 files):
- `services/cognee-datapoints.ts`
- `services/cognee-ontologies.ts`
- `services/cognee-feedback.ts`
- `services/cognee-graph.ts`
- `services/cognee-sessions.ts`
- `services/cognee/datasets.ts`
- `services/rag.ts`
- `services/rag/namespace-manager.ts`
- `services/rag/search/sparse-search.ts`
- `services/rag/citations/index.ts`
- `services/temporal-cognify.ts`
- `services/cross-module-intelligence.ts`
- `services/intelligence-subscriptions.ts`

All other ~90 service files continue using `import { db }` unchanged.

---

## 6. Migration Strategy

### 6.1 Phase 1: Prepare Neon Cloud

```bash
# 1. Create Neon project (via Neon Console or API)
curl -X POST "https://console.neon.tech/api/v2/projects" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "name": "goldledger-production",
      "region_id": "aws-ap-southeast-2",
      "pg_version": 17
    }
  }'

# 2. Note the project_id, branch_id, and connection string
# 3. Store in .env:
#    NEON_API_KEY=<from step 1>
#    NEON_PROJECT_ID=<from step 1>
#    NEON_DATABASE_URL=postgresql://neondb_owner:***@ep-xxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
```

### 6.2 Phase 2: Schema Creation on Neon

Run the Neon-targeted migrations against the Neon database:

```bash
# Connect to Neon and run migrations
export PGHOST=ep-xxx.ap-southeast-2.aws.neon.tech
export PGDATABASE=neondb
export PGUSER=neondb_owner
export PGPASSWORD=<neon_password>
export PGSSLMODE=require

# Run each Neon-targeted migration in order
for f in \
  server/drizzle/0006_postgres_migration.sql \
  server/drizzle/0007_missing_tables.sql \
  server/drizzle/0008_account_ownership.sql \
  docker/migrations/0009_complete_schema.sql \
  docker/migrations/0010_add_missing_columns.sql \
  docker/migrations/0011_final_schema_sync.sql \
  docker/migrations/0012_tax_return_platform.sql \
  docker/migrations/0013_postgres_schema_sync.sql \
  docker/migrations/0014_agent_mutations.sql \
  docker/migrations/0016_employee_management.sql \
  docker/migrations/0017_pay_runs_leave.sql \
  docker/migrations/0018_stp_payslips_timesheets.sql \
  docker/migrations/0019_customers_invoices.sql \
  docker/migrations/0020_recurring_payments.sql \
  docker/migrations/0021_ar_multicurrency.sql \
  docker/migrations/0022_ap_purchase_orders.sql \
  docker/migrations/0023_inventory_bank_recon.sql \
  docker/migrations/0024_fixed_assets_multi_entity.sql \
  docker/migrations/0025_financial_reporting.sql \
  docker/migrations/0026_ai_ocr_payment_matching.sql \
  docker/migrations/0027_predictive_analytics.sql \
  docker/migrations/0030_cdr_open_banking.sql \
  docker/migrations/0031_market_intelligence.sql \
  docker/migrations/0032_admin_backend.sql \
  docker/migrations/0033_vercel_ai_sdk.sql \
  docker/migrations/0034_custom_dashboards.sql \
  docker/migrations/0035_multi_tenant.sql \
  docker/migrations/0036_pwa_support.sql; do
  echo "Running: $f"
  psql -f "$f"
done
```

### 6.3 Phase 3: Data Migration

```bash
# 1. Dump ONLY Neon-targeted tables from local PG
NEON_TABLES="users,user_settings,accounts,account_balance_history,statements,statement_accounts,transactions,transaction_history,transfer_links,merchant_memory,pending_categorization,reconciliation_alerts,business_profiles,bas_periods,bas_calculations,tax_codes,tax_brackets,deductions,cgt_assets,cgt_events,depreciable_assets,depreciation_schedule,tax_year_summary,audit_log,sessions,teams,team_members,team_invitations,subscriptions,export_history,parser_metrics,parser_accuracy_aggregates,parser_feedback,chart_of_accounts,journal_entries,journal_entry_lines,accounting_periods,account_balances,tax_offsets,capital_losses,upload_queue,dashboard_layouts,saved_charts,agent_sessions,agent_mutations,agent_audit_log,tenants,tenant_members,tenant_invitations,permissions,role_permissions,subscription_plans,subscription_history,api_rate_limits,owner_equity_events,economic_data_cache,report_snapshots,budgets,budget_lines,budget_vs_actual,forecast_scenarios,forecast_periods,kpi_metrics,ocr_documents,ocr_line_items,payment_match_rules,payment_matches,document_queue,cash_flow_forecasts,cash_flow_forecast_periods,anomaly_alerts,compliance_checks,compliance_schedules,suppliers,bills,bill_lines,bill_payments,purchase_orders,po_lines,po_receipts,po_receipt_lines,supplier_payment_runs,supplier_payment_run_items,push_subscriptions,notification_preferences,offline_sync_log,customers,customer_contacts,invoices,invoice_lines,invoice_number_sequences,invoice_payments,employees,employee_bank_details,employee_super_funds,employee_tax_declarations,pay_categories,pay_structures,employee_documents"

# 2. Dump data only (no schema — already created)
pg_dump -h localhost -p 5432 -U app_user -d ai_accountant \
  --data-only --no-owner --no-privileges \
  $(echo $NEON_TABLES | tr ',' '\n' | sed 's/^/-t /') \
  > backups/neon-data-export.sql

# 3. Load into Neon
psql "${NEON_DATABASE_URL}" < backups/neon-data-export.sql

# 4. Verify row counts match
psql "${NEON_DATABASE_URL}" -c "SELECT 'transactions' as tbl, count(*) FROM transactions UNION ALL SELECT 'accounts', count(*) FROM accounts UNION ALL SELECT 'invoices', count(*) FROM invoices;"
```

### 6.4 Phase 4: Cutover

```bash
# 1. Stop the server (brief downtime)
docker compose stop server

# 2. Update .env with Neon credentials
echo "NEON_DATABASE_URL=postgresql://neondb_owner:***@ep-xxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require" >> .env
echo "NEON_API_KEY=neon_..." >> .env
echo "NEON_PROJECT_ID=..." >> .env

# 3. Set LOCAL_PG_URL for Cognee tables (points to existing Docker postgres)
echo "LOCAL_PG_URL=postgresql://app_user:***@postgres:5432/ai_accountant" >> .env

# 4. Rebuild server with new connection code
docker compose build server

# 5. Restart
docker compose up -d server

# 6. Verify health
curl http://localhost:3501/health
```

---

## 7. Branching Strategy

### 7.1 Branch Layout

```
production (main branch)
  ├── dev/feature-xxx      ← Developer branches (copy-on-write, instant)
  ├── staging              ← Pre-production testing
  └── ai-operations        ← PII-masked branch for AI/LLM context
```

### 7.2 Branch API Calls

```bash
# Create a development branch
curl -X POST "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "dev/feature-neon-integration",
      "parent_id": "'${NEON_BRANCH_ID}'"
    },
    "endpoints": [{ "type": "read_write" }]
  }'

# Create AI operations branch (for masked data)
curl -X POST "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "ai-operations",
      "parent_id": "'${NEON_BRANCH_ID}'"
    },
    "endpoints": [{ "type": "read_only" }]
  }'

# Refresh AI branch (re-fork from production with latest data)
# 1. Delete old branch
curl -X DELETE "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${AI_BRANCH_ID}" \
  -H "Authorization: Bearer ${NEON_API_KEY}"

# 2. Re-create from production
curl -X POST "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": {
      "name": "ai-operations",
      "parent_id": "'${NEON_BRANCH_ID}'"
    },
    "endpoints": [{ "type": "read_only" }]
  }'

# 3. Apply masking views on the new branch (see section 9)

# Delete a branch when done
curl -X DELETE "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}" \
  -H "Authorization: Bearer ${NEON_API_KEY}"
```

### 7.3 Branch Lifecycle Management

| Branch | Created | Refreshed | Deleted |
|--------|---------|-----------|---------|
| `production` | Project creation | Never (it's the source) | Never |
| `dev/*` | On git branch creation | On demand (re-fork) | On git branch merge |
| `staging` | Once | Weekly (Sunday 02:00 AEST) | Never (refreshed in-place) |
| `ai-operations` | Once | Daily (midnight AEST) | Never (refreshed by delete+recreate) |

### 7.4 Branch Management Service

```typescript
// server/src/services/neon-branches.ts
import { logger } from '../lib/logger.js';

const NEON_API = 'https://console.neon.tech/api/v2';

interface NeonBranch {
  id: string;
  name: string;
  parent_id: string;
  created_at: string;
}

export class NeonBranchService {
  constructor(
    private apiKey: string,
    private projectId: string,
  ) {}

  async createBranch(name: string, parentId?: string): Promise<NeonBranch> {
    const res = await fetch(`${NEON_API}/projects/${this.projectId}/branches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch: { name, parent_id: parentId },
        endpoints: [{ type: 'read_write' }],
      }),
    });
    if (!res.ok) throw new Error(`Neon API error: ${res.status}`);
    const data = await res.json();
    logger.info({ branchName: name }, 'Neon branch created');
    return data.branch;
  }

  async deleteBranch(branchId: string): Promise<void> {
    const res = await fetch(
      `${NEON_API}/projects/${this.projectId}/branches/${branchId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );
    if (!res.ok) throw new Error(`Neon API error: ${res.status}`);
    logger.info({ branchId }, 'Neon branch deleted');
  }

  async listBranches(): Promise<NeonBranch[]> {
    const res = await fetch(
      `${NEON_API}/projects/${this.projectId}/branches`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );
    if (!res.ok) throw new Error(`Neon API error: ${res.status}`);
    const data = await res.json();
    return data.branches;
  }

  async refreshBranch(name: string, parentId?: string): Promise<NeonBranch> {
    // Find existing branch
    const branches = await this.listBranches();
    const existing = branches.find((b: NeonBranch) => b.name === name);
    if (existing) {
      await this.deleteBranch(existing.id);
    }
    return this.createBranch(name, parentId);
  }
}
```

---

## 8. Environment Variables

### 8.1 New Variables

```bash
# === Neon Cloud Connection ===
NEON_API_KEY=neon_api_key_xxxxxxxxxxxxxxxx        # Neon API key (from console.neon.tech)
NEON_PROJECT_ID=proj_xxxxxxxxxxxxxxxx              # Neon project ID
NEON_DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
NEON_BRANCH_ID=br_main                            # Target branch (default: main)
NEON_SSL=true                                     # SSL for Neon (always true in production)

# === Neon AI Branch (masked data) ===
NEON_AI_BRANCH_URL=postgresql://neondb_owner:xxx@ep-yyy.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
NEON_AI_BRANCH_ID=br_ai_operations

# === Local PostgreSQL (Cognee / AI workloads) ===
LOCAL_PG_URL=postgresql://app_user:${POSTGRES_PASSWORD}@postgres:5432/ai_accountant
COGNEE_DATABASE_URL=postgresql://app_user:${POSTGRES_PASSWORD}@postgres:5432/cognee_db

# === Feature Flag ===
USE_NEON=true                                     # Master switch: true=dual-DB, false=single local PG
```

### 8.2 Updated `docker-compose.yml` Server Environment

```yaml
  server:
    environment:
      # ... existing vars ...
      # Neon (new)
      - NEON_API_KEY=${NEON_API_KEY}
      - NEON_PROJECT_ID=${NEON_PROJECT_ID}
      - NEON_DATABASE_URL=${NEON_DATABASE_URL}
      - NEON_BRANCH_ID=${NEON_BRANCH_ID:-main}
      - NEON_AI_BRANCH_URL=${NEON_AI_BRANCH_URL:-}
      - USE_NEON=${USE_NEON:-false}
      # Local PG (Cognee) — explicit
      - LOCAL_PG_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-ai_accountant}
      - COGNEE_DATABASE_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/cognee_db
```

### 8.3 `.env.example` Template

```bash
# === Neon DB (optional — set USE_NEON=true to enable) ===
USE_NEON=false
NEON_API_KEY=
NEON_PROJECT_ID=
NEON_DATABASE_URL=
NEON_BRANCH_ID=main
NEON_AI_BRANCH_URL=

# === Local PostgreSQL (always required for Cognee) ===
POSTGRES_USER=app_user
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=ai_accountant
```

---

## 9. Data Masking Integration Points

### 9.1 PII Columns Requiring Masking

The following tables contain PII that must be masked on the `ai-operations` branch:

| Table | PII Columns | Masking Strategy |
|-------|-------------|------------------|
| `users` | `username`, `password_hash` | Hash username, redact password |
| `accounts` | `account_number`, `account_number_hash` | Mask to last 4 digits |
| `business_profiles` | `abn`, `business_name` | Mask ABN, pseudonymize name |
| `audit_log` | `ip_address`, `user_agent` | Anonymize IP, hash UA |
| `sessions` | `ip_address`, `device_fingerprint`, `refresh_token_hash` | Redact all |
| `team_invitations` | `email` | Mask email |
| `subscriptions` | `stripe_customer_id`, `stripe_subscription_id` | Redact |
| `tenants` | `primary_contact_email`, `abn` | Mask |
| `tenant_invitations` | `email` | Mask |
| `agent_audit_log` | `ip_address` | Anonymize |
| `ocr_documents` | `vendor_abn` | Mask |
| `suppliers` | `abn`, `bank_bsb`, `bank_account_number`, `email`, `phone`, `contact_name` | Mask financial, pseudonymize PII |
| `customers` | `email`, `phone`, `address`, `abn`, `contact_name` | Pseudonymize |
| `customer_contacts` | `name`, `email`, `phone` | Pseudonymize |
| `employees` | `tax_file_number`, `email`, `phone`, `date_of_birth`, `address`, `first_name`, `last_name` | Redact TFN, pseudonymize rest |
| `employee_bank_details` | `bsb`, `account_number` | Redact (already encrypted at rest) |
| `employee_super_funds` | `member_number` | Mask |
| `admin_users` | `email`, `password_hash` | Mask email, redact password |
| `user_activity_log` | `ip_address` | Anonymize |
| `push_subscriptions` | `endpoint` | Redact |

> **Note**: `masking-architect` agent will define the exact SQL masking views and functions for each column. This section provides the raw input for their work.

### 9.2 Masking Approach on Neon Branch

After creating the `ai-operations` branch, apply masking by creating views that override table names:

```sql
-- On ai-operations branch only:
-- Rename original tables
ALTER TABLE employees RENAME TO _raw_employees;

-- Create masked view with same name
CREATE VIEW employees AS
SELECT
  id, user_id,
  'Employee-' || SUBSTR(id, 1, 8) AS first_name,
  'Masked' AS last_name,
  'masked-' || id || '@example.com' AS email,
  '0400000000' AS phone,
  NULL AS date_of_birth,
  '{"street": "REDACTED"}' AS address,
  'XXXXXXXXX' AS tax_file_number,
  start_date, end_date, status, employment_type,
  created_at, updated_at
FROM _raw_employees;
```

The masking script is complete at `docker/neon/apply-masking.sql` (799 lines, 22 tables, 73 columns).

**Additional tables masked beyond the original 19** (identified by masking-architect):
- `transactions` — `description` field contains embedded merchant PII; `amount`/`balance` noised ±10%
- `rag_chunks` — `content` field contains raw indexed text that may include PII from source documents

---

## 10. Cognee Bridge Architecture

### 10.1 Data Flow

```
                    ┌─────────────────┐
                    │   Neon Cloud     │
                    │  (Accounting)    │
                    │                  │
                    │  transactions    │
                    │  accounts        │
                    │  invoices...     │
                    └────────┬────────┘
                             │ SQL queries
                             ▼
                    ┌─────────────────┐
                    │   Hono Server   │
                    │   (Node.js)     │
                    │                  │
                    │  neonDb → read   │
                    │  localDb → read  │
                    │  cogneeClient →  │
                    │    HTTP POST     │
                    └──┬──────────┬───┘
                       │          │
              SQL      │          │  HTTP API
              queries  │          │  (Cognee)
                       ▼          ▼
              ┌──────────┐  ┌──────────┐
              │ Local PG │  │  Cognee  │
              │ pgvector │  │  :8000   │
              │          │←─│ (writes) │
              │ rag_*    │  │          │
              │ cognee_* │  └──────────┘
              │ temporal* │
              └──────────┘
```

### 10.2 Cross-Database Query Pattern

Services that need both accounting data and AI data:

```typescript
// Example: cross-module-intelligence.ts
import { db, cogneeDb } from '../schema.js';
import { transactions } from '../schema.js';
import { crossModuleInsights } from '../schema.js';

async function generateInsight(userId: string) {
  // 1. Read accounting data from Neon
  const recentTx = await db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(100)
    .all();

  // 2. Analyze with AI (Cognee search via HTTP)
  const cogneeResults = await cogneeClient.search({
    query: `spending patterns for user`,
    search_type: 'GRAPH_COMPLETION',
    datasets: [`tenant_${userId}_transactions`],
  });

  // 3. Write insight to local PG
  await cogneeDb.insert(crossModuleInsights).values({
    id: crypto.randomUUID(),
    userId,
    insightType: 'spending_pattern',
    title: 'Unusual spending detected',
    description: cogneeResults[0]?.content ?? '',
    // ...
  }).run();
}
```

### 10.3 Cognee Docker Service Changes

The Cognee service continues pointing to local PG — no changes needed:

```yaml
  cognee:
    environment:
      # Still points to local postgres (unchanged)
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=cognee_db
      - VECTOR_DB_URL=postgresql://app_user:${POSTGRES_PASSWORD}@postgres:5432/cognee_db
```

### 10.4 Local PG Migration Isolation

The local PG container's init scripts need to be updated to only run Cognee-relevant migrations:

```yaml
  postgres:
    volumes:
      # Keep extensions + Cognee DB init
      - ./docker/init-cognee-db.sql:/docker-entrypoint-initdb.d/02-extensions.sql:ro
      - ./docker/init-cognee-db.sh:/docker-entrypoint-initdb.d/03-cognee-db.sh:ro
      # Only Cognee-specific tables in ai_accountant
      - ./docker/migrations/local-pg-init.sql:/docker-entrypoint-initdb.d/04-local-tables.sql:ro
      # Remove all Neon-targeted migrations from initdb.d
```

A new file `docker/migrations/local-pg-init.sql` will contain only the Cognee/AI tables:

```sql
-- local-pg-init.sql: Tables that stay on local PostgreSQL
-- These tables are used by Cognee services and RAG operations

CREATE TABLE IF NOT EXISTS cognee_user_accounts ( /* ... */ );
CREATE TABLE IF NOT EXISTS cognee_sessions ( /* ... */ );
CREATE TABLE IF NOT EXISTS datapoint_configs ( /* ... */ );
CREATE TABLE IF NOT EXISTS graph_schemas ( /* ... */ );
CREATE TABLE IF NOT EXISTS cognee_feedback ( /* ... */ );
CREATE TABLE IF NOT EXISTS rag_namespaces ( /* ... */ );
CREATE TABLE IF NOT EXISTS rag_chunks ( /* ... */ );
CREATE TABLE IF NOT EXISTS rag_documents ( /* ... */ );
CREATE TABLE IF NOT EXISTS rag_citations ( /* ... */ );
CREATE TABLE IF NOT EXISTS temporal_queries ( /* ... */ );
CREATE TABLE IF NOT EXISTS cross_module_insights ( /* ... */ );
CREATE TABLE IF NOT EXISTS intelligence_subscriptions ( /* ... */ );
CREATE TABLE IF NOT EXISTS module_connections ( /* ... */ );
```

---

## 11. Rollback Strategy

### 11.1 Pre-Cutover Checkpoint

```bash
# Before cutover, create full backup of current single-PG setup
PHASE="pre-neon-cutover"
docker compose exec postgres pg_dump -U app_user ai_accountant > backups/${PHASE}.sql
docker tag cba-server:latest cba-server:${PHASE}
docker tag cba-client:latest cba-client:${PHASE}
echo "${PHASE} checkpoint at $(date)" >> backups/checkpoint-log.txt
```

### 11.2 Rollback Procedure

If Neon has issues, revert to single-database mode:

```bash
# 1. Set USE_NEON=false in .env
sed -i 's/USE_NEON=true/USE_NEON=false/' .env

# 2. Ensure LOCAL_PG has all data (restore from pre-cutover backup if needed)
docker compose exec -T postgres psql -U app_user -d ai_accountant < backups/pre-neon-cutover.sql

# 3. Restart server (will use local PG for everything)
docker compose restart server

# 4. Verify
curl http://localhost:3501/health
```

### 11.3 Dual-Write Period (Optional Safety Net)

For the first 7 days after cutover, optionally enable dual-write mode:

```typescript
// In connection-manager.ts, temporary dual-write wrapper:
export function createDualWriteDb(neonDb: any, localDb: any) {
  return new Proxy(neonDb, {
    get(target, prop) {
      if (prop === 'insert' || prop === 'update' || prop === 'delete') {
        return function(...args: any[]) {
          // Write to both, but return Neon result
          const neonResult = target[prop](...args);
          try { localDb[prop](...args); } catch { /* log only */ }
          return neonResult;
        };
      }
      return target[prop];
    }
  });
}
```

This can be removed after the stabilization period.

---

## 12. Implementation Phases

### Phase A: Infrastructure (Day 1-2)

- [ ] Create Neon Cloud project in `ap-southeast-2` region
- [ ] Add `neon-proxy` service to `docker-compose.yml`
- [ ] Create `server/src/db/neon-connection.ts`
- [ ] Create `server/src/db/connection-manager.ts`
- [ ] Create `server/src/services/neon-branches.ts`
- [ ] Add all new environment variables to `.env.example`
- [ ] Install `@neondatabase/serverless` package

### Phase B: Schema Split (Day 3-4)

- [ ] Create `docker/migrations/local-pg-init.sql` with 13 local tables
- [ ] Run Neon migrations (28 migration files)
- [ ] Modify `schema.ts` to export `db` + `cogneeDb`
- [ ] Update 13 Cognee/AI service files to use `cogneeDb`
- [ ] Verify `tsc --noEmit` passes

### Phase C: Data Migration (Day 5)

- [ ] `pg_dump` accounting data from local PG
- [ ] `pg_restore` to Neon Cloud
- [ ] Verify row counts match
- [ ] Create pre-cutover checkpoint

### Phase D: Cutover (Day 6)

- [ ] Set `USE_NEON=true`
- [ ] Restart server
- [ ] Smoke test all major endpoints
- [ ] Monitor for 24 hours

### Phase E: Branching + Masking (Day 7-10)

- [ ] Create `ai-operations` branch
- [ ] Apply masking views (from masking-architect)
- [ ] Wire AI agents to use masked branch for context
- [ ] Create staging branch
- [ ] Set up branch refresh cron jobs

---

## Appendix A: Package Dependencies

```bash
# New npm packages required
npm install @neondatabase/serverless
# @neondatabase/serverless provides: neon(), neonConfig, Pool (serverless-compatible)
# No other new packages needed — existing pg and drizzle-orm handle the rest
```

## Appendix B: Health Check Endpoints

```typescript
// Add to server health check
app.get('/health', async (c) => {
  const checks = {
    neon: { status: 'unknown' },
    localPg: { status: 'unknown' },
    cognee: { status: 'unknown' },
    redis: { status: 'unknown' },
  };

  // Check Neon
  try {
    await neonDb.execute(sql`SELECT 1`);
    checks.neon.status = 'healthy';
  } catch (e) {
    checks.neon.status = 'unhealthy';
  }

  // Check Local PG
  try {
    await localDb.execute(sql`SELECT 1`);
    checks.localPg.status = 'healthy';
  } catch (e) {
    checks.localPg.status = 'unhealthy';
  }

  // ... existing cognee + redis checks ...

  return c.json(checks);
});
```
