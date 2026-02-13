# Agent 7: API Endpoints Builder

## Role
Add 22 new API routes to the Hono server for inventory management (12 endpoints) and bank reconciliation (10 endpoints), wiring them to the respective services and Claude agents.

## Priority: WAVE 11 (After Agents 2, 3, 4, 5)

## Files to MODIFY

### 1. `server/src/index.ts`

**Purpose**: Add 22 new authenticated API endpoints following existing patterns

#### Import Additions (at top of file, after existing service imports ~line 21)
**BEFORE** (around line 20-24):
```typescript
import { aiService } from './services/ai.js';
import { ragService } from './services/rag.js';
import { accountService } from './services/accounts.js';
import { agentService, type PythonAgentType } from './services/agents.js';
import type { AgentType } from './services/claude/types.js';
```
**AFTER**:
```typescript
import { aiService } from './services/ai.js';
import { ragService } from './services/rag.js';
import { accountService } from './services/accounts.js';
import { agentService, type PythonAgentType } from './services/agents.js';
import type { AgentType } from './services/claude/types.js';
import { inventoryService } from './services/inventory.js';
import { bankReconciliationService } from './services/bank-reconciliation.js';
```

#### Inventory Endpoints (12 routes)
Add these routes after the existing API routes (find last `app.get`/`app.post`/`app.put`/`app.delete` block). All routes must be inside the JWT-protected section.

- [ ] **`GET /api/inventory/items`** — List inventory items
  ```typescript
  app.get('/api/inventory/items', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const category = c.req.query('category');
    const isActive = c.req.query('isActive');
    const search = c.req.query('search');
    const items = await inventoryService.listItems(userId, {
      category: category || undefined,
      isActive: isActive === 'false' ? false : true,
      search: search || undefined,
    });
    return c.json(items);
  });
  ```

- [ ] **`POST /api/inventory/items`** — Create inventory item
  ```typescript
  app.post('/api/inventory/items', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const item = await inventoryService.createItem(userId, body);
    return c.json(item, 201);
  });
  ```

- [ ] **`GET /api/inventory/items/:id`** — Get single item
  ```typescript
  app.get('/api/inventory/items/:id', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const item = await inventoryService.getItem(c.req.param('id'), userId);
    if (!item) return c.json({ error: 'Item not found' }, 404);
    return c.json(item);
  });
  ```

- [ ] **`PUT /api/inventory/items/:id`** — Update inventory item
  ```typescript
  app.put('/api/inventory/items/:id', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const item = await inventoryService.updateItem(c.req.param('id'), userId, body);
    return c.json(item);
  });
  ```

- [ ] **`DELETE /api/inventory/items/:id`** — Deactivate inventory item (soft delete)
  ```typescript
  app.delete('/api/inventory/items/:id', authMiddleware, async (c) => {
    const userId = c.get('userId');
    await inventoryService.deactivateItem(c.req.param('id'), userId);
    return c.json({ success: true });
  });
  ```

- [ ] **`POST /api/inventory/items/:id/adjust`** — Adjust stock (purchase, sale, adjustment, write-off)
  ```typescript
  app.post('/api/inventory/items/:id/adjust', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const movement = await inventoryService.adjustStock(
      userId, c.req.param('id'), body.warehouseId, body.quantity,
      body.unitCostCents, body.movementType, body.notes, body.referenceId
    );
    return c.json(movement, 201);
  });
  ```

- [ ] **`POST /api/inventory/items/:id/transfer`** — Transfer stock between warehouses
  ```typescript
  app.post('/api/inventory/items/:id/transfer', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const result = await inventoryService.transferStock(
      userId, c.req.param('id'), body.fromWarehouseId, body.toWarehouseId,
      body.quantity, body.notes
    );
    return c.json(result, 201);
  });
  ```

- [ ] **`GET /api/inventory/stock`** — Get stock levels across warehouses
  ```typescript
  app.get('/api/inventory/stock', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const warehouseId = c.req.query('warehouseId');
    const itemId = c.req.query('itemId');
    const belowReorder = c.req.query('belowReorder') === 'true';
    const levels = await inventoryService.getStockLevels(userId, {
      warehouseId: warehouseId || undefined,
      itemId: itemId || undefined,
      belowReorderPoint: belowReorder || undefined,
    });
    return c.json(levels);
  });
  ```

- [ ] **`GET /api/inventory/movements`** — Get movement history
  ```typescript
  app.get('/api/inventory/movements', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const result = await inventoryService.getMovementHistory(userId, {
      itemId: c.req.query('itemId') || undefined,
      warehouseId: c.req.query('warehouseId') || undefined,
      movementType: c.req.query('movementType') || undefined,
      startDate: c.req.query('startDate') || undefined,
      endDate: c.req.query('endDate') || undefined,
      limit: parseInt(c.req.query('limit') || '50'),
      offset: parseInt(c.req.query('offset') || '0'),
    });
    return c.json(result);
  });
  ```

- [ ] **`GET /api/inventory/warehouses`** — List warehouses
  ```typescript
  app.get('/api/inventory/warehouses', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const warehouses = await inventoryService.listWarehouses(userId);
    return c.json(warehouses);
  });
  ```

