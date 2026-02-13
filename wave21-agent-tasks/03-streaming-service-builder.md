# Agent 3: Streaming Service Builder

## Role
Build the SSE streaming infrastructure for agent responses. Integrates with the Vercel AI SDK's `streamText()` to deliver token-by-token responses to the client.

## Priority: WAVE 21 (After Agent 2)

## Wait Condition
Check for `.agent-done-W21-02` marker file before starting.

## Files to CREATE

### 1. `server/src/services/streaming.ts`
**Purpose**: Core streaming service for agent responses
**Reference**: Existing SSE pattern in `client/src/contexts/SSEContext.tsx` and server SSE endpoints in `server/src/index.ts`

- [ ] Create `StreamingService` class with methods:
  - `createStreamSession(agentType: AgentType, userId: string): Promise<StreamSession>` -- inserts pending session into `agent_stream_sessions` table, returns session ID
  - `streamAgentResponse(sessionId: string, agent: VercelAgent, input: any, res: Response): Promise<void>` -- calls `agent.stream(input)`, pipes each token chunk as SSE `data:` event, sends `[DONE]` event on completion, updates session status
  - `getSessionStatus(sessionId: string): Promise<StreamSession>` -- reads session from DB
  - `cancelSession(sessionId: string): Promise<void>` -- sets abort signal, updates status to 'cancelled'
  - `getSessionHistory(userId: string, limit?: number): Promise<StreamSession[]>` -- paginated session history
  - `cleanupStaleSessions(): Promise<number>` -- marks sessions stuck in 'streaming' for >5min as 'errored'

- [ ] SSE format per event:
  ```
  event: token
  data: {"sessionId":"...","content":"...","done":false}

  event: done
  data: {"sessionId":"...","totalTokens":123,"latencyMs":456}

  event: error
  data: {"sessionId":"...","error":"..."}
  ```

- [ ] Use `AbortController` for cancellation support
- [ ] Track token count incrementally during stream

### 2. `server/src/services/streaming-middleware.ts`
**Purpose**: Hono middleware for SSE streaming endpoints

- [ ] Export `sseStreamMiddleware()` -- sets headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` for nginx)
- [ ] Export `streamingRateLimiter()` -- max 5 concurrent streams per user
- [ ] Export `streamingAuth()` -- validates session token from query param or header (streaming endpoints cannot use body auth)

### 3. `server/src/services/streaming-registry.ts`
**Purpose**: Registry mapping agent types to their streaming capabilities

- [ ] Export `StreamingRegistry` class:
  - `register(agentType: AgentType, agent: VercelAgent): void`
  - `getAgent(agentType: AgentType): VercelAgent | null`
  - `isStreamingEnabled(agentType: AgentType): boolean`
  - `listStreamableAgents(): AgentType[]`
- [ ] Initialize with migrated agents only (start with budget_analyzer and transaction_categorizer from Agents 4-5)

## Files to MODIFY

### 4. `server/src/index.ts`
**Insert after existing SSE endpoint** (~line 4500):

- [ ] Add `GET /api/stream/session/:sessionId` -- returns session status
- [ ] Add `GET /api/stream/history` -- returns user's session history
- [ ] Add `DELETE /api/stream/session/:sessionId` -- cancels active stream
- [ ] Wire `sseStreamMiddleware()` on all `/api/stream/*` routes

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `createStreamSession()` inserts record into database
- [ ] SSE stream delivers tokens with correct event format
- [ ] Cancellation via AbortController stops stream within 1 second
- [ ] Create marker file: `.agent-done-W21-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W21-01`) for schema tables, Agent 2 (`.agent-done-W21-02`) for VercelAgent base class
- **Reuses**: Existing SSE patterns from `server/src/index.ts`
