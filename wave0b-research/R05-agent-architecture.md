# R05: Agent Architecture Analysis

## 1. Current Agent Inventory

### 1.1 Framework Architecture

The Claude agent system follows a **generic abstract base class pattern**:

```
ClaudeAgent<TInput, TOutput>  (abstract)
  ├─ systemPrompt: string      (abstract — role instructions)
  ├─ tools: Anthropic.Tool[]   (abstract — tool definitions)
  ├─ toolHandlers: Map<string, handler>  (abstract — tool implementations)
  └─ invoke(input: TInput) → TOutput & { usage: TokenUsage }
```

**Key design patterns:**
- **Agentic tool-use loop**: Sends `system + user message` → gets response → if tool_use blocks, executes them → continues until text-only response or budget exceeded
- **Per-tool circuit breaker**: Tools that fail 3 times consecutively are skipped
- **Budget enforcement**: `maxToolCalls` ceiling per agent, tracked in `TokenUsage`
- **JSON output parsing**: Strips markdown code fences, extracts JSON objects
- **Retry with backoff**: `retryWithBackoff()` wraps API calls (3 retries, exponential + jitter)
- **Agent circuit breaker**: `AgentCircuitBreaker` class (5 failures → trip, 60s recovery)

**Framework files:**
| File | Purpose |
|------|---------|
| `base-agent.ts` | `ClaudeAgent<TInput, TOutput>` abstract class |
| `client.ts` | Singleton `Anthropic` SDK client |
| `config.ts` | Token budgets, model selection, feature flags |
| `types.ts` | `AgentType` union, all I/O interfaces |
| `orchestrator.ts` | `AgentOrchestrator` — registry, typed invoke, processStatement pipeline |
| `retry.ts` | `retryWithBackoff()` + `AgentCircuitBreaker` |
| `cognee-tools.ts` | `CogneeTools` class — search, index, cognify wrappers |

### 1.2 All 21 Registered Agents

