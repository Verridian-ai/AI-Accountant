# Agent 8: UI Recurring Invoice Builder

## Role
Build the RecurringInvoiceManager and SubscriptionManager UI components and add recurring/subscription API methods to api.ts.

## Priority: SUB-WAVE 4 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/invoicing/components/RecurringInvoiceManager.tsx`
**Purpose**: Create/manage recurring invoice schedules
**Pattern**: Follow `client/src/features/invoicing/components/InvoiceList.tsx` (Wave 7)

- [ ] Header section: "Recurring Invoices" title with "New Schedule" button
- [ ] Filter bar:
  - Active/Inactive toggle
  - Customer filter dropdown
  - Frequency filter dropdown (All, Weekly, Fortnightly, Monthly, Quarterly, Annually)
- [ ] Table/list view columns:
  - Customer Name (bold)
  - Frequency (badge: blue for monthly, green for quarterly, etc.)
  - Next Generation Date (DD/MM/YYYY)
  - Template Invoice # (or "No template")
  - Status badge (Active: green, Inactive: gray)
  - Actions: Edit, Generate Now, Cancel
- [ ] "Generate Now" button calls `invoicingApi.generateNextInvoice()` and shows toast
- [ ] New schedule form (inline or modal):
  - Customer selector dropdown
  - Frequency selector
  - Start date picker
  - End date picker (optional, default = no end)
  - Template invoice selector (optional — search existing draft invoices)
- [ ] Uses `invoicingApi.listRecurringInvoices()` for data
- [ ] Neumorphic dark theme: `bg-[#1a1b26]`, `neu-raised`, gold accents
- [ ] Loading state with `Loader2` spinner
- [ ] Empty state: "No recurring invoices configured"

### 2. `client/src/features/invoicing/components/SubscriptionManager.tsx`
**Purpose**: Customer subscription lifecycle management
**Pattern**: Follow `client/src/features/invoicing/components/CustomerList.tsx` (Wave 7)

- [ ] Header: "Subscriptions" with "New Subscription" button
- [ ] Filter by status: All, Active, Paused, Cancelled
- [ ] Table columns:
  - Customer Name
  - Subscription Name
  - Amount (AUD formatted: $X,XXX.XX)
  - Frequency
  - Start Date
  - Status badge:
    - Active: green
    - Paused: yellow/amber
    - Cancelled: red
  - Actions: Pause/Resume, Cancel, Edit
- [ ] Pause/Resume toggle button changes based on current status
- [ ] MRR summary card at top: "Monthly Recurring Revenue: $X,XXX.XX"
  - Uses `invoicingApi.getSubscriptionSummary()` if available, else calculates client-side
- [ ] New subscription form:
  - Customer selector
  - Name (text)
  - Amount (currency input, displays dollars, stores cents)
  - Frequency selector
  - Start date
  - End date (optional)
  - Checkbox: "Automatically create recurring invoice"
- [ ] Uses `invoicingApi.listSubscriptions()` and `invoicingApi.createSubscription()`

## Files to MODIFY

### 3. `client/src/api.ts`
**Purpose**: EXTEND `invoicingApi` with recurring invoice and subscription methods

**Add these methods to the existing `invoicingApi` object** (Agent 9 will add payment/dunning methods):

```typescript
// Recurring Invoices (add to existing invoicingApi)
listRecurringInvoices: async (options?: { page?: number; limit?: number; customerId?: string; isActive?: boolean }) => {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.customerId) params.set('customerId', options.customerId);
  if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
  const res = await fetch(`${BASE_URL}/api/invoices/recurring?${params}`, { headers: getAuthHeaders() });
  return res.json();
},
createRecurringInvoice: async (data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices/recurring`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
updateRecurringInvoice: async (id: string, data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices/recurring/${id}`, {
    method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
cancelRecurringInvoice: async (id: string) => {
  const res = await fetch(`${BASE_URL}/api/invoices/recurring/${id}`, {
    method: 'DELETE', headers: getAuthHeaders(),
  });
  return res.json();
},
generateNextInvoice: async (id: string) => {
  const res = await fetch(`${BASE_URL}/api/invoices/recurring/${id}/generate`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return res.json();
},

// Subscriptions
listSubscriptions: async (customerId: string, options?: { page?: number; limit?: number; status?: string }) => {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);
  const res = await fetch(`${BASE_URL}/api/customers/${customerId}/subscriptions?${params}`, { headers: getAuthHeaders() });
  return res.json();
},
createSubscription: async (customerId: string, data: any) => {
  const res = await fetch(`${BASE_URL}/api/customers/${customerId}/subscriptions`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
```

**Note**: Agent 9 will EXTEND this same `invoicingApi` object with payment gateway, dunning, and payment history methods. DO NOT create a separate object.

## Verification
- [ ] RecurringInvoiceManager renders with filters and schedule list
- [ ] RecurringInvoiceManager create form validates required fields
- [ ] "Generate Now" triggers invoice generation and shows toast
- [ ] SubscriptionManager shows subscriptions with status badges
- [ ] Pause/Resume/Cancel actions work correctly
- [ ] MRR summary card displays normalized monthly revenue
- [ ] All api.ts methods use correct URLs and HTTP methods
- [ ] Neumorphic dark theme applied consistently
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W08-08`

## Dependencies
- **Agent 7**: API routes must be available
- **Agent 9**: Will extend invoicingApi with payment/dunning methods (coordinate on api.ts edits)
