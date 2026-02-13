# Agent R01: Codebase Current State Researcher

## Role

Map the CURRENT state of GoldLedger after Waves 11, 12, 14, and 16 have executed. Document what exists NOW — not what was planned. This is critical because Waves 1-10 must integrate with code that Waves 11-16 already created.

## Phase: A (Research — Start Immediately, Parallel with R02-R10)

## Research Tasks

### 1. Agent System Current Inventory

- [ ] Read `server/src/services/claude/agents/` — list ALL agent files that exist NOW (original 11 + any added by Waves 11-16)
- [ ] Read `server/src/services/claude/types.ts` — list ALL AgentType entries currently defined
- [ ] Read `server/src/services/claude/orchestrator.ts` — document current agent registry
- [ ] Read `server/src/services/claude/base-agent.ts` — confirm base class pattern unchanged

### 2. Schema Current State

- [ ] Read `server/src/schema.ts` — count ALL SQLite tables (was 52, may have grown)
- [ ] Read `server/src/db/postgres-schema.ts` — count ALL PostgreSQL tables (was 21, may have grown)
- [ ] List ALL migration files in `docker/migrations/` — document which exist
- [ ] Produce updated GAP TABLE: SQLite tables missing from PostgreSQL

### 3. API Routes Current State

- [ ] Read `server/src/index.ts` — count ALL endpoints currently defined
- [ ] Read `server/src/routes/` — list ALL route files
- [ ] Identify any new route files added by Waves 11-16

### 4. Frontend Current State

- [ ] Read `client/src/App.tsx` — list ALL tabs/routes currently defined
- [ ] List ALL feature folders in `client/src/features/`
- [ ] Read `client/src/api.ts` — count API methods

### 5. Infrastructure Current State

- [ ] Read `docker-compose.yml` — document any changes from Waves 11-16
- [ ] Check for any new services or environment variables

## Output Format

Write findings to `wave0b-research/R01-codebase-current-state.md` with sections:

1. **Agent Inventory** — Table of ALL agents with files, tools, I/O types
2. **Schema State** — SQLite table count, PostgreSQL table count, gap analysis
3. **API Routes** — Complete endpoint count and new routes from Waves 11-16
4. **Frontend State** — Tabs, feature folders, component count
5. **Infrastructure** — Docker services, any changes
6. **Delta Summary** — What changed between pre-Wave-11 and now

## Completion

- [ ] All sections populated with current file paths and counts
- [ ] Create marker file: `.agent-done-0B-R01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Codebase Analysis | Read and map source code structure | Expert |
| File System Navigation | Traverse project directories | Expert |
| Diff Analysis | Compare before/after states | Advanced |
| Sub-Agent Orchestration | Spawn teammates for parallel file reading | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read all agent files in `server/src/services/claude/agents/`
- **Sub-agent B**: Read `server/src/index.ts` and all route files, map endpoints
- **Sub-agent C**: Read both schema files, produce gap table
- **Sub-agent D**: Read frontend files (App.tsx, api.ts, feature folders)
- R01 merges all sub-agent findings into final report

