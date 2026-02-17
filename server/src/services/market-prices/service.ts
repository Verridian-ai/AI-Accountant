/**
 * Market Prices Service — Core Service Class
 * Thin orchestrator delegating to asx-fetcher and crypto-fetcher.
 */

import { db, marketDataFeeds, marketPrices } from '../../schema.js';
import type { MarketPrice } from '../../schema.js';
import { eq, sql, desc, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { config as appConfig } from '../../lib/config.js';
import type { MarketPriceConfig, RefreshResult, SymbolSearchResult } from './types.js';
import {
  DEFAULT_ASX_WATCHLIST,
  DEFAULT_CRYPTO_WATCHLIST,
  FETCH_TIMEOUT_MS,
  COINGECKO_GAP_MS,
  ALPHA_VANTAGE_FEED_ID,
  COINGECKO_FEED_ID,
} from './constants.js';
import {
  type AlphaVantageRateTracker,
  checkAlphaVantageLimit,
  recordAlphaVantageCall,
  getAlphaVantageCallsRemaining,
  fetchASXQuote as fetchASXQuoteFn,
  fetchASXDailyHistory as fetchASXDailyHistoryFn,
} from './asx-fetcher.js';
import {
  fetchCryptoPrice as fetchCryptoPriceFn,
  fetchCryptoPrices as fetchCryptoPricesFn,
  fetchCryptoHistory as fetchCryptoHistoryFn,
} from './crypto-fetcher.js';

export class MarketPriceService {
  private config: MarketPriceConfig;
  private alphaVantageCalls: AlphaVantageRateTracker = {
    date: new Date().toISOString().slice(0, 10),
    count: 0,
  };
  private coingeckoLastRequest = 0;

  constructor(config?: Partial<MarketPriceConfig>) {
    this.config = {
      alphaVantageApiKey: config?.alphaVantageApiKey ?? appConfig.alphaVantageApiKey,
      alphaVantageBaseUrl: config?.alphaVantageBaseUrl ?? 'https://www.alphavantage.co/query',
      alphaVantageDailyLimit: config?.alphaVantageDailyLimit ?? 25,
      coingeckoBaseUrl: config?.coingeckoBaseUrl ?? 'https://api.coingecko.com/api/v3',
      coingeckoRateLimit: config?.coingeckoRateLimit ?? 30,
      cacheTtlMs: config?.cacheTtlMs ?? 300_000,
    };
  }

  async ensureFeeds(): Promise<void> {
    const now = new Date().toISOString();
    for (const feed of [
      {
        id: ALPHA_VANTAGE_FEED_ID,
        feedName: 'Alpha Vantage ASX',
        feedType: 'equity_prices',
        sourceUrl: this.config.alphaVantageBaseUrl,
        sourceName: 'Alpha Vantage',
        description: 'ASX equity prices via Alpha Vantage free tier (25 req/day)',
        refreshFrequency: 'daily',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: COINGECKO_FEED_ID,
        feedName: 'CoinGecko Crypto',
        feedType: 'crypto_prices',
        sourceUrl: this.config.coingeckoBaseUrl,
        sourceName: 'CoinGecko',
        description: 'Cryptocurrency prices via CoinGecko free tier (30 req/min)',
        refreshFrequency: '5min',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]) {
      try {
        const existing = await db
          .select()
          .from(marketDataFeeds)
          .where(eq(marketDataFeeds.id, feed.id))
          .all();
        if (existing.length === 0) {
          await db.insert(marketDataFeeds).values(feed).run();
        }
      } catch (err) {
        logger.error({ err }, `[MarketPriceService] Failed to ensure feed ${feed.id}:`);
      }
    }
  }

  private async waitForCoingeckoLimit(): Promise<void> {
    const elapsed = Date.now() - this.coingeckoLastRequest;
    if (elapsed < COINGECKO_GAP_MS) {
      await new Promise((resolve) => setTimeout(resolve, COINGECKO_GAP_MS - elapsed));
    }
    this.coingeckoLastRequest = Date.now();
  }

  get alphaVantageCallsRemaining(): number {
    return getAlphaVantageCallsRemaining(
      this.alphaVantageCalls,
      this.config.alphaVantageDailyLimit,
    );
  }

  // --- ASX ---
  async fetchASXQuote(symbol: string): Promise<MarketPrice | null> {
    return fetchASXQuoteFn(symbol, this.config, this.alphaVantageCalls);
  }

  async fetchASXDailyHistory(
    symbol: string,
    outputSize: 'compact' | 'full' = 'compact',
  ): Promise<MarketPrice[]> {
    return fetchASXDailyHistoryFn(symbol, outputSize, this.config, this.alphaVantageCalls);
  }

  async fetchASXBatch(symbols: string[]): Promise<MarketPrice[]> {
    const results: MarketPrice[] = [];
    for (const sym of symbols) {
      if (!checkAlphaVantageLimit(this.alphaVantageCalls, this.config.alphaVantageDailyLimit)) {
        logger.warn(
          `[MarketPriceService] Alpha Vantage limit reached — returning ${results.length}/${symbols.length} quotes`,
        );
        break;
      }
      const quote = await this.fetchASXQuote(sym);
      if (quote) results.push(quote);
    }
    return results;
  }

  // --- Crypto ---
  async fetchCryptoPrice(coinId: string): Promise<MarketPrice | null> {
    await this.waitForCoingeckoLimit();
    return fetchCryptoPriceFn(coinId, this.config);
  }

  async fetchCryptoPrices(coinIds: string[]): Promise<MarketPrice[]> {
    await this.waitForCoingeckoLimit();
    return fetchCryptoPricesFn(coinIds, this.config);
  }

  async fetchCryptoHistory(coinId: string, days: number = 30): Promise<MarketPrice[]> {
    await this.waitForCoingeckoLimit();
    return fetchCryptoHistoryFn(coinId, days, this.config);
  }

  // --- Unified ---
  async getAllPrices(): Promise<{ asx: MarketPrice[]; crypto: MarketPrice[] }> {
    await this.ensureFeeds();
    const [asx, crypto_] = await Promise.all([
      this.fetchASXBatch(DEFAULT_ASX_WATCHLIST.map((e) => e.symbol)),
      this.fetchCryptoPrices(DEFAULT_CRYPTO_WATCHLIST.map((e) => e.coinId)),
    ]);
    return { asx, crypto: crypto_ };
  }

  async refreshPrices(): Promise<RefreshResult> {
    await this.ensureFeeds();
    const result: RefreshResult = {
      asxUpdated: 0,
      cryptoUpdated: 0,
      asxApiCallsRemaining: this.alphaVantageCallsRemaining,
      errors: [],
    };
    for (const entry of DEFAULT_ASX_WATCHLIST) {
      try {
        const quote = await this.fetchASXQuote(entry.symbol);
        if (quote) {
          await this.upsertPrice(quote);
          result.asxUpdated++;
        }
      } catch (err) {
        result.errors.push({
          source: 'alpha_vantage',
          symbol: entry.symbol,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    try {
      const cryptoPrices = await this.fetchCryptoPrices(
        DEFAULT_CRYPTO_WATCHLIST.map((c) => c.coinId),
      );
      for (const cp of cryptoPrices) {
        await this.upsertPrice(cp);
        result.cryptoUpdated++;
      }
    } catch (err) {
      result.errors.push({
        source: 'coingecko',
        symbol: 'batch',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    result.asxApiCallsRemaining = this.alphaVantageCallsRemaining;
    return result;
  }

  async getPriceHistory(symbol: string, days: number = 30): Promise<MarketPrice[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().slice(0, 10);
    try {
      const rows = await db
        .select()
        .from(marketPrices)
        .where(
          and(eq(marketPrices.symbol, symbol), sql`${marketPrices.observationDate} >= ${cutoff}`),
        )
        .orderBy(desc(marketPrices.observationDate))
        .all();
      if (rows.length > 0) return rows;
    } catch {
      /* fall through */
    }
    const cryptoEntry = DEFAULT_CRYPTO_WATCHLIST.find(
      (c) => c.symbol === symbol || c.coinId === symbol,
    );
    if (cryptoEntry) {
      const history = await this.fetchCryptoHistory(cryptoEntry.coinId, days);
      for (const p of history) {
        await this.upsertPrice(p);
      }
      return history;
    }
    const history = await this.fetchASXDailyHistory(symbol, days > 100 ? 'full' : 'compact');
    const filtered = history.filter((p) => p.observationDate >= cutoff);
    for (const p of filtered) {
      await this.upsertPrice(p);
    }
    return filtered;
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const results: SymbolSearchResult[] = [];
    if (
      this.config.alphaVantageApiKey &&
      checkAlphaVantageLimit(this.alphaVantageCalls, this.config.alphaVantageDailyLimit)
    ) {
      try {
        const url = `${this.config.alphaVantageBaseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.config.alphaVantageApiKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        recordAlphaVantageCall(this.alphaVantageCalls);
        if (resp.ok) {
          const data = (await resp.json()) as Record<string, any>;
          for (const m of (data.bestMatches ?? []) as Record<string, string>[]) {
            results.push({
              symbol: (m['1. symbol'] ?? '').replace('.AX', ''),
              name: m['2. name'] ?? '',
              type: 'equity',
            });
          }
        }
      } catch {
        /* continue */
      }
    }
    try {
      await this.waitForCoingeckoLimit();
      const url = `${this.config.coingeckoBaseUrl}/search?query=${encodeURIComponent(query)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (resp.ok) {
        const data = (await resp.json()) as Record<string, any>;
        for (const c of ((data.coins ?? []) as Record<string, string>[]).slice(0, 10)) {
          results.push({
            symbol: c.symbol?.toUpperCase() ?? c.id ?? '',
            name: c.name ?? '',
            type: 'cryptocurrency',
          });
        }
      }
    } catch {
      /* continue */
    }
    return results;
  }

  // --- DB ---
  private async upsertPrice(price: MarketPrice): Promise<void> {
    try {
      await db
        .delete(marketPrices)
        .where(
          and(
            eq(marketPrices.symbol, price.symbol),
            eq(marketPrices.observationDate, price.observationDate),
          ),
        )
        .run();
      await db
        .insert(marketPrices)
        .values({
          id: price.id,
          feedId: price.feedId,
          symbol: price.symbol,
          name: price.name,
          assetType: price.assetType,
          price: price.price,
          previousClose: price.previousClose,
          changeAmount: price.changeAmount,
          changePct: price.changePct,
          dayHigh: price.dayHigh,
          dayLow: price.dayLow,
          volume: price.volume,
          marketCap: price.marketCap,
          currency: price.currency,
          exchange: price.exchange,
          observationDate: price.observationDate,
          observationTime: price.observationTime,
          createdAt: price.createdAt,
        })
        .run();
    } catch (err) {
      logger.error({ err }, `[MarketPriceService] upsertPrice(${price.symbol}) error:`);
    }
  }

  async getLatestPrices(assetType?: string): Promise<MarketPrice[]> {
    try {
      if (assetType) {
        return await db
          .select()
          .from(marketPrices)
          .where(eq(marketPrices.assetType, assetType))
          .orderBy(desc(marketPrices.observationDate))
          .all();
      }
      return await db.select().from(marketPrices).orderBy(desc(marketPrices.observationDate)).all();
    } catch {
      return [];
    }
  }
}

// Singleton
export const marketPriceService = new MarketPriceService();
