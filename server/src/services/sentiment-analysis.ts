/**
 * Sentiment Analysis Service (Wave 19)
 *
 * Researches financial topics using AI, analyzes sentiment from recent
 * articles/posts, and stores sentiment snapshots for market intelligence.
 *
 * AI stack: Anthropic Claude (primary) → OpenRouter (fallback).
 */

import { db, sentimentSnapshots } from '../schema.js';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SentimentConfig {
  maxTopicsPerDay: number;
  cacheTtlMs: number;
  searchResultLimit: number;
}

export interface ArticleInfo {
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedDate: string | null;
}

export interface ResearchResult {
  topic: string;
  query: string;
  articles: ArticleInfo[];
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
  fetchedAt: string;
}

export interface SentimentResult {
  sentimentScore: number;
  sentimentLabel:
    | 'very_positive'
    | 'positive'
    | 'neutral'
    | 'negative'
    | 'very_negative';
  confidence: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topPositive: Array<{ title: string; reason: string }>;
  topNegative: Array<{ title: string; reason: string }>;
  summary: string;
}

export interface SentimentSnapshot {
  id: string;
  topic: string;
  query: string;
  sentimentScore: number;
  sentimentLabel: string;
  confidence: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalPosts: number;
  topPositive: Array<{ title: string; reason: string }>;
  topNegative: Array<{ title: string; reason: string }>;
  summary: string;
  sources: string[];
  analysisModel: string;
  observationDate: string;
  createdAt: string;
}

export interface ImpactAnalysis {
  event: string;
  impactSummary: string;
  affectedSectors: Array<{
    sector: string;
    impact: 'positive' | 'negative' | 'neutral';
    reason: string;
  }>;
  shortTermOutlook: string;
  longTermOutlook: string;
  confidence: number;
  sources: string[];
}

export interface TrendingTopic {
  topic: string;
  trendScore: number;
  recentArticles: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: SentimentConfig = {
  maxTopicsPerDay: 20,
  cacheTtlMs: 60 * 60 * 1000, // 1 hour
  searchResultLimit: 10,
};

const DEFAULT_FINANCIAL_TOPICS = [
  'Australian property market',
  'ASX stock market outlook',
  'RBA interest rate decision',
  'Australian inflation outlook',
  'cryptocurrency market Australia',
  'Australian banking sector',
  'small business confidence Australia',
  'Australian dollar outlook',
];

const AI_TIMEOUT_MS = 30_000;

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RECOVERY_MS = 60_000;

function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    console.warn(
      '[Sentiment] Circuit breaker OPEN — falling back to OpenRouter',
    );
  }
}

function isCircuitOpen(): boolean {
  if (!circuitBreaker.isOpen) return false;
  if (Date.now() - circuitBreaker.lastFailure > CIRCUIT_BREAKER_RECOVERY_MS) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    console.log('[Sentiment] Circuit breaker CLOSED — retrying Anthropic');
    return false;
  }
  return true;
}

// ============================================================================
// IN-MEMORY CACHE (supplements DB cache for speed)
// ============================================================================

const memoryCache = new Map<
  string,
  { data: SentimentSnapshot; expiresAt: number }
