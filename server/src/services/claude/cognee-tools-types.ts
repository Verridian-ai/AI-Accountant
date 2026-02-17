/**
 * Types and interfaces for CogneeTools.
 *
 * Extracted from cognee-tools.ts to comply with the 300-line enterprise standard.
 */

// ── AP Data Interfaces (Wave 10) ────────────────────────────────────
export interface SupplierProfileData {
  businessName: string;
  abn?: string;
  contactName?: string;
  email?: string;
  paymentTermsDays: number;
  typicalCategories: string[];
  averageSpendCents: number;
  paymentReliability: string; // 'excellent' | 'good' | 'fair' | 'poor'
}

export interface BillPatternData {
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

export interface POHistoryData {
  poNumber: string;
  supplierName: string;
  totalAmountCents: number;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  receivedDate?: string;
  matchedBillNumber?: string;
  matchStatus?: string;
}

export interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
  userId?: string; // Wave 3: user context for per-user isolation
  tenantId?: string; // Wave 23: tenant context for multi-tenant isolation
}
