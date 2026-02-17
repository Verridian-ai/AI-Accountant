/**
 * Fixed Asset Register — Registration, Update, Disposal, and Reporting
 */

import { db, depreciableAssets, depreciationSchedule } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  AssetCategory,
  AssetStatus,
  DepreciationMethod,
  FixedAsset,
  AssetDisposal,
} from './types.js';
import { ATO_EFFECTIVE_LIVES, daysBetween } from './types.js';
import { generateAssetNumber } from './schedule-report.js';

/**
 * Register a new fixed asset in the asset register.
 */
export async function registerAsset(params: {
  userId: string;
  entityId?: string;
  accountId?: string;
  assetName: string;
  category: AssetCategory;
  purchaseDate: string;
  purchasePrice: number;
  residualValue?: number;
  usefulLifeMonths?: number;
  depreciationMethod: DepreciationMethod;
  effectiveLifeYears?: number;
  location?: string;
  serialNumber?: string;
  supplier?: string;
  invoiceReference?: string;
  gstClaimed?: number;
}): Promise<FixedAsset> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const assetNumber = await generateAssetNumber(params.userId);
  const effectiveLifeYears =
    params.effectiveLifeYears ?? ATO_EFFECTIVE_LIVES[params.category] ?? 10;
  const usefulLifeMonths = params.usefulLifeMonths ?? Math.round(effectiveLifeYears * 12);
  const residualValue = params.residualValue ?? 0;
  const gstClaimed = params.gstClaimed ?? 0;
  const openingWDV = params.purchasePrice - gstClaimed;

  const asset: FixedAsset = {
    id,
    userId: params.userId,
    entityId: params.entityId ?? null,
    accountId: params.accountId ?? null,
    assetNumber,
    assetName: params.assetName,
    category: params.category,
    purchaseDate: params.purchaseDate,
    purchasePrice: params.purchasePrice,
    residualValue,
    usefulLifeMonths,
    depreciationMethod: params.depreciationMethod,
    effectiveLifeYears,
    openingWrittenDownValue: openingWDV,
    currentWrittenDownValue: openingWDV,
    status: 'active',
    location: params.location ?? null,
    serialNumber: params.serialNumber ?? null,
    supplier: params.supplier ?? null,
    invoiceReference: params.invoiceReference ?? null,
    gstClaimed,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(depreciableAssets).values({
    id,
    userId: params.userId,
    assetName: params.assetName,
    assetCategory: params.category,
    purchaseDate: params.purchaseDate,
    purchaseCost: params.purchasePrice,
    effectiveLife: usefulLifeMonths,
    effectiveLifeYears: Math.round(effectiveLifeYears),
    depreciationMethod: params.depreciationMethod,
    openingValue: openingWDV,
    openingWrittenDownValue: openingWDV,
    currentValue: openingWDV,
    currentWrittenDownValue: openingWDV,
    businessUsePercentage: 100,
    isInstantWriteOff: params.depreciationMethod === 'instant_write_off',
    isActive: true,
    createdAt: now,
  });

  return asset;
}

/**
 * Update mutable fields of an asset.
 */
export async function updateAsset(
  assetId: string,
  updates: {
    assetName?: string;
    location?: string;
    serialNumber?: string;
    depreciationMethod?: DepreciationMethod;
  },
): Promise<void> {
  if (updates.depreciationMethod) {
    const existing = await db
      .select()
      .from(depreciationSchedule)
      .where(eq(depreciationSchedule.assetId, assetId))
      .limit(1);
    if (existing.length > 0) {
      throw new Error('Cannot change depreciation method after depreciation has been recorded');
    }
  }

  const now = new Date().toISOString();
  const setValues: Record<string, any> = { updatedAt: now };
  if (updates.assetName !== undefined) setValues.assetName = updates.assetName;
  if (updates.depreciationMethod !== undefined) {
    setValues.depreciationMethod = updates.depreciationMethod;
    setValues.isInstantWriteOff = updates.depreciationMethod === 'instant_write_off';
  }

  await db.update(depreciableAssets).set(setValues).where(eq(depreciableAssets.id, assetId));
}

/**
 * Record disposal of a fixed asset.
 */
