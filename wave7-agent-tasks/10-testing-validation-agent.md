# Agent 10: Testing & Validation Agent

## Role
Run comprehensive verification of all Wave 7 deliverables, fix any TypeScript errors, and create the wave completion marker.

## Priority: SUB-WAVE 5 (After ALL other agents complete)

## Verification Checklist

### 1. TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with ZERO new errors
  - Fix any type errors introduced by Wave 7 agents
  - Common issues: missing imports, type mismatches, undefined references
- [ ] Run `cd client && npx tsc --noEmit` — must pass with ZERO new errors
  - Fix any type errors in new UI components
  - Common issues: missing props, incorrect API return types

### 2. Schema Verification
- [ ] `server/src/schema.ts` contains all 6 new sqliteTable definitions:
  - `customers`
  - `customerContacts`
  - `customer_contacts` (table name)
  - `invoices`
  - `invoiceLines`
  - `invoiceNumberSequences`
  - `invoicePayments`
- [ ] `server/src/db/postgres-schema.ts` contains matching 6 pgTable definitions
- [ ] All type exports exist: Customer, NewCustomer, Invoice, NewInvoice, InvoiceLine, etc.
- [ ] Table names in schema.ts EXACTLY match migration SQL table names

### 3. Migration Verification
- [ ] `docker/migrations/0019_customers_invoices.sql` exists and is valid PostgreSQL
- [ ] All 6 CREATE TABLE statements present
- [ ] All indexes created
- [ ] Foreign keys reference correct parent tables
- [ ] Wrapped in BEGIN/COMMIT transaction
- [ ] Uses `CREATE TABLE IF NOT EXISTS` for idempotency

### 4. Service Verification
- [ ] `server/src/services/customers.ts` exports CustomerService with all CRUD methods
- [ ] `server/src/services/invoicing.ts` exports InvoicingService with all lifecycle methods
- [ ] `server/src/services/invoice-pdf.ts` exports InvoicePDFService with PDF generation
- [ ] Invoice auto-numbering logic produces INV-000001 format
- [ ] GST calculation: amount × 0.1 = gstAmount (all in cents)
- [ ] Invoice totals invariant: totalAmount = subtotal + gstAmount

### 5. Agent Verification
- [ ] `server/src/services/claude/agents/invoice-agent.ts` exists
- [ ] Extends `ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>`
- [ ] 7 tools defined: create_invoice, update_invoice_status, generate_pdf, list_customer_invoices, track_payment, search_customers, search_cognee_invoices
- [ ] `types.ts` includes `'invoice_agent'` in AgentType union
- [ ] `config.ts` includes invoice_agent token budget and model
- [ ] `orchestrator.ts` registers invoice_agent

### 6. API Route Verification
- [ ] `server/src/routes/invoicing-routes.ts` exists with 17 endpoints
- [ ] Routes mounted in `server/src/index.ts` via `app.route('/api', invoicingRoutes)`
- [ ] Zod validation on POST/PATCH endpoints
- [ ] `/invoices/next-number` registered BEFORE `/invoices/:id` (route ordering)
- [ ] No route collisions with existing endpoints

### 7. Cognee Integration Verification
- [ ] `cognee-tools.ts` has `customerProfiles` and `invoiceHistory` in COGNEE_DATASETS
- [ ] 4 new methods: indexCustomerProfile, searchCustomers, indexInvoice, searchInvoiceHistory
- [ ] `_moduleToDataset()` maps 'customers' and 'invoicing'

### 8. UI Component Verification
- [ ] `client/src/features/invoicing/components/` contains 8 .tsx files:
  - InvoicingDashboard.tsx
  - CustomerList.tsx
  - CustomerDetail.tsx
  - CustomerForm.tsx
  - InvoiceList.tsx
  - InvoiceEditor.tsx
  - InvoicePreview.tsx
  - InvoicePDF.tsx
- [ ] `client/src/api.ts` has `invoicingApi` object with ~17 methods
- [ ] `client/src/App.tsx` includes 'invoicing' tab with InvoicingDashboard
- [ ] `BottomNavigation.tsx` includes 'invoicing' in tab list

### 9. Cross-Wave Compatibility
- [ ] Table names match what Wave 12 and Wave 14 expect:
  - `customers` (referenced by Wave 12 entities)
  - `invoices` (referenced by Wave 14 payment matching)
  - `invoice_lines` (referenced by Wave 14 OCR line item matching)
  - `invoice_payments` (references `transactions.id` from core)
- [ ] invoice_agent follows same pattern as existing agents (payroll-agent.ts)

### 10. Marker Files
- [ ] Verify all 9 agent markers exist:
  - `.agent-done-W07-01` through `.agent-done-W07-09`
- [ ] Create wave completion marker: `.agent-done-W07-10`
- [ ] Create wave-level marker: `.agent-done-wave7`

## Fix Protocol
If any check fails:
1. Identify the specific file and error
2. Make the minimal fix (do not refactor unrelated code)
3. Re-run the relevant tsc check
4. Document the fix in a comment

## Dependencies
- **ALL agents (1-9)**: Must have completed their work
- This agent is the final gate before Wave 7 is considered complete
