# Agent 4: Purchase Order Service Builder

## Role
Build the purchase order lifecycle service with auto-numbering, goods receiving, three-way matching (PO → receipt → bill), and batch payment run processing.

## Priority: WAVE 10 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/purchase-orders.ts`
**Purpose**: Purchase order lifecycle from creation through three-way matching and payment
**Pattern**: Follow `server/src/services/bills.ts` for service pattern

**Class**: `PurchaseOrderService`

**Methods**:

- [ ] `listPurchaseOrders(userId: string, options?: POListOptions): Promise<{ data: POWithSupplier[]; total: number }>`
  - Paginated with default page=1, limit=50
  - Filterable by: status, supplierId, dateRange
  - Include supplier businessName
  - Sort by issueDate DESC by default

- [ ] `getPurchaseOrder(poId: string): Promise<PODetail>`
  - Full PO with:
    - Line items (po_lines) with received quantities
    - Receipt history (po_receipts + po_receipt_lines)
    - Linked bills (if matched)
    - Receiving progress percentage

- [ ] `createPurchaseOrder(userId: string, data: CreatePOInput): Promise<PurchaseOrder>`
  - Generate UUID for PO and each line item
  - Auto-generate poNumber: PO-{NNNNNN} (padded 6 digits, incrementing)
  - Calculate line amounts: amount = quantity * unitPrice
  - Calculate totals: subtotal, gstAmount, totalAmount
  - Set status = 'draft'
  - Insert PO + po_lines atomically

- [ ] `updatePurchaseOrder(poId: string, data: UpdatePOInput): Promise<PurchaseOrder>`
  - Can only update draft POs
  - Recalculate totals if line items changed

- [ ] `sendPurchaseOrder(poId: string): Promise<PurchaseOrder>`
  - Transition: 'draft' → 'sent'
  - Mark issue date if not already set
  - In future: could email PO PDF to supplier

- [ ] `receiveGoods(poId: string, receipt: ReceiveGoodsInput): Promise<POReceipt>`
  - Create po_receipt + po_receipt_lines
  - Update po_lines.quantityReceived for each received line
  - Update PO status:
    - If ALL lines fully received: status = 'received'
    - If SOME lines partially received: status = 'partially_received'
  - Validate: cannot receive more than ordered quantity
  - Return receipt record with details

- [ ] `cancelPurchaseOrder(poId: string): Promise<PurchaseOrder>`
  - Transition to 'cancelled'
  - Cannot cancel if any goods have been received (partially_received or received)
  - Can cancel 'draft' or 'sent' POs

- [ ] `threeWayMatch(poId: string, billId: string): Promise<ThreeWayMatchResult>`
  - **THE CORE AP FEATURE**
  - **REVISION NOTE (D03 B5 — Three-Way Match Indexing)**: Three-way matching is O(n²) without indexes. Use SQL JOINs for matching, NOT multiple separate queries. The query should JOIN `purchase_orders → po_lines → po_receipt_lines → po_receipts` and compare with `bills → bill_lines` in a SINGLE query. Required indexes (must exist in migration 0022):
    - `po_receipts(purchase_order_id)` — already specified
    - `po_receipt_lines(po_line_id)` — **CRITICAL: was missing, now required**
    - `bill_lines(bill_id)` — already specified
  - Compare PO, receipt(s), and bill using efficient SQL JOIN:
    ```sql
    SELECT pol.id, pol.description, pol.quantity, pol.unit_price, pol.quantity_received,
           COALESCE(SUM(prl.quantity_received), 0) as total_received,
           bl.unit_price as bill_unit_price, bl.quantity as bill_quantity
    FROM po_lines pol
    LEFT JOIN po_receipt_lines prl ON prl.po_line_id = pol.id
    LEFT JOIN bill_lines bl ON bl.description = pol.description AND bl.bill_id = :billId
    WHERE pol.purchase_order_id = :poId
    GROUP BY pol.id, bl.id
    ```
    1. **Quantity match**: Sum of receipt quantities per PO line vs PO ordered quantities
    2. **Price match**: Bill line unit prices vs PO line unit prices (within tolerance)
    3. **Total match**: Bill total vs PO total (within configurable tolerance)
  - Return match status: 'matched' | 'discrepancy' | 'partial'
  - List all discrepancies with details
  - If matched, can auto-approve bill

- [ ] `getNextPONumber(userId: string): Promise<string>`
  - Query max existing poNumber for user
  - Increment and format: PO-{NNNNNN}
  - Handle concurrent creation (use SELECT FOR UPDATE or similar)

- [ ] `createPaymentRun(userId: string, data: CreatePaymentRunInput): Promise<SupplierPaymentRun>`
  - Create payment run with selected approved bills
  - Calculate total amount
  - Generate bank reference
  - Set status = 'draft'

