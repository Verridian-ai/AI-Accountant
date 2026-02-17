/**
 * Purchase Order Types & Helpers
 *
 * All type definitions, interfaces, and utility functions
 * used across the purchase order service modules.
 */

import { config } from '../../lib/config.js';

// ============================================================================
// TOLERANCE CONFIGURATION
// ============================================================================

const AP_AUTO_MATCH_THRESHOLD = config.apAutoMatchThreshold; // 2% default
const AP_MAX_MATCH_THRESHOLD = 0.05; // Hard cap at 5% — cannot be set higher

export function isWithinTolerance(expected: number, actual: number): boolean {
  if (expected === 0 && actual === 0) return true;
  if (expected === 0 || actual === 0) return false;
  const variance = Math.abs(expected - actual) / Math.max(Math.abs(expected), Math.abs(actual));
  const effectiveThreshold = Math.min(AP_AUTO_MATCH_THRESHOLD, AP_MAX_MATCH_THRESHOLD);
  return variance <= effectiveThreshold;
}

export function variancePercent(expected: number, actual: number): number {
  if (expected === 0 && actual === 0) return 0;
  if (expected === 0) return 100;
  return Math.round((Math.abs(expected - actual) / Math.abs(expected)) * 10000) / 100;
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

export function calcLineAmount(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function calcPOTotals(lines: Array<{ amount: number }>): {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  for (const line of lines) {
    subtotal += line.amount;
  }
  const gstAmount = Math.round(subtotal * 0.1); // 10% GST
  return { subtotal, gstAmount, totalAmount: subtotal + gstAmount };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreatePOInput {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface UpdatePOInput {
  expectedDate?: string;
  notes?: string;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface ReceiveGoodsInput {
  receiptDate: string;
  receivedBy?: string;
  notes?: string;
  lines: Array<{
    poLineId: string;
    quantityReceived: number;
  }>;
}

export interface ThreeWayMatchResult {
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

export interface POWithSupplier {
  id: string;
  userId: string;
  supplierId: string;
  poNumber: string;
  status: string;
  issueDate: string;
  expectedDate: string | null;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  supplierName: string;
}

export interface POLineWithProgress {
  id: string;
  purchaseOrderId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  quantityReceived: number;
  receivingProgress: number;
}

export interface POReceiptDetail {
  id: string;
  purchaseOrderId: string;
  receiptDate: string;
  receivedBy: string | null;
  notes: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    receiptId: string;
    poLineId: string;
    quantityReceived: number;
  }>;
}

export interface PODetail extends POWithSupplier {
  lineItems: POLineWithProgress[];
  receipts: POReceiptDetail[];
  linkedBills: Array<{
    id: string;
    billNumber: string;
    totalCents: number;
    status: string;
  }>;
  overallReceivingPercent: number;
}

export interface POListOptions {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreatePaymentRunInput {
  paymentDate: string;
  billIds: string[];
  bankReference?: string;
}

export interface PaymentRunDetail {
  id: string;
  userId: string;
  paymentDate: string;
  status: string;
  totalAmount: number;
  bankReference: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    paymentRunId: string;
    billId: string;
    amount: number;
    billNumber: string;
    supplierName: string;
    amountCents: number;
  }>;
}
