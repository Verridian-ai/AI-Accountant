# Agent 2: Intent Router Builder

## Role
Create the IntentRouter service that classifies user chat queries into intent categories and selects the appropriate agent(s) for handling.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/claude/intent-router.ts`
**Purpose**: Classify user chat queries into structured intents and route to the correct agent(s)
**Pattern**: Follow the ClaudeAgent pattern for Anthropic SDK usage, but this is a standalone service (not a ClaudeAgent subclass)

#### Key Interface:
```typescript
export interface IntentClassification {
  intent: 'agent_invocation' | 'direct_question' | 'transaction_edit' | 'batch_operation' | 'multi_agent';
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;        // 0-1 confidence score
  reasoning: string;         // Why this agent was selected
  extractedParams: Record<string, unknown>;  // Extracted entities (dates, amounts, account names, etc.)
}
```

#### Intent Categories:
| Intent | Description | Example Queries |
|--------|-------------|----------------|
| `agent_invocation` | Direct agent call with parameters | "Calculate BAS for Q2 2024-25", "Generate P&L for January" |
| `direct_question` | Factual Q answerable from DB/Cognee | "How much did I spend on fuel?", "What's my savings rate?" |
| `transaction_edit` | Single mutation request | "Recategorize this as Office Supplies", "Mark as personal" |
| `batch_operation` | Bulk operation | "Categorize all uncategorized transactions" |
| `multi_agent` | Multi-step workflow requiring multiple agents | "Prepare my BAS", "Run end-of-year tax review" |

#### Agent Mapping Matrix:
| User Intent Pattern | Primary Agent | Secondary Agents |
|---------------------|--------------|-----------------|
| BAS / GST calculation | `gst_calculator` | `transaction_categorizer` |
| Spending analysis | `budget_analyzer` | — |
| Categorize transactions | `transaction_categorizer` | `merchant_intelligence` |
| Reconcile accounts | `account_reconciler` | `cross_account_tracer` |
| Tax strategy/advice | `tax_strategy` | `personal_tax_claims` |
| Financial reporting (P&L, balance sheet) | `financial_reporting` | — |
| Payroll questions | `payroll_agent` | — |
| Compliance checks | `compliance_monitoring` | — |
| Cash flow forecast | `forecasting` | — |
| Document processing | `ocr_processing` | `payment_matching` |
| Depreciation/assets | `asset_management` | — |
| Inventory questions | `inventory_agent` | — |
| Budget creation/variance | `budgeting` | — |
| Entity consolidation | `multi_entity` | — |
| Financial planning | `financial_planner` | — |
| Merchant resolution | `merchant_intelligence` | — |
| Transfer tracing | `cross_account_tracer` | — |
| Bank reconciliation | `bank_reconciler_agent` | — |

#### Implementation Details:

**REVISION NOTE (D01-CRIT-05): IntentRouter MUST dynamically discover agents from the orchestrator registry, NOT use a hardcoded list.** The system prompt listing all agents MUST be generated at runtime by calling `orchestrator.getRegisteredAgents()` (or equivalent). This ensures that new agents added in future waves (e.g., `invoice_agent` in Wave 7, `accounts_payable_agent` in Wave 10) are automatically available for routing without modifying the IntentRouter code.

```typescript
export class IntentRouter {
  private client: Anthropic;
  private orchestrator: any; // REVISION: Accept orchestrator reference for dynamic agent discovery

  constructor(orchestrator?: any) {
    // Use singleton Anthropic client from client.ts
    // REVISION: Store orchestrator reference for getRegisteredAgents()
    this.orchestrator = orchestrator;
  }

  /**
   * REVISION (D01-CRIT-05): Build the agent list portion of the system prompt
   * dynamically from the orchestrator's registry. Falls back to a static list
   * if orchestrator is not available (e.g., during testing).
   */
  private buildAgentListPrompt(): string {
    if (this.orchestrator && typeof this.orchestrator.getRegisteredAgents === 'function') {
      const agents = this.orchestrator.getRegisteredAgents();
      return agents.map((a: { type: string; description: string }) =>
        `- ${a.type}: ${a.description}`
      ).join('\n');
    }
    // Fallback to static list (for testing / backward compat only)
    return this.getStaticAgentList();
  }

