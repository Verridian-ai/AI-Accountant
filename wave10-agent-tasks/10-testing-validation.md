# Agent 10: Testing & Validation

## Role
Run the complete verification plan for Wave 10, ensure TypeScript compilation passes, validate all API endpoints, and update documentation.

## Priority: WAVE 10 (After All Agents Complete)

## Verification Plan

### 1. TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with zero errors
- [ ] Run `cd client && npx tsc --noEmit` — must pass with zero errors
- [ ] If errors found, identify which agent's code caused them and document fixes needed

### 2. Schema Validation
- [ ] Verify all 10 new tables exist in `server/src/schema.ts`:
  - suppliers, bills, billLines, billPayments, purchaseOrders, poLines, poReceipts, poReceiptLines, supplierPaymentRuns, supplierPaymentRunItems
- [ ] Verify all 10 new tables exist in `server/src/db/postgres-schema.ts` with matching columns
- [ ] Verify 20 type exports (10 select + 10 insert types) in schema.ts
- [ ] **CRITICAL**: Verify table names match EXACTLY what Wave 11 expects:
  - `suppliers` (NOT `vendor` or `supplier`)
  - `bills` (NOT `vendor_invoices` or `ap_bills`)
  - `bill_lines` (NOT `bill_items`)
  - `bill_payments` (NOT `vendor_payments`)
  - `purchase_orders` (NOT `po` or `orders`)
  - `po_lines` (NOT `order_lines` or `purchase_order_lines`)
  - `po_receipts` (NOT `goods_receipts`)
  - `po_receipt_lines` (NOT `receipt_items`)
  - `supplier_payment_runs` (NOT `payment_batches`)
  - `supplier_payment_run_items` (NOT `payment_batch_items`)
- [ ] Verify migration `docker/migrations/0022_ap_purchase_orders.sql` is valid SQL:
  - Valid `CREATE TABLE IF NOT EXISTS` syntax
  - All FK references resolve
  - Indexes are created (at minimum: bills(user_id, status), purchase_orders(po_number) UNIQUE)
  - Wrapped in `BEGIN; ... COMMIT;`

### 3. Service Validation
- [ ] Verify `server/src/services/suppliers.ts` exports `SupplierService` class
- [ ] Verify `server/src/services/bills.ts` exports `BillService` class with:
  - createBill, listBills, getBill, updateBill, approveBill, recordPayment, voidBill, getAPAging
- [ ] Verify `server/src/services/purchase-orders.ts` exports `PurchaseOrderService` class with:
  - createPurchaseOrder, listPurchaseOrders, getPurchaseOrder, receiveGoods, threeWayMatch, createPaymentRun, processPaymentRun
- [ ] Verify bank account encryption in SupplierService (encrypt on save, decrypt on read)
- [ ] Verify three-way matching logic in PurchaseOrderService:
  - Compares PO totals vs receipt totals vs bill totals
  - Returns 'matched', 'discrepancy', or 'partial' status
  - Lists specific discrepancies

### 4. Agent Validation
- [ ] Verify `server/src/services/claude/agents/accounts-payable-agent.ts` exists
- [ ] Verify it extends `ClaudeAgent<AccountsPayableInput, AccountsPayableOutput>`
- [ ] Verify 7 tools defined: enter_bill, create_purchase_order, match_po_to_bill, schedule_payment, generate_aging_report, approve_payment_batch, search_vendor_bills
- [ ] Verify `types.ts` has `AccountsPayableInput` and `AccountsPayableOutput` interfaces
- [ ] Verify `types.ts` AgentType includes `'accounts_payable_agent'`
- [ ] Verify `config.ts` has token budgets for `accounts_payable_agent`
- [ ] Verify `config.ts` has model selection: `'claude-haiku-4-5-20251001'`
- [ ] Verify `orchestrator.ts` registers the agent

### 5. API Endpoint Validation
- [ ] Verify 22 endpoints exist in index.ts:
  - Suppliers: GET /api/suppliers, POST /api/suppliers, GET /api/suppliers/:id, PATCH /api/suppliers/:id, DELETE /api/suppliers/:id
  - Bills: GET /api/bills, POST /api/bills, GET /api/bills/:id, PATCH /api/bills/:id, POST /api/bills/:id/approve, POST /api/bills/:id/pay, POST /api/bills/:id/void
  - POs: GET /api/purchase-orders, POST /api/purchase-orders, GET /api/purchase-orders/:id, PATCH /api/purchase-orders/:id, POST /api/purchase-orders/:id/send, POST /api/purchase-orders/:id/receive, POST /api/purchase-orders/:id/cancel
  - Payments: POST /api/supplier-payments, GET /api/supplier-payments/:id
  - Aging: GET /api/ap/aging
- [ ] Verify no route collisions with existing endpoints
- [ ] Verify Zod validation schemas exist for all POST/PATCH/DELETE endpoints

### 6. UI Component Validation
- [ ] Verify `client/src/features/ap/` directory exists
- [ ] Verify 11 new .tsx files exist in `client/src/features/ap/components/`:
  - APDashboard.tsx, SupplierList.tsx, SupplierDetail.tsx, SupplierForm.tsx
  - BillEntry.tsx, BillList.tsx, BillApproval.tsx
  - PurchaseOrderEditor.tsx, POList.tsx, POReceiving.tsx, SupplierPaymentRun.tsx
- [ ] Verify API functions exist in `client/src/api.ts`
- [ ] Verify 'ap' tab added to BottomNavigation.tsx TabId type
- [ ] Verify APDashboard wired in App.tsx

### 7. Cognee Integration Validation
- [ ] Verify `supplier_profiles` and `bill_patterns` added to COGNEE_DATASETS
- [ ] Verify `indexSupplierProfile()`, `searchSupplierProfiles()` methods exist
- [ ] Verify `indexBillPattern()`, `searchBillPatterns()` methods exist

### 8. Coordination Rule Compliance
- [ ] Marker naming: All agents used `.agent-done-W10-{NN}` format
- [ ] Schema lock: Only Agent 1 modified schema.ts and postgres-schema.ts
- [ ] types.ts lock: Only Agent 5 modified types.ts
- [ ] index.ts lock: Only Agent 7 modified server/src/index.ts
- [ ] Monetary amounts are INTEGER (cents), not floating-point
- [ ] Encrypted fields use application-level encryption (not DB-level)

### 9. Cross-Wave Compatibility Check
- [ ] Verify Wave 11 orchestration prompt references match Wave 10 deliverables:
  - Wave 11 says "AP module with suppliers, bills, purchase orders operational" — verify these exist
  - Wave 11 says "Cognee datasets: supplier_profiles, bill_patterns" — verify these exist
  - Wave 11 references "13 Claude agents (11 original + invoice_agent + accounts_payable_agent)" — verify count

### 10. Environment Variables
- [ ] Document new env vars needed:
  - `AP_AUTO_MATCH_THRESHOLD` (default 0.02 = 2% tolerance for three-way matching)
  - `PO_APPROVAL_REQUIRED` (default false — if true, POs need approval before sending)
  - `ENCRYPTION_KEY` (32-char key for bank detail encryption)

## Verification
- [ ] All above checks pass
- [ ] Create marker file: `.agent-done-W10-10`
- [ ] Create wave completion marker: `.agent-done-wave10`

## Dependencies
- **All Agents 1-9** must complete before this agent starts
