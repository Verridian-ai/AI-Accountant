/**
 * Fixed Asset Depreciation Calculation
 *
 * Calculates depreciation for individual assets and runs batch depreciation.
 */

import { db, depreciableAssets, depreciationSchedule } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { AssetStatus, DepreciationMethod, DepreciationResult } from './types.js';
import {
  INSTANT_WRITE_OFF_THRESHOLD,
  LVP_FIRST_YEAR_RATE,
  LVP_SUBSEQUENT_RATE,
  parseFY,
  getFYForDate,
  daysBetween,
} from './types.js';

/**
 * Calculate depreciation for a single asset for a given financial year.
 */
export async function calculateDepreciation(
  assetId: string,
  financialYear: string,
): Promise<DepreciationResult> {
  const rows = await db
    .select()
    .from(depreciableAssets)
    .where(eq(depreciableAssets.id, assetId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const asset: any = rows[0];
  const fy = parseFY(financialYear);
  const purchaseDate = new Date(asset.purchaseDate);

  const purchasePrice: number = asset.purchaseCost ?? 0;
  const residualValue: number = 0;
  const effectiveLifeYears: number = asset.effectiveLifeYears ?? 10;
  const usefulLifeMonths: number = asset.effectiveLife ?? effectiveLifeYears * 12;
  const usefulLifeYears = usefulLifeMonths / 12;
  const openingWDV: number = asset.currentWrittenDownValue ?? asset.currentValue ?? 0;
  const method: DepreciationMethod =
    (asset.depreciationMethod as DepreciationMethod) ?? 'diminishing_value';

  if (openingWDV <= residualValue) {
    return {
      openingValue: openingWDV,
      depreciationAmount: 0,
      closingValue: openingWDV,
      rate: 0,
      method,
      daysHeld: 0,
    };
  }

  const existingDepr = await db
    .select()
    .from(depreciationSchedule)
    .where(
      and(
        eq(depreciationSchedule.assetId, assetId),
        eq(depreciationSchedule.financialYear, financialYear),
      ),
    )
    .limit(1);

  if (existingDepr.length > 0) {
    const existing: any = existingDepr[0];
    return {
      openingValue: existing.openingValue ?? openingWDV,
      depreciationAmount: existing.depreciationAmount ?? 0,
      closingValue: existing.closingValue ?? openingWDV,
      rate: 0,
      method,
      daysHeld: 0,
    };
  }

  const holdStart = purchaseDate > fy.start ? purchaseDate : fy.start;
  const holdEnd = fy.end;
  const daysHeld = daysBetween(holdStart, holdEnd);
  const daysInYear = 365;

  if (daysHeld <= 0) {
    return {
      openingValue: openingWDV,
      depreciationAmount: 0,
      closingValue: openingWDV,
      rate: 0,
      method,
      daysHeld: 0,
    };
  }

  let depreciationAmount = 0;
  let rate = 0;

  switch (method) {
    case 'straight_line': {
      if (usefulLifeYears <= 0) break;
      const annualDepr = (purchasePrice - residualValue) / usefulLifeYears;
      rate = 1 / usefulLifeYears;
      depreciationAmount = Math.round(annualDepr * (daysHeld / daysInYear));
      break;
    }
    case 'diminishing_value': {
      if (effectiveLifeYears <= 0) break;
      rate = 2 / effectiveLifeYears;
      depreciationAmount = Math.round(openingWDV * rate * (daysHeld / daysInYear));
      break;
    }
    case 'instant_write_off': {
      const purchaseFY = getFYForDate(asset.purchaseDate);
      if (purchaseFY === financialYear && purchasePrice < INSTANT_WRITE_OFF_THRESHOLD) {
        depreciationAmount = openingWDV;
        rate = 1;
      }
      break;
    }
    case 'low_value_pool': {
      const purchaseFY = getFYForDate(asset.purchaseDate);
      rate = purchaseFY === financialYear ? LVP_FIRST_YEAR_RATE : LVP_SUBSEQUENT_RATE;
      depreciationAmount = Math.round(openingWDV * rate);
      break;
    }
  }

  if (openingWDV - depreciationAmount < residualValue) {
    depreciationAmount = openingWDV - residualValue;
  }
  depreciationAmount = Math.max(0, depreciationAmount);
  const closingValue = openingWDV - depreciationAmount;

  return { openingValue: openingWDV, depreciationAmount, closingValue, rate, method, daysHeld };
}

/**
 * Run batch depreciation for all active assets for a user/entity in a given FY.
 */
export async function runBatchDepreciation(
  userId: string,
  financialYear: string,
  _entityId?: string,
): Promise<{
  assetsProcessed: number;
  totalDepreciation: number;
  results: Array<{
    assetId: string;
    assetName: string;
    depreciationAmount: number;
    closingValue: number;
  }>;
  errors: Array<{ assetId: string; error: string }>;
}> {
  const allAssets = await db
    .select()
    .from(depreciableAssets)
    .where(and(eq(depreciableAssets.userId, userId), eq(depreciableAssets.isActive, true)));

  const results: Array<{
    assetId: string;
    assetName: string;
    depreciationAmount: number;
    closingValue: number;
  }> = [];
  const errors: Array<{ assetId: string; error: string }> = [];
  let totalDepreciation = 0;

  for (const asset of allAssets as any[]) {
    try {
      const depr = await calculateDepreciation(asset.id, financialYear);

      if (depr.depreciationAmount > 0) {
        await db.insert(depreciationSchedule).values({
          id: crypto.randomUUID(),
          assetId: asset.id,
          financialYear,
          openingValue: depr.openingValue,
          depreciationAmount: depr.depreciationAmount,
          closingValue: depr.closingValue,
          createdAt: new Date().toISOString(),
        });

        const newStatus: AssetStatus = depr.closingValue <= 0 ? 'fully_depreciated' : 'active';
        await db
          .update(depreciableAssets)
          .set({
            currentValue: depr.closingValue,
            currentWrittenDownValue: depr.closingValue,
            isActive: newStatus === 'active',
          })
          .where(eq(depreciableAssets.id, asset.id));

        totalDepreciation += depr.depreciationAmount;
      }

      results.push({
        assetId: asset.id,
        assetName: asset.assetName,
        depreciationAmount: depr.depreciationAmount,
        closingValue: depr.closingValue,
      });
    } catch (err: any) {
      errors.push({ assetId: asset.id, error: err.message ?? String(err) });
    }
  }

  return { assetsProcessed: results.length, totalDepreciation, results, errors };
}
