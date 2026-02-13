# Agent 5: AP Agent Builder

## Role
Create the `accounts_payable_agent` Claude agent following the `ClaudeAgent<TInput, TOutput>` abstract base class pattern, and register it in the type system, config, and orchestrator.

## Priority: WAVE 10 (After Agents 2, 3, 4)

## Files to CREATE

### 1. `server/src/services/claude/agents/accounts-payable-agent.ts`
**Purpose**: Claude AI agent for accounts payable operations
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` EXACTLY

**Class**: `AccountsPayableAgent extends ClaudeAgent<AccountsPayableInput, AccountsPayableOutput>`

**System prompt** (key instructions for the agent):
```
You are an Accounts Payable specialist for an Australian small business accounting platform.
You help manage supplier bills, purchase orders, and payment scheduling.

Key capabilities:
- Enter and manage supplier bills with line items and GST
- Create and track purchase orders through their lifecycle
- Perform three-way matching (PO → goods receipt → supplier bill)
- Generate AP aging reports
- Schedule and process batch supplier payments
- Search historical vendor bills and patterns

Australian business context:
- GST rate is 10% for standard supplies
- ABN (Australian Business Number) identifies suppliers
- BAS reporting requires accurate GST tracking on purchases
- Payment terms typically 7, 14, 30, or 60 days
- Bank transfers use BSB + account number format
```

**Tools** (7 tools):

- [ ] `enter_bill` — Enter a new supplier bill
  - Input: `{ supplierId: string, billNumber?: string, issueDate: string, dueDate: string, lineItems: Array<{description, quantity, unitPriceCents, gstRate?}> }`
  - Handler: `billService.createBill()`
  - Returns: Created bill summary

- [ ] `create_purchase_order` — Create a new PO
  - Input: `{ supplierId: string, expectedDate?: string, lineItems: Array<{description, quantity, unitPriceCents}> }`
  - Handler: `purchaseOrderService.createPurchaseOrder()`
  - Returns: Created PO with number

- [ ] `match_po_to_bill` — Three-way matching
  - Input: `{ poId: string, billId: string }`
  - Handler: `purchaseOrderService.threeWayMatch()`
  - Returns: Match result with discrepancies

- [ ] `schedule_payment` — Create payment run for approved bills
  - Input: `{ billIds: string[], paymentDate: string }`
  - Handler: `purchaseOrderService.createPaymentRun()`
  - Returns: Payment run summary

- [ ] `generate_aging_report` — AP aging analysis
  - Input: `{ asOfDate?: string }`
  - Handler: `billService.getAPAging()`
  - Returns: Aging buckets with totals

- [ ] `approve_payment_batch` — Process a payment run
  - Input: `{ paymentRunId: string }`
  - Handler: `purchaseOrderService.processPaymentRun()`
  - Returns: Processed run results

- [ ] `search_vendor_bills` — Search bill history via Cognee
  - Input: `{ query: string, supplierId?: string }`
  - Handler: `cogneeTools.searchBillPatterns(query)` + DB query
  - Returns: Matching bills and patterns

**Agent configuration**:
```typescript
// Model: Haiku 4.5 for high-volume AP operations
model: 'claude-haiku-4-5-20251001'
maxToolCalls: 12
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
**Purpose**: Add AccountsPayableInput/Output interfaces and agent type

**Add to `AgentType` union**:
```typescript
| 'accounts_payable_agent'
```

**Add interfaces**:
```typescript
export interface AccountsPayableInput {
  userId: string;
  action: 'enter_bill' | 'create_po' | 'schedule_payment' | 'match_receipt' | 'aging_report' | 'approve_payment' | 'three_way_match';
  billId?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  amount?: number;
  dueDate?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPriceCents: number; gstRate?: number }>;
}

export interface AccountsPayableOutput {
  bill?: {
    id: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    gstCents: number;
    dueDate: string;
    status: string;
    purchaseOrderId?: string;
  };
  purchaseOrder?: {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    status: string;
    linesReceived: number;
    linesTotal: number;
  };
  agingReport?: {
    current: { count: number; totalCents: number };
    days30: { count: number; totalCents: number };
    days60: { count: number; totalCents: number };
    days90Plus: { count: number; totalCents: number };
  };
  threeWayMatch?: {
    poNumber: string;
    billNumber: string;
    receiptDate: string;
    poTotalCents: number;
    receiptTotalCents: number;
    billTotalCents: number;
    discrepancies: string[];
    matchStatus: 'matched' | 'discrepancy' | 'partial';
  };
  paymentSchedule?: Array<{ billId: string; supplierName: string; amountCents: number; scheduledDate: string }>;
  summary: string;
}
```

### 3. `server/src/services/claude/config.ts`
**Purpose**: Add token budgets and model selection for the new agent

**Add to `AGENT_TOKEN_BUDGETS`**:
```typescript
accounts_payable_agent: {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 12,
  warningThresholdPercent: 80,
},
```

**Add to `AGENT_MODELS`**:
```typescript
accounts_payable_agent: 'claude-haiku-4-5-20251001',
```

### 4. `server/src/services/claude/orchestrator.ts`
**Purpose**: Register the new agent in the orchestrator

**Add to `registerAgents()`**:
```typescript
this.agents.set('accounts_payable_agent', new AccountsPayableAgent(this.db));
```

**Add to `AgentInputMap`**:
```typescript
accounts_payable_agent: AccountsPayableInput;
```

**Add to `AgentOutputMap`**:
```typescript
accounts_payable_agent: AccountsPayableOutput;
```

**Add to intent router mapping** (if Wave 1 has been implemented):
```typescript
// "Pay bills", "What bills are due?", "Create PO" → accounts_payable_agent
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Agent class extends `ClaudeAgent<AccountsPayableInput, AccountsPayableOutput>`
- [ ] All 7 tools defined with proper input schemas
- [ ] Agent registered in orchestrator
- [ ] types.ts AgentType includes 'accounts_payable_agent'
- [ ] config.ts has token budgets and model for accounts_payable_agent
- [ ] Create marker file: `.agent-done-W10-05`

## Dependencies
- **Agents 2, 3, 4** must complete services (SupplierService, BillService, PurchaseOrderService)
- **Agent 6** should complete Cognee datasets (for search_vendor_bills tool)
- **Existing**: base-agent.ts, types.ts, config.ts, orchestrator.ts
