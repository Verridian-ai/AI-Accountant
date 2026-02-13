# Agent 8: API Endpoints Builder

## Role
Wire 15 new API routes for pay runs and leave management into the server. All routes under `/api/payroll/`.

## Priority: SUB-WAVE 4 (After Agents 4, 5, 6)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 15 new API endpoints for pay run CRUD and leave management
**Location**: Add after existing payroll routes (GET `/api/payroll/wages`, POST `/api/payroll/upload-ledger`, PATCH `/api/payroll/wages/:id`)

**Endpoints to add:**

#### Pay Run Endpoints (8)

- [ ] **GET `/api/payroll/pay-runs`** — List pay runs with pagination
  ```typescript
  app.get('/api/payroll/pay-runs', async (c) => {
    const { status, offset = '0', limit = '50' } = c.req.query();
    const userId = c.get('jwtPayload')?.userId ?? 'default';
    const result = await payRunEngine.listPayRuns({
      userId, status, offset: parseInt(offset), limit: parseInt(limit)
    });
    return c.json(result);
  });
  ```

- [ ] **POST `/api/payroll/pay-runs`** — Create draft pay run
  - Zod validation: `{ payPeriodStart: z.string(), payPeriodEnd: z.string(), payDate: z.string(), frequency: z.enum(['weekly','fortnightly','monthly']) }`
  - Returns created pay run

- [ ] **GET `/api/payroll/pay-runs/:id`** — Get pay run detail
  - Returns full pay run with lines and summary

- [ ] **POST `/api/payroll/pay-runs/:id/calculate`** — Calculate pay run
  - Triggers PAYG, super, net calculations for all employees
  - Returns calculation results for review

- [ ] **POST `/api/payroll/pay-runs/:id/process`** — Process (finalize) pay run
  - Validates status is 'draft', sets to 'completed'
  - Accrues leave, creates transactions
  - Returns confirmation

- [ ] **POST `/api/payroll/pay-runs/:id/reverse`** — Reverse pay run
  - Validates status is 'completed', sets to 'reversed'
  - Reverses leave accruals
  - Returns confirmation

- [ ] **GET `/api/payroll/pay-runs/:id/lines`** — Get pay run lines
  - Returns array of pay run line items

- [ ] **POST `/api/payroll/pay-runs/:id/lines`** — Add/update pay run line
  - Zod validation: `{ employeeId: z.string(), payCategoryId: z.string(), hours: z.number().optional(), rate: z.number(), amount: z.number(), description: z.string().optional() }`

#### Leave Endpoints (7)

- [ ] **GET `/api/payroll/leave/types`** — List leave types
  - Returns leave type definitions for the user

- [ ] **POST `/api/payroll/leave/types`** — Create leave type
  - Zod validation: `{ name: z.string(), accrualRate: z.number(), accrualFrequency: z.enum(['per_hour','per_pay_period','per_year']), maxBalance: z.number().optional(), isPaid: z.boolean() }`

- [ ] **GET `/api/payroll/leave/balances/:employeeId`** — Get leave balances
  - Returns all leave balances for an employee

- [ ] **POST `/api/payroll/leave/request`** — Submit leave request
  - Zod validation: `{ employeeId: z.string(), leaveTypeId: z.string(), startDate: z.string(), endDate: z.string(), hours: z.number(), notes: z.string().optional() }`
  - Validates sufficient balance before creating

- [ ] **POST `/api/payroll/leave/request/:id/approve`** — Approve leave
  - Sets status to 'approved', records approvedBy

- [ ] **POST `/api/payroll/leave/request/:id/reject`** — Reject leave
  - Sets status to 'rejected'
  - Optional body: `{ reason?: string }`

- [ ] **GET `/api/payroll/leave/calendar`** — Leave calendar view
  - Query params: `month` (YYYY-MM), optional `employeeId`
  - Returns leave entries for calendar display

**Implementation pattern for each endpoint:**
```typescript
app.post('/api/payroll/pay-runs', async (c) => {
  try {
    const body = await c.req.json();
    // Zod validation
    const schema = z.object({ ... });
    const parsed = schema.parse(body);

    const userId = c.get('jwtPayload')?.userId ?? 'default';
    const result = await payRunEngine.createDraftPayRun({ userId, ...parsed });
    return c.json(result, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('Error creating pay run:', error);
    return c.json({ error: error.message ?? 'Internal server error' }, 500);
  }
});
```

**Service instantiation** (add near top of file with other service instantiations):
```typescript
import { PayRunEngine } from './services/payroll/pay-run-engine.js';
import { LeaveManagementService } from './services/payroll/leave-management.js';

const payRunEngine = new PayRunEngine(db);
const leaveService = new LeaveManagementService(db);
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 15 endpoints compile and have correct HTTP method/path
- [ ] All POST endpoints have Zod request body validation
- [ ] All list endpoints support `?offset=0&limit=50` pagination
- [ ] Error responses follow `{ error: string }` format
- [ ] Service imports resolve correctly
- [ ] No conflicts with existing payroll routes (`/api/payroll/wages`, etc.)
- [ ] Create marker file: `.agent-done-W05-08`

## Dependencies
- **Agent 4**: Pay run engine must exist (`pay-run-engine.ts`)
- **Agent 5**: Leave management must exist (`leave-management.ts`)
- **Agent 6**: Payroll agent must be enhanced (for chat-based invocation)
- **Coordination rule**: Only Agent 8 modifies `server/src/index.ts`
