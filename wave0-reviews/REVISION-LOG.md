# Revision Log — W01 Debate Integration Pass

**Date**: 2026-02-12
**Agent**: W01 (Plan Synthesizer — Revision Pass)
**Scope**: Incorporating findings from D01–D05 debate reviews into wave plans

---

## Summary Statistics

| Category | Changes Made |
|----------|-------------|
| Files modified | 17 |
| P0/BLOCKER fixes | 7 |
| P1/HIGH fixes | 8 |
| P2/MEDIUM additions | 6 |
| Informational notes | 5 |

---

## Detailed Change Log

### 1. Wave 11 Marker File Naming (D05 §6 — P0)

**Source**: D05 identified that Wave 11 uses bare `.agent-done-01` markers while Waves 12–24 use wave-prefixed `.agent-done-W{N}-{NN}`. This causes naming collisions if waves overlap.

**Files Modified** (10 files):
- `wave11-agent-tasks/01-inventory-schema-builder.md` — `.agent-done-01` → `.agent-done-W11-01`
- `wave11-agent-tasks/02-inventory-service-builder.md` — `.agent-done-02` → `.agent-done-W11-02`
- `wave11-agent-tasks/03-bank-recon-engine-builder.md` — `.agent-done-03` → `.agent-done-W11-03`
- `wave11-agent-tasks/04-inventory-agent-builder.md` — `.agent-done-04` → `.agent-done-W11-04`
- `wave11-agent-tasks/05-bank-recon-agent-builder.md` — `.agent-done-05` → `.agent-done-W11-05`
- `wave11-agent-tasks/06-cognee-datasets-builder.md` — `.agent-done-06` → `.agent-done-W11-06`
- `wave11-agent-tasks/07-api-endpoints-builder.md` — `.agent-done-07` → `.agent-done-W11-07`
- `wave11-agent-tasks/08-ui-inventory-builder.md` — `.agent-done-08` → `.agent-done-W11-08`
- `wave11-agent-tasks/09-ui-recon-builder.md` — `.agent-done-09` → `.agent-done-W11-09`
- `wave11-agent-tasks/10-testing-validation-agent.md` — `.agent-done-10` → `.agent-done-W11-10`

### 2. Wave 11 Orchestration — Coordination Rules (D01–D05)

**File Modified**: `wave11-orchestration-prompt.md`

**Changes**:
- Added coordination rules 8–12:
  - Rule 8: Wave-prefixed marker naming convention
  - Rule 9: Zod validation mandatory for all new endpoints (D02-API-01)
  - Rule 10: Index discipline for migration SQL (D03-§2.2)
  - Rule 11: Pagination standard for all list endpoints (D03-§4.3)
  - Rule 12: ReDoS prevention for regex patterns (D02-§Wave11)
- Added "Debate Findings Applied" table documenting 7 specific findings and their resolutions
- Clarified bank_reconciler_agent vs account_reconciler relationship (D04-AG02)

### 3. Wave 12 Orchestration — TFN Encryption & Entity Security (D02-CRIT-04)

**File Modified**: `wave12-orchestration-prompt.md`

**Changes**:
- Added "Debate Findings Applied" table with 7 findings:
  - **CRITICAL**: TFN encryption at rest (AES-256-GCM) mandatory
  - Instant write-off threshold must be configurable, not hardcoded
  - Entity queries must include userId WHERE clause (RLS preparation)
  - Consolidation endpoints must validate ownership chain
  - Entity context designed as middleware pattern (cross-cutting concern)
  - Dual schema rule enforced
  - Batch depreciation (POST /api/assets/depreciate-all) must be async

### 4. Wave 13 Orchestration — FY Column Order & Route Collision (D02-ATO-03, D04-A01)

**File Modified**: `wave13-orchestration-prompt.md`

**Changes**:
- **Fixed budget_lines column order**: Changed from `jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec` to `jul, aug, sep, oct, nov, dec, jan, feb, mar, apr, may, jun` to align with Australian Financial Year (July–June)
- **Fixed forecast route collision**: Renamed Wave 13 forecast routes from `/api/forecasts/*` to `/api/budget-forecasts/*` to avoid collision with Wave 15's `/api/forecasts/cash-flow` route (D04-A01)
- Added "Debate Findings Applied" table with 8 findings covering async report generation, materialized views, BAS validation, report snapshot access control

### 5. Wave 14 Orchestration — OCR Security & Async Processing (D02, D03)

**File Modified**: `wave14-orchestration-prompt.md`

**Changes**:
- Added "Debate Findings Applied" table with 6 findings:
  - Server-side UUID filenames for OCR upload (path traversal prevention)
  - OCR batch upload must be async (return jobId)
  - File size limits (10MB/doc, 50MB/batch)
  - Uploaded documents encrypted at rest with 0600 permissions
  - Clarified true data dependency (Waves 7+10 only, not 11-13) — enables parallel execution
  - Dual schema rule enforced

