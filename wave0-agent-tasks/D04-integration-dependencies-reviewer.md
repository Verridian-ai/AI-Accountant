# Agent D04: Integration & Dependencies Reviewer

## Role

Verify ALL cross-wave dependencies, API contracts, and integration points. Ensure no wave makes assumptions about another wave's output that aren't guaranteed. Catch dependency cycles, missing interfaces, and contract mismatches.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for marker file: `.agent-done-W01`
Read ALL wave plans produced by W01.
Read R06's existing plan gap analysis.

## Review Tasks

### 1. Cross-Wave Dependency Verification

- [ ] Build a complete dependency graph for Waves 11-24
- [ ] Verify: Every dependency listed in a wave's "Dependencies" section actually exists
- [ ] Check: Are there HIDDEN dependencies not listed?
  - Wave 19 (3D Graph) depends on Wave 16 (Custom DataPoints) for rich graph data
  - Wave 22 (Agent Architecture) affects ALL subsequent waves
  - Wave 24 (Multi-Tenant) should arguably come BEFORE Wave 18 (Admin)
- [ ] Check: Are there circular dependencies?
- [ ] Verify: The wave ordering allows incremental value delivery

### 2. API Contract Consistency

- [ ] For each new API endpoint across Waves 11-24:
  - Does the request schema match what the frontend expects?
  - Does the response schema match what the frontend renders?
  - Are error responses consistent with existing patterns?
- [ ] Check: Are there endpoint naming conflicts?
  - Multiple waves adding routes to the same path prefix?
  - Conflicting parameter names?
- [ ] Verify: All new endpoints are added to `client/src/api.ts` in the correct wave

### 3. Agent I/O Contract Consistency

- [ ] For each new Claude agent:
  - Is the TInput interface complete? (Does it have all fields the agent needs?)
  - Is the TOutput interface useful? (Does it have all fields the consumer needs?)
  - Are the types added to `server/src/services/claude/types.ts` in the correct wave?
- [ ] Check: Do any agents share tools that could conflict?
- [ ] Verify: The orchestrator is updated to register new agents in the correct wave

### 4. Database Schema Dependencies

- [ ] Verify: Tables are created BEFORE they're referenced by services
- [ ] Check: Foreign key references point to tables that exist at that wave
- [ ] Verify: Migration numbering is sequential with no gaps
- [ ] Check: Are there schema changes that break existing functionality?
- [ ] Verify: Both SQLite AND PostgreSQL schemas are updated in the same wave

### 5. Cognee Dataset Dependencies

- [ ] Verify: Cognee datasets are created BEFORE agents try to query them
- [ ] Check: Dataset names are unique and don't conflict
- [ ] Verify: The COGNEE_DATASETS constant is updated in the correct wave
- [ ] Check: Universal datasets (Wave 23) vs personal datasets — are they properly separated?

### 6. Frontend Integration Points

- [ ] Verify: New tabs are added to TabId type in the correct wave
- [ ] Check: New feature folders don't conflict with existing ones
- [ ] Verify: Shared components (if any) are created before they're used
- [ ] Check: Are there UI components that depend on API endpoints from a different wave?

### 7. Infrastructure Dependencies

- [ ] Verify: Docker service changes happen before services that depend on them
- [ ] Check: Environment variables are added before code that reads them
- [ ] Verify: Redis connection to Cognee is established before caching features are used
- [ ] Check: CDR harvester scheduling depends on what infrastructure?

## Output Format

Write findings to `wave0-reviews/D04-integration-review.md` with these sections:

1. **Dependency Graph** — Complete visual dependency map (text-based)
2. **Dependency Issues** — Missing, hidden, or circular dependencies
3. **API Contract Issues** — Mismatches, conflicts, missing endpoints
4. **Agent Contract Issues** — I/O type problems, registration gaps
5. **Schema Dependencies** — Table ordering, FK issues, migration gaps
6. **Cognee Dependencies** — Dataset ordering, naming conflicts
7. **Frontend Dependencies** — Tab ordering, component dependencies
8. **Recommended Reordering** — Specific wave reordering suggestions with justification

## Completion

- [ ] Complete dependency graph produced
- [ ] All issues categorized by severity (BLOCKER/WARNING/INFO)
- [ ] Create marker file: `.agent-done-D04`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Dependency Mapping** | Build complete dependency graphs, detect cycles, find hidden dependencies | Expert |
| **API Contract Validation** | Verify request/response schemas match between frontend and backend | Expert |
| **Agent I/O Contract Review** | Verify TInput/TOutput interfaces are complete and consistent | Expert |
| **Schema Dependency Tracking** | Verify tables exist before FK references, migration ordering | Advanced |
| **Cross-Wave Consistency** | Track agent types, tab IDs, dataset names across 14 waves | Advanced |
| **Integration Testing Design** | Propose integration test strategies for cross-wave features | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel dependency review | Advanced |

## Sub-Agent Delegation Plan

```
D04 (Integration & Dependencies Reviewer):
├── Sub-agent A: Cross-Wave Dependency Graph Builder
│   ├── Read all 14 wave orchestration prompts
│   ├── Build complete dependency graph (text-based)
│   ├── Identify circular dependencies and hidden dependencies
│   └── Output: wave0-reviews/.scratch-D04-graph.md
│
├── Sub-agent B: API & Agent Contract Reviewer
│   ├── Review all new API endpoints across waves
│   ├── Check for naming conflicts, parameter mismatches
│   ├── Review all new agent I/O contracts for completeness
│   └── Output: wave0-reviews/.scratch-D04-contracts.md
│
├── Sub-agent C: Schema & Infrastructure Dependency Reviewer
│   ├── Verify table creation order matches FK references
│   ├── Verify migration numbering is sequential
│   ├── Check Cognee dataset creation order
│   ├── Verify Docker service changes happen before dependents
│   └── Output: wave0-reviews/.scratch-D04-schema.md
│
└── D04 Parent: Merge and produce integration review
    ├── Read all .scratch-D04-*.md files
    ├── Classify issues as BLOCKER/WARNING/INFO
    ├── Propose specific reordering if needed
    ├── Write final wave0-reviews/D04-integration-review.md
    └── Delete scratch files
```

### Delegation Rules for D04

- Sub-agents write ONLY to `wave0-reviews/.scratch-D04-*.md` files
- Sub-agent A must produce a complete text-based dependency graph
- All issues must be classified by severity (BLOCKER/WARNING/INFO)
- Reordering suggestions must include justification

## Dependencies

- **W01 must complete first**
- **Read-only** — does not modify W01's output files
