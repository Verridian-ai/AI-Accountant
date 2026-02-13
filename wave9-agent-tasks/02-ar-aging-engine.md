# Agent 2: AR Aging Engine

## Role
Build the accounts receivable aging calculation service with bucket categorization, aging report generation, and customer-level drill-down.

## Priority: WAVE 9 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/ar-aging.ts`
**Purpose**: AR aging calculation engine that categorizes outstanding invoices into aging buckets
**Pattern**: Follow `server/src/services/financial-reports.ts` service pattern

**Class**: `ARAgingService`

**Methods**:

- [ ] `getAgingReport(userId: string, asOfDate?: string): Promise<ARAgingReport>`
  - Query all unpaid/overdue invoices for user
  - Calculate days outstanding from due date (not issue date)
  - Categorize into buckets: current (not yet due), 1-30 days, 31-60 days, 61-90 days, 90+ days
  - Return summary totals per bucket + detailed invoice list per bucket
  - Sort by amount descending within each bucket

- [ ] `getCustomerAging(userId: string, customerId: string, asOfDate?: string): Promise<CustomerAgingDetail>`
  - Same bucket logic but filtered to single customer
  - Include customer contact info, payment terms, and payment history summary
  - Calculate average days to pay from historical invoice_payments

- [ ] `getARSummary(userId: string): Promise<ARSummary>`
  - Total accounts receivable outstanding
  - Total overdue amount
  - Average days sales outstanding (DSO)
  - Top 5 debtors by amount
  - Percentage of AR in each aging bucket

- [ ] `getGSTSalesReport(userId: string, periodStart: string, periodEnd: string): Promise<GSTSalesReport>`
  - Aggregate GST collected from invoice_lines for the period
  - Group by month and by GST rate
  - Calculate total sales (ex-GST), total GST collected, total sales (inc-GST)
  - Compatible with BAS reporting (labels G1, 1A)

**Interfaces**:

```typescript
interface ARAgingReport {
  asOfDate: string;
  buckets: {
    current: AgingBucket;
    days1to30: AgingBucket;
    days31to60: AgingBucket;
    days61to90: AgingBucket;
    days90plus: AgingBucket;
  };
  totalOutstanding: number; // cents
  totalOverdue: number; // cents
  customerCount: number;
}

interface AgingBucket {
  totalCents: number;
  invoiceCount: number;
  invoices: AgingInvoice[];
}

interface AgingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDateISO: string;
  dueDateISO: string;
  totalAmountCents: number;
  amountDueCents: number;
  daysOutstanding: number;
}

interface CustomerAgingDetail {
  customerId: string;
  customerName: string;
  paymentTermsDays: number;
  averageDaysToPay: number;
  aging: ARAgingReport;
  recentPayments: Array<{
    invoiceNumber: string;
    paymentDate: string;
    amountCents: number;
    daysToPay: number;
  }>;
}

interface ARSummary {
  totalOutstandingCents: number;
  totalOverdueCents: number;
  daysSalesOutstanding: number;
  topDebtors: Array<{ customerId: string; customerName: string; amountCents: number }>;
  bucketPercentages: { current: number; days1to30: number; days31to60: number; days61to90: number; days90plus: number };
}

interface GSTSalesReport {
  periodStart: string;
  periodEnd: string;
  totalSalesExGstCents: number;
  totalGstCollectedCents: number;
  totalSalesIncGstCents: number;
  monthlyBreakdown: Array<{
    month: string;
    salesExGstCents: number;
    gstCollectedCents: number;
    salesIncGstCents: number;
  }>;
  byGstRate: Array<{
    rate: number;
    salesExGstCents: number;
    gstCents: number;
  }>;
}
```

**Implementation notes**:
- Use `wrapPgDb()` for all DB queries (matches existing pattern)
- Aging is calculated as `Math.floor((asOfDate - dueDate) / (1000 * 60 * 60 * 24))` — negative means not yet due (current bucket)
- DSO formula: `(totalOutstanding / totalSalesInPeriod) * daysInPeriod`
- All amounts in cents (INTEGER) — no floating-point currency
- Filter only invoices with status NOT 'void' and NOT 'draft'
- **REVISION NOTE (D03 — AR Aging Query Performance)**: AR aging queries MUST use INDEXED date columns and aggregate in SQL — do NOT fetch all invoices and calculate buckets in JS. Use a SQL `CASE WHEN` expression for bucket categorization:
  ```sql
  SELECT
    CASE
      WHEN due_date >= :asOfDate THEN 'current'
      WHEN :asOfDate::date - due_date::date BETWEEN 1 AND 30 THEN 'days1to30'
      WHEN :asOfDate::date - due_date::date BETWEEN 31 AND 60 THEN 'days31to60'
      WHEN :asOfDate::date - due_date::date BETWEEN 61 AND 90 THEN 'days61to90'
      ELSE 'days90plus'
    END as bucket,
    COUNT(*) as invoice_count,
    SUM(amount_due) as total_cents
  FROM invoices
  WHERE user_id = :userId
    AND status NOT IN ('void', 'draft')
    AND amount_due > 0
  GROUP BY bucket
  ```
  This leverages the existing index on `invoices(user_id, status)` and `invoices(due_date)`. For customer drill-down, add `AND customer_id = :customerId` filter. The detailed invoice list per bucket should be a SEPARATE query with `LIMIT` and `OFFSET` pagination — never load all invoices into memory.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] ARAgingReport correctly buckets invoices by days past due date
- [ ] Current bucket includes invoices not yet due (negative days outstanding)
- [ ] DSO calculation uses correct formula
- [ ] GST sales report aggregates match invoice_lines data
- [ ] Create marker file: `.agent-done-W09-02`

## Dependencies
- **None** — can start immediately (service uses interfaces, not schema imports directly)
- **Runtime dependency**: Requires `invoices`, `invoice_lines`, `invoice_payments`, `customers` tables (from Wave 7)
