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

## THE 7 MCP TOOLS (actual signatures from server.py)

> **IMPORTANT**: These are the REAL parameter names from the MCP server source code.
> Previous versions of this doc had incorrect names. Use ONLY these.

### Memory Management
```
mcp__cognee-agent-teams__cognify(data: str, graph_model_file?: str, graph_model_name?: str, custom_prompt?: str)
  → Transform text/data into structured knowledge graph entries
  → Use for: decisions, patterns, bugs, fixes, architecture notes
  → NOTE: NO dataset_name param — all data goes to main_dataset
  → Embed hierarchical IDs in the data string (see HIERARCHICAL MEMORY below)

mcp__cognee-agent-teams__search(search_query: str, search_type: str, top_k?: int)
  → Retrieve memories using semantic search
  → search_type: GRAPH_COMPLETION | CHUNKS | SUMMARIES | RAG_COMPLETION | INSIGHTS
  → top_k: number of results (default 10)
  → NOTE: params are search_query/search_type (NOT query_text/query_type)

mcp__cognee-agent-teams__save_interaction(data: str)
  → Store user-agent interaction pairs for building development rules

mcp__cognee-agent-teams__prune()
  → Clear ALL memory — use with extreme caution
```

### Data Management
```
mcp__cognee-agent-teams__list_data(dataset_id?: str)
  → List all datasets and their data items with IDs
  → Use to audit what's in hive memory

mcp__cognee-agent-teams__delete(data_id: str, dataset_id: str, mode?: str)
  → Remove specific data items from datasets
  → mode: "soft" (default) or "hard"

mcp__cognee-agent-teams__cognify_status()
  → Check status of a running cognify pipeline
```

### Developer Rules
```
mcp__cognee-agent-teams__get_developer_rules()
  → Retrieve ALL stored developer rules and patterns
  → ALWAYS call this at session start
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
2. mcp__cognee-agent-teams__search(search_query="your task area", search_type="GRAPH_COMPLETION")
3. mcp__cognee-agent-teams__search(search_query="known bugs anti-patterns", search_type="CHUNKS")
```

### END OF EVERY SESSION (do before messaging DONE)
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [decisions made, root causes found, fixes applied, patterns discovered]"
)
```

---

## HIERARCHICAL MEMORY STRUCTURE

Since the MCP `cognify()` tool does NOT support native metadata fields or dataset_name,
we embed a 3-level hierarchy directly in the `data` string as structured headers.

### The 3 Levels

| Level | Tag | Example | Purpose |
|-------|-----|---------|---------|
| **Project** | `[PROJECT: id]` | `[PROJECT: goldledger-v1]` | Identifies the project across all teams |
| **Team Session** | `[TEAM_SESSION: id]` | `[TEAM_SESSION: team-10-session-2026-02-19-001]` | Groups all agents in one team run |
| **Agent Session** | `[AGENT_SESSION: id]` | `[AGENT_SESSION: agent-01-neon-verify-2026-02-19-001]` | Identifies a single agent's work |

### Format for cognify() calls
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-10-session-2026-02-19-001] [AGENT_SESSION: agent-01-neon-verify-2026-02-19-001] [AGENT: agent-01-neon-verify] [TEAM: 10] [TIMESTAMP: 2026-02-19T14:30:00Z]\n\nAgent 01 findings: Neon DB has 6520 transactions. Admin user verified. All route limits removed."
)
```

### Format for search() queries — filtering by hierarchy
```
# Find all memories from a specific team session
mcp__cognee-agent-teams__search(search_query="[TEAM_SESSION: team-10-session-2026-02-19-001] transaction fixes", search_type="CHUNKS")

# Find all memories from a specific project
mcp__cognee-agent-teams__search(search_query="[PROJECT: goldledger-v1] database migration", search_type="GRAPH_COMPLETION")

# Find a specific agent's findings
mcp__cognee-agent-teams__search(search_query="[AGENT_SESSION: agent-03-full-audit] route limits", search_type="CHUNKS")
```

### ID Naming Convention
- **Project ID**: `{project-name}-v{version}` → `goldledger-v1`
- **Team Session ID**: `team-{N}-session-{YYYY-MM-DD}-{NNN}` → `team-10-session-2026-02-19-001`
- **Agent Session ID**: `agent-{NN}-{role}-{YYYY-MM-DD}-{NNN}` → `agent-01-neon-verify-2026-02-19-001`

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
mcp__cognee-agent-teams__search(search_query="JWT verification logic", search_type="CODE")
mcp__cognee-agent-teams__search(search_query="tenantAuthMiddleware", search_type="CODE")
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
