/**
 * ABS Data Feed — HTTP transport
 */

import { FETCH_TIMEOUT_MS } from './constants.js';

export async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoldLedger/1.0 (Financial Data Aggregator)',
        Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd,application/json',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
