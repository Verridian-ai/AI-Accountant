# Agent R10: Dependency & Ordering Analyzer

## Role

Analyze the Wave 1-10 dependency chain and produce the optimal execution order with maximum parallelization. Map inter-wave dependencies, identify critical path, and plan the launch sequence.

## Phase: A (Research — Start Immediately, Parallel with R01-R09)

## Research Tasks

### 1. Wave 1-10 Dependency Chain

From the planning doc and master plan:

- [ ] **Wave 1** → No prerequisites (foundational)
- [ ] **Wave 2** → Depends on Wave 1 (needs intent router, agent dispatcher)
- [ ] **Wave 3** → Depends on Wave 2 (needs mutation framework for Cognee writes)
- [ ] **Wave 4** → Depends on Wave 3 (needs multi-user Cognee for payroll datasets)
- [ ] **Wave 5** → Depends on Wave 4 (needs employee tables, pay categories)
- [ ] **Wave 6** → Depends on Wave 5 (needs pay runs, leave management)
- [ ] **Wave 7** → Depends on Wave 3 (needs multi-user Cognee for customer datasets)
- [ ] **Wave 8** → Depends on Wave 7 (needs customers, invoices)
- [ ] **Wave 9** → Depends on Wave 8 (needs recurring invoices, payment gateways)
- [ ] **Wave 10** → Depends on Wave 3 (needs multi-user Cognee for supplier datasets)

### 2. Dependency Graph

```
Wave 1 → Wave 2 → Wave 3 (SEQUENTIAL — critical path)
                      ├→ Wave 4 → Wave 5 → Wave 6  (Payroll track)
                      ├→ Wave 7 → Wave 8 → Wave 9  (Invoicing track)
                      └→ Wave 10                     (AP track)
```

After Wave 3 completes: 3 PARALLEL tracks run simultaneously.

### 3. Cross-Reference with Wave 11-24 Dependencies

- [ ] Read `docs/wave0-master-plan.md` — verify dependency claims
- [ ] Read `wave0-reviews/D04-integration-review.md` — cross-wave dependency analysis
- [ ] Verify: Wave 11 needs Wave 10 (AP) — confirm or adjust
- [ ] Verify: Wave 12 needs Wave 7 (invoices) — confirm or adjust
- [ ] Verify: Wave 14 needs Wave 7+10 — confirm or adjust
- [ ] Verify: Wave 16 needs Wave 3 (multi-user Cognee) — confirm or adjust

### 4. Critical Path Analysis

- [ ] Critical path: Wave 1→2→3→(longest of 4-6, 7-9, 10)
- [ ] Estimate agent-hours per wave (10 agents × complexity factor)
- [ ] Identify bottleneck waves (Wave 1 is likely the largest)
- [ ] Total elapsed time estimate for all 10 waves

### 5. Launch Sequence Plan

Produce the exact launch order:

- [ ] **Round 1**: Launch Wave 1
- [ ] **Round 2**: Launch Wave 2 (after Wave 1 completes)
- [ ] **Round 3**: Launch Wave 3 (after Wave 2 completes)
- [ ] **Round 4**: Launch Wave 4 + Wave 7 + Wave 10 (ALL THREE in parallel)
- [ ] **Round 5**: Launch Wave 5 + Wave 8 (parallel, when 4 and 7 complete)
- [ ] **Round 6**: Launch Wave 6 + Wave 9 (parallel, when 5 and 8 complete)

### 6. Risk Assessment

- [ ] What if Wave 1 fails? (All subsequent waves blocked)
- [ ] What if Wave 3 fails? (All 3 parallel tracks blocked)
- [ ] Can any Wave 11-24 code be run before Waves 1-10 complete?
- [ ] Rollback strategy if a wave produces incompatible code

## Output Format

Write findings to `wave0b-research/R10-dependency-ordering.md` with:

1. **Dependency Graph** — ASCII/Mermaid diagram of Wave 1-10 dependencies
2. **Execution Sequence** — 6 launch rounds with parallel opportunities
3. **Critical Path** — Longest sequential chain
4. **Cross-Wave Dependencies** — How 1-10 connect to 11-24
5. **Risk Matrix** — Failure scenarios and mitigations
6. **Launch Commands** — Ready-to-copy PowerShell commands for each round

## Completion

- [ ] Complete dependency graph with verified dependencies
- [ ] Create marker file: `.agent-done-0B-R10`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Dependency Analysis | Graph-based dependency resolution | Expert |
| Project Planning | Critical path and parallel scheduling | Expert |
| Risk Assessment | Failure mode analysis | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read planning doc for Wave 1-10 dependency declarations
- **Sub-agent B**: Read Wave 11-24 orchestration prompts for backward dependencies
- **Sub-agent C**: Read master plan and debate reviews for dependency corrections
- R10 synthesizes into complete ordering analysis