export async function recordDisposal(params: {
  assetId: string;
  disposalDate: string;
  disposalMethod: 'sale' | 'scrapped' | 'trade_in' | 'theft' | 'insurance_claim';
  proceeds?: number;
  gstOnProceeds?: number;
  buyerDetails?: string;
  invoiceReference?: string;
  notes?: string;
}): Promise<AssetDisposal> {
  const rows = await db
    .select()
    .from(depreciableAssets)
    .where(eq(depreciableAssets.id, params.assetId))
    .limit(1);

  if (rows.length === 0) throw new Error(`Asset not found: ${params.assetId}`);

  const asset: any = rows[0];
  const proceeds = params.proceeds ?? 0;
  const gstOnProceeds = params.gstOnProceeds ?? 0;
  const wdvAtDisposal: number = asset.currentWrittenDownValue ?? asset.currentValue ?? 0;
  const profitLoss = proceeds - gstOnProceeds - wdvAtDisposal;

  const purchaseDate = new Date(asset.purchaseDate);
  const disposalDate = new Date(params.disposalDate);
  const daysHeld = daysBetween(purchaseDate, disposalDate);
  const cgtApplicable = daysHeld > 365 && profitLoss > 0;
  const cgtDiscountEligible = daysHeld > 365;

  const disposal: AssetDisposal = {
    id: crypto.randomUUID(),
    assetId: params.assetId,
    disposalDate: params.disposalDate,
    disposalMethod: params.disposalMethod,
    proceeds,
    gstOnProceeds,
    writtenDownValueAtDisposal: wdvAtDisposal,
    profitLoss,
    cgtApplicable,
    cgtDiscountEligible,
    buyerDetails: params.buyerDetails ?? null,
    invoiceReference: params.invoiceReference ?? null,
    notes: params.notes ?? null,
    createdAt: new Date().toISOString(),
  };

  await db
    .update(depreciableAssets)
    .set({ isActive: false })
    .where(eq(depreciableAssets.id, params.assetId));

  return disposal;
}

/**
 * Get the full asset register for a user.
 */
export async function getAssetRegister(
  userId: string,
  filters?: {
    entityId?: string;
    category?: AssetCategory;
    status?: AssetStatus;
    purchaseDateFrom?: string;
    purchaseDateTo?: string;
  },
): Promise<{
  assets: FixedAsset[];
  summary: {
    totalAssets: number;
    totalCost: number;
    totalWDV: number;
    totalDepreciationToDate: number;
    byCategory: Array<{ category: string; count: number; cost: number; wdv: number }>;
  };
}> {
  const conditions: any[] = [eq(depreciableAssets.userId, userId)];
  if (filters?.category) conditions.push(eq(depreciableAssets.assetCategory, filters.category));
  if (filters?.status === 'active') conditions.push(eq(depreciableAssets.isActive, true));
  else if (
    filters?.status === 'disposed' ||
    filters?.status === 'fully_depreciated' ||
    filters?.status === 'written_off'
  ) {
    conditions.push(eq(depreciableAssets.isActive, false));
  }

  const rows = await db
    .select()
    .from(depreciableAssets)
    .where(and(...conditions));

  const assets: FixedAsset[] = (rows as any[]).map((r: any) => ({
    id: r.id,
    userId: r.userId,
    entityId: null,
    accountId: null,
    assetNumber: `FA-${r.purchaseDate?.slice(0, 4) ?? '0000'}-${r.id.slice(0, 4).toUpperCase()}`,
    assetName: r.assetName,
    category: r.assetCategory as AssetCategory,
    purchaseDate: r.purchaseDate,
    purchasePrice: r.purchaseCost,
    residualValue: 0,
    usefulLifeMonths: r.effectiveLife ?? 0,
    depreciationMethod: r.depreciationMethod as DepreciationMethod,
    effectiveLifeYears: r.effectiveLifeYears ?? 0,
    openingWrittenDownValue: r.openingWrittenDownValue ?? r.openingValue ?? 0,
    currentWrittenDownValue: r.currentWrittenDownValue ?? r.currentValue ?? 0,
    status: r.isActive ? ('active' as AssetStatus) : ('disposed' as AssetStatus),
    location: null,
    serialNumber: null,
    supplier: null,
    invoiceReference: null,
    gstClaimed: 0,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
  }));

  let filtered = assets;
  if (filters?.purchaseDateFrom)
    filtered = filtered.filter((a) => a.purchaseDate >= filters.purchaseDateFrom!);
  if (filters?.purchaseDateTo)
    filtered = filtered.filter((a) => a.purchaseDate <= filters.purchaseDateTo!);

  let totalCost = 0;
  let totalWDV = 0;
  const categoryMap = new Map<string, { count: number; cost: number; wdv: number }>();

  for (const a of filtered) {
    totalCost += a.purchasePrice;
    totalWDV += a.currentWrittenDownValue;
    const existing = categoryMap.get(a.category);
    if (existing) {
      existing.count++;
      existing.cost += a.purchasePrice;
      existing.wdv += a.currentWrittenDownValue;
    } else
      categoryMap.set(a.category, {
        count: 1,
        cost: a.purchasePrice,
        wdv: a.currentWrittenDownValue,
      });
  }

  return {
    assets: filtered,
    summary: {
      totalAssets: filtered.length,
      totalCost,
      totalWDV,
      totalDepreciationToDate: totalCost - totalWDV,
      byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        ...data,
      })),
    },
  };
}
