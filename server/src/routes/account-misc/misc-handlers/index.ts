import type { Hono } from 'hono';
import { registerBankOps } from './bank-ops.js';
import { registerReconciliationOps } from './reconciliation-ops.js';
import { registerMerchantOps } from './merchant-ops.js';

export function registerMiscHandlers(app: Hono): void {
  registerBankOps(app);
  registerReconciliationOps(app);
  registerMerchantOps(app);
}
