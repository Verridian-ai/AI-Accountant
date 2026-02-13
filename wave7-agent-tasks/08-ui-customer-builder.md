# Agent 8: UI Customer Components Builder

## Role
Build the customer management UI components for the invoicing feature.

## Priority: SUB-WAVE 4 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/invoicing/components/InvoicingDashboard.tsx`
**Purpose**: Main invoicing hub with sub-tabs and summary cards
**Pattern**: Follow `client/src/features/inventory/components/InventoryDashboard.tsx`

- [ ] Internal sub-tabs: `type SubTab = 'customers' | 'invoices' | 'create'`
- [ ] Summary cards row at top:
  - Total Outstanding (gold accent for large amounts)
  - Overdue Count (red warning)
  - Revenue This Month (green positive)
  - Total Customers (neutral)
- [ ] Renders the active sub-tab component below
- [ ] Uses `useState` for activeSubTab, defaults to 'customers'
- [ ] Fetches summary data from `/api/invoices/next-number` endpoint (or a summary endpoint)
- [ ] Neumorphic dark theme: `bg-[#1a1b26]`, `neu-raised`, `neu-inset` classes
- [ ] Gold (#FFCC00) accent on active tab, headers, borders

### 2. `client/src/features/invoicing/components/CustomerList.tsx`
**Purpose**: Searchable, filterable customer directory
**Pattern**: Follow `client/src/features/inventory/components/InventoryItemList.tsx`

- [ ] Search input at top (filters by business name, contact name, email)
- [ ] Toggle: Show active / Show all customers
- [ ] Table/list view with columns:
  - Business Name (primary, bold)
  - Contact Name
  - Email
  - ABN (formatted: XX XXX XXX XXX)
  - Outstanding Balance (formatted as AUD currency)
  - Status badge (Active: green, Archived: gray)
- [ ] Click row → opens CustomerDetail or navigates to detail view
- [ ] "Add Customer" button (opens CustomerForm)
- [ ] Pagination controls at bottom
- [ ] Uses `invoicingApi.listCustomers()` from api.ts
- [ ] Loading state with `Loader2` spinner from lucide-react
- [ ] Empty state when no customers

### 3. `client/src/features/invoicing/components/CustomerDetail.tsx`
**Purpose**: Full customer profile view with invoice history
**Pattern**: Follow `client/src/features/entities/components/EntityHierarchyView.tsx`

- [ ] Customer info section: business name, ABN, contact, email, phone, address
- [ ] Edit button → switches to inline edit mode (or opens CustomerForm)
- [ ] Contacts list with add contact button
- [ ] Invoice history table: recent invoices for this customer
  - Invoice number, date, amount, status badge
  - Click → navigate to invoice detail
- [ ] Balance summary: Total outstanding, overdue amount
- [ ] Archive button (with confirmation dialog)
- [ ] Uses `invoicingApi.getCustomer()` from api.ts

### 4. `client/src/features/invoicing/components/CustomerForm.tsx`
**Purpose**: Create/edit customer form
**Pattern**: Follow existing form patterns (inline Tailwind-styled forms)

- [ ] Form fields:
  - Business Name (required, text)
  - Contact Name (optional, text)
  - Email (optional, email validation)
  - Phone (optional, text)
  - ABN (optional, 11-digit validation, formatted display)
  - Address (optional, text)
  - City (optional, text)
  - State (optional, dropdown: NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
  - Postcode (optional, 4-digit)
  - Country (optional, default AU)
  - Payment Terms (optional, number, default 30 days)
  - Notes (optional, textarea)
- [ ] Submit button: "Create Customer" or "Update Customer"
- [ ] Cancel button
- [ ] Form validation with inline error messages
- [ ] Loading state during submission
- [ ] Success toast notification (via Sonner)
- [ ] Uses `invoicingApi.createCustomer()` or `invoicingApi.updateCustomer()`

## Files to MODIFY

### 5. `client/src/api.ts`
**Purpose**: Add invoicingApi object with customer methods

```typescript
export const invoicingApi = {
  // Customers
  listCustomers: async (options?: { page?: number; limit?: number; search?: string; isActive?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
    const res = await fetch(`${BASE_URL}/api/customers?${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
  getCustomer: async (id: string) => {
    const res = await fetch(`${BASE_URL}/api/customers/${id}`, { headers: getAuthHeaders() });
    return res.json();
  },
  createCustomer: async (data: any) => {
    const res = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  updateCustomer: async (id: string, data: any) => {
    const res = await fetch(`${BASE_URL}/api/customers/${id}`, {
      method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  archiveCustomer: async (id: string) => {
    const res = await fetch(`${BASE_URL}/api/customers/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return res.json();
  },
  listContacts: async (customerId: string) => {
    const res = await fetch(`${BASE_URL}/api/customers/${customerId}/contacts`, { headers: getAuthHeaders() });
    return res.json();
  },
  addContact: async (customerId: string, data: any) => {
    const res = await fetch(`${BASE_URL}/api/customers/${customerId}/contacts`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
```

**Note**: Agent 9 will EXTEND this same `invoicingApi` object with invoice methods. DO NOT create a separate object.

## Verification
- [ ] InvoicingDashboard renders with sub-tabs and summary cards
- [ ] CustomerList displays customer data with search and pagination
- [ ] CustomerDetail shows customer profile with invoice history
- [ ] CustomerForm validates input and creates/updates customers
- [ ] All components use neumorphic dark theme (bg-[#1a1b26])
- [ ] Gold (#FFCC00) accent applied consistently
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-08`

## Dependencies
- **Agent 7**: API routes must be available
- **Agent 9**: Will extend invoicingApi with invoice methods (coordinate on api.ts edits)
