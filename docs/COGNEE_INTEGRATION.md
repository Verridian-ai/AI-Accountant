# Cognee AI Integration Plan

## CBA Statements Parse — Knowledge Graph Memory Layer

---

## Table of Contents

1. [Cognee Capabilities Overview](#1-cognee-capabilities-overview)
2. [Current State Assessment](#2-current-state-assessment)
3. [Knowledge Graph Schema](#3-knowledge-graph-schema)
4. [Docker Compose Setup](#4-docker-compose-setup)
5. [Integration Layer API Design](#5-integration-layer-api-design)
6. [Per-Agent Dataset Specifications](#6-per-agent-dataset-specifications)
7. [Data Flow Architecture](#7-data-flow-architecture)
8. [Migration Plan: Current RAG → Cognee](#8-migration-plan-current-rag--cognee)
9. [Neon DB Configuration](#9-neon-db-configuration)
10. [Performance Considerations](#10-performance-considerations)
11. [Environment Variables Reference](#11-environment-variables-reference)

---

## 1. Cognee Capabilities Overview

### What Is Cognee?

Cognee is an open-source AI memory platform that transforms raw data into persistent, dynamic knowledge graphs for AI agents. It replaces traditional RAG (Retrieval-Augmented Generation) with an **ECL (Extract, Cognify, Load)** pipeline that combines:

- **Vector search** — semantic similarity over embedded documents
- **Graph databases** — entity-relationship traversal for structured reasoning
- **Relational storage** — metadata, pipeline state, and access control

### Core API (3 Methods)

```python
import cognee

await cognee.add(data, dataset_name)   # Ingest data
await cognee.cognify()                  # Build knowledge graph (chunk → extract entities → relationships → summarize → embed)
await cognee.search(query_text, query_type)  # Query the graph
```

### Cognify Pipeline Stages

1. **Document Classification** — Raw data → typed Document objects
2. **Permission Verification** — RBAC check on target dataset
3. **Chunking** — Documents split into DocumentChunks with token counts
4. **Graph Extraction** — LLM extracts entities + relationships, deduplicates, commits to graph DB
5. **Text Summarization** — Generates TextSummary DataPoints per chunk
6. **Vector Indexing** — Embeds summaries + DataPoints into vector store

### Search Types (SearchType Enum)

| Search Type | Description | Use Case |
|---|---|---|
| `CHUNKS` | Returns relevant text passages | Finding specific transaction descriptions |
| `INSIGHTS` | Returns entity relationships (`src → [rel] → tgt`) | Understanding category patterns |
| `GRAPH_COMPLETION` | LLM generates answer from knowledge graph | "What GST category applies to..." |
| `RAG_COMPLETION` | LLM generates answer using graph relationships | Contextual transaction analysis |
| `SUMMARIES` | Returns pre-generated summaries | Period-level account overviews |
| `GRAPH_SUMMARY_COMPLETION` | Combines graph + summary context | Comprehensive queries |
| `NATURAL_LANGUAGE` | Cypher-like queries in plain English | Ad-hoc graph queries |

### Storage Backends

| Component | Options | Our Choice |
|---|---|---|
| **Relational DB** | SQLite, PostgreSQL | PostgreSQL (Neon DB) |
| **Vector Store** | LanceDB, PGVector, Qdrant, Redis, ChromaDB, FalkorDB | **PGVector** (single DB) |
| **Graph Store** | Kuzu (default), Neo4j, Neptune | **Kuzu** (embedded, no extra service) |
| **Embeddings** | OpenAI, Fastembed, Ollama, Gemini | **Fastembed** (local, free) |
| **LLM** | OpenAI, Anthropic, Ollama, OpenRouter | **OpenRouter** (existing setup) |

### Permissions & Multi-Tenancy

```python
from cognee.modules.data.methods import create_authorized_dataset
from cognee.modules.users.permissions.methods import give_permission_on_dataset

# Create isolated dataset owned by a specific agent
dataset = await create_authorized_dataset("gst_rules", agent_user)

# Grant read access to another agent
await give_permission_on_dataset(categorizer_user, dataset.id, "read")
```

### Custom Data Models (DataPoint)

Cognee uses Pydantic models inheriting from `DataPoint` to define graph schemas:

```python
from cognee.infrastructure.engine import DataPoint
from typing import Any
from pydantic import SkipValidation

class TransactionNode(DataPoint):
    description: str
    amount_cents: int
    category: str
    date: str
    gst_applicable: bool
    belongs_to: SkipValidation[Any] = None  # Edge → AccountNode
    categorized_as: SkipValidation[Any] = None  # Edge → CategoryNode
    metadata: dict = {"index_fields": ["description", "category"]}
```

---

## 2. Current State Assessment

### Existing RAG Implementation

**`server/src/services/rag.ts`** — TypeScript wrapper that spawns Python subprocess:
- `indexTransactions(transactions)` — formats and calls `cognee.add()`
- `addDocuments(documents, datasetName)` — generic document ingestion
- `search(query, model)` — semantic search via `cognee.search()`

**`server/src/services/rag.py`** — Python Cognee client:
- Uses OpenRouter as LLM provider (`openrouter/openai/gpt-4o`)
- Uses Fastembed for local embeddings (`BAAI/bge-small-en-v1.5`, 384 dimensions)
- Default dataset: `bank_statements`
- Supports: `add`, `search`, `prune` commands
- **Limitation**: Single flat dataset, no graph structure, no per-agent isolation

### Existing Agent Files

| File | Purpose |
|---|---|
| `server/src/services/agents/gst_rules.py` | GST categorization rules, BAS calculator, pattern matching |
| `server/src/services/agents/tax_config.py` | Australian tax brackets, Medicare levy, deduction rates |
| `server/src/services/agents/cgt_calculator.py` | Capital gains tax calculations |
| `server/src/services/agents/depreciation_calculator.py` | Asset depreciation schedules |

### Current Docker Setup

```yaml
# docker-compose.yml (current)
services:
  server:
    volumes:
      - ./server/.cognee:/app/.cognee  # Cognee local storage already mounted
  client:
    depends_on: [server]
```

### Existing Database

- **SQLite** (`server/sqlite.db`) via Drizzle ORM with `@libsql/client`
- Tables: `statements` (id, filename, hash, parsingStatus) and `transactions` (id, date, description, amount, balance, category, gstApplicable, aiReasoningNotes, confidenceScore, statementId)
- **PostgreSQL** credentials exist in `server/.env.postgres` for Neon migration

---

## 3. Knowledge Graph Schema

### Entity-Relationship Diagram

```mermaid
graph TB
    subgraph "Core Entities"
        ACCT[AccountNode<br/>bank, bsb, number, name]
        STMT[StatementNode<br/>filename, period_start, period_end, hash]
        TX[TransactionNode<br/>date, description, amount, balance<br/>gst_applicable, confidence_score]
    end

    subgraph "Classification Entities"
        CAT[CategoryNode<br/>name, type: income|expense|system<br/>gst_default, color]
        GST[GSTRuleNode<br/>category: taxable_10|gst_free|input_taxed<br/>rate, bas_label, claimable]
        PAT[PatternNode<br/>regex, description_pattern<br/>frequency, avg_amount, last_seen]
    end

    subgraph "Tax Entities"
        BAS[BASPeriodNode<br/>quarter, fy_year<br/>g1, g2, g3, g10, g11<br/>label_1a, label_1b]
        DEDUCT[DeductionNode<br/>type, method, amount<br/>tax_year]
    end

    subgraph "Cross-Account"
        XFER[TransferNode<br/>from_account, to_account<br/>amount, date, matched]
    end

    %% Core relationships
    STMT -->|"from_account"| ACCT
    TX -->|"in_statement"| STMT
    TX -->|"belongs_to"| ACCT
    TX -->|"categorized_as"| CAT
    TX -->|"gst_treatment"| GST
    TX -->|"matches_pattern"| PAT

    %% Pattern relationships
    PAT -->|"suggests_category"| CAT
    PAT -->|"observed_in"| ACCT

    %% Tax relationships
    TX -->|"reported_in"| BAS
    GST -->|"determines"| BAS
    DEDUCT -->|"applies_to"| TX

    %% Cross-account
    XFER -->|"debit_from"| ACCT
    XFER -->|"credit_to"| ACCT
    TX -->|"transfer_pair"| TX

    style ACCT fill:#1a1a2e,stroke:#FFCC00,color:#fff
    style TX fill:#1a1a2e,stroke:#4ade80,color:#fff
    style CAT fill:#1a1a2e,stroke:#60a5fa,color:#fff
    style GST fill:#1a1a2e,stroke:#f97316,color:#fff
    style BAS fill:#1a1a2e,stroke:#a78bfa,color:#fff
```

### DataPoint Model Definitions

```python
# server/src/services/cognee/models.py

from cognee.infrastructure.engine import DataPoint
from typing import Any, Optional, List
from pydantic import SkipValidation

class AccountNode(DataPoint):
    """Bank account entity."""
    bank: str                    # "CBA", "NAB", "ANZ", etc.
    bsb: Optional[str] = None
    account_number: str
    account_name: str
    account_type: str            # "transaction", "savings", "credit"
    metadata: dict = {"index_fields": ["bank", "account_name"]}

class StatementNode(DataPoint):
    """Parsed bank statement."""
    filename: str
    period_start: str            # ISO date
    period_end: str              # ISO date
    opening_balance_cents: int
    closing_balance_cents: int
    transaction_count: int
    hash: str                    # File hash for dedup
    from_account: SkipValidation[Any] = None  # → AccountNode
    metadata: dict = {"index_fields": ["filename", "period_start"]}

class CategoryNode(DataPoint):
    """Transaction category from the single source of truth."""
    name: str                    # e.g., "Salary & Wages"
    category_type: str           # "income", "expense", "system"
    gst_default: bool            # Default GST applicability
    color: str                   # Hex color from categoryColors.ts
    description: str             # What this category covers
    metadata: dict = {"index_fields": ["name", "description"]}

class GSTRuleNode(DataPoint):
    """GST categorization rule per ATO guidelines."""
    gst_category: str            # "taxable_10", "gst_free", "input_taxed", "capital", "private"
    gst_rate: float              # 0.0 or 0.10
    bas_label: Optional[str]     # "G1", "G10", "G11", etc.
    is_claimable: bool
    description: str             # Human-readable rule description
    ato_reference: Optional[str] # ATO ruling reference
    applies_to: SkipValidation[Any] = None  # → CategoryNode
    metadata: dict = {"index_fields": ["description", "gst_category"]}

class PatternNode(DataPoint):
    """Recurring transaction pattern learned from data."""
    description_pattern: str     # Regex or fuzzy match string
    typical_amount_min: int      # Cents
    typical_amount_max: int      # Cents
    frequency: str               # "weekly", "fortnightly", "monthly", "quarterly", "annual"
    occurrence_count: int        # Times seen
    last_seen: str               # ISO date
    suggests_category: SkipValidation[Any] = None  # → CategoryNode
    observed_in: SkipValidation[Any] = None         # → AccountNode
    metadata: dict = {"index_fields": ["description_pattern", "frequency"]}

class TransactionNode(DataPoint):
    """Individual bank transaction."""
    date: str                    # ISO date
    description: str             # Raw transaction description
    amount_cents: int            # Positive = credit, negative = debit
    balance_cents: Optional[int]
    ai_reasoning: Optional[str]  # AI categorization notes
    confidence_score: float      # 0.0 to 1.0
    belongs_to: SkipValidation[Any] = None       # → AccountNode
    in_statement: SkipValidation[Any] = None     # → StatementNode
    categorized_as: SkipValidation[Any] = None   # → CategoryNode
    gst_treatment: SkipValidation[Any] = None    # → GSTRuleNode
    matches_pattern: SkipValidation[Any] = None  # → PatternNode
    transfer_pair: SkipValidation[Any] = None    # → TransactionNode (matched transfer)
    metadata: dict = {"index_fields": ["description", "ai_reasoning"]}

class TransferNode(DataPoint):
    """Cross-account transfer relationship."""
    amount_cents: int
    date: str
    matched: bool                # Whether both sides are confirmed
    debit_from: SkipValidation[Any] = None  # → AccountNode
    credit_to: SkipValidation[Any] = None   # → AccountNode
    metadata: dict = {"index_fields": []}

class BASPeriodNode(DataPoint):
    """BAS reporting period with calculated label values."""
    financial_year: str          # "2024-25"
    quarter: int                 # 1-4
    period_start: str
    period_end: str
    lodgement_due: str
    # BAS label values (cents)
    g1_total_sales: int = 0
    g2_export_sales: int = 0
    g3_gst_free_sales: int = 0
    g10_capital_purchases: int = 0
    g11_non_capital_purchases: int = 0
    label_1a_gst_on_sales: int = 0
    label_1b_gst_on_purchases: int = 0
    net_gst: int = 0
    transactions_processed: int = 0
    metadata: dict = {"index_fields": ["financial_year"]}

class CorrectionNode(DataPoint):
    """User correction to AI categorization — used for learning."""
    transaction_description: str
    old_category: str
    new_category: str
    corrected_at: str            # ISO datetime
    reason: Optional[str] = None
    for_transaction: SkipValidation[Any] = None  # → TransactionNode
    metadata: dict = {"index_fields": ["transaction_description", "old_category", "new_category"]}
```

---

## 4. Docker Compose Setup

### Updated `docker-compose.yml`

```yaml
version: '3.8'

services:
  # ─── Cognee API Server ────────────────────────────────────────────
  cognee:
    image: cognee/cognee:latest
    container_name: cba-cognee
    ports:
      - "8000:8000"
    environment:
      # LLM — route through OpenRouter (existing setup)
      - LLM_PROVIDER=openai
      - LLM_MODEL=openrouter/openai/gpt-4o
      - LLM_API_KEY=${VITE_OPENROUTER_API_KEY}
      - LLM_ENDPOINT=https://openrouter.ai/api/v1
      - LLM_MAX_TOKENS=16384

      # Embeddings — local fastembed (no API cost)
      - EMBEDDING_PROVIDER=fastembed
      - EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
      - EMBEDDING_DIMENSIONS=384

      # Relational DB — PostgreSQL (Neon for prod, local for dev)
      - DB_PROVIDER=postgres
      - DB_HOST=${POSTGRES_HOST:-postgres}
      - DB_PORT=${POSTGRES_PORT:-5432}
      - DB_NAME=${POSTGRES_DB:-ai_accountant}
      - DB_USERNAME=${POSTGRES_USER:-app_user}
      - DB_PASSWORD=${POSTGRES_PASSWORD}

      # Vector Store — PGVector (same PostgreSQL instance)
      - VECTOR_DB_PROVIDER=pgvector

      # Graph Store — Kuzu (embedded, file-based)
      - GRAPH_DATABASE_PROVIDER=kuzu

      # Security
      - REQUIRE_AUTHENTICATION=false
      - ENABLE_BACKEND_ACCESS_CONTROL=true
      - TELEMETRY_DISABLED=true
      - LOG_LEVEL=INFO
    volumes:
      - cognee-data:/app/.cognee_system    # Kuzu graph DB + local state
    networks:
      - cba-network
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G

  # ─── PostgreSQL with pgvector ─────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg17
    container_name: cba-postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-app_user}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB:-ai_accountant}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - cba-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app_user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ─── Application Server (Hono + Drizzle) ─────────────────────────
  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: cba-server
    ports:
      - "3501:3501"
    environment:
      - VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}
      - VITE_OPENROUTER_API_KEY=${VITE_OPENROUTER_API_KEY}
      - JWT_SECRET=${JWT_SECRET:-dev_secret_key_123}
      - PORT=3501
      - DATABASE_URL=postgresql://${POSTGRES_USER:-app_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-ai_accountant}
      - COGNEE_API_URL=http://cognee:8000
    volumes:
      - ./statements:/statements
    networks:
      - cba-network
    depends_on:
      - cognee
      - postgres
    restart: unless-stopped

  # ─── Client (React + Nginx) ──────────────────────────────────────
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: cba-client
    ports:
      - "8080:80"
    depends_on:
      - server
    networks:
      - cba-network
    restart: unless-stopped

volumes:
  cognee-data:
    driver: local
  postgres-data:
    driver: local

networks:
  cba-network:
    driver: bridge
```

### Architecture Rationale

| Decision | Reasoning |
|---|---|
| **PGVector over Qdrant** | Single PostgreSQL instance serves relational + vector storage. Reduces operational overhead. Neon DB supports pgvector natively. |
| **Kuzu over Neo4j** | Embedded (file-based), zero extra services, excellent for single-user app. Upgradeable to Neo4j for multi-user later. |
| **Fastembed over OpenAI** | Local embeddings (no API cost, no latency, no rate limits). `bge-small-en-v1.5` is high quality at 384 dimensions. |
| **OpenRouter for LLM** | Existing setup in `rag.py`. Provides access to GPT-4o, Gemini, Claude via single key. |
| **Cognee as a service** | HTTP API on port 8000 instead of embedded Python. Decouples from Node.js server, enables independent scaling. |

---

## 5. Integration Layer API Design

### Option A: HTTP Client (TypeScript → Cognee API)

The Cognee Docker container exposes a REST API. The server communicates via HTTP calls — no Python subprocess needed.

```typescript
// server/src/services/cognee_client.ts

const COGNEE_API = process.env.COGNEE_API_URL || 'http://localhost:8000';

export class CogneeClient {
    // ─── Data Ingestion ───────────────────────────────────────────

    /**
     * Add parsed statement data to the knowledge graph.
     * Creates StatementNode + TransactionNode entities with relationships.
     */
    async addStatementData(statement: ParsedStatement): Promise<void> {
        await fetch(`${COGNEE_API}/api/v1/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: this.formatStatementForCognee(statement),
                dataset_name: 'statement_parser'
            })
        });
        await this.cognify();
    }

    /**
     * Add a single transaction with relationships to account and category.
     */
    async addTransaction(transaction: Transaction): Promise<void> {
        const text = this.formatTransactionText(transaction);
        await fetch(`${COGNEE_API}/api/v1/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: [text],
                dataset_name: 'categorizer'
            })
        });
    }

    /**
     * Trigger cognification (graph building) on ingested data.
     */
    async cognify(): Promise<void> {
        await fetch(`${COGNEE_API}/api/v1/cognify`, { method: 'POST' });
    }

    // ─── Search & Query ───────────────────────────────────────────

    /**
     * Semantic search for similar transactions by description.
     */
    async searchSimilarTransactions(description: string): Promise<SearchResult[]> {
        const res = await fetch(`${COGNEE_API}/api/v1/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_text: description,
                query_type: 'CHUNKS'
            })
        });
        return res.json();
    }

    /**
     * Get category patterns — graph query for how categories connect to descriptions.
     */
    async getCategoryPatterns(category: string): Promise<InsightResult[]> {
        const res = await fetch(`${COGNEE_API}/api/v1/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_text: `What transaction patterns are associated with category "${category}"?`,
                query_type: 'INSIGHTS'
            })
        });
        return res.json();
    }

    /**
     * Trace money flows through an account using graph traversal.
     */
    async traceAccountFlows(accountId: string): Promise<GraphResult> {
        const res = await fetch(`${COGNEE_API}/api/v1/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_text: `Show all transaction flows and transfers for account ${accountId}`,
                query_type: 'GRAPH_COMPLETION'
            })
        });
        return res.json();
    }

    /**
     * Look up GST rule for a transaction type.
     */
    async getGSTRuling(transactionType: string): Promise<GSTResult> {
        const res = await fetch(`${COGNEE_API}/api/v1/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_text: `What is the GST treatment for "${transactionType}" under Australian tax law?`,
                query_type: 'GRAPH_COMPLETION'
            })
        });
        return res.json();
    }

    /**
     * Record a user correction for learning.
     */
    async addCorrection(
        transactionId: string,
        description: string,
        oldCategory: string,
        newCategory: string
    ): Promise<void> {
        const correctionText = `CORRECTION: Transaction "${description}" was recategorized from "${oldCategory}" to "${newCategory}". Future similar transactions should be categorized as "${newCategory}".`;
        await fetch(`${COGNEE_API}/api/v1/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: [correctionText],
                dataset_name: 'categorizer'
            })
        });
        await this.cognify();
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private formatStatementText(statement: ParsedStatement): string[] {
        return [
            `Bank Statement: ${statement.bank} Account ${statement.accountNumber}`,
            `Period: ${statement.periodStart} to ${statement.periodEnd}`,
            `Opening Balance: $${(statement.openingBalance / 100).toFixed(2)}`,
            `Closing Balance: $${(statement.closingBalance / 100).toFixed(2)}`,
            `Transactions: ${statement.transactions.length}`,
        ];
    }

    private formatTransactionText(tx: Transaction): string {
        return [
            `Date: ${tx.date}`,
            `Description: ${tx.description}`,
            `Amount: $${(tx.amount / 100).toFixed(2)}`,
            `Category: ${tx.category || 'uncategorized'}`,
            `GST: ${tx.gstApplicable ? 'Yes' : 'No'}`,
            tx.aiReasoningNotes ? `AI Notes: ${tx.aiReasoningNotes}` : '',
        ].filter(Boolean).join(', ');
    }
}

