/**
 * Enhanced Budget Service Module — Barrel re-export
 */

export * from './types.js';
export {
  median,
  linearRegression,
  stdDev,
  detectFrequency,
  addDays,
  frequencyToDays,
} from './helpers.js';
export { EnhancedBudgetService } from './budget-service.js';

import { EnhancedBudgetService } from './budget-service.js';
export const enhancedBudgetService = new EnhancedBudgetService();
