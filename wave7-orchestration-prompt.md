# Wave 7 — Customer Management & Invoice Generation — Orchestration Prompt

You are the **Team Lead** for Wave 7: Customer Management & Invoice Generation. You coordinate 10 specialized agents to add a full customer CRM, invoice creation/management, and PDF invoice generation system to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 7, lines ~1180–1210)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 6)
- 11 Claude agents (original 11, no new agents in Waves 1-6)
- SQLite + PostgreSQL dual schema synchronized
- Payroll module complete (employees, pay runs, STP, leave, timesheets, awards)
- Cognee datasets: employee_profiles, pay_structures, pay_run_history, leave_patterns, stp_compliance, award_rates, timesheet_patterns
- 18 migrations (0009–0018) applied
- Route files: `payroll-routes.ts` mounted for Waves 4-6

## Dependencies
- **Requires**: Wave 3 complete (Multi-User Cognee with per-user dataset isolation)
- **Note**: Per master plan optimized dependency graph, Wave 7 depends on Wave 3 (NOT Wave 6). Wave 7 is on the Invoicing track, parallel with Payroll (W4-6) and AP (W10) tracks.
- **Estimated Complexity**: HIGH

## Database Schema Changes

### New Tables (6 tables)
| Table | Columns |
|-------|---------|
| `customers` | id, userId, businessName, contactName, email, phone, address, city, state, postcode, country DEFAULT 'AU', abn, paymentTermsDays DEFAULT 30, notes, isActive DEFAULT true, createdAt |
| `customer_contacts` | id, customerId FK→customers, name, email, phone, role, isPrimary, createdAt |
| `invoices` | id, userId, customerId FK→customers, invoiceNumber UNIQUE, type ('tax_invoice'\|'credit_note'\|'receipt'), status ('draft'\|'sent'\|'viewed'\|'paid'\|'overdue'\|'void'), issueDate, dueDate, subtotal INTEGER, gstAmount INTEGER, totalAmount INTEGER, amountPaid DEFAULT 0, amountDue INTEGER, currency DEFAULT 'AUD', notes, termsAndConditions, pdfPath, createdAt, updatedAt |
| `invoice_lines` | id, invoiceId FK→invoices, description, quantity REAL, unitPrice INTEGER, amount INTEGER, gstRate REAL DEFAULT 0.1, gstAmount INTEGER, accountCode, taxCode |
| `invoice_number_sequences` | id, userId FK→users UNIQUE, prefix DEFAULT 'INV-', nextNumber DEFAULT 1, format DEFAULT '{prefix}{number:06d}' |
| `invoice_payments` | id, invoiceId FK→invoices, paymentDate, amount INTEGER, paymentMethod, reference, transactionId FK→transactions, notes, createdAt |

**CRITICAL**: These exact table names (`customers`, `invoices`, `invoice_lines`, `invoice_payments`) are referenced by Wave 12 (Fixed Assets) and Wave 14 (OCR/Payment Matching). Column names and types MUST match the specification exactly.

**Migration**: `docker/migrations/0019_customers_invoices.sql`

## API Endpoints (17 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/customers | List customers (paginated) |
| POST | /api/customers | Create customer |
| GET | /api/customers/:id | Get customer detail |
| PATCH | /api/customers/:id | Update customer |
| DELETE | /api/customers/:id | Archive customer (soft delete) |
| GET | /api/customers/:id/contacts | List customer contacts |
| POST | /api/customers/:id/contacts | Add customer contact |
| GET | /api/invoices | List invoices (paginated, filterable) |
| POST | /api/invoices | Create invoice |
| GET | /api/invoices/:id | Get invoice detail with lines |
| PATCH | /api/invoices/:id | Update draft invoice |
| POST | /api/invoices/:id/send | Send invoice (mark as sent) |
| POST | /api/invoices/:id/void | Void invoice |
| GET | /api/invoices/:id/pdf | Download invoice PDF |
| POST | /api/invoices/:id/payment | Record payment against invoice |
| POST | /api/invoices/credit-note | Create credit note |
| GET | /api/invoices/next-number | Get next invoice number |

**Route file**: `server/src/routes/invoicing-routes.ts` (mounted via `app.route('/api', invoicingRoutes)`)

