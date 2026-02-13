# Wave 5 — Pay Run Processing & Leave Management — Orchestration Prompt

You are the **Team Lead** for Wave 5: Pay Run Processing & Leave Management. You coordinate 10 specialized agents to add pay run processing with PAYG withholding calculations, superannuation guarantee, and comprehensive leave management to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 5, lines ~890–910)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 4)
- 11 original Claude agents + enhanced `payroll_agent` with employee management tools
- SQLite + PostgreSQL dual schema synchronized
- Employee management module operational (employees, bank details, super funds, tax declarations, pay categories, pay structures)
- Cognee datasets: `employee_profiles`, `pay_structures`
- 14 migrations (0009–0016) applied
- `features/payroll/` folder with PayrollDashboard, EmployeeList, EmployeeDetail, EmployeeOnboarding, PayCategoryManager, PayStructureEditor

## Dependencies
- **Requires**: Wave 4 complete (employee tables, pay categories, pay structures)
- **Estimated Complexity**: VERY HIGH

## Database Schema Changes

### New Tables (7 tables)
| Table | Columns |
|-------|---------|
| `pay_runs` | id, userId, payPeriodStart, payPeriodEnd, payDate, status (draft/processing/completed/reversed), frequency (weekly/fortnightly/monthly), totalGross INTEGER, totalTax INTEGER, totalSuper INTEGER, totalNet INTEGER, processedAt, createdAt, updatedAt |
| `pay_run_lines` | id, payRunId FK→pay_runs, employeeId FK→employees, payCategoryId FK→pay_categories, hours REAL, rate INTEGER, amount INTEGER, description |
| `pay_run_summary` | id, payRunId FK→pay_runs, employeeId FK→employees, grossPay INTEGER, taxWithheld INTEGER, superGuarantee INTEGER, superSalarySacrifice INTEGER, netPay INTEGER, leaveLoading INTEGER |
| `leave_types` | id, userId, name, accrualRate REAL, accrualFrequency (per_hour/per_pay_period/per_year), maxBalance REAL, isPaid BOOLEAN, isActive BOOLEAN, createdAt |
| `leave_balances` | id, employeeId FK→employees, leaveTypeId FK→leave_types, balance REAL, accrued REAL, taken REAL, adjustments REAL, asAtDate |
| `leave_requests` | id, employeeId FK→employees, leaveTypeId FK→leave_types, startDate, endDate, hours REAL, status (pending/approved/rejected), approvedBy FK→users, notes, createdAt |
| `leave_transactions` | id, employeeId FK→employees, leaveTypeId FK→leave_types, payRunId FK→pay_runs, type (accrual/taken/adjustment), hours REAL, date, notes |

**Migration**: `docker/migrations/0017_pay_runs_leave.sql`

### Foreign Key Map
```
pay_runs.userId → users.id
pay_run_lines.payRunId → pay_runs.id (CASCADE)
pay_run_lines.employeeId → employees.id
pay_run_lines.payCategoryId → pay_categories.id
pay_run_summary.payRunId → pay_runs.id (CASCADE)
pay_run_summary.employeeId → employees.id
leave_types.userId → users.id
leave_balances.employeeId → employees.id (CASCADE)
leave_balances.leaveTypeId → leave_types.id
leave_requests.employeeId → employees.id
leave_requests.leaveTypeId → leave_types.id
leave_requests.approvedBy → users.id
leave_transactions.employeeId → employees.id
leave_transactions.leaveTypeId → leave_types.id
leave_transactions.payRunId → pay_runs.id
```

### Recommended Indexes
- `pay_runs`: `(userId, status)`, `(payPeriodStart, payPeriodEnd)`
- `pay_run_lines`: `(payRunId)`, `(employeeId)`
- `pay_run_summary`: `(payRunId, employeeId)` UNIQUE
- `leave_balances`: `(employeeId, leaveTypeId)` UNIQUE
- `leave_requests`: `(employeeId, status)`, `(startDate, endDate)`
- `leave_transactions`: `(employeeId, leaveTypeId)`, `(payRunId)`

