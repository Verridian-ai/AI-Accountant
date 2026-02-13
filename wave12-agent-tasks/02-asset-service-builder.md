# Agent 2: Asset Service Builder

## Role
Build the fixed asset depreciation engine with all ATO-compliant calculation methods and asset lifecycle management.

## Priority: WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/fixed-assets.ts`
**Purpose**: Complete fixed asset register management with ATO-compliant depreciation calculations
**Pattern**: Pure service class, imports Drizzle schema from `server/src/schema.ts`
**Reference**: ATO TR 2024/3 (Effective life of depreciating assets), Div 40 ITAA 1997

- [ ] Create `FixedAssetService` class with the following methods:

**registerAsset(params)**:
```typescript
registerAsset(params: {
  userId: string;
  entityId?: string;
  accountId?: string;
  assetName: string;
  category: AssetCategory;
  purchaseDate: string;      // ISO date
  purchasePrice: number;     // cents
  residualValue?: number;    // cents
  usefulLifeMonths?: number;
  depreciationMethod: DepreciationMethod;
  effectiveLifeYears?: number;
  location?: string;
  serialNumber?: string;
  supplier?: string;
  invoiceReference?: string;
  gstClaimed?: number;       // cents
}): Promise<FixedAsset>
```
- Generate unique `assetNumber` (format: `FA-YYYY-NNNN`)
- If `effectiveLifeYears` not provided, look up ATO effective life table by category
- Set `openingWrittenDownValue` = `purchasePrice - gstClaimed`
- Set `currentWrittenDownValue` = `openingWrittenDownValue`
- Insert into `fixedAssets` table
- Return the created asset record

**updateAsset(assetId, updates)**:
- Partial update of mutable fields (name, description, location, serialNumber)
- Cannot change purchasePrice, purchaseDate, or depreciationMethod after depreciation has been run
- Validate no depreciation records exist before allowing method change
- Update `updatedAt` timestamp

**calculateDepreciation(assetId, financialYear)**:
```typescript
calculateDepreciation(assetId: string, financialYear: string): Promise<{
  openingValue: number;
  depreciationAmount: number;
  closingValue: number;
  rate: number;
  method: DepreciationMethod;
  daysHeld: number;
}>
```
- **Straight Line**: `depreciation = (cost - residual) / useful_life * (days_held / 365)`
- **Diminishing Value**: `depreciation = opening_WDV * (2 / effective_life_years) * (days_held / 365)` (200% rate per ATO)
- **Instant Write-Off**: If `purchasePrice < instantWriteOffThreshold` (default $20,000 for SBEs), full deduction in purchase year. Check entity settings for threshold override.
- **Low Value Pool**: Assets with WDV < $1,000 added to pool. Pool depreciated at 37.5% in first year, 30% in subsequent years.
- Pro-rata for part-year: calculate `daysHeld` based on purchase date vs FY start (July 1)
- If asset already fully depreciated (`currentWrittenDownValue <= residualValue`), return 0
- Check for existing depreciation record for the FY to prevent duplicates

**runBatchDepreciation(userId, financialYear, entityId?)**:
```typescript
runBatchDepreciation(userId: string, financialYear: string, entityId?: string): Promise<{
  assetsProcessed: number;
  totalDepreciation: number;
  results: Array<{
    assetId: string;
    assetName: string;
    depreciationAmount: number;
    closingValue: number;
  }>;
  errors: Array<{ assetId: string; error: string }>;
}>
```
- Fetch all active assets for user/entity
- Calculate depreciation for each asset
- Insert `assetDepreciation` records
- Update `currentWrittenDownValue` on each `fixedAssets` record
- If WDV reaches residual value, set status to `fully_depreciated`
- Return summary with any errors (continue processing on individual failure)

**recordDisposal(params)**:
```typescript
recordDisposal(params: {
  assetId: string;
  disposalDate: string;
  disposalMethod: 'sale' | 'scrapped' | 'trade_in' | 'theft' | 'insurance_claim';
  proceeds?: number;         // cents
  gstOnProceeds?: number;    // cents
  buyerDetails?: string;
  invoiceReference?: string;
  notes?: string;
}): Promise<AssetDisposal>
```
- Calculate WDV at disposal date (pro-rata depreciation from last FY end to disposal date)
- Calculate profit/loss: `proceeds - gstOnProceeds - writtenDownValueAtDisposal`
- Determine CGT applicability: applicable if held > 12 months and proceeds > WDV
- Set `cgtDiscountEligible` = true if held > 12 months (50% CGT discount for individuals)
- Update asset status to `disposed`
- Insert `assetDisposals` record

**getAssetRegister(userId, filters?)**:
```typescript
getAssetRegister(userId: string, filters?: {
  entityId?: string;
  category?: AssetCategory;
  status?: 'active' | 'disposed' | 'fully_depreciated' | 'written_off';
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
}): Promise<{
  assets: FixedAsset[];
  summary: {
    totalAssets: number;
    totalCost: number;
    totalWDV: number;
    totalDepreciationToDate: number;
    byCategory: Array<{ category: string; count: number; cost: number; wdv: number }>;
  };
}>
```
- Query `fixedAssets` with optional filters
- Calculate summary aggregates
- Group by category for breakdown

**getDepreciationSchedule(userId, financialYear, entityId?)**:
```typescript
getDepreciationSchedule(userId: string, financialYear: string, entityId?: string): Promise<{
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
}>
```
- Join `fixedAssets` with `assetDepreciation` for the financial year
- Include assets purchased during the year (additions)
- Include assets disposed during the year (disposals)
- Calculate FY totals

- [ ] Export type definitions at top of file:
```typescript
export type AssetCategory = 'plant_and_equipment' | 'motor_vehicle' | 'office_equipment' | 'computer_equipment' | 'furniture_fittings' | 'building' | 'land' | 'leasehold_improvement' | 'intangible' | 'low_value_pool';
export type DepreciationMethod = 'straight_line' | 'diminishing_value' | 'instant_write_off' | 'low_value_pool';
```

- [ ] Include ATO default effective life lookup table:
```typescript
const ATO_EFFECTIVE_LIVES: Record<AssetCategory, number> = {
  plant_and_equipment: 10,
  motor_vehicle: 8,
  office_equipment: 10,
  computer_equipment: 4,
  furniture_fittings: 13.33,
  building: 40,
  land: 0,           // land is not depreciated
  leasehold_improvement: 10,
  intangible: 5,
  low_value_pool: 0, // pool rate, not life-based
};
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Straight line test: $50,000 asset, 5yr life, $5,000 residual = $9,000/year depreciation
- [ ] Diminishing value test: $50,000 asset, 5yr effective life = $20,000 first full year (200% DV rate = 40%)
- [ ] Instant write-off test: $15,000 asset for SBE = full $15,000 deduction in purchase year
- [ ] Pro-rata test: asset purchased January 1 = 181/365 of full-year depreciation
- [ ] Disposal profit/loss: $30,000 asset, WDV $10,000, sold $15,000 = $5,000 profit
- [ ] Create marker file: `.agent-done-W12-02`

## Dependencies
- **None** — can start immediately (uses schema types via import, does not modify schema)
- **Schema lock**: Does NOT modify schema.ts — reads only. Agent 1 owns schema modifications.
- **Reuses**: schema.ts types (FixedAsset, AssetDepreciation, AssetDisposal), Drizzle db instance
