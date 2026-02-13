# R02: Wave 1-10 Specification Extraction

**Extracted by**: Agent R02 (Wave Specs Extractor)
**Source**: `docs/Agent planning chat.md` lines 682–1314
**Date**: 2026-02-13

---

## 1. Per-Wave Spec Tables

### Wave 1: Chat→Agent Bridge & Intent Routing

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 1: Complete Existing Roadmap | |
| **Dependencies** | None — first wave | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | Intent Router Builder, Agent Dispatcher Builder, PostgreSQL Schema Sync, Schema Verifier, Agent Routes Builder, Chat Endpoint Transformer, Chat UI Builder, Cognee RAG Enhancer, Testing & Validation, Documentation |
| **Files to CREATE** | 4 | `intent-router.ts`, `agent-dispatcher.ts`, `response-formatter.ts`, `agent-routes-extended.ts` |
| **Files to MODIFY** | 7 | `postgres-schema.ts`, `index.ts`, `orchestrator.ts`, `types.ts`, `FloatingChat.tsx`, `ChatInterface.tsx`, `api.ts` |
| **DB Schema Changes** | 31 new PostgreSQL tables (schema sync, not new tables) | Migration: `docker/migrations/0013_postgres_schema_sync.sql` |
| **API Endpoints** | 9 | POST `/api/chat` (rewrite), POST `/api/agents/parse`, POST `/api/agents/categorize`, POST `/api/agents/merchant-intel`, POST `/api/agents/payroll/calculate`, POST `/api/agents/tax/strategy`, POST `/api/agents/tax/claims`, POST `/api/agents/financial-plan`, GET `/api/agents/status` |
| **UI Components** | 3 | `FloatingChat.tsx` (enhanced), `ChatInterface.tsx` (enhanced), `ChatMessage.tsx` (new) |
| **Cognee Integration** | Enhance `ragService.searchMulti()` with agent-specific context; intent-aware dataset selection | No new datasets |
| **New Claude Agents** | 0 (intent routing layer, not new agents) | |
| **Testing Criteria** | 6 | tsc clean (server+client), curl tests for intent routing, all 11 agents accessible, 52 PostgreSQL tables |

---

### Wave 2: Transaction Mutation & Streaming

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 1: Complete Existing Roadmap | |
| **Dependencies** | Wave 1 must complete | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | Mutation Tools Builder, Authorization Layer Builder, Confirmation Flow Builder, Audit Trail Builder, SSE Streaming Builder, Agent Progress Events, Chat Streaming UI, Batch Operations Builder, Testing & Validation, Documentation |
| **Files to CREATE** | 5 | `mutation-tools.ts`, `mutation-auth.ts`, `confirmation-flow.ts`, `streaming.ts`, `audit.ts` |
| **Files to MODIFY** | 7 | `base-agent.ts`, `orchestrator.ts`, `transaction-categorizer.ts`, `gst-calculator.ts`, `index.ts`, `FloatingChat.tsx`, `ChatInterface.tsx`, `api.ts` |
| **DB Schema Changes** | 3 new tables | `agent_mutations`, `agent_sessions`, `agent_audit_log` |
| **Migration** | `docker/migrations/0014_agent_mutations.sql` | |
| **API Endpoints** | 6 | POST `/api/chat/stream`, POST `/api/chat/confirm/:actionId`, POST `/api/chat/reject/:actionId`, GET `/api/chat/pending`, GET `/api/chat/history`, GET `/api/agent-audit` |
| **UI Components** | 4 | `StreamingMessage.tsx`, `ConfirmationCard.tsx`, `AgentProgressBar.tsx`, `BatchOperationResult.tsx` |
| **Cognee Integration** | Index confirmed mutations into `transaction_patterns` dataset; store agent decision reasoning | 1 dataset (implicit — `transaction_patterns`) |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 5 | Mutation propose→confirm→execute flow, SSE streaming, rejection handling, audit logging, batch 100+ txns |

---

