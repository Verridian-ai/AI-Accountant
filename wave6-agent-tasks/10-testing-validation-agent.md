# Agent 10: Testing & Validation Agent

## Role
Run verification plan, validate STP Phase 2 compliance, check tsc compilation for both server and client, and verify all Wave 6 deliverables.

## Priority: SUB-WAVE 6 (After All Agents Complete)

## Verification Checklist

### 1. TypeScript Compilation
- [ ] `cd server && npx tsc --noEmit` passes clean (zero errors)
- [ ] `cd client && npx tsc --noEmit` passes clean (zero errors)
- [ ] All new imports resolve correctly
- [ ] No circular dependencies introduced

### 2. STP Phase 2 Mandatory Fields

Verify by reading `stp-service.ts` that the XML builder includes ALL ATO-required fields:

- [ ] `GrossPayments` -- Total gross ordinary earnings
- [ ] `TotalTaxWithheld` -- PAYG tax withheld
- [ ] `SuperGuarantee` -- Employer SG contributions
- [ ] `ReportableEmployerSuperContributions` -- Salary sacrifice + employer extra
- [ ] `ReportableFringeBenefitsAmount` -- Fringe benefits
- [ ] `LumpSumPaymentA` -- Unused leave on termination (taxed component)
- [ ] `LumpSumPaymentB` -- Unused leave on termination (tax-free component)
- [ ] `LumpSumPaymentD` -- Tax-free component
- [ ] `LumpSumPaymentE` -- Back payments
- [ ] `EmploymentTerminationPaymentCode` -- ETP code (R, O, S, P, D, N, B, T)
- [ ] `EmploymentTerminationPaymentAmount` -- ETP value

### 3. STP Event Lifecycle

- [ ] Generate creates event with status='draft'
- [ ] Submit changes status to 'submitted'
- [ ] Cannot submit a non-draft event
- [ ] Finalisation event includes complete FY totals
- [ ] YTD calculation spans correct Australian FY (Jul 1 to Jun 30)

### 4. Modern Award Compliance

- [ ] Casual loading is exactly 25% (0.25)
- [ ] Overtime Tier 1 is 1.5x base rate (first 2 hours)
- [ ] Overtime Tier 2 is 2.0x base rate (beyond 2 hours)
- [ ] Rate lookup respects effective dates
- [ ] 3 default awards can be seeded:
  - Clerks-Private Sector Award 2020 (MA000002)
  - General Retail Industry Award 2020 (MA000004)
  - Manufacturing and Associated Industries Award 2020 (MA000010)

Test calculation by reading `award-service.ts`:
- [ ] **Level 1 Clerk, 38 ordinary hours, permanent**:
  - Pay: $24.73 x 38 = $939.74
- [ ] **Level 1 Clerk, 38 ordinary + 3 overtime hours, permanent**:
  - Ordinary: $24.73 x 38 = $939.74
  - OT Tier 1 (first 2 hrs): $24.73 x 1.5 x 2 = $74.19
  - OT Tier 2 (1 hr): $24.73 x 2.0 x 1 = $49.46
  - Total: $1,063.39
- [ ] **Level 1 Clerk, 20 ordinary hours, casual**:
  - Casual rate: $24.73 x 1.25 = $30.9125 per hr
  - Pay: $30.91 x 20 = $618.20 (or $618.25 depending on rounding)

### 5. Timesheet Workflow

- [ ] Draft to Submit flow works
- [ ] Submit to Approve flow works
- [ ] Submit to Reject returns to draft
- [ ] Cannot approve a draft timesheet
- [ ] Hours calculation from start/end accounts for breaks
- [ ] Bulk approve processes multiple timesheets
- [ ] Approved timesheets can feed into pay run line items

### 6. Payslip Validation

- [ ] Payslip HTML contains: header, employee details, earnings, deductions, summary, leave balances, YTD
- [ ] All monetary values correctly converted from cents to dollars
- [ ] YTD sums within correct Australian FY
- [ ] One payslip per employee per pay run
- [ ] `sentAt` timestamp set when payslips are distributed

### 7. Schema Validation

- [ ] All 7 new tables exist in `schema.ts` (SQLite):
  - stp_events, stp_employee_ytd, payslips, awards, award_rates, timesheets, timesheet_entries
