# Agent D05: Completeness & Quality Reviewer

## Role

Ensure NOTHING is missed. Verify every wave plan is complete, every feature from the user's requirements is addressed, and the quality of specifications is high enough for agent teams to execute without ambiguity.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for marker file: `.agent-done-W01`
Read ALL wave plans produced by W01.
Read the user's original requirements from `docs/Agent planning chat.md` (lines 1318-1319).

## Review Tasks

### 1. User Requirements Coverage

- [ ] Verify EVERY user requirement is addressed in at least one wave:
  - ✅/❌ Admin Backend with graphical interface → Wave 18
  - ✅/❌ Full agent control (start/stop/configure/logs) → Wave 18
  - ✅/❌ 3D Cognee Knowledge Graph visualization (all nodes and edges) → Wave 19
  - ✅/❌ Full system Cognee control → Wave 18/19
  - ✅/❌ Agent dashboard → Wave 18
  - ✅/❌ User management at system/provider level → Wave 24
  - ✅/❌ Users can assign their own accounts → Wave 24
  - ✅/❌ External API integration (banking/loans data) → Wave 20
  - ✅/❌ Last 30 Days skill for market intelligence → Wave 21
  - ✅/❌ CDR Open Banking for Australian products → Wave 20
  - ✅/❌ Agent architecture review (TS vs SDK options) → Wave 22
  - ✅/❌ Trading bots / investment platform data → Wave 23
  - ✅/❌ Universal Cognee knowledge (not personal) → Wave 23

### 2. 10-Point Spec Completeness

- [ ] For EACH wave (11-24), verify ALL 10 specification points are present:
  1. ✅/❌ Dependencies & estimated complexity
  2. ✅/❌ Agent team composition (10 agents with roles)
  3. ✅/❌ Database schema changes (table names, ALL columns)
  4. ✅/❌ API endpoints (method, path, description)
  5. ✅/❌ UI components (file paths, component names)
  6. ✅/❌ Cognee integration (datasets, queries)
  7. ✅/❌ Testing criteria (specific assertions)
  8. ✅/❌ Migration file path
  9. ✅/❌ New Claude agents (if applicable)
  10. ✅/❌ Coordination rules
- [ ] Produce a completeness matrix: Wave × Spec Point → ✅/❌

### 3. File Output Completeness

- [ ] Verify for EACH wave (11-24):
  - ✅/❌ `waveN-orchestration-prompt.md` exists and follows template
  - ✅/❌ `waveN-agent-tasks/` directory exists with 10 task files
  - ✅/❌ Each task file has: Role, Priority, Files to CREATE, Files to MODIFY, Verification, Dependencies
  - ✅/❌ `launch-waveN.sh` exists and follows template
- [ ] Count total files: Should be 14 × (1 + 10 + 1) = 168 files

### 4. Specification Quality

- [ ] For each wave, assess:
  - Are file paths specific enough? (exact paths, not vague references)
  - Are code snippets provided for BEFORE/AFTER modifications?
  - Are line numbers referenced where applicable?
  - Are verification steps concrete? (not "test it works" but "run X and expect Y")
  - Are agent roles clear enough that a Claude Code agent can execute without asking questions?
- [ ] Flag any specifications that are too vague or ambiguous

### 5. Xero/MYOB Feature Parity Check

- [ ] Cross-reference with Xero features:
  - ✅/❌ Chart of Accounts
  - ✅/❌ Bank Reconciliation
  - ✅/❌ Invoicing (create, send, track)
  - ✅/❌ Bills & Expenses
  - ✅/❌ Payroll (Australian)
  - ✅/❌ BAS/GST Reporting
  - ✅/❌ Fixed Assets
  - ✅/❌ Inventory
  - ✅/❌ Purchase Orders
  - ✅/❌ Multi-Currency
  - ✅/❌ Financial Reports (P&L, Balance Sheet, Cash Flow)
  - ✅/❌ Budgeting
  - ✅/❌ Projects/Jobs (may be missing?)
  - ✅/❌ Contacts/CRM
- [ ] Identify any Xero features NOT covered in any wave

### 6. Consistency Checks

- [ ] Migration numbers are sequential (no gaps, no duplicates)
- [ ] AgentType additions are tracked (no duplicates, all registered)
- [ ] TabId additions are tracked (no duplicates)
- [ ] Cognee dataset names are unique
- [ ] File paths don't conflict across waves

## Output Format

Write findings to `wave0-reviews/D05-completeness-review.md` with these sections:

1. **Requirements Coverage** — Checklist with ✅/❌ for each user requirement
2. **Spec Completeness Matrix** — Wave × Spec Point table
3. **File Output Audit** — Count and verify all expected files
4. **Quality Assessment** — Vague specs, missing details, ambiguities
5. **Xero Feature Parity** — Missing features, gaps
6. **Consistency Issues** — Numbering, naming, path conflicts
7. **Overall Score** — Percentage complete, list of gaps to fill

## Completion

- [ ] All sections populated with specific findings
- [ ] Every gap has a recommended fix
- [ ] Create marker file: `.agent-done-D05`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Requirements Traceability** | Map every user requirement to specific wave plans, verify coverage | Expert |
| **Specification Quality Assessment** | Evaluate spec precision: file paths, code snippets, line numbers, assertions | Expert |
| **Completeness Checking** | Verify all 10 spec points for all 14 waves (140 checkpoints) | Expert |
| **Xero/MYOB Feature Parity** | Cross-reference with Xero/MYOB feature lists to find gaps | Advanced |
| **Consistency Auditing** | Check migration numbers, agent types, tab IDs, dataset names for conflicts | Advanced |
| **Quality Metrics** | Produce quantitative completeness scores and quality ratings | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel completeness review | Advanced |

## Sub-Agent Delegation Plan

```
D05 (Completeness & Quality Reviewer):
├── Sub-agent A: Requirements Coverage & Xero Parity
│   ├── Check every user requirement against wave plans (✅/❌)
│   ├── Cross-reference Xero features (Chart of Accounts, Bank Recon, etc.)
│   ├── Identify any features NOT covered in any wave
│   └── Output: wave0-reviews/.scratch-D05-requirements.md
│
├── Sub-agent B: 10-Point Spec Completeness (Waves 11-17)
│   ├── For each wave 11-17: verify all 10 spec points
│   ├── Check file output completeness (orchestration, tasks, launch)
│   ├── Assess specification quality (precision, actionability)
│   └── Output: wave0-reviews/.scratch-D05-waves11to17.md
│
├── Sub-agent C: 10-Point Spec Completeness (Waves 18-24)
│   ├── For each wave 18-24: verify all 10 spec points
│   ├── Check file output completeness (orchestration, tasks, launch)
│   ├── Assess specification quality (precision, actionability)
│   └── Output: wave0-reviews/.scratch-D05-waves18to24.md
│
└── D05 Parent: Merge and produce overall quality score
    ├── Read all .scratch-D05-*.md files
    ├── Produce completeness matrix (Wave × Spec Point)
    ├── Calculate overall percentage complete
    ├── List all gaps with recommended fixes
    ├── Write final wave0-reviews/D05-completeness-review.md
    └── Delete scratch files
```

### Delegation Rules for D05

- Sub-agents write ONLY to `wave0-reviews/.scratch-D05-*.md` files
- Use ✅/❌ consistently for all checklists
- Every gap must have a specific recommended fix
- Produce quantitative scores (not just qualitative assessments)

## Dependencies

- **W01 must complete first**
- **Read-only** — does not modify W01's output files
