# Agent 6: Payroll Agent Enhancer

## Role
Add 5 new STP, payslip, award, and timesheet tools to the existing `payroll_agent`, extending its input/output types and increasing its tool budget.

## Priority: SUB-WAVE 3 (After Agents 2, 3, 4, 5)

## Files to MODIFY

### 1. `server/src/services/claude/agents/payroll-agent.ts`
**Purpose**: Add 5 new tools to the existing payroll agent

**Existing tools** (from Wave 5): `calculate_payg_withholding`, `calculate_super_guarantee`, `generate_pay_run`, `process_pay_run`, `calculate_leave_entitlements`

**New tools to add** (append to the existing `tools` array):

- [ ] **`generate_stp_event`**
  ```typescript
  {
    name: 'generate_stp_event',
    description: 'Generate an STP Phase 2 event from a completed pay run. Creates compliant XML payload with all ATO-required fields (gross, tax, super, RFBA, lump sums, ETP).',
    input_schema: {
      type: 'object',
      properties: {
        payRunId: { type: 'string', description: 'ID of the completed pay run' },
        eventType: { type: 'string', enum: ['pay_event', 'update', 'finalisation'], description: 'Type of STP event' }
      },
      required: ['payRunId', 'eventType']
    }
  }
  ```
  **Handler**: Instantiates `STPService`, calls `generateSTPEvent()`

- [ ] **`lodge_stp`**
  ```typescript
  {
    name: 'lodge_stp',
    description: 'Submit an STP event to the ATO for processing. Event must be in draft status.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'ID of the STP event to submit' }
      },
      required: ['eventId']
    }
  }
  ```
  **Handler**: Instantiates `STPService`, calls `submitToATO()`

- [ ] **`generate_payslip`**
  ```typescript
  {
    name: 'generate_payslip',
    description: 'Generate payslips for all employees in a completed pay run. Returns HTML payslips with earnings, deductions, super, net pay, leave balances, and YTD totals.',
    input_schema: {
      type: 'object',
      properties: {
        payRunId: { type: 'string', description: 'ID of the pay run to generate payslips for' }
      },
      required: ['payRunId']
    }
  }
  ```
  **Handler**: Instantiates `PayslipService`, calls `generatePayslips()`

- [ ] **`interpret_award`**
  ```typescript
  {
    name: 'interpret_award',
    description: 'Look up Modern Award classification rates. Returns base rate, casual loading rate (25%), and overtime multipliers (1.5x/2x). Can also calculate pay for given hours and classification.',
    input_schema: {
      type: 'object',
      properties: {
        awardId: { type: 'string', description: 'ID of the Modern Award' },
        classification: { type: 'string', description: 'Award classification (e.g., "Clerk", "C10")' },
        level: { type: 'string', description: 'Award level (e.g., "Level 1", "1")' },
        calculatePay: { type: 'boolean', description: 'If true, calculate pay using the hours below' },
        ordinaryHours: { type: 'number', description: 'Hours at ordinary rate' },
        overtimeHours1: { type: 'number', description: 'First 2 hours of overtime' },
        overtimeHours2: { type: 'number', description: 'Overtime hours beyond 2' },
        isCasual: { type: 'boolean', description: 'Whether employee is casual (25% loading applies)' }
      },
      required: ['awardId', 'classification', 'level']
    }
  }
  ```
  **Handler**: Instantiates `AwardService`, calls `lookupRate()` or `calculatePay()`

- [ ] **`approve_timesheet`**
  ```typescript
  {
    name: 'approve_timesheet',
    description: 'Approve or reject a submitted timesheet. Only timesheets in submitted status can be approved. Approved timesheets can be used to generate pay run line items.',
    input_schema: {
      type: 'object',
      properties: {
        timesheetId: { type: 'string', description: 'ID of the timesheet' },
        action: { type: 'string', enum: ['approve', 'reject'], description: 'Whether to approve or reject' },
        reason: { type: 'string', description: 'Reason for rejection (required if rejecting)' }
      },
      required: ['timesheetId', 'action']
    }
  }
  ```
  **Handler**: Instantiates `TimesheetService`, calls `approveTimesheet()` or `rejectTimesheet()`

**New tool handlers** — add to `toolHandlers` Map:
```typescript
this.toolHandlers.set('generate_stp_event', async (input) => { ... });
this.toolHandlers.set('lodge_stp', async (input) => { ... });
this.toolHandlers.set('generate_payslip', async (input) => { ... });
this.toolHandlers.set('interpret_award', async (input) => { ... });
this.toolHandlers.set('approve_timesheet', async (input) => { ... });
```

**Import statements** — add at the top of the file:
```typescript
import { STPService } from '../payroll/stp-service.js';
import { PayslipService } from '../payroll/payslip-service.js';
import { AwardService } from '../payroll/award-service.js';
import { TimesheetService } from '../payroll/timesheet-service.js';
```

**System prompt update** — Extend the system prompt to include STP, payslip, award, and timesheet capabilities:
```
You also handle:
- STP Phase 2 reporting: Generate STP events from pay runs, lodge with ATO
- Payslip generation: Create detailed payslips with earnings, deductions, super, leave balances
- Modern Award interpretation: Look up award rates, apply casual loading (25%) and overtime multipliers (1.5x/2x)
- Timesheet management: Approve/reject submitted timesheets, feed into pay runs
```

### 2. `server/src/services/claude/types.ts`
**Purpose**: Extend PayrollAgentInput and PayrollAgentOutput with Wave 6 fields

Add to `PayrollAgentInput`:
```typescript
// Wave 6 additions
stpEventType?: 'pay_event' | 'update' | 'finalisation';
stpEventId?: string;
financialYear?: string;
awardId?: string;
classification?: string;
level?: string;
timesheetId?: string;
timesheetAction?: 'approve' | 'reject';
```

Add to `PayrollAgentOutput`:
```typescript
// Wave 6 additions
stpEvent?: {
  eventId: string;
  status: string;
  xmlPreview: string;
  employeeCount: number;
};
payslips?: Array<{
  id: string;
  employeeName: string;
  netPay: number;
}>;
awardRate?: {
  classification: string;
  level: string;
  baseRateCents: number;
  casualRateCents: number;
  overtime1Cents: number;
};
timesheetStatus?: {
  timesheetId: string;
  status: string;
};
```

### 3. `server/src/services/claude/config.ts`
**Purpose**: Increase maxToolCalls for payroll_agent to accommodate new tools

Find the `payroll_agent` config entry and update:
```typescript
// Before:
maxToolCalls: 20,  // Wave 5 value

// After:
maxToolCalls: 25,  // Wave 6: 10 tools total (5 Wave 5 + 5 Wave 6)
```

## Verification
- [ ] Payroll agent has 10 total tools (5 from Wave 5 + 5 new)
- [ ] All 5 new tool handlers instantiate correct services
- [ ] types.ts extended with all Wave 6 input/output fields
- [ ] config.ts maxToolCalls increased to 25
- [ ] System prompt updated to mention STP, payslips, awards, timesheets
- [ ] Import statements added for all 4 new services
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-06`

## Dependencies
- **Agent 2**: STPService must exist
- **Agent 3**: PayslipService must exist
- **Agent 4**: AwardService must exist
- **Agent 5**: TimesheetService must exist
- **Coordination rule**: Only Agent 6 modifies payroll-agent.ts, types.ts, config.ts