| # | AgentType | Model | Max Tools | Key Tools | System Prompt Summary |
|---|-----------|-------|-----------|-----------|----------------------|
| 1 | `statement_parser` | Sonnet 4.5 | 10 | detect_bank, parse_with_bank_parser, extract_account_info, validate_transactions, search_cognee | Parses AU bank statement PDFs → structured transactions |
| 2 | `transaction_categorizer` | Haiku 4.5 | 5 | lookup_merchant_memory, search_similar_transactions, get_category_taxonomy, search_transaction_patterns, temporal_categorization_search, batch_categorize | Categorizes transactions into 40+ categories with GST |
| 3 | `gst_calculator` | Sonnet 4.5 | 8 | classify_gst_supply, calculate_input_tax_credit, calculate_gst_from_inclusive, generate_bas_labels, identify_capital_purchases, get_quarter_dates, calculate_payg_withholding, search_tax_events, temporal_gst_search, lookup_gst_ruling | Calculates GST/BAS per ATO rules |
| 4 | `account_reconciler` | Haiku 4.5 | 8 | find_duplicates, verify_balance_continuity, find_unmatched, detect_transfers, check_running_balance, search_historical_patterns | Statement-to-statement reconciliation |
| 5 | `budget_analyzer` | Sonnet 4.5 | 8 | analyze_spending_by_category, identify_recurring, calculate_monthly_averages, project_balance, find_anomalies, search_financial_context, calculate_savings_rate | Spending analysis, projections, anomaly detection |
| 6 | `cross_account_tracer` | Haiku 4.5 | 6 | match_transfers, detect_multi_hop, calculate_net_flows, generate_flow_diagram, exclude_transfers, explore_relationship_graph, temporal_transfer_search, search_transfer_patterns | Inter-account fund flow tracing |
| 7 | `merchant_intelligence` | Haiku 4.5 | 15 | search_cognee_merchant, resolve_merchant_name, lookup_abn, infer_category, store_merchant_mapping, explore_merchant_graph, get_merchant_ontology_context, merchant_timeline, batch_resolve | Merchant name resolution, ABN/GST lookup |
| 8 | `payroll_agent` | Sonnet 4.5 | 15 | detect_wage_payment, calculate_payg_withholding, search_payroll_history, store_payroll_pattern | Wage detection, PAYG calc, ATO tax tables |
| 9 | `tax_strategy` | Sonnet 4.5 | 15 | analyze_entity_structure, calculate_tax_scenarios, search_tax_rulings, generate_strategies, explore_tax_ontology, search_deduction_precedents, temporal_tax_search, cross_module_tax_impact, search_financial_context | ATO-compliant tax minimization strategies |
| 10 | `personal_tax_claims` | Haiku 4.5 | 10 | scan_transactions, check_substantiation, calculate_claim, search_deduction_precedents, search_cognee | Personal deduction identification (WFH, vehicle, etc.) |
| 11 | `financial_planner` | Sonnet 4.5 | 12 | analyze_spending, wealth_projection, debt_strategy, budget_recommendation, search_financial_context | Financial planning, debt strategies |
| 12 | `inventory_agent` | Haiku 4.5 | 10 | check_stock_levels, calculate_cogs, suggest_reorder, inventory_valuation, search_inventory_catalog | Inventory management, COGS, reorder |
| 13 | `bank_reconciler_agent` | Sonnet 4.5 | 15 | find_matches, score_match, apply_rules, learn_patterns, search_recon_patterns | Bank-to-ledger matching with confidence scoring |
| 14 | `ocr_processing` | Sonnet 4.5 | 10 | extract_document_data, classify_document, extract_line_items, validate_extraction | Document OCR via Claude Vision API |
| 15 | `payment_matching` | Haiku 4.5 | 12 | find_match_candidates, score_match, apply_rules, learn_pattern | OCR document → bank transaction matching |
| 16 | `asset_management` | Haiku 4.5 | 12 | calculate_depreciation, check_write_off, recommend_method, generate_schedule, search_asset_register | ATO Div 40 depreciation, instant write-off |
| 17 | `multi_entity` | Sonnet 4.5 | 15 | detect_entity, match_inter_entity, calculate_eliminations, consolidate, search_entity_hierarchy | Multi-entity consolidation, Div 7A |
| 18 | `financial_reporting` | Sonnet 4.5 | 15 | generate_pnl, generate_balance_sheet, generate_cash_flow, generate_trial_balance, compare_periods | AASB-compliant financial statements |
| 19 | `budgeting` | Sonnet 4.5 | 12 | create_budget_from_history, calculate_variance, generate_forecast, suggest_adjustments | Budget creation, variance analysis, forecasting |
| 20 | `forecasting` | Sonnet 4.5 | 12 | analyze_historical_patterns, temporal_forecast_search, cross_module_forecast_context, detect_seasonality, generate_forecast | Cash flow forecasting, seasonal patterns |
| 21 | `compliance_monitoring` | Sonnet 4.5 | 12 | check_obligations, assess_risks, generate_timeline, temporal_compliance_search, cross_module_compliance_context | ATO deadline tracking, risk detection |

### 1.3 Model Distribution

| Model | Count | Use Case |
|-------|-------|----------|
| Sonnet 4.5 (`claude-sonnet-4-5-20250929`) | 13 | Complex reasoning: parsing, GST, tax, financial reporting, reconciliation, compliance |
| Haiku 4.5 (`claude-haiku-4-5-20251001`) | 8 | High-volume/low-cost: categorization, merchant resolution, inventory, payment matching, asset mgmt |

### 1.4 Orchestrator (`orchestrator.ts`)

The `AgentOrchestrator` is a **singleton** class with:

