# Agent 7: API Endpoints Builder

## Role
Wire 24 new API routes in server/src/index.ts for fixed assets, multi-entity management, and consolidation.

## Priority: WAVE 3 (After Agents 2, 3 complete)

## Wait Condition
Check for `.agent-done-W12-02`, `.agent-done-W12-03` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: 4,707 lines, existing routes end at line 4692 (debt strategies), claude-agents mount at line 4695, pipeline routes at line 4698
**Insert location**: After line 4692 (after debt-strategies route), before line 4694 (comment for claude-agents mount)

- [ ] Add imports for 3 new services after existing imports (~line 2070):
```typescript
import { FixedAssetService } from './services/fixed-assets.js';
import { MultiEntityService } from './services/multi-entity.js';
import { ConsolidationService } from './services/consolidation.js';
```

- [ ] Instantiate 3 services after existing service instantiation:
```typescript
const fixedAssetService = new FixedAssetService();
const multiEntityService = new MultiEntityService();
const consolidationService = new ConsolidationService();
```

### Fixed Asset Routes (8 routes)

- [ ] `POST /api/assets` — Register a new asset
```typescript
app.post('/api/assets', async (c) => {
    try {
        const body = await c.req.json();
        const result = await fixedAssetService.registerAsset(body);
        return c.json(result, 201);
    } catch (err) {
        console.error('Asset registration failed:', err);
        return c.json({ error: 'Failed to register asset' }, 500);
    }
});
```

- [ ] `GET /api/assets` — Get asset register with optional filters
```typescript
app.get('/api/assets', async (c) => {
    try {
        const userId = c.req.query('userId') || 'default';
        const entityId = c.req.query('entityId');
        const category = c.req.query('category');
        const status = c.req.query('status');
        const result = await fixedAssetService.getAssetRegister(userId, { entityId, category, status });
        return c.json(result);
    } catch (err) {
        console.error('Asset register fetch failed:', err);
        return c.json({ error: 'Failed to fetch asset register' }, 500);
    }
});
```

- [ ] `GET /api/assets/:id` — Get single asset detail
- [ ] `PATCH /api/assets/:id` — Update asset mutable fields
- [ ] `POST /api/assets/:id/depreciation/:year` — Calculate depreciation for single asset
- [ ] `POST /api/assets/depreciation/batch/:year` — Run batch depreciation for all assets
```typescript
app.post('/api/assets/depreciation/batch/:year', async (c) => {
    try {
        const year = c.req.param('year');
        const userId = c.req.query('userId') || 'default';
        const entityId = c.req.query('entityId');
        const result = await fixedAssetService.runBatchDepreciation(userId, year, entityId);
        return c.json(result);
    } catch (err) {
        console.error('Batch depreciation failed:', err);
        return c.json({ error: 'Failed to run batch depreciation' }, 500);
    }
});
```

- [ ] `POST /api/assets/:id/dispose` — Record asset disposal
- [ ] `GET /api/assets/schedule/:year` — Get depreciation schedule for financial year
```typescript
app.get('/api/assets/schedule/:year', async (c) => {
    try {
        const year = c.req.param('year');
        const userId = c.req.query('userId') || 'default';
        const entityId = c.req.query('entityId');
        const result = await fixedAssetService.getDepreciationSchedule(userId, year, entityId);
        return c.json(result);
    } catch (err) {
        console.error('Depreciation schedule fetch failed:', err);
        return c.json({ error: 'Failed to fetch depreciation schedule' }, 500);
    }
});
```

### Entity Management Routes (8 routes)

- [ ] `POST /api/entities` — Create a new entity
- [ ] `GET /api/entities` — Get entity hierarchy for user
```typescript
app.get('/api/entities', async (c) => {
    try {
        const userId = c.req.query('userId') || 'default';
        const result = await multiEntityService.getEntityHierarchy(userId);
        return c.json(result);
    } catch (err) {
        console.error('Entity hierarchy fetch failed:', err);
        return c.json({ error: 'Failed to fetch entities' }, 500);
    }
});
```

