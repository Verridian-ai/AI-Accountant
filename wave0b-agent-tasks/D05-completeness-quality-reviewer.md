# Agent D05: Completeness & Quality Reviewer

## Role

Verify ALL 10 wave plans are COMPLETE — every table, endpoint, component, agent, and test is accounted for. Check quality of writing, consistency of format, and adherence to templates.

## Phase: C (Debate — After W01 completes, Parallel with D01-D04)

## Prerequisites

Wait for `.agent-done-0B-W01` then read ALL generated wave files.

## Review Focus Areas

### 1. 10-Point Spec Completeness

For EACH of Waves 1-10, verify ALL 10 spec points are present:

- [ ] Dependencies & estimated complexity
- [ ] Agent team composition (exactly 10 agents per wave)
- [ ] Database schema changes (BOTH SQLite AND PostgreSQL)
- [ ] API endpoints (method, path, description)
- [ ] UI components (file paths, component names)
- [ ] Cognee integration (datasets, queries)
- [ ] Testing criteria (specific assertions, not vague)
- [ ] Migration file path (correct numbering 0013-0022)
- [ ] New Claude agents (if applicable, with full spec)
- [ ] Coordination rules (sub-wave execution order)

### 2. Quantitative Verification

Cross-reference totals from R02's extraction:

- [ ] Total new tables: ~51 across all 10 waves — are they ALL in the plans?
- [ ] Total new endpoints: ~128 — are they ALL documented?
- [ ] Total new UI components: ~57 — are they ALL specified?
- [ ] Total new Claude agents: 2 (invoice_agent, accounts_payable_agent) — are they fully specified?
- [ ] Total new Cognee datasets: ~12 — are they ALL listed?
- [ ] Total migration files: 10 (0013-0022) — are they ALL planned?

### 3. Template Adherence

- [ ] Do ALL orchestration prompts follow `wave11-orchestration-prompt.md` structure?
- [ ] Do ALL agent task files follow `wave11-agent-tasks/01-*.md` structure?
- [ ] Do ALL launch scripts follow `launch-wave11.sh` structure?
- [ ] Are section headings consistent across all 10 waves?
- [ ] Are table formats consistent?

### 4. Quality of Instructions

- [ ] Are agent task instructions specific enough to implement? (file paths, not vague descriptions)
- [ ] Are testing criteria measurable? ("tsc --noEmit passes" not "code works")
- [ ] Are sub-wave execution orders logical?
- [ ] Are completion markers correctly formatted?

### 5. Backward Compatibility Verification

Using R03's compatibility analysis:

- [ ] Do Wave 1-10 plans create EVERYTHING that Waves 11-16 expect?
- [ ] Are table names EXACTLY what Wave 11-16 code references?
- [ ] Are endpoint paths EXACTLY what Wave 11-16 code calls?
- [ ] Are agent type names EXACTLY what Wave 11-16 code uses?

### 6. Missing Elements Check

- [ ] Are there any tables mentioned in specs but missing from plans?
- [ ] Are there any endpoints mentioned but not assigned to an agent?
- [ ] Are there any UI components mentioned but not in any task file?
- [ ] Are there any Cognee datasets mentioned but not configured?
- [ ] Are error handling patterns specified?
- [ ] Are loading states and empty states specified for UI components?

## Output Format

Write review to `wave0b-reviews/D05-completeness-review.md` with:

1. **Completeness Matrix** — 10×10 grid (waves × spec points) with ✅/❌
2. **Missing Elements** — Specific items not found in plans (severity: HIGH)
3. **Quality Issues** — Vague or insufficient instructions (severity: MEDIUM)
4. **Template Deviations** — Format inconsistencies (severity: LOW)
5. **Quantitative Summary** — Expected vs. actual counts for tables, endpoints, components
6. **Per-Wave Quality Verdict** — COMPLETE / INCOMPLETE for each wave

## Completion

- [ ] All 10 wave plans completeness-verified
- [ ] Create marker file: `.agent-done-0B-D05`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Quality Assurance | Systematic completeness verification | Expert |
| Template Compliance | Format and structure validation | Expert |
| Quantitative Analysis | Count verification and gap detection | Expert |
| Technical Writing Review | Clarity and specificity assessment | Advanced |