- [ ] **`POST /api/inventory/warehouses`** — Create warehouse
  ```typescript
  app.post('/api/inventory/warehouses', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const warehouse = await inventoryService.createWarehouse(userId, body);
    return c.json(warehouse, 201);
  });
  ```

- [ ] **`GET /api/inventory/valuation`** — Get inventory valuation report
  ```typescript
  app.get('/api/inventory/valuation', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const asOfDate = c.req.query('asOfDate');
    const report = await inventoryService.getValuationReport(userId, asOfDate || undefined);
    return c.json(report);
  });
  ```

#### Bank Reconciliation Endpoints (10 routes)

- [ ] **`GET /api/recon/sessions`** — List reconciliation sessions
  ```typescript
  app.get('/api/recon/sessions', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const accountId = c.req.query('accountId');
    const status = c.req.query('status');
    const sessions = await bankReconciliationService.listSessions(userId, {
      accountId: accountId || undefined,
      status: status || undefined,
    });
    return c.json(sessions);
  });
  ```

- [ ] **`POST /api/recon/sessions`** — Start new reconciliation session
  ```typescript
  app.post('/api/recon/sessions', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const session = await bankReconciliationService.startSession(
      userId, body.accountId, body.periodStart, body.periodEnd, body.statementBalanceCents
    );
    return c.json(session, 201);
  });
  ```

- [ ] **`GET /api/recon/sessions/:id`** — Get session with matches
  ```typescript
  app.get('/api/recon/sessions/:id', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const session = await bankReconciliationService.getSession(c.req.param('id'), userId);
    if (!session) return c.json({ error: 'Session not found' }, 404);
    return c.json(session);
  });
  ```

- [ ] **`POST /api/recon/sessions/:id/auto-match`** — Run auto-matching on session
  ```typescript
  app.post('/api/recon/sessions/:id/auto-match', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const results = await bankReconciliationService.autoMatch(c.req.param('id'), userId);
    return c.json(results);
  });
  ```

- [ ] **`POST /api/recon/sessions/:id/complete`** — Complete/finalize session
  ```typescript
  app.post('/api/recon/sessions/:id/complete', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const session = await bankReconciliationService.completeSession(c.req.param('id'), userId);
    return c.json(session);
  });
  ```

- [ ] **`POST /api/recon/matches/:id/confirm`** — Confirm a suggested match
  ```typescript
  app.post('/api/recon/matches/:id/confirm', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const match = await bankReconciliationService.confirmMatch(c.req.param('id'), userId);
    return c.json(match);
  });
  ```

- [ ] **`POST /api/recon/matches/:id/undo`** — Undo a confirmed match
  ```typescript
  app.post('/api/recon/matches/:id/undo', authMiddleware, async (c) => {
    const userId = c.get('userId');
    await bankReconciliationService.undoMatch(c.req.param('id'), userId);
    return c.json({ success: true });
  });
  ```

- [ ] **`POST /api/recon/matches/manual`** — Create manual match
  ```typescript
  app.post('/api/recon/matches/manual', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const match = await bankReconciliationService.createManualMatch(
      body.sessionId, body.bankTransactionId, body.ledgerEntryId, userId
    );
    return c.json(match, 201);
  });
  ```

- [ ] **`GET /api/recon/rules`** — List matching rules
  ```typescript
  app.get('/api/recon/rules', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const rules = await bankReconciliationService.getMatchRules(userId);
    return c.json(rules);
  });
  ```

- [ ] **`POST /api/recon/rules`** — Create matching rule
  ```typescript
  app.post('/api/recon/rules', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const rule = await bankReconciliationService.createMatchRule(userId, body);
    return c.json(rule, 201);
  });
  ```

#### Error Handling Pattern
All endpoints should follow the existing pattern with try/catch:
```typescript
try {
  // ... service call
} catch (error: any) {
  console.error(`[API] Error: ${error.message}`);
  return c.json({ error: error.message || 'Internal server error' }, 500);
}
```

#### Auth Middleware Reference
The existing auth middleware is applied as `authMiddleware` — find how it's defined in the file (typically a JWT verification middleware) and use the same pattern. The user ID is extracted via `c.get('userId')` or `c.get('jwtPayload')`.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 12 inventory endpoints are registered on the Hono app
- [ ] All 10 reconciliation endpoints are registered on the Hono app
- [ ] Each endpoint uses authMiddleware for JWT protection
- [ ] Each endpoint has proper error handling with try/catch
- [ ] POST endpoints return 201 for creation operations
- [ ] GET endpoints return 404 when resource not found
- [ ] Create marker file: `.agent-done-W11-07`

## Dependencies
- **Agent 2** (inventory.ts must exist for `inventoryService` import)
- **Agent 3** (bank-reconciliation.ts must exist for `bankReconciliationService` import)
- **Agent 4** (inventory-agent.ts — optional for AI-powered endpoints)
- **Agent 5** (bank-reconciler-agent.ts — optional for AI-powered endpoints)
- **Reuses**: server/src/index.ts, Hono patterns, JWT auth middleware