  async classify(
    query: string,
    context?: {
      recentTransactions?: number;
      accountIds?: string[];
      hasUnprocessedStatements?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<IntentClassification> {
    // Uses Haiku for fast, cheap classification (~100ms, ~$0.001 per call)
    // REVISION: System prompt is DYNAMICALLY GENERATED from orchestrator registry
    // Returns structured JSON classification
    // Confidence threshold: if < 0.6, fallback to budget_analyzer (general analysis)
  }
}
```

- [ ] Import `Anthropic` from `client.ts` singleton
- [ ] Import `AgentType` from `types.ts`
- [ ] Use `claude-haiku-4-5-20251001` model for classification (fast + cheap)
- [ ] System prompt must list ALL 21+ agents with their purpose/capabilities
- [ ] Parse agent response as JSON — strip markdown fences if present
- [ ] Handle classification failure gracefully — default to `budget_analyzer` with low confidence
- [ ] Export `IntentRouter` class and `IntentClassification` interface
- [ ] Include `INTENT_CONFIDENCE_THRESHOLD` constant (default 0.6)
- [ ] Add conversation context support for multi-turn routing

#### System Prompt Template (for the Haiku classifier):
```
You are an intent classifier for the GoldLedger AI accounting platform.

Available agents and their capabilities:
- statement_parser: Parse PDF bank statements into structured transactions
- transaction_categorizer: Categorize transactions into accounting categories with GST
- gst_calculator: Calculate BAS, GST, PAYG withholding per ATO rules
- merchant_intelligence: Resolve merchant names, lookup ABN/GST registration
- tax_strategy: ATO-compliant tax minimization strategies
- personal_tax_claims: Identify personal tax deduction claims (WFH, vehicle, etc.)
- financial_planner: Financial planning, debt strategies, wealth projections
- budget_analyzer: Spending analysis, budget tracking, anomaly detection
- account_reconciler: Statement-to-statement balance reconciliation
- cross_account_tracer: Inter-account fund flow tracing
- payroll_agent: Wage detection, PAYG calculation, ATO tax tables
- inventory_agent: Stock tracking, COGS calculation, reorder suggestions
- bank_reconciler_agent: Bank-to-ledger matching with confidence scoring
- ocr_processing: Extract data from scanned documents using Vision API
- payment_matching: Match OCR documents to bank transactions
- asset_management: ATO Div 40 depreciation, instant write-off calculation
- multi_entity: Multi-entity consolidation, intercompany transactions
- financial_reporting: AASB-compliant P&L, balance sheet, cash flow, trial balance
- budgeting: Budget creation from history, variance analysis, forecasting
- forecasting: Cash flow forecasting, seasonal patterns, scenario analysis
- compliance_monitoring: ATO deadline tracking, risk detection, obligation checks

Classify the user's query and respond with JSON only:
{
  "intent": "agent_invocation|direct_question|transaction_edit|batch_operation|multi_agent",
  "primaryAgent": "<agent_type>",
  "secondaryAgents": ["<agent_type>", ...],
  "confidence": 0.0-1.0,
  "reasoning": "<brief explanation>",
  "extractedParams": { <any extracted dates, amounts, categories, etc.> }
}
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] IntentRouter correctly classifies "Calculate BAS for Q2" → `gst_calculator`
- [ ] IntentRouter correctly classifies "How much did I spend on fuel?" → `budget_analyzer`
- [ ] IntentRouter correctly classifies "Categorize my transactions" → `transaction_categorizer`
- [ ] Low-confidence queries default to `budget_analyzer`
- [ ] `IntentClassification` interface is properly exported
- [ ] REVISION: System prompt agent list is DYNAMICALLY GENERATED from orchestrator registry (not hardcoded)
- [ ] REVISION: `buildAgentListPrompt()` method exists and calls `orchestrator.getRegisteredAgents()` when available
- [ ] Create marker file: `.agent-done-W01-02` (REVISION: zero-padded per D04/D05)

## Dependencies
- **None** — can start immediately
- **Reuses**: `client.ts` (Anthropic singleton), `types.ts` (AgentType union)