1. **`registerAgents()`**: Creates all 21 agent instances in a `Map<AgentType, ClaudeAgent>`
2. **`invoke<T>(agentType, input)`**: Type-safe generic invocation with:
   - Feature flag check (`USE_CLAUDE_AGENTS` + per-agent `AGENT_*`)
   - Circuit breaker wrapping
   - SSE progress events (`started`, `completed`, `error`)
3. **`processStatement()`**: Sequential pipeline: `statement_parser` → `transaction_categorizer` → `gst_calculator`
4. **`analyze()`**: Simple routing — currently hardcoded to `budget_analyzer` (this is the gap!)

**Critical observation**: `analyze()` is the only "routing" method and it's a stub. There is NO intent classification, NO query-to-agent mapping, NO multi-agent routing. All agent invocations are explicit.

### 1.5 Cognee Tools (`cognee-tools.ts`)

The `CogneeTools` class provides **32 Cognee dataset domains** and **~40 methods**:

| Category | Methods | Datasets |
|----------|---------|----------|
| Core search | `search()`, `index()`, `cognify()`, `indexAndCognify()` | Any |
| Tax | `indexTaxStrategies()`, `searchTaxRulings()` | tax_strategies, tax_rulings |
| Economic | `searchEconomicData()` | economic_indicators |
| Inventory | `indexInventoryItems()`, `searchInventoryCatalog()`, `indexStockMovements()`, `searchStockPatterns()` | inventory_catalog, stock_movements |
| Reconciliation | `indexReconPatterns()`, `searchReconPatterns()` | recon_patterns |
| Assets | `indexAssetRegister()`, `indexDepreciationSchedule()`, `searchAssetRegister()`, `searchDepreciationSchedules()` | asset_register, depreciation_schedules |
| Multi-Entity | `indexEntityHierarchy()`, `indexConsolidationPatterns()`, `searchEntityHierarchy()`, `searchConsolidationPatterns()` | entity_hierarchy, consolidation_patterns |
| OCR/Matching | `indexOCRExtraction()`, `indexMatchingPattern()`, `searchOCRExtractions()`, `searchMatchingPatterns()`, `batchIndexMatchingPatterns()` | ocr_extractions, matching_patterns |
| DataPoint/Ontology | `searchWithDataPoint()`, `searchWithOntology()`, `submitSearchFeedback()`, `exploreGraph()` | Per-type mapping |
| Financial Reporting | `indexReportSnapshot()`, `indexBudgetTemplate()`, `indexKPISnapshot()`, `searchFinancialReports()`, `searchBudgetTemplates()`, `searchKPIHistory()` | financial_reports, budget_templates, kpi_history |
| Temporal | `temporalSearch()`, `crossModuleSearch()`, `searchTimeline()`, `indexCrossModuleInsight()` | temporal_patterns, cross_module_insights, module_relationships |

---

## 2. New Agents Required by Waves 1-10

### 2.1 Wave 7: `invoice_agent`

**Purpose**: Customer and invoice CRUD, PDF generation, accounts receivable management.

```typescript
// New AgentType entry
'invoice_agent'

// I/O interfaces
interface InvoiceAgentInput {
  userId: string;
  action: 'create_invoice' | 'update_invoice' | 'generate_pdf' | 'send_invoice' | 'track_payment' | 'list_overdue';
  invoiceId?: string;
  customerId?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstApplicable: boolean;
  }>;
  dueDate?: string;
  notes?: string;
}

interface InvoiceAgentOutput {
  invoice?: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    lineItems: Array<{ description: string; quantity: number; unitPriceCents: number; gstCents: number; totalCents: number }>;
    subtotalCents: number;
    gstCents: number;
    totalCents: number;
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    issueDate: string;
    dueDate: string;
  };
  pdfUrl?: string;
  overdueInvoices?: Array<{ invoiceId: string; customerName: string; amountCents: number; daysPastDue: number }>;
  summary: string;
}
```

