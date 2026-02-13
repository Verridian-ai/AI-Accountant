# Agent R08: Cognee Integration Planner

## Role

Plan ALL Cognee-related changes across Waves 1-10: multi-user enablement (Wave 3), custom DataPoint models, new datasets (~12 across all waves), and session memory integration.

## Phase: A (Research — Start Immediately, Parallel with R01-R07, R09-R10)

## Research Tasks

### 1. Current Cognee State

- [ ] Read `server/src/services/cognee_client.ts` — document current HTTP client methods (add, cognify, search)
- [ ] Read `docker-compose.yml` — document Cognee env vars, especially `ENABLE_BACKEND_ACCESS_CONTROL`
- [ ] Read `cognee-repo/` structure if present — understand the Cognee instance config
- [ ] Check if Wave 16 (Custom DataPoints) modified the Cognee client or added new methods
- [ ] Document current Cognee auth: single admin token, no per-user support

### 2. Wave 3: Multi-User Cognee Enablement

This is the critical wave for Cognee. Extract requirements:

- [ ] `ENABLE_BACKEND_ACCESS_CONTROL=true` — what changes does this require?
- [ ] Per-user dataset prefix scheme (`user_{userId}_*`)
- [ ] Session memory with Redis-Cognee bridge
- [ ] `cognee_user_accounts` table for user↔Cognee mapping
- [ ] `cognee_sessions` table for session state
- [ ] Modified `cognee_client.ts` to include user_id in all API calls

### 3. Per-Wave Cognee Datasets

- [ ] **Wave 1**: No new datasets (but agent responses should be logged to Cognee)
- [ ] **Wave 3**: Session memory dataset, user preference dataset
- [ ] **Wave 4**: `payroll_employees` dataset — employee records and relationships
- [ ] **Wave 5**: `payroll_runs` dataset — pay run history and patterns
- [ ] **Wave 6**: `stp_compliance` dataset, `payroll_awards` dataset, `payroll_timesheets` dataset
- [ ] **Wave 7**: `customer_intelligence` dataset, `invoice_patterns` dataset
- [ ] **Wave 8**: `recurring_billing` dataset
- [ ] **Wave 9**: `ar_analytics` dataset
- [ ] **Wave 10**: `supplier_intelligence` dataset, `procurement_patterns` dataset

### 4. Wave 16 Compatibility Check

- [ ] Wave 16 already built Custom DataPoints & Graph Relationships
- [ ] Read Wave 16 output files to understand what Cognee features already exist
- [ ] Ensure Wave 3 plan doesn't conflict with Wave 16's DataPoint system
- [ ] Wave 16 may assume multi-user is already enabled — document this dependency

### 5. Cognee Index & Search Patterns

- [ ] Document current search patterns used by agents
- [ ] Plan new index queries needed for payroll, invoicing, AP domains
- [ ] Design session-aware search that scopes to current user

## Output Format

Write findings to `wave0b-research/R08-cognee-integration.md` with:

1. **Current Cognee State** — Client methods, auth model, env vars
2. **Wave 3 Multi-User Plan** — Complete enablement specification
3. **Dataset Manifest** — All ~12 new datasets with owner wave and schema
4. **Wave 16 Compatibility** — What already exists, what must align
5. **Client Modifications** — Changes to `cognee_client.ts` per wave
6. **Docker Config Changes** — Environment variable updates

## Completion

- [ ] All Cognee changes documented per wave
- [ ] Create marker file: `.agent-done-0B-R08`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Knowledge Graph Design | Cognee dataset and ontology planning | Expert |
| Multi-Tenant Architecture | Per-user data isolation patterns | Advanced |
| API Integration | REST client modification planning | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read cognee_client.ts and docker-compose.yml
- **Sub-agent B**: Read Wave 16 output files for DataPoint system state
- **Sub-agent C**: Extract Cognee requirements from planning doc (all 10 waves)
- R08 merges into complete Cognee integration plan

