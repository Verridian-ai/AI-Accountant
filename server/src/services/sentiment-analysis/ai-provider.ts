/**
 * Sentiment Analysis -- AI Provider Integration & Utility Helpers
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { db, sentimentSnapshots } from '../../schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { config as appConfig } from '../../lib/config.js';
import { recordSuccess, recordFailure, isCircuitOpen } from './circuit-breaker.js';
import type { SentimentSnapshot } from './types.js';

// ---------- AI Client Initialization ----------

export function initAIClients(): {
  anthropicClient: Anthropic | null;
  openRouterClient: OpenAI | null;
} {
  let anthropicClient: Anthropic | null = null;
  let openRouterClient: OpenAI | null = null;

  const anthropicKey = appConfig.anthropicApiKey;
  if (anthropicKey) {
    anthropicClient = new Anthropic({ apiKey: anthropicKey });
  }

  const openRouterKey = appConfig.viteOpenrouterApiKey;
  if (openRouterKey) {
    openRouterClient = new OpenAI({
      apiKey: openRouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  if (!anthropicClient && !openRouterClient) {
    logger.warn('[Sentiment] No AI API keys found -- sentiment analysis will not work');
  }

  return { anthropicClient, openRouterClient };
}

// ---------- AI Call ----------

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  anthropicClient: Anthropic | null,
  openRouterClient: OpenAI | null,
): Promise<string> {
  // Try Anthropic Claude first (unless circuit breaker is open)
  if (anthropicClient && !isCircuitOpen()) {
    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      if (textBlock?.text) {
        recordSuccess();
        return textBlock.text;
      }
      throw new Error('Empty response from Anthropic');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[Sentiment] Anthropic call failed: ${message} -- trying OpenRouter`);
      recordFailure();
    }
  }

  // Fallback to OpenRouter
  if (openRouterClient) {
    try {
      const response = await openRouterClient.chat.completions.create({
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[Sentiment] OpenRouter call failed: ${message}`);
      throw new Error(message);
    }
  }

  throw new Error('No AI provider available -- set ANTHROPIC_API_KEY or VITE_OPENROUTER_API_KEY');
}

// ---------- DB Helpers ----------

export async function getSnapshotFromDB(topic: string): Promise<SentimentSnapshot | null> {
  try {
    const rows = await db
      .select()
      .from(sentimentSnapshots)
      .where(eq(sentimentSnapshots.topic, topic))
      .orderBy(desc(sentimentSnapshots.createdAt))
      .limit(1)
      .all();

    if (rows.length === 0) return null;
    return rowToSnapshot(rows[0] as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function storeSnapshotToDB(snapshot: SentimentSnapshot): Promise<void> {
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

    logger.info(
      `[Sentiment] Stored snapshot for "${snapshot.topic}" (score: ${snapshot.sentimentScore})`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[Sentiment] DB store failed:`, message);
  }
}

export async function getSentimentHistoryFromDB(
  topic: string,
  days: number,
): Promise<SentimentSnapshot[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  try {
    const rows = await db
      .select()
      .from(sentimentSnapshots)
      .where(and(eq(sentimentSnapshots.topic, topic), gte(sentimentSnapshots.createdAt, cutoffStr)))
      .orderBy(desc(sentimentSnapshots.createdAt))
      .all();

    return (rows as Record<string, unknown>[]).map((r) => rowToSnapshot(r));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[Sentiment] History query failed for "${topic}":`, message);
    return [];
  }
}

// ---------- Utility Helpers ----------

export function scoreToLabel(
  score: number,
): 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' {
  if (score >= 0.5) return 'very_positive';
  if (score >= 0.1) return 'positive';
  if (score > -0.1) return 'neutral';
  if (score > -0.5) return 'negative';
  return 'very_negative';
}

export function safeParseJSON<T>(input: unknown, fallback: T): T {
  if (typeof input !== 'string') {
    if (input && typeof input === 'object') return input as T;
    return fallback;
  }
  try {
    let clean = input.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(clean);
  } catch {
    return fallback;
  }
}

export function rowToSnapshot(row: Record<string, unknown>): SentimentSnapshot {
  return {
    id: row.id as string,
    topic: row.topic as string,
    query: row.query as string,
    sentimentScore: (row.sentimentScore as number) ?? 0,
    sentimentLabel: (row.sentimentLabel as string) ?? 'neutral',
    confidence: (row.confidence as number) ?? 0,
    positiveCount: (row.positiveCount as number) ?? 0,
    negativeCount: (row.negativeCount as number) ?? 0,
    neutralCount: (row.neutralCount as number) ?? 0,
    totalPosts: (row.totalPosts as number) ?? 0,
    topPositive: safeParseJSON(row.topPositive, []),
    topNegative: safeParseJSON(row.topNegative, []),
    summary: (row.summary as string) ?? '',
    sources: safeParseJSON(row.sources, []),
    analysisModel: (row.analysisModel as string) ?? '',
    observationDate: (row.observationDate as string) ?? '',
    createdAt: (row.createdAt as string) ?? '',
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
