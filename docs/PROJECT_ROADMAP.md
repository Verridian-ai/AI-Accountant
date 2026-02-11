# Project Roadmap: CBA Statements Parse v2.0

> Unified phased implementation plan for Claude AI agents, Cognee knowledge graphs,
> BAS/GST automation, and cross-account intelligence.

---

## Executive Summary

Transform the CBA Statements Parse app from an OpenAI-powered statement parser into a
full-featured Australian financial intelligence platform with:

- **Claude-powered AI agents** replacing OpenAI/OpenRouter for parsing, categorization, and analysis
- **Cognee knowledge graphs** replacing flat RAG with structured entity-relationship memory
- **Automated BAS/GST** with ATO-compliant classification, pre-fill reports, and lodgement workflows
- **Cross-account intelligence** tracing money flows across 8+ bank accounts

**Current State:** Working app with 8 bank parsers, OpenAI categorization, basic Cognee RAG, SQLite DB.
**Target State:** Multi-agent Claude system with structured knowledge graphs, full BAS automation, and cross-account flow analysis.

---

## Phase Overview

```
Phase 1 (Weeks 1-3)     Get Cognee running locally with Docker
Phase 2 (Weeks 4-7)     Claude agents replacing OpenAI
Phase 3 (Weeks 8-11)    Full BAS/GST automation
Phase 4 (Weeks 12-15)   Cross-account intelligence & analytics
```

---

## Phase 1: Cognee Infrastructure (Weeks 1-3)

**Goal:** Replace flat text RAG with structured Cognee knowledge graphs running locally in Docker.

### Week 1: Docker Infrastructure

| Task | Details | Deliverable |
|------|---------|-------------|
| Add PostgreSQL service | `pgvector/pgvector:pg17` with health check | Updated `docker-compose.yml` |
| Add Cognee service | `cognee/cognee:latest` on port 8000 (2 CPU, 4GB RAM) | Cognee accessible at `http://cognee:8000` |
| Configure backends | PGVector for vectors, Kuzu (embedded) for graph, Fastembed for local embeddings | `.env` with all Cognee vars |
| Validate cycle | Test `add()` → `cognify()` → `search()` through REST API | Passing health check |

**Architecture Decisions (locked in):**
- **PGVector** over Qdrant (single Postgres for relational + vector, Neon-compatible)
- **Kuzu** over Neo4j (embedded, zero extra services, upgradeable later)
- **Fastembed** for embeddings (local, free, `bge-small-en-v1.5` at 384 dims)
- **Cognee as Docker service** (HTTP API, decoupled from Node.js)

### Week 2: Integration Layer

| Task | Details | Deliverable |
|------|---------|-------------|
| Create `cognee_client.ts` | TypeScript HTTP client calling Cognee REST API | `server/src/services/cognee_client.ts` |
| Create DataPoint models | 10 Pydantic models (AccountNode, TransactionNode, CategoryNode, GSTRuleNode, etc.) | `server/src/services/cognee/models.py` |
| Create Python service | Direct SDK for seeding and complex graph ops | `server/src/services/cognee/cognee_service.py` |
| Define 6 datasets | `statement_parser`, `categorizer`, `gst_rules`, `reconciliation`, `budget`, `cross_account` | Dataset isolation configured |

### Week 3: Migration & Seeding

| Task | Details | Deliverable |
|------|---------|-------------|
| Seed categories | Import all 22 categories from `categories.ts` into `categorizer` dataset | Seeding script |
| Seed GST rules | Import GST rules from `gst_rules.py` into `gst_rules` dataset | GST knowledge graph |
| Hook into pipeline | `addStatementData()` in `pipeline.ts`, `addCorrection()` on category PATCH | Pipeline integration |
| Feature flag | `USE_COGNEE=true/false` toggle, old `rag.ts` kept as fallback | Safe rollback path |
| Deprecate old RAG | Remove `rag.ts`, `rag.py`, `discover_cognee.py`, `prune_cognee.py` | Clean codebase |

**Exit Criteria:** Cognee running in Docker, knowledge graph populated with categories + GST rules, statement pipeline indexing into Cognee, search returning relevant results.

---

## Phase 2: Claude Agent Migration (Weeks 4-7)

**Goal:** Replace OpenAI/OpenRouter AI calls with 6 specialized Claude agents orchestrated through a central coordinator.

### Week 4: Foundation

| Task | Details | Deliverable |
|------|---------|-------------|
| Install Anthropic SDK | `npm install @anthropic-ai/sdk` | `package.json` updated |
| Create Claude client | Singleton with API key from env | `server/src/services/claude/client.ts` |
| Create base agent | `ClaudeAgent` class with agentic tool-use loop, structured JSON output, retries | `server/src/services/claude/base-agent.ts` |
| Create orchestrator | Agent registry, context assembly, fallback to existing services | `server/src/services/claude/orchestrator.ts` |
| Create Cognee tools | `searchCognee()`, `indexInCognee()` for agent tool access | `server/src/services/claude/cognee-tools.ts` |
| Error handling | Retry with exponential backoff, circuit breaker (open after 5 failures, 60s recovery) | `server/src/services/claude/retry.ts` |