**Model**: Haiku 4.5 (CRUD operations, low reasoning)
**Max Tool Calls**: 10
**Tools**: `create_invoice`, `update_invoice_status`, `generate_pdf`, `send_email`, `list_customer_invoices`, `track_payment`, `search_cognee_invoices`
**Cognee datasets**: `invoice_patterns`, `customer_history`

### 2.2 Wave 10: `accounts_payable_agent`

**Purpose**: Bill management, purchase order tracking, payment scheduling.

```typescript
// New AgentType entry
'accounts_payable_agent'

interface AccountsPayableInput {
  userId: string;
  action: 'enter_bill' | 'create_po' | 'schedule_payment' | 'match_receipt' | 'aging_report' | 'approve_payment';
  billId?: string;
  vendorId?: string;
  purchaseOrderId?: string;
  amount?: number;
  dueDate?: string;
}

interface AccountsPayableOutput {
  bill?: {
    id: string;
    vendorId: string;
    vendorName: string;
    totalCents: number;
    gstCents: number;
    dueDate: string;
    status: 'draft' | 'approved' | 'scheduled' | 'paid' | 'overdue';
    purchaseOrderId?: string;
  };
  agingReport?: {
    current: { count: number; totalCents: number };
    days30: { count: number; totalCents: number };
    days60: { count: number; totalCents: number };
    days90Plus: { count: number; totalCents: number };
  };
  paymentSchedule?: Array<{ billId: string; vendorName: string; amountCents: number; scheduledDate: string }>;
  summary: string;
}
```

**Model**: Haiku 4.5 (CRUD + matching, moderate reasoning)
**Max Tool Calls**: 12
**Tools**: `enter_bill`, `create_purchase_order`, `match_po_to_bill`, `schedule_payment`, `generate_aging_report`, `approve_payment_batch`, `search_vendor_bills`
**Cognee datasets**: `vendor_payment_patterns`, `po_history`

### 2.3 Wave 4-6: Enhanced `payroll_agent`

Not a new agent but needs significant tool additions for employee management:
- `add_employee`, `update_employee`, `terminate_employee`
- `generate_pay_run`, `process_single_time_pay`
- `calculate_stp_report`, `lodge_stp`
- `calculate_leave_entitlements`, `manage_leave_requests`

---

## 3. Agent Modifications Required (Per Wave)

### Wave 1: Orchestrator Intent Routing

**File**: `orchestrator.ts`

The `analyze()` method is currently a stub that always routes to `budget_analyzer`. Wave 1 must add:

1. **`routeAndDispatch(query, context)`** — Intent classification + agent selection
2. **Intent classification categories**:
   - `agent_invocation` — Direct agent call (e.g., "calculate BAS for Q2")
   - `direct_question` — Factual query answerable from data
   - `transaction_edit` — Mutation request (e.g., "recategorize this transaction")
   - `batch_operation` — Bulk operation (e.g., "categorize all uncategorized transactions")
   - `multi_agent` — Requires multiple agents (e.g., "prepare tax return" → categorizer + GST + tax_strategy)

3. **Agent mapping matrix**:

| User Intent | Primary Agent | Secondary Agents |
|-------------|--------------|-----------------|
| "Calculate BAS" | `gst_calculator` | `transaction_categorizer` |
| "What did I spend on X?" | `budget_analyzer` | — |
| "Categorize these transactions" | `transaction_categorizer` | `merchant_intelligence` |
| "Reconcile my accounts" | `account_reconciler` | `cross_account_tracer` |
| "Tax strategy advice" | `tax_strategy` | `personal_tax_claims` |
| "Generate P&L" | `financial_reporting` | — |
| "Payroll summary" | `payroll_agent` | — |
| "Check compliance" | `compliance_monitoring` | — |
| "Forecast cash flow" | `forecasting` | — |
| "Process this invoice" | `ocr_processing` | `payment_matching` |
| "Depreciation schedule" | `asset_management` | — |
| "Inventory status" | `inventory_agent` | — |
| "Create budget" | `budgeting` | — |
| "Entity consolidation" | `multi_entity` | — |
| "Financial plan" | `financial_planner` | — |

