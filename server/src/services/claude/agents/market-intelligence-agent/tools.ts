/**
 * Market Intelligence Agent — Tool Definitions
 *
 * Anthropic tool schemas for economic indicators, market prices,
 * sentiment research, impact analysis, market briefings, and knowledge search.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const marketIntelligenceTools: Anthropic.Tool[] = [
  {
    name: 'get_economic_indicators',
    description:
      'Fetch current economic indicators from the RBA (cash rate, lending rates, CPI, housing) and ABS (unemployment, GDP, wages, CPI, dwelling approvals). Returns the latest values with change percentages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['rba', 'abs', 'both'] },
          description: 'Which data sources to query (default: both)',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Filter by category: interest_rates, inflation, housing, employment, gdp, wages. Leave empty for all.',
        },
        indicatorCode: {
          type: 'string',
          description:
            'Specific indicator code to fetch (e.g. RBA_CASH_RATE, ABS_UNEMPLOYMENT_RATE). If provided, returns just this indicator.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_market_prices',
    description:
      'Fetch current ASX equity prices (via Alpha Vantage) and cryptocurrency prices (via CoinGecko). Can retrieve individual quotes, batch prices, or historical data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['quote', 'batch', 'history', 'search', 'all'],
          description:
            'Action: quote (single symbol), batch (default watchlist), history (price history), search (find symbols), all (full watchlist refresh)',
        },
        symbol: {
          type: 'string',
          description:
            'Stock symbol (e.g. CBA, BHP) or crypto ID (e.g. bitcoin, ethereum). Required for quote, history.',
        },
        days: {
          type: 'number',
          description: 'Number of days of history to fetch (default: 30). For history action.',
        },
        assetType: {
          type: 'string',
          enum: ['equity', 'cryptocurrency', 'all'],
          description: 'Filter by asset type (default: all)',
        },
      },
      required: [],
    },
  },
  {
    name: 'research_sentiment',
    description:
      'Research market sentiment for a financial topic. Uses AI to analyze recent articles, news, and market commentary, returning a sentiment score, breakdown, and summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description:
            'Financial topic to research (e.g. "RBA interest rate decision", "Australian property market", "ASX bank stocks")',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'analyze_market_impact',
    description:
      'Analyze the potential market impact of a specific economic event on Australian sectors. Returns affected sectors, short/long-term outlooks, and confidence level.',
    input_schema: {
      type: 'object' as const,
      properties: {
        event: {
          type: 'string',
          description:
            'The economic event to analyze (e.g. "RBA raises cash rate by 25bps", "Iron ore price drops 15%")',
        },
        context: {
          type: 'string',
          description:
            'Additional context about the event (e.g. "3rd consecutive increase this year")',
        },
      },
      required: ['event'],
    },
  },
  {
    name: 'generate_market_briefing',
    description:
      'Generate a comprehensive market briefing by orchestrating fetches of economic indicators, market prices, and sentiment data. Returns a unified market overview.',
    input_schema: {
      type: 'object' as const,
      properties: {
        focus: {
          type: 'string',
          description:
            'Focus area for the briefing: general, interest_rates, equities, crypto, property, employment. Default: general.',
        },
        includeIndicators: {
          type: 'boolean',
          description: 'Include RBA/ABS economic indicators (default: true)',
        },
        includePrices: {
          type: 'boolean',
          description: 'Include ASX/crypto prices (default: true)',
        },
        includeSentiment: {
          type: 'boolean',
          description: 'Include sentiment analysis (default: true)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_market_knowledge',
    description:
      'Search the Cognee knowledge graph for indexed market intelligence, sentiment history, economic indicator trends, and historical market data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query about market conditions, trends, or historical data',
        },
        dataset: {
          type: 'string',
          enum: [
            'market_intelligence',
            'market_sentiment',
            'rba_statistics',
            'abs_statistics',
            'asx_market_data',
          ],
          description: 'Knowledge dataset to search (default: market_intelligence)',
        },
      },
      required: ['query'],
    },
  },
];