- [ ] `processPaymentRun(paymentRunId: string): Promise<SupplierPaymentRun>`
  - Transition: 'draft' → 'processing' → 'completed'
  - For each bill in run: record payment via BillService.recordPayment()
  - Update run status to 'completed'
  - Return processed run

- [ ] `getPaymentRun(paymentRunId: string): Promise<PaymentRunDetail>`
  - Return run with all items and linked bill details

**Interfaces**:

```typescript
interface CreatePOInput {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

interface UpdatePOInput {
  expectedDate?: string;
  notes?: string;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

interface ReceiveGoodsInput {
  receiptDate: string;
  receivedBy?: string;
  notes?: string;
  lines: Array<{
    poLineId: string;
    quantityReceived: number;
  }>;
}

interface ThreeWayMatchResult {
  poId: string;
  poNumber: string;
  billId: string;
  billNumber: string;
  matchStatus: 'matched' | 'discrepancy' | 'partial';
  quantityMatch: boolean;
  priceMatch: boolean;
  totalMatch: boolean;
  poTotalCents: number;
  receiptTotalCents: number;
  billTotalCents: number;
  discrepancies: Array<{
    type: 'quantity' | 'price' | 'total' | 'missing_receipt';
    poLineDescription: string;
    expected: number;
    actual: number;
    variancePercent: number;
  }>;
  canAutoApprove: boolean;
}

interface POWithSupplier extends PurchaseOrder {
  supplierName: string;
}

interface PODetail extends POWithSupplier {
  lineItems: Array<POLine & { receivingProgress: number }>;
  receipts: Array<POReceipt & { lines: POReceiptLine[] }>;
  linkedBills: Array<{ id: string; billNumber: string; totalCents: number; status: string }>;
  overallReceivingPercent: number;
}

interface CreatePaymentRunInput {
  paymentDate: string;
  billIds: string[];
  bankReference?: string;
}

interface PaymentRunDetail extends SupplierPaymentRun {
  items: Array<SupplierPaymentRunItem & {
    billNumber: string;
    supplierName: string;
    amountCents: number;
  }>;
}
```

**Three-way matching tolerance**:
```typescript
const AP_AUTO_MATCH_THRESHOLD = parseFloat(process.env.AP_AUTO_MATCH_THRESHOLD || '0.02'); // 2% tolerance
const AP_MAX_MATCH_THRESHOLD = 0.05; // REVISION NOTE (D02 SEC-08): Hard cap at 5% — cannot be set higher

function isWithinTolerance(expected: number, actual: number): boolean {
  if (expected === 0 && actual === 0) return true;
  const variance = Math.abs(expected - actual) / Math.max(expected, actual);
  // REVISION NOTE (D02 SEC-08): Enforce maximum tolerance cap
  const effectiveThreshold = Math.min(AP_AUTO_MATCH_THRESHOLD, AP_MAX_MATCH_THRESHOLD);
  return variance <= effectiveThreshold;
}
```

**REVISION NOTE (D02 SEC-08 — Separation of Duties)**:
- The user who creates a PO CANNOT be the same user who receives goods against it
- `receiveGoods()` MUST check: `receipt.receivedBy !== purchaseOrder.userId`
- If same user, REJECT with error: "Separation of duties: PO creator cannot receive goods against their own PO"
- Exception: Single-user mode (only one user in system) — allow with warning log
- `AP_AUTO_MATCH_THRESHOLD` is capped at 5% (`AP_MAX_MATCH_THRESHOLD`) regardless of env var setting — prevents admin from disabling matching by setting 100%

**Implementation notes**:
- PO number auto-generation: Query `SELECT MAX(po_number) FROM purchase_orders WHERE user_id = ?`, parse number, increment
- Three-way match is the critical feature — it's the difference between basic bill entry and real AP management
- Receiving progress = sum(quantityReceived) / sum(quantity) * 100 across all lines
- Payment run processes all bills atomically — if one fails, roll back all
- All amounts in cents (INTEGER)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] PO auto-numbering generates sequential PO-000001, PO-000002, etc.
- [ ] Goods receiving updates quantityReceived and PO status correctly
- [ ] Cannot receive more than ordered quantity
- [ ] Three-way match detects: quantity mismatch, price mismatch, total mismatch
- [ ] Three-way match returns 'matched' when all within tolerance
- [ ] Payment run processes all bills and records payments
- [ ] Create marker file: `.agent-done-W10-04`

## Dependencies
- **Agent 1** must complete schema (for table structure reference)
- **Runtime dependency**: BillService for payment recording
- **Runtime dependency**: All 10 AP tables from migration
