# Agent 9: UI Invoice Components Builder

## Role
Build the invoice management UI components and add the invoicing navigation tab.

## Priority: SUB-WAVE 4 (After Agent 7, and after Agent 8 edits api.ts)

## Files to CREATE

### 1. `client/src/features/invoicing/components/InvoiceList.tsx`
**Purpose**: Filterable, paginated invoice list with status badges
**Pattern**: Follow `client/src/features/documents/components/DocumentsDashboard.tsx`

- [ ] Filter bar at top:
  - Status dropdown: All, Draft, Sent, Paid, Overdue, Void
  - Customer filter dropdown (populated from customer list)
  - Date range picker (From / To)
- [ ] Table columns:
  - Invoice # (INV-000001 format, clickable)
  - Customer Name
  - Issue Date (DD/MM/YYYY format)
  - Due Date (DD/MM/YYYY format)
  - Total (AUD currency formatted)
  - Status badge:
    - Draft: gray bg
    - Sent: blue bg
    - Paid: green bg
    - Overdue: red bg
    - Void: dark gray bg, strikethrough
  - Actions: View, PDF, Send (if draft)
- [ ] Pagination controls
- [ ] "New Invoice" button → opens InvoiceEditor
- [ ] Uses `invoicingApi.listInvoices()` from api.ts

### 2. `client/src/features/invoicing/components/InvoiceEditor.tsx`
**Purpose**: Full invoice creation and editing form
**Pattern**: Custom form with dynamic line items

- [ ] Customer selector: searchable dropdown using `invoicingApi.searchCustomers()` or listCustomers
  - Shows business name, ABN, contact name
  - Auto-fills payment terms from customer record
- [ ] Invoice details section:
  - Issue Date (date picker, default today)
  - Due Date (auto-calculated from issue date + payment terms, editable)
  - Notes (textarea)
  - Terms & Conditions (textarea, with default template)
- [ ] Line items section (dynamic array):
  - Each line: Description | Qty | Unit Price | GST Rate | Amount
  - "Add Line" button to add new rows
  - Remove button (X) per row
  - Auto-calculate: amount = qty × unitPrice
  - Auto-calculate: gstAmount = amount × gstRate
  - Line total = amount + gstAmount
- [ ] Totals section (auto-updating):
  - Subtotal: SUM(line amounts)
  - GST (10%): SUM(line gstAmounts)
  - **Total: Subtotal + GST** (bold, large)
- [ ] Action buttons:
  - "Save as Draft" — creates invoice with status='draft'
  - "Save & Send" — creates and immediately sends
  - "Cancel" — returns to list
- [ ] All amounts displayed as AUD: `$X,XXX.XX`
- [ ] Internal state uses cents (integer), display converts to dollars

### 3. `client/src/features/invoicing/components/InvoicePreview.tsx`
**Purpose**: Live preview of invoice as it would appear in PDF
**Pattern**: Card-based layout mimicking PDF structure

- [ ] Receives invoice data as props (from InvoiceEditor or from loaded invoice)
- [ ] Renders:
  - Business header (name, ABN, address from business profile if available)
  - "TAX INVOICE" title
  - Invoice #, dates
  - Bill To section with customer details
  - Line items table
  - Totals breakdown (Subtotal, GST, Total)
  - Payment terms
  - Notes
- [ ] Print-friendly styling (white background with dark text for contrast)
- [ ] Can be used both as live editor preview and as read-only invoice view
- [ ] Download PDF button that calls `invoicingApi.downloadInvoicePDF()`

### 4. `client/src/features/invoicing/components/InvoicePDF.tsx`
**Purpose**: PDF download/email wrapper component
**Pattern**: Button component with loading state

- [ ] Download PDF button
  - Calls `invoicingApi.downloadInvoicePDF(invoiceId)`
  - Shows loading spinner during generation
  - Triggers browser download on success
- [ ] Send via Email button (optional, calls sendInvoice endpoint)
- [ ] Print button (opens browser print dialog for InvoicePreview)
- [ ] Status indicator: PDF generated / PDF pending
- [ ] Uses fetch with `blob()` response for PDF download

## Files to MODIFY

### 5. `client/src/api.ts`
**Purpose**: EXTEND the `invoicingApi` object with invoice methods (Agent 8 creates the customer methods)

**Add these methods to the existing `invoicingApi` object**:
```typescript
// Invoices (add to existing invoicingApi)
listInvoices: async (options?: { page?: number; limit?: number; status?: string; customerId?: string; dateFrom?: string; dateTo?: string }) => {
  const params = new URLSearchParams();
  // ... build params
  const res = await fetch(`${BASE_URL}/api/invoices?${params}`, { headers: getAuthHeaders() });
  return res.json();
},
getInvoice: async (id: string) => {
  const res = await fetch(`${BASE_URL}/api/invoices/${id}`, { headers: getAuthHeaders() });
  return res.json();
},
createInvoice: async (data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
updateInvoice: async (id: string, data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices/${id}`, {
    method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
sendInvoice: async (id: string) => {
  const res = await fetch(`${BASE_URL}/api/invoices/${id}/send`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return res.json();
},
voidInvoice: async (id: string) => {
  const res = await fetch(`${BASE_URL}/api/invoices/${id}/void`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return res.json();
},
downloadInvoicePDF: async (id: string): Promise<Blob> => {
  const res = await fetch(`${BASE_URL}/api/invoices/${id}/pdf`, { headers: getAuthHeaders() });
  return res.blob();
},
recordPayment: async (invoiceId: string, data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}/payment`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
createCreditNote: async (data: any) => {
  const res = await fetch(`${BASE_URL}/api/invoices/credit-note`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
},
getNextInvoiceNumber: async (): Promise<string> => {
  const res = await fetch(`${BASE_URL}/api/invoices/next-number`, { headers: getAuthHeaders() });
  const json = await res.json();
  return json.nextNumber;
},
```

### 6. `client/src/App.tsx`
**Purpose**: Add invoicing tab to the main application

- [ ] Import InvoicingDashboard from features/invoicing
- [ ] Add `'invoicing'` to the TabId type/union
- [ ] Add tab definition with icon `FileText` from lucide-react and label "Invoicing"
- [ ] Add case for rendering InvoicingDashboard when activeTab === 'invoicing'

### 7. `client/src/components/layout/BottomNavigation.tsx`
**Purpose**: Add invoicing to the navigation menu

- [ ] Add `'invoicing'` to the TabId type
- [ ] Add entry in the allTabs array:
  ```typescript
  { id: 'invoicing', label: 'Invoicing', icon: FileText }
  ```
- [ ] Place in the OPERATIONS group (alongside Transfers, Inventory)

## Verification
- [ ] InvoiceList displays invoices with correct status badges and pagination
- [ ] InvoiceEditor creates invoices with auto-numbering and correct GST calculation
- [ ] InvoicePreview shows formatted invoice matching PDF layout
- [ ] InvoicePDF downloads valid PDF file
- [ ] Navigation tab appears and switches to invoicing dashboard
- [ ] All amounts displayed as AUD currency format
- [ ] Neumorphic dark theme applied consistently
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-09`

## Dependencies
- **Agent 7**: API routes must exist
- **Agent 8**: Must have finished editing api.ts with customer methods FIRST
