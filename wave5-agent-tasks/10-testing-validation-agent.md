# Agent 10: Testing & Validation Agent

## Role
Run verification plan, validate PAYG calculations against ATO tables, check tsc compliance for both server and client, and verify all Wave 5 deliverables.

## Priority: SUB-WAVE 6 (After All Agents Complete)

## Verification Checklist

### 1. TypeScript Compilation
- [ ] `cd server && npx tsc --noEmit` passes clean (zero errors)
- [ ] `cd client && npx tsc --noEmit` passes clean (zero errors)
- [ ] All new imports resolve correctly
- [ ] No circular dependencies introduced

### 2. PAYG Withholding Accuracy (ATO FY2024-25)

Test these scenarios by reading `payg-calculator.ts` and verifying the bracket logic:

- [ ] **$80,000 annual salary, resident, tax-free threshold**:
  - Tax: $4,288 + 30% × ($80,000 - $45,000) = $4,288 + $10,500 = $14,788
  - Medicare: 2% × $80,000 = $1,600
  - Total PAYG: ~$16,388/year
  - Fortnightly: ~$630.31

- [ ] **$50,000 annual, resident, tax-free, no HELP**:
  - Tax: $0 + 16% × ($50,000 - $18,200) = $5,088
  - Medicare: 2% × $50,000 = $1,000
  - Total: ~$6,088/year

- [ ] **$200,000 annual, resident, tax-free, HELP debt**:
  - Tax: $51,638 + 45% × ($200,000 - $190,000) = $51,638 + $4,500 = $56,138
  - Medicare: 2% × $200,000 = $4,000
  - HELP: 10% × $200,000 = $20,000
  - Total: ~$80,138/year

- [ ] **$100,000 annual, non-resident**:
  - Tax: 30% × $100,000 = $30,000 (no tax-free threshold)
  - No Medicare levy for non-residents
  - Total: $30,000/year

- [ ] **$40,000 annual, working holiday maker**:
  - Tax: 15% × $40,000 = $6,000 (flat 15% to $45k)
  - Total: $6,000/year

### 3. Superannuation Guarantee

- [ ] SG rate is exactly 11.5% (not 11%, not 12%)
- [ ] $80,000 OTE → $9,200 super ($80,000 × 0.115)
- [ ] $300,000 OTE → SG capped at $260,280 × 0.115 = $29,932.20 → rounded to nearest cent
- [ ] Salary sacrifice of $5,000 on $80,000: SG still = $9,200 (on pre-sacrifice OTE)
- [ ] Under-18, 20hrs/week → exempt, SG = $0
- [ ] Under-18, 35hrs/week → NOT exempt

### 4. Leave Accrual

- [ ] Full-time employee (38 hrs/week) accrues 4 weeks annual leave per year
  - Per fortnight: 152 hours / 26 = ~5.846 hours
  - Per month: 152 hours / 12 = ~12.667 hours
- [ ] Part-time employee (20 hrs/week) accrues pro-rata:
  - Annual = 152 × (20/38) = ~80 hours/year
- [ ] Casual employees: NO leave accrual
- [ ] Personal/Carer's leave: 10 days (76 hours) per year for full-time

### 5. Pay Run Lifecycle

- [ ] Draft → Calculate → Process → Complete flow works
- [ ] Draft → Calculate → Reverse flow works (can reverse after calculate but before process)
- [ ] Cannot process a non-draft pay run
- [ ] Cannot reverse a non-completed pay run
- [ ] Reversal creates negative leave_transactions
- [ ] Leave balances are updated correctly after process and reversal

### 6. Schema Validation

- [ ] All 7 new tables exist in `schema.ts` (SQLite):
  - pay_runs, pay_run_lines, pay_run_summary, leave_types, leave_balances, leave_requests, leave_transactions
- [ ] All 7 new tables exist in `postgres-schema.ts` (PostgreSQL)
- [ ] Migration `0017_pay_runs_leave.sql` exists and is valid SQL
- [ ] Foreign keys reference correct tables
- [ ] All monetary columns are INTEGER (cents)
- [ ] Indexes exist for: `(userId, status)` on pay_runs, `(payRunId, employeeId)` UNIQUE on pay_run_summary, `(employeeId, leaveTypeId)` UNIQUE on leave_balances

### 7. API Endpoints

- [ ] All 15 endpoints are registered in `index.ts`:
  - GET/POST `/api/payroll/pay-runs`
  - GET `/api/payroll/pay-runs/:id`
  - POST `/api/payroll/pay-runs/:id/calculate`
  - POST `/api/payroll/pay-runs/:id/process`
  - POST `/api/payroll/pay-runs/:id/reverse`
  - GET `/api/payroll/pay-runs/:id/lines`
  - POST `/api/payroll/pay-runs/:id/lines`
  - GET/POST `/api/payroll/leave/types`
  - GET `/api/payroll/leave/balances/:employeeId`
  - POST `/api/payroll/leave/request`
  - POST `/api/payroll/leave/request/:id/approve`
  - POST `/api/payroll/leave/request/:id/reject`
  - GET `/api/payroll/leave/calendar`
- [ ] All POST endpoints have Zod validation
- [ ] All list endpoints support pagination (`?offset=0&limit=50`)

### 8. UI Components

- [ ] 6 new components exist:
  - PayRunWizard.tsx, PayRunDetail.tsx, PayRunHistory.tsx
  - LeaveManagement.tsx, LeaveCalendar.tsx, LeaveRequestForm.tsx
- [ ] PayrollDashboard.tsx has sub-tabs for pay-runs, leave, leave-calendar
- [ ] `api.ts` has 15 new payrollApi methods
- [ ] No external calendar library used (CSS grid)
- [ ] Currency formatting uses `Intl.NumberFormat` with 'en-AU' and 'AUD'

### 9. Cognee Integration

- [ ] `COGNEE_DATASETS` includes `payRunHistory` and `leavePatterns`
- [ ] `indexPayRun()` method exists
- [ ] `searchPayRunHistory()` uses CHUNKS search type
- [ ] `indexLeavePattern()` method exists
- [ ] `searchLeavePatterns()` uses GRAPH_COMPLETION search type
- [ ] `_moduleToDataset()` has `payruns` and `leave` mappings

### 10. Agent Enhancement

- [ ] Payroll agent has 5 new tools: calculate_payg_withholding, calculate_super_guarantee, generate_pay_run, process_pay_run, calculate_leave_entitlements
- [ ] types.ts extended with new PayrollAgentInput/Output fields
- [ ] config.ts has increased maxToolCalls for payroll_agent

### 11. Marker Files

- [ ] All agent markers exist:
  - `.agent-done-W05-01` through `.agent-done-W05-09`
- [ ] Create final marker: `.agent-done-W05-10`

## Dependencies
- **All agents must complete before validation**
- Run `npx tsc --noEmit` for both server and client
- Read and verify key files — do NOT modify any files (read-only verification)
