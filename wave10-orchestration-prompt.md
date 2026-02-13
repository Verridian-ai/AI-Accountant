# Wave 10 — Accounts Payable & Purchase Orders — Orchestration Prompt

You are the **Team Lead** for Wave 10: Accounts Payable & Purchase Orders. You coordinate 10 specialized agents to add supplier management, bill entry/approval, purchase order lifecycle with three-way matching (PO → receipt → bill), and batch payment runs to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 10, lines ~1280–1314)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 3)
- 11 Claude agents (original set)
- SQLite + PostgreSQL dual schema synchronized
- Multi-user Cognee operational (per-user dataset prefixing from Wave 3)
- Chat→Agent bridge with intent routing from Wave 1
- Transaction mutations and streaming from Wave 2
- 5 migrations (0009–0015) applied

**CRITICAL**: Wave 10 depends on Wave 3 (NOT Wave 9). It runs in PARALLEL with the Invoicing track (Waves 7-9) and the Payroll track (Waves 4-6).

## Dependencies
- **Requires**: Wave 3 complete (multi-user Cognee for per-user supplier datasets)
- **Does NOT require**: Waves 4-9 (those are parallel tracks)
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (10 tables)
| Table | Columns |
|-------|---------|
| `suppliers` | id, userId, businessName, contactName, email, phone, address, abn, paymentTermsDays (default 30), bankBsb, bankAccountNumber (encrypted), bankAccountName, notes, isActive (default true), createdAt |
| `bills` | id, userId, supplierId (FK→suppliers), billNumber, status ('draft'\|'awaiting_approval'\|'approved'\|'paid'\|'overdue'\|'void'), issueDate, dueDate, subtotal, gstAmount, totalAmount, amountPaid (default 0), amountDue, currency (default 'AUD'), notes, createdAt, updatedAt |
| `bill_lines` | id, billId (FK→bills CASCADE), description, quantity, unitPrice, amount, gstRate, gstAmount, accountCode, taxCode |
| `bill_payments` | id, billId (FK→bills), paymentDate, amount, paymentMethod, reference, transactionId (FK→transactions), notes, createdAt |
| `purchase_orders` | id, userId, supplierId (FK→suppliers), poNumber (UNIQUE), status ('draft'\|'sent'\|'partially_received'\|'received'\|'cancelled'), issueDate, expectedDate, subtotal, gstAmount, totalAmount, notes, createdAt, updatedAt |
| `po_lines` | id, purchaseOrderId (FK→purchase_orders CASCADE), description, quantity, unitPrice, amount, quantityReceived (default 0) |
| `po_receipts` | id, purchaseOrderId (FK→purchase_orders), receiptDate, receivedBy (FK→users), notes, createdAt |
| `po_receipt_lines` | id, receiptId (FK→po_receipts CASCADE), poLineId (FK→po_lines), quantityReceived |
| `supplier_payment_runs` | id, userId, paymentDate, status ('draft'\|'processing'\|'completed'), totalAmount, bankReference, createdAt |
| `supplier_payment_run_items` | id, paymentRunId (FK→supplier_payment_runs CASCADE), billId (FK→bills), amount |

**CRITICAL TABLE NAMING**: These table names MUST match exactly what Wave 11 (Inventory & Bank Reconciliation) code expects. Wave 11 agents reference `suppliers`, `bills`, `purchase_orders`, `po_lines`, `po_receipts`, and `po_receipt_lines` for inventory-bill linking and PO-to-inventory movement creation.

**Migration**: `docker/migrations/0022_ap_purchase_orders.sql`

## API Endpoints (22 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/suppliers | List suppliers (paginated) |
| POST | /api/suppliers | Create supplier |
| GET | /api/suppliers/:id | Get supplier detail |
| PATCH | /api/suppliers/:id | Update supplier |
| DELETE | /api/suppliers/:id | Archive supplier (soft delete) |
| GET | /api/bills | List bills (paginated, filterable by status/supplier) |
| POST | /api/bills | Create bill with line items |
| GET | /api/bills/:id | Get bill detail with lines and payments |
| PATCH | /api/bills/:id | Update bill |
| POST | /api/bills/:id/approve | Approve bill for payment |
| POST | /api/bills/:id/pay | Record bill payment |
| POST | /api/bills/:id/void | Void bill |
| GET | /api/purchase-orders | List purchase orders (paginated) |
| POST | /api/purchase-orders | Create PO with line items |
| GET | /api/purchase-orders/:id | Get PO detail with lines and receipts |
| PATCH | /api/purchase-orders/:id | Update PO |
| POST | /api/purchase-orders/:id/send | Mark PO as sent to supplier |
| POST | /api/purchase-orders/:id/receive | Record goods receipt (creates po_receipts + po_receipt_lines) |
| POST | /api/purchase-orders/:id/cancel | Cancel PO |
| POST | /api/supplier-payments | Create supplier payment run (batch) |
| GET | /api/supplier-payments/:id | Get payment run detail |
| GET | /api/ap/aging | AP aging report (mirroring AR aging from Wave 9) |

