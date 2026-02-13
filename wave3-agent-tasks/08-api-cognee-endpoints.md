# Agent 8: Cognee API Endpoints Builder

## Role
Wire 4 new API routes for Cognee multi-user management in server/src/index.ts.

## Priority: SUB-WAVE 3 (After Agents 1, 2, 3 complete)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 4 new API endpoints under `/api/cognee/`
**CRITICAL**: This file is large (~3400+ lines). Find the appropriate section for Cognee routes. Do NOT modify any existing routes.

#### Step 1: Add imports
At the top of the file, ensure these are imported:
```typescript
import { cogneeUserAccounts, cogneeSessions } from './schema.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
```

If `CogneeClient` is already imported, use the existing import. Otherwise:
```typescript
import { cogneeClient } from './services/cognee_client.js';
```

Also import the session service:
```typescript
import { cogneeSessionService } from './services/cognee-sessions.js';
```

And the DataPoint models:
```typescript
import { registerAllDataPoints, ALL_DATAPOINT_MODELS } from './services/cognee/datapoint-models.js';
```

#### Step 2: Add Zod validation schemas
```typescript
// Wave 3: Cognee endpoint schemas
const initCogneeUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().optional(), // auto-generate if not provided
});

const reindexSchema = z.object({
  userId: z.string().min(1),
  datasets: z.array(z.string()).optional(), // reindex specific datasets, or all if empty
});
```

#### Step 3: Add 4 API routes

