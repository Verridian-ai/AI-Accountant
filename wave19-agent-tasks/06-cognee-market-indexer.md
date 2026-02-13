# Agent 6: Cognee Market Indexer

## Role
Index market intelligence data into Cognee knowledge graph datasets for semantic search, enabling the market agent and chat to reason about economic trends, market conditions, and sentiment patterns.

## Priority: WAVE 19 (After Agents 1, 2, 3, 4)

## Wait Condition
Check for `.agent-done-W19-01`, `.agent-done-W19-02`, `.agent-done-W19-03`, `.agent-done-W19-04` marker files before starting.

## Files to CREATE

### 1. `server/src/services/market-cognee-indexer.ts`
**Purpose**: Transform market data into Cognee-indexable documents across 5 datasets
**Pattern**: Follow `server/src/services/cdr-cognee-indexer.ts` (Wave 18 Agent 6) patterns

- [ ] Create `MarketCogneeIndexer` class:
  ```typescript
  import { CogneeClient } from './cognee_client.js';

  class MarketCogneeIndexer {
    private cogneeClient: CogneeClient;
    private datasets = {
      intelligence: 'market_intelligence',
      sentiment: 'market_sentiment',
      rba: 'rba_statistics',
      abs: 'abs_statistics',
      asx: 'asx_market_data'
    };

    constructor(cogneeClient?: CogneeClient) {
      this.cogneeClient = cogneeClient ?? new CogneeClient();
    }
  }
  ```

- [ ] **Dataset 1: `market_intelligence`** -- Combined market analysis
  `async indexMarketIntelligence(snapshots: MarketSnapshot[]): Promise<IndexResult>`
  - Transform each market snapshot into a structured document:
    ```
    Market Intelligence Report - {date}

    Economic Indicators:
    - RBA Cash Rate: {value}% (trend: {up/down/stable})
    - CPI Annual: {value}% (previous: {prev})
    - Unemployment Rate: {value}%
    - GDP Growth: {value}%

    Market Summary:
    - ASX 200: {value} ({changePct}%)
    - AUD/USD: {value}
    - Top Movers: {list}

    Key Events:
    - {event1}
    - {event2}

    Analysis:
    {AI-generated summary of current market conditions}
    ```
  - Index weekly snapshots for trend analysis
  - Cognify with custom prompt:
    ```
    Extract entities: economic indicators, rates, percentages, market indices, currencies. Create relationships between indicators (e.g., cash rate affects mortgage rates, CPI affects rate decisions). Track trends over time.
    ```

- [ ] **Dataset 2: `market_sentiment`** -- Sentiment analysis data
  `async indexSentimentData(sentiments: SentimentSnapshot[]): Promise<IndexResult>`
  - Transform each sentiment snapshot:
    ```
    Sentiment Analysis: {topic}
    Date: {observationDate}
    Score: {sentimentScore} ({sentimentLabel})
    Confidence: {confidence}

    Positive Signals ({positiveCount}):
    {top positive findings}

    Negative Signals ({negativeCount}):
    {top negative findings}

    Summary: {summary}

    Sources: {source list}
    ```
  - Cognify with custom prompt:
    ```
    Extract entities: sentiment topics, sentiment scores, market themes, news sources, positive/negative drivers. Create relationships between topics and their sentiment over time. Identify recurring themes and sentiment patterns.
    ```

- [ ] **Dataset 3: `rba_statistics`** -- RBA data and decisions
  `async indexRbaData(indicators: EconomicIndicator[]): Promise<IndexResult>`
  - Group indicators by category and create structured documents:
    ```
    RBA Interest Rates - {period}
    Cash Rate Target: {value}%
    Overnight Rate: {value}%
    Standard Variable Home Loan: {value}%
    Discounted Variable Home Loan: {value}%
    Personal Loan Rate: {value}%
    Term Deposit 1yr: {value}%

    Changes from Previous Period:
    - Cash Rate: {change} ({direction})
    - Home Loan Variable: {change}
    ```
  - Create separate documents for each RBA table category
  - Cognify with:
    ```
    Extract entities: interest rates, rate changes, effective dates, rate types. Create relationships between cash rate and lending rates, between rate decisions and economic conditions.
    ```

