# Agent 5: Timesheet Builder

## Role
Build the timesheet management service with submit/approve/reject workflow, automatic hours calculation from start/end times, and integration with the pay run pipeline.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payroll/timesheet-service.ts`
**Purpose**: Timesheet CRUD, approval workflow, and pay run integration

**Class**: `TimesheetService`
**Constructor**: `constructor(private db: any)`

**Interfaces**:

```typescript
interface TimesheetInput {
  employeeId: string;
  date: string;           // YYYY-MM-DD
  startTime?: string;     // HH:MM (24hr)
  endTime?: string;       // HH:MM (24hr)
  breakMinutes?: number;
  totalHours?: number;    // Manual entry if no start/end
  payCategoryId?: string;
  entries?: Array<{
    projectId?: string;
    taskDescription?: string;
    hours: number;
    billable?: boolean;
  }>;
}

interface TimesheetApprovalInput {
  timesheetId: string;
  approvedBy: string;     // userId
}

interface TimesheetRejectionInput {
  timesheetId: string;
  reason?: string;
}

interface TimesheetListParams {
  employeeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  offset?: number;
  limit?: number;
}

interface TimesheetListResult {
  data: Array<Timesheet & { entries: TimesheetEntry[]; employeeName?: string }>;
  total: number;
}

interface TimesheetToPayRunResult {
  timesheetIds: string[];
  payRunLines: Array<{
    employeeId: string;
    payCategoryId: string;
    hours: number;
    rate: number;    // cents
    amount: number;  // cents
    description: string;
  }>;
}
```

**Methods**:

- [ ] **`submitTimesheet(input: TimesheetInput): Promise<Timesheet>`**
  - Validates required fields
  - If startTime and endTime provided, calculates totalHours:
    ```
    totalMinutes = (endTimeMinutes - startTimeMinutes) - breakMinutes
    totalHours = totalMinutes / 60
    ```
  - If totalHours provided directly, uses that value
  - Generates UUID for timesheet ID
  - Inserts timesheet with status='submitted'
  - If entries provided, inserts timesheet_entries rows
  - Returns created timesheet

- [ ] **`createDraft(input: TimesheetInput): Promise<Timesheet>`**
  - Same as submitTimesheet but with status='draft'
  - Used for saving work-in-progress timesheets

- [ ] **`approveTimesheet(input: TimesheetApprovalInput): Promise<Timesheet>`**
  - Validates timesheet status is 'submitted' (cannot approve draft)
  - **REVISION (D02)**: Validates that `approvedBy` user has manager role — not just any authenticated user. Check user role from users table or session. An employee CANNOT approve their own timesheet (approvedBy !== timesheet.employeeId).
  - Sets status='approved', approvedBy=input.approvedBy
  - Returns updated timesheet

- [ ] **`rejectTimesheet(input: TimesheetRejectionInput): Promise<Timesheet>`**
  - Validates timesheet status is 'submitted'
  - Sets status='draft' (returns to draft for re-submission)
  - Optionally stores rejection reason (logged but not persisted in current schema)
  - Returns updated timesheet

- [ ] **`listTimesheets(params: TimesheetListParams): Promise<TimesheetListResult>`**
  - Paginated list with filters
  - Joins with employees table for employee name
  - Includes timesheet entries for each timesheet
  - Supports filtering by: employeeId, status, date range
  - Default limit: 50, offset: 0

- [ ] **`getTimesheet(timesheetId: string): Promise<Timesheet & { entries: TimesheetEntry[] }>`**
  - Returns single timesheet with all entries

- [ ] **`getApprovedTimesheetsForPayRun(employeeIds: string[], periodStart: string, periodEnd: string): Promise<TimesheetToPayRunResult>`**
  - Fetches all approved timesheets for given employees within date range
  - Groups hours by employee and pay category
  - Looks up pay rate from employee's pay structure
  - Returns pay run line items ready for insertion
  - This is the bridge between timesheets and pay runs

- [ ] **`bulkApprove(timesheetIds: string[], approvedBy: string): Promise<{ approved: number; skipped: number }>`**
  - **REVISION (D02)**: Validates that `approvedBy` user has manager role before processing
  - Approves multiple timesheets at once
  - Skips timesheets that are not in 'submitted' status
  - Skips timesheets where `approvedBy === timesheet.employeeId` (self-approval prevention)
  - Returns count of approved and skipped

- [ ] **`_calculateHours(startTime: string, endTime: string, breakMinutes: number): number`** (private)
  - Parses HH:MM strings to minutes since midnight
  - Calculates: `(endMinutes - startMinutes - breakMinutes) / 60`
  - Handles overnight shifts: if endTime < startTime, adds 24 hours to end
  - Rounds to 2 decimal places

## Verification
- [ ] Hours calculation from start/end times accounts for breaks
- [ ] Overnight shift handling (end time < start time)
- [ ] Approval workflow: draft → submitted → approved (or back to draft on rejection)
- [ ] Cannot approve a draft timesheet (must be submitted first)
- [ ] **REVISION (D02)**: Cannot approve if user lacks manager role — rejects with 403
- [ ] **REVISION (D02)**: Employee cannot approve their own timesheet — rejects with 403
- [ ] Bulk approve skips non-submitted timesheets
- [ ] `getApprovedTimesheetsForPayRun` correctly groups by employee and pay category
- [ ] Pagination with offset/limit on list endpoint
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-05`

## Dependencies
- **Agent 1**: Schema tables must exist (timesheets, timesheet_entries)
- **Wave 4**: employees, pay_categories, pay_structures must exist
- **Coordination rule**: Only Agent 5 creates this service file
