import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, userSettings } from '../../schema.js';
import { desc, eq } from 'drizzle-orm';
import { aiService } from '../../services/ai.js';
import { ragService } from '../../services/rag.js';
import { streamingRateLimiter } from '../../services/streaming-middleware.js';
import { streamingService, confirmationFlow, auditService } from './services.js';
import { chatLimiter, streamChatSchema } from './helpers.js';

export function registerStreamHandler(app: Hono): void {
  // POST /api/chat/stream — SSE streaming chat
  app.post(
    '/stream',
    chatLimiter,
    streamingRateLimiter(),
    zValidator('json', streamChatSchema),
    async (c) => {
      try {
        const { query, sessionId: bodySessionId } = c.req.valid('json');
        const userId = 'default';
        const sessionId = bodySessionId;
        const session = await confirmationFlow.getOrCreateSession({ userId });
        const activeSessionId = sessionId ?? session.id;

        const writer = streamingService.createStream(c);
        await confirmationFlow.incrementQueryCount(activeSessionId);
        writer.sendProgress(1, 3, 'Gathering context...');

        let settings = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .get();
        if (!settings) {
          settings = {
            userId,
            modelParsingText: 'google/gemini-3-flash-preview',
            modelParsingVision: 'google/gemini-3-flash-preview',
            modelCategorization: 'google/gemini-3-flash-preview',
            modelChat: 'google/gemini-3-flash-preview',
            modelEmbedding: 'openai/text-embedding-3-large',
          };
        }

        let ragContext = '';
        try {
          const multiResults = await ragService.searchMulti(query);
          const allResults = [...multiResults.chunks, ...multiResults.summary];
          if (allResults.length > 0) {
            ragContext = JSON.stringify({
              directMatches: multiResults.chunks,
              contextualAnalysis: multiResults.summary,
            });
          }
        } catch {
          // Cognee unavailable — continue without it
        }

        const recentTxns = await db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .orderBy(desc(transactions.date))
          .limit(50);

        const combinedContext = {
          recentTransactions: recentTxns,
          semanticSearchResults: ragContext,
        };
        writer.sendProgress(2, 3, 'Generating response...');

        const answer = await aiService.generateInsight(query, combinedContext, settings.modelChat);
        await confirmationFlow.recordAgentUsage(activeSessionId, 'budget_analyzer');
        auditService
          .logQueryExecuted(activeSessionId, 'budget_analyzer', query)
          .catch((err: unknown) => console.warn('[Audit] Log query failed:', err));

        writer.sendProgress(3, 3, 'Done');
        writer.sendComplete({ answer, agentType: 'chat', sessionId: activeSessionId });

        const stream = streamingService.getStream(c);
        if (stream) {
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'X-Accel-Buffering': 'no',
            },
          });
        }
        return c.json({ answer, sessionId: activeSessionId });
      } catch (err) {
        console.error('[Chat/Stream Error]', err);
        return c.json({ error: 'Streaming chat failed', code: 500 }, 500);
      }
    },
  );
}
