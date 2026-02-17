/**
 * Purchase Order Service — Facade class + barrel export.
 *
 * Handles creation (with auto-numbering PO-NNNNNN), line items, sending,
 * goods receiving, three-way matching (PO -> receipt -> bill), cancellation,
 * and batch payment runs. All monetary amounts in cents (INTEGER).
 *
 * Status flow: draft -> sent -> partially_received -> received -> matched -> closed
 * Cancellation: draft|sent -> cancelled (no goods received)
 *
 * Key controls:
 *   - Separation of duties: PO creator != goods receiver
 *   - Three-way match tolerance: configurable 2% default, 5% hard cap
 *   - Payment runs: atomic batch processing via BillService.recordPayment()
 */

// ── Re-export all types ─────────────────────────────────────────────────────
export {
  type CreatePOInput,
  type UpdatePOInput,
  type ReceiveGoodsInput,
  type ThreeWayMatchResult,
  type POWithSupplier,
  type POLineWithProgress,
  type POReceiptDetail,
  type PODetail,
  type POListOptions,
  type CreatePaymentRunInput,
  type PaymentRunDetail,
} from './types.js';

// ── Import sub-module functions ─────────────────────────────────────────────
import { listPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } from './po-crud.js';
import { getPurchaseOrder } from './po-detail.js';
import { sendPurchaseOrder, cancelPurchaseOrder, receiveGoods } from './approval-workflow.js';
import { threeWayMatch } from './three-way-match.js';
import { getNextPONumber } from './numbering.js';
import { createPaymentRun, processPaymentRun, getPaymentRun } from './payment-runs.js';

import type {
  CreatePOInput,
  UpdatePOInput,
  ReceiveGoodsInput,
  ThreeWayMatchResult,
  PODetail,
  POWithSupplier,
  POListOptions,
  CreatePaymentRunInput,
  PaymentRunDetail,
} from './types.js';

// ============================================================================
// SERVICE CLASS — Facade
// ============================================================================

export class PurchaseOrderService {
  async listPurchaseOrders(
    userId: string,
    options: POListOptions = {},
  ): Promise<{ data: POWithSupplier[]; total: number }> {
    return listPurchaseOrders(userId, options);
  }

  async getPurchaseOrder(poId: string): Promise<PODetail> {
    return getPurchaseOrder(poId);
  }

  async createPurchaseOrder(userId: string, data: CreatePOInput): Promise<any> {
    return createPurchaseOrder(userId, data);
  }

  async updatePurchaseOrder(poId: string, data: UpdatePOInput): Promise<any> {
    return updatePurchaseOrder(poId, data);
  }

  async sendPurchaseOrder(poId: string): Promise<any> {
    return sendPurchaseOrder(poId);
  }

  async receiveGoods(poId: string, receipt: ReceiveGoodsInput): Promise<any> {
    return receiveGoods(poId, receipt);
  }

  async cancelPurchaseOrder(poId: string): Promise<any> {
    return cancelPurchaseOrder(poId);
  }

  async threeWayMatch(poId: string, billId: string): Promise<ThreeWayMatchResult> {
    return threeWayMatch(poId, billId);
  }

  async getNextPONumber(userId: string): Promise<string> {
    return getNextPONumber(userId);
  }

  async createPaymentRun(userId: string, data: CreatePaymentRunInput): Promise<any> {
    return createPaymentRun(userId, data);
  }

  async processPaymentRun(paymentRunId: string): Promise<any> {
    return processPaymentRun(paymentRunId);
  }

  async getPaymentRun(paymentRunId: string): Promise<PaymentRunDetail> {
    return getPaymentRun(paymentRunId);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