4. **Implementation approach**: Use a lightweight Haiku call with a system prompt listing all agents and their capabilities, returning a `{ primaryAgent: AgentType, secondaryAgents?: AgentType[], intent: string }` classification. This avoids hardcoded keyword matching and leverages LLM reasoning.

### Wave 2: Streaming + Mutation Tools

**File**: `base-agent.ts`

1. **Streaming callback support in `invoke()`**:
   ```typescript
   async invoke(
     input: TInput,
     callbacks?: {
       onToolCall?: (toolName: string, input: unknown) => void;
       onProgress?: (text: string) => void;
       onStreamChunk?: (chunk: string) => void;
     }
   ): Promise<TOutput & { usage: TokenUsage }>
   ```
   - Use `client.messages.stream()` instead of `client.messages.create()`
   - Emit SSE events for each tool call and text chunk
   - Enables real-time progress display in the UI

2. **Mutation tools for `transaction_categorizer` and `gst_calculator`**:
   - `update_transaction_category(transactionId, category, gstCategory)` — actually writes to DB
   - `confirm_gst_classification(transactionId, gstCategory, gstAmount)` — writes GST to DB
   - Currently these agents only return results; they don't mutate. Wave 2 adds DB write capability.

### Wave 3: Session-Aware Cognee Integration

**File**: `cognee-tools.ts` + all agents

1. Add `sessionId` parameter to all search/index methods
2. Use `CogneeSessionService` for Redis-cached session context
3. Allow agents to share context within a user session (e.g., categorizer results available to GST calculator)

### Wave 4-6: Payroll Agent Enhancements

**File**: `agents/payroll-agent.ts`

Add tools:
- `add_employee`, `update_employee`, `terminate_employee`
- `generate_pay_run`, `calculate_stp_report`
- `calculate_leave_entitlements`

Add I/O extensions:
```typescript
// Extend PayrollAgentInput
action?: 'detect_wages' | 'manage_employee' | 'generate_pay_run' | 'stp_report' | 'leave_calc';
employeeId?: string;
employeeData?: { ... };
```

### Wave 7: Invoice Agent (NEW)

Create `agents/invoice-agent.ts` implementing `ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>`.

### Wave 10: Accounts Payable Agent (NEW)

Create `agents/accounts-payable-agent.ts` implementing `ClaudeAgent<AccountsPayableInput, AccountsPayableOutput>`.

---

## 4. Intent Router Design

### 4.1 Current State

There is **NO intent router**. The current routing is:
- `orchestrator.processStatement()` — hardcoded pipeline (parser → categorizer → GST)
- `orchestrator.analyze()` — always routes to `budget_analyzer`
- `orchestrator.invoke(agentType, input)` — explicit agent selection by caller
- HTTP routes in `routes/agents.ts` — 4 explicit endpoints

### 4.2 Proposed Intent Router (Wave 1)

```typescript
// New file: server/src/services/claude/intent-router.ts

export interface IntentClassification {
  intent: 'agent_invocation' | 'direct_question' | 'transaction_edit' | 'batch_operation' | 'multi_agent';
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  extractedParams: Record<string, unknown>;
}

export class IntentRouter {
  private client: Anthropic;

  async classify(
    query: string,
    context: {
      recentTransactions?: number;
      accountIds?: number[];
      hasUnprocessedStatements?: boolean;
    }
  ): Promise<IntentClassification> {
    // Uses Haiku for fast, cheap classification
    // System prompt lists all 21+ agents with descriptions
    // Returns structured JSON classification
  }

  async routeAndDispatch(
    query: string,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const intent = await this.classify(query, context);

    // Single agent
    if (intent.secondaryAgents.length === 0) {
      return orchestrator.invoke(intent.primaryAgent, intent.extractedParams);
    }

    // Multi-agent pipeline
    let result = await orchestrator.invoke(intent.primaryAgent, intent.extractedParams);
    for (const secondary of intent.secondaryAgents) {
      result = await orchestrator.invoke(secondary, { ...intent.extractedParams, previousResult: result });
    }
    return result;
  }
}
```