### Wave 3: Multi-User Cognee & Custom DataPoints

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 1: Complete Existing Roadmap | |
| **Dependencies** | Wave 2 must complete | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | Cognee Multi-User Builder, Redis-Cognee Connector, DataPoint Models Builder, Dataset Prefix Builder, Session Memory Builder, DataPoint Indexing Pipeline, CogneeClient Updater, Chat Session Integration, Testing & Validation, Documentation |
| **Files to CREATE** | 3 | `cognee/datapoints.py` (Python), `cognee/indexing-pipeline.ts`, `cognee/session-manager.ts` |
| **Files to MODIFY** | 5 | `docker-compose.yml`, `cognee_client.ts`, `cognee-tools.ts`, `rag.ts`, `index.ts` |
| **DB Schema Changes** | 2 new tables | `cognee_user_accounts`, `cognee_sessions` |
| **Migration** | `docker/migrations/0015_cognee_multi_user.sql` | |
| **API Endpoints** | 4 | POST `/api/cognee/init-user`, POST `/api/cognee/reindex`, GET `/api/cognee/session`, GET `/api/cognee/graph/:userId` |
| **UI Components** | 0 explicitly specified | Gap: No UI components listed for this wave |
| **Cognee Integration** | 8 custom DataPoint models (TransactionNode, AccountNode, CategoryNode, GSTRuleNode, PatternNode, BASPeriodNode, MerchantNode, DeductionNode); per-user dataset isolation; Redis session caching; 6 relationship types | Major Cognee wave |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 5 | Multi-user isolation, session memory, DataPoint indexing, Redis caching >50% speedup, docker compose clean |

---

### Wave 4: Employee Management & Pay Structures

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 2: Full Payroll System | |
| **Dependencies** | Wave 3 must complete | |
| **Complexity** | VERY HIGH | |
| **Agent Team** | 10 agents | Employee Schema Builder, Pay Structure Builder, Employee Service Builder, Schema Verifier, Payroll Agent Enhancer, Employee API Builder, Employee UI Builder, Cognee Payroll Datasets, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed (implied from deliverables: employee service, pay structure service) | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed (implied: payroll_agent, schema files) | Gap: No explicit file modification list |
| **DB Schema Changes** | 7 new tables | `employees`, `employee_bank_details`, `employee_super_funds`, `employee_tax_declarations`, `pay_categories`, `pay_structures`, `employee_documents` |
| **Migration** | `docker/migrations/0016_employee_management.sql` | |
| **API Endpoints** | 15 | Full CRUD for employees, bank details, super funds, tax declarations, pay categories, pay structures |
| **UI Components** | 6 (new feature folder `features/payroll/`) | `PayrollDashboard.tsx`, `EmployeeList.tsx`, `EmployeeDetail.tsx`, `EmployeeOnboarding.tsx`, `PayCategoryManager.tsx` + TabId update |
| **Cognee Integration** | 2 new datasets: `employee_profiles`, `pay_structures` | Index employee data for NL queries |
| **New Claude Agents** | 0 (enhances existing `payroll_agent`) | |
| **Testing Criteria** | 5 | CRUD lifecycle, encrypted bank/super, TFN declaration fields, pay rate types, chat query |

---

### Wave 5: Pay Run Processing & Leave Management

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 2: Full Payroll System | |
| **Dependencies** | Wave 4 must complete | |
| **Complexity** | VERY HIGH | |
| **Agent Team** | 10 agents | Pay Run Engine Builder, PAYG Calculator Builder, Super Calculator Builder, Leave Management Builder, Pay Run Schema Builder, Pay Run API Builder, Pay Run UI Builder, Cognee Payroll Indexer, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 7 new tables | `pay_runs`, `pay_run_lines`, `pay_run_summary`, `leave_types`, `leave_balances`, `leave_requests`, `leave_transactions` |
| **Migration** | `docker/migrations/0017_pay_runs_leave.sql` | |
| **API Endpoints** | 15 | Pay run CRUD + calculate/process/reverse, pay run lines, leave types, leave balances, leave requests (submit/approve/reject), leave calendar |
| **UI Components** | 6 | `PayRunWizard.tsx`, `PayRunDetail.tsx`, `PayRunHistory.tsx`, `LeaveManagement.tsx`, `LeaveCalendar.tsx`, `LeaveRequestForm.tsx` |
| **Cognee Integration** | 2 new datasets: `pay_run_history`, `leave_patterns` | Index pay runs + leave patterns for NL queries |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 6 | PAYG withholding (FY2024-25), super at 11.5%, leave accrual, leave deduction, pay run reversal, chat query |

