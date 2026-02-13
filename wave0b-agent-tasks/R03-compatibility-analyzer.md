# Agent R03: Wave 11-24 Compatibility Analyzer

## Role

Analyze ALL already-created Wave 11-24 files to identify what they EXPECT from Waves 1-10. This is the most critical research task — Wave 1-10 plans must be backward-compatible with code that Waves 11-16 have already generated.

## Phase: A (Research — Start Immediately, Parallel with R01-R02, R04-R10)

## Research Tasks

### 1. Analyze Wave 11-16 Orchestration Prompts

For each completed/running wave, read the orchestration prompt and identify:

- [ ] `wave11-orchestration-prompt.md` — What "Current State (After Wave 10)" does it assume?
- [ ] `wave12-orchestration-prompt.md` — What agents, tables, services does it reference from 1-10?
- [ ] `wave13-orchestration-prompt.md` — What does it assume exists from earlier waves?
- [ ] `wave14-orchestration-prompt.md` — What invoice/customer tables does it reference?
- [ ] `wave16-orchestration-prompt.md` — What Cognee multi-user setup does it assume?
- [ ] `wave17-orchestration-prompt.md` — What does it assume from Wave 16 and earlier?

### 2. Analyze Wave 11-16 Agent Task Files

For each wave, scan ALL 10 task files for references to:

- [ ] Services/classes that Waves 1-10 should create (intent-router, agent-dispatcher, mutation-tools, etc.)
- [ ] Database tables that Waves 1-10 should create (employees, customers, invoices, suppliers, etc.)
- [ ] API endpoints that Waves 1-10 should create (/api/chat, /api/agents/*, /api/payroll/*, etc.)
- [ ] Cognee features that Wave 3 should enable (multi-user, sessions, DataPoints)

### 3. Analyze Wave 15, 18-24 Orchestration Prompts

- [ ] Read remaining wave orchestration prompts for any Wave 1-10 dependencies
- [ ] Document the full dependency chain from each wave back to Waves 1-10

### 4. Read Wave 0 Debate Reviews

- [ ] Read `wave0-reviews/D04-integration-review.md` — cross-wave dependency analysis
- [ ] Read `wave0-reviews/REVISION-LOG.md` — fixes that may affect Wave 1-10 plans
- [ ] Read `docs/wave0-master-plan.md` — master plan assumptions about Waves 1-10

## Output Format

Write findings to `wave0b-research/R03-compatibility-analysis.md` with:

1. **Per-Wave Assumptions** — What each Wave 11-24 assumes exists from 1-10
2. **Required Services** — List of services/classes that MUST be created by Waves 1-10
3. **Required Tables** — List of database tables that MUST exist before Waves 11+ work
4. **Required Endpoints** — API routes that Waves 11+ reference
5. **Required Cognee Config** — Cognee settings that must be enabled
6. **Conflict Risks** — Any potential conflicts between Wave 1-10 plans and existing Wave 11-16 code
7. **Backward Compatibility Rules** — Constraints W01 must follow

## Completion

- [ ] All wave orchestration prompts analyzed
- [ ] Create marker file: `.agent-done-0B-R03`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Dependency Mapping | Trace cross-system dependencies | Expert |
| Compatibility Analysis | Identify backward compatibility requirements | Expert |
| Conflict Detection | Find potential integration conflicts | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read Wave 11-12 orchestration prompts + all task files
- **Sub-agent B**: Read Wave 13-14 orchestration prompts + all task files
- **Sub-agent C**: Read Wave 15-19 orchestration prompts
- **Sub-agent D**: Read Wave 20-24 orchestration prompts + debate reviews
- R03 merges findings into compatibility matrix

