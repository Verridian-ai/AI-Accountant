# Skill: Cognee Hive Memory — Complete Reference

> Master skill for all Cognee MCP operations. Every agent must read this before using hive memory.
> Source: 97 official Cognee docs in docs/skills docs/

---

## WHAT IS COGNEE

Cognee is an open-source AI memory platform that combines:
- **Vector store** — semantic similarity search (embeddings)
- **Graph store** — entity/relationship knowledge graph (Neo4j/Kuzu)
- **Relational store** — document provenance and metadata (PostgreSQL)

The result: data that is both **searchable by meaning** AND **connected by relationships**.

## OUR STACK (agent-cognee)

| Service | Port | Purpose |
|---------|------|---------|
| Cognee API | 9020 | REST API — add, cognify, search |
| Cognee MCP | 9021 | MCP server for Claude Code agents |
| PostgreSQL+pgvector | 9022 | Relational + vector store |
| Redis | 9023 | Session cache |
| Neo4j | 9024 | Graph store |

**MCP server name in .mcp.json**: `cognee-agent-teams`
**MCP endpoint**: `http://localhost:9021/mcp`
**Start stack**: `docker compose -p agent-cognee -f ~/Desktop/agent-cognee/docker-compose.yml up -d`

---

## THE 11 MCP TOOLS

### Memory Management
```
mcp__cognee-agent-teams__cognify(data, dataset_name)
  → Transform text/data into structured knowledge graph entries
  → Use for: decisions, patterns, bugs, fixes, architecture notes
  → dataset_name: one of the 15 hive datasets (see below)

mcp__cognee-agent-teams__search(query_text, query_type)
  → Retrieve memories using semantic search
  → query_type: GRAPH_COMPLETION | CHUNKS | SUMMARIES | RAG_COMPLETION | INSIGHTS

mcp__cognee-agent-teams__prune()
  → Clear ALL memory — use with extreme caution

mcp__cognee-agent-teams__cognee_add_developer_rules(rules_file_path)
  → Ingest developer rule files into permanent memory
```

### Code Intelligence
```
mcp__cognee-agent-teams__codify(source_code_path, dataset_name?)
  → Generate code-specific knowledge graphs from source directories
  → Run BEFORE using search with CODE query type
  → Best for: routes/, schema/, services/, components/

mcp__cognee-agent-teams__save_interaction(user_message, assistant_message)
  → Store user-assistant exchanges to build development rules
  → Use to capture important decisions made in conversation

mcp__cognee-agent-teams__get_developer_rules()
  → Retrieve ALL stored developer rules and patterns
  → ALWAYS call this at session start
```

### Data Management
```
mcp__cognee-agent-teams__list_data()
  → List all datasets and their data items with IDs
  → Use to audit what's in hive memory

mcp__cognee-agent-teams__delete(data_id)
  → Remove specific data items from datasets

mcp__cognee-agent-teams__cognify_status(pipeline_run_id?)
  → Check status of a running cognify pipeline
```

---

## SEARCH QUERY TYPES — WHEN TO USE EACH

| Query Type | Best For | Example |
|-----------|---------|---------|
| `GRAPH_COMPLETION` | "Why did X happen?" "How does Y work?" Relationship questions | `"Why does the auth middleware fail?"` |
| `CHUNKS` | Find specific code, find stored text, keyword-style | `"tenantAuthMiddleware implementation"` |
| `SUMMARIES` | High-level overview of a topic | `"Overview of the payment service"` |
| `RAG_COMPLETION` | Fast text-only Q&A without graph | `"What is the GST rate in Australia?"` |
| `INSIGHTS` | Relationships between concepts | `"What connects transactions to tenants?"` |
| `CODE` | Code-specific search (requires codify first) | `"How is JWT verified?"` |

---

## THE 15 HIVE DATASETS

| Dataset | Store What Here |
|---------|----------------|
| `hive_agent_decisions` | Architectural decisions, rationale, tradeoffs |
| `hive_agent_patterns` | Successful workflows, strategies, orchestration patterns |
| `hive_agent_errors` | Bugs found, root causes, anti-patterns to avoid |
| `hive_agent_commits` | Commit summaries, what changed and why |
| `hive_codebase_arch` | System architecture, module boundaries, design |
| `hive_codebase_routes` | API endpoints, middleware, route contracts |
| `hive_codebase_schema` | DB schema, migrations, table relationships |
| `hive_codebase_services` | Service implementations, business logic |
| `hive_codebase_types` | TypeScript types, interfaces, enums |
| `hive_audit_findings` | Issues found during audits |
| `hive_audit_fixes` | Fixes applied, verification results |
| `hive_quality_rules` | Code quality rules, enforcement patterns |
| `hive_gst_rules` | ATO GST rules, BAS calculations |
| `hive_tax_knowledge` | Tax brackets, deductions, compliance |
| `hive_financial_patterns` | Transaction patterns, merchant intelligence |

