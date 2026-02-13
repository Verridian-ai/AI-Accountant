# Agent 9: Chat Session Integration

## Role
Integrate Cognee sessions into the chat endpoint and agent orchestrator so that follow-up questions retain context and all agent operations are user-scoped.

## Priority: SUB-WAVE 3 (After Agents 3 and 5 complete)

## Files to MODIFY

### 1. `server/src/services/claude/orchestrator.ts`
**Purpose**: Pass userId and sessionId through the orchestrator to all agent tool calls
**CRITICAL**: Read the entire file first. The orchestrator dispatches to Claude agents based on intent.

#### Step 1: Understand the current orchestrator pattern
The orchestrator likely:
1. Receives a chat message + userId
2. Routes to an agent (categorizer, gst-calc, tax-strategy, etc.)
3. Passes tools to the agent
4. Returns the agent's response

#### Step 2: Add userId and sessionId to orchestrator context
Find the main dispatch/orchestrate method and add these parameters:

```typescript
// Add to the orchestrator's main method signature:
async orchestrate(params: {
  message: string;
  userId: string;
  // ... existing params
  sessionId?: string;     // Wave 3: Cognee session for conversation memory
  datasetPrefix?: string; // Wave 3: User's dataset prefix
}): Promise<OrchestratorResult> {
  // ...
}
```

#### Step 3: Create user-scoped CogneeTools for each orchestration
When the orchestrator creates tools for an agent, use the user-scoped factory:

```typescript
// BEFORE (somewhere in orchestrator):
const cogneeTools = new CogneeTools({ /* existing config */ });

// AFTER:
const cogneeTools = params.userId
  ? CogneeTools.forUser(params.userId)
  : new CogneeTools({ /* existing config */ });
```

#### Step 4: Pass session context to agent tools
If the orchestrator passes context/memory to agents, include the session:

```typescript
// When building the agent's system prompt or context:
if (params.sessionId) {
  // Retrieve session context
  const sessionContext = await cogneeSessionService.getCogneeSession(params.sessionId);
  if (sessionContext) {
    // Include conversation history in agent context
    const recentHistory = sessionContext.conversationHistory
      .slice(-5) // last 5 turns
      .map(t => `${t.role}: ${t.content}`)
      .join('\n');
    // Add to system prompt or context
  }
}
```

### 2. `server/src/index.ts` — Chat endpoint
**Purpose**: Modify the `/api/chat` endpoint to use Cognee sessions
**Location**: Find `POST /api/chat` (around line 950)

#### Step 1: Extract or determine userId from request
```typescript
app.post('/api/chat', async (c) => {
  const body = await c.req.json();
  const { message, userId, sessionId } = body;

  // ... existing code ...
```

#### Step 2: Get or create Cognee session
```typescript
  // Wave 3: Session management
  let cogneeSessionId = sessionId;
  let datasetPrefix = '';

  if (userId) {
    // Get user's dataset prefix
    const account = await db.select().from(cogneeUserAccounts)
      .where(eq(cogneeUserAccounts.userId, userId))
      .limit(1);

    datasetPrefix = account.length > 0 ? account[0].datasetPrefix : `user_${userId}`;

    // Get or create session
    if (!cogneeSessionId) {
      const session = await cogneeSessionService.getOrCreateCogneeSession(userId, {
        sessionType: 'chat',
        ttlMinutes: 30,
        datasetPrefix,
      });
      cogneeSessionId = session.sessionId;
    }
  }
```

#### Step 3: Pass userId and sessionId to orchestrator
```typescript
  // BEFORE:
  const result = await orchestrator.orchestrate({
    message,
    userId,
    // ... existing params
  });

  // AFTER:
  const result = await orchestrator.orchestrate({
    message,
    userId,
    sessionId: cogneeSessionId,
    datasetPrefix,
    // ... existing params
  });
```

#### Step 4: Record conversation turn in session
```typescript
  // After getting the response:
  if (cogneeSessionId && userId) {
    // Record user message
    await cogneeSessionService.addConversationTurn(cogneeSessionId, 'user', message);
    // Record assistant response
    await cogneeSessionService.addConversationTurn(
      cogneeSessionId, 'assistant', result.answer ?? result.response ?? ''
    );
  }
```

#### Step 5: Include sessionId in response
```typescript
  // Add sessionId to response for client-side tracking
  return c.json({
    answer: result.answer ?? result.response,
    sessionId: cogneeSessionId,
    // ... existing response fields
  });
```

### 3. Verify existing Cognee search calls in chat
The chat endpoint fetches 50 recent transactions + does Cognee multi-search (CHUNKS + GRAPH_SUMMARY_COMPLETION). Ensure these searches pass userId:

```typescript
// BEFORE (in chat endpoint, around where Cognee is called):
const cogneeResults = await cogneeClient.search(query, dataset, topK, searchType);

// AFTER:
const cogneeResults = await cogneeClient.search(query, dataset, topK, searchType, userId);
```

## Backward Compatibility Contract
- Chat endpoint MUST still work without userId (admin fallback)
- Chat endpoint MUST still work without sessionId (creates new session or uses stateless)
- Response format MUST include `{ answer: string }` (existing contract)
- Adding `sessionId` to response is additive (doesn't break existing clients)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Chat endpoint works without userId (backward compat)
- [ ] Chat endpoint creates session when userId provided but no sessionId
- [ ] Chat endpoint reuses session when sessionId provided
- [ ] Conversation history is stored in Redis session
- [ ] Orchestrator passes userId and sessionId to agents
- [ ] Response includes sessionId for client tracking
- [ ] Create marker file: `.agent-done-W03-09`

## Dependencies
- **Agent 3** must complete session extension (getOrCreateCogneeSession, addConversationTurn)
- **Agent 5** must complete prefix wiring (CogneeTools.forUser)
