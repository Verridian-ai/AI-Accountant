# GoldLedger Hive Memory — Infrastructure Guide

**Status**: Infrastructure ready — awaiting Docker startup and cloud bootstrap
**API Key**: `13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff` (Cognee Cloud Premium)
**Architecture**: Local Docker (speed) + Cloud (persistence) — dual mode

---

## What Is Hive Memory?

Every agent team session is currently isolated — agents don't know what previous teams
discovered, fixed, or decided. Hive Memory solves this by giving every agent team a
shared Cognee knowledge graph they can read from and write to.

**Before Hive Memory**: Each team starts from scratch, re-discovers the same issues,
makes the same mistakes, re-reads the same files.

**After Hive Memory**: Each team starts by querying what previous teams learned.
The collective intelligence compounds across every session.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Team Sessions                          │
│  goldledger-ui-fix  goldledger-plugins  goldledger-sweep  ...   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MCP (http://localhost:8001/mcp)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              Local Docker Stack (hive-memory/)                  │
│                                                                 │
│  hive-mcp:8001 ──► hive-cognee:8000 ──► hive-postgres:5433     │
│  (MCP server)      (knowledge graph)    (pgvector embeddings)   │
│                         │                                       │
│                    hive-redis:6380                              │
│                    (session cache)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Sync (future)
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              Cognee Cloud (api.cognee.ai)                       │
│              Premium subscription — always-on backup            │
│              API Key: 13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start Local Docker Stack

```bash
# From WSL or PowerShell
cd '/mnt/c/Users/Danie/Desktop/CBA Statements Parse'
docker compose -f hive-memory/docker-compose.hive.yml up -d

# Check health (wait 30-60s for startup)
docker compose -f hive-memory/docker-compose.hive.yml ps
curl http://localhost:8000/api/v1/settings  # cognee backend
curl http://localhost:8001/health           # MCP server
```

### Step 2: Seed Local Instance

```bash
# Install dependencies
pip install httpx cognee

# Run local bootstrap
python hive-memory/bootstrap-local.py
```

### Step 3: Seed Cloud Instance

```bash
# Install cloud SDK
pip install cogwit-sdk

# Run cloud bootstrap (creates 15 datasets on Cognee Cloud)
python hive-memory/bootstrap-cloud.py
```

### Step 4: Wire MCP into Claude Code

The `.mcp.json` file is already created at the project root. Claude Code will
automatically detect it and offer to enable the MCP servers.

To manually add:
```bash
# Local (preferred — fast)
claude mcp add --transport http cognee-hive-local http://localhost:8001/mcp -s project

# Cloud (backup)
claude mcp add --transport http cognee-hive-cloud https://api.cognee.ai/mcp -s project
```

### Step 5: Verify in Claude Code

```
/gl-hive rules
/gl-hive search "what are the code quality rules"
/gl-hive status
```

---

## Hive Memory Datasets (15 total)

### Agent Team Knowledge
| Dataset | Purpose |
|---------|---------|
| `hive_agent_decisions` | Architectural decisions, rationale, tradeoffs |
| `hive_agent_patterns` | Successful workflows, orchestration patterns |
| `hive_agent_errors` | Bugs found, root causes, anti-patterns |
| `hive_agent_commits` | Commit summaries, what changed and why |

### Codebase Knowledge
| Dataset | Purpose |
|---------|---------|
| `hive_codebase_architecture` | System design, module boundaries |
| `hive_codebase_routes` | API endpoints, middleware, contracts |
| `hive_codebase_schema` | DB schema, migrations, table relationships |
| `hive_codebase_services` | Service implementations, business logic |
| `hive_codebase_types` | TypeScript types, interfaces |

### Audit & Quality
| Dataset | Purpose |
|---------|---------|
| `hive_audit_findings` | Issues found during audits |
| `hive_audit_fixes` | Fixes applied, verification results |
| `hive_quality_rules` | Code quality rules, enforcement patterns |

### Domain Knowledge
| Dataset | Purpose |
|---------|---------|
| `hive_gst_rules` | ATO GST rules, BAS calculations |
| `hive_tax_knowledge` | Tax brackets, deductions, compliance |
| `hive_financial_patterns` | Transaction patterns, merchant intelligence |

---

## MCP Tools Available to Agents

| Tool | What it does |
|------|-------------|
| `cognify` | Store new knowledge (text → knowledge graph) |
| `search` | Query the knowledge graph |
| `codify` | Index source code into CODE search type |
| `save_interaction` | Store a user-agent exchange as a rule |
| `get_developer_rules` | Retrieve all stored developer rules |
| `list_data` | List all datasets and their contents |
| `delete` | Remove specific data items |
| `prune` | Clear all memory (use with caution) |

---

## Agent Team Integration Protocol

### For Future Agent Teams — Add This to Every Task File

```markdown
## Hive Memory Protocol

### At Session Start (MANDATORY)
Before starting any work, query hive memory:
```
/gl-hive search "what issues exist in [your area]?"
/gl-hive search "what patterns work for [your task type]?"
/gl-hive rules
```

### During Work
When you discover something important:
```
/gl-hive store "Root cause: [description]. Fix: [description]. File: [path]" hive_agent_errors
```

### At Session End (MANDATORY)
Store your learnings before messaging DONE:
```
/gl-hive store "[summary of decisions made]" hive_agent_decisions
/gl-hive store "[summary of fixes applied]" hive_audit_fixes
/gl-hive store "[patterns that worked]" hive_agent_patterns
```
```

### For Orchestration Prompts — Add This Section

```markdown
## HIVE MEMORY RULES (ALL TEAMMATES)
1. At session start: run `/gl-hive search "[your task area]"` before reading any files
2. When you find a bug root cause: run `/gl-hive store "Root cause: X. Fix: Y" hive_agent_errors`
3. When you complete a task: run `/gl-hive store "[summary]" hive_agent_decisions`
4. Before messaging DONE: store all learnings to hive memory
```

---

## Slash Commands

### `/gl-hive search "query"`
Query the knowledge graph. Uses GRAPH_COMPLETION + CHUNKS.
```
/gl-hive search "why are transactions not showing in the UI"
/gl-hive search "what TypeScript errors were fixed"
/gl-hive search "what are the GST rules for supermarkets"
```

### `/gl-hive store "content" dataset_name`
Write new knowledge to hive memory.
```
/gl-hive store "Fixed: X-Tenant-Id header was missing from getAuthHeaders()" hive_audit_fixes
/gl-hive store "Pattern: always create a *Route wrapper for lazy-loaded components" hive_agent_patterns
```

### `/gl-hive codify path/`
Index source code for CODE search type.
```
/gl-hive codify server/src/routes/
/gl-hive codify server/src/schema/
/gl-hive codify client/src/features/
```

### `/gl-hive rules`
Get all stored developer rules and patterns.

### `/gl-hive status`
List all datasets and content counts.

---

## Local vs Cloud

| Feature | Local Docker | Cognee Cloud |
|---------|-------------|-------------|
| Speed | ~5ms | ~200ms |
| Persistence | Docker volume | Always-on |
| Cost | Free | Premium subscription |
| Availability | Requires Docker running | Always available |
| Sync | Manual | N/A |
| Best for | Active development | Backup, sharing |

**Recommendation**: Use local for active agent sessions. Cloud is the persistent backup.

---

## Maintenance

### Start/Stop Local Stack
```bash
# Start
docker compose -f hive-memory/docker-compose.hive.yml up -d

# Stop (data preserved in volumes)
docker compose -f hive-memory/docker-compose.hive.yml down

# Wipe and restart fresh
docker compose -f hive-memory/docker-compose.hive.yml down -v
docker compose -f hive-memory/docker-compose.hive.yml up -d
python hive-memory/bootstrap-local.py
```

### Check Status
```bash
docker compose -f hive-memory/docker-compose.hive.yml ps
curl http://localhost:8000/api/v1/settings
curl http://localhost:8001/health
```

### View Logs
```bash
docker compose -f hive-memory/docker-compose.hive.yml logs hive-cognee -f
docker compose -f hive-memory/docker-compose.hive.yml logs hive-mcp -f
```

---

## Files Created

```
hive-memory/
├── docker-compose.hive.yml   — Local Docker stack (cognee + mcp + postgres + redis)
├── bootstrap-cloud.py        — Create 15 datasets on Cognee Cloud
├── bootstrap-local.py        — Seed local Docker instance
└── HIVE-MEMORY-GUIDE.md      — This file

.mcp.json                     — MCP server config (auto-detected by Claude Code)

.claude/
├── agents/gl-hive-memory.md  — Hive memory agent skill definition
└── commands/gl-hive.md       — /gl-hive slash command
```

---

## Environment Variables Required

Add to `server/.env`:
```bash
# Cognee Cloud
COGWIT_API_KEY=13ac8b717cd9f072a79f703455546a8334c5e27f2f3238ff

# Local Cognee (Docker)
COGNEE_API_URL=http://localhost:8000
COGNEE_MCP_URL=http://localhost:8001/mcp

# LLM for local Cognee (uses existing OpenRouter key)
# OPENROUTER_API_KEY=<already set>
```