## UI Components
### `client/src/features/ap/` — New feature folder
- APDashboard.tsx — Main AP hub with tabs (Bills, Purchase Orders, Suppliers, Payment Runs)
- SupplierList.tsx — Searchable supplier directory with filters
- SupplierDetail.tsx — Supplier profile with bill history and payment terms
- SupplierForm.tsx — Create/edit supplier form
- BillEntry.tsx — Bill data entry form with line items, GST, and PO linking
- BillList.tsx — Bill listing with status filters and quick actions
- BillApproval.tsx — Bill approval workflow with PO matching verification
- PurchaseOrderEditor.tsx — PO creation/editing with line items
- POList.tsx — PO listing with status tracking
- POReceiving.tsx — Goods receiving interface (three-way match: PO → receipt → bill)
- SupplierPaymentRun.tsx — Batch payment run creation and processing

**Navigation**: Add `ap` to TabId type in BottomNavigation.tsx

## New Claude Agents (1)
1. **`accounts_payable_agent`** — Bill management, PO tracking, payment scheduling, three-way matching. Tools: `enter_bill`, `create_purchase_order`, `match_po_to_bill`, `schedule_payment`, `generate_aging_report`, `approve_payment_batch`, `search_vendor_bills`.

**Agent specification**:
- **Model**: Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Max Tool Calls**: 12
- **Pattern**: Follow `ClaudeAgent<AccountsPayableInput, AccountsPayableOutput>` from `base-agent.ts`

```typescript
interface AccountsPayableInput {
  userId: string;
  action: 'enter_bill' | 'create_po' | 'schedule_payment' | 'match_receipt' | 'aging_report' | 'approve_payment' | 'three_way_match';
  billId?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  amount?: number;
  dueDate?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPriceCents: number; gstRate: number }>;
}

interface AccountsPayableOutput {
  bill?: {
    id: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    gstCents: number;
    dueDate: string;
    status: string;
    purchaseOrderId?: string;
  };
  purchaseOrder?: {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    totalCents: number;
    status: string;
    linesReceived: number;
    linesTotal: number;
  };
  agingReport?: {
    current: { count: number; totalCents: number };
    days30: { count: number; totalCents: number };
    days60: { count: number; totalCents: number };
    days90Plus: { count: number; totalCents: number };
  };
  threeWayMatch?: {
    poNumber: string;
    billNumber: string;
    receiptDate: string;
    poTotalCents: number;
    receiptTotalCents: number;
    billTotalCents: number;
    discrepancies: string[];
    matchStatus: 'matched' | 'discrepancy' | 'partial';
  };
  paymentSchedule?: Array<{ billId: string; supplierName: string; amountCents: number; scheduledDate: string }>;
  summary: string;
}
```

## Cognee Integration
- **New datasets**: `supplier_profiles` (CHUNKS), `bill_patterns` (GRAPH_COMPLETION)
- Index supplier data for "Which supplier do we buy X from?"
- Index bill patterns for "What's our average bill from supplier Y?"
- Three-way match reasoning via GRAPH_COMPLETION
- Add `indexSupplierProfile()`, `searchSupplierProfiles()`, `indexBillPattern()`, `searchBillPatterns()` to CogneeTools

## Three-Way Matching Logic

The core AP feature is **three-way matching** (PO → Receipt → Bill):

1. **Purchase Order**: What was ordered (items, quantities, prices)
2. **Goods Receipt**: What was received (items, quantities, date)
3. **Bill/Invoice**: What the supplier is charging (items, quantities, prices)

**Matching rules**:
- Quantities: receipt.quantityReceived must match PO line.quantity
- Prices: bill line.unitPrice must match PO line.unitPrice (within tolerance)
- Amount: bill.totalAmount must match PO.totalAmount (within tolerance, configurable via `AP_AUTO_MATCH_THRESHOLD`)
- Status flow: PO sent → partially_received → received → bill matched → bill approved → bill paid

**Discrepancy handling**:
- Quantity mismatch: Flag for manual review, allow partial receipt
- Price mismatch: Flag for approval, show % variance
- Missing receipt: Bill cannot be auto-approved without receipt

