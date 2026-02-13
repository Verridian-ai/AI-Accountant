# Wave 6 — STP Compliance & Payroll Reporting — Orchestration Prompt

You are the **Team Lead** for Wave 6: STP Compliance & Payroll Reporting. You coordinate 10 specialized agents to add Single Touch Payroll (STP) Phase 2 compliance, payslip generation, timesheet management, Modern Award interpretation, and comprehensive payroll reporting to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 6, lines ~910–930)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 5)
- 11 original Claude agents + enhanced `payroll_agent` with employee management, pay run, and leave tools
- SQLite + PostgreSQL dual schema synchronized
- Employee management + pay run processing + leave management operational
- PAYG withholding calculator (ATO FY2024-25 tax tables)
- Super guarantee calculator (11.5% OTE)
- Leave accrual (NES: annual, personal/carer's, long service)
- Cognee datasets: `employee_profiles`, `pay_structures`, `pay_run_history`, `leave_patterns`
- 17 migrations (0009–0017) applied
- `features/payroll/` folder with PayrollDashboard, EmployeeList, EmployeeDetail, EmployeeOnboarding, PayCategoryManager, PayStructureEditor, PayRunWizard, PayRunDetail, PayRunHistory, LeaveManagement, LeaveCalendar, LeaveRequestForm

## Dependencies
- **Requires**: Wave 5 complete (pay runs, leave management, PAYG calculator, super calculator)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (7 tables)
| Table | Columns |
|-------|---------|
| `stp_events` | id, userId, payRunId FK→pay_runs, eventType ('pay_event'\|'update'\|'finalisation'), status ('draft'\|'submitted'\|'accepted'\|'rejected'\|'error'), submissionDate, atoResponseId, xmlPayload **(ENCRYPTED — REVISION D02 CRIT-04)**, errorMessage, retryCount INTEGER DEFAULT 0, createdAt |
| `stp_employee_ytd` | id, stpEventId FK→stp_events, employeeId FK→employees, grossPayments INTEGER, ordinaryTimeEarnings INTEGER, overtimePayments INTEGER, bonusesCommissions INTEGER, paidLeave INTEGER, allowancesIncome INTEGER, taxWithheld INTEGER, superGuarantee INTEGER, reportableSuper INTEGER, rfba INTEGER, lumpSumA INTEGER, lumpSumB INTEGER, lumpSumD INTEGER, lumpSumE INTEGER, etpCode, etpAmount INTEGER, incomeStreamCode, taxTreatmentCode, employmentBasis, cessationType, cessationDate **(REVISION: D02 COMP-01 — Phase 2 mandatory fields)** |
| `payslips` | id, payRunId FK→pay_runs, employeeId FK→employees, payPeriodStart, payPeriodEnd, payDate, grossPay INTEGER, taxWithheld INTEGER, superAmount INTEGER, netPay INTEGER, pdfPath, sentAt, createdAt |
| `awards` | id, userId, name, code, effectiveDate, expiryDate, isActive BOOLEAN, createdAt |
| `award_rates` | id, awardId FK→awards, classification, level, hourlyRate INTEGER, casualLoading REAL, overtimeMultiplier REAL, effectiveDate |
| `timesheets` | id, employeeId FK→employees, date, startTime, endTime, breakMinutes INTEGER, totalHours REAL, payCategoryId FK→pay_categories, status ('draft'\|'submitted'\|'approved'), approvedBy FK→users, createdAt |
| `timesheet_entries` | id, timesheetId FK→timesheets, projectId, taskDescription, hours REAL, billable BOOLEAN |

**Migration**: `docker/migrations/0018_stp_payslips_timesheets.sql`

### Foreign Key Map
```
stp_events.userId → users.id
stp_events.payRunId → pay_runs.id
stp_employee_ytd.stpEventId → stp_events.id (CASCADE)
stp_employee_ytd.employeeId → employees.id
payslips.payRunId → pay_runs.id
payslips.employeeId → employees.id
awards.userId → users.id
award_rates.awardId → awards.id (CASCADE)
timesheets.employeeId → employees.id
timesheets.payCategoryId → pay_categories.id
timesheets.approvedBy → users.id
timesheet_entries.timesheetId → timesheets.id (CASCADE)
```

### Recommended Indexes
- `stp_events`: `(userId, status)`, `(payRunId)`
- `stp_employee_ytd`: `(stpEventId)`, `(employeeId)`
- `payslips`: `(payRunId)`, `(employeeId)`
- `awards`: `(userId, isActive)`
- `award_rates`: `(awardId, classification)`
- `timesheets`: `(employeeId, date)`, `(status)`
- `timesheet_entries`: `(timesheetId)`

## API Endpoints (18 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/payroll/stp/generate/:payRunId | Generate STP event from pay run |
| POST | /api/payroll/stp/submit/:eventId | Submit STP to ATO (mock) |
| GET | /api/payroll/stp/events | List STP events |
| GET | /api/payroll/stp/ytd/:employeeId | Employee YTD totals |
| POST | /api/payroll/stp/finalise/:year | EOFY finalisation event |
| GET | /api/payroll/payslips/:payRunId | Get payslips for pay run |
| GET | /api/payroll/payslips/:payRunId/:employeeId/pdf | Download payslip PDF |
| POST | /api/payroll/payslips/:payRunId/send | Email payslips to employees |
| GET | /api/payroll/awards | List awards |
| POST | /api/payroll/awards | Create award |
| GET | /api/payroll/awards/:id/rates | Get award rates |
| GET | /api/payroll/timesheets | List timesheets |
| POST | /api/payroll/timesheets | Submit timesheet |
| POST | /api/payroll/timesheets/:id/approve | Approve timesheet |
| GET | /api/payroll/reports/payg-summary/:year | PAYG withholding summary |
| GET | /api/payroll/reports/super-report/:period | Super contributions report |
| GET | /api/payroll/reports/leave-report | Leave balances report |
| GET | /api/payroll/reports/payroll-summary/:period | Payroll cost summary |

## UI Components
### `client/src/features/payroll/components/` — Extend existing payroll feature
- **STPDashboard.tsx** — STP event list with status badges (draft/submitted/accepted/rejected). YTD employee totals view. EOFY finalisation button with confirmation dialog. ATO response viewer.
- **STPEventDetail.tsx** — Individual STP event: employee YTD breakdown table, XML preview (collapsible), submission status timeline, ATO response details.
- **PayslipViewer.tsx** — View/download payslips for a pay run. Per-employee list with PDF download links. Bulk email send button. Payslip preview showing earnings, deductions, super, net.
- **TimesheetEntry.tsx** — Weekly timesheet grid: days × time entries. Start/end time, break minutes, total hours auto-calc. Project/task allocation. Submit button.
- **TimesheetApproval.tsx** — Manager approval interface: pending timesheets list, approve/reject with comments, bulk approve button. Shows employee, week, total hours, status.
- **AwardManager.tsx** — Modern Award management: create awards, define classifications/levels with hourly rates, casual loading, overtime multipliers. Effective date management.
- **PayrollReports.tsx** — Tabbed reporting dashboard: PAYG Summary, Super Report, Leave Report, Payroll Cost Summary. Date range/period selectors, data tables, export to CSV.

### Modified Components
- **PayrollDashboard.tsx** — Add sub-tabs for `stp`, `payslips`, `timesheets`, `awards`, `reports`
- **client/src/api.ts** — Extend `payrollApi` object with ~18 new methods for STP, payslips, timesheets, awards, reports

**Navigation**: No new tabs needed — extends existing `payroll` tab from Wave 4

## New Claude Agents
**None** — Wave 6 enhances the existing `payroll_agent` with new tools:
- `generate_stp_event` — Generate STP Phase 2 XML from pay run data
- `lodge_stp` — Submit STP event to ATO (mock endpoint)
- `generate_payslip` — Generate payslip PDF for employee
- `interpret_award` — Look up Modern Award classification rates
- `approve_timesheet` — Process timesheet approval workflow

## Australian STP Phase 2 Specifics

### STP Phase 2 Mandatory Fields
| Field | ATO Label | Description |
|-------|-----------|-------------|
| Gross Payments | `GrossPayments` | Total gross ordinary earnings |
| PAYG Withholding | `TotalTaxWithheld` | Tax withheld per ATO tables |
| Super Guarantee | `SuperGuarantee` | Employer SG contributions |
| Reportable Super | `ReportableEmployerSuperContributions` | Salary sacrifice + employer extra |
| RFBA | `ReportableFringeBenefitsAmount` | Fringe benefits (if any) |
| Lump Sum A | `LumpSumPaymentA` | Unused leave on termination (taxed) |
| Lump Sum B | `LumpSumPaymentB` | Unused leave on termination (tax-free component) |
| Lump Sum D | `LumpSumPaymentD` | Tax-free component |
| Lump Sum E | `LumpSumPaymentE` | Back payments |
| ETP Code | `EmploymentTerminationPaymentCode` | R, O, S, P, D, N, B, T |
| ETP Amount | `EmploymentTerminationPaymentAmount` | ETP value |

### STP Event Types
- `pay_event` — Regular pay run reporting (each pay cycle)
- `update` — Correction to a previous event
- `finalisation` — EOFY finalisation (due 14 July)

### STP XML Structure (Simplified)
```xml
<STPReport>
  <Header>
    <SoftwareId>GOLDLEDGER_V1</SoftwareId>
    <ABN>12345678901</ABN>
    <PaymentDate>2025-01-15</PaymentDate>
    <EventType>PAY_EVENT</EventType>
  </Header>
  <Employees>
    <Employee>
      <TFN>123456789</TFN>
      <FullName>John Smith</FullName>
      <GrossPayments>385000</GrossPayments>
      <TotalTaxWithheld>82500</TotalTaxWithheld>
      <SuperGuarantee>44275</SuperGuarantee>
      <!-- YTD figures -->
    </Employee>
  </Employees>
</STPReport>
```

### Modern Awards
- Awards set minimum pay rates by classification/level
- Common awards: Clerks–Private Sector Award, General Retail Industry Award, Manufacturing Award
- Casual loading: typically 25% on top of base rate
- Overtime multipliers: 1.5× first 2 hours, 2× thereafter (varies by award)

## Cognee Integration
- **New datasets**: `stp_compliance` (RAG_COMPLETION), `award_rates` (CHUNKS_LEXICAL), `timesheet_patterns` (GRAPH_COMPLETION)
- **New CogneeTools methods**:
  - `indexSTPEvent(event)` — Index STP events for compliance queries
  - `searchSTPCompliance(query)` — "What are our STP obligations for Q2?"
  - `indexAwardRate(rate)` — Index award rate data for lookups
  - `searchAwardRates(query)` — "What's the Level 3 clerk hourly rate?"
  - `indexTimesheetPattern(pattern)` — Index timesheet patterns
- **Module mapping**: Add `stp: stp_compliance`, `timesheets: timesheet_patterns` to `_moduleToDataset()`

## Security & Compliance Requirements (REVISION: D02)

> **REVISION NOTE:** These requirements were added based on D02 (Security & Compliance) debate review findings.

1. **STP XML TFN Encryption (D02 CRIT-04 — CRITICAL)**: The `stp_events.xmlPayload` column stores STP XML containing employee TFNs. This payload MUST be ENCRYPTED at rest using AES-256-GCM (same encryption utility as Wave 4's TFN encryption). Decrypt ONLY when transmitting to ATO or when explicitly viewing event detail with `includeXml=true`. The `GET /api/payroll/stp/events` list endpoint MUST NEVER include xmlPayload in responses. Every decryption must be audit-logged.

2. **STP Phase 2 Completeness (D02 COMP-01)**: The STP XML MUST include ALL ATO Phase 2 mandatory fields:
   - `IncomeStreamCode`, `TaxTreatmentCode`, `PaymentFrequency`
   - `PayeeBirthDate`, `PayeeResidenceCountry`, `CountryCode`
   - `EmploymentBasis`, `CessationType`, `CessationDate`
   - Disaggregated gross: `OrdinaryTimeEarnings`, `OvertimePayments`, `BonusesCommissions`, `PaidLeave`, `AllowancesIncome`

3. **ATO Certificate Management (D02)**: Design `submitToATO()` with a pluggable submission adapter pattern. `MockSTPAdapter` for dev, `ATOSTPAdapter` for production with ATO digital certificate support. Selected via `ATO_STP_MODE` env var.

4. **STP Failure Error Handling (D02)**: When ATO submission fails: retry up to 3 times with exponential backoff, set status='error' with errorMessage, notify admin via SSE. Add `retryCount` and `errorMessage` columns to `stp_events`.

5. **Timesheet Approval Authorization (D02)**: Timesheet approval (`POST /api/payroll/timesheets/:id/approve`) MUST require manager role. Employees cannot approve their own timesheets. Bulk approve enforces the same constraint.

## Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| `ATO_STP_ENDPOINT` | ATO STP submission URL (mock for dev) | `https://mock-ato.goldledger.dev/stp` |
| `ATO_STP_SOFTWARE_ID` | Registered software ID | `GOLDLEDGER_V1` |
| `ATO_STP_CERT_PATH` | Path to ATO digital certificate | `/app/certs/ato.pem` |
| `PAYSLIP_TEMPLATE_DIR` | Directory for payslip HTML templates | `/app/templates/payslips` |
| `ATO_STP_MODE` | STP submission mode: 'mock' or 'production' (REVISION: D02) | `mock` |

## Testing Criteria
- [ ] STP Phase 2 event contains all mandatory ATO fields (gross, tax, super, reportable super, RFBA, lump sums, ETP)
- [ ] STP XML structure validates against expected schema
- [ ] Payslip contains correct earnings, deductions, super, and net amounts matching pay run
- [ ] Award rates correctly apply casual loading (25%) and overtime multipliers (1.5×, 2×)
- [ ] Timesheet → pay run flow: approved timesheet hours feed into pay run line items
- [ ] PAYG summary report matches sum of all pay runs for the year
- [ ] Super report shows employer SG + salary sacrifice per employee per quarter
- [ ] Chat answers "Show STP events for this quarter" via payroll agent
- [ ] Chat answers "What's the Level 2 clerk hourly rate?" via payroll agent
- [ ] **(REVISION D02 CRIT-04)** STP xmlPayload is encrypted in DB — raw query does NOT show plaintext TFNs
- [ ] **(REVISION D02 CRIT-04)** GET /api/payroll/stp/events response does NOT include xmlPayload field
- [ ] **(REVISION D02 COMP-01)** STP XML contains IncomeStreamCode, TaxTreatmentCode, EmploymentBasis, PayeeBirthDate, disaggregated gross
- [ ] **(REVISION D02)** Timesheet approval rejects non-manager users with 403
- [ ] **(REVISION D02)** STP submission failure sets status='error' and stores errorMessage
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: stp-data-model-builder [PRIORITY: SUB-WAVE 1]
**Role**: Create STP, payslip, award, and timesheet tables in dual schema + migration SQL
**Task file**: `wave6-agent-tasks/01-stp-data-model-builder.md`
**Creates**: docker/migrations/0018_stp_payslips_timesheets.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: stp-event-generator [PRIORITY: SUB-WAVE 2]
**Role**: Build STP Phase 2 event generation service with XML payload construction
**Task file**: `wave6-agent-tasks/02-stp-event-generator.md`
**Creates**: server/src/services/payroll/stp-service.ts
**Dependencies**: Schema (Agent 1)

### Agent 3: payslip-generator [PRIORITY: SUB-WAVE 2]
**Role**: Build payslip generation service with HTML-to-PDF rendering
**Task file**: `wave6-agent-tasks/03-payslip-generator.md`
**Creates**: server/src/services/payroll/payslip-service.ts
**Dependencies**: Schema (Agent 1)

### Agent 4: award-interpreter [PRIORITY: SUB-WAVE 2]
**Role**: Build Modern Award interpretation service with rate lookups and loading calculations
**Task file**: `wave6-agent-tasks/04-award-interpreter.md`
**Creates**: server/src/services/payroll/award-service.ts
**Dependencies**: Schema (Agent 1)

### Agent 5: timesheet-builder [PRIORITY: SUB-WAVE 2]
**Role**: Build timesheet management service (submit, approve, reject, feed to pay run)
**Task file**: `wave6-agent-tasks/05-timesheet-builder.md`
**Creates**: server/src/services/payroll/timesheet-service.ts
**Dependencies**: Schema (Agent 1)

### Agent 6: payroll-agent-enhancer [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Add STP, payslip, award, and timesheet tools to existing payroll_agent
**Task file**: `wave6-agent-tasks/06-payroll-agent-enhancer.md`
**Modifies**: server/src/services/claude/agents/payroll-agent.ts, types.ts, config.ts
**Dependencies**: All Wave 6 services must exist

### Agent 7: cognee-payroll-compliance [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for STP compliance, award rates, and timesheet patterns
**Task file**: `wave6-agent-tasks/07-cognee-payroll-compliance.md`
**Modifies**: server/src/services/claude/cognee-tools.ts
**Dependencies**: Schema must exist

### Agent 8: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5, 6]
**Role**: Wire 18 new API routes for STP, payslips, timesheets, awards, and reports
**Task file**: `wave6-agent-tasks/08-api-endpoints-builder.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist

### Agent 9: ui-payroll-reporting-builder [DEPENDS ON: Agent 8]
**Role**: Build 7 STP, payslip, timesheet, award, and report UI components
**Task file**: `wave6-agent-tasks/09-ui-payroll-reporting-builder.md`
**Creates**: 7 new .tsx components in client/src/features/payroll/components/
**Modifies**: client/src/api.ts, PayrollDashboard.tsx
**Dependencies**: API routes must exist

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification plan, validate STP fields, check tsc compliance
**Task file**: `wave6-agent-tasks/10-testing-validation-agent.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **types.ts lock**: Only Agent 6 modifies types.ts and config.ts
3. **index.ts lock**: Only Agent 8 modifies server/src/index.ts
4. **api.ts lock**: Only Agent 9 modifies client/src/api.ts
5. **Pattern compliance**: All new services follow existing payroll service patterns
6. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
7. **Test before done**: `cd server && npx tsc --noEmit` must pass
8. **Marker naming**: Use `.agent-done-W06-{NN}` format
9. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation
10. **Index discipline**: Migration SQL MUST include CREATE INDEX for composite query patterns
11. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination, returning `{ data: T[], total: number }`
12. **Monetary amounts**: ALL monetary values stored as INTEGER (cents). Never use REAL/float for money.
13. **STP compliance**: XML payload must include all Phase 2 mandatory fields per ATO specification
14. **No external PDF library**: Use simple HTML-to-string payslip generation; actual PDF rendering deferred to client or future wave
15. **STP XML encryption** (REVISION: D02 CRIT-04): `xmlPayload` MUST be encrypted at rest using AES-256-GCM. Decrypt only for ATO submission or explicit detail view. NEVER include in list responses.
16. **STP Phase 2 completeness** (REVISION: D02 COMP-01): XML must include ALL Phase 2 mandatory fields including IncomeStreamCode, TaxTreatmentCode, employment basis, disaggregated gross.
17. **Timesheet approval authorization** (REVISION: D02): Approval requires manager role. Self-approval prevented. Enforced in both single and bulk approve.
18. **STP error handling** (REVISION: D02): Submission failures retry 3× with backoff, set error status, notify admin via SSE.
19. **Pluggable STP adapter** (REVISION: D02): Mock for dev, production adapter for ATO certificates. Selected via `ATO_STP_MODE` env var.
20. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.
21. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| Marker naming collision | D05 §6 (P0) | Fixed: `.agent-done-W06-{NN}` format |
| Missing indexes | D03 §2.2 | Added index discipline to coordination rules + migration |
| Zod validation missing | D02 API-01 | Added Zod requirement to coordination rules |
| Pagination not standardized | D03 §4.3 | Added pagination standard to coordination rules |
| Monetary precision | D02 §Financial | All money as INTEGER cents, never REAL/float |
| STP field completeness | D02 §Payroll | Must include all Phase 2 mandatory fields |
| STP XML TFN plaintext | D02 CRIT-04 | REVISION: xmlPayload ENCRYPTED at rest (AES-256-GCM), decrypt only for ATO/detail view |
| STP Phase 2 missing fields | D02 COMP-01 | REVISION: Added IncomeStreamCode, TaxTreatmentCode, EmploymentBasis, PayeeBirthDate, ResidenceCountry, disaggregated gross |
| ATO certificate management | D02 | REVISION: Pluggable submission adapter (mock/production) with cert support |
| STP failure handling | D02 | REVISION: Retry 3× with backoff, error status, admin notification via SSE |
| Timesheet approval auth | D02 | REVISION: Manager role required for approval, self-approval prevented |

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1
Sub-wave 2 (After 1):  Agent 2 + Agent 3 + Agent 4 + Agent 5 + Agent 7
Sub-wave 3 (After 2):  Agent 6
Sub-wave 4 (After 3):  Agent 8
Sub-wave 5 (After 4):  Agent 9
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave6-agent-tasks/` for detailed atomic tasks with file paths and specs. Reference docs/wave0-master-plan.md for overall context.
