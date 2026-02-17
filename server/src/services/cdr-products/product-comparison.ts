/**
 * CDR Products — Product Comparison Implementation
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
} from '../../schema.js';
import { eq } from 'drizzle-orm';
import type { EnrichedProduct, ComparisonCategory, ProductComparison } from './types.js';

export async function compareProducts(productIds: string[]): Promise<ProductComparison> {
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
      products.map((p) => [p.id, p.bestRate != null ? `${(p.bestRate * 100).toFixed(2)}%` : 'N/A']),
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

  for (const p of products) {
    let totalAnnual = 0;
    for (const fee of feesMap[p.id] ?? []) {
      const amount = parseFloat(fee.amount ?? '0');
      if (!isNaN(amount)) {
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
          return [p.id, elig ? (elig.additionalInfo ?? elig.additionalValue ?? 'Required') : 'N/A'];
        }),
      ),
    });
  }
  categories.push({ name: 'Eligibility', items: eligItems });

  // Generate recommendation
  let recommendation = 'No clear winner — review details above.';
  if (products.length >= 2) {
    const isDeposit = products.some(
      (p) =>
        p.productCategory === 'TRANS_AND_SAVINGS_ACCOUNTS' || p.productCategory === 'TERM_DEPOSITS',
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
