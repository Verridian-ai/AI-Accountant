# Agent 8: API Endpoints Builder

## Role
Wire 18 new API routes for STP, payslips, timesheets, awards, and payroll reports into the server. All routes under `/api/payroll/`.

## Priority: SUB-WAVE 4 (After Agents 2, 3, 4, 5, 6)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 18 new API endpoints for STP compliance, payslips, timesheets, awards, and payroll reports

**Location**: Add after existing payroll routes (Wave 5 pay run and leave endpoints)

**Service instantiation** (add near top of file with other service instantiations):
```typescript
import { STPService } from './services/payroll/stp-service.js';
import { PayslipService } from './services/payroll/payslip-service.js';
import { AwardService } from './services/payroll/award-service.js';
import { TimesheetService } from './services/payroll/timesheet-service.js';

const stpService = new STPService(db);
const payslipService = new PayslipService(db);
const awardService = new AwardService(db);
const timesheetService = new TimesheetService(db);
```

**Endpoints to add:**

#### STP Endpoints (5)

- [ ] **POST `/api/payroll/stp/generate/:payRunId`** — Generate STP event from pay run
  ```typescript
  app.post('/api/payroll/stp/generate/:payRunId', async (c) => {
    try {
      const payRunId = c.req.param('payRunId');
      const body = await c.req.json();
      const schema = z.object({
        eventType: z.enum(['pay_event', 'update', 'finalisation'])
      });
      const parsed = schema.parse(body);
      const userId = c.get('jwtPayload')?.userId ?? 'default';
      const result = await stpService.generateSTPEvent({
        userId, payRunId, eventType: parsed.eventType
      });
      return c.json(result, 201);
    } catch (error: any) {
      if (error instanceof z.ZodError) return c.json({ error: error.errors[0].message }, 400);
      console.error('Error generating STP event:', error);
      return c.json({ error: error.message ?? 'Internal server error' }, 500);
    }
  });
  ```

- [ ] **POST `/api/payroll/stp/submit/:eventId`** — Submit STP to ATO (mock)
  - Calls `stpService.submitToATO(eventId)`
  - Returns submission result

- [ ] **GET `/api/payroll/stp/events`** — List STP events
  - Query params: `status`, `offset`, `limit`
  - Calls `stpService.listSTPEvents({ userId, status, offset, limit })`
  - Returns `{ data: STPEvent[], total: number }`

- [ ] **GET `/api/payroll/stp/ytd/:employeeId`** — Employee YTD totals
  - Optional query param: `financialYear`
  - Calls `stpService.getEmployeeYTD(employeeId, financialYear)`
  - Returns YTD breakdown

- [ ] **POST `/api/payroll/stp/finalise/:year`** — EOFY finalisation event
  - Calls `stpService.generateFinalisation(userId, year)`
  - Returns finalisation event result

#### Payslip Endpoints (3)

- [ ] **GET `/api/payroll/payslips/:payRunId`** — Get payslips for pay run
  - Calls `payslipService.getPayslipsByPayRun(payRunId)`
  - Returns array of payslip records

- [ ] **GET `/api/payroll/payslips/:payRunId/:employeeId/pdf`** — Download payslip as HTML
  - Finds payslip for given pay run + employee
  - Calls `payslipService.getPayslipHTML(payslipId)`
  - Returns HTML with `Content-Type: text/html`

- [ ] **POST `/api/payroll/payslips/:payRunId/send`** — Send payslips to employees
  - Calls `payslipService.sendPayslips(payRunId)`
  - Returns `{ sent: number, failed: number }`

#### Award Endpoints (3)

- [ ] **GET `/api/payroll/awards`** — List awards
  - Calls `awardService.listAwards(userId)`
  - Returns array of awards

- [ ] **POST `/api/payroll/awards`** — Create award
  - Zod validation: `{ name: z.string(), code: z.string().optional(), effectiveDate: z.string(), expiryDate: z.string().optional() }`
  - Calls `awardService.createAward({ userId, ...parsed })`
  - Returns created award (201)

- [ ] **GET `/api/payroll/awards/:id/rates`** — Get award rates
  - Calls `awardService.getAwardRates(id)`
  - Returns array of rates