export const cogneeClient = new CogneeClient();
```

### Option B: Python Service (Direct SDK — Higher Fidelity)

For operations requiring custom DataPoint models and direct graph manipulation:

```python
# server/src/services/cognee/cognee_service.py

import cognee
from cognee.api.v1.search import search
from cognee.api.v1.add import add
from cognee.api.v1.cognify import cognify
from cognee.infrastructure.engine import DataPoint
from cognee.modules.data.methods import create_authorized_dataset
from cognee.modules.graph import add_data_points
from models import (
    AccountNode, StatementNode, TransactionNode, CategoryNode,
    GSTRuleNode, PatternNode, BASPeriodNode, CorrectionNode, TransferNode
)
from typing import Optional
import os


class CogneeService:
    """Cognee integration service for CBA Statements Parse."""

    def __init__(self):
        self._configure()

    def _configure(self):
        """Configure Cognee backends."""
        os.environ["LLM_PROVIDER"] = "openai"
        os.environ["LLM_MODEL"] = "openrouter/openai/gpt-4o"
        os.environ["LLM_API_KEY"] = os.getenv("VITE_OPENROUTER_API_KEY", "")
        os.environ["LLM_ENDPOINT"] = "https://openrouter.ai/api/v1"
        os.environ["EMBEDDING_PROVIDER"] = "fastembed"
        os.environ["EMBEDDING_MODEL"] = "BAAI/bge-small-en-v1.5"
        os.environ["EMBEDDING_DIMENSIONS"] = "384"
        os.environ["DB_PROVIDER"] = "postgres"
        os.environ["DB_HOST"] = os.getenv("POSTGRES_HOST", "localhost")
        os.environ["DB_PORT"] = os.getenv("POSTGRES_PORT", "5432")
        os.environ["DB_NAME"] = os.getenv("POSTGRES_DB", "ai_accountant")
        os.environ["DB_USERNAME"] = os.getenv("POSTGRES_USER", "app_user")
        os.environ["DB_PASSWORD"] = os.getenv("POSTGRES_PASSWORD", "")
        os.environ["VECTOR_DB_PROVIDER"] = "pgvector"
        os.environ["GRAPH_DATABASE_PROVIDER"] = "kuzu"
        os.environ["TELEMETRY_DISABLED"] = "true"

    # ─── Statement Ingestion ──────────────────────────────────────

    async def add_statement_data(
        self,
        bank: str,
        account_number: str,
        account_name: str,
        filename: str,
        period_start: str,
        period_end: str,
        opening_balance: int,
        closing_balance: int,
        transactions: list[dict],
        file_hash: str,
    ) -> dict:
        """
        Add a complete parsed statement to the knowledge graph.
        Creates AccountNode → StatementNode → TransactionNode chain.
        """
        # Create account node
        account = AccountNode(
            bank=bank,
            account_number=account_number,
            account_name=account_name,
            account_type="transaction",
        )

        # Create statement node linked to account
        statement = StatementNode(
            filename=filename,
            period_start=period_start,
            period_end=period_end,
            opening_balance_cents=opening_balance,
            closing_balance_cents=closing_balance,
            transaction_count=len(transactions),
            hash=file_hash,
            from_account=account,
        )

        # Create transaction nodes
        tx_nodes = []
        for tx in transactions:
            tx_node = TransactionNode(
                date=tx["date"],
                description=tx["description"],
                amount_cents=tx["amount"],
                balance_cents=tx.get("balance"),
                ai_reasoning=tx.get("aiReasoningNotes"),
                confidence_score=tx.get("confidenceScore", 1.0),
                belongs_to=account,
                in_statement=statement,
            )
            tx_nodes.append(tx_node)

        # Insert all nodes with relationships
        all_nodes = [account, statement] + tx_nodes
        await add_data_points(all_nodes)

        return {
            "status": "success",
            "account_id": str(account.id),
            "statement_id": str(statement.id),
            "transactions_added": len(tx_nodes),
        }

    # ─── Transaction Operations ───────────────────────────────────

    async def add_transaction(self, tx: dict, account_id: Optional[str] = None) -> dict:
        """Add a single transaction to the knowledge graph."""
        text = (
            f"Date: {tx['date']}, "
            f"Description: {tx['description']}, "
            f"Amount: ${tx['amount'] / 100:.2f}, "
            f"Category: {tx.get('category', 'uncategorized')}, "
            f"GST: {'Yes' if tx.get('gstApplicable') else 'No'}"
        )
        await add([text], "categorizer")
        await cognify()
        return {"status": "success"}

    async def search_similar_transactions(self, description: str, limit: int = 10) -> list:
        """Semantic search for transactions with similar descriptions."""
        from cognee import SearchType
        results = await search(
            query_text=description,
            query_type=SearchType.CHUNKS,
        )
        return results[:limit]

    # ─── Category Intelligence ────────────────────────────────────

    async def get_category_patterns(self, category: str) -> list:
        """Get transaction patterns associated with a category."""
        from cognee import SearchType
        results = await search(
            query_text=f"Transaction patterns for category {category}",
            query_type=SearchType.INSIGHTS,
        )
        return results

    async def suggest_category(self, description: str) -> dict:
        """Use graph knowledge to suggest a category for a transaction."""
        from cognee import SearchType
        results = await search(
            query_text=f"What category should be assigned to a transaction with description: {description}",
            query_type=SearchType.GRAPH_COMPLETION,
        )
        return {"suggestions": results}

    # ─── GST & Tax ────────────────────────────────────────────────

    async def get_gst_ruling(self, transaction_type: str) -> dict:
        """Look up GST treatment from the knowledge graph."""
        from cognee import SearchType
        results = await search(
            query_text=f"GST treatment for {transaction_type} under Australian tax law",
            query_type=SearchType.GRAPH_COMPLETION,
        )
        return {"ruling": results}

    async def seed_gst_rules(self) -> dict:
        """Seed the knowledge graph with ATO GST rules."""
        gst_rules_text = [
            "GST-free supplies include: basic food (fresh fruit, vegetables, meat, bread, milk), "
            "medical and health services, education courses, childcare, exports, water and sewerage.",
            "Input-taxed supplies include: bank fees, loan interest, credit card interest, "
            "share brokerage, financial advice fees, superannuation fees, residential rent received.",
            "Standard 10% GST applies to: most goods and services sold in Australia by GST-registered businesses.",
            "Capital acquisitions with GST: computers, laptops, furniture, vehicles, equipment, "
            "renovations, printers. Report at BAS label G10.",
            "Non-capital purchases with GST: office supplies, utilities, professional services, "
            "software subscriptions, travel. Report at BAS label G11.",
            "Private/out-of-scope: ATM withdrawals, personal groceries, Netflix, Spotify, "
            "gym memberships, personal entertainment. Not reported on BAS.",
        ]
        await add(gst_rules_text, "gst_rules")
        await cognify()
        return {"status": "success", "rules_added": len(gst_rules_text)}

    # ─── Account Flows ────────────────────────────────────────────

    async def trace_account_flows(self, account_id: str) -> dict:
        """Graph traversal showing money flows through an account."""
        from cognee import SearchType
        results = await search(
            query_text=f"Show all transaction flows, transfers, and patterns for account {account_id}",
            query_type=SearchType.GRAPH_COMPLETION,
        )
        return {"flows": results}

    # ─── Learning from Corrections ────────────────────────────────

    async def add_correction(
        self,
        transaction_description: str,
        old_category: str,
        new_category: str,
        reason: Optional[str] = None,
    ) -> dict:
        """Record a user correction to learn from."""
        correction_text = (
            f"CATEGORY CORRECTION: Transaction '{transaction_description}' "
            f"was incorrectly categorized as '{old_category}'. "
            f"The correct category is '{new_category}'. "
            f"{'Reason: ' + reason + '. ' if reason else ''}"
            f"Future transactions with similar descriptions should be "
            f"categorized as '{new_category}'."
        )
        await add([correction_text], "categorizer")
        await cognify()
        return {"status": "success", "learned": True}

    # ─── BAS Calculations ─────────────────────────────────────────

    async def store_bas_period(self, bas_data: dict) -> dict:
        """Store a completed BAS calculation in the knowledge graph."""
        bas_text = (
            f"BAS Q{bas_data['quarter']} {bas_data['financial_year']}: "
            f"G1 Total Sales ${bas_data['g1'] / 100:.2f}, "
            f"G10 Capital ${bas_data['g10'] / 100:.2f}, "
            f"G11 Non-capital ${bas_data['g11'] / 100:.2f}, "
            f"1A GST on sales ${bas_data['label_1a'] / 100:.2f}, "
            f"1B GST on purchases ${bas_data['label_1b'] / 100:.2f}, "
            f"Net GST ${bas_data['net_gst'] / 100:.2f}"
        )
        await add([bas_text], "gst_rules")
        await cognify()
        return {"status": "success"}

    # ─── Pruning ──────────────────────────────────────────────────

    async def prune_all(self) -> dict:
        """Reset all Cognee data. Use with caution."""
        await cognee.prune.prune_data()
        await cognee.prune.prune_system(metadata=True)
        return {"status": "pruned"}

    async def prune_dataset(self, dataset_name: str) -> dict:
        """Remove a specific dataset."""
        await cognee.prune.prune_data()
        return {"status": "pruned", "dataset": dataset_name}