- [ ] All 7 new tables exist in `postgres-schema.ts` (PostgreSQL)
- [ ] Migration `0018_stp_payslips_timesheets.sql` exists and is valid SQL
- [ ] Foreign keys reference correct tables:
  - stp_events.payRunId to pay_runs.id
  - stp_employee_ytd.stpEventId to stp_events.id (CASCADE)
  - stp_employee_ytd.employeeId to employees.id
  - payslips.payRunId to pay_runs.id
  - payslips.employeeId to employees.id
  - awards.userId to users.id
  - award_rates.awardId to awards.id (CASCADE)
  - timesheets.employeeId to employees.id
  - timesheets.payCategoryId to pay_categories.id
  - timesheets.approvedBy to users.id
  - timesheet_entries.timesheetId to timesheets.id (CASCADE)
- [ ] All monetary columns are INTEGER (cents) -- not REAL/float
- [ ] Indexes exist for composite query patterns

### 8. API Endpoints

- [ ] All 18 endpoints are registered in `index.ts`:
  - POST `/api/payroll/stp/generate/:payRunId`
  - POST `/api/payroll/stp/submit/:eventId`
  - GET `/api/payroll/stp/events`
  - GET `/api/payroll/stp/ytd/:employeeId`
  - POST `/api/payroll/stp/finalise/:year`
  - GET `/api/payroll/payslips/:payRunId`
  - GET `/api/payroll/payslips/:payRunId/:employeeId/pdf`
  - POST `/api/payroll/payslips/:payRunId/send`
  - GET `/api/payroll/awards`
  - POST `/api/payroll/awards`
  - GET `/api/payroll/awards/:id/rates`
  - GET `/api/payroll/timesheets`
  - POST `/api/payroll/timesheets`
  - POST `/api/payroll/timesheets/:id/approve`
  - GET `/api/payroll/reports/payg-summary/:year`
  - GET `/api/payroll/reports/super-report/:period`
  - GET `/api/payroll/reports/leave-report`
  - GET `/api/payroll/reports/payroll-summary/:period`
- [ ] All POST endpoints have Zod validation
- [ ] All list endpoints support pagination (`?offset=0&limit=50`)
- [ ] Error responses follow `{ error: string }` format

### 9. UI Components

- [ ] 7 new components exist:
  - STPDashboard.tsx, STPEventDetail.tsx, PayslipViewer.tsx
  - TimesheetEntry.tsx, TimesheetApproval.tsx, AwardManager.tsx, PayrollReports.tsx
- [ ] PayrollDashboard.tsx has sub-tabs for stp, payslips, timesheets, timesheet-approval, awards, reports
- [ ] `api.ts` has 18 new payrollApi methods
- [ ] Currency formatting uses `Intl.NumberFormat` with 'en-AU' and 'AUD'
- [ ] No external calendar or PDF libraries used
- [ ] Payslip HTML rendered in sandboxed iframe (not raw HTML injection)

### 10. Cognee Integration

- [ ] `COGNEE_DATASETS` includes `stpCompliance`, `awardRates`, `timesheetPatterns`
- [ ] `indexSTPEvent()` method exists with RAG_COMPLETION search type
- [ ] `searchSTPCompliance()` uses RAG_COMPLETION search type
- [ ] `indexAwardRate()` method exists with CHUNKS_LEXICAL search type
- [ ] `searchAwardRates()` uses CHUNKS_LEXICAL search type
- [ ] `indexTimesheetPattern()` method exists with GRAPH_COMPLETION search type
- [ ] `searchTimesheetPatterns()` uses GRAPH_COMPLETION search type
- [ ] `_moduleToDataset()` has `stp`, `timesheets`, `awards` mappings

### 11. Agent Enhancement

- [ ] Payroll agent has 10 total tools (5 from Wave 5 + 5 new):
  - Wave 5: calculate_payg_withholding, calculate_super_guarantee, generate_pay_run, process_pay_run, calculate_leave_entitlements
  - Wave 6: generate_stp_event, lodge_stp, generate_payslip, interpret_award, approve_timesheet
- [ ] types.ts extended with STP, payslip, award, timesheet fields
- [ ] config.ts has maxToolCalls >= 25 for payroll_agent

### 12. Marker Files

- [ ] All agent markers exist:
  - `.agent-done-W06-01` through `.agent-done-W06-09`
- [ ] Create final marker: `.agent-done-W06-10`

## Dependencies
- **All agents must complete before validation**
- Run `npx tsc --noEmit` for both server and client
- Read and verify key files -- do NOT modify any files (read-only verification)
