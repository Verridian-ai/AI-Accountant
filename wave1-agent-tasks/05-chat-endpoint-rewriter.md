# Agent 5: Chat Endpoint Rewriter

## Role
Rewrite the existing `POST /api/chat` endpoint to use the IntentRouter → AgentDispatcher → ResponseFormatter pipeline, replacing the current hardcoded logic.

## Priority: SUB-WAVE 2 (After Agents 2, 3, 4)

## Files to CREATE

### 0. `server/src/middleware/auth.ts` — JWT Authentication Middleware
**REVISION NOTE (D02-CRIT-01 — Authentication): Agent 5 MUST create basic auth middleware.**

```typescript
import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Auth middleware for /api/* routes.
 * - If JWT_SECRET is set: validates Bearer token, extracts userId
 * - If JWT_SECRET is NOT set: development mode — allows all requests with a console warning
 */
export function authMiddleware() {
  // Log once at startup
  if (!JWT_SECRET) {
    console.warn('[Auth] WARNING: JWT_SECRET not set — running in development mode (no auth)');
  }

  return async (c: Context, next: Next) => {
    // Skip auth for health/status endpoints
    const path = c.req.path;
    if (path === '/api/health' || path === '/api/agents/status') {
      return next();
    }

    // Development mode — no auth required
    if (!JWT_SECRET) {
      c.set('userId', 'dev-user');
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required', code: 401 }, 401);
    }

    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      c.set('userId', payload.userId);
      return next();
    } catch {
      return c.json({ error: 'Invalid or expired token', code: 401 }, 401);
    }
  };
}
```

- [ ] Create `server/src/middleware/auth.ts`
- [ ] Wire auth middleware in index.ts: `app.use('/api/*', authMiddleware())`
- [ ] Place middleware registration BEFORE all route registrations

### 1. `server/src/errors.ts` — Error Classes (REVISION NOTE: D01-DC-05)

```typescript
export class AppError extends Error {
  constructor(public message: string, public code: number = 500) { super(message); }
}
export class NotFoundError extends AppError { constructor(msg = 'Not found') { super(msg, 404); } }
export class ValidationError extends AppError { constructor(msg = 'Validation error') { super(msg, 400); } }
export class AuthorizationError extends AppError { constructor(msg = 'Unauthorized') { super(msg, 401); } }
```

Wire `app.onError()` in index.ts to return `{ error: string, code: number }` for all unhandled errors.

## Files to MODIFY

### 2. `server/src/index.ts` — Chat endpoint rewrite (around line 950)

**BEFORE** (current implementation — approximately lines 950-1015):
The current `/api/chat` handler:
1. Fetches 50 recent transactions from DB
2. Optionally searches Cognee with CHUNKS + GRAPH_SUMMARY_COMPLETION
3. Builds a prompt with transaction context
4. Calls OpenRouter/Claude for a response
5. Returns `{ answer: string }`

**AFTER** (new implementation):
```typescript
import { IntentRouter } from './services/claude/intent-router.js';
import { AgentDispatcher } from './services/claude/agent-dispatcher.js';
import { ResponseFormatter } from './services/claude/response-formatter.js';

// Initialize services (near top of file, after orchestrator init)
const intentRouter = new IntentRouter();
const agentDispatcher = new AgentDispatcher(orchestrator);
const responseFormatter = new ResponseFormatter();

// POST /api/chat — Intent-routed agent dispatch
app.post('/api/chat', async (c) => {
  try {
    const { message, context } = await c.req.json();
    const query = message || '';

    if (!query.trim()) {
      return c.json({ answer: 'Please enter a question or command.' });
    }

    // Step 1: Classify intent
    const classification = await intentRouter.classify(query, {
      recentTransactions: context?.recentTransactionCount,
      accountIds: context?.accountIds,
      hasUnprocessedStatements: context?.hasUnprocessedStatements,
    });

    // Step 2: Dispatch to agent(s)
    const pipelineResult = await agentDispatcher.dispatchIntent(
      classification,
      query,
      context
    );

    // Step 3: Format response
    const response = responseFormatter.formatPipeline(pipelineResult, {
      intent: classification.intent,
      confidence: classification.confidence,
    });

    // Ensure backward compatibility: always return { answer: string }
    return c.json(response);

  } catch (error: unknown) {
    console.error('[Chat] Error:', error);

    // FALLBACK: If intent routing fails, fall back to legacy behavior
    try {
      const { message } = await c.req.json();
      // ... existing legacy chat logic as fallback ...
      // This ensures backward compatibility during rollout
    } catch {
      // Ultimate fallback
    }

    return c.json(responseFormatter.formatError(
      error instanceof Error ? error : new Error('Unknown chat error')
    ));
  }
});
```

#### Key Requirements:
- [ ] Import IntentRouter, AgentDispatcher, ResponseFormatter at top of file
- [ ] Initialize all three services after orchestrator initialization
- [ ] Replace the existing `/api/chat` handler body (do NOT create a second route)
- [ ] Keep the existing Cognee search as a fallback for direct_question intents
- [ ] **ALWAYS return `{ answer: string }`** — never return `{ error: string }`
- [ ] Add rate limiter check (existing rate limiter should still apply)
- [ ] Log intent classification for debugging: `console.log('[Chat] Intent:', classification.intent, classification.primaryAgent, classification.confidence)`
- [ ] If IntentRouter throws, fall back to legacy chat behavior (graceful degradation)
- [ ] Preserve existing `getAuthHeaders` / JWT validation

#### Backward Compatibility Checklist:
- [ ] The response always includes an `answer` string field
- [ ] The response may optionally include `agentType`, `intentClassification`, `actions`, `suggestedFollowups`
- [ ] Existing client code that reads `response.answer` continues to work
- [ ] The `message` field name in request body is preserved (not renamed to `query`)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] POST `/api/chat` with `{"message": "How much did I spend on fuel?"}` returns `{ answer: "..." }`
- [ ] POST `/api/chat` with `{"message": "Calculate BAS for Q2"}` returns `{ answer: "...", agentType: "gst_calculator" }`
- [ ] POST `/api/chat` with empty message returns helpful error in `{ answer }` format
- [ ] If IntentRouter errors, falls back to legacy behavior (no 500 error)
- [ ] REVISION: Auth middleware created at `server/src/middleware/auth.ts` and wired in index.ts
- [ ] REVISION: Error classes created at `server/src/errors.ts` with `app.onError()` wired
- [ ] Create marker file: `.agent-done-W01-05` (REVISION: zero-padded per D04/D05)

## Dependencies
- **Requires**: Agent 2 (IntentRouter), Agent 3 (AgentDispatcher), Agent 4 (ResponseFormatter)
- **Coordination**: Agent 6 modifies `index.ts` first (route mounting), then this agent rewrites the chat handler
