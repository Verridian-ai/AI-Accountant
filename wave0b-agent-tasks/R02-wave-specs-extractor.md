# Agent R02: Wave 1-10 Spec Extractor

## Role

Extract and formalize ALL Wave 1-10 specifications from `docs/Agent planning chat.md`. Convert the descriptive text into structured data that W01 can directly use to create orchestration prompts and task files.

## Phase: A (Research — Start Immediately, Parallel with R01, R03-R10)

## Research Tasks

### 1. Extract Wave Specifications

Read `docs/Agent planning chat.md` lines 682–1314 and for EACH wave (1-10), extract:

- [ ] **Wave 1** (lines 683–744): Chat→Agent Bridge — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 2** (lines 745–808): Transaction Mutation — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 3** (lines 809–861): Multi-User Cognee — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 4** (lines 862–924): Employee Management — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 5** (lines 925–987): Pay Run Processing — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 6** (lines 988–1054): STP Compliance — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 7** (lines 1055–1123): Customer/Invoice — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 8** (lines 1124–1180): Recurring Invoices — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 9** (lines 1181–1238): AR Aging & Multi-Currency — agent team, deliverables, schema, endpoints, UI, Cognee, tests
- [ ] **Wave 10** (lines 1239–1287): AP & Purchase Orders — agent team, deliverables, schema, endpoints, UI, Cognee, tests

### 2. Identify Gaps in Specs

For each wave, check if the 10-point spec format is complete:
- [ ] Dependencies & complexity ✓/✗
- [ ] Agent team composition (10 agents) ✓/✗
- [ ] Database schema changes ✓/✗
- [ ] API endpoints ✓/✗
- [ ] UI components ✓/✗
- [ ] Cognee integration ✓/✗
- [ ] Testing criteria ✓/✗
- [ ] Migration file path ✓/✗
- [ ] New Claude agents ✓/✗
- [ ] Coordination rules ✓/✗

### 3. Count Totals

- [ ] Total new tables across Waves 1-10
- [ ] Total new API endpoints across Waves 1-10
- [ ] Total new UI components across Waves 1-10
- [ ] Total new Claude agents across Waves 1-10
- [ ] Total new Cognee datasets across Waves 1-10

## Output Format

Write findings to `wave0b-research/R02-wave-specs-extracted.md` with:

1. **Per-Wave Spec Tables** — Structured extraction of all 10 waves
2. **Completeness Matrix** — 10×10 grid showing which spec points are present/missing per wave
3. **Totals Summary** — Aggregate counts
4. **Gaps Identified** — What W01 needs to fill in

## Completion

- [ ] All 10 waves extracted with structured data
- [ ] Create marker file: `.agent-done-0B-R02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Document Analysis | Extract structured data from prose | Expert |
| Specification Formalization | Convert descriptions to specs | Expert |
| Gap Detection | Identify missing specification elements | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Extract Waves 1-3 (Phase 1: Core Infrastructure)
- **Sub-agent B**: Extract Waves 4-6 (Phase 2: Payroll)
- **Sub-agent C**: Extract Waves 7-9 (Phase 3: Invoicing)
- **Sub-agent D**: Extract Wave 10 (Phase 4: AP) + compile totals
- R02 merges all extractions and produces completeness matrix