## Testing Criteria
- [ ] Supplier CRUD with encrypted bank details
- [ ] Bill entry with line items and GST calculation
- [ ] Bill approval workflow (draft → awaiting_approval → approved → paid)
- [ ] PO creation with auto-numbering (PO-000001 format)
- [ ] PO sending marks status as 'sent'
- [ ] PO receiving creates receipt records and updates quantityReceived on po_lines
- [ ] Three-way match: PO total = receipt total = bill total → auto-approve
- [ ] Three-way match: discrepancy flagged when amounts don't match
- [ ] Partial receipt updates PO status to 'partially_received'
- [ ] Supplier payment run batches multiple approved bills
- [ ] AP aging report categorizes bills into aging buckets
- [ ] Chat answers "What bills are due this week?" via accounts_payable_agent
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: ap-schema-builder [PRIORITY: WAVE 1]
**Role**: Create all 10 AP/PO tables in dual schema + migration SQL
**Task file**: `wave10-agent-tasks/01-ap-schema.md`
**Creates**: docker/migrations/0022_ap_purchase_orders.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: supplier-service-builder [PRIORITY: WAVE 1]
**Role**: Build supplier management service with CRUD and bank details encryption
**Task file**: `wave10-agent-tasks/02-supplier-service.md`
**Creates**: server/src/services/suppliers.ts
**Dependencies**: None — can start immediately

### Agent 3: bill-service-builder [PRIORITY: WAVE 1]
**Role**: Build bill management service with line items, approval workflow, and payments
**Task file**: `wave10-agent-tasks/03-bill-service.md`
**Creates**: server/src/services/bills.ts
**Dependencies**: None — can start immediately

### Agent 4: purchase-order-service-builder [DEPENDS ON: Agent 1]
**Role**: Build PO lifecycle service with auto-numbering, receiving, and three-way matching
**Task file**: `wave10-agent-tasks/04-purchase-order-service.md`
**Creates**: server/src/services/purchase-orders.ts
**Dependencies**: Agent 1 must complete schema first

### Agent 5: ap-agent-builder [DEPENDS ON: Agents 2, 3, 4]
**Role**: Create accounts_payable_agent Claude agent with AP tools
**Task file**: `wave10-agent-tasks/05-ap-agent-builder.md`
**Creates**: server/src/services/claude/agents/accounts-payable-agent.ts
**Modifies**: server/src/services/claude/types.ts, server/src/services/claude/config.ts, server/src/services/claude/orchestrator.ts
**Dependencies**: All service files must exist for tool implementations

### Agent 6: cognee-ap-datasets [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for supplier profiles and bill patterns
**Task file**: `wave10-agent-tasks/06-cognee-ap-datasets.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/cognee_client.ts
**Dependencies**: Schema must exist

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Wire 22 new API routes in server/src/index.ts
**Task file**: `wave10-agent-tasks/07-api-endpoints-builder.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services and agent must exist

### Agent 8: ui-supplier-bill-builder [DEPENDS ON: Agent 7]
**Role**: Build supplier and bill UI components
**Task file**: `wave10-agent-tasks/08-ui-supplier-bill-builder.md`
**Creates**: APDashboard.tsx, SupplierList.tsx, SupplierDetail.tsx, SupplierForm.tsx, BillEntry.tsx, BillList.tsx, BillApproval.tsx in client/src/features/ap/components/
**Modifies**: client/src/api.ts, client/src/App.tsx, client/src/components/layout/BottomNavigation.tsx
**Dependencies**: API routes must exist

### Agent 9: ui-purchase-order-builder [DEPENDS ON: Agent 7]
**Role**: Build purchase order and payment run UI components
**Task file**: `wave10-agent-tasks/09-ui-purchase-orders.md`
**Creates**: PurchaseOrderEditor.tsx, POList.tsx, POReceiving.tsx, SupplierPaymentRun.tsx in client/src/features/ap/components/
**Modifies**: client/src/api.ts
**Dependencies**: API routes must exist

