/**
 * Market Prices — Cryptocurrency Price Fetching (CoinGecko)
 */

import type { MarketPrice } from '../../schema.js';
import crypto from 'crypto';
import { logger } from '../../lib/logger.js';
import type { MarketPriceConfig } from './types.js';
import { DEFAULT_CRYPTO_WATCHLIST, FETCH_TIMEOUT_MS, COINGECKO_FEED_ID } from './constants.js';

export async function fetchCryptoPrice(
  coinId: string,
  config: MarketPriceConfig,
): Promise<MarketPrice | null> {
  const url =
    `${config.coingeckoBaseUrl}/simple/price` +
    `?ids=${encodeURIComponent(coinId)}` +
    `&vs_currencies=aud` +
    `&include_24hr_change=true` +
    `&include_market_cap=true` +
    `&include_24hr_vol=true`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) {
      logger.error(`[MarketPriceService] CoinGecko HTTP ${resp.status} for ${coinId}`);
      return null;
    }

    const data = (await resp.json()) as Record<string, any>;
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
    logger.error({ err: err }, `[MarketPriceService] fetchCryptoPrice(${coinId}) error:`);
    return null;
  }
}

export async function fetchCryptoPrices(
  coinIds: string[],
  config: MarketPriceConfig,
): Promise<MarketPrice[]> {
  const batch = coinIds.slice(0, 50);
  const url =
    `${config.coingeckoBaseUrl}/simple/price` +
    `?ids=${batch.map(encodeURIComponent).join(',')}` +
    `&vs_currencies=aud` +
    `&include_24hr_change=true` +
    `&include_market_cap=true` +
    `&include_24hr_vol=true`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) return [];

    const data = (await resp.json()) as Record<string, any>;
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
    logger.error({ err: err }, '[MarketPriceService] fetchCryptoPrices error:');
    return [];
  }
}

export async function fetchCryptoHistory(
  coinId: string,
  days: number,
  config: MarketPriceConfig,
): Promise<MarketPrice[]> {
  const url =
    `${config.coingeckoBaseUrl}/coins/${encodeURIComponent(coinId)}/market_chart` +
    `?vs_currency=aud&days=${days}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) return [];

    const data = (await resp.json()) as {
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
    logger.error({ err: err }, `[MarketPriceService] fetchCryptoHistory(${coinId}) error:`);
    return [];
  }
}