**Model Selection:**
- **Sonnet 4.5:** StatementParser, GSTCalculator, BudgetAnalyzer (accuracy-critical)
- **Haiku 4.5:** TransactionCategorizer, AccountReconciler, CrossAccountTracer (throughput-critical)

### Week 5: Core Pipeline Agents

| Agent | Replaces | Tools | I/O |
|-------|----------|-------|-----|
| **StatementParser** | `parseWithVision()`, `parseStatementText()` | `detect_bank`, `parse_with_bank_parser`, `extract_account_info`, `validate_transactions`, `search_cognee` | PDF buffer → `StatementParserOutput` |
| **TransactionCategorizer** | `categorizeTransaction()`, `categorizeTransactionsBatch()`, `categorizeWithMemory()` | `lookup_merchant_memory`, `search_similar_transactions`, `get_category_taxonomy`, `batch_categorize` | Transactions[] → `CategorizerOutput` |

### Week 6: GST & Reconciliation Agents

| Agent | Replaces | Tools | I/O |
|-------|----------|-------|-----|
| **GSTCalculator** | Python BASAgent | `categorize_gst`, `calculate_gst_from_inclusive`, `generate_bas_labels`, `identify_capital_purchases`, `get_quarter_dates`, `search_gst_rulings` | Transactions[] + quarter → `GSTCalculatorOutput` with all BAS labels |
| **AccountReconciler** | Python ReconciliationAgent | `find_duplicates`, `verify_balance_continuity`, `find_unmatched`, `detect_transfers`, `check_running_balance` | AccountId → `ReconcilerOutput` |

### Week 7: Analysis Agents & Pipeline Integration

| Agent | Replaces | Tools |
|-------|----------|-------|
| **BudgetAnalyzer** | Python FinancialAnalystAgent | `analyze_spending_by_category`, `identify_recurring`, `calculate_monthly_averages`, `project_balance`, `find_anomalies` |
| **CrossAccountTracer** | New | `match_transfers`, `detect_multi_hop`, `calculate_net_flows`, `generate_flow_diagram` |

| Integration Task | Details |
|-----------------|---------|
| Update `pipeline.ts` | Replace `aiService.method()` → `orchestrator.invoke()` |
| Update route handlers | Replace direct `aiService` calls in Hono routes |
| Add `/api/agents/*` routes | Explicit agent endpoints for BAS, reconciliation, analysis |
| SSE integration | Emit `agent_progress` events (started/completed/error) |
| Dual-mode toggle | `USE_CLAUDE_AGENTS=true/false` env var for safe rollback |
| Deprecate Python agents | Mark as deprecated, remove subprocess calls |

**Cost Estimate:** ~$0.08 per statement processed through full pipeline.

**Exit Criteria:** All 6 agents operational, pipeline fully migrated, OpenAI dependency removable, dual-mode fallback working.

---

## Phase 3: Full BAS/GST Automation (Weeks 8-11)

**Goal:** Complete BAS/GST automation with ATO-compliant classification, pre-fill reports, and review workflows.

### Week 8: GST Classification Engine [P0]

| Task | Details |
|------|---------|
| Auto GST classification | Every transaction gets `gstCategory`, `gstAmount`, `gstConfidence` on import |
| Confidence scoring | Formula: pattern match (0-0.4) + category alignment (+0.2) + correction history (+0.2) + AI confirm (+0.1) + keyword specificity (+0.1) |
| GST badges in UI | Green "GST $X.XX" (taxable), Gray "FRE" (free), Orange "INP" (input-taxed), Yellow "?" (needs review) |
| Review queue | Sidebar showing transactions with confidence < 0.7, bulk approve/reject |
| DB migration | Add `gst_confidence`, `gst_override`, `gst_override_reason` columns to transactions |

**GST Classification Rules (from GST_BAS_RULES.md):**
- 22 categories mapped to tax codes (GST/FRE/INP/N-T/EXP/CAP)
- Insurance special cases (general=GST, life=FRE, CTP=GST)
- Financial supplies always input-taxed (bank fees, interest, brokerage)
- Capital threshold: items >$1,000 GST-exclusive → G10

### Week 9: BAS Pre-Fill & Reporting [P0]