```

### Recommended Approach: Hybrid

Use **Option A** (TypeScript HTTP client) as the primary interface for the Node.js server, with **Option B** (Python SDK) available for:
- Initial data seeding (GST rules, category definitions)
- Custom DataPoint model ingestion (structured graph building)
- Complex graph operations that require direct Kuzu/pgvector access

The Cognee Docker container handles both via its REST API and direct Python SDK.

---

## 6. Per-Agent Dataset Specifications

Each AI agent operates on an isolated Cognee dataset. Datasets provide data isolation while sharing the same underlying infrastructure.

| Dataset Name | Agent | Purpose | Key Data |
|---|---|---|---|
| `statement_parser` | Statement Parser | Raw parsed statement data | StatementNode, AccountNode, raw text |
| `categorizer` | Categorizer | Category patterns + corrections | TransactionNode, CategoryNode, CorrectionNode, PatternNode |
| `gst_rules` | GST Agent | ATO rulings + BAS calculations | GSTRuleNode, BASPeriodNode, tax rule text |
| `reconciliation` | Reconciliation | Balance histories + discrepancies | AccountNode balances, variance records |
| `budget` | Budget/Forecast | Spending patterns + forecasts | PatternNode, historical aggregates |
| `cross_account` | Transfer Detector | Inter-account relationships | TransferNode, account-to-account edges |

### Dataset Interaction Matrix

```
                    statement_parser  categorizer  gst_rules  reconciliation  budget  cross_account
