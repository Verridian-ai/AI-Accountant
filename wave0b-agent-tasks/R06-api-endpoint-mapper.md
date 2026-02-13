# Agent R06: API Endpoint Mapper

## Role

Map ALL API endpoints that Waves 1-10 need to create (~128 endpoints). Cross-reference with existing endpoints to avoid collisions and ensure consistent patterns.

## Phase: A (Research — Start Immediately, Parallel with R01-R05, R07-R10)

## Research Tasks

### 1. Current Endpoint Inventory

- [ ] Read `server/src/index.ts` — list ALL existing route registrations
- [ ] Read ALL files in `server/src/routes/` — list every endpoint (method, path, handler)
- [ ] Read endpoints added by Waves 11-16 execution (inventory, assets, entities, OCR, datapoints)
- [ ] Document the route pattern conventions (prefix, naming, middleware)

### 2. Wave 1-10 Required Endpoints

Extract from `docs/Agent planning chat.md`:

- [ ] **Wave 1** (9 endpoints): `/api/chat` rewrite, `/api/agents/*` routes for all 11 agents, `/api/intent/classify`
- [ ] **Wave 2** (6 endpoints): `/api/transactions/mutate`, `/api/transactions/stream`, `/api/audit/*`
- [ ] **Wave 3** (4 endpoints): `/api/cognee/session/*`, `/api/cognee/datapoints/*`
- [ ] **Wave 4** (15 endpoints): `/api/payroll/employees/*` CRUD, pay categories, pay structures
- [ ] **Wave 5** (15 endpoints): `/api/payroll/pay-runs/*`, `/api/payroll/leave/*`
- [ ] **Wave 6** (18 endpoints): `/api/payroll/stp/*`, `/api/payroll/payslips/*`, `/api/payroll/timesheets/*`
- [ ] **Wave 7** (18 endpoints): `/api/customers/*`, `/api/invoices/*`, PDF generation
- [ ] **Wave 8** (13 endpoints): `/api/invoices/recurring/*`, `/api/payments/*`, `/api/dunning/*`
- [ ] **Wave 9** (12 endpoints): `/api/currencies/*`, `/api/ar-aging/*`, `/api/statements/*`
- [ ] **Wave 10** (20+ endpoints): `/api/suppliers/*`, `/api/bills/*`, `/api/purchase-orders/*`

### 3. Collision Detection

- [ ] Check all Wave 1-10 endpoints against existing endpoints for path collisions
- [ ] Check against Wave 11-24 planned endpoints for future collisions
- [ ] Verify no overlap with existing `/api/chat`, `/api/analysis/*`, `/api/tax/*` routes
- [ ] Flag any endpoints that Wave 14 (OCR) already created that Wave 7 also plans

### 4. Pattern Standardization

- [ ] Document consistent CRUD patterns: GET list, GET by ID, POST create, PUT update, DELETE
- [ ] Document pagination pattern (offset/limit vs cursor)
- [ ] Document error response format
- [ ] Document auth middleware placement

## Output Format

Write findings to `wave0b-research/R06-api-endpoints.md` with:

1. **Current Endpoint Count** — Total existing + added by Waves 11-16
2. **Per-Wave Endpoint Tables** — Method, path, description, handler file for each wave
3. **Collision Report** — Any path conflicts detected
4. **Pattern Guide** — Standardized conventions for W01 to follow
5. **Total New Endpoints** — Sum across Waves 1-10

## Completion

- [ ] All ~128 endpoints documented with method, path, description
- [ ] Create marker file: `.agent-done-0B-R06`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| API Design | REST endpoint mapping and design | Expert |
| Route Analysis | Parse and catalog HTTP routes | Expert |
| Collision Detection | Find path/method conflicts | Advanced |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read `server/src/index.ts` and all route files, inventory current endpoints
- **Sub-agent B**: Extract Wave 1-5 endpoints from planning doc
- **Sub-agent C**: Extract Wave 6-10 endpoints from planning doc
- **Sub-agent D**: Read Wave 11-24 orchestration prompts for future endpoint plans
- R06 merges and performs collision detection

