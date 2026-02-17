import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, userSettings, cogneeUserAccounts } from '../schema.js';
import { eq, desc } from 'drizzle-orm';
import { chatMessageSchema } from '../validation/index.js';

const streamQuerySchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().optional(),
});
import { aiService } from '../services/ai.js';
import { ragService } from '../services/rag.js';
import { orchestrator } from '../services/claude/orchestrator.js';
import { cogneeSessionService } from '../services/cognee-sessions.js';
import { ConfirmationFlowService } from '../services/claude/confirmation-flow.js';
import { StreamingService } from '../services/claude/streaming.js';
import { streamingRateLimiter } from '../services/streaming-middleware.js';
import { logger } from '../lib/logger.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const chatRoutes = new Hono();
const streamingService = new StreamingService();
const confirmationFlow = new ConfirmationFlowService(db);

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
chatRoutes.use('/*', tenantAuthMiddleware());

chatRoutes.post('/', zValidator('json', chatMessageSchema), async (c) => {
  const userId = c.get('jwtPayload').userId;
  const { query, sessionId: requestSessionId } = c.req.valid('json');
  if (!query.trim()) return c.json({ answer: 'Please enter a question.' }, 400);

  let cogneeSessionId = requestSessionId;
  let datasetPrefix = '';
  let conversationContext = '';

  if (userId) {
    const account = await db.select().from(cogneeUserAccounts).where(eq(cogneeUserAccounts.userId, userId)).limit(1);
    datasetPrefix = account.length > 0 ? (account[0]?.datasetPrefix || `user_${userId}`) : `user_${userId}`;
    if (!cogneeSessionId) {
      const session = await cogneeSessionService.getOrCreateCogneeSession(userId, { sessionType: 'chat', ttlMinutes: 30, datasetPrefix });
      if (session) cogneeSessionId = session.sessionId;
    }
    if (cogneeSessionId) conversationContext = await orchestrator.getSessionContext(cogneeSessionId);
  }

  const context = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date)).limit(50);
  let settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (!settings) {
    settings = { userId, modelParsingText: 'google/gemini-3-flash-preview', modelParsingVision: 'google/gemini-3-flash-preview', modelCategorization: 'google/gemini-3-flash-preview', modelChat: 'google/gemini-3-flash-preview', modelEmbedding: 'openai/text-embedding-3-large' };
    await db.insert(userSettings).values(settings);
  }

  // F7: Pass cogneeSessionId to ragService for conversational memory
  let ragContext = '';
  try {
    const multiResults = await ragService.searchMulti(query, userId, cogneeSessionId);
    if (multiResults.chunks.length > 0 || multiResults.summary.length > 0) {
      ragContext = JSON.stringify({ directMatches: multiResults.chunks, contextualAnalysis: multiResults.summary });
    }
  } catch (ragErr) { logger.error({ err: ragErr }, '[Chat Cognee Error]'); }

  const combinedContext = { recentTransactions: context, semanticSearchResults: ragContext, ...(conversationContext ? { conversationHistory: conversationContext } : {}) };
  const answer = await aiService.generateInsight(query, combinedContext, settings.modelChat);

  if (cogneeSessionId && userId) {
    await cogneeSessionService.addConversationTurn(cogneeSessionId, 'user', query);
    await cogneeSessionService.addConversationTurn(cogneeSessionId, 'assistant', answer);
  }

  return c.json({ answer, sessionId: cogneeSessionId });
});

chatRoutes.post('/stream', streamingRateLimiter(), zValidator('json', streamQuerySchema), async (c) => {
  const { query, sessionId } = c.req.valid('json');
  const userId = 'default';
  const activeSessionId = sessionId || (await confirmationFlow.getOrCreateSession({ userId })).id;
  const writer = streamingService.createStream(c);
  await confirmationFlow.incrementQueryCount(activeSessionId);

  // F7: Create/get Cognee session for conversational memory
  let cogneeSessionId: string | undefined;
  if (userId) {
    const account = await db.select().from(cogneeUserAccounts).where(eq(cogneeUserAccounts.userId, userId)).limit(1);
    const datasetPrefix = account.length > 0 ? (account[0]?.datasetPrefix || `user_${userId}`) : `user_${userId}`;
    const cogneeSession = await cogneeSessionService.getOrCreateCogneeSession(userId, { sessionType: 'chat', ttlMinutes: 30, datasetPrefix });
    if (cogneeSession) cogneeSessionId = cogneeSession.sessionId;
  }

  let ragContext = '';
  try {
    // F7: Pass cogneeSessionId to ragService.searchMulti
    const multiResults = await ragService.searchMulti(query, userId, cogneeSessionId);
    if (multiResults.chunks.length > 0 || multiResults.summary.length > 0) {
      ragContext = JSON.stringify({ directMatches: multiResults.chunks, contextualAnalysis: multiResults.summary });
    }
  } catch { /* intentionally empty */ }
  const recentTxns = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date)).limit(50);
  const answer = await aiService.generateInsight(query, { recentTransactions: recentTxns, semanticSearchResults: ragContext }, 'google/gemini-3-flash-preview');
  await confirmationFlow.recordAgentUsage(activeSessionId, 'budget_analyzer');

  // F7: Record conversation turn in Cognee session
  if (cogneeSessionId && userId) {
    await cogneeSessionService.addConversationTurn(cogneeSessionId, 'user', query);
    await cogneeSessionService.addConversationTurn(cogneeSessionId, 'assistant', answer);
  }

  writer.sendComplete({ answer, agentType: 'chat', sessionId: activeSessionId });
  const stream = streamingService.getStream(c);
  if (stream) return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
  return c.json({ answer, sessionId: activeSessionId });
});

export default chatRoutes;
