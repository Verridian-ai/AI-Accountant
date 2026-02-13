# Agent 6: Agent HTTP Routes Builder

## Role
Create extended HTTP routes for 7 high-priority agents that currently lack direct endpoints, plus a health/status endpoint for all agents.

## Priority: SUB-WAVE 2 (After Agent 3)

## Files to CREATE

### 1. `server/src/routes/agent-routes-extended.ts`
**Purpose**: Hono route file providing direct HTTP access to 7 agents + status endpoint
**Pattern**: Follow `server/src/routes/agents.ts` pattern

#### Route Definitions (8 endpoints):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const agentRoutes = new Hono();

// 1. POST /api/agents/parse — Statement parser
agentRoutes.post('/agents/parse',
  zValidator('json', z.object({
    statementId: z.string().optional(),
    fileUrl: z.string().optional(),
    bankName: z.string().optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('statement_parser', input)
    // Return formatted result
  }
);

// 2. POST /api/agents/categorize — Transaction categorizer
agentRoutes.post('/agents/categorize',
  zValidator('json', z.object({
    transactionIds: z.array(z.string()).optional(),
    userId: z.string().optional(),
    limit: z.number().optional().default(50),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('transaction_categorizer', input)
  }
);

// 3. POST /api/agents/merchant-intel — Merchant intelligence
agentRoutes.post('/agents/merchant-intel',
  zValidator('json', z.object({
    merchantName: z.string(),
    transactionId: z.string().optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('merchant_intelligence', input)
  }
);

// 4. POST /api/agents/payroll/calculate — Payroll agent
agentRoutes.post('/agents/payroll/calculate',
  zValidator('json', z.object({
    action: z.enum(['detect_wages', 'calculate_payg', 'analyze_payroll']),
    transactionIds: z.array(z.string()).optional(),
    period: z.string().optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('payroll_agent', input)
  }
);

// 5. POST /api/agents/tax/strategy — Tax strategy
agentRoutes.post('/agents/tax/strategy',
  zValidator('json', z.object({
    userId: z.string().optional(),
    taxYear: z.string().optional(),
    entityType: z.string().optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('tax_strategy', input)
  }
);

// 6. POST /api/agents/tax/claims — Personal tax claims
agentRoutes.post('/agents/tax/claims',
  zValidator('json', z.object({
    userId: z.string().optional(),
    taxYear: z.string().optional(),
    claimTypes: z.array(z.string()).optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('personal_tax_claims', input)
  }
);

// 7. POST /api/agents/financial-plan — Financial planner
agentRoutes.post('/agents/financial-plan',
  zValidator('json', z.object({
    userId: z.string().optional(),
    goal: z.string().optional(),
    timeframeMonths: z.number().optional(),
  })),
  async (c) => {
    // Invoke orchestrator.invoke('financial_planner', input)
  }
);

// 8. GET /api/agents/status — Health/status for all agents
agentRoutes.get('/agents/status', async (c) => {
  // Return list of all registered agents with:
  // - agentType: string
  // - model: string (from config)
  // - isEnabled: boolean (feature flag check)
  // - circuitBreakerState: 'closed' | 'open' | 'half-open'
  // - lastInvocation: timestamp | null
  // - totalInvocations: number
});

export default agentRoutes;
```

#### Implementation Details:
- [ ] Each route handler must:
  1. Extract input from request body
  2. Call `orchestrator.invoke(agentType, input)`
  3. Wrap result in `{ success: true, agentType, result, usage }`
  4. On error: `{ success: false, error: message }`
- [ ] Use Zod validation for all POST request bodies
- [ ] Each handler should log: `console.log('[Agent Route]', agentType, 'invoked')`
- [ ] Each handler should measure and return timing: `durationMs`
- [ ] The `/agents/status` endpoint must work even if agents are disabled (show flag state)

## Files to MODIFY

### 2. `server/src/index.ts` — Mount extended routes BEFORE wildcard

**CRITICAL**: The existing `POST /api/agents/:type/run` at line ~1913 is a wildcard route. Extended routes like `POST /api/agents/parse` must be mounted BEFORE it, or Hono's router will match `:type=parse` instead of the specific route.

**Add near the top of route mounting (after existing imports, around line 20-30)**:
```typescript
import agentRoutesExtended from './routes/agent-routes-extended.js';

// Mount BEFORE any wildcard agent routes
app.route('/api', agentRoutesExtended);
```

- [ ] Import the new route file
- [ ] Mount via `app.route('/api', agentRoutesExtended)` BEFORE the generic `/api/agents/:type/run` registration
- [ ] Verify that `/api/agents/parse` is NOT caught by the wildcard `:type` parameter

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] POST `/api/agents/parse` reaches the statement_parser handler (not the `:type/run` wildcard)
- [ ] POST `/api/agents/categorize` invokes `transaction_categorizer`
- [ ] GET `/api/agents/status` returns a list of all 21+ registered agents
- [ ] Each route validates request body with Zod (invalid body → 400 error)
- [ ] Routes are mounted BEFORE the wildcard in index.ts
- [ ] Create marker file: `.agent-done-W01-06` (REVISION: zero-padded per D04/D05)

## Dependencies
- **Requires**: Agent 3 (AgentDispatcher references orchestrator pattern)
- **Coordination**: This agent modifies `index.ts` for route mounting. Agent 5 also modifies `index.ts` for chat rewrite. This agent should go first (route mounting), then Agent 5 (chat handler rewrite).
