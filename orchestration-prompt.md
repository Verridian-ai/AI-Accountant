# GoldLedger Agent Team — Orchestration Prompt

You are the **Team Lead** for the GoldLedger Multi-Phase Enhancement. You coordinate 10 specialized agents to transform GoldLedger from a bank statement parser into a comprehensive Australian financial intelligence platform.

## Architecture References
- **Master architecture**: `docs/COMPREHENSIVE_ARCHITECTURE.md` (sections 22-26)
- **Implementation plan**: `docs/Curretn Claudecode plan.md` (12 phases, PART A)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (4 services: postgres, cognee, server, client)

## Current State
- 8 Claude agents (statement_parser, transaction_categorizer, gst_calculator, account_reconciler, budget_analyzer, cross_account_tracer, merchant_intelligence, payroll_agent)
- SQLite + PostgreSQL dual schema (Drizzle ORM)
- React frontend with feature-based folders (accounts, analytics, bas, gst, tax, transfers)
- Cognee knowledge graph with Kuzu graph store
- 3 existing migrations (0009-0011)

## Team Structure — 10 Agents

### Agent 1: tax-agents-builder [PRIORITY: PHASE 1]
**Role**: Build 3 new Claude agents + tax return calculation engine
**Task file**: `agent-tasks/01-tax-agents-builder.md`
**Creates**: tax-strategy.ts, personal-tax-claims.ts, financial-planner.ts, tax-return.ts, tax-optimizer.ts
**Modifies**: types.ts (add 3 AgentType entries), config.ts (token budgets + models)
**Dependencies**: None — can start immediately

### Agent 2: docker-services-builder [PRIORITY: PHASE 1]
**Role**: Add Redis service to docker-compose.yml, create migration 0012
**Task file**: `agent-tasks/02-docker-services-builder.md`
**Creates**: docker/migrations/0012_tax_return_platform.sql
**Modifies**: docker-compose.yml (add redis), schema.ts, postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 3: database-migration-builder [DEPENDS ON: Agent 2]
**Role**: Update Drizzle ORM schemas with new tables and columns
**Task file**: `agent-tasks/03-database-migration-builder.md`
**Creates**: None (Agent 2 creates migration file)
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: Agent 2 must complete migration SQL first

### Agent 4: cognee-datasets-builder [DEPENDS ON: Agent 2]
**Role**: Configure Cognee datasets for tax strategies, loan products, economic data
**Task file**: `agent-tasks/04-cognee-datasets-builder.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/cognee_client.ts
**Dependencies**: Agent 2 must have Docker services ready

### Agent 5: loan-comparison-builder [PRIORITY: PHASE 2]
**Role**: Build loan calculator service and economic data feed service
**Task file**: `agent-tasks/05-loan-comparison-builder.md`
**Creates**: server/src/services/loan-calculator.ts, server/src/services/economic-data.ts
**Dependencies**: None — pure math + HTTP, can start immediately

### Agent 6: owner-equity-budget-builder [PRIORITY: PHASE 2]
**Role**: Build owner equity tracking and enhanced budgeting services
**Task file**: `agent-tasks/06-owner-equity-budget-builder.md`
**Creates**: server/src/services/owner-equity.ts, server/src/services/budget-enhanced.ts
**Dependencies**: Agent 2 (schema must exist for owner_equity_events table)

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 1, 5, 6]
**Role**: Wire ~28 new API routes in server/src/index.ts
**Task file**: `agent-tasks/07-api-endpoints-builder.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist before wiring routes

### Agent 8: ui-components-builder [DEPENDS ON: Agent 7]
**Role**: Build all new React frontend components
**Task file**: `agent-tasks/08-ui-components-builder.md`
**Creates**: 15+ new .tsx components across tax/, loans/, analytics/
**Modifies**: client/src/api.ts, client/src/App.tsx, TaxDashboard.tsx, AnalyticsDashboard.tsx
**Dependencies**: API routes must exist for type-safe client API layer

### Agent 9: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification plan (20 checks from Curretn Claudecode plan.md)
**Task file**: `agent-tasks/09-testing-validation-agent.md`
**Runs**: TypeScript compilation, curl tests, Docker health checks
**Dependencies**: All agents must complete their work

### Agent 10: documentation-agent [ONGOING]
**Role**: Keep docs/COMPREHENSIVE_ARCHITECTURE.md current-state markers updated
**Task file**: `agent-tasks/10-documentation-agent.md`
**Modifies**: docs/COMPREHENSIVE_ARCHITECTURE.md (sections 22-26 current-state markers)
**Dependencies**: Runs continuously, updates after each agent completes

## Coordination Rules

1. **No file conflicts**: Only ONE agent may modify a given file at a time. If two agents need the same file, the one listed first in dependencies goes first.
2. **Signal completion**: When an agent finishes, it must create a marker file: `.agent-done-{number}` (e.g., `.agent-done-01`). Dependent agents check for these markers.
3. **Schema lock**: Only Agent 2 and Agent 3 may touch schema.ts and postgres-schema.ts. Agent 3 waits for Agent 2.
4. **types.ts lock**: Only Agent 1 modifies server/src/services/claude/types.ts and config.ts.
5. **index.ts lock**: Only Agent 7 modifies server/src/index.ts.
6. **api.ts lock**: Only Agent 8 modifies client/src/api.ts.
7. **Pattern compliance**: All new agents MUST follow the pattern in payroll-agent.ts — extend ClaudeAgent<TInput, TOutput>, define systemPrompt, tools, toolHandlers.
8. **Docker-local**: Everything runs on local Docker. No cloud services, no external APIs except RBA/ABS public data.
9. **Dual schema**: Every table change must be applied to BOTH schema.ts (SQLite) AND postgres-schema.ts (PostgreSQL).
10. **Test before done**: Every agent must verify their work compiles: `cd server && npx tsc --noEmit`

## Execution Priority Order

```
Wave 1 (Parallel): Agent 1 + Agent 2 + Agent 5
Wave 2 (After Wave 1): Agent 3 + Agent 4 + Agent 6
Wave 3 (After Wave 2): Agent 7
Wave 4 (After Wave 3): Agent 8
Wave 5 (After Wave 4): Agent 9
Continuous: Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the wave execution order above. Read each agent's task file from `agent-tasks/` for detailed atomic tasks with file paths, line numbers, and before/after code snippets.
