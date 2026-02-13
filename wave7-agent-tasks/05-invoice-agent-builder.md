# Agent 5: Invoice Agent Builder

## Role
Create the `invoice_agent` Claude agent following the ClaudeAgent<TInput, TOutput> pattern.

## Priority: SUB-WAVE 2 (After Agents 2, 3)

## Files to CREATE

### 1. `server/src/services/claude/agents/invoice-agent.ts`
**Purpose**: Claude agent for customer and invoice operations via natural language
**Pattern**: Follow `server/src/services/claude/agents/payroll-agent.ts` EXACTLY
**Base class**: `ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>` from `base-agent.ts`

#### Implementation:

- [ ] Import and extend `ClaudeAgent` from `../base-agent.js`
- [ ] Define `systemPrompt` — Australian invoicing expert, GST-aware, professional tone
- [ ] Define `tools` array (Anthropic.Tool format):

**Tool 1: `create_invoice`**
```typescript
{
  name: 'create_invoice',
  description: 'Create a new tax invoice for a customer with line items',
  input_schema: {
    type: 'object',
    properties: {
      customerId: { type: 'string', description: 'Customer ID' },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unitPriceCents: { type: 'integer' },
            gstRate: { type: 'number', default: 0.1 }
          },
          required: ['description', 'quantity', 'unitPriceCents']
        }
      },
      notes: { type: 'string' },
      dueDate: { type: 'string', description: 'ISO date string' }
    },
    required: ['customerId', 'lineItems']
  }
}
```

**Tool 2: `update_invoice_status`**
- Change invoice status (send, void)
- Input: invoiceId, action ('send' | 'void')

**Tool 3: `generate_pdf`**
- Generate PDF for an invoice
- Input: invoiceId
- Returns: pdfPath

**Tool 4: `list_customer_invoices`**
- List invoices for a specific customer
- Input: customerId, status filter (optional)

**Tool 5: `track_payment`**
- Record a payment against an invoice
- Input: invoiceId, amountCents, paymentDate, paymentMethod, reference

**Tool 6: `search_customers`**
- Search customers by name, ABN, or email
- Input: query string

**Tool 7: `search_cognee_invoices`**
- Search Cognee knowledge graph for invoice patterns
- Input: query string
- Uses CogneeTools.searchInvoiceHistory()

- [ ] Define `toolHandlers` Map with implementations for each tool
- [ ] Each handler calls the appropriate service (CustomerService or InvoicingService)
- [ ] Services accessed via constructor injection or lazy initialization

#### System Prompt:
```
You are an Australian invoicing assistant for GoldLedger. You help users:
- Create and manage customer records
- Generate professional tax invoices with correct GST calculations
- Track payments and outstanding balances
- Generate PDF invoices
- Search invoice history and customer information

Key rules:
- All amounts are in AUD (Australian Dollars)
- GST rate is 10% by default for GST-registered businesses
- Invoice numbers follow the INV-XXXXXX format
- Payment terms default to 30 days unless specified
- Always confirm amounts and details before creating invoices
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
**Add to AgentType union**:
```typescript
| 'invoice_agent'
```

**Add I/O interfaces**:
```typescript
export interface InvoiceAgentInput {
  userId: string;
  action: 'create_invoice' | 'update_invoice' | 'generate_pdf' | 'send_invoice' | 'track_payment' | 'list_overdue' | 'search_customers' | 'general_query';
  invoiceId?: string;
  customerId?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstApplicable?: boolean;
  }>;
  dueDate?: string;
  notes?: string;
  query?: string;
}

export interface InvoiceAgentOutput {
  invoice?: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    subtotalCents: number;
    gstCents: number;
    totalCents: number;
    status: string;
    issueDate: string;
    dueDate: string;
  };
  pdfUrl?: string;
  overdueInvoices?: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amountDueCents: number;
    daysPastDue: number;
  }>;
  customers?: Array<{
    id: string;
    businessName: string;
    outstandingCents: number;
  }>;
  summary: string;
}
```

### 3. `server/src/services/claude/config.ts`
**Add to AGENT_TOKEN_BUDGETS**:
```typescript
invoice_agent: {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 10,
  warningThresholdPercent: 80,
},
```

**Add to AGENT_MODELS** (or equivalent model mapping):
```typescript
invoice_agent: 'claude-haiku-4-5-20251001',
```

### 4. `server/src/services/claude/orchestrator.ts`
**Add to agent registration** in `registerAgents()`:
```typescript
this.agents.set('invoice_agent', new InvoiceAgent(/* dependencies */));
```

**Add to AgentInputMap and AgentOutputMap type mappings**:
```typescript
invoice_agent: InvoiceAgentInput;
// and
invoice_agent: InvoiceAgentOutput;
```

## Verification
- [ ] Agent implements ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>
- [ ] All 7 tools defined with correct input_schema
- [ ] All 7 tool handlers implemented
- [ ] AgentType union includes 'invoice_agent'
- [ ] Token budget and model configured in config.ts
- [ ] Agent registered in orchestrator.ts
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-05`

## Dependencies
- **Agent 2**: CustomerService must exist for customer search tools
- **Agent 3**: InvoicingService must exist for invoice CRUD tools
