/**
 * Bill types — defined locally (no circular dependency on parent monolith).
 */

export interface CreateBillInput {
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

export interface UpdateBillInput {
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

export interface RecordPaymentInput {
  paymentDate: string;
  amountCents: number;
  paymentMethod?: string;
  reference?: string;
  transactionId?: string;
  notes?: string;
}

export interface BillWithSupplier {
  id: string;
  userId: string;
  supplierId: string;
  billNumber: string | null;
  status: string;
  billDate: string;
  issueDate: string | null;
  dueDate: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  amountDue: number | null;
  createdAt: string;
  supplierName: string;
}

export interface BillLine {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCode: string | null;
}

export interface BillPayment {
  id: string;
  billId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string | null;
  reference: string | null;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BillDetail extends BillWithSupplier {
  lineItems: BillLine[];
  payments: BillPayment[];
  linkedPO?: {
    id: string;
    poNumber: string;
    status: string;
  };
}

export interface BillListOptions {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: 'issueDate' | 'dueDate';
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface APAgingBillItem {
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

export interface APAgingBucket {
  totalCents: number;
  billCount: number;
  bills: APAgingBillItem[];
}

export interface APAgingReport {
  asOfDate: string;
  buckets: {
    current: APAgingBucket;
    days1to30: APAgingBucket;
    days31to60: APAgingBucket;
    days61to90: APAgingBucket;
    days90plus: APAgingBucket;
  };
  totalOutstandingCents: number;
  totalOverdueCents: number;
  supplierCount: number;
}

// ---------------------------------------------------------------------------
// CALCULATION HELPERS
// ---------------------------------------------------------------------------

/** Calculate line item amount from quantity and unit price (cents). */
export function calcLineAmount(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

/** Calculate GST amount from line amount (cents) and rate. */
export function calcGst(amountCents: number, gstRate: number): number {
  return Math.round(amountCents * gstRate);
}

/** Calculate bill totals from line items. */
export function calcBillTotals(lines: Array<{ amount: number }>): {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  for (const line of lines) {
    subtotal += line.amount;
  }
  const gstAmount = Math.round(subtotal * 0.1);
  return { subtotal, gstAmount, totalAmount: subtotal + gstAmount };
}

/** Number of days between two ISO date strings. Negative = future. */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