statement_parser         RW              -            -            R            -          -
categorizer              R              RW            R            -            -          -
gst_rules                R               R           RW            -            -          -
reconciliation           R               R            -           RW            R          R
budget                   R               R            -            R           RW          -
cross_account            R               -            -            R            -         RW

R = Read, W = Write, RW = Read+Write, - = No access
```

### Dataset Seeding Strategy

On first run, seed these datasets:

1. **`categorizer`** — Import all categories from `client/src/features/transactions/constants/categories.ts`
2. **`gst_rules`** — Import all GST rules from `server/src/services/agents/gst_rules.py`
3. **`gst_rules`** — Import tax brackets from `server/src/services/agents/tax_config.py`
4. **`statement_parser`** — No seeding; populated by statement parsing pipeline

---

## 7. Data Flow Architecture

### Statement Processing Pipeline

```
┌────────────────┐     ┌──────────────┐     ┌───────────────────┐
│  PDF/CSV Upload│────▶│  Bank Parser │────▶│  Cognee: add()    │
│  (chokidar)    │     │  (TypeScript)│     │  dataset:         │
└────────────────┘     └──────────────┘     │  statement_parser │
                                             └────────┬──────────┘
                                                      │
                                                      ▼
                       ┌──────────────┐     ┌───────────────────┐
                       │  AI Category │◀────│  Cognee: cognify()│
                       │  Agent       │     │  Extract entities │
                       │  (OpenRouter)│     │  Build graph      │
                       └──────┬───────┘     └───────────────────┘
                              │
                              ▼
                       ┌──────────────┐     ┌───────────────────┐
                       │  GST Agent   │────▶│  Cognee: search() │
                       │  (gst_rules) │     │  GRAPH_COMPLETION │
                       └──────┬───────┘     │  for GST ruling   │
                              │             └───────────────────┘
                              ▼
                       ┌──────────────┐
                       │  Drizzle ORM │
                       │  PostgreSQL  │
                       │  (write txns)│
                       └──────────────┘
