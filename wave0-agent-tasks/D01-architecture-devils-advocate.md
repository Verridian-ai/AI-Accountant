# Agent D01: Architecture Devil's Advocate

## Role

Challenge EVERY architecture decision in W01's wave plans. Propose alternatives, identify anti-patterns, and ensure the chosen architecture is the BEST option — not just the first one considered.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for marker file: `.agent-done-W01`
Read ALL wave plans produced by W01 (wave11 through wave24 orchestration prompts and task files).
Read ALL research reports in `wave0-research/` for context.

## Review Tasks

### 1. Agent Architecture Decisions

- [ ] For each NEW Claude agent proposed across Waves 11-24:
  - Is a new agent the right solution, or could an existing agent be extended with new tools?
  - Is the I/O contract (TInput/TOutput) well-designed? Too broad? Too narrow?
  - Are the tools well-scoped? Could any be shared across agents?
  - Is the system prompt specific enough to prevent hallucination?
- [ ] Challenge: Are we creating too many agents? (Currently 11, projecting ~25)
  - Could some be merged? (e.g., asset_management + inventory = asset_inventory_agent?)
  - Is the orchestrator going to struggle with 25+ agents?
- [ ] Challenge: Should we keep the stateless invoke() pattern or move to conversational agents?

### 2. Database Architecture Decisions

- [ ] Challenge the dual-schema approach (SQLite + PostgreSQL):
  - Is maintaining two schemas sustainable with 100+ tables?
  - Should we drop SQLite and go PostgreSQL-only?
  - Or drop PostgreSQL and use SQLite with Turso for production?
- [ ] Challenge table design decisions:
  - Are there normalization issues? Over-normalization?
  - Are the foreign key relationships correct?
  - Are indexes planned for common query patterns?
- [ ] Challenge the migration strategy:
  - Raw SQL migrations vs Drizzle push/migrate?
  - How to handle schema conflicts between waves?

### 3. Frontend Architecture Decisions

- [ ] Challenge the tab-based navigation:
  - With 15+ tabs, is bottom navigation still viable?
  - Should we switch to sidebar navigation?
  - Should admin be a separate app/route entirely?
- [ ] Challenge the feature-folder structure:
  - Will it scale to 20+ feature folders?
  - Should there be shared component libraries?
- [ ] Challenge the chat architecture:
  - Is a floating chat widget the right UX for agent interaction?
  - Should there be a dedicated agent workspace instead?

### 4. Infrastructure Decisions

- [ ] Challenge the Docker-local constraint:
  - Is this sustainable for production?
  - What's the scaling story?
- [ ] Challenge the single-server architecture:
  - Should CDR harvester be a separate service?
  - Should admin API be separate from user API?
- [ ] Challenge Cognee as the sole knowledge graph:
  - Is Kuzu performant enough for 3D visualization of large graphs?
  - Should we consider Neo4j for production?

### 5. Integration Decisions

- [ ] Challenge the wave ordering:
  - Are there waves that should be reordered for better incremental value?
  - Are there waves that could be parallelized?
  - Should admin (Wave 18) come earlier since it provides visibility into all other waves?
- [ ] Challenge dependency assumptions:
  - Are all stated dependencies actually necessary?
  - Are there hidden dependencies not captured?

## Output Format

Write findings to `wave0-reviews/D01-architecture-review.md` with these sections:

1. **Agent Architecture** — Challenges, alternatives, recommendations
2. **Database Architecture** — Challenges, alternatives, recommendations
3. **Frontend Architecture** — Challenges, alternatives, recommendations
4. **Infrastructure** — Challenges, alternatives, recommendations
5. **Integration & Ordering** — Challenges, reordering suggestions
6. **Critical Issues** — Any showstoppers that MUST be addressed before proceeding
7. **Approved Decisions** — Decisions that are sound and should proceed as planned

## Completion

- [ ] All sections populated with specific, actionable feedback
- [ ] Each challenge includes a RECOMMENDATION (not just criticism)
- [ ] Create marker file: `.agent-done-D01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Architecture Critique** | Challenge design decisions with specific alternatives and trade-off analysis | Expert |
| **Alternative Design Patterns** | Propose microservices vs monolith, event-driven vs request-response | Expert |
| **Technical Debt Assessment** | Identify decisions that create future maintenance burden | Expert |
| **Database Architecture Review** | Challenge schema design, dual-DB strategy, normalization choices | Advanced |
| **Frontend Architecture Review** | Challenge navigation patterns, component structure, state management | Advanced |
| **Infrastructure Scaling Analysis** | Challenge Docker-local constraints, propose scaling paths | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel wave plan review | Advanced |

## Sub-Agent Delegation Plan

```
D01 (Architecture Devil's Advocate):
├── Sub-agent A: Agent & Backend Architecture Review
│   ├── Review all wave plans for agent architecture decisions
│   ├── Challenge: too many agents? wrong granularity? missing tools?
│   ├── Challenge: stateless invoke() vs conversational agents
│   └── Output: wave0-reviews/.scratch-D01-agents.md
│
├── Sub-agent B: Database & Schema Architecture Review
│   ├── Review all wave plans for database decisions
│   ├── Challenge: dual-schema sustainability, normalization, indexes
│   ├── Challenge: migration strategy, schema conflicts between waves
│   └── Output: wave0-reviews/.scratch-D01-database.md
│
├── Sub-agent C: Frontend & Infrastructure Review
│   ├── Review all wave plans for frontend decisions
│   ├── Challenge: tab navigation at 15+ tabs, admin as separate app
│   ├── Challenge: Docker-local constraint, single-server architecture
│   └── Output: wave0-reviews/.scratch-D01-frontend-infra.md
│
└── D01 Parent: Merge and produce unified architecture review
    ├── Read all .scratch-D01-*.md files
    ├── Prioritize challenges by impact (showstopper > important > nice-to-have)
    ├── Ensure every challenge has a RECOMMENDATION
    ├── Write final wave0-reviews/D01-architecture-review.md
    └── Delete scratch files
```

### Delegation Rules for D01

- Sub-agents write ONLY to `wave0-reviews/.scratch-D01-*.md` files
- Every challenge MUST include a specific alternative recommendation
- Challenges should reference specific wave numbers and file paths
- Mark approved decisions explicitly (not just criticisms)

## Dependencies

- **W01 must complete first**
- **Read-only** — does not modify W01's output files
