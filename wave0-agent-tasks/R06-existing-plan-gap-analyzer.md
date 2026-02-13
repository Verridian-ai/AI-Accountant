# Agent R06: Existing Plan Gap Analyzer

## Role

Analyze `docs/Agent planning chat.md` to identify exactly what's complete, what's incomplete, and what's missing. Produce a precise gap report that W01 can use to complete all remaining wave specifications.

## Phase: A (Research — Start Immediately, Parallel with R01-R05, R07-R10)

## Research Tasks

### 1. Wave-by-Wave Completeness Audit

- [ ] Read `docs/Agent planning chat.md` (all 1319 lines)
- [ ] For each wave (1-11), verify these 10 specification points exist:
  1. Dependencies & estimated complexity
  2. Agent team composition (10 agents with roles and wave assignments)
  3. Database schema changes (table names, columns)
  4. API endpoints (method, path, description)
  5. UI components (file paths, component names)
  6. Cognee integration (datasets, index queries)
  7. Testing criteria (specific assertions)
  8. Migration file path
  9. New Claude agents (if any)
  10. Phase/wave assignment
- [ ] Produce a completeness matrix: Wave × Spec Point → ✅/❌

### 2. Wave 11 Gap Analysis (CUT OFF)

- [ ] Document exactly where Wave 11 was cut off (line 1314)
- [ ] List what EXISTS for Wave 11:
  - ✅ Dependencies & complexity
  - ✅ Agent team composition
  - ✅ Database schema (inventory_items, inventory_stock, inventory_movements, warehouses, bank_recon_rules, bank_recon_sessions, bank_recon_matches)
  - ❌ API endpoints — MISSING
  - ❌ UI components — MISSING
  - ❌ Cognee integration — MISSING
  - ❌ Testing criteria — MISSING
- [ ] Draft the missing sections based on the pattern from Waves 7-10

### 3. Cross-Wave Dependency Analysis

- [ ] Map all inter-wave dependencies (which wave depends on which)
- [ ] Identify any circular dependencies or ordering issues
- [ ] Verify the phase groupings make sense:
  - Phase 1 (Waves 1-3): Chat bridge, mutations, Cognee
  - Phase 2 (Waves 4-6): Payroll
  - Phase 3 (Waves 7-9): Invoicing
  - Phase 4 (Waves 10-13): Xero/MYOB parity
  - Phase 5 (Waves 14-15): Agentic integration
  - Phase 6 (Waves 16-17): Cognee knowledge graph

### 4. New Agent Count Projection

- [ ] Count how many NEW Claude agents are planned across Waves 1-10
- [ ] Project how many more are needed for Waves 11-17
- [ ] List all planned AgentType additions with their wave assignments

### 5. Database Table Count Projection

- [ ] Count all NEW tables planned across Waves 1-10
- [ ] Project tables needed for Waves 11-17
- [ ] Cross-reference with the PostgreSQL schema gap (31 missing tables)
- [ ] Determine: Should PostgreSQL sync be a dedicated wave or handled per-wave?

### 6. Migration File Numbering

- [ ] List all migration files referenced in Waves 1-10 (0012 through 0022)
- [ ] Verify numbering is sequential with no gaps
- [ ] Project migration numbers for Waves 11-24

## Output Format

Write findings to `wave0-research/R06-plan-gaps.md` with these sections:

1. **Completeness Matrix** — Wave × Spec Point table
2. **Wave 11 Gap Detail** — Exactly what's missing, with drafted content
3. **Dependency Graph** — Text-based dependency map
4. **Agent Projection** — New agents per wave, total count
5. **Database Projection** — New tables per wave, PostgreSQL sync plan
6. **Migration Numbering** — Sequential migration file plan
7. **Recommendations** — Ordering changes, missing dependencies, structural improvements

## Completion

- [ ] All sections populated with specific line references
- [ ] Create marker file: `.agent-done-R06`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Document Analysis** | Parse large markdown documents, extract structured data from prose | Expert |
| **Specification Completeness Checking** | Verify 10-point specs against a checklist, identify missing sections | Expert |
| **Dependency Graph Construction** | Map inter-wave dependencies, detect cycles, identify hidden deps | Expert |
| **Migration Numbering** | Track sequential migration files, project future numbering | Advanced |
| **Cross-Reference Validation** | Verify references between waves, agents, tables, and endpoints | Advanced |
| **Gap Drafting** | Draft missing specification sections following established patterns | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel document analysis | Advanced |

## Sub-Agent Delegation Plan

```
R06 (Existing Plan Gap Analyzer):
├── Sub-agent A: Waves 1-5 Deep Audit
│   ├── Read docs/Agent planning chat.md (lines 1-600 approx)
│   ├── For each wave: check all 10 spec points
│   ├── Document completeness matrix for Waves 1-5
│   └── Output: wave0-research/.scratch-R06-waves1to5.md
│
├── Sub-agent B: Waves 6-11 Deep Audit
│   ├── Read docs/Agent planning chat.md (lines 600-1319)
│   ├── For each wave: check all 10 spec points
│   ├── Document Wave 11 cut-off point and missing sections
│   └── Output: wave0-research/.scratch-R06-waves6to11.md
│
├── Sub-agent C: Cross-Wave Dependency & Projection Analysis
│   ├── Build complete dependency graph from all waves
│   ├── Count new agents, tables, migrations per wave
│   ├── Project numbering for Waves 12-24
│   └── Output: wave0-research/.scratch-R06-dependencies.md
│
└── R06 Parent: Merge into unified gap report
    ├── Read all .scratch-R06-*.md files
    ├── Produce combined completeness matrix
    ├── Draft missing Wave 11 sections
    ├── Write final wave0-research/R06-plan-gaps.md
    └── Delete scratch files
```

### Delegation Rules for R06

- Sub-agents write ONLY to `wave0-research/.scratch-R06-*.md` files
- Sub-agents A and B must include exact line numbers from the source document
- Sub-agent C should produce a text-based dependency graph

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
