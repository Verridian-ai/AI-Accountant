/**
 * Tax Optimizer Service
 *
 * AI-powered tax strategy generation with 10 built-in strategy templates.
 * Analyzes a user's financial position and recommends applicable tax
 * minimization strategies compliant with ATO rulings.
 *
 * All monetary values in CENTS (integer arithmetic).
 */

import { taxReturnService, type TaxReturnResult } from '../tax-return.js';
import type { TaxStrategy, EntityType, StrategyContext } from './types.js';
import { marginalRateAtCents } from './types.js';
import { STRATEGY_TEMPLATES } from './strategy-templates.js';

export class TaxOptimizerService {
  /**
   * Generate applicable tax strategies for a user based on their financial position.
   */
  async generateStrategies(
    userId: string,
    financialYear: string,
    entityType: EntityType = 'sole_trader',
  ): Promise<TaxStrategy[]> {
    // Calculate the appropriate return
    let taxReturn: TaxReturnResult;
    switch (entityType) {
      case 'sole_trader':
        taxReturn = await taxReturnService.calculateSoleTraderReturn(userId, financialYear);
        break;
      case 'personal':
        taxReturn = await taxReturnService.calculatePersonalReturn(userId, financialYear);
        break;
      case 'company':
        taxReturn = await taxReturnService.calculateCompanyReturn(userId, financialYear);
        break;
      case 'trust':
        taxReturn = await taxReturnService.calculateTrustReturn(userId, financialYear);
        break;
      case 'smsf':
        taxReturn = await taxReturnService.calculateSMSFReturn(userId, financialYear);
        break;
      default:
        taxReturn = await taxReturnService.calculateSoleTraderReturn(userId, financialYear);
    }

    const marginalRate =
      entityType === 'company'
        ? 0.25
        : entityType === 'smsf'
          ? 0.15
          : marginalRateAtCents(taxReturn.taxableIncomeCents);

    const ctx: StrategyContext = { entityType, taxReturn, marginalRate };
    const strategies: TaxStrategy[] = [];

    for (const template of STRATEGY_TEMPLATES) {
      if (!template.applicableEntities.includes(entityType)) continue;

      const result = template.evaluate(ctx);
      if (!result || result.savingCents <= 0) continue;

      strategies.push({
        name: template.name,
        description: template.description,
        estimatedSavingCents: result.savingCents,
        confidence: result.confidence,
        atoRulingRef: template.atoRulingRef,
        applicableEntities: template.applicableEntities,
        implementationSteps: result.steps,
      });
    }

    // Sort by estimated saving descending
    strategies.sort((a, b) => b.estimatedSavingCents - a.estimatedSavingCents);

    return strategies;
  }
}
