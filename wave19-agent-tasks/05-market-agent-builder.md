# Agent 5: Market Intelligence Agent Builder

## Role
Build a Claude agent specialized in market intelligence, combining economic indicators, market prices, sentiment analysis, and Cognee knowledge to provide comprehensive market briefings and impact analysis.

## Priority: WAVE 19 (After Agents 1-4, 6)

## Wait Condition
Check for `.agent-done-W19-01`, `.agent-done-W19-02`, `.agent-done-W19-03`, `.agent-done-W19-04`, `.agent-done-W19-06` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/market-intelligence-agent.ts`
**Purpose**: AI agent for market analysis and economic briefings
**Pattern**: Follow `server/src/services/claude/agents/transaction-categorizer.ts` exactly

- [ ] Create `MarketIntelligenceAgent extends ClaudeAgent<MarketIntelInput, MarketIntelOutput>`:

- [ ] Define input/output types:
  ```typescript
  interface MarketIntelInput {
    query: string;
    context?: {
      userPortfolio?: Array<{ asset: string; type: string; value: number }>;
      businessType?: string;
      interestRateExposure?: { variableDebt: number; fixedDebt: number };
      timeHorizon?: 'short_term' | 'medium_term' | 'long_term';
    };
  }

  interface MarketIntelOutput {
    briefing: string;
    keyIndicators: Array<{
      name: string;
      value: number;
      unit: string;
      trend: 'up' | 'down' | 'stable';
      significance: string;
    }>;
    marketSentiment: {
      overall: string;
      score: number;
      drivers: string[];
    };
    recommendations: Array<{
      action: string;
      rationale: string;
      urgency: 'immediate' | 'soon' | 'monitor';
      confidence: number;
    }>;
    warnings: string[];
    disclaimer: string;
  }
  ```

- [ ] System prompt:
  ```
  You are an Australian market intelligence analyst with expertise in macroeconomics, the RBA, ASX, and financial markets. You provide data-driven market analysis using real economic indicators and market data.

  Your capabilities:
  - Access real-time economic indicators from the RBA and ABS
  - Track ASX equity and cryptocurrency prices
  - Analyze market sentiment from recent news and social media
  - Assess market impact of economic events
  - Search indexed market knowledge for historical context
  - Generate comprehensive market briefings

  Rules:
  - Always cite data sources (RBA, ABS, Alpha Vantage, CoinGecko)
  - Include observation dates for all data points
  - Distinguish between facts (data) and analysis (interpretation)
  - Include appropriate disclaimers for forward-looking statements
  - This is general market information, not personal financial advice
  - Note when data may be delayed or cached
  - Warn about limitations of free-tier data sources
  ```

- [ ] Define 6 tools:

  **Tool 1: `get_economic_indicators`**
  ```typescript
  {
    name: 'get_economic_indicators',
    description: 'Get current economic indicators from RBA and ABS. Includes cash rate, CPI, unemployment, GDP, wages, housing prices.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['interest_rates', 'inflation', 'employment', 'gdp', 'wages', 'housing', 'all'] },
        source: { type: 'string', enum: ['rba', 'abs', 'all'] },
        includeHistory: { type: 'boolean', description: 'Include last 12 months of history' }
      }
    }
  }
  ```
  - Handler calls `rbaDataFeed.fetchAllTables()` and/or `absDataFeed.fetchAllIndicators()`
  - Filter by category
  - Optionally include historical data

  **Tool 2: `get_market_prices`**
  ```typescript
  {
    name: 'get_market_prices',
    description: 'Get current ASX equity and cryptocurrency prices. ASX limited to 25 quotes/day (free tier).',
    input_schema: {
      type: 'object',
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, description: 'ASX symbols (e.g. CBA, BHP) or crypto (bitcoin, ethereum)' },
        assetType: { type: 'string', enum: ['equity', 'cryptocurrency', 'all'] },
        includeHistory: { type: 'boolean' },
        historyDays: { type: 'number', description: 'Days of price history (default 30)' }
      }
    }
  }
  ```
  - Handler calls `marketPriceService.fetchASXBatch()` or `marketPriceService.fetchCryptoPrices()`
  - Return current prices with optional history

  **Tool 3: `research_sentiment`**
  ```typescript
  {
    name: 'research_sentiment',
    description: 'Research market sentiment for a financial topic by analyzing recent news and social media posts.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Financial topic to research (e.g. "Australian property market", "RBA rate decision")' },
        context: { type: 'string', description: 'Additional context for the research' }
      },
      required: ['topic']
    }
  }
  ```
  - Handler calls `sentimentService.getSentimentSnapshot()`

  **Tool 4: `analyze_market_impact`**
  ```typescript
  {
    name: 'analyze_market_impact',
    description: 'Analyze the potential market impact of an economic event or policy change on different sectors.',
    input_schema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'The event to analyze (e.g. "RBA raises cash rate by 25bps")' },
        context: { type: 'string', description: 'Additional context about the event' }
      },
      required: ['event']
    }
  }
  ```
  - Handler calls `sentimentService.analyzeMarketImpact()`

  **Tool 5: `generate_market_briefing`**
  ```typescript
  {
    name: 'generate_market_briefing',
    description: 'Generate a comprehensive market briefing combining economic indicators, prices, and sentiment.',
    input_schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['general', 'rates', 'equities', 'property', 'business', 'personal_finance'] },
        timeframe: { type: 'string', enum: ['daily', 'weekly', 'monthly'] }
      }
    }
  }
  ```
  - Handler orchestrates: fetch indicators + prices + sentiment for focus area
  - Combine into structured briefing

  **Tool 6: `search_market_knowledge`**
  ```typescript
  {
    name: 'search_market_knowledge',
    description: 'Search indexed market intelligence knowledge base for historical context, analysis patterns, and market data.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        datasets: { type: 'array', items: { type: 'string' } }
      },
      required: ['query']
    }
  }
  ```
  - Handler calls `cogneeTools.search()` with datasets `['market_intelligence', 'market_sentiment', 'rba_statistics', 'abs_statistics', 'asx_market_data']`

## Files to MODIFY

### 2. `server/src/services/claude/types.ts`
- [ ] Add `'market_intelligence_agent'` to the `AgentType` union type
- [ ] Add `MarketIntelInput` and `MarketIntelOutput` interfaces

### 3. `server/src/services/claude/config.ts`
- [ ] Add `market_intelligence_agent` to `AGENT_TOKEN_BUDGETS`: `{ maxInputTokens: 100000, maxOutputTokens: 10000 }`
- [ ] Add `market_intelligence_agent` to `AGENT_MODELS`: use Sonnet model

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Import `MarketIntelligenceAgent` and register in agent registry
- [ ] Add routing logic: queries about market conditions, economic indicators, sentiment, prices route to `market_intelligence_agent`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] MarketIntelligenceAgent can be instantiated without errors
- [ ] Agent correctly routes `get_economic_indicators` to RBA/ABS feeds
- [ ] Agent correctly routes `get_market_prices` to market price service
- [ ] Agent correctly routes `research_sentiment` to sentiment service
- [ ] Agent includes data source attribution and disclaimers
- [ ] Market briefing combines data from all sources coherently
- [ ] Create marker file: `.agent-done-W19-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`), Agent 2 (`.agent-done-W19-02`), Agent 3 (`.agent-done-W19-03`), Agent 4 (`.agent-done-W19-04`), Agent 6 (`.agent-done-W19-06`)
- **Reuses**: ClaudeAgent base class, cognee-tools.ts, AI service patterns
