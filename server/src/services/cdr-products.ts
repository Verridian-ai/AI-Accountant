/**
 * CDR Product Search & Comparison Service
 *
 * Queries crawled CDR (Consumer Data Right) product data to provide:
 *   - Filtered product search with pagination
 *   - Side-by-side product comparison (up to 5)
 *   - Best-rate leaderboards (lending & deposit)
 *   - Savings calculations with amortization & break-even
 *   - Category and data-holder summaries
 *
 * All monetary amounts in savings calculations use CENTS (integer arithmetic)
 * to match the loan-calculator convention and avoid floating-point rounding.
 */

import {
  db,
  cdrProducts,
  cdrDataHolders,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
  cdrEligibility,
} from '../schema.js';
import { eq, and, gte, lte, like, inArray, desc, asc, sql } from 'drizzle-orm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProductSearchFilters {
  productCategory?: string;
  dataHolderIds?: string[];
  rateType?: string;
  maxRate?: number;
  minRate?: number;
  features?: string[];
  loanPurpose?: string;
  repaymentType?: string;
  searchText?: string;
  sortBy?: 'rate' | 'comparison_rate' | 'name' | 'data_holder';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface EnrichedProduct {
  id: string;
  dataHolderName: string;
  dataHolderLogo: string;
  name: string;
  description: string;
  productCategory: string;
  bestRate: number | null;
  comparisonRate: number | null;
  rateType: string | null;
  featureCount: number;
  feeCount: number;
  features: string[];
  applicationUri: string | null;
}

export interface ProductSearchResult {
  products: EnrichedProduct[];
  total: number;
  filters: ProductSearchFilters;
  rateRange: { min: number; max: number };
}

export interface ComparisonCategory {
  name: string;
  items: Array<{
    label: string;
    values: Record<string, string | number | boolean | null>;
  }>;
}

export interface ProductComparison {
  products: EnrichedProduct[];
  categories: ComparisonCategory[];
  annualFees: Record<string, number>;
  recommendation: string;
}

export interface BestRateResult {
  productId: string;
  productName: string;
  dataHolderName: string;
  dataHolderLogo: string;
  rate: number;
  comparisonRate: number | null;
  rateType: string;
  productCategory: string;
}

export interface SavingsCalculation {
  currentRate: number; // decimal (e.g. 0.065)
  currentBalance: number; // cents
  remainingTermMonths: number;
  switchingCosts?: number; // cents (default 0)
  topN?: number; // how many alternatives to return (default 5)
  productCategory?: string; // filter (default RESIDENTIAL_MORTGAGES)
}

export interface SavingsAlternative {
  productId: string;
  productName: string;
  dataHolderName: string;
  newRate: number;
  newMonthlyPayment: number; // cents
  currentMonthlyPayment: number; // cents
  monthlySaving: number; // cents
  totalLifetimeSaving: number; // cents (net of switching costs)
  breakEvenMonths: number; // months until switching costs are recouped
}

export interface SavingsResult {
  currentRate: number;
  currentMonthlyPayment: number; // cents
  currentTotalCost: number; // cents
  alternatives: SavingsAlternative[];
  bestSaving: SavingsAlternative | null;
}

export interface CategorySummary {
  category: string;
  productCount: number;
  avgLendingRate: number | null;
  avgDepositRate: number | null;
  minRate: number | null;
  maxRate: number | null;
}

