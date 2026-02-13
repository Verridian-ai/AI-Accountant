# Agent 9: UI Payment & Dunning Builder

## Role
Build the PaymentGatewaySetup, DunningManager, and PaymentHistory UI components. Add payment/dunning API methods to api.ts. Update InvoicingDashboard with new sub-tabs.

## Priority: SUB-WAVE 4 (After Agent 7, and after Agent 8 edits api.ts)

## Files to CREATE

### 1. `client/src/features/invoicing/components/PaymentGatewaySetup.tsx`
**Purpose**: Configure payment gateways (Stripe/PayPal/bank transfer)
**Pattern**: Follow settings-style form layout with card per gateway

- [ ] Card for each gateway provider:
  - **Stripe**: API key input, webhook URL display, connection status indicator (green dot = connected)
  - **PayPal**: Placeholder — "Coming soon" message
  - **Bank Transfer**: Account details display (BSB, Account #, Account Name)
- [ ] Each card has:
  - Provider icon/name header
  - Configuration form fields
  - "Save" / "Disconnect" button
  - Active/Inactive toggle
- [ ] Show connection status: Connected (green), Not Configured (gray), Error (red)
- [ ] Uses `invoicingApi.listPaymentGateways()` for current config
- [ ] Uses `invoicingApi.configureGateway()` for saving
- [ ] Neumorphic dark theme cards with gold accent borders

### 2. `client/src/features/invoicing/components/DunningManager.tsx`
**Purpose**: Build and manage payment reminder sequences
**Pattern**: Custom sequence builder UI

- [ ] Existing sequences list with:
  - Sequence name
  - Number of steps
  - Active/Inactive badge
  - Edit / Deactivate buttons
- [ ] Sequence builder form:
  - Name input
  - Dynamic step list (add/remove steps):
    - Each step: Days After Due (number), Action (dropdown: email/sms/phone/suspend), Template (text)
    - Steps displayed as vertical timeline with connecting lines
    - "Add Step" button
    - Remove step (X) button per step
  - Steps must be in ascending order by days — show validation error if not
- [ ] Preview section showing timeline visualization:
  - Day 1: Email — "Friendly Reminder"
  - Day 7: Email — "Payment Overdue"
  - Day 14: Email — "Urgent Payment"
  - Day 30: Email — "Final Notice"
  - Day 60: Suspend — "Account Suspension"
- [ ] "Send Reminders Now" button (admin action) — calls `invoicingApi.sendReminders()`
  - Shows result: "Sent: X, Skipped: Y, Errors: Z"
- [ ] Uses `invoicingApi.listDunningSequences()` and `invoicingApi.createDunningSequence()`

### 3. `client/src/features/invoicing/components/PaymentHistory.tsx`
**Purpose**: Payment timeline per customer with method breakdown
**Pattern**: Follow timeline/activity feed pattern

- [ ] Customer selector dropdown at top (or receives customerId as prop)
- [ ] Payment timeline (most recent first):
  - Each entry shows:
    - Date (DD/MM/YYYY)
    - Amount (AUD formatted)
    - Payment method (badge: Stripe/PayPal/Bank Transfer/Cash)
    - Linked invoice number (clickable)
    - Status (Completed/Pending/Failed)
- [ ] Summary cards at top:
  - Total Received (this month)
  - Average Days to Payment
  - Most Used Payment Method
  - Outstanding Balance
- [ ] Running balance line chart (optional, stretch goal)
- [ ] Uses invoice_payments table data via existing `invoicingApi.getInvoice()` or new endpoint

## Files to MODIFY

### 4. `client/src/api.ts`
**Purpose**: EXTEND `invoicingApi` with payment gateway, dunning, and related methods

**Add these methods to the existing `invoicingApi` object** (Agent 8 already added recurring/subscription methods):

```typescript
// Payment Gateways
listPaymentGateways: async () => {
  const res = await fetch(`${BASE_URL}/api/payments/gateways`, { headers: getAuthHeaders() });
  return res.json();
},
configureGateway: async (data: any) => {
  const res = await fetch(`${BASE_URL}/api/payments/gateways`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
processPayment: async (invoiceId: string) => {
  const res = await fetch(`${BASE_URL}/api/payments/process/${invoiceId}`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return res.json();
},

// Dunning
listDunningSequences: async () => {
  const res = await fetch(`${BASE_URL}/api/dunning/sequences`, { headers: getAuthHeaders() });
  return res.json();
},
createDunningSequence: async (data: any) => {
  const res = await fetch(`${BASE_URL}/api/dunning/sequences`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
sendReminders: async () => {
  const res = await fetch(`${BASE_URL}/api/dunning/send-reminders`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return res.json();
},
```

### 5. `client/src/features/invoicing/components/InvoicingDashboard.tsx`
**Purpose**: Add new sub-tabs for Wave 8 features

**Modify the SubTab type**:
```typescript
// BEFORE (Wave 7):
type SubTab = 'customers' | 'invoices' | 'create';

// AFTER (Wave 8 additions):
type SubTab = 'customers' | 'invoices' | 'create' | 'recurring' | 'subscriptions' | 'payments' | 'dunning';
```

**Add tab buttons for**:
- `recurring` — label: "Recurring", renders `RecurringInvoiceManager`
- `subscriptions` — label: "Subscriptions", renders `SubscriptionManager`
- `payments` — label: "Payments", renders combined `PaymentGatewaySetup` + `PaymentHistory`
- `dunning` — label: "Dunning", renders `DunningManager`

**Add imports for new components**:
```typescript
import { RecurringInvoiceManager } from './RecurringInvoiceManager';
import { SubscriptionManager } from './SubscriptionManager';
import { PaymentGatewaySetup } from './PaymentGatewaySetup';
import { DunningManager } from './DunningManager';
import { PaymentHistory } from './PaymentHistory';
```

**Add summary cards for Wave 8** (extend existing summary row):
- Recurring Active count
- MRR (Monthly Recurring Revenue)
- Overdue count (from dunning)

## Verification
- [ ] PaymentGatewaySetup shows gateway cards with connection status
- [ ] Stripe gateway configuration saves and shows connected status
- [ ] DunningManager allows creating multi-step sequences
- [ ] DunningManager validates ascending step order
- [ ] "Send Reminders Now" triggers batch and shows result toast
- [ ] PaymentHistory displays payment timeline with method badges
- [ ] InvoicingDashboard has 7 sub-tabs total (4 new: recurring, subscriptions, payments, dunning)
- [ ] All api.ts methods use correct URLs and HTTP methods
- [ ] Neumorphic dark theme applied consistently
- [ ] Gold (#FFCC00) accent on active tab, headers, borders
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-09`

## Dependencies
- **Agent 7**: API routes must exist
- **Agent 8**: Must have finished editing api.ts with recurring/subscription methods FIRST
