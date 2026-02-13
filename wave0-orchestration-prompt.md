# Wave 0: Meta-Planning Agent Team — Orchestration Prompt

You are the **Meta-Planning Team Lead** for GoldLedger. You coordinate **16 specialized agents** across 4 phases to produce comprehensive implementation plans, orchestration prompts, agent task files, and launch scripts for ALL subsequent implementation waves (Waves 11–24).

## Mission

The existing `docs/Agent planning chat.md` contains detailed plans for Waves 1–10, but:

- **Wave 11** was CUT OFF mid-specification (line 1314 — missing API endpoints, UI components, Cognee integration, testing criteria)
- **Waves 12–17** were NEVER written
- **Waves 18–24** are NEW requirements not in the original plan

Your team must produce complete, executable plans for **14 waves** (Waves 11–24), each with:

1. An orchestration prompt (`waveN-orchestration-prompt.md`)
2. 10 agent task files (`waveN-agent-tasks/01-*.md` through `10-*.md`)
3. A launch script (`launch-waveN.sh`)

## Wave Manifest — What Must Be Planned

### Completing the Original Plan

| Wave | Name | Phase | Status |
|------|------|-------|--------|
| 11 | Inventory & Bank Reconciliation | Phase 4: Xero/MYOB Parity | **INCOMPLETE** — finish spec |
| 12 | Fixed Assets & Multi-Entity | Phase 4 | **NOT STARTED** |
| 13 | Financial Reporting & Budgeting | Phase 4 | **NOT STARTED** |
| 14 | AI OCR & Payment Matching | Phase 5: Agentic Integration | **NOT STARTED** |
| 15 | Predictive Analytics & Compliance | Phase 5 | **NOT STARTED** |
| 16 | Custom DataPoints & Relationships | Phase 6: Cognee Knowledge Graph | **NOT STARTED** |
| 17 | Temporal Queries & Cross-Module Intelligence | Phase 6 | **NOT STARTED** |

### NEW Requirements (User-Requested)

| Wave | Name | Description |
|------|------|-------------|
| 18 | Admin Backend & Agent Dashboard | Full graphical admin interface: agent control panel, system health, user management at provider level |
| 19 | 3D Cognee Knowledge Graph Visualization | Interactive 3D graph viewer (Three.js/force-graph) showing all nodes, edges, relationships in Cognee |
| 20 | CDR PRD Harvester & Open Banking | Crawl Australian CDR Register API, fetch all loan/banking products, normalize, cache, compare |
| 21 | Market Intelligence & Last 30 Days Skill | Integrate <https://github.com/mvanhorn/last30days-skill> for financial market intelligence agent |
| 22 | Agent Architecture Upgrade | Evaluate TypeScript agents vs Copilot SDK vs Claude Agent SDK; implement best option |
| 23 | Trading/Investment Data & Universal Knowledge | Non-personal shared Cognee knowledge graph for market data, rates, economic indicators |
| 24 | User Management & Multi-Tenant System | System-level user management, user self-service accounts, role-based access, tenant isolation |

## Team Structure — 16 Agents, 4 Phases

### Phase A: Research (10 Researchers — Parallel)

Fast, focused context gathering. Each researcher produces a structured research report in `wave0-research/`.

| Agent | ID | Role | Output File |
|-------|----|------|-------------|
| 1 | R01 | Codebase Architecture Researcher | `wave0-research/R01-codebase-architecture.md` |
| 2 | R02 | Cognee Capabilities & Config Researcher | `wave0-research/R02-cognee-capabilities.md` |
| 3 | R03 | CDR Open Banking API Researcher | `wave0-research/R03-cdr-open-banking.md` |
| 4 | R04 | Last 30 Days Skill Researcher | `wave0-research/R04-last30days-skill.md` |
| 5 | R05 | Agent SDK Comparison Researcher | `wave0-research/R05-agent-sdk-comparison.md` |
| 6 | R06 | Existing Plan Gap Analyzer | `wave0-research/R06-plan-gaps.md` |
| 7 | R07 | Frontend & UI Architecture Researcher | `wave0-research/R07-frontend-architecture.md` |
| 8 | R08 | Database Schema Gap Researcher | `wave0-research/R08-database-schema-gaps.md` |
| 9 | R09 | Docker & Infrastructure Researcher | `wave0-research/R09-docker-infrastructure.md` |
| 10 | R10 | External Data & Market Intelligence Researcher | `wave0-research/R10-external-data-sources.md` |

### Phase B: Synthesis (1 Writer — After Phase A)

Compiles all research into comprehensive wave plans.

| Agent | ID | Role | Output |
|-------|----|------|--------|
| 11 | W01 | Plan Synthesizer & Document Writer | All 14 wave plan directories + master plan document |

### Phase C: Debate & Verification (5 Debaters — After Phase B, Parallel)

Each debater reviews ALL plans from a specific angle and produces critique reports.