```

### Category Correction Learning Loop

```
User corrects category in UI
         │
         ▼
┌─────────────────┐     ┌───────────────────────┐
│  PATCH /api/tx  │────▶│  cogneeClient         │
│  {category: x}  │     │  .addCorrection()     │
└─────────────────┘     │  dataset: categorizer │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │  cognify() rebuilds   │
                         │  graph with correction │
                         │  node linked to        │
                         │  description pattern   │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │  Next similar TX uses  │
                         │  search(INSIGHTS) to   │
                         │  find correction and   │
                         │  apply correct category│
                         └───────────────────────┘
```

### BAS Calculation Flow

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│  Select BAS  │────▶│  Fetch TXs for │────▶│  GST Agent       │
│  Quarter     │     │  date range    │     │  categorize each │
└──────────────┘     └────────────────┘     │  via gst_rules   │
                                             │  dataset search  │
                                             └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  BASCalculator   │
                                             │  aggregate labels│
                                             │  G1,G10,G11,1A,1B│
                                             └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  Store BAS period│
                                             │  in Cognee graph │
                                             │  for history     │
                                             └──────────────────┘
```

---

## 8. Migration Plan: Current RAG → Cognee

### Phase 1: Infrastructure (Week 1)

1. Add PostgreSQL (pgvector) and Cognee services to `docker-compose.yml`
2. Configure environment variables in `.env`
3. Validate Cognee API is accessible at `http://cognee:8000`
4. Run `CREATE EXTENSION IF NOT EXISTS vector;` on PostgreSQL
5. Test basic `add` → `cognify` → `search` cycle

