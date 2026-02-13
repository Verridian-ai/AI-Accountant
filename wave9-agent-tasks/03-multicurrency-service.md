# Agent 3: Multi-Currency Service

## Role
Build the multi-currency exchange rate service with external API fetching, Redis caching, and currency conversion logic.

## Priority: WAVE 9 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/multicurrency.ts`
**Purpose**: Currency management and exchange rate conversion service
**Pattern**: Follow `server/src/services/economic-data.ts` for external API + caching pattern

**Class**: `MultiCurrencyService`

**Methods**:

- [ ] `listCurrencies(): Promise<Currency[]>`
  - Return all active currencies from the currencies table
  - Cache in-memory (currencies rarely change)

- [ ] `getExchangeRate(from: string, to: string, date?: string): Promise<ExchangeRate | null>`
  - Look up rate for currency pair on given date (default: today)
  - If exact date not found, find most recent rate before that date
  - Return null if no rate exists

- [ ] `convertAmount(amountCents: number, from: string, to: string, date?: string): Promise<ConvertedAmount>`
  - Get exchange rate, multiply amount, return both original and converted
  - Round to target currency's decimal places
  - Throw if no exchange rate available
  - **REVISION NOTE (D02 — ATO requirement): For GST on foreign currency invoices, the exchange rate MUST be the rate on the DATE OF SUPPLY (not the current rate). The `date` parameter is REQUIRED for any GST-related conversion. Callers must pass the invoice issue date or transaction date, not omit it. Add a `gstConversion` boolean flag — when true, `date` becomes mandatory and an error is thrown if omitted.**

- [ ] `refreshRatesFromAPI(baseCurrency?: string): Promise<RefreshResult>`
  - Fetch latest exchange rates from external API (default base: AUD)
  - Store new rates in exchange_rates table with source='api'
  - **REVISION NOTE (D03 S3 + D01 SUG-07): Cache exchange rates in Redis with 1-hour TTL** (not 6 hours — rates should be fresher for accurate invoicing)
  - Fallback to last known rate if API is down — query most recent rate from `exchange_rates` table
  - Store ALL fetched rates in `exchange_rates` table for audit trail (historical rates must be preserved)
  - Supported providers: `open.er-api.com` (free tier, no API key needed) as default; configurable via `EXCHANGE_RATE_PROVIDER` env var
  - Use `EXCHANGE_RATE_API_KEY` env var if required by chosen provider
  - **REVISION NOTE (D03 S3): Error handling for exchange rate API failure**:
    1. If API call fails: use last cached Redis rate (even if expired)
    2. If no Redis cache: query most recent rate from `exchange_rates` table
    3. If no DB rate exists: throw `ExchangeRateUnavailableError` with clear message
    4. Log staleness warnings when rates are >24 hours old
    5. Notify user via SSE event `exchange_rate_stale` when using rates >24 hours old

- [ ] `getHistoricalRates(from: string, to: string, startDate: string, endDate: string): Promise<ExchangeRate[]>`
  - Return all stored exchange rates for pair within date range
  - For charting exchange rate trends

- [ ] `addManualRate(from: string, to: string, rate: number, effectiveDate: string): Promise<ExchangeRate>`
  - Insert a manual exchange rate
  - Validates: rate > 0, from !== to, both currencies exist
  - source = 'manual'

**Interfaces**:

```typescript
interface ConvertedAmount {
  originalAmountCents: number;
  originalCurrency: string;
  convertedAmountCents: number;
  targetCurrency: string;
  exchangeRate: number;
  effectiveDate: string;
}

interface RefreshResult {
  baseCurrency: string;
  ratesUpdated: number;
  source: string;
  timestamp: string;
  errors: string[];
}
```

**Environment variables** (add to docker-compose.yml server service):
```yaml
- EXCHANGE_RATE_API_KEY=${EXCHANGE_RATE_API_KEY:-}
- EXCHANGE_RATE_PROVIDER=${EXCHANGE_RATE_PROVIDER:-open.er-api.com}
- BASE_CURRENCY=${BASE_CURRENCY:-AUD}
- EXCHANGE_RATE_CACHE_TTL=${EXCHANGE_RATE_CACHE_TTL:-3600}  # REVISION NOTE: 1 hour (was 6 hours) for fresher rates
```

**Redis caching pattern**:
```typescript
// REVISION NOTE (D03 S3): 1-hour TTL for exchange rates, with fallback chain
const EXCHANGE_RATE_CACHE_TTL = parseInt(process.env.EXCHANGE_RATE_CACHE_TTL || '3600'); // 1 hour default

const cacheKey = `exchange:rates:${baseCurrency}:${date}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... fetch from API ...
try {
  const rates = await fetchFromProvider(baseCurrency);
  await redis.setex(cacheKey, EXCHANGE_RATE_CACHE_TTL, JSON.stringify(rates));
  // Store in DB for audit trail
  for (const [currency, rate] of Object.entries(rates)) {
    await storeExchangeRate(baseCurrency, currency, rate, date, 'api');
  }
  return rates;
} catch (apiError) {
  // Fallback 1: Try expired Redis cache
  const staleKey = `exchange:rates:${baseCurrency}:latest`;
  const stale = await redis.get(staleKey);
  if (stale) {
    console.warn(`Exchange rate API failed, using stale cached rate`);
    return JSON.parse(stale);
  }
  // Fallback 2: Query last known rate from DB
  const dbRate = await getLastKnownRate(baseCurrency);
  if (dbRate) {
    console.warn(`Exchange rate API failed, using last DB rate from ${dbRate.effectiveDate}`);
    return dbRate;
  }
  throw new Error(`Exchange rate unavailable for ${baseCurrency}: API down and no cached/historical rates`);
}
```

**Implementation notes**:
- Use `fetch()` for external API calls (Node.js built-in)
- Exchange rates stored as REAL (float) — acceptable for rates, NOT for monetary amounts
- All monetary amounts remain INTEGER cents — conversion does: `Math.round(amountCents * rate)`
- Redis TTL prevents excessive API calls (free tier typically limits 1500 requests/month)
- If Redis unavailable, fall back to in-memory cache with Map
- **REVISION NOTE (D02 — ATO multi-currency GST)**: GST on foreign currency invoices MUST be calculated at the exchange rate on the DATE OF SUPPLY per ATO Goods and Services Tax Ruling GSTR 2001/2. When `convertAmount()` is called for GST purposes, the date parameter is mandatory. Add `convertAmountForGST(amountCents, from, to, dateOfSupply)` convenience method that enforces this.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `convertAmount(10000, 'AUD', 'USD', '2026-01-15')` returns correct conversion
- [ ] `refreshRatesFromAPI()` fetches and stores rates, caches in Redis
- [ ] `addManualRate()` validates inputs and stores with source='manual'
- [ ] Graceful degradation when external API is unavailable
- [ ] Create marker file: `.agent-done-W09-03`

## Dependencies
- **None** — can start immediately
- **Runtime dependency**: Requires `currencies` and `exchange_rates` tables (from Agent 1 migration)
- **Redis**: Uses ioredis client (already in server dependencies from Wave 17)
