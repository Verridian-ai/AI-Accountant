/**
 * CDR Products — Product Search Implementation
 */

import {
  db,
  cdrProducts,
  cdrDataHolders,
  cdrLendingRates,
  cdrDepositRates,
  cdrFees,
  cdrFeatures,
} from '../../schema.js';
import { eq, and, like, inArray, sql } from 'drizzle-orm';
import type { ProductSearchFilters, EnrichedProduct, ProductSearchResult } from './types.js';

export async function searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
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
      const matchesLending = lendingRates.some((r: any) => r.lendingRateType === filters.rateType);
      const matchesDeposit = depositRates.some((r: any) => r.depositRateType === filters.rateType);
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
