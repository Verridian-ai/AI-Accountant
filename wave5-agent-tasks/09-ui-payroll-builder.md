# Agent 9: UI Payroll Builder

## Role
Build 6 new pay run and leave UI components, extend the PayrollDashboard with new sub-tabs, and add API methods to `client/src/api.ts`.

## Priority: SUB-WAVE 5 (After Agent 8)

## Files to CREATE

### 1. `client/src/features/payroll/components/PayRunWizard.tsx`
**Purpose**: Multi-step pay run creation wizard: select period → review employees → calculate → confirm → process
**Design**: Gold (#FFCC00) accent, neumorphic dark theme, progress stepper UI

- [ ] Step 1: **Select Period** — Pay frequency selector (weekly/fortnightly/monthly), date pickers for period start/end and pay date
- [ ] Step 2: **Review Employees** — List of active employees with their pay structures, checkboxes to include/exclude
- [ ] Step 3: **Calculate** — Calls `payrollApi.calculatePayRun()`, shows per-employee breakdown (gross, PAYG tax, super, net)
- [ ] Step 4: **Confirm** — Summary totals, highlight any warnings (e.g., OTE cap hit, under-18 exemptions)
- [ ] Step 5: **Process** — Calls `payrollApi.processPayRun()`, shows success confirmation with totals
- [ ] Uses `Loader2` spinner with `animate-spin` during API calls
- [ ] Currency formatting: `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)`
- [ ] Status badges: draft (yellow), processing (blue), completed (green), reversed (red)

### 2. `client/src/features/payroll/components/PayRunDetail.tsx`
**Purpose**: Detailed pay run view with per-employee breakdown table

- [ ] Header: pay run ID, period dates, pay date, status badge, frequency
- [ ] Summary cards: total gross, total tax, total super, total net (4 `neu-raised` cards)
- [ ] Employee breakdown table (TanStack Table):
  - Columns: Employee Name, Gross Pay, PAYG Tax, Super, Salary Sacrifice, Net Pay
  - Expandable rows showing individual pay run lines (hours, rate, amount per category)
- [ ] Action buttons: "Calculate" (if draft), "Process" (if calculated), "Reverse" (if completed)
- [ ] Back navigation to PayRunHistory

### 3. `client/src/features/payroll/components/PayRunHistory.tsx`
**Purpose**: Historical pay runs list with filtering and sorting

- [ ] TanStack Table with columns: Period, Pay Date, Frequency, Status, Gross, Tax, Super, Net, Employees
- [ ] Status filter dropdown (draft, processing, completed, reversed, all)
- [ ] Date range filter
- [ ] Click row → navigates to PayRunDetail
- [ ] Pagination: offset/limit with page size selector
- [ ] "New Pay Run" button (gold accent) → opens PayRunWizard
- [ ] Sortable columns, gold (`#FFCC00`) sort indicators

### 4. `client/src/features/payroll/components/LeaveManagement.tsx`
**Purpose**: Leave hub with internal sub-tabs: Types, Balances, Requests

- [ ] Sub-tab: **Types** — List of leave types with accrual rate, frequency, max balance, paid/unpaid badge. "Add Leave Type" form.
- [ ] Sub-tab: **Balances** — Per-employee leave balance overview. Columns: Employee, Leave Type, Balance (hrs), Accrued, Taken, As At Date. Color-coded low-balance warnings (< 20% of max).
- [ ] Sub-tab: **Requests** — Pending leave requests queue with approve/reject buttons. Shows: Employee, Leave Type, Dates, Hours, Current Balance, Status. Filter by status.
- [ ] Each sub-tab uses `neu-raised` card styling

### 5. `client/src/features/payroll/components/LeaveCalendar.tsx`
**Purpose**: Visual month/week calendar showing employee leave periods

- [ ] CSS Grid-based calendar layout (no external calendar library)
- [ ] Month view: 7 columns (Mon-Sun), 4-6 rows
- [ ] Color-coded by leave type:
  - Annual Leave: green (`bg-green-500/20`)
  - Personal/Carer's: orange (`bg-orange-500/20`)
  - Long Service: blue (`bg-blue-500/20`)
  - Other: gray (`bg-gray-500/20`)
- [ ] Month navigation: prev/next month arrows with gold accent
- [ ] Employee filter dropdown
- [ ] Click on leave block → shows leave request details tooltip
- [ ] Legend at bottom showing color→type mapping

### 6. `client/src/features/payroll/components/LeaveRequestForm.tsx`
**Purpose**: Submit/approve/reject leave requests

- [ ] Employee selector dropdown (if manager/admin view)
- [ ] Leave type selector with current balance display next to it
- [ ] Date range picker: start date, end date
- [ ] Hours calculator: auto-calculates based on date range × 7.6hrs/day (standard)
- [ ] Notes text area
- [ ] "Submit Request" button (gold accent)
- [ ] For pending requests: "Approve" (green) / "Reject" (red) buttons
- [ ] Validation: shows error if insufficient balance, overlapping leave, or past dates

## Files to MODIFY

### 7. `client/src/features/payroll/components/PayrollDashboard.tsx`
**Purpose**: Add sub-tabs for pay-runs, leave, leave-calendar alongside existing employee tabs

- [ ] Add to `SubTab` type: `'pay-runs' | 'leave' | 'leave-calendar'`
- [ ] Add tab buttons in the sub-tab bar for the new tabs
- [ ] Render `PayRunHistory` for 'pay-runs' tab
- [ ] Render `LeaveManagement` for 'leave' tab
- [ ] Render `LeaveCalendar` for 'leave-calendar' tab
- [ ] Import new components

### 8. `client/src/api.ts`
**Purpose**: Extend `payrollApi` object with ~15 new methods for pay run and leave CRUD

- [ ] Add to `payrollApi`:
```typescript
// Pay Runs
listPayRuns: async (params?: { status?: string; offset?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const res = await fetch(`${BASE_URL}/api/payroll/pay-runs?${query}`, { headers: getAuthHeaders() });
  return res.json();
},
getPayRun: async (id: string) => { ... },
createPayRun: async (data: { payPeriodStart: string; payPeriodEnd: string; payDate: string; frequency: string }) => { ... },
calculatePayRun: async (id: string) => { ... },
processPayRun: async (id: string) => { ... },
reversePayRun: async (id: string) => { ... },
getPayRunLines: async (id: string) => { ... },
addPayRunLine: async (id: string, data: { employeeId: string; payCategoryId: string; hours?: number; rate: number; amount: number }) => { ... },

// Leave
listLeaveTypes: async () => { ... },
createLeaveType: async (data: { name: string; accrualRate: number; accrualFrequency: string; maxBalance?: number; isPaid: boolean }) => { ... },
getLeaveBalances: async (employeeId: string) => { ... },
submitLeaveRequest: async (data: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; hours: number; notes?: string }) => { ... },
approveLeave: async (id: string) => { ... },
rejectLeave: async (id: string, reason?: string) => { ... },
getLeaveCalendar: async (month: string, employeeId?: string) => { ... },
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 6 new components render without errors
- [ ] PayRunWizard multi-step flow works: period → employees → calculate → confirm → process
- [ ] PayRunDetail shows expandable employee breakdown
- [ ] PayRunHistory has working filters, sorting, and pagination
- [ ] LeaveManagement shows types, balances, and requests in sub-tabs
- [ ] LeaveCalendar renders CSS grid calendar with color-coded leave blocks
- [ ] LeaveRequestForm validates balance before submission
- [ ] PayrollDashboard sub-tabs navigate to new views
- [ ] All 15 API methods in `payrollApi` have correct paths and methods
- [ ] No emoji usage in code or UI text
- [ ] Create marker file: `.agent-done-W05-09`

## Dependencies
- **Agent 8**: API endpoints must exist for the API methods to call
- **Coordination rule**: Only Agent 9 modifies `client/src/api.ts`
- **Wave 4**: PayrollDashboard.tsx must exist with sub-tab pattern