### 4.3 Intent Categories

| Intent | Description | Example Queries |
|--------|-------------|----------------|
| `agent_invocation` | Direct agent call with parameters | "Calculate BAS for Q2 2024-25", "Generate P&L for January" |
| `direct_question` | Factual Q answerable from DB/Cognee | "How much did I spend on fuel?", "What's my savings rate?" |
| `transaction_edit` | Single mutation request | "Recategorize this as Office Supplies", "Mark as personal" |
| `batch_operation` | Bulk operation | "Categorize all uncategorized transactions", "Process all uploaded statements" |
| `multi_agent` | Multi-step workflow | "Prepare my BAS", "Run end-of-year tax review" |

---

## 5. Route Gap Analysis

### 5.1 Existing Routes (`routes/agents.ts`)

Mounted at `/api/claude-agents/`:

| Route | Method | Agent | Purpose |
|-------|--------|-------|---------|
| `/analyze` | POST | `budget_analyzer` | General analysis query |
| `/bas/calculate` | POST | `gst_calculator` | BAS calculation for a quarter |
| `/reconcile` | POST | `account_reconciler` | Account reconciliation |
| `/transfers/analyze` | POST | `cross_account_tracer` | Cross-account transfer analysis |

**Only 4 of 21 agents have HTTP routes.**

### 5.2 Missing Routes (17 agents without routes)

| Agent | Proposed Route | Priority |
|-------|---------------|----------|
| `transaction_categorizer` | `POST /api/claude-agents/categorize` | **Wave 1** |
| `merchant_intelligence` | `POST /api/claude-agents/merchants/resolve` | **Wave 1** |
| `payroll_agent` | `POST /api/claude-agents/payroll/analyze` | **Wave 1** |
| `tax_strategy` | `POST /api/claude-agents/tax/strategy` | **Wave 1** |
| `personal_tax_claims` | `POST /api/claude-agents/tax/claims` | **Wave 1** |
| `financial_planner` | `POST /api/claude-agents/financial-plan` | **Wave 1** |
| `statement_parser` | `POST /api/claude-agents/parse` | **Wave 1** |
| `inventory_agent` | `POST /api/claude-agents/inventory` | Wave 2 |
| `bank_reconciler_agent` | `POST /api/claude-agents/bank-recon` | Wave 2 |
| `ocr_processing` | `POST /api/claude-agents/documents/process` | Wave 2 |
| `payment_matching` | `POST /api/claude-agents/matches/find` | Wave 2 |
| `asset_management` | `POST /api/claude-agents/assets` | Wave 3 |
| `multi_entity` | `POST /api/claude-agents/entities` | Wave 3 |
| `financial_reporting` | `POST /api/claude-agents/reports` | Wave 3 |
| `budgeting` | `POST /api/claude-agents/budgets` | Wave 3 |
| `forecasting` | `POST /api/claude-agents/forecasts` | Wave 3 |
| `compliance_monitoring` | `POST /api/claude-agents/compliance` | Wave 3 |

### 5.3 New Routes Required for New Agents

| Agent | Route | Wave |
|-------|-------|------|
| `invoice_agent` | `POST /api/claude-agents/invoices` | Wave 7 |
| `accounts_payable_agent` | `POST /api/claude-agents/accounts-payable` | Wave 10 |

### 5.4 Generic Agent Dispatch Route (Wave 1)

**THE most important route** — a single endpoint that accepts any agent type:

```
POST /api/claude-agents/dispatch
Body: { agentType: AgentType, input: Record<string, unknown> }
```

This replaces the need for individual routes and works with the intent router:

```
POST /api/claude-agents/chat
Body: { query: string, context: { accountIds?: number[], dateRange?: { start, end } } }
Response: { result: unknown, agent: AgentType, intent: string }
```

---

## 6. Type System Changes

### 6.1 New AgentType Entries

```typescript
// Add to types.ts AgentType union:
export type AgentType =
  // ... existing 21 types ...
  | 'invoice_agent'          // Wave 7
  | 'accounts_payable_agent' // Wave 10
  ;
```

### 6.2 New I/O Interfaces Required

| Interface | Wave | Agent |
|-----------|------|-------|
| `InvoiceAgentInput` / `InvoiceAgentOutput` | Wave 7 | `invoice_agent` |
| `AccountsPayableInput` / `AccountsPayableOutput` | Wave 10 | `accounts_payable_agent` |
| `IntentClassification` | Wave 1 | `intent-router.ts` |
| `AgentDispatchInput` / `AgentDispatchOutput` | Wave 1 | Generic dispatch |

### 6.3 Orchestrator Type Map Updates

Both `AgentInputMap` and `AgentOutputMap` in `orchestrator.ts` must be extended:

```typescript
type AgentInputMap = {
  // ... existing 21 entries ...
  invoice_agent: InvoiceAgentInput;
  accounts_payable_agent: AccountsPayableInput;
};

type AgentOutputMap = {
  // ... existing 21 entries ...
  invoice_agent: InvoiceAgentOutput;
  accounts_payable_agent: AccountsPayableOutput;
};
```

### 6.4 Config Updates

Add to `AGENT_TOKEN_BUDGETS` and `AGENT_MODELS` in `config.ts`:

```typescript
invoice_agent: {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 10,
  warningThresholdPercent: 80,
},
accounts_payable_agent: {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 12,
  warningThresholdPercent: 80,
},
```

```typescript
invoice_agent: 'claude-haiku-4-5-20251001',
accounts_payable_agent: 'claude-haiku-4-5-20251001',
```

---

## 7. Architecture Strengths

1. **Clean generic pattern**: `ClaudeAgent<TInput, TOutput>` is well-designed and extensible
2. **Type-safe orchestrator**: `invoke<T>()` with mapped types prevents runtime type errors
3. **Per-agent feature flags**: `AGENT_*` env vars allow granular enable/disable
4. **Circuit breaker at two levels**: Per-tool (3 failures) and per-agent (5 failures)
5. **Cognee integration is comprehensive**: 32 datasets, 40+ methods, temporal + cross-module search
6. **SSE progress events**: Real-time feedback during agent execution

## 8. Architecture Weaknesses

1. **No intent routing**: `analyze()` is hardcoded to budget_analyzer; there's no query→agent mapping
2. **No streaming**: `invoke()` uses synchronous `messages.create()`, not streaming
3. **No mutation tools**: Agents return results but don't write to DB (pure read-only analysis)
4. **17 of 21 agents lack HTTP routes**: Most agents are only accessible programmatically
5. **No session awareness**: Agents don't share context within a user session
6. **No multi-agent pipelines**: Only `processStatement()` chains agents; no generic pipeline support
7. **All agents instantiated eagerly**: All 21 agents are created at startup regardless of feature flags
8. **`wrapPgDb()` returns `any`**: All DB queries in tool handlers are untyped at runtime
9. **Token budget not enforced for input**: Only output tokens and tool calls are tracked; input token budget is defined but never checked

## 9. Recommended Wave 1 Priorities

1. **Intent Router**: Create `intent-router.ts` with Haiku-based classification
2. **Generic dispatch route**: `POST /api/claude-agents/dispatch` + `POST /api/claude-agents/chat`
3. **7 high-priority agent routes**: categorize, merchants, payroll, tax, claims, financial-plan, parse
4. **Orchestrator update**: Replace `analyze()` stub with `routeAndDispatch()`

---

*Research completed by R05 Agent Architecture Analyzer — 2026-02-13*
