# Agent 7: API Routes Builder

## Role
Create the payments route file and extend the invoicing routes with 13 new API endpoints.

## Priority: SUB-WAVE 3 (After Agents 2, 3, 4, 5)

## Files to CREATE

### 1. `server/src/routes/payments-routes.ts`
**Purpose**: Payment gateway, dunning, and webhook endpoints
**Pattern**: Follow `server/src/routes/invoicing-routes.ts` (Wave 7)

#### Route Structure:
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const paymentsRoutes = new Hono();
```

#### Endpoints to implement (6):

**Payment Gateways (2)**:

- [ ] `GET /payments/gateways` — List payment gateways for user
  - Response: `PaymentGateway[]` (with masked config)
  - Calls `PaymentGatewayService.listGateways()`

- [ ] `POST /payments/gateways` — Configure a payment gateway
  - Body: `configureGatewaySchema` (Zod validated)
  - Response: `PaymentGateway` (with masked config)
  - Calls `PaymentGatewayService.configureGateway()`

**Payment Processing (1)**:

- [ ] `POST /payments/process/:invoiceId` — Process payment for an invoice
  - Params: invoiceId
  - Response: `PaymentResult`
  - Calls `PaymentGatewayService.processPayment()`

**Dunning (3)**:

- [ ] `GET /dunning/sequences` — List dunning sequences
  - Response: `DunningSequence[]`
  - Calls `DunningService.listSequences()`

- [ ] `POST /dunning/sequences` — Create dunning sequence
  - Body: `createDunningSequenceSchema` (Zod validated)
  - Response: `DunningSequence`
  - Calls `DunningService.createSequence()`

- [ ] `POST /dunning/send-reminders` — Trigger dunning reminder batch
  - Response: `DunningBatchResult`
  - Calls `DunningService.sendReminders()`

#### Zod Schemas:
```typescript
const configureGatewaySchema = z.object({
  provider: z.enum(['stripe', 'paypal', 'bank_transfer']),
  config: z.record(z.string()),
});

const createDunningSequenceSchema = z.object({
  name: z.string().min(1),
  steps: z.array(z.object({
    daysAfterDue: z.number().int().min(0),
    action: z.enum(['email', 'sms', 'phone', 'suspend']),
    template: z.string().min(1),
  })).min(1),
});
```

Export:
```typescript
export default paymentsRoutes;
```

## Files to MODIFY

### 2. `server/src/routes/invoicing-routes.ts`
**Purpose**: EXTEND with recurring invoice and subscription endpoints (7 new endpoints)

**Add BEFORE the existing `/invoices/:id` route** to avoid wildcard conflicts:

#### Recurring Invoice Endpoints (5):

- [ ] `GET /invoices/recurring` — List recurring invoices
  - Query params: `page`, `limit`, `customerId`, `isActive`
  - Response: `{ data: RecurringInvoiceWithCustomer[], total: number }`
  - Calls `RecurringInvoiceService.listRecurringInvoices()`
  - **IMPORTANT**: Register BEFORE `/invoices/:id` to avoid route conflict

- [ ] `POST /invoices/recurring` — Create recurring schedule
  - Body: `createRecurringInvoiceSchema` (Zod validated)
  - Response: `RecurringInvoice`
  - Calls `RecurringInvoiceService.createRecurringInvoice()`

- [ ] `PATCH /invoices/recurring/:id` — Update recurring schedule
  - Body: Partial of create schema
  - Response: `RecurringInvoice`
  - Calls `RecurringInvoiceService.updateRecurringInvoice()`

- [ ] `DELETE /invoices/recurring/:id` — Cancel recurring schedule
  - Response: `{ success: true }`
  - Calls `RecurringInvoiceService.cancelRecurringInvoice()`

- [ ] `POST /invoices/recurring/:id/generate` — Manually generate next invoice
  - Response: `Invoice` (the newly generated invoice)
  - Calls `RecurringInvoiceService.generateNextInvoice()`

#### Subscription Endpoints (2):

- [ ] `GET /customers/:id/subscriptions` — List customer subscriptions
  - Query params: `page`, `limit`, `status`
  - Response: `{ data: SubscriptionWithDetails[], total: number }`
  - Calls `SubscriptionService.listSubscriptions()`

- [ ] `POST /customers/:id/subscriptions` — Create subscription
  - Body: `createSubscriptionSchema` (Zod validated)
  - Response: `CustomerSubscription`
  - Calls `SubscriptionService.createSubscription()`

#### Additional Zod Schemas for invoicing-routes.ts:
```typescript
const createRecurringInvoiceSchema = z.object({
  customerId: z.string().min(1),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']),
  nextGenerationDate: z.string().optional(),
  endDate: z.string().optional(),
  templateInvoiceId: z.string().optional(),
});

const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  amount: z.number().int().positive(),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  createRecurring: z.boolean().optional(),
});
```

### 3. `server/src/index.ts`
**Purpose**: Mount the new payments routes

**Add import**:
```typescript
import paymentsRoutes from './routes/payments-routes.js';
```

**Add route mounting** (near other `app.route()` calls):
```typescript
app.route('/api', paymentsRoutes);
```

## Verification
- [ ] All 13 endpoints respond correctly
- [ ] `GET /invoices/recurring` registered BEFORE `/invoices/:id` (route ordering!)
- [ ] Zod validation rejects invalid input with 400 status
- [ ] Payment processing returns `PaymentResult` format
- [ ] Dunning send-reminders returns batch result
- [ ] `payments-routes.ts` mounted in `index.ts` via `app.route()`
- [ ] No route collisions with existing endpoints
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-07`

## Dependencies
- **Agent 2**: RecurringInvoiceService must exist
- **Agent 3**: PaymentGatewayService must exist
- **Agent 4**: DunningService must exist
- **Agent 5**: SubscriptionService must exist
