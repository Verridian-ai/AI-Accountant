# Agent 9: UI Payroll Reporting Builder

## Role
Build 7 new STP, payslip, timesheet, award, and report UI components, extend the PayrollDashboard with new sub-tabs, and add API methods to `client/src/api.ts`.

## Priority: SUB-WAVE 5 (After Agent 8)

## Files to CREATE

### 1. `client/src/features/payroll/components/STPDashboard.tsx`
**Purpose**: STP event list with status management, YTD viewer, and EOFY finalisation
**Design**: Gold (#FFCC00) accent, neumorphic dark theme

- [ ] STP Events table (TanStack Table):
  - Columns: Event Type, Pay Date, Status, Employee Count, Gross Total, Tax Total, Super Total, Actions
  - Status badges: draft (yellow), submitted (blue), accepted (green), rejected (red)
  - Actions: "Submit to ATO" button for draft events, "View Detail" for all
- [ ] YTD Summary section:
  - Employee selector dropdown
  - YTD totals display: Gross, Tax Withheld, Super, Reportable Super, RFBA
  - Card layout using `neu-raised` styling
- [ ] EOFY Finalisation section:
  - Financial year selector (e.g., "2024-25")
  - "Generate Finalisation" button (gold accent) with confirmation dialog
  - Warning text: "Due by 14 July -- lodges finalisation event with the ATO"
- [ ] Pagination on events list
- [ ] Currency formatting: `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)`

### 2. `client/src/features/payroll/components/STPEventDetail.tsx`
**Purpose**: Individual STP event detail with employee YTD breakdown and XML preview

- [ ] Event header: Event ID, type, status badge, pay date, submission date
- [ ] Employee YTD Breakdown table:
  - Columns: Employee Name, Gross, Tax, Super, Reportable Super, RFBA, Lump Sum A, Lump Sum B, ETP
  - Totals row at bottom
  - All monetary values formatted as AUD
- [ ] XML Preview section:
  - Collapsible `<pre>` block showing the STP XML payload
  - Copy to clipboard button
  - Content sanitized via DOMPurify or rendered as text-only (no raw HTML execution)
- [ ] ATO Response section (if submitted):
  - Response ID, status, timestamp
  - Status timeline (draft -> submitted -> accepted/rejected)
- [ ] Action buttons:
  - "Submit to ATO" (if draft)
  - "Back to STP Dashboard" navigation
- [ ] Uses `neu-raised` card styling

### 3. `client/src/features/payroll/components/PayslipViewer.tsx`
**Purpose**: View and distribute payslips for a pay run

- [ ] Pay run selector (dropdown of completed pay runs)
- [ ] Payslip list table:
  - Columns: Employee Name, Gross Pay, Tax, Super, Net Pay, Generated At, Sent At, Actions
  - Action: "View" button opens payslip HTML in a sandboxed iframe (sandbox attribute set)
  - Action: "Download" button downloads HTML as file
- [ ] Payslip preview panel:
  - Renders payslip HTML in a sandboxed iframe (`sandbox=""` attribute to prevent script execution)
  - Shows earnings, deductions, super, net, leave balances, YTD
- [ ] Bulk actions:
  - "Generate Payslips" button (calls `payrollApi.generatePayslips()`)
  - "Send All Payslips" button (calls `payrollApi.sendPayslips()`)
  - Shows sent count after sending
- [ ] `Loader2` spinner with `animate-spin` during API calls

### 4. `client/src/features/payroll/components/TimesheetEntry.tsx`
**Purpose**: Weekly timesheet grid for employee time entry

- [ ] Week selector: Previous/Next week arrows with week-of date display
- [ ] Employee selector (for manager view)
- [ ] Daily time entry grid:
  - 7 columns (Mon-Sun) x rows for each project/task
  - Each cell: Start time, End time, Break (minutes), Total hours (auto-calculated)
  - Total hours per day at column footer
  - Total hours per row at right
  - Grand total at bottom-right
- [ ] Project/task allocation:
  - Add row button for new project entry
  - Project ID input, task description text field
  - Billable checkbox
- [ ] Submit button (gold accent):
  - Validates total hours > 0
  - Calls `payrollApi.submitTimesheet()` for each day with hours
  - Shows success confirmation
- [ ] Save Draft button for work-in-progress

### 5. `client/src/features/payroll/components/TimesheetApproval.tsx`
**Purpose**: Manager approval interface for submitted timesheets

- [ ] Pending timesheets table:
  - Columns: Employee, Week Of, Mon-Sun hours, Total Hours, Status, Actions
  - Status filter: submitted (default), all
  - Date range filter
- [ ] Approve/Reject actions per row:
  - Approve button (green): calls `payrollApi.approveTimesheet(id, 'approve')`
  - Reject button (red): opens reason input, calls `payrollApi.approveTimesheet(id, 'reject', reason)`
- [ ] Bulk approve:
  - Select multiple timesheets via checkboxes
  - "Approve Selected" button
- [ ] Expandable rows showing timesheet entries (projects, tasks, hours)
- [ ] Summary cards: Total Pending, Total Approved This Week, Total Hours This Week

### 6. `client/src/features/payroll/components/AwardManager.tsx`
**Purpose**: Modern Award management with rate definitions

- [ ] Awards list:
  - Table: Award Name, Code, Effective Date, Expiry Date, Status (active/expired), Actions
  - "Add Award" button opens creation form
- [ ] Award creation form:
  - Name, Code, Effective Date, Expiry Date fields
  - "Seed Default Awards" button to populate 3 common awards
- [ ] Rate management (per award):
  - Click award row to expand rates
  - Rates table: Classification, Level, Hourly Rate, Casual Loading %, Overtime Multiplier, Effective Date
  - "Add Rate" inline form
  - Rate calculator: input hours, select casual/permanent, shows calculated pay
- [ ] Currency display: rates shown as $/hr (cents / 100)
- [ ] All using `neu-raised` card styling

### 7. `client/src/features/payroll/components/PayrollReports.tsx`
**Purpose**: Tabbed reporting dashboard with 4 report types

- [ ] Internal sub-tabs: "PAYG Summary" | "Super Report" | "Leave Report" | "Payroll Summary"
- [ ] **PAYG Summary tab**:
  - Financial year selector
  - Table: Employee, Gross Pay, PAYG Withheld, Effective Rate
  - Totals row
  - Export to CSV button
- [ ] **Super Report tab**:
  - Quarter selector (Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun)
  - Table: Employee, SG Amount, Salary Sacrifice, Total Super
  - Totals row
  - SG rate display: "Current Rate: 11.5%"
- [ ] **Leave Report tab**:
  - Table: Employee, Leave Type, Balance (hrs), Accrued (hrs), Taken (hrs)
  - Color-coded low balance warning (< 20% of max, red text)
  - No date selector needed (current balances)
- [ ] **Payroll Summary tab**:
  - Month selector (YYYY-MM)
  - Summary cards: Total Gross, Total Tax, Total Super, Total Net, Pay Runs, Employees
  - Pay runs list for the month
- [ ] All tables sortable with gold (`#FFCC00`) sort indicators

## Files to MODIFY

### 8. `client/src/features/payroll/components/PayrollDashboard.tsx`
**Purpose**: Add sub-tabs for STP, payslips, timesheets, awards, reports

- [ ] Add to `SubTab` type: `'stp' | 'payslips' | 'timesheets' | 'timesheet-approval' | 'awards' | 'reports'`
- [ ] Add tab buttons in the sub-tab bar:
  ```tsx
  { id: 'stp', label: 'STP' }
  { id: 'payslips', label: 'Payslips' }
  { id: 'timesheets', label: 'Timesheets' }
  { id: 'timesheet-approval', label: 'Approval' }
  { id: 'awards', label: 'Awards' }
  { id: 'reports', label: 'Reports' }
  ```
- [ ] Render components for each new tab:
  - `'stp'` renders `<STPDashboard />`
  - `'payslips'` renders `<PayslipViewer />`
  - `'timesheets'` renders `<TimesheetEntry />`
  - `'timesheet-approval'` renders `<TimesheetApproval />`
  - `'awards'` renders `<AwardManager />`
  - `'reports'` renders `<PayrollReports />`
- [ ] Import new components

### 9. `client/src/api.ts`
**Purpose**: Extend `payrollApi` object with ~18 new methods

- [ ] Add to `payrollApi`:
```typescript
// STP
listSTPEvents: async (params?: { status?: string; offset?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const res = await fetch(`${BASE_URL}/api/payroll/stp/events?${query}`, { headers: getAuthHeaders() });
  return res.json();
},
generateSTPEvent: async (payRunId: string, eventType: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/stp/generate/${payRunId}`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType })
  });
  return res.json();
},
submitSTP: async (eventId: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/stp/submit/${eventId}`, {
    method: 'POST', headers: getAuthHeaders()
  });
  return res.json();
},
getEmployeeYTD: async (employeeId: string, financialYear?: string) => {
  const query = financialYear ? `?financialYear=${financialYear}` : '';
  const res = await fetch(`${BASE_URL}/api/payroll/stp/ytd/${employeeId}${query}`, { headers: getAuthHeaders() });
  return res.json();
},
generateFinalisation: async (year: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/stp/finalise/${year}`, {
    method: 'POST', headers: getAuthHeaders()
  });
  return res.json();
},

