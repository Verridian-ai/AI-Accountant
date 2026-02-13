# Agent 3: Invoice Engine Builder

## Role
Build the invoice creation, auto-numbering, lifecycle management, and payment tracking service.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/invoicing.ts`
**Purpose**: Full invoice lifecycle — creation, numbering, status management, payment tracking, credit notes
**Pattern**: Follow `server/src/services/accounts.ts` for DB access patterns

#### Class: `InvoicingService`

**Methods**:

- [ ] `getNextInvoiceNumber(userId: string): Promise<string>`
  - Read from `invoice_number_sequences` for userId
  - If no sequence exists, create one with defaults (prefix='INV-', nextNumber=1)
  - Format: `{prefix}{number:06d}` → e.g., "INV-000001"
  - Increment `nextNumber` atomically
  - Return formatted invoice number

  > **REVISION NOTE (D02 COMP-06 — Invoice Number Tamper-Proofing)**:
  > Invoice numbering MUST be tamper-proof and gap-free to satisfy ATO sequential numbering requirements:
  > 1. Use `SELECT ... FOR UPDATE` (PostgreSQL row-level lock) when reading+incrementing the sequence to prevent race conditions where two concurrent requests get the same number or skip a number.
  > 2. Wrap the read-increment-format in a single DB transaction.
  > 3. Invoice numbers are NEVER reused or reassigned — voided invoices keep their number (void status preserved, number not recycled).
  > 4. Completed/sent/paid invoices CANNOT have their invoice number changed (enforce in `updateInvoice()`).
  > 5. Log any detected gaps in the sequence for audit trail purposes.
  > ```typescript
  > // Pattern for atomic number generation:
  > await db.transaction(async (tx) => {
  >   const seq = await tx.execute(
  >     `SELECT * FROM invoice_number_sequences WHERE user_id = ? FOR UPDATE`,
  >     [userId]
  >   );
  >   // ... increment, format, update ...
  > });
  > ```

- [ ] `createInvoice(userId: string, data: CreateInvoiceInput): Promise<InvoiceWithLines>`
  - Generate UUID for invoice id
  - Auto-assign invoice number via `getNextInvoiceNumber()`
  - Calculate line totals: `amount = Math.round(quantity * unitPrice)`
  - Calculate line GST: `gstAmount = Math.round(amount * gstRate)`
  - Calculate invoice totals: subtotal = SUM(line amounts), gstAmount = SUM(line gstAmounts)
  - `totalAmount = subtotal + gstAmount`
  - `amountDue = totalAmount - amountPaid` (amountPaid starts at 0)
  - Set status = 'draft', issueDate = today if not provided
  - Calculate dueDate from issueDate + customer.paymentTermsDays if not provided
  - Insert invoice + all line items in a transaction
  - Return invoice with lines

- [ ] `getInvoice(userId: string, invoiceId: string): Promise<InvoiceWithLines | null>`
  - Fetch invoice with ownership check
  - Include all line items
  - Include customer details (join)

- [ ] `listInvoices(userId: string, options: { offset?: number; limit?: number; status?: string; customerId?: string; dateFrom?: string; dateTo?: string }): Promise<{ data: InvoiceWithCustomer[]; total: number }>`
  - Paginated, filterable invoice list
  - Join customer businessName for display
  - Default: offset=0, limit=50, max limit=100
  - **REVISION NOTE (D01 CRIT-03)**: Uses offset/limit (not page/limit) to match existing codebase convention.

- [ ] `updateInvoice(userId: string, invoiceId: string, data: UpdateInvoiceInput): Promise<InvoiceWithLines>`
  - Only allowed for status='draft'
  - If lineItems provided, delete existing lines and re-insert
  - Recalculate totals
  - Update updatedAt timestamp

- [ ] `sendInvoice(userId: string, invoiceId: string): Promise<Invoice>`
  - Change status from 'draft' → 'sent'
  - Set issueDate to today if not already set
  - Only allowed from 'draft' status

- [ ] `voidInvoice(userId: string, invoiceId: string): Promise<Invoice>`
  - Change status → 'void'
  - Only allowed if status is NOT 'paid'
  - Set amountDue = 0

- [ ] `recordPayment(userId: string, invoiceId: string, data: RecordPaymentInput): Promise<InvoicePayment>`
  - Create invoice_payments record
  - Update invoice.amountPaid += payment.amount
  - Update invoice.amountDue = totalAmount - amountPaid
  - If amountPaid >= totalAmount → status = 'paid'
  - If amountPaid > 0 but < totalAmount → keep current status (partial payment)
  - Return the payment record

- [ ] `createCreditNote(userId: string, data: CreateCreditNoteInput): Promise<InvoiceWithLines>`
  - Creates a new invoice with type='credit_note'
  - Amounts are negative (or stored as positive with type indicator)
  - References original invoice if provided
  - Auto-number with same sequence (or separate CN- prefix)

- [ ] `checkOverdueInvoices(userId: string): Promise<Invoice[]>`
  - Find invoices where status='sent' AND dueDate < today
  - Update their status to 'overdue'
  - Return list of newly overdue invoices

- [ ] `getInvoiceSummary(userId: string): Promise<InvoiceSummary>`
  - Total outstanding, overdue amount, revenue this month, invoice counts by status
  - Used by InvoicingDashboard summary cards

**Types** (export from this file):

```typescript
export interface CreateInvoiceInput {
  customerId: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  termsAndConditions?: string;
  lineItems: CreateLineItemInput[];
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
  gstRate?: number; // defaults to 0.1 (10%)
  accountCode?: string;
  taxCode?: string;
}

export interface UpdateInvoiceInput {
  customerId?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  termsAndConditions?: string;
  lineItems?: CreateLineItemInput[];
}

export interface RecordPaymentInput {
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  reference?: string;
  transactionId?: string;
  notes?: string;
}

export interface CreateCreditNoteInput {
  customerId: string;
  originalInvoiceId?: string;
  lineItems: CreateLineItemInput[];
  notes?: string;
}

export interface InvoiceWithLines {
  invoice: Invoice;
  lines: InvoiceLine[];
  customer?: Customer;
}

export interface InvoiceWithCustomer {
  invoice: Invoice;
  customerName: string;
}

export interface InvoiceSummary {
  totalOutstandingCents: number;
  totalOverdueCents: number;
  revenueThisMonthCents: number;
  counts: {
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    void: number;
  };
}
```

**Critical invariants**:
- `totalAmount = subtotal + gstAmount` (MUST always hold)
- `amountDue = totalAmount - amountPaid` (MUST always hold)
- Line `amount = Math.round(quantity * unitPrice)` (round to avoid floating-point issues)
- Line `gstAmount = Math.round(amount * gstRate)` (round to cents)
- Subtotal = SUM of line amounts
- Invoice gstAmount = SUM of line gstAmounts
- Status transitions: draft → sent → paid/overdue/void; void is terminal

## Verification
- [ ] Auto-numbering produces sequential INV-000001, INV-000002, etc.
- [ ] GST calculation: 10% of $100.00 = $10.00 (10000 cents → 1000 cents)
- [ ] Payment recording correctly updates amountPaid and amountDue
- [ ] Status transitions are enforced (can't edit non-draft, can't void paid)
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-03`

## Dependencies
- **None** — can start immediately
- **Schema tables used**: `invoices`, `invoice_lines`, `invoice_number_sequences`, `invoice_payments`, `customers`
