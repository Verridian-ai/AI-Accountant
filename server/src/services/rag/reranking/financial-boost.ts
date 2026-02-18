/**
 * Financial Domain Boost Scoring Module
 *
 * Applies domain-specific score adjustments for financial transaction retrieval.
 * Boosts scores based on merchant matches, category relevance, and recency.
 */

import type {
  FinancialBoostConfig,
  FinancialContext,
  DocumentFinancialMetadata,
  BoostInput,
  BoostOutput,
  BoostBreakdown,
  FinancialBoostResult,
  BoostStats,
} from './financial-boost-types.js';
import { DEFAULT_FINANCIAL_BOOST_CONFIG } from './financial-boost-types.js';
import { extractContextFromQuery as extractContextFromQueryFn } from './financial-boost-context.js';
import { calculateAllBoosts, sumBoosts } from './financial-boost-calculations.js';

export type {
  FinancialBoostConfig,
  FinancialContext,
  DocumentFinancialMetadata,
  BoostInput,
  BoostOutput,
  BoostBreakdown,
  FinancialBoostResult,
  BoostStats,
};
export { DEFAULT_FINANCIAL_BOOST_CONFIG };

// ============================================================================
// FINANCIAL BOOSTER CLASS
// ============================================================================

export class FinancialBooster {
  private config: FinancialBoostConfig;

  constructor(config?: Partial<FinancialBoostConfig>) {
    this.config = { ...DEFAULT_FINANCIAL_BOOST_CONFIG, ...config };
  }

  applyBoosts(documents: BoostInput[], context: FinancialContext): FinancialBoostResult {
    const startTime = Date.now();

    if (documents.length === 0) {
      return { results: [], processingTimeMs: 0, contextUsed: context, stats: this.emptyStats() };
    }

    const results: BoostOutput[] = documents.map((doc) => {
      const breakdown = calculateAllBoosts(doc.financialMetadata, context, this.config);
      const totalBoost = sumBoosts(breakdown);
      const boostedScore = this.combineScores(doc.score, totalBoost);

      return {
        id: doc.id,
        originalScore: doc.score,
        boostedScore,
        totalBoost,
        boostBreakdown: breakdown,
      };
    });

    results.sort((a, b) => b.boostedScore - a.boostedScore);

    return {
      results,
      processingTimeMs: Date.now() - startTime,
      contextUsed: context,
      stats: this.calculateStats(results),
    };
  }

  extractContextFromQuery(query: string): FinancialContext {
    return extractContextFromQueryFn(query);
  }

  getConfig(): FinancialBoostConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<FinancialBoostConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private combineScores(originalScore: number, totalBoost: number): number {
    const cappedBoost = Math.min(totalBoost, 1.0);
    const boostedScore = originalScore + cappedBoost * this.config.boostWeight;
    return Math.min(Math.max(boostedScore, 0), 2);
  }

  private calculateStats(results: BoostOutput[]): BoostStats {
    if (results.length === 0) return this.emptyStats();

    const boostedDocs = results.filter((r) => r.totalBoost > 0);
    const totalBoost = results.reduce((sum, r) => sum + r.totalBoost, 0);
    const maxBoost = Math.max(...results.map((r) => r.totalBoost));

    const boostsByType = { merchant: 0, category: 0, recency: 0, amount: 0, account: 0 };
    for (const result of results) {
      if (result.boostBreakdown.merchantBoost > 0) boostsByType.merchant++;
      if (result.boostBreakdown.categoryBoost > 0) boostsByType.category++;
      if (result.boostBreakdown.recencyBoost > 0) boostsByType.recency++;
      if (result.boostBreakdown.amountBoost > 0) boostsByType.amount++;
      if (result.boostBreakdown.accountBoost > 0) boostsByType.account++;
    }

    return {
      documentsBosted: boostedDocs.length,
      averageBoost: totalBoost / results.length,
      maxBoost,
      boostsByType,
    };
  }

  private emptyStats(): BoostStats {
    return {
      documentsBosted: 0,
      averageBoost: 0,
      maxBoost: 0,
      boostsByType: { merchant: 0, category: 0, recency: 0, amount: 0, account: 0 },
    };
  }
}

export const financialBooster = new FinancialBooster();