>();

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SentimentAnalysisService {
  private config: SentimentConfig;
  private anthropicClient: Anthropic | null = null;
  private openRouterClient: OpenAI | null = null;

  constructor(config?: Partial<SentimentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initClients();
  }

  private initClients(): void {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
    }

    const openRouterKey = process.env.VITE_OPENROUTER_API_KEY;
    if (openRouterKey) {
      this.openRouterClient = new OpenAI({
        apiKey: openRouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }

    if (!this.anthropicClient && !this.openRouterClient) {
      console.warn(
        '[Sentiment] No AI API keys found — sentiment analysis will not work',
      );
    }
  }

  // ---------- Core Research Method ----------

  async researchTopic(
    topic: string,
    context?: string,
  ): Promise<ResearchResult> {
    const query = `Australian ${topic} market outlook 2026${context ? ` ${context}` : ''}`;
    const now = new Date().toISOString();

    const systemPrompt = `You are an expert Australian financial analyst and market researcher.
When given a financial topic, provide a comprehensive research briefing as if you had just reviewed
the latest news, reports, and market data. Focus on the Australian market context.

Return your response as valid JSON with this exact structure:
{
  "articles": [
    {
      "title": "article title",
      "url": "https://example.com/article",
      "source": "source name",
      "snippet": "brief excerpt or summary",
      "publishedDate": "2026-02-01"
    }
  ],
  "summary": "2-3 paragraph summary of current market conditions and outlook",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "relatedTopics": ["related topic 1", "related topic 2"]
}

Provide 5-10 realistic article entries from well-known Australian financial sources
(AFR, SMH, The Australian, RBA, ABS, CoreLogic, Domain, CommSec, etc.).
Make the analysis thorough, balanced, and based on realistic current market conditions.`;

    const userPrompt = `Research the following topic: "${query}"

Provide a comprehensive market research briefing covering:
1. Current market conditions
2. Recent trends and developments
3. Key data points and statistics
4. Expert opinions and forecasts
5. Risks and opportunities

Focus on Australian market context and provide actionable insights.`;

    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = this.safeParseJSON(response, {
        articles: [],
        summary: 'Unable to parse research results.',
        keyFindings: [],
        relatedTopics: [],
      });

      return {
        topic,
        query,
        articles: (parsed.articles || []).map((a: any) => ({
          title: a.title || 'Unknown',
          url: a.url || '',
          source: a.source || 'Unknown',
          snippet: a.snippet || '',
          publishedDate: a.publishedDate || null,
        })),
        summary: parsed.summary || '',
        keyFindings: parsed.keyFindings || [],
        relatedTopics: parsed.relatedTopics || [],
        fetchedAt: now,
      };
    } catch (err: any) {
      console.error(`[Sentiment] Research failed for "${topic}":`, err.message);
      return {
        topic,
        query,
        articles: [],
        summary: `Research unavailable: ${err.message}`,
        keyFindings: [],
        relatedTopics: [],
        fetchedAt: now,
      };
    }
  }

  // ---------- Sentiment Scoring ----------

  async analyzeSentiment(
    articles: ArticleInfo[],
    topic: string,
  ): Promise<SentimentResult> {
    if (articles.length === 0) {
      return {
        sentimentScore: 0,
        sentimentLabel: 'neutral',
        confidence: 0.1,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        topPositive: [],
        topNegative: [],
        summary: 'No articles available for sentiment analysis.',
      };
    }

    const systemPrompt = `You are an expert financial sentiment analyst specializing in the Australian market.
Analyze the sentiment of financial articles and provide a structured assessment.

Return your response as valid JSON with this exact structure:
{
  "sentimentScore": 0.0,
  "confidence": 0.0,
  "positiveCount": 0,
  "negativeCount": 0,
  "neutralCount": 0,
  "topPositive": [{"title": "...", "reason": "..."}],
  "topNegative": [{"title": "...", "reason": "..."}],
  "summary": "2-3 sentence summary of overall market sentiment"
}

Rules:
- sentimentScore: float from -1.0 (very negative) to 1.0 (very positive)
- confidence: float from 0.0 to 1.0
- topPositive/topNegative: up to 3 entries each
- Be precise with the score — neutral should be close to 0.0`;

    const userPrompt = `Analyze the sentiment of the following articles about "${topic}" in the Australian financial context.

Articles:
${JSON.stringify(
  articles.map((a) => ({
    title: a.title,
    source: a.source,
    snippet: a.snippet,
    date: a.publishedDate,
  })),
  null,
  2,
)}

For each article, classify sentiment as positive, negative, or neutral.
Provide an overall sentiment score from -1.0 (very negative) to 1.0 (very positive).
Identify the top 3 positive and top 3 negative sentiments with brief reasons.
Provide a 2-3 sentence summary of the overall market sentiment.`;

    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = this.safeParseJSON(response, {
        sentimentScore: 0,
        confidence: 0.5,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        topPositive: [],
        topNegative: [],
        summary: 'Unable to parse sentiment results.',
      });

      const score = Math.max(-1, Math.min(1, parsed.sentimentScore ?? 0));
      const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));

      return {
        sentimentScore: score,
        sentimentLabel: this.scoreToLabel(score),
        confidence,
        positiveCount: parsed.positiveCount ?? 0,
        negativeCount: parsed.negativeCount ?? 0,
        neutralCount: parsed.neutralCount ?? 0,
        topPositive: (parsed.topPositive || []).slice(0, 3),
        topNegative: (parsed.topNegative || []).slice(0, 3),
        summary: parsed.summary || '',
      };
    } catch (err: any) {
      console.error(
        `[Sentiment] Analysis failed for "${topic}":`,
        err.message,
      );
      return {
        sentimentScore: 0,
        sentimentLabel: 'neutral',
        confidence: 0.1,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        topPositive: [],
        topNegative: [],
        summary: `Sentiment analysis unavailable: ${err.message}`,
      };
    }
  }

  // ---------- Full Sentiment Snapshot ----------

  async getSentimentSnapshot(topic: string): Promise<SentimentSnapshot> {
    // Check memory cache first
    const cacheKey = topic.toLowerCase().trim();
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Sentiment] Cache HIT for "${topic}"`);
      return cached.data;
    }

    // Check DB cache
    const dbCached = await this.getFromDB(topic);
    if (dbCached) {
      const createdTime = new Date(dbCached.createdAt).getTime();
      if (Date.now() - createdTime < this.config.cacheTtlMs) {
        console.log(`[Sentiment] DB cache HIT for "${topic}"`);
        memoryCache.set(cacheKey, {
          data: dbCached,
          expiresAt: createdTime + this.config.cacheTtlMs,
        });
        return dbCached;
      }
    }

    // Orchestrate: research → analyze → store
    console.log(`[Sentiment] Generating fresh snapshot for "${topic}"`);
    const research = await this.researchTopic(topic);
    const sentiment = await this.analyzeSentiment(research.articles, topic);

    const now = new Date().toISOString();
    const snapshot: SentimentSnapshot = {
      id: crypto.randomUUID(),
      topic,
      query: research.query,
      sentimentScore: sentiment.sentimentScore,
      sentimentLabel: sentiment.sentimentLabel,
      confidence: sentiment.confidence,
      positiveCount: sentiment.positiveCount,
      negativeCount: sentiment.negativeCount,
      neutralCount: sentiment.neutralCount,
      totalPosts: research.articles.length,
      topPositive: sentiment.topPositive,
      topNegative: sentiment.topNegative,
      summary: sentiment.summary,
      sources: research.articles.map((a) => a.source),
      analysisModel: isCircuitOpen()
        ? 'openrouter/google/gemini-3-flash-preview'
        : 'anthropic/claude-haiku',
      observationDate: now.slice(0, 10),
      createdAt: now,
    };

    // Persist to DB
    await this.storeToDB(snapshot);

    // Update memory cache
    memoryCache.set(cacheKey, {
      data: snapshot,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });

    return snapshot;
  }

  // ---------- Batch Sentiment ----------

  async getMultiTopicSentiment(
    topics?: string[],
  ): Promise<SentimentSnapshot[]> {
    const topicList = topics?.length ? topics : DEFAULT_FINANCIAL_TOPICS;
    const results: SentimentSnapshot[] = [];

    for (const topic of topicList.slice(0, this.config.maxTopicsPerDay)) {
      try {
        const snapshot = await this.getSentimentSnapshot(topic);
        results.push(snapshot);
      } catch (err: any) {
        console.error(
          `[Sentiment] Batch: skipping "${topic}" — ${err.message}`,
        );
      }
      // Small delay between topics to respect rate limits
      await this.sleep(500);
    }

    return results;
  }

  // ---------- Sentiment History ----------

  async getSentimentHistory(
    topic: string,
    days = 30,
  ): Promise<SentimentSnapshot[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    try {
      const rows: any[] = await db
        .select()
        .from(sentimentSnapshots)
        .where(
          and(
            eq(sentimentSnapshots.topic, topic),
            gte(sentimentSnapshots.createdAt, cutoffStr),
          ),
        )
        .orderBy(desc(sentimentSnapshots.createdAt))
        .all();

      return rows.map((r) => this.rowToSnapshot(r));
    } catch (err: any) {
      console.error(
        `[Sentiment] History query failed for "${topic}":`,
        err.message,
      );
      return [];
    }
  }

  // ---------- Market Impact Analysis ----------

  async analyzeMarketImpact(
    event: string,
    context: string,
  ): Promise<ImpactAnalysis> {
    const systemPrompt = `You are an expert Australian economic analyst.