### 6. Wave 15 Orchestration — Audit Trail & Compliance (D02, D03, D04)

**File Modified**: `wave15-orchestration-prompt.md`

**Changes**:
- Added "Debate Findings Applied" table with 6 findings:
  - `audit_trails` replaces existing `audit_log` (resolved table conflict — D04-S03)
  - Audit trail append-only (no UPDATE/DELETE) with sensitive field redaction
  - Forecast pre-computation, not on-demand
  - Incremental anomaly detection (scan since last scan, not full table)
  - Audit trail must use PostgreSQL range partitioning by month
  - Dual schema rule enforced

### 7. Wave 20 Orchestration — Admin RBAC & Graph Limits (D02-CRIT-05, D03)

**File Modified**: `wave20-orchestration-prompt.md`

**Changes**:
- Added "Debate Findings Applied" table with 8 findings:
  - **CRITICAL**: Basic RBAC (super_admin/admin/viewer) mandatory before admin endpoints
  - Docker restart endpoint needs super_admin + rate limiting
  - 3D graph capped at 2,000 nodes with LOD (Level of Detail)
  - Admin graph delegates to Wave 16 service layer (no reimplementation)
  - Admin data access audit-logged
  - Agent usage analytics added
  - Auth role taxonomy designed forward-compatible with Wave 23
  - Execution log uses cursor-based pagination

### 8. Wave 22 Orchestration — Chart Dependencies & Performance (D04-D02, D03)

**File Modified**: `wave22-orchestration-prompt.md`

**Changes**:
- Added "Debate Findings Applied" table with 5 findings:
  - Declared undeclared dependencies on Waves 11, 13, 15, 19
  - Recharts lazy-loaded (not in main bundle)
  - Server-side data aggregation for >1000 data points
  - Dashboard widget cap (12 per dashboard)
  - Dashboard layout JSON validated against XSS

### 9. Master Plan — Comprehensive Update (All Reviews)

**File Modified**: `docs/wave0-master-plan.md`

**Changes**:
- Fixed marker naming convention in Coordination Rules (rule 2): `.agent-done-{number}` → `.agent-done-W{wave}-{number}`
- Added comprehensive "Debate Findings & Resolutions" section with 5 subsections:
  - D01 Architecture: 7 findings with resolutions
  - D02 Security: 8 findings with resolutions
  - D03 Scalability: 5 findings with resolutions
  - D04 Integration: 7 findings with resolutions (including 3 BLOCKER fixes)
  - D05 Completeness: 5 findings with resolutions
- Added "Parallelization Opportunities" section with optimized phase execution graph showing ~30-50% timeline reduction

---

## Findings NOT Changed (Deferred or Acknowledged)

These findings were acknowledged in the master plan but NOT directly applied to wave plans because they require broader architectural decisions:

| Finding | Source | Reason for Deferral |
|---------|--------|-------------------|
| Drop SQLite entirely | D01 §2.1 | Requires pre-Wave-11 architectural decision. Dual schema rule remains enforced |
| Move sidebar/router to Wave 11 | D01 §3.1 | Significant reordering impact. Acknowledged but not restructured |
| Install Vitest + Playwright pre-Wave 11 | D01 §6.2 | Requires infrastructure setup outside wave scope |
| Refactor index.ts into route modules | D01 §6.1 | Pre-Wave-11 refactor recommended but not blocking |
| Agent merging (target ≤18) | D01 §1.1 | Noted for implementation time — agents can be merged during build |
| BullMQ installation | D01 §4.4 / D03 §4.2 | Pre-Wave-13 infrastructure task. Flagged in wave plans as dependency |
| Cognee auth enablement | D02 CRIT-01 | Pre-Wave-11 security task. Outside wave scope |
| User data deletion endpoint | D02 PRIV-01 | Privacy Act compliance. Not assigned to a wave yet |
| Projects & Job Costing (Xero parity) | D05 §5 | Future Wave 25+ item |
| Expense Claims (Xero parity) | D05 §5 | Future Wave 25+ item |

---

## Verification

All modified files remain internally consistent:
- Migration numbering: 0023–0036 (unchanged, sequential, no gaps)
- Agent count: 26 total (unchanged)
- Marker naming: All waves now use `.agent-done-W{N}-{NN}` format
- Route paths: No collisions (Wave 13 forecasts renamed to `/api/budget-forecasts/*`)
- Coordination rules: Strengthened with Zod, pagination, index, and security requirements

---

*Revision completed by W01 — Plan Synthesizer (Revision Pass)*