```typescript
// ============================================================================
// COGNEE MULTI-USER (Wave 3)
// ============================================================================

/**
 * POST /api/cognee/init-user
 * Initialize a Cognee account for a GoldLedger user
 * Creates cognee_user_accounts record + Cognee-side user + registers DataPoints
 */
app.post('/api/cognee/init-user', zValidator('json', initCogneeUserSchema), async (c) => {
  try {
    const { userId, email } = c.req.valid('json');

    // Check if user already has a Cognee account
    const existing = await db.select().from(cogneeUserAccounts)
      .where(eq(cogneeUserAccounts.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ message: 'User already initialized', account: existing[0] });
    }

    // Generate Cognee credentials
    const cogneeEmail = email ?? `user_${userId}@goldledger.app`;
    const cogneePassword = crypto.randomUUID(); // secure random password
    const datasetPrefix = `user_${userId}`;

    // Create Cognee-side user account
    let cogneeUserId: string | null = null;
    try {
      const result = await cogneeClient.createCogneeUser(cogneeEmail, cogneePassword);
      cogneeUserId = result.userId;
    } catch (err) {
      console.warn('Cognee user creation failed (may already exist):', err);
      // Continue — we can still use admin token with prefix isolation
    }

    // Store in our DB (encrypt password for later auth)
    const accountId = crypto.randomUUID();
    await db.insert(cogneeUserAccounts).values({
      id: accountId,
      userId,
      cogneeEmail,
      cogneePasswordHash: cogneePassword, // TODO: encrypt with AES-256-GCM
      cogneeUserId,
      datasetPrefix,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Set up user auth token if Cognee user was created
    if (cogneeUserId) {
      await cogneeClient.setupUserAuth(userId, cogneeEmail, cogneePassword);
    }

    // Register all 8 DataPoint models for this user
    try {
      const { CogneeDataPointService } = await import('./services/cognee-datapoints.js');
      const dpService = new CogneeDataPointService();
      await dpService.registerWave3DataPoints(userId, datasetPrefix);
    } catch (err) {
      console.warn('DataPoint registration failed:', err);
    }

    return c.json({
      message: 'Cognee user initialized',
      accountId,
      datasetPrefix,
      cogneeUserId,
      dataPointsRegistered: ALL_DATAPOINT_MODELS.length,
    }, 201);
  } catch (error: any) {
    console.error('Init Cognee user error:', error);
    return c.json({ error: error.message ?? 'Failed to initialize Cognee user' }, 500);
  }
});

/**
 * POST /api/cognee/reindex
 * Re-index all (or specified) datasets for a user
 */
app.post('/api/cognee/reindex', zValidator('json', reindexSchema), async (c) => {
  try {
    const { userId, datasets } = c.req.valid('json');

    // Get user's Cognee account
    const account = await db.select().from(cogneeUserAccounts)
      .where(eq(cogneeUserAccounts.userId, userId))
      .limit(1);

    if (account.length === 0) {
      return c.json({ error: 'User not initialized. Call POST /api/cognee/init-user first.' }, 404);
    }

    const prefix = account[0].datasetPrefix;
    const targetDatasets = datasets?.map(d => `${prefix}_${d}`) ?? [];

    // Trigger cognify on the datasets
    if (targetDatasets.length > 0) {
      await cogneeClient.cognify(targetDatasets, true, undefined, userId);
    } else {
      // Reindex all user datasets — list and filter by prefix
      const allDatasets = await cogneeClient.listDatasets(userId);
      const userDatasets = Array.isArray(allDatasets)
        ? allDatasets.filter((d: any) => (d.name ?? d).toString().startsWith(prefix))
        : [];
      for (const ds of userDatasets) {
        await cogneeClient.cognify([ds.name ?? ds], true, undefined, userId);
      }
    }

    // Update last sync timestamp
    await db.update(cogneeUserAccounts)
      .set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(cogneeUserAccounts.userId, userId));

    return c.json({ message: 'Reindex triggered', userId, prefix });
  } catch (error: any) {
    console.error('Cognee reindex error:', error);
    return c.json({ error: error.message ?? 'Reindex failed' }, 500);
  }
});

/**
 * GET /api/cognee/session
 * Get or create an active Cognee session for the current user
 */
app.get('/api/cognee/session', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) {
      return c.json({ error: 'userId query parameter required' }, 400);
    }

    // Get user's dataset prefix
    const account = await db.select().from(cogneeUserAccounts)
      .where(eq(cogneeUserAccounts.userId, userId))
      .limit(1);

    const datasetPrefix = account.length > 0 ? account[0].datasetPrefix : `user_${userId}`;

    // Get or create session via CogneeSessionService
    const session = await cogneeSessionService.getOrCreateCogneeSession(userId, {
      sessionType: 'chat',
      ttlMinutes: 30,
      datasetPrefix,
    });

    return c.json({
      sessionId: session.sessionId,
      isNew: session.isNew,
      context: session.context,
    });
  } catch (error: any) {
    console.error('Cognee session error:', error);
    return c.json({ error: error.message ?? 'Session creation failed' }, 500);
  }
});

/**
 * GET /api/cognee/graph/:userId
 * Get user-scoped knowledge graph (delegates to Wave 16 CogneeGraphService)
 */
app.get('/api/cognee/graph/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    // Get user's dataset prefix
    const account = await db.select().from(cogneeUserAccounts)
      .where(eq(cogneeUserAccounts.userId, userId))
      .limit(1);

    if (account.length === 0) {
      return c.json({ error: 'User not initialized' }, 404);
    }

    const prefix = account[0].datasetPrefix;

    // Get user's datasets and their graphs
    const allDatasets = await cogneeClient.listDatasets(userId);
    const userDatasets = Array.isArray(allDatasets)
      ? allDatasets.filter((d: any) => (d.name ?? d).toString().startsWith(prefix))
      : [];

    // Fetch graph for each user dataset
    const graphs = [];
    for (const ds of userDatasets.slice(0, 10)) { // limit to 10 to avoid timeout
      try {
        const graph = await cogneeClient.getDatasetGraph(ds.id ?? ds.name ?? ds, userId);
        graphs.push({ dataset: ds.name ?? ds, graph });
      } catch (err) {
        // Skip datasets without graphs
      }
    }

    return c.json({
      userId,
      datasetPrefix: prefix,
      datasetCount: userDatasets.length,
      graphs,
    });
  } catch (error: any) {
    console.error('Cognee graph error:', error);
    return c.json({ error: error.message ?? 'Graph retrieval failed' }, 500);
  }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 4 endpoints compile (POST init-user, POST reindex, GET session, GET graph/:userId)
- [ ] Zod validation schemas are applied to POST endpoints
- [ ] No existing routes are modified or broken
- [ ] Error responses return proper HTTP status codes
- [ ] Create marker file: `.agent-done-W03-08`

## Dependencies
- **Agent 1** must complete schema (cogneeUserAccounts, cogneeSessions tables)
- **Agent 2** must complete CogneeClient multi-user (createCogneeUser, setupUserAuth methods)
- **Agent 3** must complete session extension (getOrCreateCogneeSession method)
