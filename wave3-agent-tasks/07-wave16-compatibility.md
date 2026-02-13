# Agent 7: Wave 16 Compatibility Layer

## Role
Ensure all Wave 16 services (DataPoints, Ontologies, Feedback, Graph) work correctly with the new multi-user Cognee setup. Add userId passthrough to Wave 16 service methods.

## Priority: SUB-WAVE 3 (After Agents 2 and 5 complete)

## Files to MODIFY

### 1. `server/src/services/cognee-datapoints.ts`
**Purpose**: Add userId passthrough to DataPoint CRUD operations
**CRITICAL**: Agent 6 may also modify this file. Coordinate — Agent 6 adds `createOrUpdateDataPoint`, this agent adds userId to existing methods.

#### Step 1: Read the existing service and find all CogneeClient calls
The service calls `cogneeClient.createDataPoint()`, `cogneeClient.getDataPoints()`, `cogneeClient.deleteDataPoint()`.

#### Step 2: Add userId parameter to public methods
```typescript
// For each method that calls cogneeClient, add userId?: string:
async createDataPoint(datasetName: string, schema: any, userId?: string): Promise<any> {
  return this.cogneeClient.createDataPoint(datasetName, schema, userId);
}

async getDataPoints(datasetName: string, userId?: string): Promise<any[]> {
  return this.cogneeClient.getDataPoints(datasetName, userId);
}

async deleteDataPoint(datasetName: string, dpId: string, userId?: string): Promise<void> {
  return this.cogneeClient.deleteDataPoint(datasetName, dpId, userId);
}
```

### 2. `server/src/services/cognee-ontologies.ts`
**Purpose**: Add userId passthrough to ontology operations

#### Step 1: Read the service and identify CogneeClient calls
The service calls `cogneeClient.applyOntology()`, `cogneeClient.getOntology()`.

#### Step 2: Add userId to methods
```typescript
async applyOntology(datasetName: string, ontology: any, userId?: string): Promise<any> {
  return this.cogneeClient.applyOntology(datasetName, ontology, userId);
}

async getOntology(datasetName: string, userId?: string): Promise<any> {
  return this.cogneeClient.getOntology(datasetName, userId);
}
```

### 3. `server/src/services/cognee-feedback.ts`
**Purpose**: Add userId passthrough to feedback operations

#### Step 1: Read the service and identify CogneeClient calls
The service calls `cogneeClient.submitFeedback()`, `cogneeClient.triggerMemify()`.

#### Step 2: Add userId to methods
```typescript
async submitFeedback(data: any, userId?: string): Promise<any> {
  return this.cogneeClient.submitFeedback(data, userId);
}

async triggerMemify(data: any, userId?: string): Promise<any> {
  return this.cogneeClient.triggerMemify(data, userId);
}
```

### 4. `server/src/services/cognee-graph.ts`
**Purpose**: Add userId passthrough to graph visualization operations

#### Step 1: Read the service and identify CogneeClient calls
The service calls `cogneeClient.getDatasetGraph()`, `cogneeClient.getNodeSets()`, `cogneeClient.createNodeSet()`, `cogneeClient.deleteNodeSet()`.

#### Step 2: Add userId to methods
```typescript
async getGraph(datasetId: string, userId?: string): Promise<any> {
  return this.cogneeClient.getDatasetGraph(datasetId, userId);
}

async getNodeSets(datasetName: string, userId?: string): Promise<any[]> {
  return this.cogneeClient.getNodeSets(datasetName, userId);
}

async createNodeSet(datasetName: string, nodeSet: any, userId?: string): Promise<any> {
  return this.cogneeClient.createNodeSet(datasetName, nodeSet, userId);
}

async deleteNodeSet(datasetName: string, nodeSetId: string, userId?: string): Promise<any> {
  return this.cogneeClient.deleteNodeSet(datasetName, nodeSetId, userId);
}
```

### 5. Verify Wave 16 API Routes
**Check**: `server/src/index.ts` — find all `/api/knowledge/*` routes (Wave 16 added 16 routes)
**Action**: Ensure route handlers extract `userId` from request context and pass to service methods

Look for patterns like:
```typescript
// BEFORE:
app.get('/api/knowledge/datapoints/:dataset', async (c) => {
  const result = await dataPointService.getDataPoints(c.req.param('dataset'));
  return c.json(result);
});

// AFTER (if userId available from auth middleware):
app.get('/api/knowledge/datapoints/:dataset', async (c) => {
  const userId = c.get('userId'); // from auth middleware — may not exist yet
  const result = await dataPointService.getDataPoints(c.req.param('dataset'), userId);
  return c.json(result);
});
```

**IMPORTANT**: If there's no auth middleware extracting userId, just pass `undefined` — the services will fall back to admin token. The full auth integration is handled by Wave 1/2.

## Backward Compatibility Contract
- ALL existing Wave 16 API routes MUST continue to work exactly as before
- Methods without userId MUST use admin token (same behavior as pre-Wave 3)
- No existing type signatures break — only optional parameter additions
- Wave 16 UI components (KnowledgeDashboard, GraphExplorer, etc.) work without changes

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Wave 16 DataPoint CRUD still works (test with curl if possible)
- [ ] Wave 16 Ontology apply/get still works
- [ ] Wave 16 Feedback submit still works
- [ ] Wave 16 Graph visualization still works
- [ ] All service methods accept optional userId without breaking
- [ ] Create marker file: `.agent-done-W03-07`

## Dependencies
- **Agent 2** must complete CogneeClient multi-user (adds userId to CogneeClient methods)
- **Agent 5** must complete prefix wiring (ensures datasets are correctly prefixed)
- **Coordinates with Agent 6** who also modifies cognee-datapoints.ts (non-overlapping changes)
