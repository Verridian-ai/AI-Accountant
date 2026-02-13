# Agent W16-10: Testing & Validation Agent

## Role
Verify DataPoint extraction, ontology application, graph rendering, feedback loops, and full-stack integration for Wave 16.

## Priority: WAVE 16 (After ALL Wave 16 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W16-01` through `.agent-done-W16-09` before starting.

## Verification Tasks

### Compilation
- [ ] Run `cd server && npx tsc --noEmit` -- zero errors
- [ ] Run `cd client && npx tsc --noEmit` -- zero errors
- [ ] Run `docker compose config` -- validates

### Schema Verification
- [ ] Run migration 0028 against PostgreSQL: `docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0028_cognee_datapoints.sql`
- [ ] Verify 3 tables exist: `\dt datapoint_configs`, `\dt graph_schemas`, `\dt cognee_feedback`
- [ ] Verify indexes created (at least 8 indexes across 3 tables)
- [ ] Verify unique constraints: inserting duplicate (user_id, name) in datapoint_configs should fail
- [ ] Verify predefined DataPoint configs seeded: 3 rows with user_id='system' and is_predefined=true

### DataPoint Service Verification
- [ ] Test create DataPoint:
  ```
  curl -X POST localhost:3501/api/knowledge/datapoints -H 'Content-Type: application/json' \
    -d '{"userId":"test","name":"TestDP","datapointType":"custom","schemaDefinition":{"fields":[{"name":"test_field","type":"string"}]},"datasetName":"test_dataset"}'
  Expected: 200 with created DataPoint config
  ```
- [ ] Test list DataPoints: `curl localhost:3501/api/knowledge/datapoints/test` -- verify returns predefined + custom
- [ ] Test activate extraction: `POST /api/knowledge/datapoints/{id}/activate` -- verify Cognee API called
- [ ] Test deactivate predefined: should return error (predefined cannot be deactivated)
- [ ] Test delete predefined: should return error (predefined cannot be deleted)
- [ ] Test schema validation: submit DataPoint with no `fields` array -- should fail validation

### Ontology Service Verification
- [ ] Test create ontology:
  ```
  curl -X POST localhost:3501/api/knowledge/ontologies -H 'Content-Type: application/json' \
    -d '{"userId":"test","name":"TestOntology","ontologyType":"custom","nodeTypes":[{"name":"TestNode","properties":[{"name":"label","type":"string"}]}],"edgeTypes":[{"name":"TEST_EDGE","sourceType":"TestNode","targetType":"TestNode"}]}'
  Expected: 200 with created ontology
  ```
- [ ] Test edge type validation: submit edge with sourceType that doesn't exist in nodeTypes -- should fail
- [ ] Test apply to dataset: `POST /api/knowledge/ontologies/{id}/apply` with dataset name -- verify Cognee API called
- [ ] Verify predefined ontologies: financial (4 node types, 5 edge types), tax (4 node types, 4 edge types), relationship (3 node types, 5 edge types)

### Feedback Service Verification
- [ ] Test submit feedback:
  ```
  curl -X POST localhost:3501/api/knowledge/feedback -H 'Content-Type: application/json' \
    -d '{"userId":"test","entityType":"search_result","entityId":"result-1","feedbackType":"incorrect","originalValue":"wrong category","correctedValue":"Groceries"}'
  Expected: 200 with persisted feedback record
  ```
- [ ] Test feedback stats: `GET /api/knowledge/feedback/test/stats` -- verify aggregated counts
- [ ] Test memify trigger with insufficient feedback (count < threshold): should return `status: 'insufficient_feedback'`
- [ ] Test memify trigger with forceRun: should process regardless of count
- [ ] Test delete applied feedback: should return error (already applied to memify)

### Graph Visualization Verification
- [ ] Test get graph data: `GET /api/knowledge/graph/transaction_patterns?maxNodes=100` -- verify nodes and edges returned
- [ ] Test graph stats: `GET /api/knowledge/graph/transaction_patterns/stats` -- verify nodeCount, edgeCount, density
- [ ] Test prune: `POST /api/knowledge/graph/transaction_patterns/prune` with `{"minDegree": 2}` -- verify filtered results
- [ ] Test subgraph: `GET /api/knowledge/graph/transaction_patterns/subgraph/{nodeId}?depth=2` -- verify limited traversal
- [ ] Verify maxNodes limit respected (request 10, get at most 10)

### Agent Tool Verification
- [ ] Verify transaction-categorizer has `search_transaction_patterns` tool
- [ ] Verify merchant-intelligence has `explore_merchant_graph` and `get_merchant_ontology_context` tools
- [ ] Verify gst-calculator has `search_tax_events` tool
- [ ] Verify tax-strategy has `explore_tax_ontology` and `search_deduction_precedents` tools
- [ ] Verify financial-planner has `search_financial_patterns` tool
- [ ] Verify cross-account-tracer has `explore_relationship_graph` tool
- [ ] Verify forecasting-agent has `search_forecast_history` tool
- [ ] Verify compliance-monitoring-agent has `search_compliance_ontology` tool
- [ ] Test that new tools call correct cognee-tools methods (searchWithDataPoint, searchWithOntology)
- [ ] Verify no existing tools broken by modifications

### Cognee Client Verification
- [ ] Verify `createDataPoint()` method exists on CogneeClient
- [ ] Verify `applyOntology()` method exists on CogneeClient
- [ ] Verify `submitFeedback()` method exists on CogneeClient
- [ ] Verify `triggerMemify()` method exists on CogneeClient
- [ ] Verify `getNodeSets()` method exists on CogneeClient
- [ ] Verify existing methods (add, search, cognify) still work unchanged

### Frontend Verification
- [ ] Navigate to /knowledge -- verify KnowledgeDashboard loads with 5 tabs
- [ ] Verify KnowledgeGraphExplorer renders 3D canvas (three.js loads without errors)
- [ ] Verify DataPointManager lists predefined DataPoints
- [ ] Verify OntologyManager shows predefined ontologies with correct node/edge counts
- [ ] Verify FeedbackPanel displays stats and memify button
- [ ] Verify GraphStatsPanel shows dataset metrics
- [ ] Verify three.js dependencies installed: `ls node_modules/three node_modules/@react-three`

### Generate Verification Report
```
GOLDLEDGER WAVE 16 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:           [PASS/FAIL] - [details]
DataPoints:       [PASS/FAIL] - [details]
Ontologies:       [PASS/FAIL] - [details]
Feedback:         [PASS/FAIL] - [details]
Graph Viz:        [PASS/FAIL] - [details]
Cognee Client:    [PASS/FAIL] - [details]
Agent Tools:      [PASS/FAIL] - [details]
Frontend:         [PASS/FAIL] - [details]
Build:            [PASS/FAIL] - [details]
API Routes:       [PASS/FAIL] - [details]
Integration:      [PASS/FAIL] - [details]
```

- [ ] Create marker file: `.agent-done-W16-10`

## Dependencies
- **Requires**: ALL Wave 16 agents (`.agent-done-W16-01` through `.agent-done-W16-09`)
- **Docker must be running**: `docker compose up -d`
- **Cognee must be running**: verify Cognee API at localhost:8000 responds
