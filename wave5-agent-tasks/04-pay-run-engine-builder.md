# Agent 4: Pay Run Engine Builder

## Role
Build the pay run processing engine that creates, calculates, processes, and reverses pay runs. Orchestrates PAYG calculator, super calculator, and leave management.

## Priority: SUB-WAVE 2 (After Agents 1, 2, 3)

## Files to CREATE

### 1. `server/src/services/payroll/pay-run-engine.ts`
**Purpose**: Complete pay run lifecycle management: draft → calculate → process → complete (or reverse)
**Pattern**: Service class with DB access via `wrapPgDb()`, imports PAYG and super calculators

```typescript
import { calculatePAYG } from './payg-calculator.js';
import { calculateSuper } from './super-calculator.js';

export class PayRunEngine {
  constructor(private db: any) {}

  /**
   * Create a draft pay run for a given period and frequency.
   * Auto-populates pay run lines from employee pay structures.
   */
  async createDraftPayRun(params: {
    userId: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    payDate: string;
    frequency: 'weekly' | 'fortnightly' | 'monthly';
  }): Promise<PayRun>;

  /**
   * Calculate PAYG, super, and net pay for all employees in a pay run.
   * Updates pay_run_summary with per-employee breakdown.
   * Does NOT finalize — allows review before processing.
   */
  async calculatePayRun(payRunId: string): Promise<PayRunCalculation>;

  /**
   * Process (finalize) a calculated pay run.
   * - Sets status to 'completed'
   * - Accrues leave for the period
   * - Creates leave transactions for any leave taken
   * - Updates pay run totals
   * - Sends SSE notification
   */
  async processPayRun(payRunId: string): Promise<void>;

  /**
   * Reverse a completed pay run.
   * - Sets status to 'reversed'
   * - Reverses all leave accruals and deductions
   * - Creates reversal leave transactions
   * - Does NOT delete pay run lines (audit trail preserved)
   */
  async reversePayRun(payRunId: string): Promise<void>;

  /**
   * Get full pay run detail with lines and summary.
   */
  async getPayRunDetail(payRunId: string): Promise<PayRunDetail>;

  /**
   * List pay runs with filtering and pagination.
   */
  async listPayRuns(params: {
    userId: string;
    status?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ data: PayRun[]; total: number }>;

  /**
   * Add or update a pay run line item.
   */
  async upsertPayRunLine(params: {
    payRunId: string;
    employeeId: string;
    payCategoryId: string;
    hours?: number;
    rate: number;
    amount: number;
    description?: string;
  }): Promise<PayRunLine>;

  /**
   * Get pay run lines for a specific pay run.
   */
  async getPayRunLines(payRunId: string): Promise<PayRunLine[]>;
}
```

**Implementation requirements:**

> **REVISION NOTE (D03 B4):** Pay run calculation MUST use BATCH processing, not row-by-row.
> For 100+ employees, row-by-row INSERTs will timeout. The entire pay run (lines + summaries
> + leave updates) MUST be wrapped in a SINGLE PostgreSQL transaction with rollback on failure.

> **REVISION NOTE (D02 COMP-05):** Completed pay runs MUST be IMMUTABLE. Once `status='completed'`,
> no modifications are allowed via PATCH or any other endpoint. Reversals create NEW correction
> pay runs (with `reversedPayRunId` referencing the original), they do NOT modify the original.
> Add a service-level guard: `if (payRun.status === 'completed' || payRun.status === 'reversed') throw new Error('Completed pay runs are immutable');`

> **REVISION NOTE (D03 B4):** Pay runs with >20 employees MUST be queued as background jobs
> via the existing queue service (`server/src/services/queue.ts`). The HTTP endpoint should
> return 202 Accepted with a job ID. Use SSE to notify the client of progress and completion.

