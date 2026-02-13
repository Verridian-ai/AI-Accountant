# Agent 7: API Endpoints Builder

## Role
Wire 22 new API routes for suppliers, bills, purchase orders, payment runs, and AP aging in server/src/index.ts.

## Priority: WAVE 10 (After Agents 2, 3, 4, 5)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 22 new API endpoints
**Pattern**: Follow existing endpoint patterns — use Zod validation, pagination, error handling

**Add these routes** (group them together with a section comment):

```typescript
// ============================================================================
// ACCOUNTS PAYABLE & PURCHASE ORDERS (Wave 10)
// ============================================================================
```

#### Supplier Endpoints (5)

- [ ] `GET /api/suppliers` — List suppliers (paginated)
  - Query params: `?page=1&limit=50&isActive=true&search=term`
  - Handler: `supplierService.listSuppliers(userId, options)`
  - Response: `{ data: Supplier[], total: number }`

- [ ] `POST /api/suppliers` — Create supplier
  - Body (Zod): `{ businessName: string, contactName?: string, email?: string, phone?: string, address?: string, abn?: string, paymentTermsDays?: number, bankBsb?: string, bankAccountNumber?: string, bankAccountName?: string, notes?: string }`
  - Handler: `supplierService.createSupplier(userId, body)`
  - Response: `{ data: Supplier }` (201)

- [ ] `GET /api/suppliers/:id` — Get supplier detail
  - Handler: `supplierService.getSupplier(id)`
  - Response: `{ data: SupplierDetail }`

- [ ] `PATCH /api/suppliers/:id` — Update supplier
  - Body (Zod): Partial of create body
  - Handler: `supplierService.updateSupplier(id, body)`
  - Response: `{ data: Supplier }`

- [ ] `DELETE /api/suppliers/:id` — Archive supplier (soft delete)
  - Handler: `supplierService.archiveSupplier(id)`
  - Response: `{ success: true }`

#### Bill Endpoints (7)

- [ ] `GET /api/bills` — List bills (paginated)
  - Query params: `?page=1&limit=50&status=draft&supplierId=xxx`
  - Handler: `billService.listBills(userId, options)`
  - Response: `{ data: BillWithSupplier[], total: number }`

- [ ] `POST /api/bills` — Create bill with line items
  - Body (Zod): `{ supplierId: string, billNumber?: string, issueDate: string, dueDate: string, currency?: string, notes?: string, lineItems: Array<{ description: string, quantity: number, unitPriceCents: number, gstRate?: number, accountCode?: string, taxCode?: string }> }`
  - Handler: `billService.createBill(userId, body)`
  - Response: `{ data: Bill }` (201)

- [ ] `GET /api/bills/:id` — Get bill detail
  - Handler: `billService.getBill(id)`
  - Response: `{ data: BillDetail }`

- [ ] `PATCH /api/bills/:id` — Update bill
  - Body (Zod): Partial update
  - Handler: `billService.updateBill(id, body)`
  - Response: `{ data: Bill }`

- [ ] `POST /api/bills/:id/approve` — Approve bill
  - Handler: `billService.approveBill(id, userId)`
  - Response: `{ data: Bill }`

- [ ] `POST /api/bills/:id/pay` — Record bill payment
  - Body (Zod): `{ paymentDate: string, amountCents: number, paymentMethod?: string, reference?: string, transactionId?: string, notes?: string }`
  - Handler: `billService.recordPayment(id, body)`
  - Response: `{ data: BillPayment }`

- [ ] `POST /api/bills/:id/void` — Void bill
  - Handler: `billService.voidBill(id)`
  - Response: `{ data: Bill }`

#### Purchase Order Endpoints (7)

- [ ] `GET /api/purchase-orders` — List POs (paginated)
  - Query params: `?page=1&limit=50&status=sent&supplierId=xxx`
  - Handler: `purchaseOrderService.listPurchaseOrders(userId, options)`
  - Response: `{ data: POWithSupplier[], total: number }`

- [ ] `POST /api/purchase-orders` — Create PO
  - Body (Zod): `{ supplierId: string, expectedDate?: string, notes?: string, lineItems: Array<{ description: string, quantity: number, unitPriceCents: number }> }`
  - Handler: `purchaseOrderService.createPurchaseOrder(userId, body)`
  - Response: `{ data: PurchaseOrder }` (201)

- [ ] `GET /api/purchase-orders/:id` — Get PO detail
  - Handler: `purchaseOrderService.getPurchaseOrder(id)`
  - Response: `{ data: PODetail }`

- [ ] `PATCH /api/purchase-orders/:id` — Update PO
  - Body (Zod): Partial update (draft only)
  - Handler: `purchaseOrderService.updatePurchaseOrder(id, body)`
  - Response: `{ data: PurchaseOrder }`

- [ ] `POST /api/purchase-orders/:id/send` — Send PO to supplier
  - Handler: `purchaseOrderService.sendPurchaseOrder(id)`
  - Response: `{ data: PurchaseOrder }`

- [ ] `POST /api/purchase-orders/:id/receive` — Record goods receipt
  - Body (Zod): `{ receiptDate: string, receivedBy?: string, notes?: string, lines: Array<{ poLineId: string, quantityReceived: number }> }`
  - Handler: `purchaseOrderService.receiveGoods(id, body)`
  - Response: `{ data: POReceipt }`

- [ ] `POST /api/purchase-orders/:id/cancel` — Cancel PO
  - Handler: `purchaseOrderService.cancelPurchaseOrder(id)`
  - Response: `{ data: PurchaseOrder }`

#### Supplier Payment Run Endpoints (2)

- [ ] `POST /api/supplier-payments` — Create payment run
  - Body (Zod): `{ paymentDate: string, billIds: string[], bankReference?: string }`
  - Handler: `purchaseOrderService.createPaymentRun(userId, body)`
  - Response: `{ data: SupplierPaymentRun }` (201)

- [ ] `GET /api/supplier-payments/:id` — Get payment run detail
  - Handler: `purchaseOrderService.getPaymentRun(id)`
  - Response: `{ data: PaymentRunDetail }`

#### AP Aging Endpoint (1)

- [ ] `GET /api/ap/aging` — AP aging report
  - Query params: `?asOfDate=YYYY-MM-DD` (optional, default today)
  - Handler: `billService.getAPAging(userId, asOfDate)`
  - Response: `{ data: APAgingReport }`

### 2. Service Imports
**Add at top of index.ts**:
```typescript
import { SupplierService } from './services/suppliers.js';
import { BillService } from './services/bills.js';
import { PurchaseOrderService } from './services/purchase-orders.js';
```

**Instantiate services**:
```typescript
const supplierService = new SupplierService(db);
const billService = new BillService(db);
const purchaseOrderService = new PurchaseOrderService(db);
```

### 3. Route Namespace Verification
- `/api/suppliers` — New namespace, NO conflicts
- `/api/bills` — New namespace, does NOT conflict with `/api/analytics/bills` (different prefix)
- `/api/purchase-orders` — New namespace, NO conflicts
- `/api/supplier-payments` — New namespace, NO conflicts
- `/api/ap/aging` — New namespace, NO conflicts

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 22 endpoints return correct response shapes
- [ ] Zod validation rejects invalid request bodies
- [ ] Pagination works with `?page=1&limit=50` returning `{ data, total }`
- [ ] No route namespace conflicts with existing endpoints
- [ ] Create marker file: `.agent-done-W10-07`

## Dependencies
- **Agents 2, 3, 4** must complete their services first
- **Agent 5** must complete AP agent (for agent dispatch)
- **Agent 1** must complete schema (for type imports in services)