> **REVISION NOTE (D04 ROUTE-04 — Wave 14 Namespace Compatibility)**:
> Wave 7 uses `/api/invoices/*` and `/api/customers/*` namespaces. Wave 14 (OCR/Payment Matching) uses `/api/documents/*`, `/api/matches/*`, and `/api/match-rules/*` namespaces. There is **NO route collision** — Wave 14's OCR invoice endpoints are under `/api/documents/*` (not `/api/invoices/*`). This has been verified against the existing Wave 14 codebase.

## UI Components
### `client/src/features/invoicing/` — New feature folder
- InvoicingDashboard.tsx — Main hub with sub-tabs: customers, invoices, create. Summary cards: total outstanding, overdue count, revenue this month.
- CustomerList.tsx — Searchable customer directory with business name, contact, outstanding balance, status.
- CustomerDetail.tsx — Customer profile: contact info, invoice history, payment history, outstanding balance.
- CustomerForm.tsx — Create/edit customer: business name, ABN, contacts, payment terms, address, notes.
- InvoiceList.tsx — Filterable invoice list: status filter (draft/sent/paid/overdue/void), date range, customer filter.
- InvoiceEditor.tsx — Full invoice creation/editing: customer selector, line items (description, qty, unit price, GST), totals, notes, terms.
- InvoicePreview.tsx — Live preview of invoice as it would appear in PDF.
- InvoicePDF.tsx — PDF generation wrapper: download button, email send, print. Uses server-side PDF generation.

**Navigation**: Add `invoicing` to TabId type in BottomNavigation.tsx and App.tsx
**Nav Icon**: `FileText` from lucide-react
**Nav Label**: "Invoicing"

## New Claude Agent (1)
**`invoice_agent`** — Customer and invoice CRUD, PDF generation, accounts receivable management.
- **Model**: Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Max Tool Calls**: 10
- **Tools**: `create_invoice`, `update_invoice_status`, `generate_pdf`, `send_email`, `list_customer_invoices`, `track_payment`, `search_cognee_invoices`
- **I/O**: `ClaudeAgent<InvoiceAgentInput, InvoiceAgentOutput>`
- **Pattern**: Follow `payroll-agent.ts` implementation

## Cognee Integration
- **New datasets**: `customer_profiles` (CHUNKS), `invoice_history` (GRAPH_COMPLETION)
- **New ontology**: Customer (Customer→Invoice→Payment nodes, BILLED_TO/PAID_BY/CREDITED_TO edges)
- **CogneeTools methods**: `indexCustomerProfile()`, `searchCustomers()`, `indexInvoice()`, `searchInvoiceHistory()`
- Use `CHUNKS` for customer similarity search ("Find customers like X")
- Use `GRAPH_COMPLETION` for invoice relationship reasoning ("Which customers are overdue?")

## PDF Generation
- **Engine**: `pdf-lib` (pure JavaScript, ~2MB, no Chromium dependency)
- **NOT Puppeteer** — avoids Docker image bloat (~400MB for Chromium)
- **Service**: `server/src/services/invoice-pdf.ts` — generates invoice PDF from template
- **Template**: Professional tax invoice layout with business logo, ABN, GST summary
- **Output**: Returns Buffer, saved to `server/uploads/invoices/` and path stored in `invoices.pdfPath`

## Testing Criteria
- [ ] Customer CRUD lifecycle (create, read, update, archive)
- [ ] Invoice auto-numbering with INV-000001 format
- [ ] Invoice GST calculation at 10% per line item
- [ ] Invoice totals: subtotal + GST = total, amountDue = total - amountPaid
- [ ] Credit note creation and balance adjustment
- [ ] Payment recording updates invoice status (partial → paid when amountPaid >= total)
- [ ] PDF generation produces valid PDF file
- [ ] Chat answers "Create an invoice for customer X" via invoice_agent
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: customer-schema-builder [PRIORITY: SUB-WAVE 1]
**Role**: Create customer and invoice tables in dual schema + migration SQL
**Task file**: `wave7-agent-tasks/01-customer-schema-builder.md`
**Creates**: docker/migrations/0019_customers_invoices.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: customer-service-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build customer management service with CRUD operations
**Task file**: `wave7-agent-tasks/02-customer-service-builder.md`
**Creates**: server/src/services/customers.ts
**Dependencies**: None — can start immediately

