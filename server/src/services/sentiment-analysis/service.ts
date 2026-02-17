/**
 * Sentiment Analysis — Service Class
 * Thin orchestrator delegating to ai-provider for AI calls, DB, and utilities.
 */

import crypto from 'crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import { logger } from '../../lib/logger.js';
import { isCircuitOpen } from './circuit-breaker.js';
import type {
  SentimentConfig,
  ArticleInfo,
  ResearchResult,
  SentimentResult,
  SentimentSnapshot,
  ImpactAnalysis,
  TrendingTopic,
} from './types.js';
import { DEFAULT_CONFIG, DEFAULT_FINANCIAL_TOPICS } from './constants.js';
import {
  initAIClients,
  callAI,
  getSnapshotFromDB,
  storeSnapshotToDB,
  getSentimentHistoryFromDB,
  scoreToLabel,
  safeParseJSON,
  sleep,
} from './ai-provider.js';

// In-memory cache (supplements DB cache for speed)
const memoryCache = new Map<string, { data: SentimentSnapshot; expiresAt: number }>();

export class SentimentAnalysisService {
  private config: SentimentConfig;
  private anthropicClient: Anthropic | null = null;
  private openRouterClient: OpenAI | null = null;

  constructor(config?: Partial<SentimentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const clients = initAIClients();
    this.anthropicClient = clients.anthropicClient;
    this.openRouterClient = clients.openRouterClient;
  }

  private callAI(systemPrompt: string, userPrompt: string): Promise<string> {
    return callAI(systemPrompt, userPrompt, this.anthropicClient, this.openRouterClient);
  }