#### Timesheet Endpoints (3)

- [ ] **GET `/api/payroll/timesheets`** — List timesheets
  - Query params: `employeeId`, `status`, `startDate`, `endDate`, `offset`, `limit`
  - Calls `timesheetService.listTimesheets(params)`
  - Returns `{ data: Timesheet[], total: number }`

- [ ] **POST `/api/payroll/timesheets`** — Submit timesheet
  - Zod validation: `{ employeeId: z.string(), date: z.string(), startTime: z.string().optional(), endTime: z.string().optional(), breakMinutes: z.number().optional(), totalHours: z.number().optional(), payCategoryId: z.string().optional(), entries: z.array(z.object({ projectId: z.string().optional(), taskDescription: z.string().optional(), hours: z.number(), billable: z.boolean().optional() })).optional() }`
  - Calls `timesheetService.submitTimesheet(parsed)`
  - Returns created timesheet (201)

- [ ] **POST `/api/payroll/timesheets/:id/approve`** — Approve timesheet
  - Zod validation: `{ action: z.enum(['approve', 'reject']), reason: z.string().optional() }`
  - If action='approve': calls `timesheetService.approveTimesheet({ timesheetId: id, approvedBy: userId })`
  - If action='reject': calls `timesheetService.rejectTimesheet({ timesheetId: id, reason })`
  - Returns updated timesheet

#### Payroll Report Endpoints (4)

- [ ] **GET `/api/payroll/reports/payg-summary/:year`** — PAYG withholding summary
  - Queries all pay_run_summary rows for the FY
  - Groups by employee, sums taxWithheld
  - Returns `{ data: Array<{ employeeId, employeeName, grossPay, taxWithheld }>, totals: { totalGross, totalTax } }`

- [ ] **GET `/api/payroll/reports/super-report/:period`** — Super contributions report
  - Period format: 'YYYY-Q1' through 'YYYY-Q4' (Australian quarters)
  - Queries pay_run_summary within quarter dates
  - Groups by employee, sums superGuarantee + superSalarySacrifice
  - Returns `{ data: Array<{ employeeId, employeeName, superGuarantee, superSalarySacrifice, total }>, totals }`

- [ ] **GET `/api/payroll/reports/leave-report`** — Leave balances report
  - Queries all leave_balances joined with employees and leave_types
  - Returns `{ data: Array<{ employeeId, employeeName, leaveType, balance, accrued, taken }> }`

- [ ] **GET `/api/payroll/reports/payroll-summary/:period`** — Payroll cost summary
  - Period format: 'YYYY-MM' (monthly)
  - Queries pay_runs within month
  - Returns `{ data: { totalGross, totalTax, totalSuper, totalNet, payRunCount, employeeCount }, payRuns: Array<{ id, payDate, status, totalGross, totalNet }> }`

**Implementation pattern** for each endpoint:
```typescript
app.get('/api/payroll/reports/leave-report', async (c) => {
  try {
    const userId = c.get('jwtPayload')?.userId ?? 'default';
    // Query DB directly for reports (no dedicated service method needed)
    const results = await db.select()...
    return c.json({ data: results });
  } catch (error: any) {
    console.error('Error generating leave report:', error);
    return c.json({ error: error.message ?? 'Internal server error' }, 500);
  }
});
```

## Verification
- [ ] All 18 endpoints compile and have correct HTTP method/path
- [ ] All POST endpoints have Zod request body validation
- [ ] All list endpoints support `?offset=0&limit=50` pagination
- [ ] Error responses follow `{ error: string }` format
- [ ] Service imports resolve correctly
- [ ] No conflicts with existing Wave 5 payroll routes
- [ ] Report endpoints correctly handle Australian FY and quarter dates
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-08`

## Dependencies
- **Agent 2**: STPService must exist
- **Agent 3**: PayslipService must exist
- **Agent 4**: AwardService must exist
- **Agent 5**: TimesheetService must exist
- **Agent 6**: Payroll agent enhanced (for chat-based invocation)
- **Coordination rule**: Only Agent 8 modifies `server/src/index.ts`