### Phase 2: Integration Layer (Week 2)

1. Create `server/src/services/cognee_client.ts` (HTTP client)
2. Create `server/src/services/cognee/models.py` (DataPoint models)
3. Create `server/src/services/cognee/cognee_service.py` (Python SDK)
4. Create `server/src/services/cognee/seed.py` (initial data seeding)
5. Add Cognee client import to `server/src/services/pipeline.ts`

### Phase 3: Data Seeding (Week 2)

1. Seed `categorizer` dataset with categories from `categories.ts`
2. Seed `gst_rules` dataset with GST rules from `gst_rules.py`
3. Seed `gst_rules` dataset with tax brackets from `tax_config.py`
4. Index existing transactions from SQLite/PostgreSQL into `statement_parser`

### Phase 4: Pipeline Integration (Week 3)

1. Hook `addStatementData()` into statement parsing pipeline (`pipeline.ts`)
2. Hook `addCorrection()` into transaction category PATCH endpoint
3. Replace `ragService.search()` calls with `cogneeClient.searchSimilarTransactions()`
4. Add `getCategoryPatterns()` to AI categorization for better accuracy

### Phase 5: Deprecate Old RAG (Week 4)

1. Remove `server/src/services/rag.ts` (TypeScript subprocess wrapper)
2. Remove `server/src/services/rag.py` (old flat Cognee client)
3. Remove `server/src/services/discover_cognee.py` (debug script)
4. Remove `server/src/services/prune_cognee.py` (replaced by service method)
5. Remove `server/src/services/test_cognee_config.py` (replaced by health check)
6. Update all imports and references
7. Remove `./server/.cognee` volume mount from old docker-compose

