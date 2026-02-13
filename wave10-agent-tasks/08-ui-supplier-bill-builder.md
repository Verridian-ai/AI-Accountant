# Agent 8: UI Supplier & Bill Builder

## Role
Build the supplier management and bill entry/approval UI components, create the AP feature folder, and register the AP tab in navigation.

## Priority: WAVE 10 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/ap/components/APDashboard.tsx`
**Purpose**: Main AP hub with tabs for Bills, Purchase Orders, Suppliers, Payment Runs
**Pattern**: Follow `client/src/features/reports/components/ReportsDashboard.tsx` for dashboard layout

**Features**:
- [ ] Tab navigation: Bills (default) | Purchase Orders | Suppliers | Payment Runs
- [ ] Summary cards: Total Outstanding, Total Overdue, Bills Due This Week, Open POs
- [ ] Quick actions: New Bill, New PO, New Supplier, Payment Run
- [ ] AP aging mini-chart (donut showing bucket distribution)

### 2. `client/src/features/ap/components/SupplierList.tsx`
**Purpose**: Searchable supplier directory with filters
**Pattern**: Follow `client/src/features/transactions/components/TransactionTable.tsx` for list patterns

**Features**:
- [ ] Paginated table: Business Name, Contact, ABN, Payment Terms, Status, Total Outstanding
- [ ] Search bar (searches name, contact, ABN)
- [ ] Filter: Active/Archived toggle
- [ ] Click row to navigate to SupplierDetail
- [ ] "New Supplier" button

### 3. `client/src/features/ap/components/SupplierDetail.tsx`
**Purpose**: Supplier profile with bill history and payment terms
**Pattern**: Follow profile/detail component patterns

**Features**:
- [ ] Supplier info card: name, ABN, contact, email, phone, address
- [ ] Payment terms display
- [ ] Bank details (masked: BSB ✓, Account ****1234)
- [ ] Recent bills table (last 10)
- [ ] Total spend, outstanding amount, average days to payment
- [ ] Edit button → SupplierForm
- [ ] Archive button with confirmation

### 4. `client/src/features/ap/components/SupplierForm.tsx`
**Purpose**: Create/edit supplier form
**Pattern**: Follow form patterns from existing components

**Features**:
- [ ] Business name (required), contact name, email, phone
- [ ] Address textarea
- [ ] ABN input with format validation (11 digits)
- [ ] Payment terms (dropdown: 7, 14, 30, 60 days)
- [ ] Bank details section: BSB (XXX-XXX format), Account Number, Account Name
- [ ] Notes textarea
- [ ] Save and Cancel buttons
- [ ] Validation: ABN format, BSB format, required fields

### 5. `client/src/features/ap/components/BillEntry.tsx`
**Purpose**: Bill data entry form with line items, GST calculation, and PO linking
**Pattern**: Follow `client/src/features/invoicing/components/InvoiceEditor.tsx` (if exists) for line item form patterns

**Features**:
- [ ] Supplier selector (autocomplete search)
- [ ] Bill number input
- [ ] Issue date and due date pickers (due date auto-calculates from supplier payment terms)
- [ ] Line items table:
  - Description, Quantity, Unit Price, GST Rate (default 10%), Amount (auto-calc), GST Amount (auto-calc)
  - Add row, remove row buttons
- [ ] Totals summary: Subtotal, GST, Total
- [ ] PO linking: optional dropdown to link to existing PO for three-way matching
- [ ] Notes textarea
- [ ] Save as Draft / Submit for Approval buttons

### 6. `client/src/features/ap/components/BillList.tsx`
**Purpose**: Bill listing with status filters and quick actions
**Pattern**: Follow list/table component patterns

**Features**:
- [ ] Paginated table: Bill #, Supplier, Issue Date, Due Date, Total, Status, Actions
- [ ] Status filter tabs: All | Draft | Awaiting Approval | Approved | Overdue | Paid
- [ ] Supplier filter dropdown
- [ ] Status badges with colors (draft=gray, awaiting=yellow, approved=green, overdue=red, paid=blue)
- [ ] Quick actions per row: View, Approve, Pay, Void
- [ ] "New Bill" button

### 7. `client/src/features/ap/components/BillApproval.tsx`
**Purpose**: Bill approval workflow with PO matching verification
**Pattern**: Follow approval/review patterns

**Features**:
- [ ] Bill details display (read-only)
- [ ] Line items table
- [ ] If linked to PO: Three-way match panel showing:
  - PO amounts vs Receipt amounts vs Bill amounts
  - Match status: ✓ Matched / ⚠ Discrepancy / ○ Partial
  - Discrepancy details if any
- [ ] Approve / Reject buttons
- [ ] Rejection reason textarea (shown when rejecting)
- [ ] Approval confirmation dialog

## Files to MODIFY

### 8. `client/src/api.ts`
**Purpose**: Add API functions for suppliers, bills, and AP operations

```typescript
// Suppliers
export const fetchSuppliers = async (options?: { page?: number; limit?: number; search?: string; isActive?: boolean }) => { ... };
export const fetchSupplier = async (id: string) => { ... };
export const createSupplier = async (data: CreateSupplierInput) => { ... };
export const updateSupplier = async (id: string, data: UpdateSupplierInput) => { ... };
export const archiveSupplier = async (id: string) => { ... };

// Bills
export const fetchBills = async (options?: { page?: number; limit?: number; status?: string; supplierId?: string }) => { ... };
export const fetchBill = async (id: string) => { ... };
export const createBill = async (data: CreateBillInput) => { ... };
export const updateBill = async (id: string, data: UpdateBillInput) => { ... };
export const approveBill = async (id: string) => { ... };
export const payBill = async (id: string, data: RecordPaymentInput) => { ... };
export const voidBill = async (id: string) => { ... };

// AP Aging
export const fetchAPAging = async (asOfDate?: string) => { ... };
```

### 9. `client/src/App.tsx`
**Purpose**: Add AP tab and wire APDashboard component
- [ ] Import APDashboard
- [ ] Add 'ap' to tab routing
- [ ] Render APDashboard when 'ap' tab selected

### 10. `client/src/components/layout/BottomNavigation.tsx`
**Purpose**: Add 'ap' to TabId type
- [ ] Add `'ap'` to the TabId union type
- [ ] Add AP tab button with appropriate icon and label "AP"

**Styling**: All components use neumorphic dark theme (`neu-raised`, `neu-inset`), gold (#FFCC00) accents, dark background

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] APDashboard renders with tabs and summary cards
- [ ] SupplierList shows paginated suppliers with search
- [ ] SupplierForm validates inputs and creates/updates suppliers
- [ ] BillEntry calculates line item totals and GST correctly
- [ ] BillList filters by status and shows appropriate badges
- [ ] BillApproval shows three-way match when PO linked
- [ ] AP tab appears in BottomNavigation
- [ ] Create marker file: `.agent-done-W10-08`

## Dependencies
- **Agent 7** must complete API endpoints
- **Existing**: `client/src/api.ts`, `client/src/App.tsx`, BottomNavigation.tsx
