# Agent 3: Payslip Generator

## Role
Build the payslip generation service that creates HTML payslips from pay run data, stores references in the database, and supports bulk sending notifications.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payroll/payslip-service.ts`
**Purpose**: Generate, store, and distribute payslips

**Class**: `PayslipService`
**Constructor**: `constructor(private db: any)`

**Interfaces**:

```typescript
interface PayslipData {
  employeeName: string;
  employeeId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  // Earnings breakdown
  earnings: Array<{
    category: string;
    hours?: number;
    rate: number;     // cents
    amount: number;   // cents
  }>;
  // Deductions breakdown
  deductions: Array<{
    category: string;
    amount: number;   // cents
  }>;
  // Totals
  grossPay: number;      // cents
  taxWithheld: number;   // cents
  superGuarantee: number; // cents
  superSalarySacrifice: number; // cents
  netPay: number;        // cents
  // Leave balances
  leaveBalances: Array<{
    leaveType: string;
    balance: number;    // hours
    accrued: number;    // hours (this period)
  }>;
  // YTD
  ytdGross: number;      // cents
  ytdTax: number;        // cents
  ytdSuper: number;      // cents
}

interface GeneratePayslipsResult {
  payRunId: string;
  payslipCount: number;
  payslips: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    netPay: number;
  }>;
}

interface SendPayslipsResult {
  sent: number;
  failed: number;
  errors: Array<{ employeeId: string; error: string }>;
}
```

**Methods**:

- [ ] **`generatePayslips(payRunId: string): Promise<GeneratePayslipsResult>`**
  - Fetches pay run header, lines, and summary from DB
  - Fetches employee details for each employee in the pay run
  - Fetches leave balances for each employee
  - Calculates YTD by summing all pay_run_summary rows for the employee in current FY
  - Groups pay run lines by employee and builds `PayslipData` for each
  - Calls `_generatePayslipHTML()` for each employee
  - Inserts `payslips` rows into DB
  - Returns list of generated payslips

- [ ] **`getPayslipsByPayRun(payRunId: string): Promise<Payslip[]>`**
  - Returns all payslip records for a given pay run

- [ ] **`getPayslipHTML(payslipId: string): Promise<string>`**
  - Fetches payslip record from DB
  - Regenerates HTML from pay run data (stateless — no file storage)
  - Returns HTML string

- [ ] **`sendPayslips(payRunId: string): Promise<SendPayslipsResult>`**
  - Fetches all payslips for the pay run
  - For each payslip, marks as "sent" (updates `sentAt` timestamp)
  - In production, would email the payslip; for now, just records the send event
  - Returns count of sent/failed

- [ ] **`_generatePayslipHTML(data: PayslipData, businessName: string): string`** (private)
  - Generates clean HTML payslip (no external PDF library per coordination rule #14)
  - Sections:
    1. **Header**: Business name, pay period, pay date
    2. **Employee Details**: Name, employee ID
    3. **Earnings Table**: Category | Hours | Rate | Amount (for each earning line)
    4. **Deductions Table**: Category | Amount
    5. **Summary**: Gross Pay, Tax Withheld, Super (SG + Sacrifice), Net Pay
    6. **Leave Balances**: Leave Type | Balance (hrs) | Accrued This Period (hrs)
    7. **YTD Summary**: YTD Gross, YTD Tax, YTD Super
  - Currency formatting: Display as dollars (cents / 100), formatted with 2 decimal places
  - Inline CSS styling (works in email clients and browser):
    - Clean, professional layout
    - Table borders and alternating row colors
    - Bold totals row
    - No external CSS dependencies

- [ ] **`_formatCurrency(cents: number): string`** (private)
  - Converts cents to formatted AUD string: `$1,234.56`
  - Uses `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)`

## Verification
- [ ] Payslip HTML contains all sections: header, employee, earnings, deductions, summary, leave, YTD
- [ ] All monetary amounts correctly converted from cents to dollar display
- [ ] YTD calculation sums correctly within Australian FY (Jul 1 → Jun 30)
- [ ] One payslip per employee per pay run
- [ ] `sentAt` timestamp set when payslips are sent
- [ ] No external PDF library used (HTML string only)
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-03`

## Dependencies
- **Agent 1**: Schema tables must exist (payslips)
- **Wave 5**: pay_runs, pay_run_lines, pay_run_summary, leave_balances must exist
- **Wave 4**: employees table must exist
