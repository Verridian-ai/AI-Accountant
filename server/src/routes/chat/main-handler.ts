import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { chatMessageSchema } from '../../validation/index.js';
import { getErrorMessage } from '../../utils/error.js';
import { db, transactions, userSettings, cogneeUserAccounts } from '../../schema.js';
import { desc, eq, sql as drizzleSql } from 'drizzle-orm';
import { aiService } from '../../services/ai.js';
import { ragService } from '../../services/rag.js';
import { orchestrator } from '../../services/claude/orchestrator.js';
import { cogneeSessionService } from '../../services/cognee-sessions.js';
import { getMaskedDb, getProductionDb, isMaskedBranchActive } from '../../db/neon-connection.js';
import { wrapWithUnredactor } from '../../services/pipeline/index.js';
import type { TokenMap } from '../../services/pipeline/index.js';
import { getExactTotalsTool } from '../../services/tools/index.js';
import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { USE_NEON_RUNTIME, amountTagger, tokenMapBuilder } from './services.js';
import { buildChatPrompt } from './helpers.js';

export function registerMainChatHandler(app: Hono): void {
  // POST /api/chat — main chat with Cognee context
  app.post(
    '/',
    zValidator('json', chatMessageSchema, (result, c) => {
      if (!result.success) {
        return c.json({ answer: result.error.issues.map((i) => i.message).join('; ') }, 400);
      }
      return;
    }),
    async (c) => {
      try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const { query, sessionId: requestSessionId } = c.req.valid('json');
        if (!query.trim()) {
          return c.json({ answer: 'Please enter a question about your finances.' }, 400);
        }

        let cogneeSessionId = requestSessionId;
        let datasetPrefix = '';
        let conversationContext = '';

        if (userId) {
          const account = await db
            .select()
            .from(cogneeUserAccounts)
            .where(eq(cogneeUserAccounts.userId, userId))
            .limit(1);
          datasetPrefix =
            account.length > 0 ? (account[0]?.datasetPrefix ?? `user_${userId}`) : `user_${userId}`;

          if (!cogneeSessionId) {
            const session = await cogneeSessionService.getOrCreateCogneeSession(userId, {
              sessionType: 'chat',
              ttlMinutes: 30,
              datasetPrefix,
            });
            if (session) {
              cogneeSessionId = session.sessionId;
            }
          }

          if (cogneeSessionId) {
            conversationContext = await orchestrator.getSessionContext(cogneeSessionId);
          }
        }

        let transactionContext: Record<string, unknown>[];
        let activeTokenMap: TokenMap | null = null;

        if (USE_NEON_RUNTIME && isMaskedBranchActive()) {
          const sessionKey = cogneeSessionId ?? userId;
          const [maskedResult, realResult] = await Promise.all([
            getMaskedDb().execute<Record<string, unknown>>(
              drizzleSql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY date DESC LIMIT 50`,
            ),
            getProductionDb().execute<Record<string, unknown>>(
              drizzleSql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY date DESC LIMIT 50`,
            ),
          ]);
          const maskedRows = maskedResult.rows;
          const realRows = realResult.rows;
          const { tagged, tokenMap: amountTokenMap } = await amountTagger.tagObjects(
            maskedRows,
            ['amount', 'gst_amount', 'balance'],
            sessionKey,
          );
          activeTokenMap = tokenMapBuilder.buildTokenMap({
            maskedData: maskedRows as Record<string, unknown>[],
            realData: realRows as Record<string, unknown>[],
            amountTokenMap,
          });
          transactionContext = tagged as Record<string, unknown>[];
        } else {
          transactionContext = await db
            .select()
            .from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date))
            .limit(50);
        }

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
          await db.insert(userSettings).values(settings);
        }

        let ragContext = '';
        try {
          const multiResults = await ragService.searchMulti(query, userId);
          const allResults = [...multiResults.chunks, ...multiResults.summary];
          if (allResults.length > 0) {
            ragContext = JSON.stringify({
              directMatches: multiResults.chunks,
              contextualAnalysis: multiResults.summary,
            });
          }
        } catch (ragErr) {
          console.error('[Chat Cognee Error]', ragErr);
        }

        const combinedContext = {
          recentTransactions: transactionContext,
          semanticSearchResults: ragContext,
          ...(conversationContext ? { conversationHistory: conversationContext } : {}),
        };

        let answer: string;
        if (USE_NEON_RUNTIME && isMaskedBranchActive() && activeTokenMap) {
          const openrouterKey =
            process.env.VITE_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '';
          const openrouter = createOpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: openrouterKey,
          });
          const { text } = await generateText({
            model: openrouter(settings.modelChat ?? 'google/gemini-3-flash-preview'),
            prompt: buildChatPrompt(query, combinedContext),
            tools: { get_exact_totals: getExactTotalsTool },
            stopWhen: stepCountIs(3),
          });
          const unredactedChunks: string[] = [];
          for await (const chunk of wrapWithUnredactor(
            (async function* () {
              yield text;
            })(),
            activeTokenMap,
          )) {
            unredactedChunks.push(chunk);
          }
          answer = unredactedChunks.join('');
        } else {
          answer = await aiService.generateInsight(query, combinedContext, settings.modelChat);
        }

        if (cogneeSessionId && userId) {
          try {
            await cogneeSessionService.addConversationTurn(cogneeSessionId, 'user', query);
            await cogneeSessionService.addConversationTurn(cogneeSessionId, 'assistant', answer);
          } catch (turnErr) {
            console.warn('[Chat] Failed to record conversation turn:', turnErr);
          }
        }

        return c.json({ answer, sessionId: cogneeSessionId });
      } catch (err) {
        console.error('[Chat Error]', getErrorMessage(err));
        return c.json(
          { answer: 'I encountered an error processing your request. Please try again.' },
          500,
        );
      }
    },
  );
}
