/**
 * CDR Product Search & Comparison Service — Core Service Class
 *
 * Thin orchestrator delegating to product-search and product-comparison.
 * All monetary amounts in savings calculations use CENTS (integer arithmetic).
 */

import { db, cdrProducts, cdrDataHolders, cdrLendingRates, cdrDepositRates } from '../../schema.js';
import { eq, desc, asc, sql } from 'drizzle-orm';
import type {
  ProductSearchFilters,
  ProductSearchResult,
  ProductComparison,
  BestRateResult,
  SavingsCalculation,
  SavingsAlternative,
  SavingsResult,
  CategorySummary,
  DataHolderSummary,
} from './types.js';
import { pmt } from './helpers.js';
import { searchProducts } from './product-search.js';
import { compareProducts } from './product-comparison.js';

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CdrProductService {
  async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    return searchProducts(filters);
  }

  async compareProducts(productIds: string[]): Promise<ProductComparison> {
    return compareProducts(productIds);
  }

  // --------------------------------------------------------------------------
  // 3. getBestRates — leaderboard of best rates
  // --------------------------------------------------------------------------

  async getBestRates(
    category: string,
    rateType: 'lending' | 'deposit',
    limit: number = 10,
  ): Promise<BestRateResult[]> {
    if (rateType === 'lending') {
      const rows = await db
        .select({
          productId: cdrLendingRates.productId,
          rate: cdrLendingRates.rate,
          comparisonRate: cdrLendingRates.comparisonRate,
          rateType: cdrLendingRates.lendingRateType,
          productName: cdrProducts.name,
          productCategory: cdrProducts.productCategory,
          dataHolderName: cdrDataHolders.brandName,
          dataHolderLogo: cdrDataHolders.logoUri,
        })
        .from(cdrLendingRates)
        .innerJoin(cdrProducts, eq(cdrLendingRates.productId, cdrProducts.id))
        .innerJoin(cdrDataHolders, eq(cdrProducts.dataHolderId, cdrDataHolders.id))
        .where(eq(cdrProducts.productCategory, category))
        .orderBy(asc(cdrLendingRates.rate))
        .limit(limit);

      return rows.map((r: any) => ({
        productId: r.productId,
        productName: r.productName,
        dataHolderName: r.dataHolderName ?? '',
        dataHolderLogo: r.dataHolderLogo ?? '',
        rate: r.rate,
        comparisonRate: r.comparisonRate ?? null,
        rateType: r.rateType,
        productCategory: r.productCategory,
      }));
    }

    // Deposit: highest rate first
    const rows = await db
      .select({
        productId: cdrDepositRates.productId,
        rate: cdrDepositRates.rate,
        rateType: cdrDepositRates.depositRateType,
        productName: cdrProducts.name,
        productCategory: cdrProducts.productCategory,
        dataHolderName: cdrDataHolders.brandName,
        dataHolderLogo: cdrDataHolders.logoUri,
      })
      .from(cdrDepositRates)
      .innerJoin(cdrProducts, eq(cdrDepositRates.productId, cdrProducts.id))
      .innerJoin(cdrDataHolders, eq(cdrProducts.dataHolderId, cdrDataHolders.id))
      .where(eq(cdrProducts.productCategory, category))
      .orderBy(desc(cdrDepositRates.rate))
      .limit(limit);

    return rows.map((r: any) => ({
      productId: r.productId,
      productName: r.productName,
      dataHolderName: r.dataHolderName ?? '',
      dataHolderLogo: r.dataHolderLogo ?? '',
      rate: r.rate,
      comparisonRate: null,
      rateType: r.rateType,
      productCategory: r.productCategory,
    }));
  }

  // --------------------------------------------------------------------------
  // 4. calculateSavings — find cheaper products & calculate lifetime savings
  // --------------------------------------------------------------------------

  async calculateSavings(params: SavingsCalculation): Promise<SavingsResult> {
    const {
      currentRate,
      currentBalance,
      remainingTermMonths,
      switchingCosts = 0,
      topN = 5,
      productCategory = 'RESIDENTIAL_MORTGAGES',
    } = params;

    const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, remainingTermMonths);
    const currentTotalCost = currentMonthlyPayment * remainingTermMonths;

    const bestRates = await this.getBestRates(productCategory, 'lending', topN * 3);

    const seen = new Set<string>();
    const candidates: BestRateResult[] = [];
    for (const r of bestRates) {
      if (r.rate < currentRate && !seen.has(r.productId)) {
        seen.add(r.productId);
        candidates.push(r);
      }
      if (candidates.length >= topN) break;
    }

    const alternatives: SavingsAlternative[] = candidates.map((candidate) => {
      const newMonthlyPayment = pmt(currentBalance, candidate.rate / 12, remainingTermMonths);
      const monthlySaving = currentMonthlyPayment - newMonthlyPayment;
      const totalLifetimeSaving = monthlySaving * remainingTermMonths - switchingCosts;
      const breakEvenMonths = monthlySaving > 0 ? Math.ceil(switchingCosts / monthlySaving) : -1;

      return {
        productId: candidate.productId,
        productName: candidate.productName,
        dataHolderName: candidate.dataHolderName,
        newRate: candidate.rate,
        newMonthlyPayment,
        currentMonthlyPayment,
        monthlySaving: Math.max(0, monthlySaving),
        totalLifetimeSaving,
        breakEvenMonths,
      };
    });

    alternatives.sort((a, b) => b.totalLifetimeSaving - a.totalLifetimeSaving);

    return {
      currentRate,
      currentMonthlyPayment,
      currentTotalCost,
      alternatives,
      bestSaving: alternatives.length > 0 ? alternatives[0] : null,
    };
  }

  // --------------------------------------------------------------------------
  // 5. getProductCategories — summary of CDR product categories
  // --------------------------------------------------------------------------

  async getProductCategories(): Promise<CategorySummary[]> {
    const catRows = await db
      .select({
        category: cdrProducts.productCategory,
        count: sql<number>`COUNT(*)`,
      })
      .from(cdrProducts)
      .groupBy(cdrProducts.productCategory);

    const summaries: CategorySummary[] = [];

    for (const row of catRows) {
      const lendingStats = await db
        .select({
          avg: sql<number>`AVG(${cdrLendingRates.rate})`,
          min: sql<number>`MIN(${cdrLendingRates.rate})`,
          max: sql<number>`MAX(${cdrLendingRates.rate})`,
        })
        .from(cdrLendingRates)
        .innerJoin(cdrProducts, eq(cdrLendingRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.productCategory, row.category));

      const depositStats = await db
        .select({
          avg: sql<number>`AVG(${cdrDepositRates.rate})`,
          min: sql<number>`MIN(${cdrDepositRates.rate})`,
          max: sql<number>`MAX(${cdrDepositRates.rate})`,
        })
        .from(cdrDepositRates)
        .innerJoin(cdrProducts, eq(cdrDepositRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.productCategory, row.category));

      const lStats = lendingStats[0];
      const dStats = depositStats[0];

      const allMins = [lStats?.min, dStats?.min].filter((v): v is number => v != null);
      const allMaxes = [lStats?.max, dStats?.max].filter((v): v is number => v != null);

      summaries.push({
        category: row.category,
        productCount: row.count,
        avgLendingRate: lStats?.avg ?? null,
        avgDepositRate: dStats?.avg ?? null,
        minRate: allMins.length > 0 ? Math.min(...allMins) : null,
        maxRate: allMaxes.length > 0 ? Math.max(...allMaxes) : null,
      });
    }

    return summaries;
  }

  // --------------------------------------------------------------------------
  // 6. getDataHolderSummary — overview of each data holder
  // --------------------------------------------------------------------------

  async getDataHolderSummary(): Promise<DataHolderSummary[]> {
    const holders = await db.select().from(cdrDataHolders).orderBy(cdrDataHolders.brandName);

    const summaries: DataHolderSummary[] = [];

    for (const h of holders) {
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(cdrProducts)
        .where(eq(cdrProducts.dataHolderId, h.id));
      const productCount = countResult[0]?.count ?? 0;

      const lendingAvg = await db
        .select({ avg: sql<number>`AVG(${cdrLendingRates.rate})` })
        .from(cdrLendingRates)
        .innerJoin(cdrProducts, eq(cdrLendingRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.dataHolderId, h.id));

      const depositAvg = await db
        .select({ avg: sql<number>`AVG(${cdrDepositRates.rate})` })
        .from(cdrDepositRates)
        .innerJoin(cdrProducts, eq(cdrDepositRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.dataHolderId, h.id));

      summaries.push({
        id: h.id,
        brandName: h.brandName,
        logoUri: h.logoUri ?? null,
        productCount,
        lastCrawledAt: h.lastCrawledAt ?? null,
        avgLendingRate: lendingAvg[0]?.avg ?? null,
        avgDepositRate: depositAvg[0]?.avg ?? null,
        status: h.status,
      });
    }

    return summaries;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const cdrProductService = new CdrProductService();