| Agent | ID | Role | Output File |
|-------|----|------|-------------|
| 12 | D01 | Architecture Devil's Advocate | `wave0-reviews/D01-architecture-review.md` |
| 13 | D02 | Security & Compliance Reviewer | `wave0-reviews/D02-security-review.md` |
| 14 | D03 | Scalability & Performance Reviewer | `wave0-reviews/D03-scalability-review.md` |
| 15 | D04 | Integration & Dependencies Reviewer | `wave0-reviews/D04-integration-review.md` |
| 16 | D05 | Completeness & Quality Reviewer | `wave0-reviews/D05-completeness-review.md` |

### Phase D: Final Revision (W01 again — After Phase C)

W01 incorporates all debate feedback and produces final, polished plans.

## Sub-Agent Delegation Protocol

Every agent in this team can and SHOULD spawn sub-agents (teammates) within their own session to parallelize work. This is a critical capability — use it aggressively.

### How to Delegate

Each agent can spawn sub-agents for:

- **Discovery sub-agents**: Spawn teammates to read multiple files in parallel, search the codebase, or fetch external documentation simultaneously
- **Planning sub-agents**: Spawn teammates to draft different sections of output in parallel, then merge results
- **Verification sub-agents**: Spawn teammates to cross-check findings, validate assumptions, or audit output quality

### Delegation Rules

1. **Spawn early, spawn often**: If your task involves reading 5+ files, spawn sub-agents to read them in parallel rather than sequentially
2. **Divide by domain**: Split research across logical boundaries (e.g., one sub-agent for backend files, another for frontend files, another for config files)
3. **Merge before writing**: Sub-agents report findings back to the parent agent, who synthesizes into the final output file
4. **Sub-agents inherit context**: Pass your task file content and relevant context to each sub-agent so they understand the mission
5. **Sub-agent output**: Sub-agents write to temporary scratch files (e.g., `wave0-research/.scratch-R01-backend.md`) that the parent agent reads and deletes after merging
6. **No cross-agent delegation**: Sub-agents only work within their parent agent's scope — R01's sub-agents don't write to R02's output

### Example Delegation Pattern

```
Agent R01 (Codebase Architecture Researcher):
  ├── Sub-agent A: Read all 11 agent files in server/src/services/claude/agents/
  ├── Sub-agent B: Read server/src/index.ts and map all API endpoints
  ├── Sub-agent C: Read schema.ts and postgres-schema.ts, produce gap table
  └── R01 merges all sub-agent findings into wave0-research/R01-codebase-architecture.md
```

## Agent Skills Framework

Each agent has a defined skill set. Skills determine what the agent is capable of and what tools/approaches they should use. See each agent's task file for their full skill manifest.

### Skill Categories

| Category | Description | Used By |
|----------|-------------|---------|
| **Codebase Analysis** | Read, parse, and map source code structure | R01, R05, R06, R07, R08 |
| **API Research** | Fetch and analyze external API documentation | R03, R04, R10 |
| **Configuration Audit** | Analyze Docker, env vars, infrastructure config | R02, R09 |
| **Architecture Design** | Design systems, propose schemas, plan services | W01, D01 |
| **Security Analysis** | Identify vulnerabilities, compliance gaps | D02 |
| **Performance Modeling** | Estimate load, identify bottlenecks, project scaling | D03 |
| **Dependency Mapping** | Trace cross-system dependencies, detect conflicts | D04, R06 |
| **Quality Assurance** | Verify completeness, check standards compliance | D05 |
| **Document Synthesis** | Compile research into structured specifications | W01 |
| **Critical Review** | Challenge assumptions, propose alternatives | D01-D05 |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel work | ALL agents |

## Coordination Rules

1. **Phase gates**: Phase B cannot start until ALL 10 researchers complete. Phase C cannot start until W01 completes. Phase D cannot start until ALL 5 debaters complete.
2. **Signal completion**: Each agent creates `.agent-done-{ID}` (e.g., `.agent-done-R01`, `.agent-done-W01`, `.agent-done-D03`).
3. **Research directory lock**: Only researchers (R01-R10) write to `wave0-research/`.
4. **Review directory lock**: Only debaters (D01-D05) write to `wave0-reviews/`.
5. **Plan directory lock**: Only W01 writes to `wave{N}-orchestration-prompt.md`, `wave{N}-agent-tasks/`, and `launch-wave{N}.sh`.
6. **No file conflicts**: Each researcher writes ONLY to their assigned output file.
7. **Sub-agent scratch files**: Sub-agents may write to `wave0-research/.scratch-*` or `wave0-reviews/.scratch-*` — parent agents clean these up after merging.
8. **Reference existing patterns**: All output must follow the patterns in `orchestration-prompt.md` and `agent-tasks/01-tax-agents-builder.md`.
9. **10-point spec format**: Every wave plan must include ALL of these for each wave:
   - Dependencies & estimated complexity
   - Agent team composition (10 agents per wave)
   - Database schema changes (both SQLite AND PostgreSQL)
   - API endpoints (method, path, description)
   - UI components (file paths, component names)
   - Cognee integration (new datasets, index queries)
   - Testing criteria (specific assertions)
   - Migration file path
   - New Claude agents (if any) following ClaudeAgent<TInput, TOutput> pattern
   - Coordination rules specific to that wave

