# Agent R02: Cognee Capabilities & Config Researcher

## Role

Document ALL Cognee features — both what's currently enabled and what's available but unused. Identify the gap between current config and full Cognee potential for financial intelligence.

## Phase: A (Research — Start Immediately, Parallel with R01, R03-R10)

## Research Tasks

### 1. Current Cognee Configuration

- [ ] Read `docker-compose.yml` — document ALL Cognee environment variables (LLM_API_KEY, EMBEDDING_*, GRAPH_DATABASE_*, VECTOR_DB_*, auth settings)
- [ ] Read `server/src/services/cognee_client.ts` — document CogneeClient class: auth flow (JWT caching, 50-min TTL), all methods (add, search, searchRich, cognify, addAndCognify, listDatasets, getDatasetStatus, getDatasetGraph, createDataset, isHealthy), FINANCIAL_COGNIFY_PROMPT, merchant memory methods
- [ ] Read `server/src/services/claude/cognee-tools.ts` — document CogneeTools class: COGNEE_DATASETS constant (list all 12), datasetPrefix support, batch chunking, domain-specific helpers (indexTaxStrategies, searchTaxRulings, searchEconomicData)
- [ ] Document the 14 search types supported

### 2. Multi-User Isolation Status

- [ ] Verify `ENABLE_BACKEND_ACCESS_CONTROL=false` in docker-compose.yml
- [ ] Verify `REQUIRE_AUTHENTICATION=false`
- [ ] Read `docs/skills docs/core-concepts-multi-user-overview.md` — document what multi-user SHOULD look like
- [ ] Document what changes are needed to enable per-user dataset isolation

### 3. Unused Cognee Features

- [ ] Read `docs/skills docs/core-concepts-datapoints.md` — document Custom DataPoint model pattern (Pydantic models, metadata.index_fields, vector indexing)
- [ ] Read `docs/skills docs/core-concepts-sessions-and-caching.md` — document session/caching features (Redis connection needed)
- [ ] Read `docs/skills docs/core-concepts-dataset-db-handlers-what-are-they.md` — document Dataset Database Handlers pattern
- [ ] Read `docs/COGNEE_INTEGRATION.md` — compare documented features vs actually implemented
- [ ] Identify: graph traversal queries (GRAPH_COMPLETION, GRAPH_SUMMARY_COMPLETION), temporal cognify, sessionized memory

### 4. Cognee Graph API for Visualization

- [ ] Document `getDatasetGraph()` method in cognee_client.ts — what data format does it return?
- [ ] Research Cognee's graph export capabilities — can we get ALL nodes and edges for 3D visualization?
- [ ] Document what graph data structure Cognee uses (Kuzu) and how to query it

### 5. Redis Connection Gap

- [ ] Document that Redis service EXISTS in docker-compose.yml but is NOT connected to Cognee
- [ ] List the missing env vars: `CACHING=true`, `CACHE_BACKEND=redis`, `CACHE_HOST=redis`, `CACHE_PORT=6379`

## Output Format

Write findings to `wave0-research/R02-cognee-capabilities.md` with these sections:

1. **Current State** — What's enabled, what's configured, what's working
2. **Multi-User Gap** — What's disabled, what's needed for isolation
3. **Unused Features** — Custom DataPoints, sessions, caching, graph traversal
4. **Graph Visualization API** — Available endpoints for 3D graph rendering
5. **Redis Gap** — Missing configuration for Cognee caching
6. **Feature Priority Matrix** — Table ranking unused features by impact vs effort

## Completion

- [ ] All sections populated with specific config values and code references
- [ ] Create marker file: `.agent-done-R02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Cognee API Analysis** | Understand Cognee REST endpoints, JWT auth, dataset operations | Expert |
| **Configuration Auditing** | Parse Docker env vars, identify enabled/disabled features | Expert |
| **Knowledge Graph Concepts** | Understand graph stores (Kuzu), vector stores (pgvector), embeddings | Expert |
| **Multi-Tenant Architecture** | Assess data isolation, access control, per-user namespacing | Advanced |
| **Documentation Cross-Reference** | Compare docs vs implementation to find gaps | Advanced |
| **Feature Gap Analysis** | Identify unused capabilities and prioritize by impact | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel research | Advanced |

## Sub-Agent Delegation Plan

```
R02 (Cognee Capabilities Researcher):
├── Sub-agent A: Current Implementation Audit
│   ├── Read server/src/services/cognee_client.ts (648 lines)
│   ├── Read server/src/services/claude/cognee-tools.ts (126 lines)
│   ├── Read docker-compose.yml (Cognee service section only)
│   └── Output: wave0-research/.scratch-R02-current.md
│
├── Sub-agent B: Cognee Documentation Research
│   ├── Read docs/skills docs/core-concepts-datapoints.md
│   ├── Read docs/skills docs/core-concepts-multi-user-overview.md
│   ├── Read docs/skills docs/core-concepts-sessions-and-caching.md
│   ├── Read docs/skills docs/core-concepts-dataset-db-handlers-what-are-they.md
│   └── Output: wave0-research/.scratch-R02-docs.md
│
├── Sub-agent C: Graph API & Visualization Research
│   ├── Read getDatasetGraph() method in cognee_client.ts
│   ├── Research Kuzu graph query capabilities
│   ├── Document graph export format for 3D visualization
│   └── Output: wave0-research/.scratch-R02-graph.md
│
└── R02 Parent: Merge and produce feature priority matrix
    ├── Read all .scratch-R02-*.md files
    ├── Cross-reference docs vs implementation
    ├── Write final wave0-research/R02-cognee-capabilities.md
    └── Delete scratch files
```

### Delegation Rules for R02

- Sub-agents write ONLY to `wave0-research/.scratch-R02-*.md` files
- Sub-agent B should note exact feature names and config keys from docs
- Sub-agent C should document the exact JSON structure returned by graph endpoints

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