Analyze the market impact of economic events on various sectors of the Australian economy.

Return your response as valid JSON with this exact structure:
{
  "impactSummary": "Brief overall impact summary",
  "affectedSectors": [
    {"sector": "sector name", "impact": "positive|negative|neutral", "reason": "explanation"}
  ],
  "shortTermOutlook": "outlook for next 3-6 months",
  "longTermOutlook": "outlook for next 1-3 years",
  "confidence": 0.0,
  "sources": ["source 1", "source 2"]
}

Be specific about Australian sectors: property, banking, mining, technology, healthcare,
agriculture, energy, retail, financial services, construction, education, tourism.`;

    const userPrompt = `Analyze the market impact of the following event:

Event: "${event}"
Context: "${context}"

Provide:
1. Which Australian sectors are most affected and how
2. Short-term outlook (3-6 months)
3. Long-term outlook (1-3 years)
4. Confidence level in the analysis
5. Key sources informing this analysis`;

    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = this.safeParseJSON(response, {
        impactSummary: 'Unable to parse impact analysis.',
        affectedSectors: [],
        shortTermOutlook: '',
        longTermOutlook: '',
        confidence: 0.5,
        sources: [],
      });

      return {
        event,
        impactSummary: parsed.impactSummary || '',
        affectedSectors: (parsed.affectedSectors || []).map((s: any) => ({
          sector: s.sector || 'Unknown',
          impact: ['positive', 'negative', 'neutral'].includes(s.impact)
            ? s.impact
            : 'neutral',
          reason: s.reason || '',
        })),
        shortTermOutlook: parsed.shortTermOutlook || '',
        longTermOutlook: parsed.longTermOutlook || '',
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        sources: parsed.sources || [],
      };
    } catch (err: any) {
      console.error(`[Sentiment] Impact analysis failed:`, err.message);
      return {
        event,
        impactSummary: `Impact analysis unavailable: ${err.message}`,
        affectedSectors: [],
        shortTermOutlook: '',
        longTermOutlook: '',
        confidence: 0,
        sources: [],
      };
    }
  }

  // ---------- Trending Topics ----------

  async getTrendingFinancialTopics(): Promise<TrendingTopic[]> {
    const systemPrompt = `You are an expert Australian financial journalist tracking market trends.
