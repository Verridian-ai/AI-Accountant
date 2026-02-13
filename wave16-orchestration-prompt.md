# Wave 16 — Custom DataPoints & Graph Relationships — Orchestration Prompt

You are the **Team Lead** for Wave 16: Custom DataPoints & Graph Relationships. You coordinate 10 specialized agents to unlock Cognee's advanced features — custom DataPoints, ontology definitions, graph visualization, and the feedback/memify system.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Cognee research**: `wave0-research/R02-cognee-capabilities.md`
- **Existing Cognee client**: `server/src/services/cognee_client.ts`
- **Cognee tools**: `server/src/services/claude/cognee-tools.ts`

## Current State (After Wave 15)
- 23 Claude agents
- Cognee has ~18 datasets but uses only CHUNKS, CHUNKS_LEXICAL, GRAPH_COMPLETION, RAG_COMPLETION search types
- Custom DataPoints, ontologies, and feedback system are UNUSED
- 17 migrations (0009–0027) applied

## Dependencies
- **Requires**: Wave 3 (multi-user Cognee isolation)
- **Estimated Complexity**: MEDIUM (mostly Cognee configuration, minimal new tables)

## Database Schema Changes

### New Tables (3 tables)
| Table | Columns |
|-------|---------|
| `datapoint_configs` | id, userId, name, dataPointClass, sourceDataset, fields (JSON), relationships (JSON), isActive, createdAt |
| `graph_schemas` | id, userId, name, nodeTypes (JSON), edgeTypes (JSON), ontologyDefinition (JSON), version, isActive |
| `cognee_feedback` | id, userId, searchId, query, resultId, rating (1-5), feedbackType (relevant/irrelevant/partial), correction, createdAt |

**Migration**: `docker/migrations/0028_cognee_custom_datapoints.sql`

## API Endpoints (16 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cognee/datapoints | List custom DataPoint configs |
| POST | /api/cognee/datapoints | Create custom DataPoint definition |
| GET | /api/cognee/datapoints/:id | Get DataPoint config |
| PATCH | /api/cognee/datapoints/:id | Update DataPoint config |
| POST | /api/cognee/datapoints/:id/activate | Activate DataPoint extraction |
| GET | /api/cognee/ontologies | List graph ontologies |
| POST | /api/cognee/ontologies | Create ontology definition |
| PATCH | /api/cognee/ontologies/:id | Update ontology |
| POST | /api/cognee/ontologies/:id/apply | Apply ontology to dataset |
| GET | /api/cognee/graph/:dataset | Get graph data (nodes + edges) |
| GET | /api/cognee/graph/:dataset/stats | Graph statistics |
| POST | /api/cognee/feedback | Submit search feedback |
| GET | /api/cognee/feedback/stats | Feedback statistics |
| POST | /api/cognee/memify | Trigger memify (memory consolidation) |
| GET | /api/cognee/nodesets | List NodeSets |
| POST | /api/cognee/nodesets | Create NodeSet grouping |

## UI Components
### `client/src/features/knowledge/` — New feature folder
- KnowledgeGraphExplorer.tsx — 3D graph visualization (using three.js/force-graph)
- DataPointDesigner.tsx — Visual DataPoint class builder
- OntologyEditor.tsx — Node/edge type definition editor
- GraphStatsDashboard.tsx — Dataset stats, node/edge counts, coverage metrics
- SearchFeedbackPanel.tsx — Rate and correct search results
- NodeSetManager.tsx — Group related nodes into sets
- GraphFilterPanel.tsx — Filter nodes/edges by type, dataset, time range

**Navigation**: Add `knowledge` to TabId type

## New Claude Agents (0)
No new agents — this wave configures Cognee's existing capabilities. Existing agents get enhanced Cognee tool access.

## Cognee Integration (CORE FOCUS)
This wave activates previously unused Cognee features:

### Custom DataPoints
- Define `FinancialTransaction` DataPoint with fields: merchant, amount, category, gst_status, entity_id
- Define `BusinessRelationship` DataPoint: entity_a, entity_b, relationship_type, frequency, total_value
- Define `TaxEvent` DataPoint: event_type, amount, tax_year, deductibility, ato_reference

### Ontology Definitions
- Financial ontology: Merchant → Transaction → Account → Entity
- Tax ontology: Income → Deduction → Offset → Liability
- Relationship ontology: Supplier ↔ Customer, Parent ↔ Subsidiary

### Feedback System
- Wire `POST /v1/feedback` Cognee endpoint for search quality rating
- Implement memify for periodic memory consolidation
- Use feedback to improve search relevance over time

### NodeSets
- Group related transactions by merchant
- Group entities by corporate structure
- Group assets by depreciation schedule

## Testing Criteria
- [ ] Custom DataPoint definition creates valid extraction pipeline
- [ ] Ontology applies to existing datasets without data loss
- [ ] Graph visualization renders nodes and edges in 3D
- [ ] Feedback submission improves subsequent search relevance
- [ ] Memify consolidates related memories
- [ ] NodeSets correctly group related nodes
- [ ] Graph stats show accurate node/edge counts
- [ ] All 14 search types work with custom DataPoints
- [ ] Existing agent tools still work after DataPoint activation
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: cognee-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave16-agent-tasks/01-cognee-schema-builder.md`

### Agent 2: datapoint-builder [PRIORITY: WAVE 1]
**Task file**: `wave16-agent-tasks/02-datapoint-builder.md`
**Creates**: server/src/services/cognee-datapoints.ts

### Agent 3: ontology-builder [PRIORITY: WAVE 1]
**Task file**: `wave16-agent-tasks/03-ontology-builder.md`
**Creates**: server/src/services/cognee-ontologies.ts

### Agent 4: feedback-builder [DEPENDS ON: Agent 2]
**Task file**: `wave16-agent-tasks/04-feedback-builder.md`
**Creates**: server/src/services/cognee-feedback.ts

### Agent 5: graph-viz-builder [DEPENDS ON: Agent 3]
**Task file**: `wave16-agent-tasks/05-graph-viz-builder.md`
**Modifies**: server/src/services/cognee_client.ts (add graph endpoints)

### Agent 6: cognee-client-extension [DEPENDS ON: Agents 2, 3, 4]
**Task file**: `wave16-agent-tasks/06-cognee-client-extension.md`
**Modifies**: cognee_client.ts, cognee-tools.ts

### Agent 7: api-endpoints-builder [DEPENDS ON: Agent 6]
**Task file**: `wave16-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-knowledge-builder [DEPENDS ON: Agent 7]
**Task file**: `wave16-agent-tasks/08-ui-knowledge-builder.md`
**Creates**: 7 new .tsx components in client/src/features/knowledge/

### Agent 9: agent-tool-upgrader [DEPENDS ON: Agent 6]
**Task file**: `wave16-agent-tasks/09-agent-tool-upgrader.md`
**Modifies**: All agent files to add DataPoint-aware tools

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave16-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5
Sub-wave 3 (After 2):  Agent 6
Sub-wave 4 (After 3):  Agent 7 + Agent 9
Sub-wave 5 (After 4):  Agent 8
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave16-agent-tasks/`.
