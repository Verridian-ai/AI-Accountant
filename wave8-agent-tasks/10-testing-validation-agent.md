# Agent 10: Testing & Validation Agent

## Role
Run comprehensive verification of all Wave 8 deliverables, fix any TypeScript errors, and create the wave completion marker.

## Priority: SUB-WAVE 5 (After ALL other agents complete)

## Verification Checklist

### 1. TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with ZERO new errors
  - Fix any type errors introduced by Wave 8 agents
  - Common issues: missing imports, type mismatches, undefined references
- [ ] Run `cd client && npx tsc --noEmit` — must pass with ZERO new errors
  - Fix any type errors in new UI components
  - Common issues: missing props, incorrect API return types

### 2. Schema Verification
- [ ] `server/src/schema.ts` contains all 5 new sqliteTable definitions:
  - `recurringInvoices`
  - `paymentGateways`
  - `dunningSequences`
  - `dunningHistory`
  - `customerSubscriptions`
- [ ] `server/src/db/postgres-schema.ts` contains matching 5 pgTable definitions
- [ ] All type exports exist: RecurringInvoice, NewRecurringInvoice, PaymentGateway, NewPaymentGateway, DunningSequence, NewDunningSequence, DunningHistoryEntry, NewDunningHistoryEntry, CustomerSubscription, NewCustomerSubscription
- [ ] Table names in schema.ts EXACTLY match migration SQL table names

### 3. Migration Verification
- [ ] `docker/migrations/0020_recurring_payments.sql` exists and is valid PostgreSQL
- [ ] All 5 CREATE TABLE statements present
- [ ] All indexes created
- [ ] Foreign keys reference correct parent tables (users, customers, invoices, dunning_sequences, recurring_invoices)
- [ ] Wrapped in BEGIN/COMMIT transaction
- [ ] Uses `CREATE TABLE IF NOT EXISTS` for idempotency

### 4. Service Verification
- [ ] `server/src/services/recurring-invoices.ts` exports RecurringInvoiceService with all CRUD + generation methods
- [ ] `server/src/services/payment-gateway.ts` exports PaymentGatewayService with Stripe integration
- [ ] `server/src/services/dunning.ts` exports DunningService with sequence management + batch sending
- [ ] `server/src/services/subscriptions.ts` exports SubscriptionService with full lifecycle
- [ ] Recurring invoice frequency calculation handles all 5 types
- [ ] Payment gateway config is masked in list/get responses (never expose raw credentials)
- [ ] Dunning steps stored as JSON with validated ascending daysAfterDue order
- [ ] Subscription MRR calculation correctly normalizes all frequencies

### 5. Invoice Agent Extension Verification
- [ ] `invoice-agent.ts` has Wave 8 tools (if extended):
  - `manage_recurring_invoice` (optional)
  - `search_payment_patterns` (from Cognee integration)
- [ ] Agent still follows `ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>` pattern

### 6. API Route Verification
- [ ] `server/src/routes/payments-routes.ts` exists with 6 endpoints
- [ ] `server/src/routes/invoicing-routes.ts` extended with 7 new endpoints (5 recurring + 2 subscription)
- [ ] Payments routes mounted in `server/src/index.ts` via `app.route('/api', paymentsRoutes)`
- [ ] Zod validation on POST/PATCH endpoints
- [ ] `/invoices/recurring` registered BEFORE `/invoices/:id` (route ordering)
- [ ] No route collisions with existing endpoints

### 7. Cognee Integration Verification
- [ ] `cognee-tools.ts` has `paymentPatterns` in COGNEE_DATASETS
- [ ] 2 new methods: indexPaymentPattern, searchPaymentPatterns
- [ ] `_moduleToDataset()` maps 'payments' correctly

### 8. UI Component Verification
- [ ] `client/src/features/invoicing/components/` contains 5 new .tsx files:
  - RecurringInvoiceManager.tsx
  - SubscriptionManager.tsx
  - PaymentGatewaySetup.tsx
  - DunningManager.tsx
  - PaymentHistory.tsx
- [ ] `client/src/api.ts` has extended `invoicingApi` with ~13 new methods (recurring + subscription + payment + dunning)
- [ ] `InvoicingDashboard.tsx` has 7 sub-tabs (3 original + 4 new)
- [ ] No new top-level tabs needed (everything under existing 'invoicing' tab)

### 9. Cross-Wave Compatibility
- [ ] Wave 8 tables reference Wave 7 tables correctly:
  - `recurring_invoices.customer_id` → `customers.id` (Wave 7)
  - `recurring_invoices.template_invoice_id` → `invoices.id` (Wave 7)
  - `dunning_history.invoice_id` → `invoices.id` (Wave 7)
  - `customer_subscriptions.customer_id` → `customers.id` (Wave 7)
- [ ] Wave 9 compatibility: `recurring_invoices` and `customer_subscriptions` referenced by Wave 9 AR aging
- [ ] Services follow same pattern as Wave 7 services

### 10. Marker Files
- [ ] Verify all 9 agent markers exist:
  - `.agent-done-W08-01` through `.agent-done-W08-09`
- [ ] Create wave completion marker: `.agent-done-W08-10`
- [ ] Create wave-level marker: `.agent-done-wave8`

## Fix Protocol
If any check fails:
1. Identify the specific file and error
2. Make the minimal fix (do not refactor unrelated code)
3. Re-run the relevant tsc check
4. Document the fix in a comment

## Dependencies
- **ALL agents (1-9)**: Must have completed their work
- This agent is the final gate before Wave 8 is considered complete
