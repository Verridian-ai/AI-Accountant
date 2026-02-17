# Cognee MAXIMALIST Integration Plan — GoldLedger

**Author**: Cognee Maximalist Agent Team
**Date**: 2026-02-17
**Status**: FINAL — No hedging. No exit criteria. Cognee IS the platform.
**Scope**: Complete Cognee integration using EVERY advanced feature at maximum power.

---

## Philosophy: Why Cognee is NON-NEGOTIABLE

There is no "maybe pgvector instead" discussion. There is no exit criterion. Cognee provides:

1. **Knowledge graph construction** — Automated entity extraction, relationship discovery, and graph building from financial text. pgvector cannot do this.
2. **Multi-hop graph reasoning** — GRAPH_COMPLETION traverses entity relationships to answer "why is my spending on utilities increasing?" by connecting Utility -> AGL Energy -> price increases -> seasonal pattern -> new property. Vector similarity returns "similar transactions" — useless for reasoning.
3. **12+ search modes** — Each optimized for different query types. From CHUNKS (fast vector) to GRAPH_COMPLETION_COT (chain-of-thought reasoning) to NATURAL_LANGUAGE (Cypher generation). No alternative provides this range.
4. **Custom DataPoints** — Pydantic models that teach Cognee's extraction pipeline domain-specific entities. TransactionNode, MerchantNode, GSTRuleNode become first-class graph citizens, not generic text blobs.
5. **Ontology-driven extraction** — OWL vocabularies that standardize entity types against Australian financial domain concepts.
6. **Memify enrichment** — Derived knowledge: spending patterns, category summaries, merchant intelligence, all automatically generated from the existing graph.
7. **Session memory** — Conversational context across searches. "What about Q3?" works because Cognee remembers the previous BAS query.
8. **Multi-tenant RBAC** — Dataset-level isolation with user/tenant/role permission hierarchy. User A's financial data is invisible to User B.
9. **MCP server** — 11 tools exposed via Model Context Protocol for Claude Agent SDK integration.
10. **NodeSets** — Lightweight tagging system for temporal, categorical, and account-level data organization.