---

### Wave 6: STP Compliance & Payroll Reporting

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 2: Full Payroll System | |
| **Dependencies** | Wave 5 must complete | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | STP Data Model Builder, STP Event Generator, Payslip Generator, Award Interpreter Builder, Timesheet Builder, Payroll Reports Builder, STP/Payslip API Builder, Payroll Reporting UI, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 7 new tables | `stp_events`, `stp_employee_ytd`, `payslips`, `awards`, `award_rates`, `timesheets`, `timesheet_entries` |
| **Migration** | `docker/migrations/0018_stp_payslips_timesheets.sql` | |
| **API Endpoints** | 19 | STP generate/submit/events/ytd/finalise (5), payslips (3), awards (3), timesheets (3), reports (4) + timesheet approve (1) |
| **UI Components** | 7 | `STPDashboard.tsx`, `PayslipViewer.tsx`, `TimesheetEntry.tsx`, `TimesheetApproval.tsx`, `AwardManager.tsx`, `PayrollReports.tsx`, `PayrollAnalytics.tsx` |
| **Cognee Integration** | 3 new datasets: `stp_compliance`, `award_rates`, `timesheet_patterns` | Index for compliance/award/timesheet queries |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 6 | STP Phase 2 ATO fields, payslip PDF, award rates in pay calc, timesheet→pay run flow, PAYG summary report, chat query |

---

### Wave 7: Customer Management & Invoice Generation

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 3: Customer Invoicing & Accounts Receivable | |
| **Dependencies** | Wave 6 must complete | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | Customer Schema Builder, Customer Service Builder, Invoice Engine Builder, Invoice Agent Builder, Schema Verifier, Customer/Invoice API Builder, Customer UI Builder, Invoice UI Builder, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 6 new tables | `customers`, `customer_contacts`, `invoices`, `invoice_lines`, `invoice_number_sequences`, `invoice_payments` |
| **Migration** | `docker/migrations/0019_customers_invoices.sql` | |
| **API Endpoints** | 17 | Customer CRUD + contacts (7), Invoice CRUD + send/void/PDF/payment/credit-note/next-number (10) |
| **UI Components** | 9 (new feature folder `features/invoicing/`) | `InvoicingDashboard.tsx`, `CustomerList.tsx`, `CustomerDetail.tsx`, `CustomerForm.tsx`, `InvoiceList.tsx`, `InvoiceEditor.tsx`, `InvoicePreview.tsx`, `InvoicePDF.tsx` + TabId update |
| **Cognee Integration** | 2 new datasets: `customer_profiles`, `invoice_history` | Index customers + invoices for NL queries |
| **New Claude Agents** | 1 (`invoice_agent`) | First new agent since Wave 1 |
| **Testing Criteria** | 6 | Invoice auto-numbering, GST 10%, invoice totals, credit notes, payment→status update, chat query |

---

### Wave 8: Recurring Invoices & Payment Processing

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 3: Customer Invoicing & Accounts Receivable | |
| **Dependencies** | Wave 7 must complete | |
| **Complexity** | MEDIUM | |
| **Agent Team** | 10 agents | Recurring Invoice Builder, Payment Gateway Builder, Dunning Builder, Subscription Builder, Payment Allocation Builder, Recurring/Payment API Builder, Recurring Invoice UI, Payment/Dunning UI, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 5 new tables | `recurring_invoices`, `payment_gateways`, `dunning_sequences`, `dunning_history`, `customer_subscriptions` |
| **Migration** | `docker/migrations/0020_recurring_payments.sql` | |
| **API Endpoints** | 13 | Recurring invoices (5), payment gateways (2), payment processing (1), dunning (3), subscriptions (2) |
| **UI Components** | 5 | `RecurringInvoiceManager.tsx`, `SubscriptionManager.tsx`, `PaymentGatewaySetup.tsx`, `DunningManager.tsx`, `PaymentHistory.tsx` |
| **Cognee Integration** | 1 new dataset: `payment_patterns` | Index payment history + recurring patterns |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 5 | Recurring generation, dunning intervals, gateway stubs, subscription→recurring, chat query |

