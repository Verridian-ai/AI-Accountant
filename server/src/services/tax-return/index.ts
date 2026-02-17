/**
 * Tax Return Service — Barrel Export
 */
export { DEDUCTION_RATES, calculateSBITO, type TaxReturnResult } from './types.js';
export { TaxReturnService } from './tax-return-service.js';
export { calculateTrustReturn, calculateSMSFReturn } from './tax-return-entity.js';

import { TaxReturnService } from './tax-return-service.js';
export const taxReturnService = new TaxReturnService();
