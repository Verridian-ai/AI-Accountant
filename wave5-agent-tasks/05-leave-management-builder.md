# Agent 5: Leave Management Builder

## Role
Build the leave management service handling leave types, balances, accrual calculations, and leave request workflow (submit/approve/reject).

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payroll/leave-management.ts`
**Purpose**: Complete leave management: types configuration, balance tracking, accrual calculation, request workflow
**Pattern**: Service class with DB access via `wrapPgDb()`

```typescript
export class LeaveManagementService {
  constructor(private db: any) {}

  // === Leave Types ===

  /**
   * List leave types for a user (employer).
   */
  async listLeaveTypes(userId: string): Promise<LeaveType[]>;

  /**
   * Create a new leave type with accrual configuration.
   */
  async createLeaveType(params: {
    userId: string;
    name: string;
    accrualRate: number;          // e.g., 4 (weeks per year for annual leave)
    accrualFrequency: 'per_hour' | 'per_pay_period' | 'per_year';
    maxBalance?: number;          // Cap in hours (e.g., double annual = 304 hours)
    isPaid: boolean;
    isActive?: boolean;
  }): Promise<LeaveType>;

  /**
   * Seed default Australian leave types for a new user.
   * Called during onboarding.
   */
  async seedDefaultLeaveTypes(userId: string): Promise<void>;

  // === Leave Balances ===

  /**
   * Get all leave balances for an employee.
   */
  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]>;

  /**
   * Accrue leave for a pay period.
   * - Full-time: accrues based on standard hours (38/week)
   * - Part-time: pro-rata based on actual hours/standard hours
   * - Casual: does NOT accrue (loaded into hourly rate)
   */
  async accrueLeave(params: {
    employeeId: string;
    payRunId: string;
    hoursWorked: number;
    standardWeeklyHours: number;
    payFrequency: 'weekly' | 'fortnightly' | 'monthly';
    employmentType: 'full_time' | 'part_time' | 'casual' | 'contractor';
  }): Promise<LeaveTransaction[]>;

  /**
   * Deduct leave for approved leave taken during a period.
   */
  async deductLeave(params: {
    employeeId: string;
    leaveTypeId: string;
    hours: number;
    payRunId: string;
    date: string;
  }): Promise<LeaveTransaction>;

  /**
   * Reverse leave accruals/deductions for a reversed pay run.
   */
  async reverseLeaveForPayRun(payRunId: string): Promise<void>;

  // === Leave Requests ===

  /**
   * Submit a leave request.
   */
  async submitLeaveRequest(params: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    hours: number;
    notes?: string;
  }): Promise<LeaveRequest>;

  /**
   * Approve a leave request.
   */
  async approveLeaveRequest(requestId: string, approvedBy: string): Promise<void>;

  /**
   * Reject a leave request with reason.
   */
  async rejectLeaveRequest(requestId: string, reason?: string): Promise<void>;

  /**
   * Get leave calendar data for a month.
   * Returns all approved/pending leave requests for display.
   */
  async getLeaveCalendar(params: {
    userId: string;
    month: string;          // YYYY-MM format
    employeeId?: string;    // Optional filter
  }): Promise<LeaveCalendarData>;
}
```

**Implementation requirements:**

- [ ] **Australian NES Leave Types** (default seed):
  | Leave Type | Accrual Rate | Accrual Frequency | Max Balance | Paid |
  |---|---|---|---|---|
  | Annual Leave | 4 weeks/year (152 hours) | per_year | 304 hours (double) | Yes |
  | Personal/Carer's Leave | 10 days/year (76 hours) | per_year | No cap | Yes |
  | Long Service Leave | 8.67 weeks after 10 years | per_year | No cap | Yes |
  | Compassionate Leave | 2 days per occasion | per_year | No cap | Yes |
  | Unpaid Parental Leave | 12 months | N/A | N/A | No |

- [ ] **Proportional Accrual Calculation**:
  - Full-time (38 hrs/week): Full accrual rate
  - Part-time: `accrualRate × (actualHours / standardHours)`
  - Casual: No accrual (casual loading compensates)
  - Per pay period: `annualAccrual / periodsPerYear`
    - Weekly: ÷ 52
    - Fortnightly: ÷ 26
    - Monthly: ÷ 12

- [ ] **Leave Balance Updates**: When accruing or deducting:
  1. Create `leave_transactions` record (type: 'accrual' or 'taken')
  2. Update `leave_balances` — increment `accrued` or `taken` field
  3. Recalculate `balance = accrued - taken + adjustments`
  4. Update `asAtDate` to current date

> **REVISION NOTE (D02/D03 — Leave Accrual Precision):** All leave balance calculations MUST
> use decimal precision with at least 4 decimal places — NEVER use integer rounding for hours.
> The `balance`, `accrued`, `taken`, and `adjustments` fields in `leave_balances` are REAL type
> for this reason. Use `parseFloat(value.toFixed(4))` when storing calculated values to avoid
> floating-point drift. Example: fortnightly annual leave accrual = 152 hours / 26 periods =
> 5.8462 hours per period (NOT rounded to 6). Over a year, rounding errors compound and create
> compliance issues with NES entitlements.

- [ ] **Leave Request Validation**:
  - Cannot submit if insufficient balance
  - Cannot overlap with existing approved leave
  - Cannot request leave in the past
  - startDate must be before endDate

- [ ] **Leave Calendar**: Returns array of `{ employeeId, employeeName, leaveType, startDate, endDate, hours, status, color }` for calendar rendering

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Full-time employee accrues 4 weeks annual leave per year (proportional per pay period)
- [ ] Part-time employee accrues pro-rata based on hours worked
- [ ] Casual employees do NOT accrue leave
- [ ] Leave deduction reduces balance and creates transaction record
- [ ] Leave reversal restores balances correctly
- [ ] Leave request validation prevents insufficient balance requests
- [ ] Default leave types match Australian NES
- [ ] Create marker file: `.agent-done-W05-05`

## Dependencies
- **Agent 1**: Schema must exist (leave_types, leave_balances, leave_requests, leave_transactions)
- **Wave 4**: Employee tables must exist