// Payslips
getPayslips: async (payRunId: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/payslips/${payRunId}`, { headers: getAuthHeaders() });
  return res.json();
},
getPayslipHTML: async (payRunId: string, employeeId: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/payslips/${payRunId}/${employeeId}/pdf`, { headers: getAuthHeaders() });
  return res.text();
},
sendPayslips: async (payRunId: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/payslips/${payRunId}/send`, {
    method: 'POST', headers: getAuthHeaders()
  });
  return res.json();
},

// Awards
listAwards: async () => {
  const res = await fetch(`${BASE_URL}/api/payroll/awards`, { headers: getAuthHeaders() });
  return res.json();
},
createAward: async (data: { name: string; code?: string; effectiveDate: string; expiryDate?: string }) => {
  const res = await fetch(`${BASE_URL}/api/payroll/awards`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
},
getAwardRates: async (awardId: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/awards/${awardId}/rates`, { headers: getAuthHeaders() });
  return res.json();
},

// Timesheets
listTimesheets: async (params?: { employeeId?: string; status?: string; startDate?: string; endDate?: string; offset?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.employeeId) query.set('employeeId', params.employeeId);
  if (params?.status) query.set('status', params.status);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const res = await fetch(`${BASE_URL}/api/payroll/timesheets?${query}`, { headers: getAuthHeaders() });
  return res.json();
},
submitTimesheet: async (data: { employeeId: string; date: string; startTime?: string; endTime?: string; breakMinutes?: number; totalHours?: number; payCategoryId?: string; entries?: Array<{ projectId?: string; taskDescription?: string; hours: number; billable?: boolean }> }) => {
  const res = await fetch(`${BASE_URL}/api/payroll/timesheets`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
},
approveTimesheet: async (id: string, action: 'approve' | 'reject', reason?: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/timesheets/${id}/approve`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason })
  });
  return res.json();
},

// Reports
getPaygSummary: async (year: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/reports/payg-summary/${year}`, { headers: getAuthHeaders() });
  return res.json();
},
getSuperReport: async (period: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/reports/super-report/${period}`, { headers: getAuthHeaders() });
  return res.json();
},
getLeaveReport: async () => {
  const res = await fetch(`${BASE_URL}/api/payroll/reports/leave-report`, { headers: getAuthHeaders() });
  return res.json();
},
getPayrollSummary: async (period: string) => {
  const res = await fetch(`${BASE_URL}/api/payroll/reports/payroll-summary/${period}`, { headers: getAuthHeaders() });
  return res.json();
},
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 7 new components render without errors
- [ ] STPDashboard shows events with status badges and YTD summary
- [ ] STPEventDetail shows employee breakdown and XML preview (sanitized, no raw HTML execution)
- [ ] PayslipViewer renders payslip HTML in sandboxed iframe and supports bulk send
- [ ] TimesheetEntry has working weekly grid with auto-hour calculation
- [ ] TimesheetApproval has approve/reject with bulk approve
- [ ] AwardManager shows awards with expandable rate tables
- [ ] PayrollReports has 4 sub-tabs with correct date selectors
- [ ] PayrollDashboard sub-tabs navigate to new views
- [ ] All 18 API methods in `payrollApi` have correct paths and methods
- [ ] No emoji usage in code or UI text
- [ ] Create marker file: `.agent-done-W06-09`

## Dependencies
- **Agent 8**: API endpoints must exist for the API methods to call
- **Coordination rule**: Only Agent 9 modifies `client/src/api.ts`
- **Wave 5**: PayrollDashboard.tsx must exist with sub-tab pattern
