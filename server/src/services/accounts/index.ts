/**
 * Account Service — barrel re-export.
 */
export { AccountService } from './account-service.js';
export type {
  TransactionRow,
  AccountRow,
  CreateAccountInput,
  UpdateMerchantMemoryInput,
  ResolveCategorizationInput,
  CreateTransferInput,
} from './types.js';

import { AccountService } from './account-service.js';
export const accountService = new AccountService();
