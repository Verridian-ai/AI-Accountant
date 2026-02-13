# Agent 6: Payroll Agent Enhancer

## Role
Add pay run and leave management tools to the existing `payroll_agent`, update types.ts and config.ts with new tool definitions.

## Priority: SUB-WAVE 3 (After Agents 4, 5)

## Files to MODIFY

### 1. `server/src/services/claude/agents/payroll-agent.ts`
**Purpose**: Add 5 new tools for pay run processing and leave management

Add these tools to the existing `payroll_agent`:

- [ ] **`calculate_payg_withholding`** tool:
  - Input: `{ grossEarningsCents: number, payFrequency: string, residencyStatus: string, claimTaxFreeThreshold: boolean, hasHELPDebt: boolean }`
  - Calls `calculatePAYG()` from `payg-calculator.ts`
  - Returns PAYG breakdown with tax, Medicare, HELP amounts

- [ ] **`calculate_super_guarantee`** tool:
  - Input: `{ ordinaryTimeEarningsCents: number, payFrequency: string, salarySacrificeCents?: number, employmentType: string }`
  - Calls `calculateSuper()` from `super-calculator.ts`
  - Returns SG amount, rate, cap status

- [ ] **`generate_pay_run`** tool:
  - Input: `{ userId: string, payPeriodStart: string, payPeriodEnd: string, payDate: string, frequency: string }`
  - Calls `PayRunEngine.createDraftPayRun()` then `PayRunEngine.calculatePayRun()`
  - Returns draft pay run with calculated totals per employee

- [ ] **`process_pay_run`** tool:
  - Input: `{ payRunId: string }`
  - Calls `PayRunEngine.processPayRun()`
  - Returns confirmation with totals

- [ ] **`calculate_leave_entitlements`** tool:
  - Input: `{ employeeId: string }` or `{ userId: string }` (all employees)
  - Calls `LeaveManagementService.getLeaveBalances()`
  - Returns leave balances per employee per leave type

**Pattern**: Follow existing tool pattern in `payroll-agent.ts`:
```typescript
{
  name: 'calculate_payg_withholding',
  description: 'Calculate PAYG withholding tax for an employee based on ATO FY2024-25 tax tables',
  input_schema: {
    type: 'object' as const,
    properties: { ... },
    required: [...]
  }
}
```

Add corresponding handler in `toolHandlers` Map:
```typescript
this.toolHandlers.set('calculate_payg_withholding', async (input) => {
  const result = calculatePAYG(input);
  return JSON.stringify(result);
});
```

### 2. `server/src/services/claude/types.ts`
**Purpose**: Extend `PayrollAgentInput` and `PayrollAgentOutput` interfaces

- [ ] Add to `PayrollAgentInput`:
```typescript
action?: 'detect_wages' | 'manage_employee' | 'generate_pay_run' | 'calculate_payg' | 'calculate_super' | 'leave_calc' | 'process_pay_run';
payRunId?: string;
payPeriodStart?: string;
payPeriodEnd?: string;
payDate?: string;
frequency?: 'weekly' | 'fortnightly' | 'monthly';
```

- [ ] Add to `PayrollAgentOutput`:
```typescript
payRun?: {
  id: string;
  status: string;
  totalGrossCents: number;
  totalTaxCents: number;
  totalSuperCents: number;
  totalNetCents: number;
  employeeSummaries: Array<{
    employeeId: string;
    employeeName: string;
    grossPayCents: number;
    taxWithheldCents: number;
    superGuaranteeCents: number;
    netPayCents: number;
  }>;
};
leaveBalances?: Array<{
  employeeId: string;
  employeeName: string;
  balances: Array<{
    leaveType: string;
    balanceHours: number;
    accruedHours: number;
    takenHours: number;
  }>;
}>;
```

### 3. `server/src/services/claude/config.ts`
**Purpose**: Update payroll_agent token budget to accommodate new tools

- [ ] Increase `maxToolCalls` for `payroll_agent` from 15 to 20 (5 new tools)
- [ ] Ensure `maxInputTokens` is at least 60,000 (pay run data can be large with many employees)

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Payroll agent has 5 new tools registered
- [ ] Tool handlers correctly import and call PAYG/super calculators and pay run engine
- [ ] Types are properly extended (no breaking changes to existing PayrollAgentInput/Output)
- [ ] Config budget allows 20 tool calls
- [ ] Create marker file: `.agent-done-W05-06`

## Dependencies
- **Agent 4**: Pay run engine must exist (`pay-run-engine.ts`)
- **Agent 5**: Leave management must exist (`leave-management.ts`)
- **Existing**: `payroll-agent.ts` must not be modified by any other Wave 5 agent