  async researchTopic(topic: string, context?: string): Promise<ResearchResult> {
    const query = `Australian ${topic} market outlook 2026${context ? ` ${context}` : ''}`;
    const now = new Date().toISOString();
    const systemPrompt = `You are an expert Australian financial analyst and market researcher.\nWhen given a financial topic, provide a comprehensive research briefing as if you had just reviewed\nthe latest news, reports, and market data. Focus on the Australian market context.\n\nReturn your response as valid JSON with this exact structure:\n{\n  "articles": [\n    {\n      "title": "article title",\n      "url": "https://example.com/article",\n      "source": "source name",\n      "snippet": "brief excerpt or summary",\n      "publishedDate": "2026-02-01"\n    }\n  ],\n  "summary": "2-3 paragraph summary of current market conditions and outlook",\n  "keyFindings": ["finding 1", "finding 2", "finding 3"],\n  "relatedTopics": ["related topic 1", "related topic 2"]\n}\n\nProvide 5-10 realistic article entries from well-known Australian financial sources\n(AFR, SMH, The Australian, RBA, ABS, CoreLogic, Domain, CommSec, etc.).\nMake the analysis thorough, balanced, and based on realistic current market conditions.`;
    const userPrompt = `Research the following topic: "${query}"\n\nProvide a comprehensive market research briefing covering:\n1. Current market conditions\n2. Recent trends and developments\n3. Key data points and statistics\n4. Expert opinions and forecasts\n5. Risks and opportunities\n\nFocus on Australian market context and provide actionable insights.`;

    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = safeParseJSON(response, {
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
      logger.error(`[Sentiment] Research failed for "${topic}":`, err.message);
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

  async analyzeSentiment(articles: ArticleInfo[], topic: string): Promise<SentimentResult> {
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
    const systemPrompt = `You are an expert financial sentiment analyst specializing in the Australian market.\nAnalyze the sentiment of financial articles and provide a structured assessment.\n\nReturn your response as valid JSON with this exact structure:\n{\n  "sentimentScore": 0.0,\n  "confidence": 0.0,\n  "positiveCount": 0,\n  "negativeCount": 0,\n  "neutralCount": 0,\n  "topPositive": [{"title": "...", "reason": "..."}],\n  "topNegative": [{"title": "...", "reason": "..."}],\n  "summary": "2-3 sentence summary of overall market sentiment"\n}\n\nRules:\n- sentimentScore: float from -1.0 (very negative) to 1.0 (very positive)\n- confidence: float from 0.0 to 1.0\n- topPositive/topNegative: up to 3 entries each\n- Be precise with the score — neutral should be close to 0.0`;
    const userPrompt = `Analyze the sentiment of the following articles about "${topic}" in the Australian financial context.\n\nArticles:\n${JSON.stringify(
      articles.map((a) => ({
        title: a.title,
        source: a.source,
        snippet: a.snippet,
        date: a.publishedDate,
      })),
      null,
      2,
    )}\n\nFor each article, classify sentiment as positive, negative, or neutral.\nProvide an overall sentiment score from -1.0 (very negative) to 1.0 (very positive).\nIdentify the top 3 positive and top 3 negative sentiments with brief reasons.\nProvide a 2-3 sentence summary of the overall market sentiment.`;
    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = safeParseJSON(response, {
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
        sentimentLabel: scoreToLabel(score),
        confidence,
        positiveCount: parsed.positiveCount ?? 0,
        negativeCount: parsed.negativeCount ?? 0,
        neutralCount: parsed.neutralCount ?? 0,
        topPositive: (parsed.topPositive || []).slice(0, 3),
        topNegative: (parsed.topNegative || []).slice(0, 3),
        summary: parsed.summary || '',
      };
    } catch (err: any) {
      logger.error(`[Sentiment] Analysis failed for "${topic}":`, err.message);
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

  async getSentimentSnapshot(topic: string): Promise<SentimentSnapshot> {
    const cacheKey = topic.toLowerCase().trim();
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.info(`[Sentiment] Cache HIT for "${topic}"`);
      return cached.data;
    }
    const dbCached = await getSnapshotFromDB(topic);
    if (dbCached) {
      const createdTime = new Date(dbCached.createdAt).getTime();
      if (Date.now() - createdTime < this.config.cacheTtlMs) {
        logger.info(`[Sentiment] DB cache HIT for "${topic}"`);
        memoryCache.set(cacheKey, {
          data: dbCached,
          expiresAt: createdTime + this.config.cacheTtlMs,
        });
        return dbCached;
      }
    }
    logger.info(`[Sentiment] Generating fresh snapshot for "${topic}"`);
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
    await storeSnapshotToDB(snapshot);
    memoryCache.set(cacheKey, { data: snapshot, expiresAt: Date.now() + this.config.cacheTtlMs });
    return snapshot;
  }

  async getMultiTopicSentiment(topics?: string[]): Promise<SentimentSnapshot[]> {
    const topicList = topics?.length ? topics : DEFAULT_FINANCIAL_TOPICS;
    const results: SentimentSnapshot[] = [];
    for (const topic of topicList.slice(0, this.config.maxTopicsPerDay)) {
      try {
        const snapshot = await this.getSentimentSnapshot(topic);
        results.push(snapshot);
      } catch (err: any) {
        logger.error(`[Sentiment] Batch: skipping "${topic}" — ${err.message}`);
      }
      await sleep(500);
    }
    return results;
  }

  async getSentimentHistory(topic: string, days = 30): Promise<SentimentSnapshot[]> {
    return getSentimentHistoryFromDB(topic, days);
  }

  async analyzeMarketImpact(event: string, context: string): Promise<ImpactAnalysis> {
    const systemPrompt = `You are an expert Australian economic analyst.\nAnalyze the market impact of economic events on various sectors of the Australian economy.\n\nReturn your response as valid JSON with this exact structure:\n{\n  "impactSummary": "Brief overall impact summary",\n  "affectedSectors": [\n    {"sector": "sector name", "impact": "positive|negative|neutral", "reason": "explanation"}\n  ],\n  "shortTermOutlook": "outlook for next 3-6 months",\n  "longTermOutlook": "outlook for next 1-3 years",\n  "confidence": 0.0,\n  "sources": ["source 1", "source 2"]\n}\n\nBe specific about Australian sectors: property, banking, mining, technology, healthcare,\nagriculture, energy, retail, financial services, construction, education, tourism.`;
    const userPrompt = `Analyze the market impact of the following event:\n\nEvent: "${event}"\nContext: "${context}"\n\nProvide:\n1. Which Australian sectors are most affected and how\n2. Short-term outlook (3-6 months)\n3. Long-term outlook (1-3 years)\n4. Confidence level in the analysis\n5. Key sources informing this analysis`;
    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = safeParseJSON(response, {
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
          impact: ['positive', 'negative', 'neutral'].includes(s.impact) ? s.impact : 'neutral',
          reason: s.reason || '',
        })),
        shortTermOutlook: parsed.shortTermOutlook || '',
        longTermOutlook: parsed.longTermOutlook || '',
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        sources: parsed.sources || [],
      };
    } catch (err: any) {
      logger.error(`[Sentiment] Impact analysis failed:`, err.message);
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

  async getTrendingFinancialTopics(): Promise<TrendingTopic[]> {
    const systemPrompt = `You are an expert Australian financial journalist tracking market trends.\nIdentify the most important and trending financial topics in Australia right now.\n\nReturn your response as valid JSON with this exact structure:\n{\n  "topics": [\n    {"topic": "topic name", "trendScore": 0.0, "recentArticles": 0}\n  ]\n}\n\nRules:\n- trendScore: float from 0.0 to 1.0 (1.0 = hottest topic)\n- recentArticles: estimated number of articles in the last 7 days\n- Return exactly 10 topics\n- Focus on Australian financial topics: RBA, ASX, property, banking, mining, etc.\n- Include a mix of macro-economic, sector-specific, and emerging topics`;
    const userPrompt = `What are the top 10 trending financial topics in Australia right now (February 2026)?\nConsider: RBA decisions, ASX performance, property market, banking, mining, technology,\ninflation, employment, government policy, international trade impacts on Australia.`;
    try {
      const response = await this.callAI(systemPrompt, userPrompt);
      const parsed = safeParseJSON(response, { topics: [] });
      return (parsed.topics || [])
        .slice(0, 10)
        .map((t: any) => ({
          topic: t.topic || 'Unknown',
          trendScore: Math.max(0, Math.min(1, t.trendScore ?? 0.5)),
          recentArticles: Math.max(0, Math.round(t.recentArticles ?? 0)),
        }));
    } catch (err: any) {
      logger.error(`[Sentiment] Trending topics failed:`, err.message);
      return DEFAULT_FINANCIAL_TOPICS.map((topic, i) => ({
        topic,
        trendScore: 1 - i * 0.1,
        recentArticles: 0,
      }));
    }
  }
}

// Singleton export
export const sentimentAnalysisService = new SentimentAnalysisService();
