# Agent 6: Cognee Payment Patterns Builder

## Role
Configure the Cognee dataset and CogneeTools methods for the payment patterns domain.

## Priority: SUB-WAVE 1 (No dependencies — runs in parallel with Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add payment pattern dataset and index/search methods

#### Add to COGNEE_DATASETS constant:
```typescript
// Payment domain (Wave 8)
paymentPatterns: 'payment_patterns',
```

#### Add new methods to CogneeTools class:

- [ ] `indexPaymentPattern(pattern: { invoiceId: string; customerId: string; customerName: string; amountCents: number; paymentMethod: string; daysToPayment: number; isRecurring: boolean; frequency?: string }): Promise<void>`
  - Format payment data as descriptive text for Cognee indexing
  - Index into `payment_patterns` dataset
  - Use `GRAPH_COMPLETION` search type (relationship reasoning for payment behavior)
  - Text format: `Payment for Invoice ${invoiceId} from ${customerName}: $${amountCents/100} AUD via ${paymentMethod}, took ${daysToPayment} days. Recurring: ${isRecurring}${frequency ? ', ' + frequency : ''}`

- [ ] `searchPaymentPatterns(query: string, topK?: number): Promise<string[]>`
  - Search `payment_patterns` dataset
  - Uses `GRAPH_COMPLETION` search type for relationship-aware reasoning about payment behavior
  - Default topK = 10

#### Add to `_moduleToDataset()` mapping:
```typescript
'payments': COGNEE_DATASETS.paymentPatterns,
```

### 2. `server/src/services/cognee_client.ts`
**Purpose**: No structural changes needed — existing `add()` and `search()` methods support new datasets

However, verify that:
- [ ] The `add()` method works with the new `payment_patterns` dataset name
- [ ] The `search()` method works with `GRAPH_COMPLETION` search type
- [ ] Dataset prefixing via `prefixDataset()` applies correctly

### 3. Extend invoice_agent tools (optional — in `server/src/services/claude/agents/invoice-agent.ts`)

Add a new tool to the invoice agent:
```typescript
{
  name: 'search_payment_patterns',
  description: 'Search payment history patterns for a customer or across all customers',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language query about payment patterns' }
    },
    required: ['query']
  }
}
```

With handler:
```typescript
case 'search_payment_patterns':
  return await cogneeTools.searchPaymentPatterns(input.query);
```

## Verification
- [ ] `COGNEE_DATASETS.paymentPatterns` resolves to `'payment_patterns'`
- [ ] `indexPaymentPattern()` calls `cogneeClient.add()` with correct dataset
- [ ] `searchPaymentPatterns()` calls `cogneeClient.search()` with GRAPH_COMPLETION type
- [ ] `_moduleToDataset('payments')` returns `'payment_patterns'`
- [ ] Invoice agent has `search_payment_patterns` tool (if extending agent)
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-06`

## Dependencies
- **None within Wave 8**: Cognee changes are independent of schema
- **Existing**: CogneeTools class pattern, CogneeClient HTTP methods must be available