- [ ] **Draft creation**: Query `employees` (active, non-casual for leave) and their `pay_structures` to auto-populate pay run lines
- [ ] **BATCH Calculation** (REVISION: D03 B4):
  1. Load ALL employees + pay structures + tax declarations in a SINGLE query (batch fetch)
  2. Compute PAYG/super/net for ALL employees in memory using `Promise.all()` for parallel PAYG lookups
  3. Use Drizzle batch insert: `db.insert(payRunLines).values([...allLines])` — NOT individual inserts
  4. Use Drizzle batch insert: `db.insert(payRunSummary).values([...allSummaries])`
  5. Sum all employee totals into `pay_runs` header in a single UPDATE
  6. Wrap entire operation in a single PostgreSQL transaction: `db.transaction(async (tx) => { ... })`
  7. Add progress callback: `onProgress?: (completed: number, total: number) => void` for UI feedback via SSE
- [ ] **Background queue for large pay runs** (REVISION: D03 B4):
  - If employee count > `PAY_RUN_BACKGROUND_THRESHOLD` (env var, default: 20), queue via `server/src/services/queue.ts`
  - Return `{ jobId, status: 'queued' }` with HTTP 202 Accepted
  - Emit SSE events: `pay_run_progress: { payRunId, completed, total, phase }` (phases: 'calculating', 'writing', 'accruing_leave')
  - On completion, emit `pay_run_complete: { payRunId, status }` via SSE
- [ ] **Processing**: After calculation is reviewed:
  1. Validate status is 'draft' (not already processed)
  2. Set status to 'completed', set processedAt
  3. Calculate proportional leave accrual for the period
  4. Deduct any approved leave taken during the period
  5. Create leave_transaction records for accruals and deductions
  6. **ALL of the above in a single transaction** (REVISION: D03 B4)
- [ ] **Immutability enforcement** (REVISION: D02 COMP-05):
  - `PATCH /api/payroll/pay-runs/:id` MUST check status — reject with 409 Conflict if status is 'completed' or 'reversed'
  - Add guard at top of `calculatePayRun()`: throw if status !== 'draft'
  - Add guard at top of `processPayRun()`: throw if status !== 'draft' (must calculate first, but status stays 'draft' until processing)
  - Add guard at top of `upsertPayRunLine()`: throw if pay run status !== 'draft'
  - Log all pay run state transitions to audit trail
- [ ] **Reversal** (REVISED: D02 COMP-05 — creates NEW correction pay run, NOT modify original):
  1. Validate original pay run status is 'completed'
  2. **DO NOT modify original pay run** — it remains 'completed' (immutable)
  3. Create a NEW pay run with status='reversed', `reversedPayRunId` pointing to original
  4. Create negative pay_run_lines mirroring the original (negative amounts)
  5. Create reversal leave_transaction records (negative accruals, positive deductions)
  6. Update leave_balances accordingly
  7. Mark original pay run with flag `hasReversal=true` (informational only, does not change status)
- [ ] **Pagination**: All list endpoints return `{ data: T[], total: number }` with `?offset=0&limit=50`
- [ ] **UUID generation**: Use `crypto.randomUUID()` for all new record IDs

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Draft pay run auto-populates lines from employee pay structures
- [ ] Calculation correctly computes PAYG, super, and net per employee
- [ ] Processing sets status, accrues leave, creates leave transactions
- [ ] Reversal restores leave balances and marks pay run as reversed
- [ ] Cannot process a pay run that isn't in 'draft' status
- [ ] Cannot reverse a pay run that isn't in 'completed' status
- [ ] All amounts are INTEGER cents
- [ ] Create marker file: `.agent-done-W05-04`

## Dependencies
- **Agent 1**: Schema must exist (pay_runs, pay_run_lines, pay_run_summary, leave_* tables)
- **Agent 2**: PAYG calculator must exist (`payg-calculator.ts`)
- **Agent 3**: Super calculator must exist (`super-calculator.ts`)
- **Wave 4**: Employee and pay structure tables must exist
