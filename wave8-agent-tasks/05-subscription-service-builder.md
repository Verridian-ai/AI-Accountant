# Agent 5: Subscription Service Builder

## Role
Create the SubscriptionService class for managing customer subscriptions linked to recurring invoices.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/subscriptions.ts`
**Purpose**: Customer subscription lifecycle management
**Pattern**: Follow `server/src/services/invoicing.ts` for service structure

#### Class: `SubscriptionService`

**Constructor**: Takes `db` parameter

**Methods to implement**:

- [ ] `createSubscription(input: CreateSubscriptionInput): Promise<CustomerSubscription>`
  - Generate UUID for id
  - Validate customerId exists and is active
  - Validate frequency is one of: 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'
  - Validate amount > 0 (cents)
  - If `createRecurring` is true, automatically create a linked recurring invoice via `RecurringInvoiceService`
  - Insert into `customerSubscriptions` table
  - Return the created subscription

- [ ] `listSubscriptions(customerId: string, options?: { status?: string; page?: number; limit?: number }): Promise<{ data: SubscriptionWithDetails[]; total: number }>`
  - Query by customerId, optionally filter by status
  - Join with `recurringInvoices` for next generation date
  - Paginate with offset/limit
  - Return `{ data, total }`

- [ ] `getSubscription(id: string): Promise<SubscriptionWithDetails>`
  - Join with customer details and recurring invoice info
  - Throw 404 if not found

- [ ] `updateSubscription(id: string, input: Partial<CreateSubscriptionInput>): Promise<CustomerSubscription>`
  - Only update provided fields
  - If amount or frequency changes AND linked recurring invoice exists, update it too
  - Return updated subscription

- [ ] `pauseSubscription(id: string): Promise<CustomerSubscription>`
  - Set status = 'paused'
  - If linked recurring invoice exists, set isActive = false
  - Return updated subscription

- [ ] `resumeSubscription(id: string): Promise<CustomerSubscription>`
  - Validate current status is 'paused'
  - Set status = 'active'
  - If linked recurring invoice exists, set isActive = true and recalculate nextGenerationDate
  - Return updated subscription

- [ ] `cancelSubscription(id: string): Promise<CustomerSubscription>`
  - Set status = 'cancelled', endDate = today
  - If linked recurring invoice exists, set isActive = false
  - Return updated subscription

- [ ] `getSubscriptionSummary(userId: string): Promise<SubscriptionSummary>`
  - Aggregate across all customers for this userId
  - Count active, paused, cancelled subscriptions
  - Calculate monthly recurring revenue (MRR):
    - Convert all frequencies to monthly equivalent
    - weekly × 52/12, fortnightly × 26/12, monthly × 1, quarterly / 3, annually / 12
  - Return summary object

#### Types to export:

```typescript
export interface CreateSubscriptionInput {
  customerId: string;
  name: string;
  amount: number; // cents
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';
  startDate: string;
  endDate?: string;
  createRecurring?: boolean; // auto-create linked recurring invoice
}

export interface SubscriptionWithDetails extends CustomerSubscription {
  customerName: string;
  nextInvoiceDate?: string; // from linked recurring invoice
  recurringInvoiceActive?: boolean;
}

export interface SubscriptionSummary {
  totalActive: number;
  totalPaused: number;
  totalCancelled: number;
  monthlyRecurringRevenue: number; // cents, normalized to monthly
}
```

#### MRR calculation helper:
```typescript
function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return Math.round(amount * 52 / 12);
    case 'fortnightly': return Math.round(amount * 26 / 12);
    case 'monthly': return amount;
    case 'quarterly': return Math.round(amount / 3);
    case 'annually': return Math.round(amount / 12);
    default: return amount;
  }
}
```

## Verification
- [ ] `SubscriptionService` exports all 8 methods
- [ ] `createSubscription()` with `createRecurring: true` creates linked recurring invoice
- [ ] `pauseSubscription()` deactivates linked recurring invoice
- [ ] `resumeSubscription()` reactivates linked recurring invoice
- [ ] `cancelSubscription()` sets end date and deactivates recurring invoice
- [ ] `getSubscriptionSummary()` correctly normalizes all frequencies to MRR
- [ ] All types exported
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-05`

## Dependencies
- **Agent 1**: Schema tables must exist for type imports
- **Agent 2**: `RecurringInvoiceService` for creating linked recurring invoices (import only — can be created with type stubs if Agent 2 isn't done yet)
- **Wave 7**: `customers` table must be accessible for validation
