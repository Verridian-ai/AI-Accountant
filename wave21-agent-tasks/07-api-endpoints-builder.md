# Agent 7: API Endpoints Builder

## Role
Wire 12 new API routes in `server/src/index.ts` for streaming sessions, structured output management, migration status tracking, and performance benchmarks.

## Priority: WAVE 21 (After Agents 1, 3, 6)

## Wait Condition
Check for `.agent-done-W21-01`, `.agent-done-W21-03`, `.agent-done-W21-06` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: ~4,707 lines
**Insert location**: After the last existing route block, before the server listen call

- [ ] Add imports for new services after existing imports (~line 30):
  ```typescript
  import { StreamingService } from './services/streaming.js';
  import { SchemaRegistry } from './services/claude/schemas/schema-registry.js';
  import { sseStreamMiddleware, streamingRateLimiter } from './services/streaming-middleware.js';
  import { StreamingRegistry } from './services/streaming-registry.js';
  ```

- [ ] Instantiate services:
  ```typescript
  const streamingService = new StreamingService();
  const schemaRegistry = new SchemaRegistry();
  const streamingRegistry = new StreamingRegistry();
  schemaRegistry.initializeDefaults();
  ```

### Streaming Routes (4 endpoints):

- [ ] `POST /api/stream/agent/:agentType` -- Start streaming agent execution
  ```typescript
  app.post('/api/stream/agent/:agentType', sseStreamMiddleware(), async (c) => {
    const agentType = c.req.param('agentType') as AgentType;
    const input = await c.req.json();
    const userId = c.req.query('userId') || 'default';
    const session = await streamingService.createStreamSession(agentType, userId);
    const agent = streamingRegistry.getAgent(agentType);
    if (!agent) return c.json({ error: `Agent ${agentType} not available for streaming` }, 404);
    return streamingService.streamAgentResponse(session.id, agent, input, c.res);
  });
  ```

- [ ] `GET /api/stream/session/:sessionId` -- Get session status
- [ ] `GET /api/stream/history` -- Get user's session history (paginated: ?limit=20&offset=0)
- [ ] `DELETE /api/stream/session/:sessionId` -- Cancel active stream

### Structured Output Routes (4 endpoints):

- [ ] `GET /api/schemas` -- List all registered schemas
- [ ] `GET /api/schemas/:agentType` -- Get schema for specific agent type (returns JSON Schema representation)
- [ ] `POST /api/schemas/:agentType/validate` -- Validate arbitrary output against schema (body: `{ output: any }`)
- [ ] `GET /api/schemas/:agentType/stats` -- Get validation statistics for an agent type

### Migration Status Routes (4 endpoints):

- [ ] `GET /api/migration/status` -- List all agent migration statuses
- [ ] `GET /api/migration/status/:agentType` -- Get specific agent migration details
- [ ] `GET /api/migration/benchmarks` -- Compare legacy vs Vercel performance metrics:
  ```json
  {
    "agents": [
      {
        "agentType": "budget_analyzer",
        "legacy": { "avgLatencyMs": 2340, "errorRate": 0.02, "invocations": 156 },
        "vercel": { "avgLatencyMs": 1890, "errorRate": 0.01, "invocations": 42 },
        "improvement": { "latencyPct": -19.2, "errorRatePct": -50.0 }
      }
    ]
  }
  ```
- [ ] `POST /api/migration/rollback/:agentType` -- Force rollback agent to legacy mode (sets migration_phase='legacy', increments rollback_count)

### Route Pattern (follow existing Hono pattern):
```typescript
app.get('/api/stream/session/:sessionId', async (c) => {
    try {
        const sessionId = c.req.param('sessionId');
        const session = await streamingService.getSessionStatus(sessionId);
        if (!session) return c.json({ error: 'Session not found' }, 404);
        return c.json(session);
    } catch (err) {
        console.error('Get session failed:', err);
        return c.json({ error: 'Failed to get session status' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 12 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes
- [ ] Streaming endpoint returns correct SSE headers
- [ ] Schema validation endpoint correctly rejects invalid output
- [ ] Migration benchmarks return data from `agent_migration_status` table
- [ ] Create marker file: `.agent-done-W21-07`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W21-01`), Agent 3 (`.agent-done-W21-03`), Agent 6 (`.agent-done-W21-06`)
- **IMPORTANT**: Only this agent modifies `server/src/index.ts` in Wave 21
