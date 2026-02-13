# Agent 4: Dunning Service Builder

## Role
Create the DunningService class for managing payment reminder sequences and automated dunning.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/dunning.ts`
**Purpose**: Payment reminder sequence management and automated dunning
**Pattern**: Follow `server/src/services/invoicing.ts` for service structure

#### Class: `DunningService`

**Constructor**: Takes `db` parameter

**Methods to implement**:

- [ ] `createSequence(input: CreateDunningSequenceInput): Promise<DunningSequence>`
  - Generate UUID for id
  - Validate steps array: each step must have `daysAfterDue` (number), `action` (string), `template` (string)
  - Validate actions are one of: 'email', 'sms', 'phone', 'suspend'
  - Steps must be in ascending order of `daysAfterDue`
  - Store steps as JSON string: `JSON.stringify(input.steps)`
  - Insert into `dunningSequences` table
  - Return the created sequence

- [ ] `listSequences(userId: string): Promise<DunningSequence[]>`
  - Query all sequences for userId
  - Parse `steps` JSON for each result
  - Return array sorted by name

- [ ] `getSequence(id: string): Promise<DunningSequenceWithParsedSteps>`
  - Parse `steps` JSON into typed array
  - Throw 404 if not found

- [ ] `updateSequence(id: string, input: Partial<CreateDunningSequenceInput>): Promise<DunningSequence>`
  - Validate steps if provided (same rules as create)
  - Update only provided fields
  - Return updated sequence

- [ ] `deactivateSequence(id: string): Promise<void>`
  - Set isActive = false

- [ ] `sendReminders(): Promise<DunningBatchResult>`
  - Find all overdue invoices (status = 'overdue' OR dueDate < today AND status = 'sent')
  - For each overdue invoice:
    1. Find applicable dunning sequence (user's active sequence)
    2. Calculate which step applies based on days overdue
    3. Check dunning_history to see if this step was already sent
    4. If not sent, create dunning_history entry and "send" reminder
  - NOTE: Actual email/SMS sending is mocked — just log and record in dunning_history
  - Return `{ sent: number, skipped: number, errors: string[] }`

  > **REVISION NOTE (D03 S9 — Dunning Rate Limiting)**:
  > Dunning email sends MUST be rate-limited to prevent email provider throttling and customer spam:
  > 1. **Per-customer limit**: Max 3 dunning emails per customer per day. Check `dunning_history` for sends in last 24 hours before sending.
  > 2. **Global rate limit**: Process at most 10 reminders per batch invocation. If more are due, return partial result and indicate remaining count.
  > 3. **Batch processing**: Queue dunning emails through Redis (or process sequentially with 1-second delay between sends) rather than firing all at once.
  > 4. The `POST /api/dunning/send-reminders` endpoint should return `202 Accepted` with a job ID for large batches (50+ overdue invoices), not block the HTTP response.
  > 5. Add `maxRemindersPerDay` and `batchSize` to `DunningBatchResult` for monitoring.
  > ```typescript
  > const MAX_EMAILS_PER_CUSTOMER_PER_DAY = 3;
  > const BATCH_SIZE = 10;
  > // Before sending, check:
  > const todaySends = await this.countDunningHistoryForCustomerToday(customerId);
  > if (todaySends >= MAX_EMAILS_PER_CUSTOMER_PER_DAY) { skipped++; continue; }
  > ```

- [ ] `getDunningHistory(invoiceId: string): Promise<DunningHistoryEntry[]>`
  - Query dunning_history for specific invoice
  - Join with dunning_sequences for sequence name
  - Order by sentAt ascending

- [ ] `getOverdueReport(userId: string): Promise<OverdueInvoiceSummary[]>`
  - Find all overdue invoices for user
  - Include customer name, invoice number, amount due, days overdue, last dunning action
  - Sort by days overdue descending (most overdue first)

#### Types to export:

```typescript
export interface DunningStep {
  daysAfterDue: number;
  action: 'email' | 'sms' | 'phone' | 'suspend';
  template: string; // email/sms template name or content
}

export interface CreateDunningSequenceInput {
  userId: string;
  name: string;
  steps: DunningStep[];
}

export interface DunningSequenceWithParsedSteps extends DunningSequence {
  parsedSteps: DunningStep[];
}

export interface DunningBatchResult {
  sent: number;
  skipped: number;
  errors: string[];
}

export interface OverdueInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amountDue: number; // cents
  dueDate: string;
  daysOverdue: number;
  lastDunningAction?: string;
  lastDunningSentAt?: string;
}
```

#### Default dunning sequence:
Provide a helper to create a sensible default:
```typescript
export const DEFAULT_DUNNING_STEPS: DunningStep[] = [
  { daysAfterDue: 1, action: 'email', template: 'friendly_reminder' },
  { daysAfterDue: 7, action: 'email', template: 'payment_overdue' },
  { daysAfterDue: 14, action: 'email', template: 'urgent_payment' },
  { daysAfterDue: 30, action: 'email', template: 'final_notice' },
  { daysAfterDue: 60, action: 'suspend', template: 'account_suspension' },
];
```

## Verification
- [ ] `DunningService` exports all 8 methods
- [ ] `DunningStep` interface correctly typed
- [ ] `createSequence()` validates step ordering (ascending daysAfterDue)
- [ ] `sendReminders()` checks dunning_history to avoid duplicate sends
- [ ] `sendReminders()` returns batch result summary
- [ ] `getOverdueReport()` joins invoices + customers for full details
- [ ] `DEFAULT_DUNNING_STEPS` exported as constant
- [ ] All types exported
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-04`

## Dependencies
- **Agent 1**: Schema tables must exist for type imports
- **Wave 7**: Access to `invoices` table for overdue invoice queries
