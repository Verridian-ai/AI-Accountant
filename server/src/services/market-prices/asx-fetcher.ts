/**
 * Market Prices — ASX Equity Price Fetching (Alpha Vantage)
 */

import type { MarketPrice, NewMarketPrice } from '../../schema.js';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import type { MarketPriceConfig } from './types.js';
import { DEFAULT_ASX_WATCHLIST, FETCH_TIMEOUT_MS, ALPHA_VANTAGE_FEED_ID } from './constants.js';

export interface AlphaVantageRateTracker {
  date: string;
  count: number;
}

export function checkAlphaVantageLimit(
  tracker: AlphaVantageRateTracker,
  dailyLimit: number,
): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (tracker.date !== today) {
    tracker.date = today;
    tracker.count = 0;
  }
  return tracker.count < dailyLimit;
}

export function recordAlphaVantageCall(tracker: AlphaVantageRateTracker): void {
  const today = new Date().toISOString().slice(0, 10);
  if (tracker.date !== today) {
    tracker.date = today;
    tracker.count = 1;
  } else {
    tracker.count++;
  }
}

export function getAlphaVantageCallsRemaining(
  tracker: AlphaVantageRateTracker,
  dailyLimit: number,
): number {
  const today = new Date().toISOString().slice(0, 10);
  if (tracker.date !== today) return dailyLimit;
  return Math.max(0, dailyLimit - tracker.count);
}

export function lookupASX(
  symbol: string,
): { symbol: string; name: string; sector: string } | undefined {
  return DEFAULT_ASX_WATCHLIST.find(
    (e) => e.symbol === symbol || e.symbol === symbol.replace('.AX', ''),
  );
}

export async function fetchASXQuote(
  symbol: string,
  config: MarketPriceConfig,
  tracker: AlphaVantageRateTracker,
): Promise<MarketPrice | null> {
  if (!checkAlphaVantageLimit(tracker, config.alphaVantageDailyLimit)) {
    logger.warn('[MarketPriceService] Alpha Vantage daily limit reached');
    return null;
  }
  if (!config.alphaVantageApiKey) {
    logger.warn('[MarketPriceService] ALPHA_VANTAGE_API_KEY not set');
    return null;
  }

  const axSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
  const url = `${config.alphaVantageBaseUrl}?function=GLOBAL_QUOTE&symbol=${axSymbol}&apikey=${config.alphaVantageApiKey}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    recordAlphaVantageCall(tracker);

    if (!resp.ok) {
      logger.error(`[MarketPriceService] Alpha Vantage HTTP ${resp.status} for ${symbol}`);
      return null;
    }

    const data = (await resp.json()) as Record<string, any>;
    const gq = data['Global Quote'];
    if (!gq || !gq['05. price']) {
      logger.warn({ err: data }, `[MarketPriceService] No quote data for ${symbol}`);
      return null;
    }

    const now = new Date();
    const entry = lookupASX(symbol);
    const price: NewMarketPrice = {
      id: crypto.randomUUID(),
      feedId: ALPHA_VANTAGE_FEED_ID,
      symbol: symbol.replace('.AX', ''),
      name: entry?.name ?? symbol,
      assetType: 'equity',
      price: parseFloat(gq['05. price']) || 0,
      previousClose: parseFloat(gq['08. previous close']) || null,
      changeAmount: parseFloat(gq['09. change']) || null,
      changePct: parseFloat(String(gq['10. change percent']).replace('%', '')) || null,
      dayHigh: parseFloat(gq['03. high']) || null,
      dayLow: parseFloat(gq['04. low']) || null,
      volume: parseInt(gq['06. volume'], 10) || null,
      marketCap: null,
      currency: 'AUD',
      exchange: 'ASX',
      observationDate: now.toISOString().slice(0, 10),
      observationTime: now.toISOString(),
      createdAt: now.toISOString(),
    };

    return price as MarketPrice;
  } catch (err) {
    logger.error({ err: err }, `[MarketPriceService] fetchASXQuote(${symbol}) error:`);
    return null;
  }
}

export async function fetchASXDailyHistory(
  symbol: string,
  outputSize: 'compact' | 'full',
  config: MarketPriceConfig,
  tracker: AlphaVantageRateTracker,
): Promise<MarketPrice[]> {
  if (!checkAlphaVantageLimit(tracker, config.alphaVantageDailyLimit)) {
    logger.warn('[MarketPriceService] Alpha Vantage daily limit reached');
    return [];
  }
  if (!config.alphaVantageApiKey) {
    logger.warn('[MarketPriceService] ALPHA_VANTAGE_API_KEY not set');
    return [];
  }

  const axSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
  const url = `${config.alphaVantageBaseUrl}?function=TIME_SERIES_DAILY&symbol=${axSymbol}&outputsize=${outputSize}&apikey=${config.alphaVantageApiKey}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    recordAlphaVantageCall(tracker);

    if (!resp.ok) return [];

    const data = (await resp.json()) as Record<string, any>;
    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) return [];

    const cleanSymbol = symbol.replace('.AX', '');
    const entry = lookupASX(cleanSymbol);
    const results: MarketPrice[] = [];

    for (const [dateStr, values] of Object.entries(timeSeries)) {
      const v = values as Record<string, string>;
      results.push({
        id: crypto.randomUUID(),
        feedId: ALPHA_VANTAGE_FEED_ID,
        symbol: cleanSymbol,
        name: entry?.name ?? cleanSymbol,
        assetType: 'equity',
        price: parseFloat(v['4. close']) || 0,
        previousClose: null,
        changeAmount: null,
        changePct: null,
        dayHigh: parseFloat(v['2. high']) || null,
        dayLow: parseFloat(v['3. low']) || null,
        volume: parseInt(v['5. volume'], 10) || null,
        marketCap: null,
        currency: 'AUD',
        exchange: 'ASX',
        observationDate: dateStr,
        observationTime: null,
        createdAt: new Date().toISOString(),
      });
    }

    return results;
  } catch (err) {
    logger.error({ err: err }, `[MarketPriceService] fetchASXDailyHistory(${symbol}) error:`);
    return [];
  }
}
