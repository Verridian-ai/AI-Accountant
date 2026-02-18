# Cognee Cloud Migration Plan — GoldLedger

**Date**: 2026-02-18
**Status**: IN PROGRESS
**API Key**: `13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff`
**Subscription**: Premium

---

## Executive Summary

Migrate GoldLedger's local Cognee Docker instance to **Cognee Cloud Premium** subscription. This migration will:

1. **Eliminate local infrastructure** — No more Docker Cognee service, local Kuzu graph, or pgvector maintenance
2. **Enable cloud-scale knowledge graphs** — Managed Modal compute, S3 storage, LanceDB vectors, Kuzu graphs
3. **Preserve all 10 advanced features** — DataPoints, Ontologies, NodeSets, Memify, Sessions, RBAC, MCP, all 14 search types
4. **Maintain multi-tenant isolation** — Dataset-level isolation per tenant with API key authentication
5. **Improve performance** — Managed infrastructure with auto-scaling and global CDN

---

## Current State Assessment

### Local Cognee Architecture (Docker)

```
Docker Compose Stack:
├── cognee:8000 (FastAPI server)
│   ├── Kuzu graph DB (local filesystem)
│   ├── pgvector (postgres:5432/cognee_db)
│   ├── Redis cache (redis:6379)
│   └── LLM: google/gemini-3-flash-preview (OpenRouter)
├── postgres:5432 (ai_accountant + cognee_db)
├── redis:6379
├── server:3501 (Hono API)
└── client:8080 (React)
```

### Datasets Defined (41 total)

**Shared Knowledge (6 datasets)**:
- `gst_rules` — ATO GST rulings and tax rules
- `ato_rulings` — Tax office rulings and interpretations
- `tax_tables` — Tax brackets, offsets, Medicare levy
- `deduction_patterns` — Common tax deduction patterns
- `award_rates` — Award wage rates for payroll
- `stp_compliance` — Single Touch Payroll compliance rules

**Per-Tenant Financial Data (33 datasets)**:
- `bank_transactions` — All financial transactions
- `bank_formats` — Statement parser format definitions
- `merchant_mappings` — Merchant name normalization
- `merchant_corrections` — User corrections to merchant categorization
- `transfer_patterns` — Inter-account transfer detection
- `financial_reports` — Generated financial reports
- `budget_templates` — Budget templates and forecasts
- `kpi_history` — KPI metrics over time
- `forecast_patterns` — Forecasting patterns
- `anomaly_history` — Detected anomalies
- `compliance_rulings` — Compliance check results
- `temporal_patterns` — Time-based spending patterns
- `cross_module_insights` — Cross-module intelligence
- `module_relationships` — Module connection metadata
- `cdr_products` — Consumer Data Right product data
- `cdr_rates` — CDR interest rates
- `banking_product_knowledge` — Banking product intelligence
- `market_intelligence` — Market analysis
- `market_sentiment` — Sentiment analysis
- `rba_statistics` — Reserve Bank statistics
- `abs_statistics` — Australian Bureau of Statistics data
- `asx_market_data` — ASX market data
- `inventory_catalog` — Inventory items
- `recon_patterns` — Reconciliation patterns
- `ocr_extractions` — OCR document extractions
- `customer_profiles` — Customer data
- `invoice_history` — Invoice records
- `supplier_profiles` — Supplier data
- `bill_patterns` — Bill payment patterns
- `employee_profiles` — Employee data
- `pay_structures` — Payroll structures
- `search_feedback` — User search feedback
- `datapoint_*` — Dynamic DataPoint configs

### DataPoint Models (10 models)

1. **TransactionNode** — Financial transactions with GST, category, merchant
2. **AccountNode** — Bank accounts with balances, BSB, account type
3. **CategoryNode** — Transaction categories with tax properties
4. **GSTRuleNode** — GST rules and ATO rulings
5. **PatternNode** — Spending/income patterns
6. **BASPeriodNode** — BAS reporting periods with calculations
7. **MerchantNode** — Merchant profiles with spending intelligence
8. **DeductionNode** — Tax deduction claims
9. **EmployeeNode** — Employee profiles for payroll
10. **InvoiceNode** — Invoice/bill entities

### Ontologies (3 ontologies)

1. **Australian Finance Ontology** — Core financial concepts (Account, Transaction, Merchant, Category)
2. **Tax & Compliance Ontology** — ATO concepts (GSTRule, BASPeriod, Deduction, TaxBracket)
3. **Business Operations Ontology** — Business entities (Employee, Customer, Supplier, Invoice)

---

## Migration Architecture

### Cognee Cloud Stack

```
Cognee Cloud (Modal):
├── API: https://api.cognee.ai
├── LanceDB (managed vectors)
├── Kuzu (managed graph)
├── PostgreSQL (managed metadata)
└── S3 (managed storage)
    ↓
GoldLedger Server (Hono):
├── cogwit-sdk (Python SDK)
├── Dataset management
├── Multi-tenant isolation
└── Agent integration
```

### Key Changes

| Component | Before (Local) | After (Cloud) |
|-----------|---------------|---------------|
| Cognee API | `http://localhost:8000` | `https://api.cognee.ai` |
| Authentication | None (`REQUIRE_AUTHENTICATION=false`) | API Key (`13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff`) |
| SDK | HTTP client (`cogneeClient.ts`) | `cogwit-sdk` (Python) + TypeScript wrapper |
| Storage | Local Docker volumes | Managed S3 + LanceDB + Kuzu |
| Compute | Local CPU | Modal serverless (auto-scaling) |
| Datasets | 41 datasets | 41 datasets (migrated) |
| DataPoints | 10 models (TypeScript stubs) | 10 models (Python Pydantic, native) |
| Ontologies | 3 OWL files (unused) | 3 OWL files (uploaded to Cloud) |

---

## Implementation Plan

### Phase 1: Cognee Cloud Setup ✅ (This Session)

1. **Install cogwit-sdk** in server Python environment
2. **Configure API key** in environment variables
3. **Create TypeScript wrapper** for cogwit-sdk calls
4. **Test connection** to Cognee Cloud API

### Phase 2: Dataset Migration (Next)

1. **Create all 41 datasets** in Cognee Cloud
2. **Upload shared knowledge** (6 datasets: gst_rules, ato_rulings, etc.)
3. **Configure dataset permissions** for multi-tenant isolation
4. **Verify dataset creation** via Cloud UI

### Phase 3: DataPoint & Ontology Upload (Next)

1. **Convert 10 DataPoint models** from TypeScript to Python Pydantic
2. **Upload DataPoint definitions** to Cognee Cloud
3. **Upload 3 OWL ontology files** to Cognee Cloud
4. **Test entity extraction** with custom DataPoints

### Phase 4: Agent Integration (Next)

1. **Update CogneeClient** to use Cognee Cloud API
2. **Wire all 20+ agents** to use Cognee Cloud datasets
3. **Test search across all search types** (14 types)
4. **Verify session management** with Redis

### Phase 5: Production Cutover (Final)

1. **Remove local Cognee Docker service** from docker-compose.yml
2. **Update environment variables** to point to Cloud
3. **Test full application** end-to-end
4. **Monitor performance** and costs

---

## Next Steps

1. Install `cogwit-sdk` in server
2. Create Cognee Cloud connection service
3. Create all datasets
4. Upload DataPoints and Ontologies
5. Test search and cognify operations