---

### Wave 9: AR Aging & Multi-Currency

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 3: Customer Invoicing & Accounts Receivable | |
| **Dependencies** | Wave 8 must complete | |
| **Complexity** | MEDIUM | |
| **Agent Team** | 10 agents | AR Aging Engine, Multi-Currency Builder, Invoice Template Builder, Statement of Account Builder, GST Sales Tracking, AR/Currency API Builder, AR Dashboard UI, Template/Branding UI, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 4 new tables | `currencies`, `exchange_rates`, `invoice_templates`, `customer_statements` |
| **Migration** | `docker/migrations/0021_ar_multicurrency.sql` | |
| **API Endpoints** | 12 | AR aging (3), currencies (1), exchange rates (2), invoice templates (4), customer statement (1), GST sales (1) |
| **UI Components** | 7 | `ARAgingReport.tsx`, `CustomerStatement.tsx`, `MultiCurrencySelector.tsx`, `ExchangeRateManager.tsx`, `InvoiceTemplateEditor.tsx`, `LogoUploader.tsx`, `GSTSalesReport.tsx` |
| **Cognee Integration** | 1 new dataset: `ar_aging_patterns` | Cross-reference with `payment_patterns` |
| **New Claude Agents** | 0 | |
| **Testing Criteria** | 6 | Aging bucket categorization, multi-currency AUD conversion, exchange rate API, template rendering, statement generation, GST sales report |

---

### Wave 10: Accounts Payable & Purchase Orders

| Spec Element | Status | Details |
|---|---|---|
| **Phase** | Phase 4: Xero/MYOB Feature Parity | |
| **Dependencies** | Wave 9 must complete | |
| **Complexity** | HIGH | |
| **Agent Team** | 10 agents | Supplier Schema Builder, Bill Management Builder, Purchase Order Builder, AP Agent Builder, Schema Verifier, AP/PO API Builder, Supplier/Bill UI Builder, Purchase Order UI Builder, Testing & Validation, Documentation |
| **Files to CREATE** | Not explicitly listed | Gap: No explicit file creation list |
| **Files to MODIFY** | Not explicitly listed | Gap: No explicit file modification list |
| **DB Schema Changes** | 10 new tables | `suppliers`, `bills`, `bill_lines`, `bill_payments`, `purchase_orders`, `po_lines`, `po_receipts`, `po_receipt_lines`, `supplier_payment_runs`, `supplier_payment_run_items` |
| **Migration** | `docker/migrations/0022_ap_purchase_orders.sql` | |
| **API Endpoints** | 20+ | Full CRUD for suppliers, bills, bill lines, bill payments, POs, PO lines, PO receipts, supplier payment runs, AP aging report |
| **UI Components** | 11 (new feature folder `features/ap/`) | `APDashboard.tsx`, `SupplierList.tsx`, `SupplierDetail.tsx`, `BillEntry.tsx`, `BillList.tsx`, `BillApproval.tsx`, `PurchaseOrderEditor.tsx`, `POList.tsx`, `POReceiving.tsx`, `SupplierPaymentRun.tsx`, `APAgingReport.tsx` + TabId update |
| **Cognee Integration** | 2 new datasets: `supplier_profiles`, `bill_patterns` | |
| **New Claude Agents** | 1 (`accounts_payable_agent`) | |
| **Testing Criteria** | 5 | Bill lifecycle, PO lifecycle, partial receiving, payment run batching, AP aging report |

---

## 2. Completeness Matrix

10×10 grid: Waves (rows) × Spec Elements (columns)

