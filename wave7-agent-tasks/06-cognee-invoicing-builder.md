# Agent 6: Cognee Invoicing Datasets Builder

## Role
Configure Cognee datasets and CogneeTools methods for the invoicing domain — customer profiles and invoice history.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add invoicing domain datasets and index/search methods

#### Add to COGNEE_DATASETS constant:
```typescript
// Invoicing domain (Wave 7)
customerProfiles: 'customer_profiles',
invoiceHistory: 'invoice_history',
```

#### Add new methods to CogneeTools class:

- [ ] `indexCustomerProfile(customer: { id: string; businessName: string; abn?: string; email?: string; paymentTerms: number; notes?: string }): Promise<void>`
  - Format customer data as descriptive text
  - Index into `customer_profiles` dataset
  - Use `CHUNKS` search type (vector similarity for customer lookup)
  - Text format: `Customer: {businessName}, ABN: {abn}, Email: {email}, Payment Terms: {paymentTerms} days. Notes: {notes}`

- [ ] `searchCustomers(query: string, topK?: number): Promise<string[]>`
  - Search `customer_profiles` dataset
  - Uses `CHUNKS` search type for similarity matching
  - Default topK = 5

- [ ] `indexInvoice(invoice: { id: string; invoiceNumber: string; customerName: string; totalCents: number; gstCents: number; status: string; issueDate: string; dueDate: string; lineItems: string[] }): Promise<void>`
  - Format invoice data as descriptive text
  - Index into `invoice_history` dataset
  - Use `GRAPH_COMPLETION` for relationship reasoning
  - Text format: `Invoice {invoiceNumber} to {customerName}: ${total/100} AUD (GST: ${gst/100}), Status: {status}, Issued: {issueDate}, Due: {dueDate}. Items: {lineItems.join(', ')}`

- [ ] `searchInvoiceHistory(query: string, topK?: number): Promise<string[]>`
  - Search `invoice_history` dataset
  - Uses `GRAPH_COMPLETION` search type for relationship-aware reasoning
  - Default topK = 10

#### Add to `_moduleToDataset()` mapping:
```typescript
'customers': COGNEE_DATASETS.customerProfiles,
'invoicing': COGNEE_DATASETS.invoiceHistory,
```

### 2. `server/src/services/cognee_client.ts`
**Purpose**: No structural changes needed — existing `add()` and `search()` methods support new datasets

However, verify that:
- [ ] The `add()` method works with the new dataset names
- [ ] The `search()` method works with `CHUNKS` and `GRAPH_COMPLETION` search types
- [ ] Dataset prefixing via `prefixDataset()` applies correctly

### 3. Create new Cognee ontology for invoicing (optional but recommended)

Add to the ontology definitions (either in `cognee-ontologies.ts` or as seed data):

**Customer Ontology**:
```typescript
{
  name: 'Customer',
  description: 'Customer invoicing relationship graph',
  nodeTypes: [
    { name: 'Customer', properties: ['businessName', 'abn', 'paymentTerms'] },
    { name: 'Invoice', properties: ['invoiceNumber', 'totalAmount', 'status', 'dueDate'] },
    { name: 'Payment', properties: ['amount', 'paymentDate', 'method'] }
  ],
  edgeTypes: [
    { name: 'BILLED_TO', from: 'Invoice', to: 'Customer' },
    { name: 'PAID_BY', from: 'Payment', to: 'Invoice' },
    { name: 'CREDITED_TO', from: 'Invoice', to: 'Customer', description: 'Credit note relationship' }
  ]
}
```

## Verification
- [ ] `COGNEE_DATASETS.customerProfiles` resolves to `'customer_profiles'`
- [ ] `COGNEE_DATASETS.invoiceHistory` resolves to `'invoice_history'`
- [ ] `indexCustomerProfile()` calls `cogneeClient.add()` with correct dataset
- [ ] `searchCustomers()` calls `cogneeClient.search()` with CHUNKS type
- [ ] `indexInvoice()` calls `cogneeClient.add()` with correct dataset
- [ ] `searchInvoiceHistory()` calls `cogneeClient.search()` with GRAPH_COMPLETION type
- [ ] `_moduleToDataset('customers')` returns `'customer_profiles'`
- [ ] `_moduleToDataset('invoicing')` returns `'invoice_history'`
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-06`

## Dependencies
- **Agent 1**: Schema must exist for type references
- **Existing**: CogneeTools class pattern, CogneeClient HTTP methods
