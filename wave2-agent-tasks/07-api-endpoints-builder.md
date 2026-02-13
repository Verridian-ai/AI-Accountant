# Agent 7: API Endpoints Builder

## Role
Create the 6 new API endpoints for mutation confirmation, streaming chat, pending mutations, session history, and audit trail querying.

## Priority: SUB-WAVE 3 (After Agents 4, 5, 6)

## Files to MODIFY

### 1. `server/src/index.ts` — Add 6 new endpoints

**IMPORTANT**: These endpoints use the `/api/chat/*` namespace (for mutation flows) and `/api/agent-audit` (for audit). Both are safe namespaces per R03 compatibility analysis.

#### Endpoint 1: POST `/api/chat/stream`
**SSE streaming chat with intent routing**

```typescript
import { StreamingService } from './services/claude/streaming.js';
import { ConfirmationFlowService } from './services/claude/confirmation-flow.js';
import { AuditService } from './services/claude/audit.js';

// Initialize services (near top of file, after db initialization)
const streamingService = new StreamingService();
const confirmationFlow = new ConfirmationFlowService(db, eventEmitter);
const auditService = new AuditService(db);

// Start stale mutation expiration timer (every 5 minutes)
setInterval(() => confirmationFlow.expireStale(), 5 * 60 * 1000);

// ── POST /api/chat/stream — SSE streaming chat ──────────
app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json();
  const query = body.query ?? body.message;
  const sessionId = body.sessionId;

  if (!query || typeof query !== 'string') {
    return c.json({ error: 'Query is required' }, 400);
  }

  try {
    // Get or create session
    const session = await confirmationFlow.getOrCreateSession({
      userId: body.userId,
    });
    const activeSessionId = sessionId ?? session.id;

    // Create SSE stream
    const writer = streamingService.createStream(c);
    const stopHeartbeat = streamingService.startHeartbeat(writer);

    // Increment query count
    await confirmationFlow.incrementQueryCount(activeSessionId);

    // Step 1: Classify intent
    writer.sendProgress(1, 4, 'Classifying intent...');
    const classification = await orchestrator.intentRouter.classify(query, {});
    writer.sendAgentSelected(
      classification.primaryAgent,
      classification.confidence
    );

    // Record agent usage
    await confirmationFlow.recordAgentUsage(
      activeSessionId,
      classification.primaryAgent
    );

    // Step 2: Execute agent
    writer.sendProgress(2, 4, `Running ${classification.primaryAgent}...`);
    const result = await orchestrator.invoke(
      classification.primaryAgent,
      {
        query,
        ...classification.extractedParams,
      }
    );

    // Step 3: Format response
    writer.sendProgress(3, 4, 'Formatting response...');
    // Use ResponseFormatter from Wave 1
    const formatted = responseFormatter.formatSingle(
      result,
      classification.primaryAgent
    );

    // Step 4: Complete
    writer.sendProgress(4, 4, 'Done');

    // Log query execution
    await auditService.logQueryExecuted(
      activeSessionId,
      classification.primaryAgent,
      query
    );

    writer.sendComplete({
      ...formatted,
      sessionId: activeSessionId,
    });

    stopHeartbeat();

    // Return the SSE stream
    const stream = streamingService.getStream(c);
    if (stream) {
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    return c.json({ error: 'Failed to create stream' }, 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Chat Stream]', message);
    return c.json({ answer: `I encountered an error: ${message}` }, 500);
  }
});
```

#### Endpoint 2: POST `/api/chat/confirm/:actionId`
**Confirm a pending mutation**

```typescript
app.post('/api/chat/confirm/:actionId', async (c) => {
  const actionId = c.req.param('actionId');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason;

  if (!actionId) {
    return c.json({ success: false, error: 'Action ID is required' }, 400);
  }

  try {
    const mutation = await confirmationFlow.confirm(
      actionId,
      body.userId,
      reason
    );

    await auditService.logMutationConfirmed(
      actionId,
      mutation.sessionId,
      mutation.agentType as any,
      body.userId,
      c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
    );

    return c.json({ success: true, mutation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 400);
  }
});
```