| Wave | Dependencies | Agent Team (10) | DB Schema | API Endpoints | UI Components | Cognee Integration | Testing Criteria | Migration Path | New Agents | Coordination Rules |
|------|---|---|---|---|---|---|---|---|---|---|
| **W1** | ✅ | ✅ (10) | ✅ (31 sync) | ✅ (9) | ✅ (3) | ✅ | ✅ (6) | ✅ (0013) | ✅ (0) | ✅ (phases noted) |
| **W2** | ✅ | ✅ (10) | ✅ (3) | ✅ (6) | ✅ (4) | ✅ | ✅ (5) | ✅ (0014) | ✅ (0) | ✅ (phases noted) |
| **W3** | ✅ | ✅ (10) | ✅ (2) | ✅ (4) | ❌ (0 listed) | ✅ | ✅ (5) | ✅ (0015) | ✅ (0) | ✅ (phases noted) |
| **W4** | ✅ | ✅ (10) | ✅ (7) | ✅ (15) | ✅ (6) | ✅ | ✅ (5) | ✅ (0016) | ✅ (0) | ✅ (phases noted) |
| **W5** | ✅ | ✅ (10) | ✅ (7) | ✅ (15) | ✅ (6) | ✅ | ✅ (6) | ✅ (0017) | ✅ (0) | ✅ (phases noted) |
| **W6** | ✅ | ✅ (10) | ✅ (7) | ✅ (19) | ✅ (7) | ✅ | ✅ (6) | ✅ (0018) | ✅ (0) | ✅ (phases noted) |
| **W7** | ✅ | ✅ (10) | ✅ (6) | ✅ (17) | ✅ (9) | ✅ | ✅ (6) | ✅ (0019) | ✅ (1) | ✅ (phases noted) |
| **W8** | ✅ | ✅ (10) | ✅ (5) | ✅ (13) | ✅ (5) | ✅ | ✅ (5) | ✅ (0020) | ✅ (0) | ✅ (phases noted) |
| **W9** | ✅ | ✅ (10) | ✅ (4) | ✅ (12) | ✅ (7) | ✅ | ✅ (6) | ✅ (0021) | ✅ (0) | ✅ (phases noted) |
| **W10** | ✅ | ✅ (10) | ✅ (10) | ✅ (20+) | ✅ (11) | ✅ | ✅ (5) | ✅ (0022) | ✅ (1) | ✅ (phases noted) |

**Legend**: ✅ = Present and detailed, ❌ = Missing/absent, ⚠️ = Partially present

---

## 3. Totals Summary

### Database Tables

| Wave | New Tables | Table Names |
|------|-----------|-------------|
| W1 | 0 (31 sync) | PostgreSQL schema sync only |
| W2 | 3 | agent_mutations, agent_sessions, agent_audit_log |
| W3 | 2 | cognee_user_accounts, cognee_sessions |
| W4 | 7 | employees, employee_bank_details, employee_super_funds, employee_tax_declarations, pay_categories, pay_structures, employee_documents |
| W5 | 7 | pay_runs, pay_run_lines, pay_run_summary, leave_types, leave_balances, leave_requests, leave_transactions |
| W6 | 7 | stp_events, stp_employee_ytd, payslips, awards, award_rates, timesheets, timesheet_entries |
| W7 | 6 | customers, customer_contacts, invoices, invoice_lines, invoice_number_sequences, invoice_payments |
| W8 | 5 | recurring_invoices, payment_gateways, dunning_sequences, dunning_history, customer_subscriptions |
| W9 | 4 | currencies, exchange_rates, invoice_templates, customer_statements |
| W10 | 10 | suppliers, bills, bill_lines, bill_payments, purchase_orders, po_lines, po_receipts, po_receipt_lines, supplier_payment_runs, supplier_payment_run_items |
| **TOTAL** | **51 new tables** (+ 31 PostgreSQL sync) | |

### API Endpoints

| Wave | Count | Category |
|------|-------|----------|
| W1 | 9 | Chat rewrite + 7 agent routes + status |
| W2 | 6 | Streaming + mutation confirm/reject + audit |
| W3 | 4 | Cognee user mgmt + reindex + session + graph |
| W4 | 15 | Employee CRUD + bank + super + tax + pay categories + structures |
| W5 | 15 | Pay run CRUD + calculate/process/reverse + leave mgmt |
| W6 | 19 | STP + payslips + awards + timesheets + reports |
| W7 | 17 | Customer CRUD + contacts + invoice CRUD + send/void/PDF/payment |
| W8 | 13 | Recurring invoices + payment gateways + dunning + subscriptions |
| W9 | 12 | AR aging + currencies + exchange rates + templates + statements + GST |
| W10 | 20+ | Supplier + bill + PO CRUD + payment runs + AP aging |
| **TOTAL** | **~130+ endpoints** | |

