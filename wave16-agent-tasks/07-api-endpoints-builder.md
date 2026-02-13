# Agent W16-07: API Endpoints Builder

## Role
Wire 16 new API routes in server/src/index.ts for DataPoint management, ontology configuration, feedback loops, and graph visualization.

## Priority: WAVE 16 (After W16-02, W16-03, W16-04, W16-05 complete)

## Wait Condition
Check for `.agent-done-W16-02`, `.agent-done-W16-03`, `.agent-done-W16-04`, `.agent-done-W16-05` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Insert location**: After Wave 15 routes, before final app mount

- [ ] Add imports for 4 new services:
  ```typescript
  import { CogneeDataPointService } from './services/cognee-datapoints.js';
  import { CogneeOntologyService } from './services/cognee-ontologies.js';
  import { CogneeFeedbackService } from './services/cognee-feedback.js';
  import { CogneeGraphService } from './services/cognee-graph.js';
  ```

- [ ] Instantiate 4 services:
  ```typescript
  const cogneeDataPointService = new CogneeDataPointService();
  const cogneeOntologyService = new CogneeOntologyService();
  const cogneeFeedbackService = new CogneeFeedbackService();
  const cogneeGraphService = new CogneeGraphService();
  ```

- [ ] Add 5 DataPoint routes:
  - `POST /api/knowledge/datapoints` -- Body: `{ userId, name, description?, datapointType, schemaDefinition, extractionPrompt?, datasetName }`. Calls `cogneeDataPointService.defineDataPoint()`.
  - `GET /api/knowledge/datapoints/:userId` -- Query: `?datapointType=&isActive=&isPredefined=`. Calls `cogneeDataPointService.listDataPoints()`.
  - `GET /api/knowledge/datapoints/detail/:datapointId` -- Calls `cogneeDataPointService.getDataPoint()`.
  - `POST /api/knowledge/datapoints/:datapointId/activate` -- Calls `cogneeDataPointService.activateExtraction()`.
  - `POST /api/knowledge/datapoints/:datapointId/deactivate` -- Calls `cogneeDataPointService.deactivateDataPoint()`.

- [ ] Add 4 Ontology routes:
  - `POST /api/knowledge/ontologies` -- Body: `{ userId, name, description?, ontologyType, nodeTypes, edgeTypes, constraints? }`. Calls `cogneeOntologyService.defineOntology()`.
  - `GET /api/knowledge/ontologies/:userId` -- Query: `?ontologyType=&isActive=`. Calls `cogneeOntologyService.listOntologies()`.
  - `POST /api/knowledge/ontologies/:ontologyId/apply` -- Body: `{ datasetName }`. Calls `cogneeOntologyService.applyToDataset()`.
  - `POST /api/knowledge/ontologies/:ontologyId/validate` -- Body: `{ graphData }`. Calls `cogneeOntologyService.validateGraph()`.

- [ ] Add 3 Feedback routes:
  - `POST /api/knowledge/feedback` -- Body: `{ userId, entityType, entityId, feedbackType, originalValue?, correctedValue?, context?, datapointConfigId? }`. Calls `cogneeFeedbackService.submitFeedback()`.
  - `GET /api/knowledge/feedback/:userId/stats` -- Query: `?entityType=&datapointConfigId=&dateFrom=&dateTo=`. Calls `cogneeFeedbackService.getFeedbackStats()`.
  - `POST /api/knowledge/feedback/:userId/memify` -- Body: `{ datasetNames?, minFeedbackCount?, forceRun? }`. Calls `cogneeFeedbackService.triggerMemify()`.

- [ ] Add 4 Graph Visualization routes:
  - `GET /api/knowledge/graph/:datasetName` -- Query: `?maxNodes=500&ontologyId=&nodeFilter=&depthLimit=`. Calls `cogneeGraphService.getGraphData()`.
  - `GET /api/knowledge/graph/:datasetName/stats` -- Calls `cogneeGraphService.getGraphStats()`.
  - `POST /api/knowledge/graph/:datasetName/prune` -- Body: `{ minDegree?, nodeTypes?, excludeNodeTypes?, edgeTypes?, maxAge?, searchQuery? }`. Calls `cogneeGraphService.pruneNodes()`.
  - `GET /api/knowledge/graph/:datasetName/subgraph/:nodeId` -- Query: `?depth=2`. Calls `cogneeGraphService.getSubgraph()`.

### Route Pattern (follow existing pattern):
```typescript
app.post('/api/knowledge/datapoints', async (c) => {
    try {
        const body = await c.req.json();
        const { userId, ...config } = body;
        const result = await cogneeDataPointService.defineDataPoint(userId, config);
        return c.json(result);
    } catch (err) {
        console.error('DataPoint creation failed:', err);
        return c.json({ error: 'Failed to create DataPoint' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 16 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes (all under /api/knowledge/)
- [ ] POST routes accept JSON body correctly
- [ ] GET routes support query parameters
- [ ] Graph data endpoint respects maxNodes limit
- [ ] Feedback endpoint persists and returns created record
- [ ] Create marker file: `.agent-done-W16-07`

## Dependencies
- **Requires**: W16-02 (`.agent-done-W16-02`), W16-03 (`.agent-done-W16-03`), W16-04 (`.agent-done-W16-04`), W16-05 (`.agent-done-W16-05`)
- **IMPORTANT**: Only W16-07 modifies server/src/index.ts in Wave 16