| Task | Details |
|------|---------|
| BAS pre-fill report | Generate all BAS labels (G1-G20, 1A, 1B, W1, W2, 5A) |
| Simpler BAS mode | Default: G1, 1A, 1B only (turnover <$10M) |
| Full BAS mode | Toggle for full G1-G20 breakdown |
| Label drill-down | Click any BAS label to see contributing transactions |
| Period selector | Monthly/quarterly/annual with auto-detect available periods |
| BAS dashboard | Cards showing GST collected, credits, net position, due date |

### Week 10: Learning & Review Workflow [P1]

| Task | Details |
|------|---------|
| Manual override with learning | User corrects GST → system learns pattern → Cognee `addCorrection()` |
| `gst_learning_rules` table | Track corrections, apply to future transactions |
| BAS review workflow | Draft → Review → Ready → Lodged → Amended status flow |
| Period locking | Lock period after lodgement, require amendment for changes |
| Historical BAS comparison | Side-by-side with variance highlighting (>20% = amber, >50% = red) |
| Input tax credit tracking | List claimable credits, flag missing invoices (>$82.50 threshold) |

### Week 11: GST Polish & Edge Cases [P1]

| Task | Details |
|------|---------|
| Insurance GST handling | Classify general vs life vs CTP insurance correctly |
| Mixed-use apportionment | Business use % for phone, vehicle, home office |
| Supermarket mixed items | 50/50 split when no breakdown available |
| Capital vs non-capital | Auto-classify based on amount and merchant type |
| BAS deadline reminders | Dashboard notifications at 14 days and 3 days before due |
| Export to CSV/PDF | BAS report export for accountant/ATO |

**Exit Criteria:** Every transaction auto-classified for GST, BAS pre-fill generating all labels, review workflow operational, learning loop improving accuracy over time.

---

## Phase 4: Cross-Account Intelligence (Weeks 12-15)

**Goal:** Multi-account analysis with money flow tracing, analytics dashboards, and forecasting.

### Week 12: Cross-Account Foundation [P0]

| Task | Details |
|------|---------|
| Multi-account upload | Drag-and-drop for 5+ statements, auto-detect bank |
| Account management UI | Nickname, color, type (transaction/savings/credit) |
| Cross-account matching | Enhance `TransferDetector`: amount±$5, date±3 days, description keywords |
| Transfer confirmation UI | List of detected matches with confirm/reject actions |
| `transfer_links` table | Store confirmed cross-account transfer pairs |

### Week 13: Money Flow Intelligence [P1]

| Task | Details |
|------|---------|
| Money flow visualization | Sankey diagram showing Account A → B → C flows |
| Circular detection | Alert when A → B → C → A exceeds $1,000 in a period |
| Regular transfer ID | Detect recurring transfers (same amount, same accounts, regular interval) |
| Net position calculator | Select two accounts → see net flow direction and total |
| Flow diagram export | Mermaid-based flow diagrams in CrossAccountTracer agent |

**Tech:** React Flow or D3.js Sankey for visualization.

### Week 14: Analytics Dashboards [P0/P1]

| Task | Priority | Details |
|------|----------|---------|
| Category breakdown charts | P0 | Donut/pie for expenses, bar for income vs expenses, interactive drill-down |
| Recurring payment tracker | P0 | Auto-detect subscriptions, show annual cost, alert on missed payments |
| Spending trend analysis | P1 | Line chart over 6-12 months, month-over-month comparison, anomaly highlighting |
| Budget vs actual | P1 | Set budgets per category, progress bars, over-budget alerts (80% amber, 100% red) |
| Anomaly detection | P1 | 6 rules: amount spike, frequency, new merchant, duplicate, round number, time anomaly |
| `budgets`, `recurring_patterns`, `anomalies` tables | P1 | New data models for analytics features |

### Week 15: Advanced Analytics & Polish [P2]

| Task | Details |
|------|---------|
| Cash flow forecasting | Project 3-6 months based on recurring + historical patterns, confidence bands |
| Account relationship graph | Network graph of all accounts with edge weights by transfer volume |
| Year-over-year comparison | Compare financial years side-by-side |
| Mobile-first polish | Responsive breakpoints (375/641/1025px), swipe actions, bottom nav |
| Performance optimization | Lazy cognify (batch every 5 min), CHUNKS search for real-time, GRAPH_COMPLETION for background |

**Exit Criteria:** Multi-account flows visualized, recurring payments tracked, anomalies detected, budgets operational, mobile-responsive.

---