### UI Components

| Wave | Count | New Feature Folders |
|------|-------|---------------------|
| W1 | 3 | — (modifies existing chat) |
| W2 | 4 | — |
| W3 | 0 | — |
| W4 | 6 | `features/payroll/` (new) |
| W5 | 6 | — (extends payroll) |
| W6 | 7 | — (extends payroll) |
| W7 | 9 | `features/invoicing/` (new) |
| W8 | 5 | — (extends invoicing) |
| W9 | 7 | — (extends invoicing) |
| W10 | 11 | `features/ap/` (new) |
| **TOTAL** | **58 UI components** | 3 new feature folders |

### Claude Agents

| Wave | New Agents | Agent Name |
|------|-----------|------------|
| W1 | 0 | — |
| W2 | 0 | — |
| W3 | 0 | — |
| W4 | 0 | Enhances existing `payroll_agent` |
| W5 | 0 | — |
| W6 | 0 | — |
| W7 | 1 | `invoice_agent` |
| W8 | 0 | — |
| W9 | 0 | — |
| W10 | 1 | `accounts_payable_agent` |
| **TOTAL** | **2 new Claude agents** | |

### Cognee Datasets

| Wave | Count | Dataset Names |
|------|-------|---------------|
| W1 | 0 | (enhances existing) |
| W2 | 1 | `transaction_patterns` (implicit) |
| W3 | 0 | (8 custom DataPoint models, no named datasets) |
| W4 | 2 | `employee_profiles`, `pay_structures` |
| W5 | 2 | `pay_run_history`, `leave_patterns` |
| W6 | 3 | `stp_compliance`, `award_rates`, `timesheet_patterns` |
| W7 | 2 | `customer_profiles`, `invoice_history` |
| W8 | 1 | `payment_patterns` |
| W9 | 1 | `ar_aging_patterns` |
| W10 | 2 | `supplier_profiles`, `bill_patterns` |
| **TOTAL** | **14 new Cognee datasets** | |

### Migration Files

| Wave | Migration File |
|------|---------------|
| W1 | `docker/migrations/0013_postgres_schema_sync.sql` |
| W2 | `docker/migrations/0014_agent_mutations.sql` |
| W3 | `docker/migrations/0015_cognee_multi_user.sql` |
| W4 | `docker/migrations/0016_employee_management.sql` |
| W5 | `docker/migrations/0017_pay_runs_leave.sql` |
| W6 | `docker/migrations/0018_stp_payslips_timesheets.sql` |
| W7 | `docker/migrations/0019_customers_invoices.sql` |
| W8 | `docker/migrations/0020_recurring_payments.sql` |
| W9 | `docker/migrations/0021_ar_multicurrency.sql` |
| W10 | `docker/migrations/0022_ap_purchase_orders.sql` |

### Grand Totals

| Metric | Count |
|--------|-------|
| Total New Database Tables | **51** (+ 31 PostgreSQL sync) |
| Total API Endpoints | **~130+** |
| Total UI Components | **58** |
| Total New Claude Agents | **2** (invoice_agent, accounts_payable_agent) |
| Total New Cognee Datasets | **14** |
| Total Migration Files | **10** |
| New Feature Folders | **3** (payroll, invoicing, ap) |
| Phases | **4** (Core Infrastructure, Payroll, Invoicing, AP) |

---

## 4. Gaps Identified (W01 Must Fill)

### Critical Gaps

1. **Wave 3: No UI Components** — The spec for Wave 3 (Multi-User Cognee) lists NO UI components. W01 needs to determine if a Cognee admin panel, user management UI, or DataPoint explorer is needed.

2. **Waves 4-10: No Explicit File Lists** — Waves 1-3 include explicit "Files to CREATE" and "Files to MODIFY" sections. Waves 4-10 only describe deliverables at a high level. W01 must derive explicit file paths for each wave.

3. **Wave 10: Vague API Endpoints** — Wave 10 says "20+ endpoints" but doesn't enumerate them like other waves do. W01 must itemize the full CRUD matrix for suppliers, bills, POs.

