/**
 * Enhanced Economic Data Types (RBA + ABS combined feeds)
 *
 * Used by rba-data-feed, abs-data-feed, and economic-data enhanced-snapshot.
 * The EnhancedEconomicSnapshot type is more detailed than the basic EconomicSnapshot
 * in types.ts — it includes inflation, gdp, wages, and housing breakdowns.
 */

// ============================================================================
// ECONOMIC INDICATOR RECORD (matches DB schema shape for insert/select)
// ============================================================================

export interface EconomicIndicatorRecord {
  id: string;
  feedId: string;
  indicatorCode: string;
  indicatorName: string;
  category: string;
  value: number;
  previousValue: number | null;
  changePct: number | null;
  unit: string;
  frequency: string;
  referencePeriod: string;
  source: string;
  notes: string | null;
  observationDate: string; // ISO date
}

// ============================================================================
// INDICATOR SUMMARY (aggregated view for dashboard display)
// ============================================================================

export interface IndicatorSummary {
  code: string;
  name: string;
  category: string;
  latestValue: number;
  previousValue: number | null;
  changePct: number | null;
  unit: string;
  period: string;
  source: string;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

// ============================================================================
// RATE DECISION (RBA cash rate decision history)
// ============================================================================

export interface RateDecision {
  date: string; // ISO date of the RBA board meeting
  rate: number; // Cash rate target after decision (percent, e.g. 4.35)
  previousRate: number; // Cash rate before this decision
  change: number; // Basis point change (e.g. +25, -25, 0)
  direction: 'increase' | 'decrease' | 'hold';
}

// ============================================================================
// ENHANCED ECONOMIC SNAPSHOT (detailed 7-field combined view)
// Distinct from the basic EconomicSnapshot in types.ts which has 5 fields.
// ============================================================================

export interface EnhancedEconomicSnapshot {
  cashRate: {
    rate: number;
    effectiveDate: string;
    previousRate: number;
  } | null;
  lendingRates: {
    ownerOccupierVariable: number | null;
    investorVariable: number | null;
    fixedRate3yr: number | null;
    personalLoan: number | null;
    termDeposit1yr: number | null;
  } | null;
  inflation: {
    cpiQuarterly: number | null;
    cpiAnnual: number | null;
    trimmedMean: number | null;
    period: string;
  } | null;
  employment: {
    unemploymentRate: number | null;
    participationRate: number | null;
    employedPersons: number | null;
    period: string;
  } | null;
  gdp: {
    quarterlyChange: number | null;
    annualChange: number | null;
    period: string;
  } | null;
  wages: {
    wpiAll: number | null;
    wpiPrivate: number | null;
    period: string;
  } | null;
  housing: {
    sydneyQuarterly: number | null;
    australiaQuarterly: number | null;
    dwellingApprovals: number | null;
  } | null;
  lastUpdated: string;
}

// ============================================================================
// FETCH RESULTS
// ============================================================================

export interface RbaFetchResult {
  indicators: EconomicIndicatorRecord[];
  tablesProcessed: number;
  errors: Array<{ table: string; error: string }>;
}

export interface AbsFetchResult {
  indicators: EconomicIndicatorRecord[];
  dataflowsProcessed: number;
  errors: Array<{ dataflow: string; error: string }>;
}

// ============================================================================
// TABLE / DATAFLOW DEFINITIONS
// ============================================================================

export interface RbaTableIndicator {
  column: string;
  code: string;
  category: string;
  unit: string;
}

export interface RbaTableDef {
  url: string;
  name: string;
  indicators: RbaTableIndicator[];
}

export interface AbsDataflowIndicator {
  seriesId?: string;
  code: string;
  category: string;
  name: string;
  unit: string;
}

export interface AbsDataflowDef {
  dataflowId: string;
  key: string;
  name: string;
  indicators: AbsDataflowIndicator[];
}