- [ ] `GET /api/entities/:id` — Get entity with accounts and settings
- [ ] `PATCH /api/entities/:id` — Update entity fields
- [ ] `PATCH /api/entities/:id/settings` — Update entity settings
- [ ] `POST /api/entities/:id/accounts` — Link an account to entity
```typescript
app.post('/api/entities/:id/accounts', async (c) => {
    try {
        const entityId = c.req.param('id');
        const body = await c.req.json();
        const result = await multiEntityService.linkAccount({ entityId, ...body });
        return c.json(result, 201);
    } catch (err) {
        console.error('Account link failed:', err);
        return c.json({ error: 'Failed to link account' }, 500);
    }
});
```

- [ ] `DELETE /api/entities/:id/accounts/:accountId` — Unlink an account from entity
- [ ] `POST /api/entities/inter-entity-transactions` — Record inter-entity transaction
```typescript
app.post('/api/entities/inter-entity-transactions', async (c) => {
    try {
        const body = await c.req.json();
        const result = await multiEntityService.recordInterEntityTransaction(body);
        return c.json(result, 201);
    } catch (err) {
        console.error('Inter-entity transaction recording failed:', err);
        return c.json({ error: 'Failed to record inter-entity transaction' }, 500);
    }
});
```

### Inter-Entity Transaction Routes (2 routes)

- [ ] `GET /api/entities/inter-entity-transactions` — List inter-entity transactions with filters
```typescript
app.get('/api/entities/inter-entity-transactions', async (c) => {
    try {
        const userId = c.req.query('userId') || 'default';
        const entityId = c.req.query('entityId');
        const status = c.req.query('status');
        const financialYear = c.req.query('financialYear');
        const result = await multiEntityService.getInterEntityTransactions(userId, { entityId, status, financialYear });
        return c.json(result);
    } catch (err) {
        console.error('Inter-entity transactions fetch failed:', err);
        return c.json({ error: 'Failed to fetch inter-entity transactions' }, 500);
    }
});
```

- [ ] `PATCH /api/entities/inter-entity-transactions/:id/confirm` — Confirm or dispute inter-entity transaction
```typescript
app.patch('/api/entities/inter-entity-transactions/:id/confirm', async (c) => {
    try {
        const transactionId = c.req.param('id');
        const { entityId, confirmed } = await c.req.json();
        const result = await multiEntityService.confirmInterEntityTransaction(transactionId, entityId, confirmed);
        return c.json(result);
    } catch (err) {
        console.error('Inter-entity confirmation failed:', err);
        return c.json({ error: 'Failed to confirm transaction' }, 500);
    }
});
```

### Consolidation Routes (6 routes)

- [ ] `POST /api/consolidation/generate` — Generate consolidation for parent entity
```typescript
app.post('/api/consolidation/generate', async (c) => {
    try {
        const body = await c.req.json();
        const result = await consolidationService.generateConsolidation(body);
        return c.json(result, 201);
    } catch (err) {
        console.error('Consolidation generation failed:', err);
        return c.json({ error: 'Failed to generate consolidation' }, 500);
    }
});
```

- [ ] `GET /api/consolidation/snapshots` — List consolidation snapshots
- [ ] `GET /api/consolidation/snapshots/:id` — Get snapshot detail with lines
- [ ] `POST /api/consolidation/snapshots/:id/finalize` — Finalize a consolidation snapshot
- [ ] `POST /api/consolidation/rules` — Create a consolidation rule
- [ ] `GET /api/consolidation/rules` — List consolidation rules for entity

### Route Pattern (follow existing pattern from line 4600+):
```typescript
app.get('/api/[path]', async (c) => {
    try {
        // parse params and query
        const result = await service.method(params);
        return c.json(result);
    } catch (err) {
        console.error('[Operation] failed:', err);
        return c.json({ error: 'Failed to [operation]' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 24 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes (check against /api/tax/*, /api/loans/*, /api/analytics/*)
- [ ] POST routes return 201 for creation, GET routes return 200
- [ ] Error responses use `{ error: string }` format consistently
- [ ] Create marker file: `.agent-done-W12-07`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W12-02`), Agent 3 (`.agent-done-W12-03`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts in Wave 12
