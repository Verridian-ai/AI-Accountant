/**
 * Loan Calculator — CDR Refinance Analysis
 *
 * Searches CDR products for lower-rate alternatives matching the loan's
 * purpose and repayment type. For each candidate, calculates amortization
 * over the remaining term and factors in itemized switching costs.
 */

import type { CdrProductService } from '../cdr-products.js';
import type { CdrRefinanceParams, CdrRefinanceResult, RefinanceAlternative } from './types.js';
import { pmt, defaultSwitchingCosts } from './helpers.js';

/**
 * CDR Refinance Analysis
 *
 * Searches CDR products for lower-rate alternatives matching the loan's
 * purpose and repayment type. For each candidate, calculates amortization
 * over the remaining term and factors in itemized switching costs.
 * Recommends 'stay' if break-even > 24 months or saving < $50/month.
 */
export async function refinanceAnalysis(
  cdrProductService: CdrProductService | null,
  params: CdrRefinanceParams,
): Promise<CdrRefinanceResult> {
  const {
    currentBalance,
    currentRate,
    currentRemainingMonths,
    loanPurpose,
    repaymentType,
    topN = 5,
  } = params;

  const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, currentRemainingMonths);
  const costs = defaultSwitchingCosts();

  // If no CDR service, return empty result
  if (!cdrProductService) {
    return {
      currentRate,
      currentMonthlyPayment,
      recommendation: 'stay',
      reasoning: 'CDR product data is not available. Unable to search for alternatives.',
      alternatives: [],
      bestAlternative: null,
    };
  }

  try {
    // Search CDR for products with lower rates
    const searchResult = await cdrProductService.searchProducts({
      productCategory: 'RESIDENTIAL_MORTGAGES',
      maxRate: currentRate,
      loanPurpose,
      repaymentType,
      sortBy: 'rate',
      sortOrder: 'asc',
      limit: topN * 3, // fetch extra to allow dedup
    });

    // Deduplicate by data holder (one best product per lender)
    const seenHolders = new Set<string>();
    const candidates = searchResult.products
      .filter((p) => {
        if (p.bestRate == null || p.bestRate >= currentRate) return false;
        if (seenHolders.has(p.dataHolderName)) return false;
        seenHolders.add(p.dataHolderName);
        return true;
      })
      .slice(0, topN);

    const alternatives: RefinanceAlternative[] = candidates.map((candidate) => {
      const newRate = candidate.bestRate!;
      const newMonthlyPayment = pmt(currentBalance, newRate / 12, currentRemainingMonths);
      const monthlySaving = currentMonthlyPayment - newMonthlyPayment;
      const totalLifetimeSaving = monthlySaving * currentRemainingMonths - costs.totalCents;
      const breakEvenMonths = monthlySaving > 0 ? Math.ceil(costs.totalCents / monthlySaving) : -1;

      return {
        productId: candidate.id,
        productName: candidate.name,
        dataHolderName: candidate.dataHolderName,
        newRate,
        comparisonRate: candidate.comparisonRate,
        newMonthlyPayment,
        monthlySaving: Math.max(0, monthlySaving),
        totalLifetimeSaving,
        breakEvenMonths,
        switchingCostBreakdown: costs,
      };
    });

    // Sort by total lifetime saving descending
    alternatives.sort((a, b) => b.totalLifetimeSaving - a.totalLifetimeSaving);

    const best = alternatives.length > 0 ? alternatives[0] : null;

    // Recommendation logic
    let recommendation: 'switch' | 'stay' = 'stay';
    let reasoning: string;

    if (!best) {
      reasoning = 'No CDR products found with a lower rate than your current loan.';
    } else if (best.breakEvenMonths > 24) {
      reasoning = `Best alternative (${best.dataHolderName} — ${best.productName}) saves $${(best.monthlySaving / 100).toFixed(2)}/month but takes ${best.breakEvenMonths} months to break even on $${(costs.totalCents / 100).toFixed(2)} switching costs. Consider staying unless you value long-term savings.`;
    } else if (best.monthlySaving < 5_000) {
      // less than $50/month
      reasoning = `Best alternative saves only $${(best.monthlySaving / 100).toFixed(2)}/month. The hassle and switching costs of $${(costs.totalCents / 100).toFixed(2)} may not be worth it.`;
    } else {
      recommendation = 'switch';
      reasoning = `${best.dataHolderName} — ${best.productName} at ${(best.newRate * 100).toFixed(2)}% saves $${(best.monthlySaving / 100).toFixed(2)}/month ($${(best.totalLifetimeSaving / 100).toFixed(2)} over remaining term). Break-even in ${best.breakEvenMonths} months.`;
    }

    return {
      currentRate,
      currentMonthlyPayment,
      recommendation,
      reasoning,
      alternatives,
      bestAlternative: best,
    };
  } catch {
    return {
      currentRate,
      currentMonthlyPayment,
      recommendation: 'stay',
      reasoning: 'Error querying CDR product data. Unable to complete refinance analysis.',
      alternatives: [],
      bestAlternative: null,
    };
  }
}