## Current Codebase State (for researchers)

- **11 Claude agents**: statement_parser, transaction_categorizer, gst_calculator, account_reconciler, budget_analyzer, cross_account_tracer, merchant_intelligence, payroll_agent, tax_strategy, personal_tax_claims, financial_planner
- **Base class**: `server/src/services/claude/base-agent.ts` — `ClaudeAgent<TInput, TOutput>` (216 lines)
- **Types**: `server/src/services/claude/types.ts` — All agent I/O contracts (501 lines)
- **Orchestrator**: `server/src/services/claude/orchestrator.ts` — Agent registry (253 lines)
- **SQLite schema**: `server/src/schema.ts` — 52 tables (~1,078 lines)
- **PostgreSQL schema**: `server/src/db/postgres-schema.ts` — 21 tables (~623 lines) — **31 tables MISSING**
- **API server**: `server/src/index.ts` — Hono server, ~127 endpoints (~4,708 lines)
- **Agent routes**: `server/src/routes/agents.ts` — Only 4 of 11 agents have HTTP routes
- **Cognee client**: `server/src/services/cognee_client.ts` — Single admin auth, 648 lines
- **Cognee tools**: `server/src/services/claude/cognee-tools.ts` — Agent-facing wrapper, 126 lines
- **Docker**: 5 services (postgres, cognee, redis, server, client) in `docker-compose.yml`
- **Frontend**: React 19, shadcn/ui, feature-based folders, 9 tabs
- **Chat**: `POST /api/chat` — DISCONNECTED from agents, uses generic aiService
- **Cognee multi-user**: DISABLED (`ENABLE_BACKEND_ACCESS_CONTROL=false`)
- **Existing plan**: `docs/Agent planning chat.md` — Waves 1-10 complete, Wave 11 cut off at line 1314

## Key Reference Files

| File | Purpose | Read By |
|------|---------|---------|
| `orchestration-prompt.md` | Template for wave orchestration prompts | W01 |
| `agent-tasks/01-tax-agents-builder.md` | Template for agent task files | W01 |
| `launch-goldledger-team.sh` | Template for launch scripts | W01 |
| `docs/Agent planning chat.md` | Existing wave plans (1-10) + incomplete Wave 11 | R06, W01 |
| `docs/COMPREHENSIVE_ARCHITECTURE.md` | Full architecture vision | R01, R02, W01 |
| `server/src/services/claude/base-agent.ts` | Agent base class pattern | R01, R05, W01 |
| `server/src/services/claude/types.ts` | Agent I/O type contracts | R01, W01 |
| `server/src/schema.ts` | SQLite schema (source of truth) | R08, W01 |
| `server/src/db/postgres-schema.ts` | PostgreSQL schema (incomplete) | R08, W01 |
| `docker-compose.yml` | Infrastructure config | R09, W01 |
| `server/src/services/cognee_client.ts` | Cognee HTTP client | R02, W01 |
| `client/src/App.tsx` | Main React app with tab navigation | R07, W01 |
| `client/src/api.ts` | Client API layer | R07, W01 |

## Execution Priority Order

```
Phase A (Parallel):  R01 + R02 + R03 + R04 + R05 + R06 + R07 + R08 + R09 + R10
Phase B (After A):   W01
Phase C (After B):   D01 + D02 + D03 + D04 + D05
Phase D (After C):   W01 (revision pass)
```

## Output Verification Checklist

Before marking Wave 0 complete, verify:

- [ ] 14 wave directories exist (wave11 through wave24)
- [ ] Each wave has: `waveN-orchestration-prompt.md`, `waveN-agent-tasks/` (10 files), `launch-waveN.sh`
- [ ] Wave 11 spec is COMPLETE (API endpoints, UI components, Cognee integration, testing criteria)
- [ ] All wave plans follow the 10-point spec format
- [ ] All launch scripts are executable and follow `launch-goldledger-team.sh` pattern
- [ ] All agent task files follow `agent-tasks/01-tax-agents-builder.md` pattern
- [ ] Cross-wave dependencies are documented and consistent
- [ ] PostgreSQL schema gap (31 missing tables) is addressed in early waves
- [ ] New AgentType entries are planned for new Claude agents
- [ ] Master plan document `docs/wave0-master-plan.md` summarizes all 24 waves

## START THE TEAM NOW

Spawn all 16 teammates and begin coordinating their work according to the phase execution order above. Read each agent's task file from `wave0-agent-tasks/` for detailed assignments. Researchers go first — all 10 in parallel.