### Agent 3: invoice-engine-builder [PRIORITY: SUB-WAVE 1]
**Role**: Build invoice creation, numbering, and lifecycle service
**Task file**: `wave7-agent-tasks/03-invoice-engine-builder.md`
**Creates**: server/src/services/invoicing.ts
**Dependencies**: None — can start immediately

### Agent 4: invoice-pdf-builder [PRIORITY: SUB-WAVE 2]
**Role**: Build PDF generation service using pdf-lib
**Task file**: `wave7-agent-tasks/04-invoice-pdf-builder.md`
**Creates**: server/src/services/invoice-pdf.ts
**Dependencies**: Agent 3 must define invoice data structures

### Agent 5: invoice-agent-builder [DEPENDS ON: Agents 2, 3]
**Role**: Create invoice_agent Claude agent
**Task file**: `wave7-agent-tasks/05-invoice-agent-builder.md`
**Creates**: server/src/services/claude/agents/invoice-agent.ts
**Modifies**: server/src/services/claude/types.ts, server/src/services/claude/config.ts, server/src/services/claude/orchestrator.ts
**Dependencies**: Agents 2 and 3 must complete customer and invoice services

### Agent 6: cognee-invoicing-builder [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets and tools for invoicing domain
**Task file**: `wave7-agent-tasks/06-cognee-invoicing-builder.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/cognee_client.ts
**Dependencies**: Schema must exist

### Agent 7: api-routes-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Wire 17 new API routes in invoicing-routes.ts + mount in index.ts
**Task file**: `wave7-agent-tasks/07-api-routes-builder.md`
**Creates**: server/src/routes/invoicing-routes.ts
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist

### Agent 8: ui-customer-builder [DEPENDS ON: Agent 7]
**Role**: Build customer management UI components
**Task file**: `wave7-agent-tasks/08-ui-customer-builder.md`
**Creates**: 4 new .tsx components in client/src/features/invoicing/components/
**Modifies**: client/src/api.ts
**Dependencies**: API routes must exist

### Agent 9: ui-invoice-builder [DEPENDS ON: Agent 7]
**Role**: Build invoice management UI components + navigation tab
**Task file**: `wave7-agent-tasks/09-ui-invoice-builder.md`
**Creates**: 4 new .tsx components in client/src/features/invoicing/components/
**Modifies**: client/src/api.ts, client/src/App.tsx, client/src/components/layout/BottomNavigation.tsx
**Dependencies**: API routes must exist

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Role**: Run verification plan, tsc checks, and marker file creation
**Task file**: `wave7-agent-tasks/10-testing-validation-agent.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **types.ts lock**: Only Agent 5 modifies types.ts and config.ts
3. **index.ts lock**: Only Agent 7 modifies server/src/index.ts
4. **api.ts lock**: Agents 8 and 9 modify client/src/api.ts (Agent 8 first, then Agent 9)
5. **App.tsx lock**: Only Agent 9 modifies App.tsx and BottomNavigation.tsx
6. **Pattern compliance**: invoice_agent follows ClaudeAgent<TInput, TOutput> pattern from base-agent.ts
7. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
8. **Test before done**: `cd server && npx tsc --noEmit` must pass
9. **Marker naming**: Use `.agent-done-W07-{NN}` format
10. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation
11. **Index discipline**: Migration SQL MUST include CREATE INDEX for query patterns — at minimum: `invoices(userId, status)`, `invoices(customerId)`, `invoices(invoiceNumber)`, `invoice_lines(invoiceId)`, `customers(userId, isActive)`, `invoice_payments(invoiceId)`
12. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination (NOT `?page=`), returning `{ data: T[], total: number }`. Max limit=100. This matches the existing codebase convention (`fetchTransactions` uses offset/limit). **REVISION NOTE (D01 CRIT-03, D03 O4)**: Standardized from page-based to offset-based pagination across all waves.
13. **Monetary amounts**: All amounts stored as INTEGER (cents), not floats. GST rate stored as REAL (0.1 = 10%)
14. **PDF engine**: Use `pdf-lib` (NOT Puppeteer) for invoice PDF generation
15. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.
16. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave7-agent-tasks/` for detailed atomic tasks.
