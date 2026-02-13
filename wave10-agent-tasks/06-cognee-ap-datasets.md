# Agent 6: Cognee AP Datasets Builder

## Role
Configure Cognee datasets for supplier profiles and bill patterns, and extend CogneeTools with AP-specific search and indexing methods.

## Priority: WAVE 10 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add AP dataset constants and methods to CogneeTools class
**Pattern**: Follow existing `indexReconPatterns()` / `searchReconPatterns()` method pattern

**Add to COGNEE_DATASETS constant**:
```typescript
supplier_profiles: 'supplier_profiles',
bill_patterns: 'bill_patterns',
```

**Add methods to CogneeTools class**:

- [ ] `indexSupplierProfile(supplier: SupplierProfileData): Promise<void>`
  - Format supplier data as structured text for Cognee indexing
  - Include: business name, ABN, contact details, payment terms, typical categories
  - Index into `supplier_profiles` dataset using CHUNKS search type
  - Use `addAndCognify()` with financial custom_prompt

- [ ] `searchSupplierProfiles(query: string, topK?: number): Promise<string[]>`
  - Search `supplier_profiles` dataset using CHUNKS
  - Fast vector similarity for: "Which supplier sells office supplies?", "Supplier with ABN 12345678901"
  - Returns top-K matching supplier descriptions

- [ ] `indexBillPattern(bill: BillPatternData): Promise<void>`
  - Format bill data as structured text
  - Include: supplier name, amounts, line items, frequency, payment timing
  - Index into `bill_patterns` dataset
  - Use `indexAndCognify()` with financial custom_prompt

- [ ] `searchBillPatterns(query: string, topK?: number): Promise<string[]>`
  - Search `bill_patterns` dataset using GRAPH_COMPLETION
  - Reasoning about: "What's our average monthly spend with supplier X?", "Recurring bill patterns"
  - Cross-reference with transaction data for payment matching

- [ ] `indexPurchaseOrderHistory(po: POHistoryData): Promise<void>`
  - Format PO data including line items, receiving, and matching status
  - Index into `bill_patterns` dataset (combined with bills for AP context)

- [ ] `searchAPContext(query: string, topK?: number): Promise<string[]>`
  - Multi-dataset search across supplier_profiles + bill_patterns
  - For complex queries: "What's our payment history with X supplier?"
  - Uses GRAPH_COMPLETION for reasoning across datasets

**Data interfaces for indexing**:
```typescript
interface SupplierProfileData {
  businessName: string;
  abn?: string;
  contactName?: string;
  email?: string;
  paymentTermsDays: number;
  typicalCategories: string[];
  averageSpendCents: number;
  paymentReliability: string; // 'excellent' | 'good' | 'fair' | 'poor'
}

interface BillPatternData {
  supplierName: string;
  billNumber: string;
  totalAmountCents: number;
  gstAmountCents: number;
  lineItems: Array<{ description: string; amountCents: number }>;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  daysToPay?: number;
}

interface POHistoryData {
  poNumber: string;
  supplierName: string;
  totalAmountCents: number;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  receivedDate?: string;
  matchedBillNumber?: string;
  matchStatus?: string;
}
```

**Search type selection**:
- `supplier_profiles` → CHUNKS (fast vector similarity for entity lookup)
- `bill_patterns` → GRAPH_COMPLETION (needs reasoning about spending patterns and trends)

### 2. `server/src/services/cognee_client.ts`
**Purpose**: No changes needed — existing `search()`, `add()`, `cognify()` methods are sufficient
**Note**: If Wave 3 has added per-user dataset prefixing, ensure AP dataset names use the prefix

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS.supplier_profiles` resolves to 'supplier_profiles'
- [ ] `COGNEE_DATASETS.bill_patterns` resolves to 'bill_patterns'
- [ ] `indexSupplierProfile()` successfully indexes supplier data
- [ ] `searchSupplierProfiles("office supplies vendor")` returns relevant results
- [ ] `searchBillPatterns("monthly spend patterns")` returns relevant results
- [ ] Create marker file: `.agent-done-W10-06`

## Dependencies
- **Agent 1** must complete schema (for type references)
- **Existing dependency**: CogneeTools class must exist
- **Runtime**: Cognee service must be healthy for indexing/search
