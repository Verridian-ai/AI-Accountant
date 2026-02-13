/**
 * Market Prices Service (Wave 19 — Agent 3)
 *
 * Fetches and stores ASX equity prices (Alpha Vantage) and cryptocurrency
 * prices (CoinGecko), providing real-time and historical price data.
 *
 * Rate limits:
 *   - Alpha Vantage free tier: 25 requests / day  (daily counter, resets at midnight)
 *   - CoinGecko free tier:    30 requests / minute (enforced as 2-second gap)
 *
 * All prices stored in AUD currency.
 */

import { db, marketDataFeeds, marketPrices } from '../schema.js';
import type { MarketPrice, NewMarketPrice } from '../schema.js';
import { eq, sql, desc, and } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: string;
}

interface ASXWatchlistEntry {
  symbol: string;
  name: string;
  sector: string;
}

interface CryptoWatchlistEntry {
  coinId: string;
  symbol: string;
  name: string;
}

// ============================================================================
// DEFAULT WATCHLISTS
// ============================================================================

const DEFAULT_ASX_WATCHLIST: ASXWatchlistEntry[] = [
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

const DEFAULT_CRYPTO_WATCHLIST: CryptoWatchlistEntry[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { coinId: 'solana', symbol: 'SOL', name: 'Solana' },
  { coinId: 'ripple', symbol: 'XRP', name: 'XRP' },
  { coinId: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { coinId: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { coinId: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { coinId: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
];

// ============================================================================
// CONSTANTS
// ============================================================================

const FETCH_TIMEOUT_MS = 15_000;
const COINGECKO_GAP_MS = 2_000;
const ALPHA_VANTAGE_FEED_ID = 'feed-alpha-vantage';
const COINGECKO_FEED_ID = 'feed-coingecko';

// ============================================================================
// SERVICE
// ============================================================================

export class MarketPriceService {
  private config: MarketPriceConfig;

  // Alpha Vantage daily rate tracker
  private alphaVantageCalls: { date: string; count: number } = {
    date: new Date().toISOString().slice(0, 10),
    count: 0,
  };

  // CoinGecko per-request throttle
  private coingeckoLastRequest = 0;

  constructor(config?: Partial<MarketPriceConfig>) {
    this.config = {
      alphaVantageApiKey: config?.alphaVantageApiKey ?? process.env.ALPHA_VANTAGE_API_KEY ?? '',
      alphaVantageBaseUrl: config?.alphaVantageBaseUrl ?? 'https://www.alphavantage.co/query',
      alphaVantageDailyLimit: config?.alphaVantageDailyLimit ?? 25,
      coingeckoBaseUrl: config?.coingeckoBaseUrl ?? 'https://api.coingecko.com/api/v3',
      coingeckoRateLimit: config?.coingeckoRateLimit ?? 30,
      cacheTtlMs: config?.cacheTtlMs ?? 300_000,
    };
  }

  // --------------------------------------------------------------------------
  // Feed bootstrap — ensure data-feed rows exist so FK references work
  // --------------------------------------------------------------------------

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
        console.error(`[MarketPriceService] Failed to ensure feed ${feed.id}:`, err);
      }
    }
  }

  // ==========================================================================
  // RATE LIMITERS
  // ==========================================================================

  private checkAlphaVantageLimit(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.alphaVantageCalls.date !== today) {
      this.alphaVantageCalls = { date: today, count: 0 };
    }
    return this.alphaVantageCalls.count < this.config.alphaVantageDailyLimit;
  }

  private recordAlphaVantageCall(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.alphaVantageCalls.date !== today) {
      this.alphaVantageCalls = { date: today, count: 1 };
    } else {
      this.alphaVantageCalls.count++;
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
    const today = new Date().toISOString().slice(0, 10);
    if (this.alphaVantageCalls.date !== today) return this.config.alphaVantageDailyLimit;
    return Math.max(0, this.config.alphaVantageDailyLimit - this.alphaVantageCalls.count);
  }

  // ==========================================================================
  // ALPHA VANTAGE — ASX EQUITIES
  // ==========================================================================

  async fetchASXQuote(symbol: string): Promise<MarketPrice | null> {
    if (!this.checkAlphaVantageLimit()) {
      console.warn('[MarketPriceService] Alpha Vantage daily limit reached');
      return null;
    }
    if (!this.config.alphaVantageApiKey) {
      console.warn('[MarketPriceService] ALPHA_VANTAGE_API_KEY not set');
      return null;
    }

    const axSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
    const url = `${this.config.alphaVantageBaseUrl}?function=GLOBAL_QUOTE&symbol=${axSymbol}&apikey=${this.config.alphaVantageApiKey}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      this.recordAlphaVantageCall();

      if (!resp.ok) {
        console.error(`[MarketPriceService] Alpha Vantage HTTP ${resp.status} for ${symbol}`);
        return null;
      }

      const data = await resp.json() as Record<string, any>;
      const gq = data['Global Quote'];
      if (!gq || !gq['05. price']) {
        console.warn(`[MarketPriceService] No quote data for ${symbol}`, data);
        return null;
      }

      const now = new Date();
      const entry = this.lookupASX(symbol);
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
      console.error(`[MarketPriceService] fetchASXQuote(${symbol}) error:`, err);
      return null;
    }
  }

  async fetchASXDailyHistory(
    symbol: string,
    outputSize: 'compact' | 'full' = 'compact',
  ): Promise<MarketPrice[]> {
    if (!this.checkAlphaVantageLimit()) {
      console.warn('[MarketPriceService] Alpha Vantage daily limit reached');
      return [];
    }
    if (!this.config.alphaVantageApiKey) {
      console.warn('[MarketPriceService] ALPHA_VANTAGE_API_KEY not set');
      return [];
    }

    const axSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
    const url = `${this.config.alphaVantageBaseUrl}?function=TIME_SERIES_DAILY&symbol=${axSymbol}&outputsize=${outputSize}&apikey=${this.config.alphaVantageApiKey}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      this.recordAlphaVantageCall();

      if (!resp.ok) return [];

      const data = await resp.json() as Record<string, any>;
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) return [];

      const cleanSymbol = symbol.replace('.AX', '');
      const entry = this.lookupASX(cleanSymbol);
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
      console.error(`[MarketPriceService] fetchASXDailyHistory(${symbol}) error:`, err);
      return [];
    }
  }

  async fetchASXBatch(symbols: string[]): Promise<MarketPrice[]> {
    const results: MarketPrice[] = [];
    for (const sym of symbols) {
      if (!this.checkAlphaVantageLimit()) {
        console.warn(
          `[MarketPriceService] Alpha Vantage limit reached — returning ${results.length}/${symbols.length} quotes`,
        );
        break;
      }
      const quote = await this.fetchASXQuote(sym);
      if (quote) results.push(quote);
    }
    return results;
  }

  // ==========================================================================
  // COINGECKO — CRYPTOCURRENCY
  // ==========================================================================

  async fetchCryptoPrice(coinId: string): Promise<MarketPrice | null> {
    await this.waitForCoingeckoLimit();

    const url =
      `${this.config.coingeckoBaseUrl}/simple/price` +
      `?ids=${encodeURIComponent(coinId)}` +
      `&vs_currencies=aud` +
      `&include_24hr_change=true` +
      `&include_market_cap=true` +
      `&include_24hr_vol=true`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!resp.ok) {
        console.error(`[MarketPriceService] CoinGecko HTTP ${resp.status} for ${coinId}`);
        return null;
      }

      const data = await resp.json() as Record<string, any>;
      const coinData = data[coinId];
      if (!coinData) return null;

      const entry = DEFAULT_CRYPTO_WATCHLIST.find((c) => c.coinId === coinId);
      const now = new Date();

      return {
        id: crypto.randomUUID(),
        feedId: COINGECKO_FEED_ID,
        symbol: entry?.symbol ?? coinId.toUpperCase(),
        name: entry?.name ?? coinId,
        assetType: 'cryptocurrency',
        price: coinData.aud ?? 0,
        previousClose: null,
        changeAmount: null,
        changePct: coinData.aud_24h_change ?? null,
        dayHigh: null,
        dayLow: null,
        volume: coinData.aud_24h_vol ? Math.round(coinData.aud_24h_vol) : null,
        marketCap: coinData.aud_market_cap ?? null,
        currency: 'AUD',
        exchange: null,
        observationDate: now.toISOString().slice(0, 10),
        observationTime: now.toISOString(),
        createdAt: now.toISOString(),
      };
    } catch (err) {
      console.error(`[MarketPriceService] fetchCryptoPrice(${coinId}) error:`, err);
      return null;
    }
  }

  async fetchCryptoPrices(coinIds: string[]): Promise<MarketPrice[]> {
    await this.waitForCoingeckoLimit();

    // CoinGecko supports batching up to 50 ids in a single request
    const batch = coinIds.slice(0, 50);
    const url =
      `${this.config.coingeckoBaseUrl}/simple/price` +
      `?ids=${batch.map(encodeURIComponent).join(',')}` +
      `&vs_currencies=aud` +
      `&include_24hr_change=true` +
      `&include_market_cap=true` +
      `&include_24hr_vol=true`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!resp.ok) return [];

      const data = await resp.json() as Record<string, any>;
      const now = new Date();
      const results: MarketPrice[] = [];

      for (const coinId of batch) {
        const coinData = data[coinId];
        if (!coinData) continue;

        const entry = DEFAULT_CRYPTO_WATCHLIST.find((c) => c.coinId === coinId);
        results.push({
          id: crypto.randomUUID(),
          feedId: COINGECKO_FEED_ID,
          symbol: entry?.symbol ?? coinId.toUpperCase(),
          name: entry?.name ?? coinId,
          assetType: 'cryptocurrency',
          price: coinData.aud ?? 0,
          previousClose: null,
          changeAmount: null,
          changePct: coinData.aud_24h_change ?? null,
          dayHigh: null,
          dayLow: null,
          volume: coinData.aud_24h_vol ? Math.round(coinData.aud_24h_vol) : null,
          marketCap: coinData.aud_market_cap ?? null,
          currency: 'AUD',
          exchange: null,
          observationDate: now.toISOString().slice(0, 10),
          observationTime: now.toISOString(),
          createdAt: now.toISOString(),
        });
      }

      return results;
    } catch (err) {
      console.error('[MarketPriceService] fetchCryptoPrices error:', err);
      return [];
    }
  }

  async fetchCryptoHistory(coinId: string, days: number = 30): Promise<MarketPrice[]> {
    await this.waitForCoingeckoLimit();

    const url =
      `${this.config.coingeckoBaseUrl}/coins/${encodeURIComponent(coinId)}/market_chart` +
      `?vs_currency=aud&days=${days}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!resp.ok) return [];

      const data = await resp.json() as {
        prices: [number, number][];
        market_caps: [number, number][];
        total_volumes: [number, number][];
      };

      const entry = DEFAULT_CRYPTO_WATCHLIST.find((c) => c.coinId === coinId);
      const results: MarketPrice[] = [];

      for (let i = 0; i < (data.prices?.length ?? 0); i++) {
        const [ts, price] = data.prices[i];
        const date = new Date(ts);
        const mcap = data.market_caps?.[i]?.[1] ?? null;
        const vol = data.total_volumes?.[i]?.[1] ?? null;

        results.push({
          id: crypto.randomUUID(),
          feedId: COINGECKO_FEED_ID,
          symbol: entry?.symbol ?? coinId.toUpperCase(),
          name: entry?.name ?? coinId,
          assetType: 'cryptocurrency',
          price,
          previousClose: null,
          changeAmount: null,
          changePct: null,
          dayHigh: null,
          dayLow: null,
          volume: vol != null ? Math.round(vol) : null,
          marketCap: mcap,
          currency: 'AUD',
          exchange: null,
          observationDate: date.toISOString().slice(0, 10),
          observationTime: date.toISOString(),
          createdAt: new Date().toISOString(),
        });
      }

      return results;
    } catch (err) {
      console.error(`[MarketPriceService] fetchCryptoHistory(${coinId}) error:`, err);
      return [];
    }
  }

  // ==========================================================================
  // UNIFIED METHODS
  // ==========================================================================

  async getAllPrices(): Promise<{ asx: MarketPrice[]; crypto: MarketPrice[] }> {
    await this.ensureFeeds();

    const asxSymbols = DEFAULT_ASX_WATCHLIST.map((e) => e.symbol);
    const cryptoIds = DEFAULT_CRYPTO_WATCHLIST.map((e) => e.coinId);

    const [asx, crypto_] = await Promise.all([
      this.fetchASXBatch(asxSymbols),
      this.fetchCryptoPrices(cryptoIds),
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

    // --- ASX ---
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

    // --- Crypto (single batch request) ---
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
    // Check DB first
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    try {
      const rows = await db
        .select()
        .from(marketPrices)
        .where(
          and(
            eq(marketPrices.symbol, symbol),
            sql`${marketPrices.observationDate} >= ${cutoff}`,
          ),
        )
        .orderBy(desc(marketPrices.observationDate))
        .all();

      if (rows.length > 0) return rows;
    } catch {
      // DB query failed — fall through to API
    }

    // Not cached — try API
    const cryptoEntry = DEFAULT_CRYPTO_WATCHLIST.find(
      (c) => c.symbol === symbol || c.coinId === symbol,
    );
    if (cryptoEntry) {
      const history = await this.fetchCryptoHistory(cryptoEntry.coinId, days);
      // Persist for future queries
      for (const p of history) {
        await this.upsertPrice(p);
      }
      return history;
    }

    // Assume ASX symbol
    const history = await this.fetchASXDailyHistory(symbol, days > 100 ? 'full' : 'compact');
    const filtered = history.filter((p) => p.observationDate >= cutoff);
    for (const p of filtered) {
      await this.upsertPrice(p);
    }
    return filtered;
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const results: SymbolSearchResult[] = [];

    // Alpha Vantage symbol search
    if (this.config.alphaVantageApiKey && this.checkAlphaVantageLimit()) {
      try {
        const url = `${this.config.alphaVantageBaseUrl}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.config.alphaVantageApiKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        this.recordAlphaVantageCall();

        if (resp.ok) {
          const data = await resp.json() as Record<string, any>;
          const matches = data.bestMatches ?? [];
          for (const m of matches as Record<string, string>[]) {
            results.push({
              symbol: (m['1. symbol'] ?? '').replace('.AX', ''),
              name: m['2. name'] ?? '',
              type: 'equity',
            });
          }
        }
      } catch {
        // Alpha Vantage search failed — continue with CoinGecko
      }
    }

    // CoinGecko search
    try {
      await this.waitForCoingeckoLimit();
      const url = `${this.config.coingeckoBaseUrl}/search?query=${encodeURIComponent(query)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

      if (resp.ok) {
        const data = await resp.json() as Record<string, any>;
        const coins = (data.coins ?? []) as Record<string, string>[];
        for (const c of coins.slice(0, 10)) {
          results.push({
            symbol: c.symbol?.toUpperCase() ?? c.id ?? '',
            name: c.name ?? '',
            type: 'cryptocurrency',
          });
        }
      }
    } catch {
      // CoinGecko search failed — return what we have
    }

    return results;
  }

  // ==========================================================================
  // DATABASE HELPERS
  // ==========================================================================

  private async upsertPrice(price: MarketPrice): Promise<void> {
    try {
      // Delete existing entry for same symbol + date, then insert
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
      console.error(`[MarketPriceService] upsertPrice(${price.symbol}) error:`, err);
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
      return await db
        .select()
        .from(marketPrices)
        .orderBy(desc(marketPrices.observationDate))
        .all();
    } catch {
      return [];
    }
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  private lookupASX(symbol: string): ASXWatchlistEntry | undefined {
    return DEFAULT_ASX_WATCHLIST.find(
      (e) => e.symbol === symbol || e.symbol === symbol.replace('.AX', ''),
    );
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const marketPriceService = new MarketPriceService();
