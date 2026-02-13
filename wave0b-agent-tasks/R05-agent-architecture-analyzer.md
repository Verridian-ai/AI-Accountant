# Agent R05: Agent Architecture Analyzer

## Role

Analyze the current Claude agent architecture and plan how Waves 1-10 will extend it. Document the new agents needed, existing agents to modify, and the intent routing system that Wave 1 must build.

## Phase: A (Research — Start Immediately, Parallel with R01-R04, R06-R10)

## Research Tasks

### 1. Current Agent Architecture

- [ ] Read `server/src/services/claude/base-agent.ts` — document ClaudeAgent<TInput, TOutput> pattern
- [ ] Read `server/src/services/claude/types.ts` — list ALL AgentType entries and I/O interfaces
- [ ] Read `server/src/services/claude/orchestrator.ts` — document invoke(), processStatement(), analyze()
- [ ] Read `server/src/services/claude/config.ts` — document model assignments and token budgets
- [ ] Read ALL files in `server/src/services/claude/agents/` — for each: name, tools, system prompt summary

### 2. New Agents Required by Waves 1-10

From the planning doc, identify new agents:

- [ ] **Wave 1**: No new agents, but intent_router and agent_dispatcher services
- [ ] **Wave 4-6**: Enhanced `payroll_agent` with employee management tools
- [ ] **Wave 7**: New `invoice_agent` — customer/invoice CRUD, PDF generation
- [ ] **Wave 10**: New `accounts_payable_agent` — bill management, PO tracking

### 3. Agent Modifications Required

- [ ] **Wave 1**: `orchestrator.ts` needs `routeAndDispatch()` method with intent routing
- [ ] **Wave 2**: `base-agent.ts` needs streaming callback support in `invoke()`
- [ ] **Wave 2**: `transaction-categorizer.ts` and `gst-calculator.ts` need mutation tools
- [ ] **Wave 3**: All agents need session-aware Cognee integration

### 4. Intent Router Design

- [ ] Read the Python orchestrator (`server/src/services/orchestrator/orchestrator.ts`) — it has routing logic to port
- [ ] Document the intent classification categories: agent_invocation, direct_question, transaction_edit, batch_operation
- [ ] Map each intent to the correct agent

### 5. Agent Route Gaps

- [ ] Read `server/src/routes/agents.ts` — which 4 agents have HTTP routes
- [ ] List the 7 agents that need routes added in Wave 1
- [ ] Document the route pattern for new agent endpoints

## Output Format

Write findings to `wave0b-research/R05-agent-architecture.md` with:

1. **Current Agent Inventory** — Table of all agents with tools, I/O, model, routes
2. **New Agents** — Specs for invoice_agent and accounts_payable_agent
3. **Agent Modifications** — Per-wave changes to existing agents
4. **Intent Router Design** — Classification categories, agent mapping
5. **Route Gap Analysis** — Missing HTTP routes for 7 agents
6. **Type System Changes** — New AgentType entries, I/O interfaces needed

## Completion

- [ ] All agents documented with modification plans
- [ ] Create marker file: `.agent-done-0B-R05`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Agent Architecture | Design and analyze AI agent systems | Expert |
| TypeScript Analysis | Read and understand TypeScript patterns | Expert |
| API Design | Design HTTP route patterns | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read all 11+ agent files, document tools and system prompts
- **Sub-agent B**: Read orchestrator, types, config — document registry and routing
- **Sub-agent C**: Read Python orchestrator for routing logic to port
- **Sub-agent D**: Read routes/agents.ts and index.ts for route gaps
- R05 merges into complete agent architecture analysis

