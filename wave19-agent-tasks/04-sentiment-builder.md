# Agent 4: Sentiment Analysis Builder

## Role
Build a sentiment analysis service that researches financial topics using web search, analyzes sentiment from recent posts and articles, and stores sentiment snapshots for market intelligence.

## Priority: WAVE 19 (After Agent 1)

## Wait Condition
Check for `.agent-done-W19-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/sentiment-analysis.ts`
**Purpose**: Research financial topics and analyze market sentiment
**Pattern**: Service class with AI-powered analysis

- [ ] Create `SentimentAnalysisService` class:
  ```typescript
  interface SentimentConfig {
    openaiApiKey: string;             // from env: OPENAI_API_KEY (for embeddings/analysis)
    maxTopicsPerDay: number;          // default: 20
    cacheTtlMs: number;              // default: 3600000 (1 hour)
    searchResultLimit: number;        // default: 10
  }
  ```

- [ ] **Core Research Method**: `async researchTopic(topic: string, context?: string): Promise<ResearchResult>`
  ```typescript
  interface ResearchResult {
    topic: string;
    query: string;
    articles: Array<{
      title: string;
      url: string;
      source: string;
      snippet: string;
      publishedDate: string | null;
    }>;
    summary: string;
    keyFindings: string[];
    relatedTopics: string[];
    fetchedAt: string;
  }
  ```
  - Construct search query from topic + financial context (e.g., "Australian {topic} market outlook 2026")
  - Use web search to find recent articles and posts
  - Extract article metadata (title, source, snippet)
  - Use Claude/AI to summarize findings into key points
  - Return structured research result

- [ ] **Sentiment Scoring**: `async analyzeSentiment(articles: Article[], topic: string): Promise<SentimentResult>`
  ```typescript
  interface SentimentResult {
    sentimentScore: number;           // -1.0 to 1.0
    sentimentLabel: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
    confidence: number;               // 0-1
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    topPositive: Array<{ title: string; reason: string }>;
    topNegative: Array<{ title: string; reason: string }>;
    summary: string;
  }
  ```
  - Send articles to Claude/AI with prompt:
    ```
    Analyze the sentiment of the following articles about "{topic}" in the Australian financial context.
    For each article, classify sentiment as positive, negative, or neutral.
    Provide an overall sentiment score from -1.0 (very negative) to 1.0 (very positive).
    Identify the top 3 positive and top 3 negative sentiments with brief reasons.
    Provide a 2-3 sentence summary of the overall market sentiment.
    ```
  - Parse AI response into structured `SentimentResult`
  - Validate score is within -1.0 to 1.0 range

- [ ] **Full Sentiment Snapshot**: `async getSentimentSnapshot(topic: string): Promise<SentimentSnapshot>`
  - Orchestrate: research topic -> analyze sentiment -> store snapshot
  - Check cache first (return cached if within TTL)
  - Store result in `sentiment_snapshots` table
  - Return combined research + sentiment data

- [ ] **Batch Sentiment**: `async getMultiTopicSentiment(topics: string[]): Promise<SentimentSnapshot[]>`
  - Process multiple topics in sequence (respect rate limits)
  - Default financial topics if none provided:
    ```typescript
    const DEFAULT_FINANCIAL_TOPICS = [
      'Australian property market',
      'ASX stock market outlook',
      'RBA interest rate decision',
      'Australian inflation outlook',
      'cryptocurrency market Australia',
      'Australian banking sector',
      'small business confidence Australia',
      'Australian dollar outlook'
    ];
    ```

- [ ] **Sentiment History**: `async getSentimentHistory(topic: string, days?: number): Promise<SentimentSnapshot[]>`
  - Query `sentiment_snapshots` for historical sentiment data
  - Default last 30 days
  - Return sorted by date descending

- [ ] **Market Impact Analysis**: `async analyzeMarketImpact(event: string, context: string): Promise<ImpactAnalysis>`
  ```typescript
  interface ImpactAnalysis {
    event: string;
    impactSummary: string;
    affectedSectors: Array<{ sector: string; impact: 'positive' | 'negative' | 'neutral'; reason: string }>;
    shortTermOutlook: string;
    longTermOutlook: string;
    confidence: number;
    sources: string[];
  }
  ```
  - Research event impact using web search
  - Use AI to analyze sector-specific impacts
  - Provide short-term and long-term outlook

- [ ] **Trending Topics**: `async getTrendingFinancialTopics(): Promise<Array<{ topic: string; trendScore: number; recentArticles: number }>>`
  - Search for current Australian financial news trends
  - Score topics by frequency and recency
  - Return top 10 trending topics

- [ ] **AI Integration Helper**:
  ```typescript
  private async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Use existing AI service pattern (Claude primary, OpenRouter fallback)
    // Reuse circuit breaker from server/src/services/ai.ts
  }
  ```

## Files to MODIFY

None.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `researchTopic('Australian property market')` returns articles with summaries
- [ ] `analyzeSentiment()` returns valid sentiment score in -1.0 to 1.0 range
- [ ] `getSentimentSnapshot('RBA interest rates')` stores result in `sentiment_snapshots` table
- [ ] Sentiment labels correctly map to score ranges (e.g., > 0.5 = 'positive')
- [ ] Cache prevents duplicate research within TTL
- [ ] `getSentimentHistory()` returns historical snapshots sorted by date
- [ ] AI fallback works (Claude -> OpenRouter) on circuit breaker trip
- [ ] Create marker file: `.agent-done-W19-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W19-01`) for market schema/tables
- **Reuses**: AI service patterns from `server/src/services/ai.ts`, circuit breaker
- **External**: Web search capability for article discovery
- **External**: Claude/OpenRouter API for sentiment analysis
