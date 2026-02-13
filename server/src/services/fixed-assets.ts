/**
 * Fixed Asset Depreciation Service
 *
 * ATO-compliant depreciation engine supporting:
 * - Straight Line (Div 40 ITAA 1997)
 * - Diminishing Value (200% rate per ATO TR 2024/3)
 * - Instant Write-Off (SBE threshold $20,000)
 * - Low Value Pool (37.5% first year, 30% subsequent)
 *
 * All monetary values are in cents (integer) to avoid floating-point precision issues.
 */

import { db, depreciableAssets, depreciationSchedule } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type AssetCategory =
  | 'plant_and_equipment'
  | 'motor_vehicle'
  | 'office_equipment'
  | 'computer_equipment'
  | 'furniture_fittings'
  | 'building'
  | 'land'
  | 'leasehold_improvement'
  | 'intangible'
  | 'low_value_pool';

export type DepreciationMethod =
  | 'straight_line'
  | 'diminishing_value'
  | 'instant_write_off'
  | 'low_value_pool';

export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated' | 'written_off';

export interface FixedAsset {
  id: string;
  userId: string;
  entityId: string | null;
  accountId: string | null;
  assetNumber: string;
  assetName: string;
  category: AssetCategory;
  purchaseDate: string;
  purchasePrice: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  effectiveLifeYears: number;
  openingWrittenDownValue: number;
  currentWrittenDownValue: number;
  status: AssetStatus;
  location: string | null;
  serialNumber: string | null;
  supplier: string | null;
  invoiceReference: string | null;
  gstClaimed: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDisposal {
  id: string;
  assetId: string;
  disposalDate: string;
  disposalMethod: string;
  proceeds: number;
  gstOnProceeds: number;
  writtenDownValueAtDisposal: number;
  profitLoss: number;
  cgtApplicable: boolean;
  cgtDiscountEligible: boolean;
  buyerDetails: string | null;
  invoiceReference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DepreciationResult {
  openingValue: number;
  depreciationAmount: number;
  closingValue: number;
  rate: number;
  method: DepreciationMethod;
  daysHeld: number;
}

// ============================================================================
// ATO EFFECTIVE LIFE TABLE (years)
// Per ATO TR 2024/3 — Effective life of depreciating assets
// ============================================================================

const ATO_EFFECTIVE_LIVES: Record<AssetCategory, number> = {
  plant_and_equipment: 10,
  motor_vehicle: 8,
  office_equipment: 10,
  computer_equipment: 4,
  furniture_fittings: 13.33,
  building: 40,
  land: 0, // land is not depreciated
  leasehold_improvement: 10,
  intangible: 5,
  low_value_pool: 0, // pool rate, not life-based
};

/** SBE instant write-off threshold in cents ($20,000) */
const INSTANT_WRITE_OFF_THRESHOLD = 20_000_00;

/** Low value pool threshold in cents ($1,000) */
const LOW_VALUE_POOL_THRESHOLD = 1_000_00;

/** LVP first year rate */
const LVP_FIRST_YEAR_RATE = 0.375;

/** LVP subsequent year rate */
const LVP_SUBSEQUENT_RATE = 0.3;

// ============================================================================
// FINANCIAL YEAR HELPERS
// ============================================================================

/** Parse a financial year string like "2024-25" into start/end dates */
function parseFY(fy: string): { start: Date; end: Date } {
  const parts = fy.split('-');
  const startYear = parseInt(parts[0], 10);
  // FY 2024-25 runs from 1 July 2024 to 30 June 2025
  return {
    start: new Date(startYear, 6, 1), // July 1
    end: new Date(startYear + 1, 5, 30), // June 30
  };
}

/** Get the financial year string for a given date (e.g., 2025-01-15 → "2024-25") */
function getFYForDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  if (month >= 6) {
    // July onwards = start of new FY
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/** Calculate days between two dates (inclusive of start, exclusive of end) */
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / msPerDay));
}

// ============================================================================
// FIXED ASSET SERVICE
// ============================================================================

