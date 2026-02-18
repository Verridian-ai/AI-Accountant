import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import { validateBody, chatMessageSchema, ValidationError } from '../validation/index.js';
import { getErrorMessage } from '../utils/error.js';
import type { AgentType } from '../services/claude/types.js';
import { db, transactions, userSettings, cogneeUserAccounts } from '../schema.js';
import { desc, eq, sql as drizzleSql } from 'drizzle-orm';
import { aiService } from '../services/ai.js';
import { ragService } from '../services/rag.js';
import { orchestrator } from '../services/claude/orchestrator.js';
import { cogneeSessionService } from '../services/cognee-sessions.js';
import { StreamingService } from '../services/claude/streaming.js';
import { ConfirmationFlowService } from '../services/claude/confirmation-flow.js';
import { AuditService } from '../services/claude/audit.js';
import { streamingRateLimiter } from '../services/streaming-middleware.js';
// Neon dual-pool
import { getMaskedDb, getProductionDb, isMaskedBranchActive } from '../db/neon-connection.js';
// v4 streaming masking pipeline
import { AmountTagger, TokenMapBuilder, wrapWithUnredactor } from '../services/pipeline/index.js';
import type { TokenMap } from '../services/pipeline/index.js';
// Aggregate tool (Vercel AI SDK compatible)
import { getExactTotalsTool } from '../services/tools/index.js';
// Vercel AI SDK for tool-aware generation in Neon path
import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const chatRoutes = new Hono();
const streamingService = new StreamingService();
const confirmationFlow = new ConfirmationFlowService(db);
const auditService = new AuditService(db);

const USE_NEON_RUNTIME = process.env.USE_NEON === 'true';
// Singletons — AmountTagger uses lazy Redis connect (safe even when USE_NEON=false)
const amountTagger = new AmountTagger(process.env.REDIS_URL);
const tokenMapBuilder = new TokenMapBuilder();

const getRateLimitKey = (
  c: Parameters<typeof rateLimiter>[0]['keyGenerator'] extends (c: infer C) => unknown ? C : never,
) => {
  const realIp = c.req.header('x-real-ip');
  const env = c.env as Record<string, unknown> | undefined;
  const incoming = env?.incoming as Record<string, unknown> | undefined;
  const socket = incoming?.socket as Record<string, unknown> | undefined;
  const remoteAddr = (socket?.remoteAddress as string | undefined) || 'unknown';
  return realIp || (typeof remoteAddr === 'string' ? remoteAddr : 'unknown');
};

const chatLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  keyGenerator: getRateLimitKey,
  message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
});

const streamChatSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sessionId: z.string().optional(),
});

const actionReasonSchema = z.object({
  reason: z.string().max(500).optional(),
});

// POST /api/chat — main chat with Cognee context
chatRoutes.post('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    let chatBody;
    try {
      chatBody = validateBody(chatMessageSchema, await c.req.json());
    } catch (e) {
      if (e instanceof ValidationError)
        return c.json({ answer: e.errors.map((err) => getErrorMessage(err)).join('; ') }, 400);
      return c.json({ answer: 'Invalid request body' }, 400);
    }
    const { query, sessionId: requestSessionId } = chatBody;
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

    // ─── Neon dual-pool path (masking + unredaction) ─────────────────────
    let transactionContext: Record<string, unknown>[];
    let activeTokenMap: TokenMap | null = null;

    if (USE_NEON_RUNTIME && isMaskedBranchActive()) {
      const sessionKey = cogneeSessionId ?? userId;
      // Use raw SQL to avoid SQLiteTable vs PgTable type mismatch (the schema uses
      // SQLite table definitions but Neon pools are PG — execute() accepts SQL templates
      // on both, while .select().from() requires PgTable at the type level).
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
      // ─── Legacy path — unchanged behaviour ───────────────────────────
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

    // ─── AI generation — Neon path uses Vercel AI SDK with tools ──────────
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
      // Unredact: replace masked tokens (pseudonyms + [[amt:ID]]) with real values
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
      // Legacy path — unchanged
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
    console.error('[Chat Error]', err);
    return c.json(
      { answer: 'I encountered an error processing your request. Please try again.' },
      500,
    );
  }
});

// POST /api/chat/stream — SSE streaming chat
chatRoutes.post(
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

      const combinedContext = { recentTransactions: recentTxns, semanticSearchResults: ragContext };
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

// POST /api/chat/confirm/:actionId
chatRoutes.post('/confirm/:actionId', zValidator('json', actionReasonSchema), async (c) => {
  try {
    const actionId = c.req.param('actionId');
    const { reason } = c.req.valid('json');
    const userId = 'default';
    const mutation = await confirmationFlow.confirm(actionId, userId, reason);
    await auditService
      .logMutationConfirmed(actionId, mutation.sessionId, mutation.agentType as AgentType, userId)
      .catch((err: unknown) => console.warn('[Audit] Log confirm failed:', err));
    return c.json({ success: true, mutation });
  } catch (err) {
    const message = err instanceof Error ? getErrorMessage(err) : 'Confirmation failed';
    return c.json({ error: message, code: 400 }, 400);
  }
});

// POST /api/chat/reject/:actionId
chatRoutes.post('/reject/:actionId', zValidator('json', actionReasonSchema), async (c) => {
  try {
    const actionId = c.req.param('actionId');
    const { reason } = c.req.valid('json');
    const userId = 'default';
    const mutation = await confirmationFlow.reject(actionId, userId, reason);
    await auditService
      .logMutationRejected(
        actionId,
        mutation.sessionId,
        mutation.agentType as AgentType,
        reason,
        userId,
      )
      .catch((err: unknown) => console.warn('[Audit] Log reject failed:', err));
    return c.json({ success: true, mutation });
  } catch (err) {
    const message = err instanceof Error ? getErrorMessage(err) : 'Rejection failed';
    return c.json({ error: message, code: 400 }, 400);
  }
});

// GET /api/chat/pending
chatRoutes.get('/pending', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');
    if (!sessionId) return c.json({ error: 'sessionId query param required', code: 400 }, 400);
    const mutations = await confirmationFlow.getPendingMutations(sessionId);
    return c.json({ mutations });
  } catch (err) {
    console.error('[Chat/Pending Error]', err);
    return c.json({ error: 'Failed to fetch pending mutations', code: 500 }, 500);
  }
});

// GET /api/chat/history
chatRoutes.get('/history', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const userId = 'default';
    if (sessionId) {
      const session = await confirmationFlow.getSession(sessionId);
      return c.json({ sessions: session ? [session] : [], total: session ? 1 : 0 });
    }
    const result = await confirmationFlow.getSessionHistory({ userId, limit });
    return c.json(result);
  } catch (err) {
    console.error('[Chat/History Error]', err);
    return c.json({ error: 'Failed to fetch session history', code: 500 }, 500);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a structured prompt for the Neon-enabled chat path.
 * Instructs Claude to use get_exact_totals instead of summing [[amt:ID]] tokens.
 */
function buildChatPrompt(query: string, context: Record<string, unknown>): string {
  return `You are a helpful financial assistant. Transaction amounts appear as [[amt:ID]] tokens — use the get_exact_totals tool for any dollar calculations instead of attempting to sum these tokens yourself.

Context:
${JSON.stringify(context, null, 2)}

User question: ${query}`;
}

export default chatRoutes;