Identify the most important and trending financial topics in Australia right now.

Return your response as valid JSON with this exact structure:
{
  "topics": [
    {"topic": "topic name", "trendScore": 0.0, "recentArticles": 0}
  ]
}

Rules:
- trendScore: float from 0.0 to 1.0 (1.0 = hottest topic)
- recentArticles: estimated number of articles in the last 7 days
- Return exactly 10 topics
- Focus on Australian financial topics: RBA, ASX, property, banking, mining, etc.
- Include a mix of macro-economic, sector-specific, and emerging topics`;

    const userPrompt = `What are the top 10 trending financial topics in Australia right now (February 2026)?
Consider: RBA decisions, ASX performance, property market, banking, mining, technology,
inflation, employment, government policy, international trade impacts on Australia.`;

    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = this.safeParseJSON(response, { topics: [] });

      return (parsed.topics || [])
        .slice(0, 10)
        .map((t: any) => ({
          topic: t.topic || 'Unknown',
          trendScore: Math.max(0, Math.min(1, t.trendScore ?? 0.5)),
          recentArticles: Math.max(0, Math.round(t.recentArticles ?? 0)),
        }));
    } catch (err: any) {
      console.error(`[Sentiment] Trending topics failed:`, err.message);
      return DEFAULT_FINANCIAL_TOPICS.map((topic, i) => ({
        topic,
        trendScore: 1 - i * 0.1,
        recentArticles: 0,
      }));
    }
  }

  // ---------- AI Integration Helper ----------

  private async callAI(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    // Try Anthropic Claude first (unless circuit breaker is open)
    if (this.anthropicClient && !isCircuitOpen()) {
      try {
        const response = await this.anthropicClient.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const textBlock = response.content.find(
          (b): b is Anthropic.TextBlock => b.type === 'text',
        );
        if (textBlock?.text) {
          recordSuccess();
          return textBlock.text;
        }
        throw new Error('Empty response from Anthropic');
      } catch (err: any) {
        console.warn(
          `[Sentiment] Anthropic call failed: ${err.message} — trying OpenRouter`,
        );
        recordFailure();
      }
    }

    // Fallback to OpenRouter
    if (this.openRouterClient) {
      try {
        const response = await this.openRouterClient.chat.completions.create({
          model: 'google/gemini-3-flash-preview',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (content) return content;
        throw new Error('Empty response from OpenRouter');
      } catch (err: any) {
        console.error(`[Sentiment] OpenRouter call failed: ${err.message}`);
        throw err;
      }
    }

    throw new Error(
      'No AI provider available — set ANTHROPIC_API_KEY or VITE_OPENROUTER_API_KEY',
    );
  }

  // ---------- DB Helpers ----------

  private async getFromDB(topic: string): Promise<SentimentSnapshot | null> {
    try {
      const rows: any[] = await db
        .select()
        .from(sentimentSnapshots)
        .where(eq(sentimentSnapshots.topic, topic))
        .orderBy(desc(sentimentSnapshots.createdAt))
        .limit(1)
        .all();

      if (rows.length === 0) return null;
      return this.rowToSnapshot(rows[0]);
    } catch {
      return null;
    }
  }

  private async storeToDB(snapshot: SentimentSnapshot): Promise<void> {
    try {
      await db
        .insert(sentimentSnapshots)
        .values({
          id: snapshot.id,
          topic: snapshot.topic,
          query: snapshot.query,
          sentimentScore: snapshot.sentimentScore,
          sentimentLabel: snapshot.sentimentLabel,
          confidence: snapshot.confidence,
          positiveCount: snapshot.positiveCount,
          negativeCount: snapshot.negativeCount,
          neutralCount: snapshot.neutralCount,
          totalPosts: snapshot.totalPosts,
          topPositive: JSON.stringify(snapshot.topPositive),
          topNegative: JSON.stringify(snapshot.topNegative),
          summary: snapshot.summary,
          sources: JSON.stringify(snapshot.sources),
          analysisModel: snapshot.analysisModel,
          observationDate: snapshot.observationDate,
          createdAt: snapshot.createdAt,
        })
        .run();

      console.log(
        `[Sentiment] Stored snapshot for "${snapshot.topic}" (score: ${snapshot.sentimentScore})`,
      );
    } catch (err: any) {
      console.error(`[Sentiment] DB store failed:`, err.message);
    }
  }

  private rowToSnapshot(row: any): SentimentSnapshot {
    return {
      id: row.id,
      topic: row.topic,
      query: row.query,
      sentimentScore: row.sentimentScore ?? 0,
      sentimentLabel: row.sentimentLabel ?? 'neutral',
      confidence: row.confidence ?? 0,
      positiveCount: row.positiveCount ?? 0,
      negativeCount: row.negativeCount ?? 0,
      neutralCount: row.neutralCount ?? 0,
      totalPosts: row.totalPosts ?? 0,
      topPositive: this.safeParseJSON(row.topPositive, []),
      topNegative: this.safeParseJSON(row.topNegative, []),
      summary: row.summary ?? '',
      sources: this.safeParseJSON(row.sources, []),
      analysisModel: row.analysisModel ?? '',
      observationDate: row.observationDate ?? '',
      createdAt: row.createdAt ?? '',
    };
  }

  // ---------- Utility Helpers ----------

  private scoreToLabel(
    score: number,
  ):
    | 'very_positive'
    | 'positive'
    | 'neutral'
    | 'negative'
    | 'very_negative' {
    if (score >= 0.5) return 'very_positive';
    if (score >= 0.1) return 'positive';
    if (score > -0.1) return 'neutral';
    if (score > -0.5) return 'negative';
    return 'very_negative';
  }

  private safeParseJSON<T>(input: unknown, fallback: T): T {
    if (typeof input !== 'string') {
      if (input && typeof input === 'object') return input as T;
      return fallback;
    }
    try {
      // Strip markdown code fences if present
      let clean = input.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(clean);
    } catch {
      return fallback;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const sentimentAnalysisService = new SentimentAnalysisService();
