# Agent 5: Payroll Agent Enhancer

## Role
Add employee management tools to the existing `payroll_agent` Claude agent so it can answer questions about employees, pay rates, and perform basic pay calculations.

## Priority: SUB-WAVE 2 (After Agents 2 and 3 complete)

## Files to MODIFY

### 1. `server/src/services/claude/agents/payroll-agent.ts`
**Purpose**: Add 4 new tools for employee management
**CRITICAL**: Read the existing file first. It already has tools for wage calculation. Do NOT remove existing tools.

#### Step 1: Import employee and pay structure services
```typescript
import { employeeService } from '../../employee.js';
import { payStructureService } from '../../pay-structures.js';
```

#### Step 2: Add new tools to the agent's tool list
Add these 4 tools to the existing tools array/object:

```typescript
// Tool 1: lookup_employee
{
  name: 'lookup_employee',
  description: 'Search for employees by name, email, or status. Use when the user asks about a specific employee or wants to list employees.',
  input_schema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user/business owner ID' },
      search: { type: 'string', description: 'Search term (name or email)' },
      status: { type: 'string', enum: ['active', 'terminated', 'on_leave'], description: 'Filter by status' },
    },
    required: ['userId'],
  },
  handler: async (input: { userId: string; search?: string; status?: string }) => {
    const result = await employeeService.listEmployees(input.userId, {
      search: input.search,
      status: input.status,
      limit: 20,
    });
    return JSON.stringify(result.data.map(e => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      status: e.status,
      employmentType: e.employmentType,
      startDate: e.startDate,
    })));
  },
},

// Tool 2: get_employee_pay_details
{
  name: 'get_employee_pay_details',
  description: 'Get the full pay structure for an employee including rate, hours, and salary. Use when asked about pay rates or compensation.',
  input_schema: {
    type: 'object',
    properties: {
      employeeId: { type: 'string', description: 'The employee ID' },
    },
    required: ['employeeId'],
  },
  handler: async (input: { employeeId: string }) => {
    const employee = await employeeService.getEmployee(input.employeeId);
    const payStructure = await payStructureService.getPayStructure(input.employeeId);
    const superFund = await employeeService.getSuperFund(input.employeeId);
    const taxDecl = await employeeService.getTaxDeclaration(input.employeeId);

    return JSON.stringify({
      employee: employee ? {
        name: `${employee.firstName} ${employee.lastName}`,
        type: employee.employmentType,
        status: employee.status,
      } : null,
      payStructure,
      superFund,
      taxDeclaration: taxDecl,
    });
  },
},

// Tool 3: calculate_gross_pay
{
  name: 'calculate_gross_pay',
  description: 'Calculate gross pay for an employee given hours worked. Returns breakdown by pay category.',
  input_schema: {
    type: 'object',
    properties: {
      employeeId: { type: 'string', description: 'The employee ID' },
      hoursWorked: { type: 'number', description: 'Total hours worked in the period' },
    },
    required: ['employeeId', 'hoursWorked'],
  },
  handler: async (input: { employeeId: string; hoursWorked: number }) => {
    const result = await payStructureService.calculateGrossPay(input.employeeId, input.hoursWorked);
    return JSON.stringify({
      grossPayCents: result.grossPay,
      grossPayDollars: (result.grossPay / 100).toFixed(2),
      breakdown: result.breakdown.map(b => ({
        category: b.category,
        amountCents: b.amount,
        amountDollars: (b.amount / 100).toFixed(2),
      })),
    });
  },
},

// Tool 4: check_super_compliance
// REVISION NOTE (D02 COMP-02): Super guarantee rate MUST be configurable, NOT hardcoded.
// Rate changes annually: 11% FY2023-24, 11.5% FY2024-25, 12% FY2025-26.
// Read from env var SUPER_GUARANTEE_RATE (default 11.5 for backward compat)
// or from a database config table if available.
{
  name: 'check_super_compliance',
  description: 'Check if an employee\'s super guarantee rate meets the minimum requirement. Rate is configurable via SUPER_GUARANTEE_RATE env var (changes annually). Use when asked about superannuation compliance.',
  input_schema: {
    type: 'object',
    properties: {
      employeeId: { type: 'string', description: 'The employee ID' },
      financialYear: { type: 'string', description: 'Financial year to check (e.g. "2025-26"). Defaults to current FY.' },
    },
    required: ['employeeId'],
  },
  handler: async (input: { employeeId: string; financialYear?: string }) => {
    const superFunds = await employeeService.getSuperFund(input.employeeId);

    // REVISION (D02 COMP-02): Configurable super rate — not hardcoded
    // Priority: 1) Database super_guarantee_rates table (if exists) 2) Env var 3) Default 11.5
    const MINIMUM_SUPER_RATE = parseFloat(process.env.SUPER_GUARANTEE_RATE ?? '11.5');
    const fy = input.financialYear ?? getCurrentFinancialYear();

    const results = superFunds.map((fund: any) => ({
      fundName: fund.fundName,
      contributionRate: fund.contributionRate,
      minimumRequired: MINIMUM_SUPER_RATE,
      financialYear: fy,
      isCompliant: fund.contributionRate >= MINIMUM_SUPER_RATE,
      shortfall: fund.contributionRate < MINIMUM_SUPER_RATE
        ? (MINIMUM_SUPER_RATE - fund.contributionRate).toFixed(1) + '%'
        : null,
    }));

    return JSON.stringify({
      employeeId: input.employeeId,
      superFunds: results,
      overallCompliant: results.every((r: any) => r.isCompliant),
      note: `Minimum super guarantee rate for ${fy} is ${MINIMUM_SUPER_RATE}% (configurable via SUPER_GUARANTEE_RATE env var)`,
    });
  },
},

// REVISION (D02 COMP-02): Helper to determine current Australian financial year
function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // AU FY starts July 1
  if (month >= 7) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}
```

### 2. `server/src/services/claude/types.ts`
**Purpose**: Add employee-related I/O types if needed

Check if the payroll agent already has typed input/output. If so, extend them:
```typescript
// Add to PayrollAgentInput (or whatever the existing type is):
interface PayrollAgentInput {
  // ... existing fields
  employeeId?: string;  // Wave 4: for employee-specific queries
  hoursWorked?: number; // Wave 4: for pay calculations
}
```

### 3. `server/src/services/claude/config.ts`
**Purpose**: Update the payroll agent's tool list in the config if tools are registered there

Check if agent configs are centralized. If the payroll agent's tools are listed in config.ts, add the 4 new tool names:
```typescript
// In the payroll agent config:
tools: [
  // ... existing tools
  'lookup_employee',
  'get_employee_pay_details',
  'calculate_gross_pay',
  'check_super_compliance',
],
```

Also update the agent's system prompt to mention employee management capabilities:
```
You can now help with employee management:
- Looking up employees by name or status
- Checking pay rates and structures
- Calculating gross pay for a period
- Verifying super guarantee compliance
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 4 new tools compile and have correct input_schema
- [ ] Existing payroll agent tools are preserved
- [ ] Agent can answer "What's John's salary?" → uses lookup_employee + get_employee_pay_details
- [ ] Agent can answer "Calculate pay for 38 hours" → uses calculate_gross_pay
- [ ] Agent can answer "Is super compliant?" → uses check_super_compliance
- [ ] Create marker file: `.agent-done-W04-05`

## Dependencies
- **Agent 2** must complete employee service (provides employeeService)
- **Agent 3** must complete pay structure service (provides payStructureService)