export class FixedAssetService {
  /**
   * Register a new fixed asset in the asset register.
   * Generates a unique asset number, looks up ATO effective life if not provided,
   * and calculates the opening WDV (purchase price minus GST claimed).
   */
  async registerAsset(params: {
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

    // Generate asset number: FA-YYYY-NNNN
    const assetNumber = await this.generateAssetNumber(params.userId);

    // Look up ATO effective life if not provided
    const effectiveLifeYears =
      params.effectiveLifeYears ?? ATO_EFFECTIVE_LIVES[params.category] ?? 10;

    const usefulLifeMonths = params.usefulLifeMonths ?? Math.round(effectiveLifeYears * 12);

    const residualValue = params.residualValue ?? 0;
    const gstClaimed = params.gstClaimed ?? 0;

    // Opening WDV = purchase price minus GST claimed
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

    // Insert into the depreciableAssets table (existing schema table)
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
   * Cannot change purchasePrice, purchaseDate, or depreciationMethod
   * after depreciation has been run.
   */
  async updateAsset(
    assetId: string,
    updates: {
      assetName?: string;
      location?: string;
      serialNumber?: string;
      depreciationMethod?: DepreciationMethod;
    },
  ): Promise<void> {
    // If changing depreciation method, verify no depreciation records exist
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
   * Calculate depreciation for a single asset for a given financial year.
   *
   * Formulas (ATO Div 40 ITAA 1997):
   * - Straight Line: (cost - residual) / useful_life_years * (days_held / 365)
   * - Diminishing Value: opening_WDV * (2 / effective_life_years) * (days_held / 365)
   * - Instant Write-Off: full deduction if under threshold in purchase year
   * - Low Value Pool: 37.5% first year, 30% subsequent
   */
  async calculateDepreciation(assetId: string, financialYear: string): Promise<DepreciationResult> {
    // Fetch asset details
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
    const residualValue: number = 0; // depreciableAssets table doesn't have residual; default 0
    const effectiveLifeYears: number = asset.effectiveLifeYears ?? 10;
    const usefulLifeMonths: number = asset.effectiveLife ?? effectiveLifeYears * 12;
    const usefulLifeYears = usefulLifeMonths / 12;
    const openingWDV: number = asset.currentWrittenDownValue ?? asset.currentValue ?? 0;
    const method: DepreciationMethod =
      (asset.depreciationMethod as DepreciationMethod) ?? 'diminishing_value';

    // Check if asset is already fully depreciated
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

    // Check for existing depreciation record for this FY (prevent duplicates)
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

    // Calculate days held in this FY (pro-rata for part-year)
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
        // SL: (cost - residual) / useful_life_years * (days_held / 365)
        if (usefulLifeYears <= 0) break;
        const annualDepr = (purchasePrice - residualValue) / usefulLifeYears;
        rate = 1 / usefulLifeYears;
        depreciationAmount = Math.round(annualDepr * (daysHeld / daysInYear));
        break;
      }

      case 'diminishing_value': {
        // DV: opening_WDV * (2 / effective_life_years) * (days_held / 365)
        // 200% rate per ATO
        if (effectiveLifeYears <= 0) break;
        rate = 2 / effectiveLifeYears;
        depreciationAmount = Math.round(openingWDV * rate * (daysHeld / daysInYear));
        break;
      }

      case 'instant_write_off': {
        // Full deduction if under threshold, only in purchase year
        const purchaseFY = getFYForDate(asset.purchaseDate);
        if (purchaseFY === financialYear && purchasePrice < INSTANT_WRITE_OFF_THRESHOLD) {
          depreciationAmount = openingWDV;
          rate = 1;
        }
        break;
      }

      case 'low_value_pool': {
        // LVP: 37.5% first year, 30% subsequent
        const purchaseFY = getFYForDate(asset.purchaseDate);
        if (purchaseFY === financialYear) {
          rate = LVP_FIRST_YEAR_RATE;
        } else {
          rate = LVP_SUBSEQUENT_RATE;
        }
        depreciationAmount = Math.round(openingWDV * rate);
        break;
      }
    }

    // Ensure depreciation doesn't reduce WDV below residual value
    if (openingWDV - depreciationAmount < residualValue) {
      depreciationAmount = openingWDV - residualValue;
    }

    // Ensure non-negative
    depreciationAmount = Math.max(0, depreciationAmount);

    const closingValue = openingWDV - depreciationAmount;

    return {
      openingValue: openingWDV,
      depreciationAmount,
      closingValue,
      rate,
      method,
      daysHeld,
    };
  }

  /**
   * Run batch depreciation for all active assets for a user/entity in a given FY.
   * Inserts depreciation records and updates current WDV on each asset.
   */
  async runBatchDepreciation(
    userId: string,
    financialYear: string,
    entityId?: string,
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
    // Fetch all active assets for user
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
        const depr = await this.calculateDepreciation(asset.id, financialYear);

        if (depr.depreciationAmount > 0) {
          // Insert depreciation record
          await db.insert(depreciationSchedule).values({
            id: crypto.randomUUID(),
            assetId: asset.id,
            financialYear,
            openingValue: depr.openingValue,
            depreciationAmount: depr.depreciationAmount,
            closingValue: depr.closingValue,
            createdAt: new Date().toISOString(),
          });

          // Update the asset's current WDV
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
        errors.push({
          assetId: asset.id,
          error: err.message ?? String(err),
        });
      }
    }

    return {
      assetsProcessed: results.length,
      totalDepreciation,
      results,
      errors,
    };
  }

