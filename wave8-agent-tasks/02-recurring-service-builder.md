# Agent 2: Recurring Invoice Service Builder

## Role
Create the RecurringInvoiceService class that manages recurring invoice schedules and auto-generates invoices.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/recurring-invoices.ts`
**Purpose**: Full recurring invoice lifecycle management
**Pattern**: Follow `server/src/services/invoicing.ts` (Wave 7 InvoicingService)

#### Class: `RecurringInvoiceService`

**Constructor**: Takes `db` parameter (from `wrapPgDb()`)

**Methods to implement**:

- [ ] `createRecurringInvoice(input: CreateRecurringInvoiceInput): Promise<RecurringInvoice>`
  - Generate UUID for id
  - Validate customerId exists and is active
  - Validate templateInvoiceId exists (if provided)
  - Validate frequency is one of: 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'
  - Calculate nextGenerationDate from current date + frequency
  - Insert into `recurringInvoices` table
  - Return the created record

- [ ] `listRecurringInvoices(options?: { userId?: string; customerId?: string; isActive?: boolean; page?: number; limit?: number }): Promise<{ data: RecurringInvoiceWithCustomer[]; total: number }>`
  - Join with `customers` table for customer name
  - Filter by userId, customerId, isActive
  - Paginate with offset/limit
  - Return `{ data, total }`

- [ ] `getRecurringInvoice(id: string): Promise<RecurringInvoiceWithCustomer>`
  - Join with `customers` for customer details
  - Join with `invoices` for template invoice details
  - Throw 404 if not found

- [ ] `updateRecurringInvoice(id: string, input: Partial<CreateRecurringInvoiceInput>): Promise<RecurringInvoice>`
  - Only update provided fields
  - Recalculate nextGenerationDate if frequency changes
  - Return updated record

- [ ] `cancelRecurringInvoice(id: string): Promise<void>`
  - Set isActive = false
  - Does NOT delete the record (soft cancel)

- [ ] `generateNextInvoice(recurringId: string): Promise<Invoice>`
  - Load the recurring invoice record
  - If templateInvoiceId exists, copy line items from template
  - Call `InvoicingService.createInvoice()` with template data + new dates
  - Update `lastGeneratedAt` to now
  - Calculate and update `nextGenerationDate` based on frequency
  - Return the newly created invoice

- [ ] `processAllDueInvoices(): Promise<{ generated: number; errors: string[] }>`
  - Find all active recurring invoices where `nextGenerationDate <= today`
  - For each, call `generateNextInvoice()`
  - Track successes and errors
  - Return summary

  > **REVISION NOTE (D03 S8 — Reliable CRON-Based Scheduler)**:
  > Do NOT use `setTimeout` or `setInterval` for recurring invoice generation — both are unreliable (drift, lost on restart).
  > Instead, implement a **polling-based scheduler**:
  > 1. On server startup, call `processAllDueInvoices()` to catch up on any missed generations (handles server downtime).
  > 2. Use `node-cron` (or the existing Redis-based queue service) to run `processAllDueInvoices()` every 5 minutes.
  > 3. The method is **idempotent**: `lastGeneratedAt` prevents double-generation for the same period.
  > 4. Store `lastGeneratedAt` timestamp BEFORE generating (prevents duplicate if crash mid-generation).
  > 5. For missed schedules (server was down when invoice was due), generate all missed invoices on next run.
  > ```typescript
  > import cron from 'node-cron';
  > // In server startup:
  > await recurringService.processAllDueInvoices(); // catch-up on startup
  > cron.schedule('*/5 * * * *', () => recurringService.processAllDueInvoices());
  > ```
  > Add `node-cron` to `server/package.json` dependencies if not already present.

- [ ] `calculateNextDate(currentDate: string, frequency: string): string`
  - Private helper method
  - weekly: +7 days
  - fortnightly: +14 days
  - monthly: +1 month (same day, handle month-end)
  - quarterly: +3 months
  - annually: +1 year
  - Return ISO date string

#### Types to export:

```typescript
export interface CreateRecurringInvoiceInput {
  userId: string;
  customerId: string;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';
  nextGenerationDate?: string; // defaults to calculated from today
  endDate?: string;
  templateInvoiceId?: string;
}

export interface RecurringInvoiceWithCustomer extends RecurringInvoice {
  customerName: string;
  customerEmail?: string;
}
```

#### Integration points:
- Import `InvoicingService` for `createInvoice()` calls
- Import schema types from `schema.ts`
- Use `crypto.randomUUID()` for id generation
- Handle date arithmetic with standard JS Date (or day.js if available)

## Verification
- [ ] `RecurringInvoiceService` exports all 8 methods
- [ ] `CreateRecurringInvoiceInput` type exported
- [ ] `RecurringInvoiceWithCustomer` type exported
- [ ] `generateNextInvoice()` correctly copies template invoice line items
- [ ] `calculateNextDate()` handles all 5 frequency types
- [ ] `processAllDueInvoices()` returns `{ generated, errors }` summary
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-02`

## Dependencies
- **Agent 1**: Schema tables must exist for type imports
- **Wave 7**: `InvoicingService` must be available for `createInvoice()` calls
