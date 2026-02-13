# Agent 3: Bill Service Builder

## Role
Build the bill management service with line items, approval workflow, payment recording, and AP aging calculations.

## Priority: WAVE 10 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/bills.ts`
**Purpose**: Bill lifecycle management from entry through payment
**Pattern**: Follow `server/src/services/financial-reports.ts` for complex service pattern

**Class**: `BillService`

**Methods**:

- [ ] `listBills(userId: string, options?: BillListOptions): Promise<{ data: BillWithSupplier[]; total: number }>`
  - Paginated with default page=1, limit=50
  - Filterable by: status, supplierId, dateRange (issueDate or dueDate)
  - Include supplier businessName in response
  - Sort by dueDate ASC (soonest due first) by default

- [ ] `getBill(billId: string): Promise<BillDetail>`
  - Full bill with:
    - Line items (bill_lines)
    - Payment history (bill_payments)
    - Linked supplier details
    - Linked PO details (if matched)
  - Calculate remaining amountDue = totalAmount - amountPaid

- [ ] `createBill(userId: string, data: CreateBillInput): Promise<Bill>`
  - Generate UUID for bill and each line item
  - Calculate line amounts: amount = quantity * unitPrice
  - Calculate line GST: gstAmount = Math.round(amount * gstRate)
  - Calculate totals: subtotal = sum(line amounts), gstAmount = sum(line gst), totalAmount = subtotal + gstAmount
  - Set amountDue = totalAmount (initially unpaid)
  - Set status = 'draft'
  - Insert bill + bill_lines in single transaction

- [ ] `updateBill(billId: string, data: UpdateBillInput): Promise<Bill>`
  - Can only update draft or awaiting_approval bills
  - Recalculate totals if line items changed
  - Recalculate amountDue = totalAmount - amountPaid

- [ ] `approveBill(billId: string, approvingUserId: string): Promise<Bill>`
  - Transition: 'awaiting_approval' → 'approved'
  - Validate: bill must be in 'awaiting_approval' status
  - **REVISION NOTE (D02 SEC-08 — Separation of Duties)**: The user who creates a bill (or the linked PO) CANNOT be the same user who approves it. Add a business rule check:
    1. Query the bill's `user_id` (creator) and any linked PO's `user_id` (creator)
    2. If `approvingUserId === bill.userId` OR `approvingUserId === linkedPO.userId`, REJECT with error: "Separation of duties: the bill/PO creator cannot approve their own bill"
    3. Exception: If only one user exists in the system (single-user mode), allow self-approval with a warning log
  - If `AP_AUTO_MATCH_THRESHOLD` and PO exists, run three-way match check
  - Record approval in audit trail (include `approvingUserId`)

- [ ] `recordPayment(billId: string, payment: RecordPaymentInput): Promise<BillPayment>`
  - Create bill_payment record
  - Update bill.amountPaid += payment.amount
  - Update bill.amountDue = totalAmount - amountPaid
  - If amountDue <= 0, set status = 'paid'
  - Link to transaction if transactionId provided

- [ ] `voidBill(billId: string): Promise<Bill>`
  - Set status = 'void'
  - Cannot void a bill that has payments
  - If partial payments exist, reject void (must reverse payments first)

- [ ] `getAPAging(userId: string, asOfDate?: string): Promise<APAgingReport>`
  - Query all unpaid/overdue bills for user
  - Calculate days outstanding from due date
  - Categorize into buckets: current, 1-30, 31-60, 61-90, 90+ days
  - Return summary totals + detailed bill list per bucket
  - Mirror AR aging structure (Wave 9 ARAgingService)

- [ ] `submitForApproval(billId: string): Promise<Bill>`
  - Transition: 'draft' → 'awaiting_approval'
  - Validate all required fields are filled

- [ ] `checkOverdueBills(userId: string): Promise<Bill[]>`
  - Find all approved bills past due date
  - Update their status to 'overdue'
  - Return list of newly overdue bills

**Interfaces**:

```typescript
interface CreateBillInput {
  supplierId: string;
  billNumber?: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRate?: number; // default 0.1
    accountCode?: string;
    taxCode?: string;
  }>;
}

interface UpdateBillInput {
  billNumber?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lineItems?: Array<{
    id?: string; // existing line to update
    description: string;
    quantity: number;
    unitPriceCents: number;
    gstRate?: number;
    accountCode?: string;
    taxCode?: string;
  }>;
}

interface RecordPaymentInput {
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  reference?: string;
  transactionId?: string;
  notes?: string;
}

interface BillWithSupplier extends Bill {
  supplierName: string;
}

interface BillDetail extends BillWithSupplier {
  lineItems: BillLine[];
  payments: BillPayment[];
  linkedPO?: {
    id: string;
    poNumber: string;
    status: string;
  };
}

interface APAgingReport {
  asOfDate: string;
  buckets: {
    current: { totalCents: number; billCount: number; bills: APAgingBillItem[] };
    days1to30: { totalCents: number; billCount: number; bills: APAgingBillItem[] };
    days31to60: { totalCents: number; billCount: number; bills: APAgingBillItem[] };
    days61to90: { totalCents: number; billCount: number; bills: APAgingBillItem[] };
    days90plus: { totalCents: number; billCount: number; bills: APAgingBillItem[] };
  };
  totalOutstandingCents: number;
  totalOverdueCents: number;
  supplierCount: number;
}

interface APAgingBillItem {
  billId: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  issueDateISO: string;
  dueDateISO: string;
  totalAmountCents: number;
  amountDueCents: number;
  daysOutstanding: number;
}
```

**Implementation notes**:
- All monetary amounts in cents (INTEGER) — no floating-point currency
- GST calculation: `Math.round(amountCents * gstRate)` — round to nearest cent
- Total invariant: `totalAmount === subtotal + gstAmount`
- Payment invariant: `amountDue === totalAmount - amountPaid`
- Status flow: draft → awaiting_approval → approved → paid (or void from draft/awaiting_approval)
- Use `wrapPgDb()` for all DB queries
- Use `BEGIN/COMMIT` transactions for bill creation (bill + lines are atomic)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Bill creation calculates totals correctly from line items
- [ ] Payment recording updates amountPaid and amountDue
- [ ] Bill becomes 'paid' when amountDue reaches 0
- [ ] Void rejected for bills with payments
- [ ] AP aging correctly buckets bills by days past due date
- [ ] Status transitions are enforced (can't approve a draft directly)
- [ ] Create marker file: `.agent-done-W10-03`

## Dependencies
- **None** — can start immediately
- **Runtime dependency**: Requires `bills`, `bill_lines`, `bill_payments`, `suppliers` tables (from Agent 1 migration)
