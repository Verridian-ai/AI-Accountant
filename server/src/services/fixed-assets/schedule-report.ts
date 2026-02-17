/**
 * Depreciation Schedule Report — FY schedule generation and asset numbering
 */

import { db, depreciableAssets, depreciationSchedule } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { parseFY } from './types.js';

/**
 * Get depreciation schedule for a financial year.
 */
export async function getDepreciationSchedule(
  userId: string,
  financialYear: string,
  _entityId?: string,
): Promise<{
  financialYear: string;
  assets: Array<{
    assetId: string;
    assetName: string;
    category: string;
    method: string;
    openingValue: number;
    depreciation: number;
    closingValue: number;
    additions: number;
    disposals: number;
  }>;
  totals: {
    openingValue: number;
    totalDepreciation: number;
    closingValue: number;
    totalAdditions: number;
    totalDisposals: number;
  };
}> {
  const allAssets = await db
    .select()
    .from(depreciableAssets)
    .where(eq(depreciableAssets.userId, userId));
  const fy = parseFY(financialYear);
  const fyStartStr = fy.start.toISOString().slice(0, 10);
  const fyEndStr = fy.end.toISOString().slice(0, 10);

  const assetEntries: Array<{
    assetId: string;
    assetName: string;
    category: string;
    method: string;
    openingValue: number;
    depreciation: number;
    closingValue: number;
    additions: number;
    disposals: number;
  }> = [];
  let totalOpening = 0,
    totalDepr = 0,
    totalClosing = 0,
    totalAdditions = 0,
    totalDisposals = 0;

  for (const asset of allAssets as any[]) {
    const deprRows = await db
      .select()
      .from(depreciationSchedule)
      .where(
        and(
          eq(depreciationSchedule.assetId, asset.id),
          eq(depreciationSchedule.financialYear, financialYear),
        ),
      )
      .limit(1);

    const depr: any = deprRows[0];
    const openingValue =
      depr?.openingValue ?? asset.openingWrittenDownValue ?? asset.openingValue ?? 0;
    const depreciationAmt = depr?.depreciationAmount ?? 0;
    const closingValue = depr?.closingValue ?? openingValue - depreciationAmt;
    const purchaseDate = asset.purchaseDate ?? '';
    const isAddition = purchaseDate >= fyStartStr && purchaseDate <= fyEndStr;
    const additions = isAddition ? (asset.purchaseCost ?? 0) : 0;
    const isDisposed = !asset.isActive;
    const disposals = isDisposed && !isAddition ? openingValue : 0;

    assetEntries.push({
      assetId: asset.id,
      assetName: asset.assetName,
      category: asset.assetCategory,
      method: asset.depreciationMethod,
      openingValue,
      depreciation: depreciationAmt,
      closingValue,
      additions,
      disposals,
    });
    totalOpening += openingValue;
    totalDepr += depreciationAmt;
    totalClosing += closingValue;
    totalAdditions += additions;
    totalDisposals += disposals;
  }

  return {
    financialYear,
    assets: assetEntries,
    totals: {
      openingValue: totalOpening,
      totalDepreciation: totalDepr,
      closingValue: totalClosing,
      totalAdditions,
      totalDisposals,
    },
  };
}

/**
 * Generate a unique asset number for a user.
 */
export async function generateAssetNumber(userId: string): Promise<string> {
  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(depreciableAssets)
    .where(eq(depreciableAssets.userId, userId));
  const nextNumber = ((count[0] as any)?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  return `FA-${year}-${String(nextNumber).padStart(4, '0')}`;
}