  /**
   * Record disposal of a fixed asset.
   * Calculates pro-rata depreciation to disposal date, profit/loss, and CGT eligibility.
   */
  async recordDisposal(params: {
    assetId: string;
    disposalDate: string;
    disposalMethod: 'sale' | 'scrapped' | 'trade_in' | 'theft' | 'insurance_claim';
    proceeds?: number;
    gstOnProceeds?: number;
    buyerDetails?: string;
    invoiceReference?: string;
    notes?: string;
  }): Promise<AssetDisposal> {
    // Fetch asset
    const rows = await db
      .select()
      .from(depreciableAssets)
      .where(eq(depreciableAssets.id, params.assetId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Asset not found: ${params.assetId}`);
    }

    const asset: any = rows[0];
    const proceeds = params.proceeds ?? 0;
    const gstOnProceeds = params.gstOnProceeds ?? 0;
    const wdvAtDisposal: number = asset.currentWrittenDownValue ?? asset.currentValue ?? 0;

    // Calculate profit/loss: proceeds - GST on proceeds - WDV
    const profitLoss = proceeds - gstOnProceeds - wdvAtDisposal;

    // CGT: applicable if held > 12 months and there's a capital gain
    const purchaseDate = new Date(asset.purchaseDate);
    const disposalDate = new Date(params.disposalDate);
    const daysHeld = daysBetween(purchaseDate, disposalDate);
    const cgtApplicable = daysHeld > 365 && profitLoss > 0;
    const cgtDiscountEligible = daysHeld > 365; // 50% CGT discount for individuals

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

    // Update asset status to disposed
    await db
      .update(depreciableAssets)
      .set({
        isActive: false,
      })
      .where(eq(depreciableAssets.id, params.assetId));

    return disposal;
  }

  /**
   * Get the full asset register for a user, with optional filters and summary aggregation.
   */
  async getAssetRegister(
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
    // Build base query conditions
    const conditions: any[] = [eq(depreciableAssets.userId, userId)];

    if (filters?.category) {
      conditions.push(eq(depreciableAssets.assetCategory, filters.category));
    }
    if (filters?.status === 'active') {
      conditions.push(eq(depreciableAssets.isActive, true));
    } else if (
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

    // Map DB rows to FixedAsset interface
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

    // Filter by date range in memory (simpler than building dynamic SQL)
    let filtered = assets;
    if (filters?.purchaseDateFrom) {
      filtered = filtered.filter((a) => a.purchaseDate >= filters.purchaseDateFrom!);
    }
    if (filters?.purchaseDateTo) {
      filtered = filtered.filter((a) => a.purchaseDate <= filters.purchaseDateTo!);
    }

    // Compute summary
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
      } else {
        categoryMap.set(a.category, {
          count: 1,
          cost: a.purchasePrice,
          wdv: a.currentWrittenDownValue,
        });
      }
    }

    const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));

    return {
      assets: filtered,
      summary: {
        totalAssets: filtered.length,
        totalCost,
        totalWDV,
        totalDepreciationToDate: totalCost - totalWDV,
        byCategory,
      },
    };
  }

  /**
   * Get depreciation schedule for a financial year — a report showing all assets,
   * their opening values, depreciation, and closing values.
   */
  async getDepreciationSchedule(
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
    // Get all assets for user
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

    let totalOpening = 0;
    let totalDepr = 0;
    let totalClosing = 0;
    let totalAdditions = 0;
    let totalDisposals = 0;

    for (const asset of allAssets as any[]) {
      // Check if there's a depreciation record for this FY
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

      // Additions: assets purchased during this FY
      const purchaseDate = asset.purchaseDate ?? '';
      const isAddition = purchaseDate >= fyStartStr && purchaseDate <= fyEndStr;
      const additions = isAddition ? (asset.purchaseCost ?? 0) : 0;

      // Disposals: assets disposed during this FY (marked inactive)
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

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async generateAssetNumber(userId: string): Promise<string> {
    const count = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(depreciableAssets)
      .where(eq(depreciableAssets.userId, userId));

    const nextNumber = ((count[0] as any)?.count ?? 0) + 1;
    const year = new Date().getFullYear();

    return `FA-${year}-${String(nextNumber).padStart(4, '0')}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const fixedAssetService = new FixedAssetService();
