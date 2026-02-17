/**
 * Tax Optimizer — Type Definitions & Utilities
 */

import type { TaxReturnResult } from '../tax-return.js';

export interface TaxStrategy {
  name: string;
  description: string;
  estimatedSavingCents: number;
  confidence: number; // 0-1
  atoRulingRef?: string;
  applicableEntities: string[];
  implementationSteps: string[];
}

export type EntityType = 'sole_trader' | 'personal' | 'company' | 'trust' | 'smsf';

export interface StrategyContext {
  entityType: EntityType;
  taxReturn: TaxReturnResult;
  marginalRate: number;
}

/**
 * Calculate marginal tax rate at a given taxable income (in cents).
 * Returns the rate as a decimal (e.g. 0.325).
 */
export function marginalRateAtCents(taxableIncomeCents: number): number {
  const dollars = taxableIncomeCents / 100;
  if (dollars <= 18_200) return 0;
  if (dollars <= 45_000) return 0.16;
  if (dollars <= 135_000) return 0.3;
  if (dollars <= 190_000) return 0.37;
  return 0.45;
}
