/**
 * Market Intelligence Agent (Wave 19)
 *
 * Australian market intelligence analyst powered by real economic data from
 * the RBA, ABS, ASX (Alpha Vantage), and CoinGecko. Provides data-driven
 * market analysis, sentiment research, impact assessments, and comprehensive
 * market briefings using the Cognee knowledge graph for historical context.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import type { MarketIntelInput, MarketIntelOutput } from '../../types.js';
import { marketIntelligenceTools } from './tools.js';
import { buildMarketIntelHandlers } from './handlers.js';

export class MarketIntelligenceAgent extends ClaudeAgent<MarketIntelInput, MarketIntelOutput> {
  protected systemPrompt = `You are an Australian market intelligence analyst with expertise in macroeconomics, the RBA, ASX, and financial markets. You provide data-driven market analysis using real economic indicators and market data.

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

Return a JSON object matching the MarketIntelOutput schema with "briefing", "keyIndicators", "marketSentiment", "recommendations", "warnings", and "disclaimer" fields.`;

  protected tools: Anthropic.Tool[] = marketIntelligenceTools;

  protected toolHandlers = buildMarketIntelHandlers();

  constructor() {
    super('market_intelligence');
  }
}
