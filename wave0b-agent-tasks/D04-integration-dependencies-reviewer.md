# Agent D04: Integration & Dependencies Reviewer

## Role

Review ALL Wave 1-10 plans for cross-wave dependency correctness, route collisions with Waves 11-24, migration numbering conflicts, and marker naming consistency.

## Phase: C (Debate — After W01 completes, Parallel with D01-D03, D05)

## Prerequisites

Wait for `.agent-done-0B-W01` then read ALL generated wave files.

## Review Focus Areas

### 1. Cross-Wave Dependency Correctness

- [ ] Verify Wave 1 has NO prerequisites (truly foundational)
- [ ] Verify Wave 2 depends ONLY on Wave 1
- [ ] Verify Wave 3 depends ONLY on Wave 2
- [ ] Verify Waves 4, 7, 10 depend ONLY on Wave 3
- [ ] Verify Wave 5 depends on Wave 4, Wave 8 on Wave 7
- [ ] Verify Wave 6 depends on Wave 5, Wave 9 on Wave 8
- [ ] Are there any CIRCULAR dependencies?
- [ ] Are there any UNDECLARED dependencies?

### 2. Route Collision Detection

- [ ] Check ALL Wave 1-10 API endpoints against each other — any duplicates?
- [ ] Check ALL Wave 1-10 endpoints against Wave 11-24 endpoints — any collisions?
- [ ] Specific risk: Wave 7 `/api/invoices/*` vs Wave 14 OCR invoice endpoints
- [ ] Specific risk: Wave 10 `/api/suppliers/*` vs Wave 11 inventory supplier references
- [ ] Specific risk: Wave 1 `/api/chat` rewrite vs existing `/api/chat` endpoint
- [ ] Check for HTTP method conflicts (GET vs POST on same path)

### 3. Migration Numbering

- [ ] Verify Waves 1-10 use migrations 0013-0022 (no gaps, no overlaps)
- [ ] Verify Waves 11-24 use migrations 0023-0036
- [ ] Check existing migration files — are 0001-0012 already taken?
- [ ] Verify migration file naming convention is consistent
- [ ] Can migrations run in any order within a wave, or must they be sequential?

### 4. Marker File Naming

- [ ] Verify ALL wave execution markers use `.agent-done-W{N}-{XX}` format
- [ ] Verify NO collision with existing markers (W11, W12, W14, W16)
- [ ] Verify launch scripts check correct prerequisite markers
- [ ] Verify orchestration prompts reference correct marker format

### 5. Type System Consistency

- [ ] Are new AgentType entries unique and non-conflicting?
- [ ] Are new I/O interfaces properly typed?
- [ ] Do new agents follow the `ClaudeAgent<TInput, TOutput>` pattern exactly?
- [ ] Are Zod schemas defined for all new API request/response types?

### 6. File Path Consistency

- [ ] Do all orchestration prompts reference correct task file paths?
- [ ] Do all launch scripts reference correct file paths?
- [ ] Are feature folder names consistent (e.g., `payroll/` not `payroll-module/`)?
- [ ] Do agent task files reference correct output file paths?

## Output Format

Write review to `wave0b-reviews/D04-integration-review.md` with:

1. **Dependency Errors** — Incorrect or missing dependencies (severity: CRITICAL)
2. **Route Collisions** — Endpoint path conflicts (severity: HIGH)
3. **Naming Conflicts** — Migration, marker, or type conflicts (severity: HIGH)
4. **Consistency Issues** — File path or naming inconsistencies (severity: MEDIUM)
5. **Per-Wave Integration Verdict** — CLEAN / HAS CONFLICTS for each wave

## Completion

- [ ] All cross-wave integrations verified
- [ ] Create marker file: `.agent-done-0B-D04`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Integration Testing | Cross-system dependency verification | Expert |
| Conflict Detection | Route, naming, and type collision finding | Expert |
| Dependency Graph Analysis | Verify DAG correctness | Expert |
| Migration Management | Database migration ordering and naming | Advanced |