---

## MANDATORY SESSION PROTOCOL

### START OF EVERY SESSION (do before reading any files)
```
1. mcp__cognee-agent-teams__get_developer_rules()
2. mcp__cognee-agent-teams__search("your task area", "GRAPH_COMPLETION")
3. mcp__cognee-agent-teams__search("known bugs anti-patterns", "CHUNKS")
```

### END OF EVERY SESSION (do before messaging DONE)
```
mcp__cognee-agent-teams__cognify(
  data="[decisions made, root causes found, fixes applied, patterns discovered]",
  dataset_name="hive_agent_decisions"
)
```

---

## COGNEE CORE CONCEPTS

### The Pipeline: Add → Cognify → Search

**1. Add** — Ingest data
```
POST /api/v1/add
  -F "data=@file.txt;type=text/plain"
  -F "datasetName=hive_agent_decisions"
```

**2. Cognify** — Build knowledge graph
- Classifies documents into typed chunks
- Extracts entities and relationships via LLM
- Deduplicates nodes/edges, commits to Neo4j
- Generates summaries, embeds into pgvector
- Result: fully searchable knowledge graph

**3. Search** — Query with multiple modes
- Vector similarity finds relevant chunks
- Graph traversal finds relationships
- LLM composes grounded answers

### DataPoints
Structured data units that become graph nodes. Carry content + metadata.
Custom DataPoints extend the schema for domain-specific knowledge.

### Datasets
Logical namespaces for data isolation. Each dataset has:
- Its own documents, chunks, embeddings
- Access control (owner, permissions)
- Cognify status and token counts

### Sessions & Caching
- `session_id` maintains conversation history across searches
- Redis provides session caching
- Sessionized tools scope data by session ID

### Permissions
- Principals: users, groups, tenants
- Roles: owner, editor, viewer
- ACL: per-dataset access control
- `ENABLE_BACKEND_ACCESS_CONTROL=true` enables dataset scoping

---

## REST API REFERENCE

```bash
# Health
GET  http://localhost:9020/health

# Add data
POST http://localhost:9020/api/v1/add
  -F "data=@file.txt;type=text/plain"
  -F "datasetName=dataset_name"

# Cognify (build knowledge graph)
POST http://localhost:9020/api/v1/cognify
  -H "Content-Type: application/json"
  -d '{"datasets": ["dataset_id_1", "dataset_id_2"]}'

# Search
POST http://localhost:9020/api/v1/search
  -H "Content-Type: application/json"
  -d '{"query": "your query", "query_type": "GRAPH_COMPLETION"}'

# List datasets
GET  http://localhost:9020/api/v1/datasets

# Settings
GET  http://localhost:9020/api/v1/settings
```

---

## ADVANCED: CODIFY FOR CODE INTELLIGENCE

```
# Index entire route directory
mcp__cognee-agent-teams__codify(
  source_code_path="/mnt/c/Users/Danie/Desktop/CBA Statements Parse/server/src/routes"
)

# Then search with CODE type
mcp__cognee-agent-teams__search("JWT verification logic", "CODE")
mcp__cognee-agent-teams__search("tenantAuthMiddleware", "CODE")
```

## ADVANCED: ONTOLOGIES

Cognee supports RDF/XML ontologies to ground data in established knowledge structures.
Use for domain-specific knowledge like financial regulations, tax codes, accounting standards.

## ADVANCED: NODE SETS

Tag and organize knowledge base content:
- Systematic categorization for large knowledge bases
- Filter queries by node set
- Domain expertise organization

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| MCP not responding | `docker compose -p agent-cognee up -d` |
| Search returns empty | Run cognify first after adding data |
| codify fails | Check path exists and is readable |
| 500 on /add | Use `datasetName` (camelCase), not `dataset_name` |
| Slow cognify | Normal — LLM is extracting entities. Check logs: `docker logs agent-cognee-api -f` |

---

## INTEGRATION WITH CLAUDE AGENT SDK

```python
from cognee_integration_claude import add_tool, search_tool, get_sessionized_cognee_tools

# Per-session memory
add_tool, search_tool = get_sessionized_cognee_tools(session_id="agent-team-9")

# Cross-session memory (shared across all agents)
add_tool, search_tool = get_sessionized_cognee_tools(session_id="goldledger-global")
```

## SLASH COMMAND SHORTCUTS

```
/gl-hive search "query"          → GRAPH_COMPLETION search
/gl-hive store "content" dataset → cognify to dataset
/gl-hive codify path/            → index code
/gl-hive rules                   → get_developer_rules()
/gl-hive status                  → list_data()
```