### Rollback Strategy

- Keep old `rag.ts`/`rag.py` files until Cognee is proven stable
- Feature flag: `USE_COGNEE=true|false` in environment to switch between old and new
- SQLite DB remains untouched — Cognee is additive, not replacing Drizzle ORM

---

## 9. Neon DB Configuration

### Why Neon?

- **Serverless PostgreSQL** — scales to zero when idle, scales up under load
- **pgvector built-in** — `CREATE EXTENSION vector` available out of the box
- **Branching** — instant database branches for testing/staging
- **Free tier** — 0.5 GB storage, 190 compute hours/month

### Connection Setup

```bash
# .env (production — Neon DB)
DATABASE_URL=postgresql://app_user:PASSWORD@ep-cool-name-123456.us-east-2.aws.neon.tech/ai_accountant?sslmode=require

# Cognee-specific (point to same Neon DB)
DB_PROVIDER=postgres
DB_HOST=ep-cool-name-123456.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=ai_accountant
DB_USERNAME=app_user
DB_PASSWORD=PASSWORD

# Vector store uses same DB
VECTOR_DB_PROVIDER=pgvector

# SSL required for Neon
PGSSLMODE=require
```

### Local Development vs Production

| Setting | Local (Docker) | Production (Neon) |
|---|---|---|
| `DB_HOST` | `postgres` (Docker service) | `ep-xxx.neon.tech` |
| `DB_PORT` | `5432` | `5432` |
| `PGSSLMODE` | `disable` | `require` |
| `GRAPH_DATABASE_PROVIDER` | `kuzu` (local file) | `kuzu` (volume mount) |
| `VECTOR_DB_PROVIDER` | `pgvector` | `pgvector` |
| Cognee container | Yes | Yes (or embedded) |

### Neon Initialization

```sql
-- Run once on Neon DB
CREATE EXTENSION IF NOT EXISTS vector;

-- Cognee will auto-create its tables, but verify:
-- cognee_data, cognee_documents, cognee_chunks, etc.
```

---

## 10. Performance Considerations

### Cognify Latency

