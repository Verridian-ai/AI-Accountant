# Agent 9: UI Purchase Order Builder

## Role
Build the purchase order editor, PO listing, goods receiving interface, and supplier payment run UI components.

## Priority: WAVE 10 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/ap/components/PurchaseOrderEditor.tsx`
**Purpose**: PO creation and editing with line items and supplier selection
**Pattern**: Follow `BillEntry.tsx` (Agent 8) for line item form patterns

**Features**:
- [ ] Supplier selector (autocomplete search)
- [ ] PO number display (auto-generated, read-only after creation)
- [ ] Expected delivery date picker
- [ ] Line items table:
  - Description, Quantity, Unit Price, Amount (auto-calc)
  - Add row, remove row buttons
  - Tab navigation between fields
- [ ] Totals: Subtotal, GST (10%), Total
- [ ] Notes textarea
- [ ] Save as Draft / Send to Supplier buttons
- [ ] Edit mode: only available for draft POs

### 2. `client/src/features/ap/components/POList.tsx`
**Purpose**: Purchase order listing with status tracking
**Pattern**: Follow `BillList.tsx` for list patterns

**Features**:
- [ ] Paginated table: PO #, Supplier, Issue Date, Expected Date, Total, Status, Receiving %
- [ ] Status filter tabs: All | Draft | Sent | Partially Received | Received | Cancelled
- [ ] Supplier filter dropdown
- [ ] Status badges: draft=gray, sent=blue, partially_received=yellow, received=green, cancelled=red
- [ ] Receiving progress bar (percentage of lines received)
- [ ] Quick actions: View, Send, Receive, Cancel
- [ ] "New PO" button

### 3. `client/src/features/ap/components/POReceiving.tsx`
**Purpose**: Goods receiving interface for three-way matching (PO → receipt → bill)
**Pattern**: Follow approval/workflow patterns

**Features**:
- [ ] PO header display: PO number, supplier, issue date, expected date, status
- [ ] Line items table with receiving columns:
  - Description, Ordered Qty, Previously Received, Receiving Now (editable input), Unit Price, Amount
  - Validation: receiving now + previously received ≤ ordered quantity
  - Highlight lines where receiving would complete the line
- [ ] Receipt date picker
- [ ] Notes textarea
- [ ] Receiving summary: lines fully received, lines partial, lines outstanding
- [ ] "Record Receipt" button
- [ ] Receipt history section: previous receipts for this PO with dates and quantities
- [ ] Three-way match panel (if a bill is linked):
  - Side-by-side: PO totals vs Receipt totals vs Bill totals
  - Per-line comparison
  - Match status indicator
  - Discrepancy highlighting

### 4. `client/src/features/ap/components/SupplierPaymentRun.tsx`
**Purpose**: Batch payment run creation and processing
**Pattern**: Follow batch operation patterns

**Features**:
- [ ] Payment date picker
- [ ] Supplier filter: optionally limit to one supplier's bills
- [ ] Approved bills table (multi-select checkboxes):
  - Bill #, Supplier, Due Date, Amount Due, Status
  - Select all / deselect all
  - Sort by due date (soonest first)
  - Only show 'approved' bills with amount_due > 0
- [ ] Selected bills summary: count, total amount
- [ ] Bank reference input (optional)
- [ ] "Create Payment Run" button → creates draft
- [ ] Payment run detail view:
  - Run summary: date, total, status, bank reference
  - Items list: bills being paid
  - "Process Payment" button → marks all bills as paid
  - Status: Draft → Processing → Completed

## Files to MODIFY

### 5. `client/src/api.ts`
**Purpose**: Add API functions for purchase orders and payment runs

```typescript
// Purchase Orders
export const fetchPurchaseOrders = async (options?: { page?: number; limit?: number; status?: string; supplierId?: string }) => { ... };
export const fetchPurchaseOrder = async (id: string) => { ... };
export const createPurchaseOrder = async (data: CreatePOInput) => { ... };
export const updatePurchaseOrder = async (id: string, data: UpdatePOInput) => { ... };
export const sendPurchaseOrder = async (id: string) => { ... };
export const receivePurchaseOrder = async (id: string, data: ReceiveGoodsInput) => { ... };
export const cancelPurchaseOrder = async (id: string) => { ... };

// Payment Runs
export const createPaymentRun = async (data: CreatePaymentRunInput) => { ... };
export const fetchPaymentRun = async (id: string) => { ... };
```

**Styling**: All components use neumorphic dark theme (`neu-raised`, `neu-inset`), gold (#FFCC00) accents

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] PurchaseOrderEditor creates POs with auto-numbered PO numbers
- [ ] POList shows correct status badges and receiving percentages
- [ ] POReceiving allows partial receiving with quantity validation
- [ ] POReceiving shows three-way match panel when bill is linked
- [ ] SupplierPaymentRun allows multi-select of approved bills
- [ ] Payment run processes all selected bills
- [ ] All components use neumorphic dark theme styling
- [ ] Create marker file: `.agent-done-W10-09`

## Dependencies
- **Agent 7** must complete API endpoints
- **Agent 8** must complete api.ts modifications first (to avoid merge conflicts)
