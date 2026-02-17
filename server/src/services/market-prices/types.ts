/**
 * Market Prices — Type Definitions
 */

export interface MarketPriceConfig {
  alphaVantageApiKey: string;
  alphaVantageBaseUrl: string;
  alphaVantageDailyLimit: number;
  coingeckoBaseUrl: string;
  coingeckoRateLimit: number;
  cacheTtlMs: number;
}

export interface RefreshResult {
  asxUpdated: number;
  cryptoUpdated: number;
  asxApiCallsRemaining: number;
  errors: Array<{ source: string; symbol: string; error: string }>;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: string;
}

export interface ASXWatchlistEntry {
  symbol: string;
  name: string;
  sector: string;
}

export interface CryptoWatchlistEntry {
  coinId: string;
  symbol: string;
  name: string;
}
