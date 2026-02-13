# Agent 5: Customer Statement Service

## Role
Build the customer statement of account service with period-based calculations, transaction listing, and PDF output generation.

## Priority: WAVE 9 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/customer-statements.ts`
**Purpose**: Generate customer statements of account showing invoices, payments, and running balance
**Pattern**: Follow `server/src/services/financial-reports.ts` for report generation

**Class**: `CustomerStatementService`

**Methods**:

- [ ] `generateStatement(customerId: string, periodStart: string, periodEnd: string): Promise<CustomerStatementData>`
  - Calculate opening balance (total outstanding as of periodStart)
  - List all invoices issued during period
  - List all payments received during period
  - List all credit notes applied during period
  - Calculate closing balance = opening + invoices - payments - credits
  - Store statement record in customer_statements table
  - Sort transactions chronologically

- [ ] `getStatementHistory(customerId: string): Promise<CustomerStatement[]>`
  - Return all previously generated statements for customer
  - Sorted by period_start DESC

- [ ] `getOpeningBalance(customerId: string, asOfDate: string): Promise<number>`
  - Calculate total unpaid invoice amounts as of given date
  - Sum of (totalAmount - amountPaid) for all non-void invoices issued before asOfDate
  - This becomes the opening balance for the statement period

- [ ] `renderStatementHTML(statementData: CustomerStatementData): Promise<string>`
  - Generate HTML for the statement of account
  - Include: business details, customer details, period, opening balance
  - Transaction table with: date, type (invoice/payment/credit), reference, debit, credit, running balance
  - Closing balance and payment terms
  - Use invoice template if available (via InvoiceTemplateService)

- [ ] `generateStatementPDF(statementId: string): Promise<string>`
  - **REVISION NOTE (DRY — Reuse Wave 7 PDF infrastructure)**: Reuse the `pdf-lib` based PDF generation from Wave 7's invoice PDF service (`invoice-pdf.ts`). Do NOT create a separate PDF generation approach. Extract common PDF utility functions (page setup, header rendering, table rendering, footer) into a shared `server/src/services/pdf-utils.ts` module if not already extracted, then call those utilities from here.
  - Render statement data to PDF using shared pdf-lib utilities
  - Save PDF to `server/uploads/statements/{statementId}.pdf`
  - Update customer_statements.pdfPath
  - Return PDF file path

**Interfaces**:

```typescript
interface CustomerStatementData {
  statementId: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  businessName: string;
  businessABN: string;
  periodStart: string;
  periodEnd: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  transactions: StatementLineItem[];
  generatedAt: string;
}

interface StatementLineItem {
  date: string;
  type: 'invoice' | 'payment' | 'credit_note';
  reference: string; // invoice number or payment reference
  description: string;
  debitCents: number;   // invoices increase balance
  creditCents: number;  // payments/credits decrease balance
  runningBalanceCents: number;
}
```

**Implementation notes**:
- Opening balance for first-ever statement is 0 (no prior invoices)
- Statement continuity: opening balance MUST equal previous statement's closing balance
- Running balance calculated sequentially: `previous.runningBalance + debit - credit`
- Monetary amounts all in cents (INTEGER) — format to dollars only in HTML rendering
- **REVISION NOTE (DRY)**: PDF generation MUST use `pdf-lib` (same as Wave 7 invoice PDFs). Do NOT use puppeteer or html-to-pdf. Reuse common PDF layout functions from Wave 7's `invoice-pdf.ts`. If needed, create a shared `pdf-utils.ts` with: `createPageWithHeader()`, `renderTableRows()`, `renderFooter()`, `formatCurrency()`.
- Periods typically monthly or quarterly, aligned with BAS periods

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Opening balance calculated correctly from prior unpaid invoices
- [ ] Statement includes all invoices, payments, and credit notes in period
- [ ] Running balance is sequential and mathematically correct
- [ ] Closing balance = opening + total debits - total credits
- [ ] Statement continuity: previous closing = next opening
- [ ] Create marker file: `.agent-done-W09-05`

## Dependencies
- **Agent 1** must complete schema (customer_statements table)
- **Runtime dependency**: Requires `invoices`, `invoice_lines`, `invoice_payments`, `customers`, `business_profiles` tables (from Wave 7)