## API Endpoints (15 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/payroll/pay-runs | List pay runs |
| POST | /api/payroll/pay-runs | Create draft pay run |
| GET | /api/payroll/pay-runs/:id | Get pay run detail |
| POST | /api/payroll/pay-runs/:id/calculate | Calculate pay run (PAYG, super, net) |
| POST | /api/payroll/pay-runs/:id/process | Process (finalize) pay run |
| POST | /api/payroll/pay-runs/:id/reverse | Reverse pay run |
| GET | /api/payroll/pay-runs/:id/lines | Get pay run lines |
| POST | /api/payroll/pay-runs/:id/lines | Add/update pay run line |
| GET | /api/payroll/leave/types | List leave types |
| POST | /api/payroll/leave/types | Create leave type |
| GET | /api/payroll/leave/balances/:employeeId | Get leave balances |
| POST | /api/payroll/leave/request | Submit leave request |
| POST | /api/payroll/leave/request/:id/approve | Approve leave |
| POST | /api/payroll/leave/request/:id/reject | Reject leave |
| GET | /api/payroll/leave/calendar | Leave calendar view |

## UI Components
### `client/src/features/payroll/components/` — Extend existing payroll feature
- **PayRunWizard.tsx** — Multi-step pay run creation: select period → review employees → calculate → confirm → process. Progress stepper UI with gold (#FFCC00) accent. Shows PAYG breakdown, super contributions, net pay per employee.
- **PayRunDetail.tsx** — Detailed pay run view with per-employee breakdown table (gross, tax, super, net). Expandable rows showing individual pay run lines. Status badges: draft (yellow), processing (blue), completed (green), reversed (red).
- **PayRunHistory.tsx** — Historical pay runs list with date range filtering, status badges, total amounts. TanStack Table with sorting/filtering. Click row → PayRunDetail.
- **LeaveManagement.tsx** — Leave hub with internal sub-tabs: Types, Balances, Requests. Leave type configuration, balance overview per employee, pending requests queue.
- **LeaveCalendar.tsx** — Visual month/week calendar showing employee leave periods. Color-coded by leave type (Annual=green, Sick=orange, Long Service=blue). Uses CSS grid layout, no external calendar library.
- **LeaveRequestForm.tsx** — Submit/approve/reject leave requests. Employee selector (if manager view), date range picker, leave type selector with current balance display, notes field. Approval workflow buttons.

### Modified Components
- **PayrollDashboard.tsx** — Add sub-tabs for `pay-runs`, `leave`, `leave-calendar` alongside existing employee tabs
- **client/src/api.ts** — Extend `payrollApi` object with ~15 new methods for pay run CRUD, leave CRUD

**Navigation**: No new tabs needed — extends existing `payroll` tab from Wave 4

## New Claude Agents
**None** — Wave 5 enhances the existing `payroll_agent` with new tools:
- `calculate_payg_withholding` — ATO FY2024-25 tax tables (resident, non-resident, working holiday)
- `calculate_super_guarantee` — 11.5% super guarantee on ordinary time earnings
- `generate_pay_run` — Creates draft pay run from employee pay structures
- `process_pay_run` — Finalizes pay run, updates leave balances
- `calculate_leave_entitlements` — Proportional accrual based on hours worked

## Australian Payroll Specifics

### PAYG Withholding (FY2024-25 Tax Tables)
| Taxable Income | Base Tax | Rate |
|----------------|----------|------|
| $0 – $18,200 | $0 | 0% |
| $18,201 – $45,000 | $0 | 16% |
| $45,001 – $135,000 | $4,288 | 30% |
| $135,001 – $190,000 | $31,288 | 37% |
| $190,001+ | $51,638 | 45% |

Plus Medicare Levy: 2% of taxable income (above $24,276 threshold)
Plus HELP/HECS repayment if employee has HELP debt

### Superannuation Guarantee
- Rate: **11.5%** of ordinary time earnings (OTE) for FY2024-25
- Maximum super base: $65,070 per quarter ($260,280 per year)
- Minimum payment threshold: $450/month (removed from 1 July 2022 — all employees eligible)

### Leave Accrual (National Employment Standards)
- **Annual Leave**: 4 weeks per year (pro-rata for part-time), accrues progressively
- **Personal/Carer's Leave**: 10 days per year (pro-rata for part-time)
- **Long Service Leave**: Varies by state (typically 8.67 weeks after 10 years in NSW)
- Casual employees do NOT accrue leave (loaded into hourly rate as casual loading)

## Cognee Integration
- **New datasets**: `pay_run_history` (CHUNKS), `leave_patterns` (GRAPH_COMPLETION)
- **New CogneeTools methods**:
  - `indexPayRun(payRun)` — Index completed pay runs for historical queries
  - `searchPayRunHistory(query)` — "What was total payroll cost last quarter?"
  - `indexLeavePattern(pattern)` — Index leave usage patterns
  - `searchLeavePatterns(query)` — "Which employees have low leave balances?"
- **Module mapping**: Add `payruns: pay_run_history`, `leave: leave_patterns` to `_moduleToDataset()`

## Security & Compliance Requirements (REVISION: D02, D03)

> **REVISION NOTE:** These requirements were added based on D02 (Security) and D03 (Scalability) debate reviews.

1. **Pay Run Immutability (D02 COMP-05)**: Once a pay run status = 'completed', NO modifications are allowed. The PATCH endpoint MUST reject updates with 409 Conflict. Reversals create NEW correction pay runs referencing the original — they do NOT modify existing completed pay runs.
2. **Configurable Tax Tables (D02 COMP-03, D01 DC-08)**: PAYG tax brackets MUST NOT be hardcoded in calculator source code. Create a `tax-tables.ts` config file with FY-keyed bracket data. The calculator accepts a `financialYear` parameter and loads the correct brackets. This allows annual ATO rate updates without code changes.
3. **Configurable Super Rate (D02 COMP-02)**: Super guarantee rate (11.5% for FY2024-25) must be loaded from config, not hardcoded. The rate changes annually (12% from FY2025-26).
4. **Batch Processing (D03 B4)**: Pay run calculations MUST use batch DB operations (batch INSERT, single transaction). Row-by-row processing will not scale for 100+ employees. Pay runs exceeding `PAY_RUN_BACKGROUND_THRESHOLD` employees must be queued via the existing queue service.
5. **Leave Precision**: Leave balance calculations must use decimal precision (4 decimal places minimum), never integer rounding for hours.
6. **Audit Trail**: All pay run state transitions (draft→completed, completed→reversed) must be logged.

## Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `LEAVE_ACCRUAL_CALCULATION` | Accrual method (proportional/period_end) | `proportional` |
| `PAY_RUN_BATCH_SIZE` | Max employees per pay run batch | `100` |
| `PAY_RUN_BACKGROUND_THRESHOLD` | Employee count above which pay run is queued as background job (REVISION: D03 B4) | `20` |

## Testing Criteria
- [ ] PAYG withholding calculated correctly per ATO FY2024-25 tax tables (test: $80,000 salary → $14,788 + Medicare $1,600)
- [ ] Super guarantee at 11.5% of ordinary time earnings (test: $80,000 OTE → $9,200 super)
- [ ] Leave accrual: Full-time employee accrues 4 weeks annual leave per year (proportional each pay period)
- [ ] Leave deduction: Approved leave reduces balance and creates leave_transaction record
- [ ] Pay run reversal: Reverses all pay run lines, restores leave balances, marks pay run as "reversed"
- [ ] Pay run lifecycle: draft → calculate → process → complete (or draft → calculate → reverse)
- [ ] Chat answers "What was total payroll cost last month?" via payroll agent
- [ ] Chat answers "Show leave balances for all employees" via payroll agent
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: pay-run-schema-builder [PRIORITY: SUB-WAVE 1]
**Role**: Create pay run and leave tables in dual schema + migration SQL
**Task file**: `wave5-agent-tasks/01-pay-run-schema-builder.md`
**Creates**: docker/migrations/0017_pay_runs_leave.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: payg-calculator-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build PAYG withholding calculation engine with ATO FY2024-25 tax tables
**Task file**: `wave5-agent-tasks/02-payg-calculator-builder.md`
**Creates**: server/src/services/payroll/payg-calculator.ts
**Dependencies**: None — can start immediately

### Agent 3: super-calculator-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build superannuation guarantee calculator (11.5% OTE, caps, salary sacrifice)
**Task file**: `wave5-agent-tasks/03-super-calculator-builder.md`
**Creates**: server/src/services/payroll/super-calculator.ts
**Dependencies**: None — can start immediately

### Agent 4: pay-run-engine-builder [DEPENDS ON: Agents 1, 2, 3]
**Role**: Build pay run processing engine (create, calculate, process, reverse)
**Task file**: `wave5-agent-tasks/04-pay-run-engine-builder.md`
**Creates**: server/src/services/payroll/pay-run-engine.ts
**Dependencies**: Schema (Agent 1), PAYG calculator (Agent 2), Super calculator (Agent 3)

### Agent 5: leave-management-builder [DEPENDS ON: Agent 1]
**Role**: Build leave management service (types, balances, accrual, requests)
**Task file**: `wave5-agent-tasks/05-leave-management-builder.md`
**Creates**: server/src/services/payroll/leave-management.ts
**Dependencies**: Schema must exist (Agent 1)

### Agent 6: payroll-agent-enhancer [DEPENDS ON: Agents 4, 5]
**Role**: Add pay run and leave tools to existing payroll_agent
**Task file**: `wave5-agent-tasks/06-payroll-agent-enhancer.md`
**Modifies**: server/src/services/claude/agents/payroll-agent.ts, types.ts, config.ts
**Dependencies**: Pay run engine (Agent 4), Leave management (Agent 5)

### Agent 7: cognee-payroll-indexer [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for pay runs and leave patterns
**Task file**: `wave5-agent-tasks/07-cognee-payroll-indexer.md`
**Modifies**: server/src/services/claude/cognee-tools.ts
**Dependencies**: Schema must exist

### Agent 8: api-endpoints-builder [DEPENDS ON: Agents 4, 5, 6]
**Role**: Wire 15 new API routes for pay runs and leave
**Task file**: `wave5-agent-tasks/08-api-endpoints-builder.md`
**Modifies**: server/src/index.ts (or server/src/routes/payroll-routes.ts if route modules exist)
**Dependencies**: All backend services must exist

### Agent 9: ui-payroll-builder [DEPENDS ON: Agent 8]
**Role**: Build 6 pay run and leave UI components
**Task file**: `wave5-agent-tasks/09-ui-payroll-builder.md`
**Creates**: 6 new .tsx components in client/src/features/payroll/components/
**Modifies**: client/src/api.ts, PayrollDashboard.tsx
**Dependencies**: API routes must exist

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification plan, validate PAYG calculations, check tsc compliance
**Task file**: `wave5-agent-tasks/10-testing-validation-agent.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **types.ts lock**: Only Agent 6 modifies types.ts and config.ts
3. **index.ts lock**: Only Agent 8 modifies server/src/index.ts
4. **api.ts lock**: Only Agent 9 modifies client/src/api.ts
5. **Pattern compliance**: All new services follow existing payroll-agent.ts pattern
6. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
7. **Test before done**: `cd server && npx tsc --noEmit` must pass
8. **Marker naming**: Use `.agent-done-W05-{NN}` format
9. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation
10. **Index discipline**: Migration SQL MUST include CREATE INDEX for composite query patterns
11. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination, returning `{ data: T[], total: number }`
12. **Monetary amounts**: ALL monetary values stored as INTEGER (cents). Never use REAL/float for money.
13. **Australian tax compliance**: PAYG tables must match ATO Schedule 1 FY2024-25. Super rate must be 11.5%. **BOTH must be loaded from configurable tax-tables.ts, NOT hardcoded in calculator logic** (REVISION: D02 COMP-03).
14. **Pay run immutability** (REVISION: D02 COMP-05): Completed pay runs are IMMUTABLE. PATCH rejects with 409. Reversals create NEW pay runs.
15. **Batch DB operations** (REVISION: D03 B4): Multi-row writes MUST use batch INSERT within a single PostgreSQL transaction. No row-by-row inserts for pay run processing.
16. **Background job queue** (REVISION: D03 B4): Pay runs with >20 employees MUST be queued via `server/src/services/queue.ts`, returning 202 Accepted.
17. **Leave precision**: Leave balance calculations use REAL with 4 decimal places. Never integer-round hours.
18. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.
19. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| Marker naming collision | D05 §6 (P0) | Fixed: `.agent-done-W05-{NN}` format |
| Missing indexes | D03 §2.2 | Added index discipline to coordination rules + migration |
| Zod validation missing | D02 API-01 | Added Zod requirement to coordination rules |
| Pagination not standardized | D03 §4.3 | Added pagination standard to coordination rules |
| Monetary precision | D02 §Financial | All money as INTEGER cents, never REAL/float |
| PAYG table accuracy | D02 §Payroll | Must match ATO Schedule 1 exactly |
| Hardcoded tax tables | D02 COMP-03, D01 DC-08 | REVISION: Tax brackets loaded from configurable tax-tables.ts, FY-keyed |
| Hardcoded super rate | D02 COMP-02 | REVISION: Super rate loaded from config, not hardcoded 11.5% |
| Pay run immutability | D02 COMP-05 | REVISION: Completed pay runs immutable; reversals create NEW pay runs |
| Row-by-row processing | D03 B4 | REVISION: Batch INSERT + single transaction + background queue for >20 employees |
| Leave precision | D03/D02 | REVISION: Decimal precision (4 dp), never integer rounding for leave hours |

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 7
Sub-wave 3 (After 2):  Agent 6
Sub-wave 4 (After 3):  Agent 8
Sub-wave 5 (After 4):  Agent 9
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave5-agent-tasks/` for detailed atomic tasks with file paths and specs. Reference docs/wave0-master-plan.md for overall context.