**Decision: Implement ALL 10 features. No exceptions. No deferrals.**

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Feature Gap Matrix](#2-feature-gap-matrix)
3. [Feature 1: Custom DataPoint Models (Python Pydantic)](#3-feature-1-custom-datapoint-models)
4. [Feature 2: Custom Ontologies (RDF/OWL)](#4-feature-2-custom-ontologies)
5. [Feature 3: Custom Pipelines & Tasks](#5-feature-3-custom-pipelines--tasks)
6. [Feature 4: Memify Enrichment Rules](#6-feature-4-memify-enrichment-rules)
7. [Feature 5: NodeSet Tagging Strategy](#7-feature-5-nodeset-tagging-strategy)
8. [Feature 6: All 12+ Search Types](#8-feature-6-all-12-search-types)
9. [Feature 7: Sessions with Redis](#9-feature-7-sessions-with-redis)
10. [Feature 8: Multi-Tenant RBAC](#10-feature-8-multi-tenant-rbac)
11. [Feature 9: MCP Server](#11-feature-9-mcp-server)
12. [Feature 10: Agent-Cognee Wiring Matrix](#12-feature-10-agent-cognee-wiring-matrix)
13. [Implementation Timeline](#13-implementation-timeline)
14. [File Inventory](#14-file-inventory)
15. [Docker Changes](#15-docker-changes)

---

## 1. Current State Assessment

### 1.1 Architecture (3-Layer Design)

```
Layer 3: Agent Tools (CogneeTools class)
  server/src/services/claude/cognee-tools.ts + constants + types
  Per-user/tenant scoping, batch indexing, domain helpers

Layer 2: Session & Cache (CogneeSessionService)
  server/src/services/cognee-sessions/service.ts
  Redis-backed sessions, query caching, rate limiting

Layer 1: HTTP Client (CogneeClient class hierarchy)
  server/src/services/cognee/ (14 files, ~900 lines)
  CogneeClientBase -> CogneeClientSearchCognify -> CogneeClient
  Auth, search, cognify, data-ops, merchant memory
       |
       v
Cognee API Server (Docker: cba-cognee, port 8000)
  Kuzu graph + pgvector + Redis
  LLM: google/gemini-3-flash-preview via OpenRouter
  Embeddings: text-embedding-3-small (1536 dims)
```

### 1.2 What Works Today

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| Core client (auth, search, cognify, data-ops) | 14 | ~900 | Working |
| Sessions (Redis CRUD, conversation turns, caching) | 8 | ~600 | Working but NOT wired to chat |
| DataPoints (TypeScript stubs, DB storage) | 4 | ~400 | PARTIAL — TS only, not Cognee-native |
| Ontologies (3 predefined, DB storage) | 4 | ~300 | PARTIAL — TS objects, not OWL |
| Graph operations (mutations, queries, traversal) | 5 | ~400 | Working |
| Feedback (feedback + memify trigger) | 5 | ~350 | Working |
| Admin (dataset mgmt, graph stats) | 3 | ~250 | Working |
| Agent tools (CogneeTools class) | 4 | ~500 | Working |
| **Total** | **~47** | **~3,700** | |

### 1.3 41 Named Datasets

**Shared (6)**: gst_rules, ato_rulings, tax_tables, deduction_patterns, award_rates, stp_compliance
**Row-filtered (2)**: merchant_data, matching_patterns
**Per-tenant (33)**: bank_transactions, bank_formats, merchant_mappings, merchant_corrections, transfer_patterns, financial_reports, budget_templates, kpi_history, forecast_patterns, anomaly_history, compliance_rulings, temporal_patterns, cross_module_insights, module_relationships, cdr_products, cdr_rates, banking_product_knowledge, market_intelligence, market_sentiment, rba_statistics, abs_statistics, asx_market_data, inventory_catalog, recon_patterns, ocr_extractions, customer_profiles, invoice_history, supplier_profiles, bill_patterns, employee_profiles, pay_structures, search_feedback, datapoint_*

### 1.4 Docker Configuration

```yaml
cognee:
  build: ./cognee-repo
  environment:
    REQUIRE_AUTHENTICATION: "false"          # WILL CHANGE TO true
    ENABLE_BACKEND_ACCESS_CONTROL: "false"   # WILL CHANGE TO true
    CACHING: "true"
    CACHE_BACKEND: redis
    CACHE_HOST: redis
    CACHE_PORT: 6379
    LLM_PROVIDER: custom
    LLM_MODEL: openrouter/google/gemini-3-flash-preview
    EMBEDDING_PROVIDER: openai
    EMBEDDING_MODEL: text-embedding-3-small
    EMBEDDING_DIMENSIONS: 1536
    GRAPH_DATABASE_PROVIDER: kuzu
    VECTOR_DB_PROVIDER: pgvector
    DB_NAME: cognee_db
```

---

## 2. Feature Gap Matrix

**ALL features are P0 or P1. There are no P2/P3 items.**

| # | Feature | Current State | Target State | Priority |
|---|---------|---------------|-------------|----------|
| F1 | Custom DataPoint Models | 8 TypeScript interfaces in DB. Cognee ignores them during cognify. | 10+ Python Pydantic DataPoint classes mounted in Cognee container. Native entity extraction. | **P0** |
| F2 | Custom Ontologies (OWL) | 3 TypeScript ontology objects. Never sent to Cognee. | RDF/OWL file for Australian finance. Passed to cognify via `ontology_file_path`. | **P0** |
| F3 | Custom Pipelines & Tasks | Default cognify only. No custom tasks. | 5 custom tasks: financial entity extraction, GST classification, transfer detection, temporal patterns, tax deduction. | **P1** |
| F4 | Memify Enrichment | `triggerMemify()` exists. Called by feedback service. No custom enrichment tasks. | 5 enrichment rules: spending patterns, BAS summaries, merchant intel, transfer rules, recurring schedules. | **P1** |
| F5 | NodeSets | Not used anywhere. `node_set` parameter never passed. | Temporal (FY, BAS Q), categorical (deductions, GST), account-level tagging on all data ingestion. | **P1** |
| F6 | All 12+ Search Types | 6 types used (CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION, RAG_COMPLETION, GRAPH_SUMMARY_COMPLETION, GRAPH_COMPLETION_COT). 8 defined but unused. | All 14 types mapped to specific use cases with smart type selection. | **P0** |
| F7 | Sessions with Redis | `CogneeSessionService` exists with full CRUD. NOT wired to /api/chat endpoint. | Session created per chat conversation. session_id passed to all search calls. 30-min TTL. | **P0** |
| F8 | Multi-Tenant RBAC | Both auth flags FALSE. All data globally accessible. | `REQUIRE_AUTHENTICATION=true`, `ENABLE_BACKEND_ACCESS_CONTROL=true`. Per-tenant dataset isolation with role-based permissions. | **P0** |
| F9 | MCP Server | Not configured. cognee-repo/cognee-mcp/ exists but unused. | Deployed as sidecar in server container. API mode connecting to centralized Cognee backend. 11 tools exposed. | **P1** |
| F10 | Agent-Cognee Wiring | 0 of 20+ agents accessible from chat. Some agents have CogneeTools but most bypass it. | All 20+ agents wired via intent router. Each agent has specific datasets, search types, session handling. | **P0** |

---

## 3. Feature 1: Custom DataPoint Models

### 3.1 The Problem

The codebase has 8 TypeScript `DataPointModel` interfaces (`datapoint-models.ts`). These are stored as JSON strings in PostgreSQL's `datapoint_configs` table and sent to Cognee as plain text descriptions. **Cognee completely ignores them** — it does generic entity extraction during cognify, not domain-specific financial extraction.

Cognee DataPoints are **Python Pydantic models** that inherit from `cognee.infrastructure.engine.DataPoint`. They must be:
1. Defined as Python classes
2. Mounted into the Cognee container
3. Used in custom tasks during cognify
4. Their `metadata.index_fields` controls which fields get embedded

### 3.2 Python DataPoint Model Definitions

Create `cognee-repo/custom_models/goldledger_datapoints.py`:

```python
"""
GoldLedger Custom DataPoint Models for Cognee.

10 domain-specific DataPoints for Australian financial entity extraction.
These are registered with Cognee's ECL pipeline for structured extraction.
"""
from typing import Optional, List
from cognee.infrastructure.engine import DataPoint


class TransactionNode(DataPoint):
    """A financial transaction from a bank statement."""
    description: str
    amount_cents: int
    category: str
    date: str  # ISO 8601
    gst_amount_cents: int = 0
    gst_applicable: bool = False
    claim_type: str = ""  # work-related, self-education, etc.
    is_debit: bool = True
    merchant: Optional["MerchantNode"] = None  # Relationship -> edge
    account: Optional["AccountNode"] = None    # Relationship -> edge
    bas_period: Optional["BASPeriodNode"] = None  # Relationship -> edge
    metadata: dict = {"index_fields": ["description", "category", "merchant"]}


class AccountNode(DataPoint):
    """A bank or business account."""
    account_number_masked: str
    account_type: str  # savings, business, credit, loan
    bank_name: str
    bsb: str = ""
    balance_cents: int = 0
    ownership_tag: str = ""  # personal, business, trust
    metadata: dict = {"index_fields": ["account_type", "bank_name"]}


class MerchantNode(DataPoint):
    """A merchant/vendor profile with spending intelligence."""
    name: str
    canonical_name: str = ""
    abn: str = ""
    industry: str = ""
    primary_category: str = ""
    avg_amount_cents: int = 0
    frequency: str = ""  # weekly, monthly, quarterly
    total_spend_cents: int = 0
    gst_registered: bool = False
    category_patterns: List["CategoryNode"] = []  # Relationship -> edges
    metadata: dict = {"index_fields": ["name", "canonical_name", "industry"]}


class CategoryNode(DataPoint):
    """A transaction category with tax properties."""
    name: str
    parent_category: str = ""
    category_type: str = ""  # income, expense, transfer
    tax_deductible: bool = False
    gst_applicable: bool = True
    ato_category_code: str = ""  # D1-D15 for deductions
    metadata: dict = {"index_fields": ["name", "parent_category"]}


class GSTRuleNode(DataPoint):
    """An Australian GST rule or ATO ruling."""
    rule_type: str  # input_taxed, gst_free, standard, export
    rate: float  # 0.0 or 0.1
    description: str
    ato_reference: str = ""
    applies_to_categories: List[str] = []
    effective_date: str = ""
    metadata: dict = {"index_fields": ["description", "rule_type", "ato_reference"]}


class PatternNode(DataPoint):
    """A detected financial pattern or trend."""
    pattern_type: str  # recurring, seasonal, anomaly, trend, spike
    frequency: str = ""  # daily, weekly, fortnightly, monthly, quarterly, annual
    amount_range_min_cents: int = 0
    amount_range_max_cents: int = 0
    related_merchants: str = ""  # comma-separated
    related_categories: str = ""  # comma-separated
    confidence: float = 0.0
    account: Optional["AccountNode"] = None  # Relationship -> edge
    metadata: dict = {"index_fields": ["pattern_type", "frequency"]}


class BASPeriodNode(DataPoint):
    """A BAS reporting period with GST calculations."""
    quarter: str  # Q1, Q2, Q3, Q4
    financial_year: str  # e.g. 2025-26
    start_date: str = ""
    end_date: str = ""
    gst_collected_cents: int = 0  # G1
    gst_paid_cents: int = 0
    net_gst_cents: int = 0
    total_sales_cents: int = 0
    total_purchases_cents: int = 0
    metadata: dict = {"index_fields": ["quarter", "financial_year"]}


class DeductionNode(DataPoint):
    """A tax deduction claim with ATO categorization."""
    deduction_type: str  # work-related, self-education, home-office, vehicle
    ato_category: str  # D1-D15
    amount_cents: int = 0
    financial_year: str = ""
    ato_ruling: str = ""
    substantiation: str = ""  # receipt, logbook, diary
    claim_percentage: float = 100.0
    related_transactions: List["TransactionNode"] = []  # Relationship -> edges
    metadata: dict = {"index_fields": ["deduction_type", "ato_category"]}


class FinancialYearNode(DataPoint):
    """An Australian financial year (Jul 1 - Jun 30)."""
    year_label: str  # e.g. "2024-25"
    start_date: str  # "2024-07-01"
    end_date: str  # "2025-06-30"
    total_income_cents: int = 0
    total_expenses_cents: int = 0
    total_gst_collected_cents: int = 0
    total_gst_paid_cents: int = 0
    metadata: dict = {"index_fields": ["year_label"]}


class TransferNode(DataPoint):
    """An inter-account transfer linking two accounts."""
    from_account: Optional["AccountNode"] = None  # Relationship -> edge
    to_account: Optional["AccountNode"] = None  # Relationship -> edge
    amount_cents: int = 0
    date: str = ""
    is_recurring: bool = False
    frequency: str = ""
    metadata: dict = {"index_fields": ["date"]}
```

### 3.3 Graph Relationships Produced

When `add_data_points()` processes these models, Cognee automatically creates:

| Edge | Source | Target | Description |
|------|--------|--------|-------------|
| `merchant` | TransactionNode | MerchantNode | Transaction paid to merchant |
| `account` | TransactionNode | AccountNode | Transaction belongs to account |
| `bas_period` | TransactionNode | BASPeriodNode | Transaction in BAS period |
| `category_patterns` | MerchantNode | CategoryNode | Merchant operates in category |
| `account` | PatternNode | AccountNode | Pattern observed in account |
| `related_transactions` | DeductionNode | TransactionNode | Deduction from transactions |
| `from_account` | TransferNode | AccountNode | Transfer source |
| `to_account` | TransferNode | AccountNode | Transfer destination |

### 3.4 Mounting in Cognee Container

Modify `cognee-repo/Dockerfile` (or docker-compose volume mount):

```yaml
# docker-compose.yml
cognee:
  volumes:
    - ./server/cognee-models:/app/custom_models:ro
```

Create `server/cognee-models/__init__.py` and `server/cognee-models/goldledger_datapoints.py` with the models above.

---

## 4. Feature 2: Custom Ontologies

### 4.1 OWL Ontology for Australian Finance

Create `server/cognee-models/ontologies/australian-finance.owl`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:gl="http://goldledger.app/ontology#"
  xmlns:fibo="https://spec.edmcouncil.org/fibo/ontology#">

  <owl:Ontology rdf:about="http://goldledger.app/ontology">
    <rdfs:label>GoldLedger Australian Financial Ontology</rdfs:label>
    <rdfs:comment>Domain ontology for Australian financial entities, GST, BAS, and tax deductions</rdfs:comment>
  </owl:Ontology>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Core Financial Classes                                                  -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <owl:Class rdf:about="gl:Transaction">
    <rdfs:label>Financial Transaction</rdfs:label>
    <rdfs:comment>A monetary transaction from a bank statement</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:Account">
    <rdfs:label>Bank Account</rdfs:label>
    <rdfs:comment>A bank or financial account</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:Merchant">
    <rdfs:label>Merchant</rdfs:label>
    <rdfs:comment>A business entity that receives or sends payments</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:Category">
    <rdfs:label>Transaction Category</rdfs:label>
    <rdfs:comment>A classification for transactions</rdfs:comment>
  </owl:Class>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Australian Tax Classes                                                  -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <owl:Class rdf:about="gl:GSTClassification">
    <rdfs:label>GST Classification</rdfs:label>
    <rdfs:comment>GST treatment: standard (10%), GST-free, input-taxed, export</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:BASPeriod">
    <rdfs:label>BAS Period</rdfs:label>
    <rdfs:comment>A Business Activity Statement reporting period (quarterly: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun)</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:FinancialYear">
    <rdfs:label>Australian Financial Year</rdfs:label>
    <rdfs:comment>Australian financial year running July 1 to June 30</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:TaxDeduction">
    <rdfs:label>Tax Deduction</rdfs:label>
    <rdfs:comment>An ATO-allowed tax deduction (D1-D15 categories)</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:ATORuling">
    <rdfs:label>ATO Ruling</rdfs:label>
    <rdfs:comment>An Australian Tax Office ruling or determination</rdfs:comment>
  </owl:Class>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Entity Type Classes                                                     -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <owl:Class rdf:about="gl:SoleTrader">
    <rdfs:subClassOf rdf:resource="gl:TaxEntity"/>
    <rdfs:label>Sole Trader</rdfs:label>
  </owl:Class>

  <owl:Class rdf:about="gl:Company">
    <rdfs:subClassOf rdf:resource="gl:TaxEntity"/>
    <rdfs:label>Company</rdfs:label>
  </owl:Class>

  <owl:Class rdf:about="gl:Trust">
    <rdfs:subClassOf rdf:resource="gl:TaxEntity"/>
    <rdfs:label>Trust</rdfs:label>
  </owl:Class>

  <owl:Class rdf:about="gl:Partnership">
    <rdfs:subClassOf rdf:resource="gl:TaxEntity"/>
    <rdfs:label>Partnership</rdfs:label>
  </owl:Class>

  <owl:Class rdf:about="gl:SMSF">
    <rdfs:subClassOf rdf:resource="gl:TaxEntity"/>
    <rdfs:label>Self-Managed Super Fund</rdfs:label>
  </owl:Class>

  <owl:Class rdf:about="gl:TaxEntity">
    <rdfs:label>Tax Entity</rdfs:label>
    <rdfs:comment>A taxable entity registered with the ATO</rdfs:comment>
  </owl:Class>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Pattern Classes                                                         -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <owl:Class rdf:about="gl:SpendingPattern">
    <rdfs:label>Spending Pattern</rdfs:label>
    <rdfs:comment>A recurring or seasonal spending pattern</rdfs:comment>
  </owl:Class>

  <owl:Class rdf:about="gl:Transfer">
    <rdfs:label>Inter-Account Transfer</rdfs:label>
    <rdfs:comment>A transfer between two accounts owned by the same entity</rdfs:comment>
  </owl:Class>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Object Properties (Relationships)                                       -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <owl:ObjectProperty rdf:about="gl:belongsTo">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:Account"/>
    <rdfs:label>belongs to</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:paidTo">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:Merchant"/>
    <rdfs:label>paid to</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:categorizedAs">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:Category"/>
    <rdfs:label>categorized as</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:hasGSTClassification">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:GSTClassification"/>
    <rdfs:label>has GST classification</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:inBASPeriod">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:BASPeriod"/>
    <rdfs:label>in BAS period</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:inFinancialYear">
    <rdfs:domain rdf:resource="gl:Transaction"/>
    <rdfs:range rdf:resource="gl:FinancialYear"/>
    <rdfs:label>in financial year</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:governedBy">
    <rdfs:domain rdf:resource="gl:TaxDeduction"/>
    <rdfs:range rdf:resource="gl:ATORuling"/>
    <rdfs:label>governed by</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:claims">
    <rdfs:domain rdf:resource="gl:TaxEntity"/>
    <rdfs:range rdf:resource="gl:TaxDeduction"/>
    <rdfs:label>claims</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:operatesIn">
    <rdfs:domain rdf:resource="gl:Merchant"/>
    <rdfs:range rdf:resource="gl:Category"/>
    <rdfs:label>operates in</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:fromAccount">
    <rdfs:domain rdf:resource="gl:Transfer"/>
    <rdfs:range rdf:resource="gl:Account"/>
    <rdfs:label>from account</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:toAccount">
    <rdfs:domain rdf:resource="gl:Transfer"/>
    <rdfs:range rdf:resource="gl:Account"/>
    <rdfs:label>to account</rdfs:label>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="gl:observedIn">
    <rdfs:domain rdf:resource="gl:SpendingPattern"/>
    <rdfs:range rdf:resource="gl:Account"/>
    <rdfs:label>observed in</rdfs:label>
  </owl:ObjectProperty>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- GST Classification Individuals                                          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <gl:GSTClassification rdf:about="gl:StandardRated">
    <rdfs:label>Standard Rated (10%)</rdfs:label>
    <gl:rate>0.1</gl:rate>
  </gl:GSTClassification>

  <gl:GSTClassification rdf:about="gl:GSTFree">
    <rdfs:label>GST-Free</rdfs:label>
    <gl:rate>0.0</gl:rate>
  </gl:GSTClassification>

  <gl:GSTClassification rdf:about="gl:InputTaxed">
    <rdfs:label>Input Taxed</rdfs:label>
    <gl:rate>0.0</gl:rate>
  </gl:GSTClassification>

  <gl:GSTClassification rdf:about="gl:ExportGSTFree">
    <rdfs:label>Export (GST-Free)</rdfs:label>
    <gl:rate>0.0</gl:rate>
  </gl:GSTClassification>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- ATO Deduction Category Individuals (D1-D15)                             -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <gl:TaxDeduction rdf:about="gl:D1_WorkRelatedCarExpenses">
    <rdfs:label>D1: Work-related car expenses</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D2_WorkRelatedTravelExpenses">
    <rdfs:label>D2: Work-related travel expenses</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D3_WorkRelatedClothing">
    <rdfs:label>D3: Work-related clothing, laundry, and dry-cleaning</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D4_WorkRelatedSelfEducation">
    <rdfs:label>D4: Work-related self-education expenses</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D5_OtherWorkRelated">
    <rdfs:label>D5: Other work-related expenses</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D6_LowValuePoolDeduction">
    <rdfs:label>D6: Low-value pool deduction</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D7_InterestDeductions">
    <rdfs:label>D7: Interest deductions</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D8_DividendDeductions">
    <rdfs:label>D8: Dividend deductions</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D9_GiftsOrDonations">
    <rdfs:label>D9: Gifts or donations</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D10_CostOfManagingTaxAffairs">
    <rdfs:label>D10: Cost of managing tax affairs</rdfs:label>
  </gl:TaxDeduction>

  <gl:TaxDeduction rdf:about="gl:D15_WorkFromHomeExpenses">
    <rdfs:label>D15: Working from home expenses</rdfs:label>
  </gl:TaxDeduction>

  <!-- BAS Quarter Individuals -->
  <gl:BASPeriod rdf:about="gl:BAS_Q1">
    <rdfs:label>Q1: July-September</rdfs:label>
    <gl:startMonth>7</gl:startMonth>
    <gl:endMonth>9</gl:endMonth>
  </gl:BASPeriod>

  <gl:BASPeriod rdf:about="gl:BAS_Q2">
    <rdfs:label>Q2: October-December</rdfs:label>
    <gl:startMonth>10</gl:startMonth>
    <gl:endMonth>12</gl:endMonth>
  </gl:BASPeriod>

  <gl:BASPeriod rdf:about="gl:BAS_Q3">
    <rdfs:label>Q3: January-March</rdfs:label>
    <gl:startMonth>1</gl:startMonth>
    <gl:endMonth>3</gl:endMonth>
  </gl:BASPeriod>

  <gl:BASPeriod rdf:about="gl:BAS_Q4">
    <rdfs:label>Q4: April-June</rdfs:label>
    <gl:startMonth>4</gl:startMonth>
    <gl:endMonth>6</gl:endMonth>
  </gl:BASPeriod>

</rdf:RDF>
```

### 4.2 Ontology Integration

Pass to cognify via REST API:

```typescript
// server/src/services/cognee/cognify.ts — enhanced
export async function cognifyWithOntology(
  state: AuthState,
  datasets: string[],
  ontologyPath: string = '/app/custom_models/ontologies/australian-finance.owl',
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const datasetNames = applyTenantPrefixToAll(datasets, tenantId);
  const auth = await buildAuthHeaders(state, userId);
  const res = await fetch(`${state.baseUrl}/api/v1/cognify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      datasets: datasetNames,
      run_in_background: true,
      custom_prompt: MAXIMALIST_COGNIFY_PROMPT,
      ontology_file_path: ontologyPath,
    }),
  });
}
```

The ontology file is mounted via Docker volume alongside the DataPoint models.

---

## 5. Feature 3: Custom Pipelines & Tasks

### 5.1 Custom Cognify Tasks

Create 5 custom Python tasks for the GoldLedger domain. These extend or replace the default cognify pipeline steps.

#### Task 1: Financial Entity Extraction

```python
# server/cognee-models/tasks/financial_entity_extraction.py
from cognee.infrastructure.engine import DataPoint
from cognee.tasks import Task

async def extract_financial_entities(chunks):
    """Extract TransactionNode, MerchantNode, AccountNode from document chunks."""
    for chunk in chunks:
        # LLM call to extract structured entities
        # Returns DataPoint instances: TransactionNode, MerchantNode, etc.
        entities = await llm_extract(chunk.text, target_types=[
            "TransactionNode", "MerchantNode", "AccountNode",
            "CategoryNode", "GSTRuleNode"
        ])
        for entity in entities:
            yield entity

financial_extraction_task = Task(
    extract_financial_entities,
    task_config={"batch_size": 10}
)
```

#### Task 2: GST Classification

```python
async def classify_gst(entities):
    """Apply ATO GST rules to extracted entities."""
    for entity in entities:
        if hasattr(entity, 'category'):
            gst_rule = await lookup_gst_rule(entity.category)
            entity.gst_applicable = gst_rule.rate > 0
            entity.gst_amount_cents = int(entity.amount_cents * gst_rule.rate / 1.1)
            yield entity

gst_classification_task = Task(classify_gst)
```

#### Task 3: Transfer Detection

```python
async def detect_transfers(entities):
    """Identify matching debit/credit pairs as inter-account transfers."""
    transactions = [e for e in entities if isinstance(e, TransactionNode)]
    # Group by amount and date, find matching pairs
    for t1 in transactions:
        for t2 in transactions:
            if (t1.amount_cents == -t2.amount_cents and
                t1.date == t2.date and t1.account != t2.account):
                yield TransferNode(
                    from_account=t1.account if t1.is_debit else t2.account,
                    to_account=t2.account if t1.is_debit else t1.account,
                    amount_cents=abs(t1.amount_cents),
                    date=t1.date,
                )

transfer_detection_task = Task(detect_transfers)
```

#### Task 4: Temporal Pattern Extraction

```python
async def extract_temporal_patterns(entities):
    """Extract recurring payment patterns and seasonal trends."""
    from collections import defaultdict
    merchant_txns = defaultdict(list)

    for entity in entities:
        if isinstance(entity, TransactionNode):
            merchant_txns[entity.merchant.name if entity.merchant else "unknown"].append(entity)

    for merchant, txns in merchant_txns.items():
        if len(txns) >= 3:
            frequency = detect_frequency(txns)  # weekly, monthly, etc.
            if frequency:
                yield PatternNode(
                    pattern_type="recurring",
                    frequency=frequency,
                    amount_range_min_cents=min(t.amount_cents for t in txns),
                    amount_range_max_cents=max(t.amount_cents for t in txns),
                    related_merchants=merchant,
                )

temporal_pattern_task = Task(extract_temporal_patterns)
```

#### Task 5: Tax Deduction Classification

```python
async def classify_tax_deductions(entities):
    """Map transactions to ATO deduction categories (D1-D15)."""
    for entity in entities:
        if isinstance(entity, TransactionNode) and entity.is_debit:
            deduction = await llm_classify_deduction(
                entity.description, entity.category, entity.amount_cents
            )
            if deduction:
                yield DeductionNode(
                    deduction_type=deduction.type,
                    ato_category=deduction.ato_code,
                    amount_cents=entity.amount_cents,
                    ato_ruling=deduction.ruling,
                    substantiation=deduction.evidence_type,
                    related_transactions=[entity],
                )

tax_deduction_task = Task(classify_tax_deductions)
```

### 5.2 Custom Pipeline Definition

```python
# server/cognee-models/pipelines/goldledger_pipeline.py
from cognee.api.v1.cognify.cognify_v2 import get_default_tasks

def goldledger_cognify_tasks():
    """GoldLedger custom cognify pipeline.
    Extends default tasks with financial domain extraction."""
    default = get_default_tasks()
    # Insert custom tasks after default graph extraction (step 4)
    return [
        *default[:4],  # classify, check perms, chunk, extract graph
        financial_extraction_task,
        gst_classification_task,
        transfer_detection_task,
        temporal_pattern_task,
        tax_deduction_task,
        *default[4:],  # summarize, add data points
    ]
```

### 5.3 Wiring via REST API

The Cognee REST API's `/api/v1/cognify` endpoint supports `custom_tasks` parameter (when custom tasks are mounted). The TypeScript client calls:

```typescript
await fetch(`${baseUrl}/api/v1/cognify`, {
  method: 'POST',
  body: JSON.stringify({
    datasets: ['bank_transactions'],
    custom_prompt: MAXIMALIST_COGNIFY_PROMPT,
    ontology_file_path: '/app/custom_models/ontologies/australian-finance.owl',
    run_in_background: true,
  }),
});
```

---

## 6. Feature 4: Memify Enrichment Rules

### 6.1 What Memify Does

After cognify builds the graph, memify enriches it with **derived facts** — new nodes and edges created by analyzing existing graph structures. This is how Cognee builds "intelligence" on top of raw data.

### 6.2 Five Enrichment Rules for GoldLedger

#### Rule 1: Spending Pattern Derivation

```python
async def derive_spending_patterns(subgraph_chunks):
    """Analyze transaction nodes to derive category-level spending patterns."""
    # For each account, group transactions by category and month
    # Derive: avg monthly spend, trend direction, seasonal variation
    # Create PatternNode for each significant pattern
```

#### Rule 2: BAS Quarter Summaries

```python
async def derive_bas_summaries(subgraph_chunks):
    """Aggregate transaction nodes into BAS period summaries."""
    # Group transactions by BAS quarter
    # Calculate: G1 (GST collected), G11 (GST paid), G20 (net)
    # Create BASPeriodNode with aggregated figures
```

#### Rule 3: Merchant Intelligence

```python
async def derive_merchant_intelligence(subgraph_chunks):
    """Analyze merchant nodes to derive intelligence."""
    # For each merchant: frequency, avg amount, category consistency
    # Flag: merchants appearing in multiple categories (possible miscat)
    # Create enriched MerchantNode with derived fields
```

#### Rule 4: Transfer Pattern Rules

```python
async def derive_transfer_rules(subgraph_chunks):
    """Identify recurring transfer patterns between accounts."""
    # Detect: same-amount transfers on regular schedules
    # Create TransferNode patterns for auto-matching
```

#### Rule 5: Recurring Payment Schedules

```python
async def derive_recurring_schedules(subgraph_chunks):
    """Extract recurring payment schedules from transaction history."""
    # Detect: weekly rent, monthly subscriptions, quarterly insurance
    # Create PatternNode with next_expected_date
```

### 6.3 Trigger via TypeScript Client

```typescript
// Trigger memify with custom enrichment after cognify completes
await triggerMemify(authState, {
  datasets: ['bank_transactions', 'merchant_data'],
  run_in_background: true,
}, userId, tenantId);
```

The existing `triggerMemify()` function in `cognee/cognify.ts` already calls `/api/v1/memify`. Custom enrichment tasks are configured in the mounted Python models.

---

## 7. Feature 5: NodeSet Tagging Strategy

### 7.1 Three-Dimensional Tagging

Every piece of data ingested into Cognee gets tagged with NodeSets across 3 dimensions:

| Dimension | NodeSet Tags | Purpose |
|-----------|-------------|---------|
| **Temporal** | `FY2024-25`, `Q1`, `Q2`, `Q3`, `Q4`, `2025-01`, `2025-02`, etc. | Scope searches to time periods |
| **Categorical** | `tax_deductions`, `work_related`, `gst_applicable`, `gst_free`, `income`, `expenses` | Scope searches to transaction types |
| **Account** | `account_123456`, `account_789012` | Scope searches to specific accounts |

### 7.2 Implementation in Data Ingestion

Modify `cognee/data-ops.ts` to pass `node_set` parameter:

```typescript
export async function addTransaction(
  state: AuthState,
  transaction: TransactionData,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const d = new Date(transaction.date);
  const fy = d.getMonth() >= 6
    ? `FY${d.getFullYear()}-${(d.getFullYear() + 1).toString().slice(2)}`
    : `FY${d.getFullYear() - 1}-${d.getFullYear().toString().slice(2)}`;
  const basQ = getBASQuarter(d);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const nodeSets: string[] = [
    fy,                                    // FY2024-25
    basQ,                                  // Q3
    month,                                 // 2025-01
  ];

  if (transaction.accountId) {
    nodeSets.push(`account_${transaction.accountId}`);
  }
  if (transaction.category) {
    nodeSets.push(transaction.category.toLowerCase().replace(/\s+/g, '_'));
  }
  if (transaction.gstApplicable) {
    nodeSets.push('gst_applicable');
  } else {
    nodeSets.push('gst_free');
  }
  if (transaction.isDebit) {
    nodeSets.push('expenses');
  } else {
    nodeSets.push('income');
  }

  const text = buildTransactionText(transaction, fy, basQ, month);

  // Pass node_set to Cognee add endpoint
  await addDataWithNodeSets(state, [text], 'bank_transactions', nodeSets, userId, tenantId);
}
```

### 7.3 NodeSet-Scoped Search

```typescript
// Search only within Q3 of FY2024-25 for tax deductions
const results = await searchWithNodeSets(authState, {
  query: 'work-related expenses',
  dataset: 'bank_transactions',
  nodeSets: ['FY2024-25', 'Q3', 'tax_deductions'],
  searchType: 'GRAPH_COMPLETION',
});
```

### 7.4 New Client Method

Add `addDataWithNodeSets()` to `cognee/data-ops.ts`:

```typescript
export async function addDataWithNodeSets(
  state: AuthState,
  data: string[],
  dataset: string,
  nodeSets: string[],
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const prefixed = applyTenantPrefix(dataset, tenantId);
  const auth = await buildAuthHeaders(state, userId);
  const blob = new Blob([data.join('\n')], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('data', blob, `${prefixed}.txt`);
  formData.append('datasetName', prefixed);
  formData.append('node_set', JSON.stringify(nodeSets));

  await fetch(`${state.baseUrl}/api/v1/add`, {
    method: 'POST',
    headers: auth,
    body: formData,
  });
}
```

---

## 8. Feature 6: All 12+ Search Types

### 8.1 Complete Search Type Mapping

| Search Type | Use Case in GoldLedger | Agent(s) | Priority |
|-------------|----------------------|----------|----------|
| **GRAPH_COMPLETION** | Default for chat queries. Multi-hop reasoning: "Why is my spending increasing?" | All agents via chat | **P0** |
| **GRAPH_COMPLETION_COT** | Complex tax questions requiring step-by-step reasoning: "Can I claim my home office AND car expenses for the same work trip?" | tax_strategy, personal_tax_claims, gst_calculator | **P0** |
| **GRAPH_COMPLETION_CONTEXT_EXTENSION** | Multi-hop exploration: "Show me everything related to my AGL Energy payments" | merchant_intelligence, cross_account_tracer | **P1** |
| **RAG_COMPLETION** | Document-grounded answers: "What does ATO ruling TR 2024/3 say about..." | gst_calculator, compliance_monitoring | **P0** |
| **CHUNKS** | Fast transaction similarity: "Find transactions similar to this one" | transaction_categorizer, payment_matching | **P0** |
| **CHUNKS_LEXICAL** | Exact keyword matching: merchant name lookup, ABN search | merchant_intelligence, accounts_payable | **P0** |
| **SUMMARIES** | Period-level overviews: "Summarize my Q3 spending" | financial_reporting, budgeting | **P1** |
| **GRAPH_SUMMARY_COMPLETION** | Condensed graph answers for dashboard widgets | chat endpoint, market_intelligence | **P1** |
| **NATURAL_LANGUAGE** | Ad-hoc graph queries from chat: "Show me all merchants in the 'Office Supplies' category" | chat endpoint (power users) | **P1** |
| **CYPHER** | Direct graph queries for admin/debug: custom Cypher from admin UI | cognee-admin | **P1** |
| **CODE** | Codebase knowledge (our own code indexed for dev assistance) | MCP server for developer queries | **P1** |
| **FEELING_LUCKY** | Auto-select best search mode when query type is ambiguous | chat endpoint fallback | **P1** |
| **FEEDBACK** | Store user feedback on search quality for future tuning | All agents via feedback loop | **P0** |
| **CODING_RULES** | Retrieved from memify enrichment — financial domain rules | gst_calculator, tax_strategy | **P1** |

### 8.2 Smart Type Selection Logic

Enhance `cognee-tools.ts` with intelligent search type selection:

```typescript
export function selectSearchType(query: string, context: QueryContext): CogneeSearchType {
  // Tax/GST questions -> chain-of-thought for accuracy
  if (/\b(can i claim|deduct|gst|bas|tax|ato)\b/i.test(query)) {
    return 'GRAPH_COMPLETION_COT';
  }
  // Merchant lookups -> lexical search
  if (/\b(merchant|vendor|supplier|abn)\b/i.test(query)) {
    return 'CHUNKS_LEXICAL';
  }
  // Document/ruling references -> RAG
  if (/\b(ruling|regulation|section|division)\b/i.test(query)) {
    return 'RAG_COMPLETION';
  }
  // Period summaries -> summaries
  if (/\b(summary|overview|report|quarter|period)\b/i.test(query)) {
    return 'SUMMARIES';
  }
  // Similarity search -> chunks
  if (/\b(similar|like|transactions like)\b/i.test(query)) {
    return 'CHUNKS';
  }
  // Exploration queries -> context extension
  if (/\b(everything|all|related|connected|show me)\b/i.test(query)) {
    return 'GRAPH_COMPLETION_CONTEXT_EXTENSION';
  }
  // Default -> graph completion for reasoning
  return 'GRAPH_COMPLETION';
}
```

---

## 9. Feature 7: Sessions with Redis

### 9.1 Current Gap

`CogneeSessionService` exists and works. Redis is configured. But `/api/chat` ignores sessions entirely. Each message is stateless.

### 9.2 Session Integration Architecture

```
User sends message -> /api/chat
    |
    +-- 1. getOrCreateSession(userId, { type: 'chat' })
    |       -> Returns sessionId (UUID) + conversation history
    |
    +-- 2. addConversationTurn(sessionId, 'user', message)
    |       -> Records user message in Redis (key: agent_sessions:{userId}:{sessionId})
    |
    +-- 3. checkCache(queryHash)
    |       -> Cache hit? Return cached response (TTL: 5 min)
    |
    +-- 4. searchWithSession(query, dataset, sessionId)
    |       -> Cognee uses session_id for conversational memory
    |       -> Previous turns influence retrieval ranking
    |       -> "What about Q3?" resolves to "BAS Q3" from context
    |
    +-- 5. routeAndDispatch(query, sessionContext)
    |       -> Intent router selects agent
    |       -> Agent executes with Cognee tools + session
    |
    +-- 6. cacheResult(queryHash, result)
    |       -> Store in Redis (TTL: 5 min)
    |
    +-- 7. addConversationTurn(sessionId, 'assistant', response)
            -> Records assistant response for future context
```

### 9.3 Implementation

Modify `server/src/routes/chat-core.ts`:

```typescript
import { CogneeSessionService } from '../services/cognee-sessions/service.js';

app.post('/api/chat', async (c) => {
  const { message, sessionId: clientSessionId, userId } = await c.req.json();

  // 1. Get or create session
  const sessionService = new CogneeSessionService();
  const session = clientSessionId
    ? await sessionService.getSession(clientSessionId)
    : await sessionService.createSession(userId ?? 'default', { type: 'chat' });
  const sessionId = session?.id ?? crypto.randomUUID();

  // 2. Record user turn
  await sessionService.addConversationTurn(sessionId, 'user', message);

  // 3. Search with session context (Cognee uses session_id)
  const searchResults = await cogneeClient.search(
    message,
    'bank_transactions',
    5,
    selectSearchType(message, {}),
    userId,
    sessionId,  // <-- Pass session_id to Cognee
  );

  // 4. Route to agent via intent router
  // ... agent dispatch logic ...

  // 5. Record assistant turn
  await sessionService.addConversationTurn(sessionId, 'assistant', response.answer);

  // 6. Return response with sessionId for client persistence
  return c.json({ answer: response.answer, sessionId });
});
```

### 9.4 Client Changes

`FloatingChat.tsx` stores `sessionId` in state:

```typescript
const [sessionId, setSessionId] = useState<string | null>(null);

const sendMessage = async (text: string) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: text, sessionId, userId }),
  });
  const data = await response.json();
  if (data.sessionId) setSessionId(data.sessionId);
  // ... render response
};
```

### 9.5 Session Lifecycle

| Setting | Value | Rationale |
|---------|-------|-----------|
| TTL | 30 minutes inactivity | Financial conversations are session-bounded |
| Max turns | 100 per session | Prevent unbounded memory growth |
| Context window | Last 10 turns | Balance context vs. noise |
| Cache TTL | 5 minutes | Avoid redundant Cognee calls |
| Storage backend | Redis | Already configured in docker-compose |
| Session key format | `agent_sessions:{userId}:{sessionId}` | Cognee-native format |

---

## 10. Feature 8: Multi-Tenant RBAC

### 10.1 Strategy: Phased Enablement

**Phase 1: Enable Authentication** (Low risk)
```yaml
REQUIRE_AUTHENTICATION: "true"
ENABLE_BACKEND_ACCESS_CONTROL: "false"
```
All requests require Bearer token. Our `cognee/auth.ts` handles this. Test: `isHealthy()` still passes.

**Phase 2: Data Migration** (Before enabling access control)
Run migration script to grant permissions BEFORE flipping the access control flag.

**Phase 3: Enable Full Isolation** (High value)
```yaml
REQUIRE_AUTHENTICATION: "true"
ENABLE_BACKEND_ACCESS_CONTROL: "true"
```

### 10.2 Permission Model

| Principal Type | Datasets | Permissions |
|----------------|----------|-------------|
| **Tenant** | All tenant-prefixed datasets | read, write |
| **Owner role** | All datasets | read, write, delete, share |
| **Admin role** | All datasets | read, write, share |
| **Accountant role** | Financial datasets (BAS, tax, reports) | read, write |
| **Bookkeeper role** | Transaction datasets | read, write |
| **Viewer role** | All datasets | read |
| **Shared datasets** | gst_rules, ato_rulings, etc. | read (all users) |

### 10.3 Data Migration Script

```typescript
// server/src/services/cognee/migration-auth.ts
export async function migrateToFullRBAC(
  appUsers: Array<{ id: string; email: string; tenantId?: string; role: string }>,
): Promise<MigrationResult> {
  const errors: string[] = [];

  // Step 1: Create Cognee accounts for all app users
  for (const user of appUsers) {
    await cogneeClient.setupUserAuth(user.id);
  }

  // Step 2: Create tenants in Cognee
  const tenantIds = [...new Set(appUsers.map(u => u.tenantId).filter(Boolean))];
  for (const tenantId of tenantIds) {
    const owner = appUsers.find(u => u.tenantId === tenantId && u.role === 'owner');
    if (owner) {
      await cogneeClient.createTenant(tenantId, owner.id);
      // Add all tenant members
      for (const member of appUsers.filter(u => u.tenantId === tenantId)) {
        await cogneeClient.addUserToTenant(member.id, tenantId, owner.id);
      }
    }
  }

  // Step 3: Create roles per tenant
  for (const tenantId of tenantIds) {
    const owner = appUsers.find(u => u.tenantId === tenantId && u.role === 'owner');
    if (owner) {
      for (const roleName of ['admin', 'accountant', 'bookkeeper', 'viewer']) {
        const role = await cogneeClient.createRole(roleName, owner.id);
        // Assign users to roles
        for (const user of appUsers.filter(u => u.tenantId === tenantId && u.role === roleName)) {
          await cogneeClient.addUserToRole(user.id, role.id, owner.id);
        }
      }
    }
  }

  // Step 4: Grant shared dataset read to all tenants
  const allDatasets = await cogneeClient.listDatasets();
  for (const shared of SHARED_DATASETS) {
    const dataset = allDatasets.find(d => d.name === shared);
    if (dataset) {
      for (const tenantId of tenantIds) {
        await cogneeClient.grantPermission(tenantId, dataset.id, 'read');
      }
    }
  }

  // Step 5: Grant tenant-specific datasets
  for (const tenantId of tenantIds) {
    for (const [key, name] of Object.entries(COGNEE_DATASETS)) {
      if (SHARED_DATASETS.has(name)) continue;
      const prefixed = `tenant_${tenantId}_${name}`;
      const dataset = allDatasets.find(d => d.name === prefixed);
      if (dataset) {
        await cogneeClient.grantPermission(tenantId, dataset.id, 'read');
        await cogneeClient.grantPermission(tenantId, dataset.id, 'write');
      }
    }
  }

  // Step 6: Verification
  for (const user of appUsers) {
    const results = await cogneeClient.search('test', 'bank_transactions', 1, 'CHUNKS', user.id);
    if (results.length === 0) {
      errors.push(`VERIFICATION FAILED: ${user.email} gets empty results`);
    }
  }

  return { success: errors.length === 0, errors };
}
```

### 10.4 Enforcement at Client Level

Modify `cognee/data-ops.ts` to enforce shared dataset rules:

```typescript
export async function addData(state, data, dataset, userId?, tenantId?) {
  // Enforce: shared datasets NEVER get tenant-prefixed
  if (SHARED_DATASETS.has(dataset) && tenantId) {
    logger.warn(`Attempted to prefix shared dataset '${dataset}' — stripping tenantId`);
    tenantId = undefined;
  }
  // Enforce: per-tenant datasets ALWAYS get prefixed
  if (!SHARED_DATASETS.has(dataset) && !ROW_FILTERED_DATASETS.has(dataset) && !tenantId) {
    logger.warn(`Per-tenant dataset '${dataset}' accessed without tenantId`);
  }
  // ... rest of function
}
```

---

## 11. Feature 9: MCP Server

### 11.1 Architecture: API Mode

The Cognee MCP server runs in **API mode**, connecting to the centralized Cognee backend (not standalone). This means all MCP instances share the same knowledge graph.

```
Claude Code / Agent SDK
    |
    v
Cognee MCP Server (sidecar in server container)
    | (stdio or HTTP transport)
    v
Cognee REST API (port 8000)
    |
    v
Kuzu Graph + pgvector + Redis
```

### 11.2 MCP Tools for GoldLedger

| Tool | Description | Maps To |
|------|-------------|---------|
| `cognify` | Build knowledge graph from financial data | `/api/v1/cognify` |
| `search` | Search knowledge graph with any search type | `/api/v1/search` |
| `cognee_add_developer_rules` | Ingest ATO rules and financial guidelines | `/api/v1/add` |
| `codify` | Index GoldLedger source code for dev assistance | `/api/v1/cognify` (CODE pipeline) |
| `save_interaction` | Store agent interactions for learning | `/api/v1/feedback` |
| `get_developer_rules` | Retrieve coding rules from memify | `/api/v1/search?type=CODING_RULES` |
| `list_data` | List all datasets and items | `/api/v1/datasets` |
| `delete` | Remove specific data items | `/api/v1/datasets/{id}` DELETE |
| `prune` | Clear all memory for fresh start | Prune endpoint |
| `cognify_status` | Track pipeline status | `/api/v1/datasets/{id}/status` |
| `search_transactions` | Search bank transactions (GoldLedger-specific) | `/api/v1/search` with dataset=bank_transactions |

### 11.3 Deployment

```yaml
# docker-compose.yml addition
cognee-mcp:
  build:
    context: ./cognee-repo/cognee-mcp
  environment:
    - API_URL=http://cognee:8000
    - API_TOKEN=${COGNEE_ADMIN_TOKEN}
    - TRANSPORT=http
  ports:
    - "8001:8000"
  depends_on:
    cognee:
      condition: service_healthy
```

Or as a sidecar process in the server container:

```dockerfile
# server/Dockerfile addition
RUN pip install cognee-mcp
CMD ["sh", "-c", "python /app/cognee-mcp/server.py --transport http --api-url http://cognee:8000 &; node dist/index.js"]
```

### 11.4 Claude Code Integration

Add to the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "goldledger-cognee": {
      "command": "python",
      "args": ["cognee-repo/cognee-mcp/src/server.py"],
      "env": {
        "API_URL": "http://localhost:8000",
        "LLM_API_KEY": "${OPENROUTER_API_KEY}"
      }
    }
  }
}
```

---

## 12. Feature 10: Agent-Cognee Wiring Matrix

### 12.1 Complete Agent-Cognee Integration Table

| # | Agent | Model | Datasets (Read) | Datasets (Write) | Search Types | Session | Feedback | From Chat |
|---|-------|-------|-----------------|-------------------|-------------|---------|----------|-----------|
| 1 | statement_parser | Sonnet | bank_formats | bank_transactions, bank_formats | CHUNKS | No | No | Yes |
| 2 | transaction_categorizer | Sonnet | bank_transactions, merchant_mappings, deduction_patterns | bank_transactions, merchant_mappings | CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION | Yes | Yes | Yes |
| 3 | gst_calculator | Sonnet | gst_rules, ato_rulings, bank_transactions | bank_transactions | GRAPH_COMPLETION_COT, RAG_COMPLETION | Yes | Yes | Yes |
| 4 | merchant_intelligence | Sonnet | merchant_data, merchant_mappings, merchant_corrections | merchant_data, merchant_mappings | CHUNKS_LEXICAL, GRAPH_COMPLETION_CONTEXT_EXTENSION | Yes | Yes | Yes |
| 5 | budget_analyzer | Sonnet | budget_templates, financial_reports, kpi_history | budget_templates | GRAPH_COMPLETION, SUMMARIES | Yes | No | Yes |
| 6 | account_reconciler | Sonnet | bank_transactions, recon_patterns | recon_patterns | CHUNKS, GRAPH_COMPLETION | Yes | No | Yes |
| 7 | cross_account_tracer | Sonnet | transfer_patterns, bank_transactions | transfer_patterns | GRAPH_COMPLETION_CONTEXT_EXTENSION, CHUNKS | Yes | No | Yes |
| 8 | tax_strategy | Sonnet | ato_rulings, deduction_patterns, tax_tables | deduction_patterns | GRAPH_COMPLETION_COT, RAG_COMPLETION | Yes | Yes | Yes |
| 9 | personal_tax_claims | Sonnet | deduction_patterns, ato_rulings | deduction_patterns | GRAPH_COMPLETION_COT, RAG_COMPLETION | Yes | Yes | Yes |
| 10 | financial_planner | Sonnet | forecast_patterns, kpi_history, budget_templates | forecast_patterns | GRAPH_COMPLETION, SUMMARIES | Yes | No | Yes |
| 11 | payroll_agent | Sonnet | employee_profiles, pay_structures, award_rates, stp_compliance | employee_profiles, pay_structures | CHUNKS_LEXICAL, RAG_COMPLETION | Yes | No | Yes |
| 12 | financial_reporting | Sonnet | financial_reports, kpi_history, budget_templates | financial_reports, kpi_history | SUMMARIES, GRAPH_SUMMARY_COMPLETION | Yes | No | Yes |
| 13 | budgeting | Sonnet | budget_templates, financial_reports | budget_templates | GRAPH_COMPLETION, SUMMARIES | Yes | No | Yes |
| 14 | ocr_processing | Sonnet | ocr_extractions | ocr_extractions | CHUNKS | No | No | Yes |
| 15 | payment_matching | Haiku | matching_patterns, bank_transactions | matching_patterns | CHUNKS, CHUNKS_LEXICAL | No | Yes | Yes |
| 16 | cdr_product | Sonnet | cdr_products, cdr_rates, banking_product_knowledge | cdr_products | GRAPH_COMPLETION, CHUNKS_LEXICAL | Yes | No | Yes |
| 17 | tenant_routing | Haiku | cross_module_insights | — | GRAPH_COMPLETION | No | No | No (internal) |
| 18 | forecasting_agent | Sonnet | forecast_patterns, temporal_patterns, anomaly_history | forecast_patterns | GRAPH_COMPLETION, CHUNKS | Yes | No | Yes |
| 19 | compliance_monitoring | Sonnet | compliance_rulings, ato_rulings | compliance_rulings | RAG_COMPLETION, GRAPH_COMPLETION_COT | Yes | Yes | Yes |
| 20 | market_intelligence | Sonnet | market_intelligence, market_sentiment, rba_statistics, abs_statistics, asx_market_data | market_intelligence, market_sentiment | GRAPH_COMPLETION, CHUNKS | Yes | No | Yes |
| 21 | inventory_agent | Sonnet | inventory_catalog | inventory_catalog | CHUNKS_LEXICAL | No | No | Yes |
| 22 | invoice_agent | Sonnet | customer_profiles, invoice_history | customer_profiles, invoice_history | CHUNKS_LEXICAL, CHUNKS | No | No | Yes |
| 23 | accounts_payable | Sonnet | supplier_profiles, bill_patterns | supplier_profiles, bill_patterns | CHUNKS_LEXICAL, CHUNKS | No | No | Yes |
| 24 | bank_reconciler | Sonnet | recon_patterns, bank_transactions | recon_patterns | CHUNKS, GRAPH_COMPLETION | Yes | No | Yes |
| 25 | asset_management | Sonnet | — | — | — | No | No | Yes |
| 26 | multi_entity | Sonnet | cross_module_insights, module_relationships | cross_module_insights | GRAPH_COMPLETION_CONTEXT_EXTENSION | Yes | No | Yes |

### 12.2 Intent Router -> Agent Dispatch

```typescript
// Enhanced intent-router.ts
const INTENT_TO_AGENT: Record<string, string> = {
  categorize: 'transaction_categorizer',
  gst: 'gst_calculator',
  tax: 'tax_strategy',
  deduction: 'personal_tax_claims',
  forecast: 'forecasting_agent',
  compliance: 'compliance_monitoring',
  reconcile: 'account_reconciler',
  transfer: 'cross_account_tracer',
  merchant: 'merchant_intelligence',
  payroll: 'payroll_agent',
  invoice: 'invoice_agent',
  report: 'financial_reporting',
  budget: 'budgeting',
  loan: 'cdr_product',
  market: 'market_intelligence',
  inventory: 'inventory_agent',
  bill: 'accounts_payable',
  asset: 'asset_management',
  entity: 'multi_entity',
  question: 'GRAPH_COMPLETION',  // Default: search-only
  edit: 'mutation_tools',
};
```

### 12.3 Agent Response -> Cognee Feedback Loop

After every agent response, store the interaction back in Cognee:

```typescript
// After agent completes
await cogneeTools.submitSearchFeedback({
  query: originalMessage,
  agent: agentName,
  response: agentResponse,
  searchResults: retrievedContext,
  userRating: null,  // Set later via UI
});
```

---

## 13. Implementation Timeline

### Week-by-Week Plan (8 weeks)

| Week | Features | Deliverables | Verification |
|------|----------|-------------|--------------|
| **1** | F1 (DataPoints), F2 (Ontology) | Python DataPoint models mounted in container. OWL file created. | `cognify` uses custom models for extraction. `ontology_file_path` accepted. |
| **2** | F5 (NodeSets), F6 (Search Types) | NodeSet tagging in data ingestion. All 14 search types mapped. Smart type selection. | Transactions ingested with NodeSet tags visible in graph. Search type selection returns different results per type. |
| **3** | F7 (Sessions), F10 (Agent Wiring - Phase 1) | Sessions wired to chat. Intent router classifies to 10+ agents. | Multi-turn chat works ("What about Q3?" resolves). 10 agents accessible from chat. |
| **4** | F10 (Agent Wiring - Phase 2), F4 (Memify) | All 26 agents accessible from chat. Memify enrichment rules deployed. | All agents routable. Memify produces derived PatternNodes, BASPeriodNodes. |
| **5** | F8 (RBAC - Phase 1) | Auth enabled (`REQUIRE_AUTHENTICATION=true`). Migration script tested. | All API calls require Bearer token. `isHealthy()` passes. |
| **6** | F8 (RBAC - Phase 2), F3 (Pipelines) | Full isolation enabled. Custom pipeline tasks mounted. | User A cannot see User B data. Custom tasks run during cognify. |
| **7** | F9 (MCP Server) | MCP server deployed as sidecar. 11 tools exposed. | Claude Code can use Cognee MCP tools. Agent SDK can access knowledge graph. |
| **8** | Integration Testing, Documentation | End-to-end tests across all features. Updated docs. | All 10 features verified. Docker healthy. Performance benchmarks. |

### Parallel Execution

```
Week 1-2: DataPoints + Ontology + NodeSets + Search Types  (Container config + TS client)
Week 3-4: Sessions + Agent Wiring + Memify                (TS routes + agent code)
Week 5-6: RBAC + Custom Pipelines                         (Docker config + Python tasks)
Week 7-8: MCP Server + Integration Testing                (Deployment + verification)
```

---

## 14. File Inventory

### Files to CREATE

| File | Purpose | Week |
|------|---------|------|
| `server/cognee-models/goldledger_datapoints.py` | 10 Python Pydantic DataPoint classes | 1 |
| `server/cognee-models/__init__.py` | Package init | 1 |
| `server/cognee-models/ontologies/australian-finance.owl` | RDF/OWL ontology for AU finance | 1 |
| `server/cognee-models/tasks/__init__.py` | Custom task package | 6 |
| `server/cognee-models/tasks/financial_entity_extraction.py` | Financial entity extraction task | 6 |
| `server/cognee-models/tasks/gst_classification.py` | GST classification task | 6 |
| `server/cognee-models/tasks/transfer_detection.py` | Transfer detection task | 6 |
| `server/cognee-models/tasks/temporal_patterns.py` | Temporal pattern extraction task | 6 |
| `server/cognee-models/tasks/tax_deduction.py` | Tax deduction classification task | 6 |
| `server/cognee-models/tasks/memify_enrichment.py` | 5 memify enrichment rules | 4 |
| `server/cognee-models/pipelines/goldledger_pipeline.py` | Custom cognify pipeline | 6 |
| `server/src/services/cognee/nodeset-utils.ts` | NodeSet tag generation utilities | 2 |
| `server/src/services/cognee/search-type-selector.ts` | Smart search type selection | 2 |
| `server/src/services/cognee/migration-rbac.ts` | RBAC migration script | 5 |
| `server/src/services/cognee/ontology-registration.ts` | Ontology file management | 1 |
| `.mcp.json` | MCP server configuration for Claude Code | 7 |

### Files to MODIFY

| File | Changes | Week |
|------|---------|------|
| `docker-compose.yml` | Mount custom_models volume, enable auth flags, add cognee-mcp service | 1, 5, 7 |
| `server/src/services/cognee/cognify.ts` | Add `cognifyWithOntology()`, enhanced temporal cognify | 1 |
| `server/src/services/cognee/data-ops.ts` | Add `addDataWithNodeSets()`, NodeSet tagging, shared dataset enforcement | 2 |
| `server/src/services/cognee/search.ts` | Add `searchWithNodeSets()`, session_id passthrough | 2 |
| `server/src/services/cognee/types.ts` | Enhanced MAXIMALIST_COGNIFY_PROMPT | 1 |
| `server/src/services/claude/cognee-tools.ts` | Smart search type selection, NodeSet-scoped search, enhanced feedback | 2 |
| `server/src/services/claude/cognee-tools-constants.ts` | NodeSet constants, search type mappings | 2 |
| `server/src/services/claude/intent-router.ts` | Full 26-agent intent classification | 3 |
| `server/src/services/claude/orchestrator.ts` | `routeAndDispatch()` wiring all agents to chat | 3 |
| `server/src/routes/chat-core.ts` | Session creation, agent dispatch, feedback recording | 3 |
| `client/src/features/chat/components/FloatingChat.tsx` | sessionId state, pass to API | 3 |
| `server/src/services/cognee/tenant.ts` | `initializeTenantDatasets()` with RBAC permissions | 5 |
| `server/src/services/cognee/auth.ts` | Tenant/role-aware auth token management | 5 |
| `server/src/services/cognee-feedback/memify.ts` | Wire custom memify enrichment tasks | 4 |
| All 26 agent files | Add session handling, feedback integration, search type selection | 3-4 |

### Files to DEPRECATE

| File | Reason |
|------|--------|
| None | No files are deprecated. All existing code is enhanced, not replaced. |

---

## 15. Docker Changes

### 15.1 Updated docker-compose.yml (Cognee service)

```yaml
cognee:
  build:
    context: ./cognee-repo
  environment:
    - REQUIRE_AUTHENTICATION=true                   # CHANGED from false
    - ENABLE_BACKEND_ACCESS_CONTROL=true            # CHANGED from false
    - CACHING=true
    - CACHE_BACKEND=redis
    - CACHE_HOST=redis
    - CACHE_PORT=6379
    - LLM_PROVIDER=custom
    - LLM_MODEL=openrouter/google/gemini-3-flash-preview
    - EMBEDDING_PROVIDER=openai
    - EMBEDDING_MODEL=text-embedding-3-small
    - EMBEDDING_DIMENSIONS=1536
    - GRAPH_DATABASE_PROVIDER=kuzu
    - VECTOR_DB_PROVIDER=pgvector
    - DB_NAME=cognee_db
  volumes:
    - ./server/cognee-models:/app/custom_models:ro   # NEW: DataPoints + Ontology + Tasks
    - cognee-data:/app/data
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/settings"]
    interval: 30s
    timeout: 10s
    retries: 3

cognee-mcp:                                          # NEW SERVICE
  build:
    context: ./cognee-repo/cognee-mcp
  environment:
    - API_URL=http://cognee:8000
    - TRANSPORT=http
  ports:
    - "8001:8000"
  depends_on:
    cognee:
      condition: service_healthy
```

### 15.2 Enhanced MAXIMALIST_COGNIFY_PROMPT

```typescript
export const MAXIMALIST_COGNIFY_PROMPT =
  'You are analyzing Australian financial documents. Extract ALL of the following entities:\n\n' +
  'TRANSACTIONS: merchant name (canonical form), amount (in cents), date (ISO 8601), ' +
  'category, GST status (standard 10%, GST-free, input-taxed, export), ' +
  'debit/credit indicator, account reference.\n\n' +
  'MERCHANTS: canonical name, ABN (if visible), industry, GST registration status.\n\n' +
  'ACCOUNTS: account number (masked), BSB, bank name, account type.\n\n' +
  'GST RULES: rule type, rate, ATO reference number, applicable categories.\n\n' +
  'TAX DEDUCTIONS: D1-D15 ATO category, deduction type, substantiation method.\n\n' +
  'TEMPORAL PATTERNS: recurring frequencies (weekly, fortnightly, monthly, quarterly, annual), ' +
  'seasonal patterns, payment cycle dates.\n\n' +
  'BAS PERIODS: Quarter assignment (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun), ' +
  'financial year (Australian: Jul 1 - Jun 30).\n\n' +
  'RELATIONSHIPS: Transaction->Merchant (paid_to), Transaction->Account (belongs_to), ' +
  'Transaction->Category (categorized_as), Merchant->Category (operates_in), ' +
  'Transaction->BASPeriod (in_period), Pattern->Account (observed_in).\n\n' +
  'Create edges between ALL related entities. Preserve monetary amounts in cents.';
```

---

## Appendix A: Cognee REST API Endpoints Used

| Endpoint | Method | Client Function | Purpose |
|----------|--------|-----------------|---------|
| `/api/v1/auth/login` | POST | `login()` | Admin + user auth |
| `/api/v1/auth/refresh` | POST | `refreshToken()` | Token refresh |
| `/api/v1/add` | POST | `addData()`, `addDataWithNodeSets()` | Data ingestion (multipart + node_set) |
| `/api/v1/cognify` | POST | `cognify()`, `cognifyWithOntology()` | Build knowledge graph (with ontology) |
| `/api/v1/search` | POST | `search()`, `searchWithNodeSets()` | Query knowledge graph (all 14 types) |
| `/api/v1/datasets` | GET | `listDatasets()` | List datasets |
| `/api/v1/datasets/{id}/graph` | GET | `getDatasetGraph()` | Get dataset graph |
| `/api/v1/datasets/{id}/status` | GET | `getDatasetStatus()` | Get processing status |
| `/api/v1/feedback` | POST | `submitFeedback()` | Entity feedback |
| `/api/v1/memify` | POST | `triggerMemify()` | Memory consolidation |
| `/api/v1/settings` | GET | `isHealthy()` | Health check |
| `/api/v1/users` | POST | `createUser()` | Create user accounts |
| `/api/v1/tenants` | POST | `createTenant()` | Create tenants |
| `/api/v1/tenants/{id}/users` | POST | `addUserToTenant()` | Add user to tenant |
| `/api/v1/roles` | POST | `createRole()` | Create roles |
| `/api/v1/roles/{id}/users` | POST | `addUserToRole()` | Add user to role |
| `/api/v1/permissions/{principal_id}` | POST | `grantPermission()` | Grant dataset permissions |
| `/api/v1/ontology` | POST | `applyOntology()` | Register ontology |

---

## Appendix B: Enhanced FINANCIAL_COGNIFY_PROMPT vs MAXIMALIST

| Aspect | Current (FINANCIAL_COGNIFY_PROMPT) | Maximalist (MAXIMALIST_COGNIFY_PROMPT) |
|--------|-----------------------------------|---------------------------------------|
| Entity types | 8 (merchant, category, ABN, GST, payment method, account ref, patterns, relationships) | 15+ (transactions, merchants, accounts, GST rules, deductions D1-D15, temporal patterns, BAS periods, relationships) |
| GST detail | "GST registration status" | "standard 10%, GST-free, input-taxed, export" with ATO reference |
| Temporal | "temporal patterns" | "weekly, fortnightly, monthly, quarterly, annual" + "Q1=Jul-Sep, Q2=Oct-Dec" + "Australian FY: Jul 1 - Jun 30" |
| Tax | None | D1-D15 ATO deduction categories with substantiation |
| Relationships | "financial relationships" | 6 explicit typed edges with source/target |
| Amounts | None | "Preserve monetary amounts in cents" |

---

## Appendix C: Search Type Decision Matrix

```
Query                                           -> Search Type
"Find similar transactions to this one"         -> CHUNKS
"What merchant is 'WOOLWRTHS' referring to?"    -> CHUNKS_LEXICAL
"Why is my spending on utilities increasing?"   -> GRAPH_COMPLETION
"Can I claim home office AND car expenses?"     -> GRAPH_COMPLETION_COT
"Show me everything related to AGL Energy"      -> GRAPH_COMPLETION_CONTEXT_EXTENSION
"What does TR 2024/3 say about WFH?"            -> RAG_COMPLETION
"Summarize my Q3 spending"                       -> SUMMARIES
"Give me a quick overview of last month"         -> GRAPH_SUMMARY_COMPLETION
"All merchants in 'Office Supplies' category"    -> NATURAL_LANGUAGE
"MATCH (m:Merchant)-[:OPERATES_IN]->(c:Cat)"    -> CYPHER
"How does the invoice router work?"              -> CODE
"Help me with my finances"                       -> FEELING_LUCKY
"That answer was helpful/unhelpful"              -> FEEDBACK
"What are the key financial rules?"              -> CODING_RULES
```
