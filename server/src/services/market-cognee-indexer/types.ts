/**
 * Market Cognee Indexer Module — Type Definitions
 */

export interface MarketIndexResult {
  intelligenceIndexed: number;
  sentimentIndexed: number;
  rbaIndexed: number;
  absIndexed: number;
  pricesIndexed: number;
  errors: string[];
  durationMs: number;
}

/** Custom cognify prompt for market intelligence entity extraction */
export const MARKET_COGNIFY_PROMPT =
  'Extract economic and financial entities: indicator names, values, trends, ' +
  'percentage changes, time periods, data sources (RBA, ABS, ASX), asset symbols, ' +
  'sentiment labels, market sectors, exchange names, and causal relationships ' +
  'between economic indicators (e.g. cash rate affects lending rates). ' +
  'Identify temporal patterns like quarterly releases, seasonal trends, and rate cycles.';