## Technical Architecture Summary

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React 18)                     │
│  TanStack Table/Virtual │ Tailwind Neumorphic │ SSE     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────┴───────────────────────────────────┐
│                    Hono Server                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              AgentOrchestrator                     │   │
│  │  ┌────────┐ ┌──────────┐ ┌─────────┐            │   │
│  │  │ Parser │ │Categorizer│ │  GST    │            │   │
│  │  │ Agent  │ │  Agent    │ │ Agent   │  Claude    │   │
│  │  └────────┘ └──────────┘ └─────────┘  Sonnet/   │   │
│  │  ┌────────┐ ┌──────────┐ ┌─────────┐  Haiku    │   │
│  │  │Reconcil│ │  Budget  │ │CrossAcct│            │   │
│  │  │  Agent │ │  Agent   │ │ Agent   │            │   │
│  │  └────────┘ └──────────┘ └─────────┘            │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                    │
│  ┌─────────┐  ┌─────┴─────┐  ┌──────────┐              │
│  │ Drizzle │  │  Cognee   │  │  Bank    │              │
│  │   ORM   │  │  Client   │  │ Parsers  │              │
│  └────┬────┘  └─────┬─────┘  └──────────┘              │
└───────┼─────────────┼──────────────────────────────────┘
        │             │
┌───────┴──┐  ┌───────┴────────┐
│PostgreSQL│  │  Cognee API    │
│ +pgvector│  │  (Docker)      │
│ (Neon DB)│  │  ┌───────────┐ │
│          │◄─┤  │ Kuzu Graph│ │
│          │  │  └───────────┘ │
│          │  │  ┌───────────┐ │
│          │◄─┤  │ Fastembed │ │
│          │  │  └───────────┘ │
└──────────┘  └────────────────┘
```

### New File Structure

```
server/src/services/
├── claude/                          # Phase 2
│   ├── client.ts                    # Anthropic SDK singleton
│   ├── base-agent.ts                # ClaudeAgent with tool-use loop
│   ├── orchestrator.ts              # Agent routing + context + fallback
│   ├── cognee-tools.ts              # Cognee tool wrappers for agents
│   ├── types.ts                     # Shared agent types
│   ├── config.ts                    # Token budgets, model selection
│   ├── retry.ts                     # Exponential backoff + circuit breaker
│   └── agents/
│       ├── statement-parser.ts
│       ├── transaction-categorizer.ts
│       ├── gst-calculator.ts
│       ├── account-reconciler.ts
│       ├── budget-analyzer.ts
│       └── cross-account-tracer.ts
├── cognee/                          # Phase 1
│   ├── models.py                    # 10 DataPoint models
│   ├── cognee_service.py            # Python SDK service
│   └── seed.py                      # Initial data seeding
├── cognee_client.ts                 # TypeScript HTTP client
└── [deprecated: rag.ts, rag.py]
```

### Database Changes Summary

**New Tables (5):**
- `gst_learning_rules` — User corrections for GST classification learning
- `budgets` — Category budget tracking
- `recurring_patterns` — Detected recurring payments
- `anomalies` — Flagged unusual transactions
- `transfer_links` — Confirmed cross-account transfer pairs

**Column Additions (13):**
- `transactions`: `gst_confidence`, `gst_override`, `gst_override_reason`, `gst_learning_rule_id`
- `accounts`: `nickname`, `account_type`, `color`
- `bas_periods`: `review_notes`, `reviewed_by`, `reviewed_at`, `locked`, `reporting_method`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Claude API costs | Token budgets per agent, Haiku for throughput tasks, circuit breaker limits runaway calls |
| Cognee instability | `USE_COGNEE` feature flag, old RAG kept until proven, SQLite untouched |
| Agent migration breaks pipeline | `USE_CLAUDE_AGENTS` toggle, dual-mode orchestrator falls back to OpenAI |
| GST classification errors | Confidence scoring, mandatory review queue for <70% confidence, learning loop |
| Docker resource usage | Cognee: 2 CPU/4GB limit, Postgres: separate persistent volume |
| Neon DB latency | Local Postgres for dev, Neon for prod only, SSL required |

---

## Dependencies Between Phases

```
Phase 1 (Cognee) ──────────┬──→ Phase 2 (Claude Agents)
                            │         │
                            │         ├──→ Phase 3 (BAS/GST)
                            │         │         │
                            └─────────┴─────────┴──→ Phase 4 (Cross-Account)
```

- Phase 2 depends on Phase 1 (agents need Cognee for knowledge graph queries)
- Phase 3 depends on Phase 2 (GSTCalculator agent must be operational)
- Phase 4 depends on Phase 2 (CrossAccountTracer agent) but can start UI work in parallel

---

## Reference Documents

| Document | Content |
|----------|---------|
| `docs/AGENT_ARCHITECTURE.md` | 6 agent specifications, orchestrator pattern, migration plan, I/O contracts |
| `docs/COGNEE_INTEGRATION.md` | Knowledge graph schema, Docker setup, integration layer, dataset specs |
| `docs/FEATURE_SPEC.md` | 20+ features with user stories, UI mockups, API endpoints, data models |
| `docs/GST_BAS_RULES.md` | Complete ATO GST rules, BAS labels, category mappings, edge cases |

---

*Generated: February 2026*
*Team: architect, cognee-engineer, bas-designer*