- `cognify()` is the most expensive operation (LLM calls for entity extraction)
- **Strategy**: Batch cognify calls. Don't call after every transaction — accumulate and cognify periodically
- Estimated: ~2-5 seconds per document chunk (LLM-dependent)

### Embedding Performance

- Fastembed runs locally (CPU) — no network latency
- `bge-small-en-v1.5` at 384 dims is fast (~10ms per embedding)
- Batch embedding for bulk imports

### Search Performance

- `CHUNKS` search: ~50-200ms (vector similarity only)
- `INSIGHTS` search: ~100-500ms (graph traversal)
- `GRAPH_COMPLETION` search: ~1-3s (LLM generation from graph context)
- **Recommendation**: Use `CHUNKS` for real-time UI, `GRAPH_COMPLETION` for background analysis

### Memory & Storage

- Cognee container: 4GB RAM limit recommended
- Kuzu graph DB: ~10MB per 10K transactions
- PGVector: ~50MB per 10K embedded chunks (384 dims)
- PostgreSQL: ~20MB per 10K transactions (relational tables)

### Optimization Strategies

1. **Lazy cognify**: Queue data with `add()`, run `cognify()` on schedule (every 5 min or after batch)
2. **Selective search types**: Use `CHUNKS` for speed, `GRAPH_COMPLETION` only when graph context needed
3. **Dataset partitioning**: Smaller datasets = faster cognify and search
4. **Embedding cache**: Fastembed caches model weights locally after first load
5. **Connection pooling**: PGVector shares PostgreSQL connection pool with Drizzle ORM

---

## 11. Environment Variables Reference

```bash
# ═══════════════════════════════════════════════════════════════════
# .env — Complete configuration for Cognee + CBA Statements Parse
# ═══════════════════════════════════════════════════════════════════

# ─── LLM Provider (OpenRouter) ────────────────────────────────────
LLM_PROVIDER=openai
LLM_MODEL=openrouter/openai/gpt-4o
LLM_API_KEY=${VITE_OPENROUTER_API_KEY}
LLM_ENDPOINT=https://openrouter.ai/api/v1
LLM_MAX_TOKENS=16384
STRUCTURED_OUTPUT_FRAMEWORK=instructor

# ─── Embeddings (Local Fastembed) ─────────────────────────────────
EMBEDDING_PROVIDER=fastembed
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_DIMENSIONS=384
EMBEDDING_MAX_TOKENS=512
EMBEDDING_BATCH_SIZE=36

# ─── PostgreSQL / Neon DB ─────────────────────────────────────────
DB_PROVIDER=postgres
DB_HOST=localhost          # or ep-xxx.neon.tech for production
DB_PORT=5432
DB_NAME=ai_accountant
DB_USERNAME=app_user
DB_PASSWORD=<your_password>
DATABASE_URL=postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# ─── Vector Store (PGVector) ──────────────────────────────────────
VECTOR_DB_PROVIDER=pgvector
# Uses same DB_* credentials as relational store

# ─── Graph Store (Kuzu) ──────────────────────────────────────────
GRAPH_DATABASE_PROVIDER=kuzu
# SYSTEM_ROOT_DIRECTORY=/app/.cognee_system  # Override graph DB location

# ─── Cognee Settings ──────────────────────────────────────────────
TELEMETRY_DISABLED=true
REQUIRE_AUTHENTICATION=false
ENABLE_BACKEND_ACCESS_CONTROL=true
LOG_LEVEL=INFO

# ─── Application ──────────────────────────────────────────────────
VITE_OPENAI_API_KEY=<your_key>
VITE_OPENROUTER_API_KEY=<your_key>
JWT_SECRET=<your_secret>
PORT=3501
COGNEE_API_URL=http://cognee:8000

# ─── Feature Flags ───────────────────────────────────────────────
USE_COGNEE=true            # Toggle between old RAG and new Cognee
```

---

## Appendix A: File Structure After Integration

```
server/src/services/
├── cognee/
│   ├── __init__.py
│   ├── models.py              # DataPoint model definitions
│   ├── cognee_service.py      # Python SDK service (Option B)
│   └── seed.py                # Initial data seeding script
├── cognee_client.ts           # TypeScript HTTP client (Option A)
├── agents/
│   ├── gst_rules.py           # GST categorization (existing)
│   ├── tax_config.py          # Tax brackets (existing)
│   ├── cgt_calculator.py      # CGT calculations (existing)
│   └── depreciation_calculator.py  # Depreciation (existing)
├── pipeline.ts                # Statement parsing pipeline (modified)
├── ai.ts                      # AI categorization (modified)
└── [rag.ts]                   # DEPRECATED — remove after migration
```

## Appendix B: Cognee API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/add` | Add data to a dataset |
| POST | `/api/v1/cognify` | Build knowledge graph from added data |
| POST | `/api/v1/search` | Query the knowledge graph |
| POST | `/api/v1/prune/data` | Delete all data |
| POST | `/api/v1/prune/system` | Reset system state |
| GET | `/api/v1/datasets` | List all datasets |
| GET | `/api/v1/health` | Health check |

## Appendix C: Testing Checklist

- [ ] Cognee container starts and responds to health check
- [ ] PostgreSQL with pgvector extension is accessible
- [ ] `add()` → `cognify()` → `search()` cycle completes
- [ ] Fastembed generates embeddings locally (no OpenAI call)
- [ ] Kuzu graph DB persists across container restarts (volume)
- [ ] Search results return relevant transactions for known descriptions
- [ ] Category correction is reflected in subsequent searches
- [ ] GST rule lookup returns correct treatment
- [ ] Multiple datasets are isolated (categorizer can't see gst_rules data without permission)
- [ ] Neon DB connection works with SSL (production)
- [ ] Feature flag `USE_COGNEE=false` falls back to old RAG