### Moderate Gaps

4. **No Explicit Coordination Rules** — While agent sequencing (phases 1-5) is noted per wave, there are no explicit "coordination rules" like "Agent 3 cannot start until Agent 1's migration runs." W01 should formalize inter-agent dependencies.

5. **No Error Handling Specs** — No wave specifies error handling strategies (e.g., what happens if STP submission fails, if payment gateway returns error, if exchange rate API is down).

6. **No Performance Requirements** — No wave specifies performance targets (e.g., pay run calculation time, invoice generation speed, AR aging report query time).

7. **No Existing Agent Enhancement Details** — Waves that enhance existing agents (W4 enhances `payroll_agent`, W1 enhances `orchestrator`) don't specify exactly which new tools/methods to add to those agents.

8. **Missing Feature Folder Structure** — Waves mention new feature folders (`features/payroll/`, `features/invoicing/`, `features/ap/`) but don't define the complete folder structure (hooks, types, constants, api).

### Minor Gaps

9. **Wave 1: Schema Sync Overlap** — The "31 missing tables" sync may conflict with existing migration `0011_final_schema_sync.sql`. W01 should verify which tables are truly missing post-existing migrations.

10. **No Inter-Wave Integration Tests** — No specification for cross-wave integration testing (e.g., invoice payment links to transaction, STP data links to BAS).

11. **No Rollback Specifications** — No wave specifies rollback procedures if a migration or deployment fails.

12. **Wave 3: Python File** — Wave 3 creates a `.py` file (`cognee/datapoints.py`). This conflicts with the project's TypeScript-first architecture. W01 should decide if this should be TS instead or if the Python file is justified for Cognee's Python SDK.

13. **No Tab Order Specification** — Waves 4, 7, and 10 add new navigation tabs but don't specify the tab order in BottomNavigation.tsx.

14. **Cognee Dataset Naming Conventions** — No consistent naming convention is specified. Some use underscores (`employee_profiles`), which is fine, but no prefix convention for per-user datasets is defined (except Wave 3's `{userId}_` prefix).

---

## 5. Phase Structure Summary

| Phase | Waves | Theme | Key Deliverables |
|-------|-------|-------|-----------------|
| **Phase 1** | W1-W3 | Core Infrastructure | Chat→Agent bridge, mutations, streaming, multi-user Cognee |
| **Phase 2** | W4-W6 | Full Payroll System | Employees, pay runs, leave, STP, timesheets, awards |
| **Phase 3** | W7-W9 | Customer Invoicing & AR | Customers, invoices, recurring billing, AR aging, multi-currency |
| **Phase 4** | W10 | Xero/MYOB Feature Parity | AP, suppliers, bills, purchase orders |

### Dependency Chain

```
W1 → W2 → W3 → W4 → W5 → W6 → W7 → W8 → W9 → W10
```

All waves are strictly sequential — each depends on the previous wave completing. This is the most significant architectural constraint: **no parallelization possible between waves**.

---

## 6. Conflict Check with Existing Codebase

Based on the existing codebase (from MEMORY.md), the following potential conflicts exist:

| Spec Element | Existing State | Conflict Risk |
|---|---|---|
| Wave 1: 31 PG table sync | `0011_final_schema_sync.sql` already exists | HIGH — may duplicate work |
| Wave 3: Cognee DataPoints | Wave 16 already built `cognee-datapoints.ts` | HIGH — overlaps with existing |
| Wave 3: Cognee sessions | Wave 17 already built `cognee-sessions.ts` | HIGH — overlaps with existing |
| Wave 3: Redis integration | Redis already in docker-compose.yml | MEDIUM — already present |
| Wave 10: Inventory (mentioned in doc) | `server/src/services/inventory.ts` already exists | MEDIUM — may need enhancement only |
| Various: Schema approach | Spec uses `sqliteTable()` pattern | LOW — consistent with existing |

**Key Insight**: Waves 11-24 have already been partially implemented (Wave 11-17 code exists in codebase). W01 must account for this overlap when generating Wave 1-10 specs — some Wave 3 deliverables may already be done.

---

*End of R02 extraction. All 10 waves extracted with structured data.*