export interface DataHolderSummary {
  id: string;
  brandName: string;
  logoUri: string | null;
  productCount: number;
  lastCrawledAt: string | null;
  avgLendingRate: number | null;
  avgDepositRate: number | null;
  status: string;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Standard annuity payment (PMT formula). Returns cents. */
function pmt(principalCents: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) return Math.round(principalCents / periods);
  const factor = Math.pow(1 + periodicRate, periods);
  return Math.round((principalCents * periodicRate * factor) / (factor - 1));
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CdrProductService {
  // --------------------------------------------------------------------------
  // 1. searchProducts — paginated, filtered product search
  // --------------------------------------------------------------------------

  async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    // Build WHERE conditions
    const conditions: any[] = [];

    if (filters.productCategory) {
      conditions.push(eq(cdrProducts.productCategory, filters.productCategory));
    }
    if (filters.dataHolderIds && filters.dataHolderIds.length > 0) {
      conditions.push(inArray(cdrProducts.dataHolderId, filters.dataHolderIds));
    }
    if (filters.searchText) {
      conditions.push(like(cdrProducts.name, `%${filters.searchText}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matching products
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(cdrProducts)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Fetch product rows with data holder join
    const rows = await db
      .select({
        id: cdrProducts.id,
        name: cdrProducts.name,
        description: cdrProducts.description,
        productCategory: cdrProducts.productCategory,
        applicationUri: cdrProducts.applicationUri,
        dataHolderId: cdrProducts.dataHolderId,
        dataHolderName: cdrDataHolders.brandName,
        dataHolderLogo: cdrDataHolders.logoUri,
      })
      .from(cdrProducts)
      .leftJoin(cdrDataHolders, eq(cdrProducts.dataHolderId, cdrDataHolders.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    // Enrich each product with rates, features, fees
    const products: EnrichedProduct[] = [];
    let globalMinRate = Infinity;
    let globalMaxRate = -Infinity;

    for (const row of rows) {
      const [lendingRates, depositRates, featureRows, feeRows] = await Promise.all([
        db.select().from(cdrLendingRates).where(eq(cdrLendingRates.productId, row.id)),
        db.select().from(cdrDepositRates).where(eq(cdrDepositRates.productId, row.id)),
        db.select().from(cdrFeatures).where(eq(cdrFeatures.productId, row.id)),
        db.select().from(cdrFees).where(eq(cdrFees.productId, row.id)),
      ]);

      // Determine best rate (lowest lending or highest deposit)
      let bestRate: number | null = null;
      let comparisonRate: number | null = null;
      let rateType: string | null = null;

      if (lendingRates.length > 0) {
        const sorted = [...lendingRates].sort((a: any, b: any) => a.rate - b.rate);
        bestRate = sorted[0].rate;
        comparisonRate = sorted[0].comparisonRate ?? null;
        rateType = sorted[0].lendingRateType;
      } else if (depositRates.length > 0) {
        const sorted = [...depositRates].sort((a: any, b: any) => b.rate - a.rate);
        bestRate = sorted[0].rate;
        rateType = sorted[0].depositRateType;
      }

      // Apply rate filters
      if (filters.minRate != null && (bestRate == null || bestRate < filters.minRate)) continue;
      if (filters.maxRate != null && (bestRate == null || bestRate > filters.maxRate)) continue;

      // Apply rate type filter
      if (filters.rateType) {
        const matchesLending = lendingRates.some(
          (r: any) => r.lendingRateType === filters.rateType,
        );
        const matchesDeposit = depositRates.some(
          (r: any) => r.depositRateType === filters.rateType,
        );
        if (!matchesLending && !matchesDeposit) continue;
      }

      // Apply loan purpose filter
      if (filters.loanPurpose) {
        const matchesPurpose = lendingRates.some((r: any) => r.loanPurpose === filters.loanPurpose);
        if (!matchesPurpose) continue;
      }

      // Apply repayment type filter
      if (filters.repaymentType) {
        const matchesRepayment = lendingRates.some(
          (r: any) => r.repaymentType === filters.repaymentType,
        );
        if (!matchesRepayment) continue;
      }

      // Apply feature filter
      if (filters.features && filters.features.length > 0) {
        const productFeatureTypes = featureRows.map((f: any) => f.featureType);
        const hasAll = filters.features.every((f) => productFeatureTypes.includes(f));
        if (!hasAll) continue;
      }

      // Track global rate range
      if (bestRate != null) {
        if (bestRate < globalMinRate) globalMinRate = bestRate;
        if (bestRate > globalMaxRate) globalMaxRate = bestRate;
      }

      products.push({
        id: row.id,
        dataHolderName: row.dataHolderName ?? '',
        dataHolderLogo: row.dataHolderLogo ?? '',
        name: row.name,
        description: row.description ?? '',
        productCategory: row.productCategory,
        bestRate,
        comparisonRate,
        rateType,
        featureCount: featureRows.length,
        feeCount: feeRows.length,
        features: featureRows.map((f: any) => f.featureType),
        applicationUri: row.applicationUri ?? null,
      });
    }

    // Sort
    const sortOrder = filters.sortOrder ?? 'asc';
    products.sort((a, b) => {
      let cmp = 0;
      switch (filters.sortBy) {
        case 'rate':
          cmp = (a.bestRate ?? Infinity) - (b.bestRate ?? Infinity);
          break;
        case 'comparison_rate':
          cmp = (a.comparisonRate ?? Infinity) - (b.comparisonRate ?? Infinity);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'data_holder':
          cmp = a.dataHolderName.localeCompare(b.dataHolderName);
          break;
        default:
          cmp = (a.bestRate ?? Infinity) - (b.bestRate ?? Infinity);
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return {
      products,
      total,
      filters,
      rateRange: {
        min: globalMinRate === Infinity ? 0 : globalMinRate,
        max: globalMaxRate === -Infinity ? 0 : globalMaxRate,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 2. compareProducts — side-by-side comparison matrix
  // --------------------------------------------------------------------------

  async compareProducts(productIds: string[]): Promise<ProductComparison> {
    const ids = productIds.slice(0, 5); // max 5
    if (ids.length === 0) {
      return {
        products: [],
        categories: [],
        annualFees: {},
        recommendation: 'No products selected.',
      };
    }

    // Fetch full details for each product
    const products: EnrichedProduct[] = [];
    const ratesMap: Record<string, any[]> = {};
    const feesMap: Record<string, any[]> = {};
    const featuresMap: Record<string, any[]> = {};
    const eligibilityMap: Record<string, any[]> = {};

    for (const id of ids) {
      const [productRows] = await Promise.all([
        db
          .select({
            id: cdrProducts.id,
            name: cdrProducts.name,
            description: cdrProducts.description,
            productCategory: cdrProducts.productCategory,
            applicationUri: cdrProducts.applicationUri,
            dataHolderName: cdrDataHolders.brandName,
            dataHolderLogo: cdrDataHolders.logoUri,
          })
          .from(cdrProducts)
          .leftJoin(cdrDataHolders, eq(cdrProducts.dataHolderId, cdrDataHolders.id))
          .where(eq(cdrProducts.id, id)),
      ]);

      if (!productRows.length) continue;
      const row = productRows[0];

      const [lendingRates, depositRates, featureRows, feeRows, eligRows] = await Promise.all([
        db.select().from(cdrLendingRates).where(eq(cdrLendingRates.productId, id)),
        db.select().from(cdrDepositRates).where(eq(cdrDepositRates.productId, id)),
        db.select().from(cdrFeatures).where(eq(cdrFeatures.productId, id)),
        db.select().from(cdrFees).where(eq(cdrFees.productId, id)),
        db.select().from(cdrEligibility).where(eq(cdrEligibility.productId, id)),
      ]);

      ratesMap[id] = [...lendingRates, ...depositRates];
      feesMap[id] = feeRows;
      featuresMap[id] = featureRows;
      eligibilityMap[id] = eligRows;

      let bestRate: number | null = null;
      let comparisonRate: number | null = null;
      let rateType: string | null = null;

      if (lendingRates.length > 0) {
        const sorted = [...lendingRates].sort((a: any, b: any) => a.rate - b.rate);
        bestRate = sorted[0].rate;
        comparisonRate = sorted[0].comparisonRate ?? null;
        rateType = sorted[0].lendingRateType;
      } else if (depositRates.length > 0) {
        const sorted = [...depositRates].sort((a: any, b: any) => b.rate - a.rate);
        bestRate = sorted[0].rate;
        rateType = sorted[0].depositRateType;
      }

      products.push({
        id: row.id,
        dataHolderName: row.dataHolderName ?? '',
        dataHolderLogo: row.dataHolderLogo ?? '',
        name: row.name,
        description: row.description ?? '',
        productCategory: row.productCategory,
        bestRate,
        comparisonRate,
        rateType,
        featureCount: featureRows.length,
        feeCount: feeRows.length,
        features: featureRows.map((f: any) => f.featureType),
        applicationUri: row.applicationUri ?? null,
      });
    }

    // Build comparison categories
    const categories: ComparisonCategory[] = [];

    // --- Rates ---
    const rateItems: ComparisonCategory['items'] = [];
    rateItems.push({
      label: 'Best Rate',
      values: Object.fromEntries(
        products.map((p) => [
          p.id,
          p.bestRate != null ? `${(p.bestRate * 100).toFixed(2)}%` : 'N/A',
        ]),
      ),
    });
    rateItems.push({
      label: 'Comparison Rate',
      values: Object.fromEntries(
        products.map((p) => [
          p.id,
          p.comparisonRate != null ? `${(p.comparisonRate * 100).toFixed(2)}%` : 'N/A',
        ]),
      ),
    });
    rateItems.push({
      label: 'Rate Type',
      values: Object.fromEntries(products.map((p) => [p.id, p.rateType ?? 'N/A'])),
    });
    categories.push({ name: 'Rates', items: rateItems });

    // --- Fees ---
    const annualFees: Record<string, number> = {};
    const feeItems: ComparisonCategory['items'] = [];

    // Collect all unique fee types across products
    const allFeeTypes = new Set<string>();
    for (const id of ids) {
      for (const fee of feesMap[id] ?? []) {
        allFeeTypes.add(fee.feeType);
      }
    }
    for (const feeType of allFeeTypes) {
      feeItems.push({
        label: feeType,
        values: Object.fromEntries(
          products.map((p) => {
            const fee = (feesMap[p.id] ?? []).find((f: any) => f.feeType === feeType);
            return [p.id, fee ? (fee.amount ?? 'See details') : 'N/A'];
          }),
        ),
      });
    }

    // Calculate total annual fees per product
    for (const p of products) {
      let totalAnnual = 0;
      for (const fee of feesMap[p.id] ?? []) {
        const amount = parseFloat(fee.amount ?? '0');
        if (!isNaN(amount)) {
          // Rough heuristic: monthly fees × 12, annual fees × 1
          if (fee.feeType === 'PERIODIC' && fee.additionalValue?.includes('P1M')) {
            totalAnnual += amount * 12;
          } else {
            totalAnnual += amount;
          }
        }
      }
      annualFees[p.id] = totalAnnual;
    }
    feeItems.push({
      label: 'Est. Annual Fees',
      values: Object.fromEntries(
        products.map((p) => [p.id, `$${annualFees[p.id]?.toFixed(2) ?? '0.00'}`]),
      ),
    });
    categories.push({ name: 'Fees', items: feeItems });

    // --- Features ---
    const allFeatureTypes = new Set<string>();
    for (const id of ids) {
      for (const feat of featuresMap[id] ?? []) {
        allFeatureTypes.add(feat.featureType);
      }
    }
    const featureItems: ComparisonCategory['items'] = [];
    for (const ft of allFeatureTypes) {
      featureItems.push({
        label: ft,
        values: Object.fromEntries(
          products.map((p) => {
            const has = (featuresMap[p.id] ?? []).some((f: any) => f.featureType === ft);
            return [p.id, has];
          }),
        ),
      });
    }
    categories.push({ name: 'Features', items: featureItems });

    // --- Eligibility ---
    const allEligTypes = new Set<string>();
    for (const id of ids) {
      for (const elig of eligibilityMap[id] ?? []) {
        allEligTypes.add(elig.eligibilityType);
      }
    }
    const eligItems: ComparisonCategory['items'] = [];
    for (const et of allEligTypes) {
      eligItems.push({
        label: et,
        values: Object.fromEntries(
          products.map((p) => {
            const elig = (eligibilityMap[p.id] ?? []).find((e: any) => e.eligibilityType === et);
            return [
              p.id,
              elig ? (elig.additionalInfo ?? elig.additionalValue ?? 'Required') : 'N/A',
            ];
          }),
        ),
      });
    }
    categories.push({ name: 'Eligibility', items: eligItems });

    // Generate recommendation
    let recommendation = 'No clear winner — review details above.';
    if (products.length >= 2) {
      // For lending: lowest rate wins. For deposit: highest rate wins.
      const isDeposit = products.some(
        (p) =>
          p.productCategory === 'TRANS_AND_SAVINGS_ACCOUNTS' ||
          p.productCategory === 'TERM_DEPOSITS',
      );
      const sorted = [...products]
        .filter((p) => p.bestRate != null)
        .sort((a, b) => {
          if (isDeposit) return (b.bestRate ?? 0) - (a.bestRate ?? 0);
          return (a.bestRate ?? Infinity) - (b.bestRate ?? Infinity);
        });
      if (sorted.length > 0) {
        const best = sorted[0];
        const bestAnnualFees = annualFees[best.id] ?? 0;
        recommendation =
          `${best.dataHolderName} — ${best.name} offers the best ${isDeposit ? 'highest' : 'lowest'} rate at ${((best.bestRate ?? 0) * 100).toFixed(2)}%` +
          (bestAnnualFees > 0
            ? ` (est. annual fees: $${bestAnnualFees.toFixed(2)})`
            : ' with no annual fees') +
          `. Features: ${best.featureCount}.`;
      }
    }

    return { products, categories, annualFees, recommendation };
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

    // Current loan cost
    const currentMonthlyPayment = pmt(currentBalance, currentRate / 12, remainingTermMonths);
    const currentTotalCost = currentMonthlyPayment * remainingTermMonths;

    // Find products with lower rates
    const bestRates = await this.getBestRates(productCategory, 'lending', topN * 3);

    // Filter to rates lower than current and deduplicate by product
    const seen = new Set<string>();
    const candidates: BestRateResult[] = [];
    for (const r of bestRates) {
      if (r.rate < currentRate && !seen.has(r.productId)) {
        seen.add(r.productId);
        candidates.push(r);
      }
      if (candidates.length >= topN) break;
    }

    // Calculate savings for each candidate
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

    // Sort by total lifetime saving descending
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
    // Get distinct categories with product counts
    const catRows = await db
      .select({
        category: cdrProducts.productCategory,
        count: sql<number>`COUNT(*)`,
      })
      .from(cdrProducts)
      .groupBy(cdrProducts.productCategory);

    const summaries: CategorySummary[] = [];

    for (const row of catRows) {
      // Get lending rate stats for this category
      const lendingStats = await db
        .select({
          avg: sql<number>`AVG(${cdrLendingRates.rate})`,
          min: sql<number>`MIN(${cdrLendingRates.rate})`,
          max: sql<number>`MAX(${cdrLendingRates.rate})`,
        })
        .from(cdrLendingRates)
        .innerJoin(cdrProducts, eq(cdrLendingRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.productCategory, row.category));

      // Get deposit rate stats for this category
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

      // Combine min/max across both rate types
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
      // Count products for this holder
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(cdrProducts)
        .where(eq(cdrProducts.dataHolderId, h.id));
      const productCount = countResult[0]?.count ?? 0;

      // Average lending rate across this holder's products
      const lendingAvg = await db
        .select({ avg: sql<number>`AVG(${cdrLendingRates.rate})` })
        .from(cdrLendingRates)
        .innerJoin(cdrProducts, eq(cdrLendingRates.productId, cdrProducts.id))
        .where(eq(cdrProducts.dataHolderId, h.id));

      // Average deposit rate
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
