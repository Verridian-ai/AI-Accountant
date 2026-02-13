# Agent R01: Codebase Architecture Researcher

## Role

Map the complete current architecture of GoldLedger — all services, agents, routes, schemas, and their interconnections. Produce a structured inventory that W01 can use to plan new waves.

## Phase: A (Research — Start Immediately, Parallel with R02-R10)

## Research Tasks

### 1. Agent System Inventory

- [ ] Read `server/src/services/claude/base-agent.ts` — document the ClaudeAgent<TInput, TOutput> abstract class pattern (constructor, systemPrompt, tools, toolHandlers, invoke method, circuit breaker logic)
- [ ] Read `server/src/services/claude/types.ts` — list ALL 11 AgentType entries and their I/O interfaces with field names
- [ ] Read `server/src/services/claude/orchestrator.ts` — document how agents are registered, invoked, and what methods exist (invoke, processStatement, analyze, isEnabled)
- [ ] Read `server/src/services/claude/config.ts` — document token budgets and model assignments per agent
- [ ] Read ALL files in `server/src/services/claude/agents/` — for each agent, document: name, tools[], systemPrompt summary, what services it calls

### 2. Service Layer Inventory

- [ ] List ALL service files in `server/src/services/` — for each: class name, key methods, what it imports
- [ ] Document the Python agent system in `server/src/services/orchestrator/` — how it differs from Claude agents
- [ ] Document `server/src/services/ai.ts` — the aiService used by chat (disconnected from agents)

### 3. Route Inventory

- [ ] Read `server/src/index.ts` — list ALL API endpoints (method, path, handler summary)
- [ ] Read `server/src/routes/agents.ts` — document which 4 agents have HTTP routes and which 7 don't
- [ ] Identify any other route files in `server/src/routes/`

### 4. Schema Inventory

- [ ] Read `server/src/schema.ts` — list ALL 52 SQLite tables with column names
- [ ] Read `server/src/db/postgres-schema.ts` — list ALL 21 PostgreSQL tables
- [ ] Produce a GAP TABLE showing which 31 tables exist in SQLite but not PostgreSQL

### 5. Infrastructure Inventory

- [ ] Read `docker-compose.yml` — document all 5 services, ports, environment variables
- [ ] Document the Cognee service configuration (graph store, vector store, LLM, embeddings)

## Output Format

Write findings to `wave0-research/R01-codebase-architecture.md` with these sections:

1. **Agent System** — Table of all 11 agents with tools, I/O types, model, token budget
2. **Service Layer** — Table of all services with class names, key methods
3. **API Routes** — Complete endpoint table (method, path, handler)
4. **Database Schema** — SQLite tables, PostgreSQL tables, gap analysis
5. **Infrastructure** — Docker services, ports, key config
6. **Architecture Diagram** — Text-based dependency graph showing agent → service → database flow

## Completion

- [ ] All sections populated with specific file paths and line numbers
- [ ] Create marker file: `.agent-done-R01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **TypeScript/JavaScript Code Reading** | Parse TS source files, understand generics, inheritance, decorators | Expert |
| **Agent Pattern Recognition** | Identify ClaudeAgent inheritance, tool registration, I/O contracts | Expert |
| **API Endpoint Mapping** | Extract route definitions from Hono server (app.get/post/patch/delete) | Expert |
| **Database Schema Analysis** | Read Drizzle ORM table definitions, compare SQLite vs PostgreSQL | Expert |
| **Service Dependency Tracing** | Follow import chains to map service → agent → route → database flow | Advanced |
| **Docker Configuration Reading** | Parse docker-compose.yml, understand service networking, env vars | Advanced |
| **Architecture Diagramming** | Produce text-based dependency graphs and architecture diagrams | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel file reading | Advanced |

## Sub-Agent Delegation Plan

You SHOULD spawn sub-agents to parallelize this research. Recommended delegation:

```
R01 (Codebase Architecture Researcher):
├── Sub-agent A: Agent System Deep Dive
│   ├── Read all 11 files in server/src/services/claude/agents/
│   ├── Read base-agent.ts, types.ts, config.ts, orchestrator.ts
│   └── Output: wave0-research/.scratch-R01-agents.md (agent inventory table)
│
├── Sub-agent B: API & Route Mapping
│   ├── Read server/src/index.ts (all ~127 endpoints)
│   ├── Read server/src/routes/agents.ts and any other route files
│   └── Output: wave0-research/.scratch-R01-routes.md (complete endpoint table)
│
├── Sub-agent C: Schema & Database Analysis
│   ├── Read server/src/schema.ts (52 SQLite tables)
│   ├── Read server/src/db/postgres-schema.ts (21 PostgreSQL tables)
│   └── Output: wave0-research/.scratch-R01-schema.md (gap analysis table)
│
├── Sub-agent D: Service Layer & Infrastructure
│   ├── Read all files in server/src/services/ (non-claude)
│   ├── Read docker-compose.yml
│   └── Output: wave0-research/.scratch-R01-services.md (service inventory)
│
└── R01 Parent: Merge all sub-agent outputs
    ├── Read all .scratch-R01-*.md files
    ├── Synthesize into architecture diagram
    ├── Write final wave0-research/R01-codebase-architecture.md
    └── Delete scratch files
```

### Delegation Rules for R01

- Sub-agents write ONLY to `wave0-research/.scratch-R01-*.md` files
- Parent R01 is responsible for merging and producing the final output
- Sub-agents should include file paths and line numbers in their findings
- If a sub-agent finds something unexpected, note it for the parent to investigate

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