- [ ] **Dataset 4: `abs_statistics`** -- ABS economic data
  `async indexAbsData(indicators: EconomicIndicator[]): Promise<IndexResult>`
  - Group by ABS dataflow and create documents:
    ```
    ABS Labour Force Statistics - {period}
    Unemployment Rate: {value}%
    Participation Rate: {value}%
    Employed Persons: {value} thousand

    ABS Consumer Price Index - {period}
    CPI All Groups: {value}
    CPI % Change: {value}%

    ABS GDP - {period}
    GDP Quarterly: {value}%
    GDP Annual: {value}%

    ABS Wages - {period}
    WPI All Sectors: {value}%
    WPI Private: {value}%
    ```
  - Cognify with:
    ```
    Extract entities: unemployment rate, CPI values, GDP growth, wage growth, participation rate. Create relationships between employment and economic growth, between wages and inflation.
    ```

- [ ] **Dataset 5: `asx_market_data`** -- ASX and crypto price data
  `async indexMarketPrices(prices: MarketPrice[]): Promise<IndexResult>`
  - Group by asset type and create documents:
    ```
    ASX Market Data - {date}

    Major Banks:
    - CBA: ${price} ({changePct}%)
    - NAB: ${price} ({changePct}%)
    - WBC: ${price} ({changePct}%)
    - ANZ: ${price} ({changePct}%)

    Index:
    - ASX 200: {value} ({changePct}%)
    - All Ordinaries: {value} ({changePct}%)

    Top Gainers: {list}
    Top Losers: {list}

    Cryptocurrency (AUD):
    - Bitcoin: ${price} ({changePct}%)
    - Ethereum: ${price} ({changePct}%)
    ```
  - Cognify with:
    ```
    Extract entities: stock symbols, prices, percentage changes, sectors, market indices. Create relationships between stocks in same sector, between indices and individual stocks, between crypto assets.
    ```

- [ ] **Full Index**: `async fullIndex(): Promise<FullIndexResult>`
  ```typescript
  interface FullIndexResult {
    datasetsIndexed: number;
    documentsIndexed: number;
    errors: string[];
    durationMs: number;
    datasetResults: Record<string, { documents: number; status: string }>;
  }
  ```
  - Fetch all market data from database
  - Run all 5 dataset indexing operations sequentially
  - Report per-dataset results

- [ ] **Incremental Index**: `async incrementalIndex(since: string): Promise<FullIndexResult>`
  - Only index data updated since given timestamp
  - Designed to run after each data refresh cycle

- [ ] **Search Helper**: `async searchMarketKnowledge(query: string, datasets?: string[], searchType?: string): Promise<any>`
  - Multi-dataset search across market datasets
  - Default: search all 5 datasets
  - Smart search type selection:
    - `CHUNKS` for specific data point lookups
    - `CHUNKS_LEXICAL` for indicator name searches
    - `GRAPH_COMPLETION` for trend analysis and reasoning
    - `RAG_COMPLETION` for comprehensive market questions

## Files to MODIFY

### 2. `server/src/services/claude/cognee-tools.ts`
- [ ] Add market-specific search tool definitions:
  ```typescript
  {
    name: 'search_market_intelligence',
    description: 'Search market intelligence knowledge base for economic data, sentiment, and analysis',
    datasets: ['market_intelligence', 'market_sentiment', 'rba_statistics', 'abs_statistics', 'asx_market_data']
  }
  ```
- [ ] Add handler that routes to MarketCogneeIndexer.searchMarketKnowledge()

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `indexRbaData()` successfully uploads RBA indicator documents to `rba_statistics` dataset
- [ ] `indexAbsData()` creates ABS indicator documents in `abs_statistics` dataset
- [ ] `indexMarketPrices()` creates price documents in `asx_market_data` dataset
- [ ] `indexSentimentData()` stores sentiment documents in `market_sentiment` dataset
- [ ] `cogneeClient.cognify()` runs without error on all 5 datasets
- [ ] `searchMarketKnowledge('current RBA cash rate')` returns relevant rate data
- [ ] `searchMarketKnowledge('unemployment trend')` returns ABS employment data
- [ ] Create marker file: `.agent-done-W19-06`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`), Agent 2 (`.agent-done-W19-02`), Agent 3 (`.agent-done-W19-03`), Agent 4 (`.agent-done-W19-04`)
- **Reuses**: `server/src/services/cognee_client.ts` (CogneeClient class), cognee-tools.ts patterns
