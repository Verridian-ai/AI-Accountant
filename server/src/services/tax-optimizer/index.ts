/**
 * Tax Optimizer Service — Barrel Export
 */
export type { TaxStrategy, EntityType, StrategyContext } from './types.js';
export { marginalRateAtCents } from './types.js';
export { STRATEGY_TEMPLATES } from './strategy-templates.js';
export { TaxOptimizerService } from './tax-optimizer-service.js';

import { TaxOptimizerService } from './tax-optimizer-service.js';
export const taxOptimizerService = new TaxOptimizerService();