### Agent 10: testing-validation [DEPENDS ON: All]
**Role**: Run verification plan and documentation updates
**Task file**: `wave10-agent-tasks/10-testing-validation.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **types.ts lock**: Only Agent 5 modifies types.ts and config.ts
3. **index.ts lock**: Only Agent 7 modifies server/src/index.ts
4. **api.ts lock**: Only Agents 8 and 9 modify client/src/api.ts (Agent 8 first, then Agent 9)
5. **cognee-tools.ts lock**: Only Agent 6 modifies cognee-tools.ts
6. **Pattern compliance**: All new agents follow ClaudeAgent<TInput, TOutput> pattern from payroll-agent.ts
7. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
8. **Test before done**: `cd server && npx tsc --noEmit` must pass
9. **Marker naming**: Use `.agent-done-W10-{NN}` format (wave-prefixed to avoid collisions with other waves)
10. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation via `zValidator` middleware
11. **Index discipline**: Migration SQL MUST include CREATE INDEX for composite query patterns — at minimum: `bills(user_id, status)`, `bills(supplier_id)`, `purchase_orders(user_id, status)`, `purchase_orders(po_number)` UNIQUE, `po_lines(purchase_order_id)`, `po_receipts(purchase_order_id)`, **`po_receipt_lines(po_line_id)`** (REVISION: critical for three-way match JOINs — D03 B5), `supplier_payment_run_items(payment_run_id)`
12. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination (NOT `?page=`), returning `{ data: T[], total: number }`. Max limit=100. This matches the existing codebase convention. **REVISION NOTE (D01-CRIT-03)**: Standardized from page-based to offset-based pagination across all waves.
13. **Table name compatibility**: Table names MUST be: `suppliers`, `bills`, `bill_lines`, `bill_payments`, `purchase_orders`, `po_lines`, `po_receipts`, `po_receipt_lines`, `supplier_payment_runs`, `supplier_payment_run_items` — Wave 11 code depends on these exact names
14. **Bank detail encryption**: **REVISION (D02 SEC-05)**: `bankAccountNumber` in suppliers table MUST be encrypted using AES-256-GCM (NOT CBC) at application level. Use separate `BANK_ENCRYPTION_KEY` env var. Fail fast in production if key missing.
15. **ABN validation**: **REVISION (D02 COMP-04)**: All supplier ABNs MUST be validated using the existing `abn-lookup.ts` service. Format check (mod-89) is mandatory; ABR online lookup is best-effort.
16. **Separation of duties**: **REVISION (D02 SEC-08)**: PO creator cannot receive goods. Bill/PO creator cannot approve the same bill. Enforce via business rule check in `approveBill()` and `receiveGoods()`. Single-user exception allowed with warning log.
17. **Migration idempotency**: **REVISION (D04 DEP-01)**: Migration 0022 MUST use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — Wave 11 migration 0023 already exists on disk and may have been partially applied.
18. **Three-way matching efficiency**: **REVISION (D03 B5)**: Three-way matching MUST use SQL JOINs (not multiple separate queries). Tolerance capped at 5% maximum regardless of `AP_AUTO_MATCH_THRESHOLD` setting.
19. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min.
20. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via React.lazy() + Suspense. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use @tanstack/react-virtual.

## Debate Findings Applied

| Finding | Source | Resolution |
|---------|--------|------------|
| Marker naming collision | D05 §6 (P0) | Fixed: `.agent-done-W10-{NN}` format |
| Missing indexes | D03 §2.2 | Added index discipline to coordination rules + migration |
| Zod validation missing | D02 API-01 | Added Zod requirement to coordination rules |
| Pagination not standardized | D03 §4.3 | Added pagination standard to coordination rules |
| Wave 10 depends on Wave 3 NOT Wave 9 | R10 §2 | Corrected: Wave 10 requires only Wave 3 (multi-user Cognee) |
| Table name compatibility with Wave 11 | R03 BC-03 | Added table name compatibility rule — exact names enforced |
| Agent I/O contracts missing | D04 AG03 | Specified in task file 05 (AccountsPayableInput/Output) |
| Three-way matching not specified | D04 §Wave10 | Fully specified in orchestration prompt + task file 04 |
| bills near-miss with /api/analytics/bills | R06 §3.3 | Different prefix — no collision (verified) |
| **Three-way match indexing** | **D03 B5 (REVISION)** | **Added `po_receipt_lines(po_line_id)` index to migration 0022. Three-way match MUST use SQL JOINs, not multiple queries.** |
| **Supplier ABN validation** | **D02 COMP-04 (REVISION)** | **Use existing `abn-lookup.ts` service: mod-89 format check (always), ABR lookup (best-effort). Reject invalid ABN format, warn on ABR failure.** |
| **Bank detail encryption** | **D02 SEC-05 (REVISION)** | **Changed from AES-256-CBC to AES-256-GCM (authenticated encryption). Use separate `BANK_ENCRYPTION_KEY`. Fail fast in production if key missing.** |
| **Separation of duties** | **D02 SEC-08 (REVISION)** | **PO creator ≠ goods receiver. Bill creator ≠ bill approver. Business rule checks added to `approveBill()` and `receiveGoods()`. Single-user exception with warning.** |
| **Migration idempotency** | **D04 DEP-01 (REVISION)** | **Migration 0022 MUST use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` because Wave 11 migration 0023 already exists on disk.** |
| **Table name verification** | **D04 (REVISION)** | **Cross-checked with Wave 11: `suppliers`, `bills`, `bill_lines`, `purchase_orders`, `po_lines`, `po_receipts`, `po_receipt_lines` — all match. Wave 11 references `purchase_order` as `reference_type` in inventory_movements.** |

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 6
Sub-wave 3 (After 2):  Agent 5
Sub-wave 4 (After 3):  Agent 7
Sub-wave 5 (After 4):  Agent 8 + Agent 9
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave10-agent-tasks/` for detailed atomic tasks.