#### Endpoint 3: POST `/api/chat/reject/:actionId`
**Reject a pending mutation**

```typescript
app.post('/api/chat/reject/:actionId', async (c) => {
  const actionId = c.req.param('actionId');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason;

  if (!actionId) {
    return c.json({ success: false, error: 'Action ID is required' }, 400);
  }

  try {
    const mutation = await confirmationFlow.reject(
      actionId,
      body.userId,
      reason
    );

    await auditService.logMutationRejected(
      actionId,
      mutation.sessionId,
      mutation.agentType as any,
      reason,
      body.userId,
      c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
    );

    return c.json({ success: true, mutation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 400);
  }
});
```

#### Endpoint 4: GET `/api/chat/pending`
**List pending mutations**

```typescript
app.get('/api/chat/pending', async (c) => {
  const sessionId = c.req.query('sessionId');

  if (!sessionId) {
    return c.json({ mutations: [] });
  }

  try {
    const mutations = await confirmationFlow.getPendingMutations(sessionId);
    return c.json({ mutations });
  } catch (error) {
    console.error('[Chat Pending]', error);
    return c.json({ mutations: [] });
  }
});
```

#### Endpoint 5: GET `/api/chat/history`
**Get session history**

```typescript
app.get('/api/chat/history', async (c) => {
  const sessionId = c.req.query('sessionId');
  const userId = c.req.query('userId');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  try {
    const result = await confirmationFlow.getSessionHistory({
      userId: userId ?? undefined,
      limit,
      offset,
    });
    return c.json(result);
  } catch (error) {
    console.error('[Chat History]', error);
    return c.json({ sessions: [], total: 0 });
  }
});
```

#### Endpoint 6: GET `/api/agent-audit`
**Query audit trail**

```typescript
app.get('/api/agent-audit', async (c) => {
  const agentType = c.req.query('agentType');
  const action = c.req.query('action');
  const sessionId = c.req.query('sessionId');
  const targetTable = c.req.query('targetTable');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  try {
    const result = await auditService.queryAudit({
      agentType: agentType as any,
      action: action as any,
      sessionId: sessionId ?? undefined,
      targetTable: targetTable ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      limit,
      offset,
    });
    return c.json(result);
  } catch (error) {
    console.error('[Agent Audit]', error);
    return c.json({ entries: [], total: 0 });
  }
});
```

#### Placement Requirements:
- [ ] All 6 endpoints must be placed AFTER the existing `/api/chat` POST handler
- [ ] Import statements for services go near the top of index.ts with other imports
- [ ] Service initialization (`new ConfirmationFlowService(db, eventEmitter)`, etc.) goes after db init
- [ ] The `setInterval` for expiration goes after service initialization
- [ ] **DO NOT** modify the existing `POST /api/chat` endpoint (Wave 1's rewrite)
- [ ] **DO NOT** conflict with Wave 1's `/api/agents/*` routes

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] POST `/api/chat/stream` returns SSE events
- [ ] POST `/api/chat/confirm/:id` confirms a pending mutation
- [ ] POST `/api/chat/reject/:id` rejects a pending mutation
- [ ] GET `/api/chat/pending?sessionId=...` returns pending mutations
- [ ] GET `/api/chat/history` returns session history
- [ ] GET `/api/agent-audit` returns filtered audit entries
- [ ] All endpoints handle errors gracefully (no 500 crashes)
- [ ] Existing `POST /api/chat` still works (backward compatible)
- [ ] Create marker file: `.agent-done-W2-07`

## Dependencies
- **Requires**: Agents 4 (ConfirmationFlowService), 5 (StreamingService), 6 (AuditService)
- **Blocks**: Agent 9 (UI components need API endpoints to be available)
