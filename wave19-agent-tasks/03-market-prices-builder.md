# Agent 3: Market Prices Builder

## Role
Build market price feed services for ASX equities (via Alpha Vantage) and cryptocurrency prices (via CoinGecko), providing real-time and historical price data for the platform.

## Priority: WAVE 19 (After Agent 1)

## Wait Condition
Check for `.agent-done-W19-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/market-prices.ts`
**Purpose**: Fetch and store ASX equity and crypto prices
**Pattern**: Service class with rate-limited HTTP fetching

- [ ] Create `MarketPriceService` class:
  ```typescript
  interface MarketPriceConfig {
    alphaVantageApiKey: string;       // from env: ALPHA_VANTAGE_API_KEY
    alphaVantageBaseUrl: string;      // default: 'https://www.alphavantage.co/query'
    alphaVantageDailyLimit: number;   // default: 25 (free tier)
    coingeckoBaseUrl: string;         // default: 'https://api.coingecko.com/api/v3'
    coingeckoRateLimit: number;       // default: 30 (requests per minute)
    cacheTtlMs: number;              // default: 300000 (5 minutes for prices)
  }
  ```

- [ ] **Alpha Vantage -- ASX Equities** (25 req/day free tier):

  `async fetchASXQuote(symbol: string): Promise<MarketPrice>`
  - GET `{baseUrl}?function=GLOBAL_QUOTE&symbol={symbol}.AX&apikey={key}`
  - Parse response: `{ "Global Quote": { "01. symbol", "02. open", "03. high", "04. low", "05. price", "06. volume", "08. previous close", "09. change", "10. change percent" } }`
  - Map to `MarketPrice` record
  - ASX symbols require `.AX` suffix (e.g., `CBA.AX`, `BHP.AX`)
  - Track daily API call count to stay within 25 limit

  `async fetchASXDailyHistory(symbol: string, outputSize?: 'compact' | 'full'): Promise<MarketPrice[]>`
  - GET `{baseUrl}?function=TIME_SERIES_DAILY&symbol={symbol}.AX&outputsize={outputSize}&apikey={key}`
  - Parse `Time Series (Daily)` object
  - Default `compact` (last 100 days), `full` for complete history
  - Costs 1 API call per symbol

  `async fetchASXBatch(symbols: string[]): Promise<MarketPrice[]>`
  - Fetch quotes for multiple ASX symbols
  - Respect 25 req/day limit (track usage in memory + DB)
  - If limit approached, return cached data with warning

- [ ] **Default ASX Watchlist** (key Australian stocks):
  ```typescript
  const DEFAULT_ASX_WATCHLIST = [
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
    { symbol: 'XAO', name: 'All Ordinaries Index', sector: 'Index' }
  ];
  ```

- [ ] **CoinGecko -- Cryptocurrency** (30 req/min free tier):

  `async fetchCryptoPrice(coinId: string): Promise<MarketPrice>`
  - GET `{baseUrl}/simple/price?ids={coinId}&vs_currencies=aud&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
  - Map to `MarketPrice` record with `asset_type: 'cryptocurrency'`, `currency: 'AUD'`

  `async fetchCryptoPrices(coinIds: string[]): Promise<MarketPrice[]>`
  - Batch fetch up to 50 coins in single request
  - GET `{baseUrl}/simple/price?ids={coinIds.join(',')}&vs_currencies=aud&include_24hr_change=true&include_market_cap=true`

  `async fetchCryptoHistory(coinId: string, days: number): Promise<MarketPrice[]>`
  - GET `{baseUrl}/coins/{coinId}/market_chart?vs_currency=aud&days={days}`
  - Parse `{ prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }`

- [ ] **Default Crypto Watchlist**:
  ```typescript
  const DEFAULT_CRYPTO_WATCHLIST = [
    { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { coinId: 'solana', symbol: 'SOL', name: 'Solana' },
    { coinId: 'ripple', symbol: 'XRP', name: 'XRP' },
    { coinId: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { coinId: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
    { coinId: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
    { coinId: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' }
  ];
  ```

- [ ] **Unified Price Methods**:

  `async getAllPrices(): Promise<{ asx: MarketPrice[]; crypto: MarketPrice[] }>`
  - Fetch both ASX watchlist and crypto watchlist
  - Respect rate limits for both APIs
  - Return combined result

  `async refreshPrices(): Promise<RefreshResult>`
  ```typescript
  interface RefreshResult {
    asxUpdated: number;
    cryptoUpdated: number;
    asxApiCallsRemaining: number;
    errors: Array<{ source: string; symbol: string; error: string }>;
  }
  ```
  - Upsert all prices into `market_prices` table
  - Track API usage

  `async getPriceHistory(symbol: string, days?: number): Promise<MarketPrice[]>`
  - Return historical prices from DB
  - Fetch from API if not cached

  `async searchSymbol(query: string): Promise<Array<{ symbol: string; name: string; type: string }>>`
  - Alpha Vantage: `function=SYMBOL_SEARCH&keywords={query}`
  - CoinGecko: `{baseUrl}/search?query={query}`
  - Combine and return

- [ ] **Rate Limiter**:
  ```typescript
  private alphaVantageCalls: { date: string; count: number };
  private coingeckoLastRequest: number;

  private async checkAlphaVantageLimit(): Promise<boolean>;
  private async waitForCoingeckoLimit(): Promise<void>;
  ```
  - Alpha Vantage: track daily count, reject if >= 25
  - CoinGecko: enforce 2-second minimum gap between requests (30/min)

## Files to MODIFY

None.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `fetchASXQuote('CBA')` returns CBA share price from Alpha Vantage (requires API key)
- [ ] `fetchCryptoPrices(['bitcoin', 'ethereum'])` returns BTC and ETH AUD prices
- [ ] Rate limiter correctly tracks Alpha Vantage daily calls (stops at 25)
- [ ] CoinGecko rate limiter enforces 2-second gap
- [ ] Prices upserted into `market_prices` table with correct `asset_type`
- [ ] `getPriceHistory('BTC', 30)` returns 30 days of price data
- [ ] Create marker file: `.agent-done-W19-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`) for market schema/tables
- **External**: Alpha Vantage API (free tier: 25 req/day, requires API key via env `ALPHA_VANTAGE_API_KEY`)
- **External**: CoinGecko API (free tier: 30 req/min, no API key required)
