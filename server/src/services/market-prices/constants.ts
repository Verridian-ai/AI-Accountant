/**
 * Market Prices — Constants & Default Watchlists
 */

import type { ASXWatchlistEntry, CryptoWatchlistEntry } from './types.js';

export const DEFAULT_ASX_WATCHLIST: ASXWatchlistEntry[] = [
  { symbol: 'CBA', name: 'Commonwealth Bank', sector: 'Financials' },
  { symbol: 'BHP', name: 'BHP Group', sector: 'Materials' },
  { symbol: 'CSL', name: 'CSL Limited', sector: 'Healthcare' },
  { symbol: 'NAB', name: 'National Australia Bank', sector: 'Financials' },
  { symbol: 'WBC', name: 'Westpac Banking', sector: 'Financials' },
  { symbol: 'ANZ', name: 'ANZ Group', sector: 'Financials' },
  { symbol: 'WES', name: 'Wesfarmers', sector: 'Consumer' },
  { symbol: 'MQG', name: 'Macquarie Group', sector: 'Financials' },
  { symbol: 'WOW', name: 'Woolworths Group', sector: 'Consumer' },
  { symbol: 'RIO', name: 'Rio Tinto', sector: 'Materials' },
  { symbol: 'FMG', name: 'Fortescue Metals', sector: 'Materials' },
  { symbol: 'TLS', name: 'Telstra', sector: 'Communications' },
  { symbol: 'XJO', name: 'S&P/ASX 200 Index', sector: 'Index' },
  { symbol: 'XAO', name: 'All Ordinaries Index', sector: 'Index' },
];

export const DEFAULT_CRYPTO_WATCHLIST: CryptoWatchlistEntry[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { coinId: 'solana', symbol: 'SOL', name: 'Solana' },
  { coinId: 'ripple', symbol: 'XRP', name: 'XRP' },
  { coinId: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { coinId: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { coinId: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { coinId: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
];

export const FETCH_TIMEOUT_MS = 15_000;
export const COINGECKO_GAP_MS = 2_000;
export const ALPHA_VANTAGE_FEED_ID = 'feed-alpha-vantage';
export const COINGECKO_FEED_ID = 'feed-coingecko';
