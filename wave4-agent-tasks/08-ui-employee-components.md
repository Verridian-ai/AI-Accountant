# Agent 8: Employee UI Components

## Role
Build the employee management UI components — PayrollDashboard, EmployeeList, EmployeeDetail, and EmployeeOnboarding wizard.

## Priority: SUB-WAVE 4 (After Agent 6 completes)

## Files to CREATE

### 1. `client/src/features/payroll/components/PayrollDashboard.tsx`
**Purpose**: Main payroll hub with tabs for Employees, Pay Categories, and future Pay Runs
**Pattern**: Follow existing dashboard patterns (e.g., AnalyticsDashboard.tsx, BASDashboard.tsx)
**Design**: Use neumorphic dark theme with gold (#FFCC00) accents

```tsx
// Key structure:
// - Tab navigation: Employees | Pay Categories | (future: Pay Runs)
// - Quick stats: Total Employees, Active, On Leave, Terminated
// - Renders EmployeeList or PayCategoryManager based on active tab
// - Add Employee button → opens EmployeeOnboarding
// - Uses neu-raised/neu-inset classes for neumorphic styling
```

Features:
- [ ] Tab navigation with 3 tabs (Employees active, Pay Categories, Pay Runs placeholder)
- [ ] Quick stats cards: Total, Active, On Leave, Terminated counts
- [ ] "Add Employee" button with gold accent
- [ ] Renders child components based on active tab
- [ ] Loading skeleton while fetching data

### 2. `client/src/features/payroll/components/EmployeeList.tsx`
**Purpose**: Searchable, filterable employee table
**Pattern**: Follow TransactionList pattern with TanStack Table

```tsx
// Key structure:
// - Search input for name/email filter
// - Status filter dropdown (All, Active, Terminated, On Leave)
// - Employment type badges (Full Time, Part Time, Casual, Contractor)
// - Status color badges (green=active, red=terminated, yellow=on_leave)
// - Click row → navigate to EmployeeDetail
// - Pagination controls
```

Features:
- [ ] Search by name or email
- [ ] Filter by status
- [ ] Sortable columns (Name, Type, Status, Start Date)
- [ ] Status badges with semantic colors
- [ ] Pagination with page/limit
- [ ] Row click → EmployeeDetail view

### 3. `client/src/features/payroll/components/EmployeeDetail.tsx`
**Purpose**: Full employee profile with tabbed sections
**Pattern**: Follow AccountManager pattern for detail views

```tsx
// Key structure:
// - Employee header: Name, Status badge, Employment Type
// - Tab sections: Personal | Bank Details | Super | Tax Declaration | Pay Structure | Documents
// - Personal tab: Name, email, phone, DOB, address, TFN (masked: ***-***-**9)
// - Bank tab: BSB, Account Number (masked: ****1234), Account Name, Split %
// - Super tab: Fund Name, ABN, USI, Member Number, Contribution Rate
// - Tax tab: Tax-free threshold, HELP debt, SFSS, Dependents
// - Pay Structure tab: Current pay categories with rates
// - Edit buttons for each section
```

Features:
- [ ] Tab navigation (6 sections)
- [ ] TFN displayed as `***-***-**X` (masked from API)
- [ ] Bank account numbers displayed as `****1234` (masked from API)
- [ ] Super contribution rate with compliance indicator (green ≥ 11.5%, red < 11.5%)
- [ ] Pay structure breakdown table
- [ ] Edit/Update buttons per section
- [ ] Back to list navigation

### 4. `client/src/features/payroll/components/EmployeeOnboarding.tsx`
**Purpose**: Step-by-step new employee wizard
**Pattern**: Multi-step form with progress indicator

```tsx
// Key structure:
// - Step 1: Personal Details (name, email, phone, DOB, address, employment type, start date)
// - Step 2: Bank Details (BSB, account number, account name)
// - Step 3: Super Fund (fund name, ABN, USI, member number, contribution rate)
// - Step 4: Tax Declaration (tax-free threshold, HELP, SFSS, dependents)
// - Step 5: Pay Structure (select pay category, set rate, hours/salary)
// - Progress bar with step numbers
// - Back/Next navigation
// - Submit on final step → creates employee + all related records
```

Features:
- [ ] 5-step wizard with progress indicator
- [ ] Form validation per step (required fields, format validation)
- [ ] BSB format validation (6 digits)
- [ ] TFN format validation (8-9 digits) — displayed as password field
- [ ] ABN format validation (11 digits)
- [ ] Contribution rate default to 11.5%
- [ ] Pay category dropdown from API
- [ ] Rate input with rate type toggle (hourly/annual/fixed)
- [ ] Review summary before final submit
- [ ] Error handling with toast notifications

## Files to MODIFY

### 5. `client/src/api.ts`
**Purpose**: Add API functions for employee endpoints

```typescript
// Wave 4: Employee API functions
export async function fetchEmployees(userId: string, params?: {
  page?: number; limit?: number; status?: string; search?: string;
}): Promise<{ data: any[]; total: number }> {
  const query = new URLSearchParams({ userId, ...params as any }).toString();
  const res = await fetch(`${BASE_URL}/api/payroll/employees?${query}`);
  return res.json();
}

export async function createEmployee(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchEmployee(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`);
  return res.json();
}

export async function updateEmployee(id: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteEmployee(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchBankDetails(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`);
  return res.json();
}

export async function addBankDetails(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchSuperFund(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`);
  return res.json();
}

export async function addSuperFund(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchTaxDeclaration(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`);
  return res.json();
}

export async function submitTaxDeclaration(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchPayStructure(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`);
  return res.json();
}

export async function setPayStructure(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

### 6. `client/src/App.tsx`
**Purpose**: Add 'payroll' tab and render PayrollDashboard

Find the tab rendering logic and add:
```tsx
{activeTab === 'payroll' && <PayrollDashboard />}
```

Import at top:
```tsx
import { PayrollDashboard } from './features/payroll/components/PayrollDashboard';
```

### 7. `client/src/components/layout/BottomNavigation.tsx`
**Purpose**: Add 'payroll' tab with Users icon

Add to TabId type:
```typescript
type TabId = ... | 'payroll';
```

Add tab definition:
```typescript
{ id: 'payroll', label: 'Payroll', icon: Users },
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] PayrollDashboard renders with tabs and stats
- [ ] EmployeeList renders with search, filters, pagination
- [ ] EmployeeDetail renders all 6 tab sections
- [ ] EmployeeOnboarding renders all 5 wizard steps
- [ ] All API functions in api.ts compile correctly
- [ ] 'payroll' tab appears in BottomNavigation
- [ ] App.tsx renders PayrollDashboard on payroll tab
- [ ] TFN displayed masked, bank accounts displayed masked
- [ ] Create marker file: `.agent-done-W04-08`

## Dependencies
- **Agent 6** must complete API endpoints (API functions need endpoints to exist for type reference)
