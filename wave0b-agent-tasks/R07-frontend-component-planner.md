# Agent R07: Frontend Component Planner

## Role

Plan ALL UI components that Waves 1-10 need to create (~57 components). Map new feature folders, tabs, and component patterns consistent with the existing React/shadcn/ui architecture.

## Phase: A (Research — Start Immediately, Parallel with R01-R06, R08-R10)

## Research Tasks

### 1. Current Frontend Architecture

- [ ] Read `client/src/App.tsx` — list ALL tabs, routes, layout structure
- [ ] Read `client/src/api.ts` — list ALL API methods and their return types
- [ ] List ALL feature folders in `client/src/features/` or `client/src/components/`
- [ ] Read representative component files to document patterns (shadcn/ui, Tailwind, state management)
- [ ] Check what UI components Waves 11-16 added

### 2. Wave 1-10 Required Components

Extract from `docs/Agent planning chat.md`:

- [ ] **Wave 1** (3 components): Enhanced ChatPanel with agent routing indicator, AgentResponseCard, IntentDebugPanel
- [ ] **Wave 2** (4 components): TransactionEditDialog, MutationConfirmation, StreamingIndicator, AuditTrailViewer
- [ ] **Wave 3** (0 new components — backend-only wave)
- [ ] **Wave 4** (6 components): EmployeeList, EmployeeForm, PayStructureEditor, TaxDeclarationForm, SuperFundSelector, EmployeeDocuments
- [ ] **Wave 5** (6 components): PayRunWizard, PayRunReview, LeaveCalendar, LeaveRequestForm, LeaveBalanceCard, PayRunHistory
- [ ] **Wave 6** (7 components): STPDashboard, STPEventLog, PayslipViewer, PayslipPDF, AwardRateEditor, TimesheetEntry, PayrollReportsDashboard
- [ ] **Wave 7** (9 components): CustomerList, CustomerForm, InvoiceBuilder, InvoicePreview, InvoicePDF, InvoiceList, PaymentRecorder, ProductSelector, InvoiceEmailSender
- [ ] **Wave 8** (5 components): RecurringInvoiceSetup, PaymentGatewayConfig, DunningSequenceEditor, SubscriptionManager, PaymentHistory
- [ ] **Wave 9** (7 components): ARAgingReport, CurrencyConverter, ExchangeRateManager, InvoiceTemplateEditor, CustomerStatementGenerator, MultiCurrencyDashboard, CreditNoteForm
- [ ] **Wave 10** (11 components): SupplierList, SupplierForm, BillEntry, BillList, PurchaseOrderBuilder, POApprovalWorkflow, POReceiving, SupplierPaymentRun, APAgingReport, BillMatchingTool, ThreeWayMatch

### 3. Tab Navigation Planning

- [ ] Current tabs: 9 (dashboard, transactions, accounts, analytics, bas, tax, gst, transfers, loans)
- [ ] New tabs needed: payroll (Wave 4-6), invoicing (Wave 7-9), ap/suppliers (Wave 10)
- [ ] Verify tab count doesn't exceed UX limits (12+ tabs may need grouping/dropdown)
- [ ] Check if Wave 11-16 added any tabs

### 4. Shared Component Needs

- [ ] Identify reusable components across waves (data tables, form patterns, PDF generators)
- [ ] Document the shadcn/ui components used vs. available
- [ ] Plan shared utilities (formatCurrency, formatDate, ABN validation)

## Output Format

Write findings to `wave0b-research/R07-frontend-components.md` with:

1. **Current Frontend State** — Tabs, feature folders, component count
2. **Per-Wave Component Tables** — Component name, file path, description
3. **Tab Navigation Plan** — New tabs + grouping strategy
4. **Shared Components** — Reusable patterns to create
5. **API Method Additions** — New methods for `api.ts` per wave
6. **Total New Components** — Sum across Waves 1-10

## Completion

- [ ] All ~57 components documented with file paths
- [ ] Create marker file: `.agent-done-0B-R07`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| React Architecture | Component design and planning | Expert |
| UI/UX Design | Layout and navigation planning | Advanced |
| Component Patterns | shadcn/ui and Tailwind patterns | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read App.tsx, api.ts, and all feature folders
- **Sub-agent B**: Extract Wave 1-5 UI components from planning doc
- **Sub-agent C**: Extract Wave 6-10 UI components from planning doc
- **Sub-agent D**: Read Wave 11-16 generated UI files for patterns and additions
- R07 merges into complete frontend component plan

