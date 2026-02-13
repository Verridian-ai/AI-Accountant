# R07: Frontend Component Plan — Waves 1-10

## 1. Current Frontend State

### Architecture Summary
- **Framework**: React 18 + TypeScript (Vite build)
- **Styling**: Tailwind CSS with custom neumorphic dark theme (`neu-raised`, `neu-inset`, `glass` classes)
- **Accent Color**: Gold `#FFCC00` throughout (borders, glows, active states, text-gradient-gold)
- **State**: Local `useState` per component; no global store (Redux/Zustand). API calls in `api.ts`.
- **Routing**: Tab-based SPA (no React Router). `activeTab` state in `App.tsx` switches content.
- **Table Library**: TanStack Table + TanStack Virtual (for the Ledger)
- **Icons**: Lucide React
- **Toasts**: Sonner
- **Animations**: `animate-in`, `fade-in`, `slide-in-from-bottom-4` (CSS + Tailwind)
- **Path aliases**: `@/` maps to `client/src/`
- **shadcn/ui**: Partial adoption — `Badge` component confirmed, likely `Dialog`, `Button` etc.
- **Chat**: FloatingChat overlay (fixed-position bottom-right), simple `{role, content}` message model

### Current Tabs (19 total)
| # | Tab ID | Label | Icon | Dashboard Component |
|---|--------|-------|------|---------------------|
| 1 | `dashboard` | Home | LayoutDashboard | Inline (StatCards, Charts, PendingCategorization) |
| 2 | `transactions` | Ledger | FileText | `LedgerPage` |
| 3 | `accounts` | Vaults | Wallet | `AccountsOverview` + `StatementList` + `AccountManager` |
| 4 | `analytics` | Insights | LineChart | `AnalyticsDashboard` |
| 5 | `gst` | GST | ShieldCheck | `GSTPage` |
| 6 | `bas` | BAS | Calculator | `BASPage` |
| 7 | `transfers` | Transfers | GitCompareArrows | `TransfersPage` |
| 8 | `tax` | Tax | Receipt | `TaxDashboard` |
| 9 | `loans` | Loans | Landmark | `LoanDashboard` |
| 10 | `inventory` | Inventory | Package | `InventoryDashboard` |
| 11 | `recon` | Reconcile | GitCompareArrows | `ReconDashboard` |
| 12 | `assets` | Assets | Package | `AssetsDashboard` |
| 13 | `entities` | Entities | Building2 | `EntitiesDashboard` |
| 14 | `knowledge` | Knowledge | Network | `KnowledgeDashboard` |
| 15 | `documents` | Documents | FileScan | `DocumentsDashboard` |
| 16 | `matching` | Matching | Link2 | `MatchingDashboard` |
| 17 | `intelligence` | Intelligence | Brain | `IntelligenceDashboard` |
| 18 | `reports` | Reports | BarChart3 | `ReportsDashboard` |
| 19 | `budgets` | Budgets | Target | `BudgetsDashboard` |

### Current Feature Folders (24)
```
accounts/    admin/      analytics/   assets/      auth/
bas/         budgets/    chat/        documents/   entities/
gst/         intelligence/ inventory/ knowledge/   loans/
matching/    onboarding/ reconciliation/ reports/  settings/
statements/  tax/        transactions/ transfers/
```

### Current Component Count
| Feature Folder | Components | Notable |
|---------------|-----------|---------|
| accounts | 7 | AccountManager, AccountBalanceTimeline, AccountSetupWizard, AccountHoverCard, AccountSwitcher, AccountsOverview, AccountSummaryCards |
| admin | 5 | AdminDashboard, FeedbackQueue, ParserHealth, SubscriptionOverview, SystemMetrics, UserManagement |
| analytics | 11 | AnalyticsDashboard, AnomalyDetection, BillAlerts, BudgetProjections, BudgetVsActual, CashFlowForecast, CategoryBreakdown, CategoryChart, DebtReductionPlanner, MonthlyTrendChart, RecurringPayments, SpendingTrends, StatCard, WealthProjection |
| assets | 6 | AssetsDashboard, AssetDisposalForm, AssetRegisterTable, AssetSummaryCards, DepreciationScheduleView, RegisterAssetForm |
| auth | 1 | Auth |
| bas | 5 | BASPage, BASDashboard, BASComparison, BASPeriodSelector, BASPreFillReport |
| budgets | 5 | BudgetsDashboard, BudgetEditor, ForecastScenarios, ScenarioComparison, VarianceView |
| chat | 2 | FloatingChat, ChatInterface |
| documents | 5 | DocumentsDashboard, DocumentUpload, DocumentViewer, LineItemEditor, ProcessingQueue |
| entities | 6 | EntitiesDashboard, ConsolidationView, CreateEntityForm, EntityHierarchyView, EntitySettingsPanel, InterEntityTransactionsView |
| gst | 4 | GSTPage, GSTReviewQueue, GSTSummary, InputTaxCredits |
| intelligence | 7 | IntelligenceDashboard, InsightFeed, IntelligenceTimeline, TemporalQueryBuilder, ModuleConnectionMap, SubscriptionManager, CorrelationExplorer |
| inventory | 7 | InventoryDashboard, InventoryItemList, StockLevelPanel, MovementHistory, WarehouseManager, ValuationReport, COGSCalculator |
| knowledge | 7 | KnowledgeDashboard, DataPointManager, FeedbackPanel, GraphStatsPanel, KnowledgeGraphExplorer, NodeDetailPanel, OntologyManager |
| loans | 5 | LoanDashboard, HomeLoanCalculator, CarFinanceCalculator, PersonalLoanCalculator, LoanComparisonPanel |
| matching | 5 | MatchingDashboard, AutoMatchView, MatchReviewPanel, MatchStatistics, RuleManager |
| onboarding | 7 | OnboardingWizard, BusinessProfileStep, CategorySetupStep, CompletionStep, GoalsStep, StatementUploadStep, TaxSetupStep, WelcomeStep |
| reconciliation | 5 | ReconDashboard, ReconMatchSuggestions, ReconMatchingWorkspace, ReconRulesManager, ReconSummaryCard |
| reports | 7 | ReportsDashboard, BalanceSheet, CashFlow, KPIDashboard, PeriodComparison, ProfitAndLoss, TrialBalance |
| settings | 1 | Settings |
| statements | 4 | StatementList, FileUpload, ParseErrorBanner, UploadZone |
| tax | 8 | TaxDashboard, CompanyReturn, OwnerEquityPanel, PersonalReturn, SoleTraderReturn, TaxOptimizerPanel, TaxReturnSummaryCard, TrustReturn |
| transactions | 15 | LedgerPage, LedgerTable, LedgerTableColumns, LedgerFilters, LedgerHeader, LedgerFooter, LedgerSkeleton, LedgerSummaryBar, TransactionTable, TransactionCard, TransactionCardList, columns, BulkActionBar, CategorySelect, DeleteConfirmDialog, MerchantMemoryManager, PendingCategorizationReview, SplitTransactionModal |
| transfers | 4 | TransfersPage, MoneyFlowDiagram, NetPositionCalculator, TransferConfirmation |

**Total existing components: ~137 TSX files**

### UI Patterns Observed
1. **Dashboard Pattern**: Each feature has a `*Dashboard.tsx` as the entry component, often with internal sub-tabs
2. **Sub-tab Pattern**: Internal `type SubTab = 'items' | 'stock' | ...` with a tab bar rendered inside the dashboard
3. **API Pattern**: Feature-specific API objects (e.g., `documentsApi`, `inventoryApi`) exported from `api.ts`
4. **Loading Pattern**: `useState(false)` for loading, `Loader2` spinner icon with `animate-spin`
5. **Error Pattern**: `try/catch` in async functions, `console.error`, optional toast notifications
6. **Currency Format**: `new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100)`
7. **List + Detail Pattern**: List view with filter/sort → click → detail modal or inline expansion
8. **Form Pattern**: Inline forms with Tailwind styling, not heavy form library usage
9. **Badge/Status**: Custom status badges with color-coded backgrounds (`bg-green-500/20 text-green-400`)
10. **BottomNavigation**: Mobile-only, shows 4 quick-access tabs + central "Menu" button that opens a panel with all tabs

### Current API Methods in `api.ts` (Core Object)
```
api.fetchTransactions()       api.fetchStatements()
api.sendChatMessage()         api.calculateStats()
api.updateTransaction()       api.splitTransaction()
api.deleteTransaction()       api.uploadStatement()
api.reprocessStatement()      api.uploadBatch()
api.getBatchStatus()          api.cancelBatch()
api.retryBatch()              api.fetchStatementGapAnalysis()
api.login()                   api.register()
api.fetchSettings()           api.updateSettings()
api.getCurrentUser()          api.fetchAccounts()
api.createAccount()           api.updateAccount()
api.fetchPendingCategorizations()  api.resolveCategorization()
api.fetchMerchantMemory()     api.updateMerchantMemory()
api.deleteMerchantMemory()    api.fetchTransfers()
api.createTransferLink()      api.deleteTransferLink()
api.fetchBalanceHistory()     api.fetchReconciliationAlerts()
api.resolveReconciliationAlert()   api.fetchCreditCardAnalytics()
api.fetchDebtRecommendations()
```
Additionally: `loanApi`, `economicApi`, `taxApi`, `documentsApi`, `matchingApi`, `inventoryApi` (separate API objects for feature modules).

---

## 2. Per-Wave Component Tables

### Wave 1: Chat→Agent Bridge & Intent Routing (3 new + 3 modified)

**New Feature Folder**: None (enhances existing `features/chat/`)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `AgentResponseCard` | `features/chat/components/AgentResponseCard.tsx` | Rich card rendering for structured agent responses (tables, action cards, confirmations). Replaces plain text assistant messages. |
| `IntentDebugPanel` | `features/chat/components/IntentDebugPanel.tsx` | Developer/debug panel showing intent classification results, agent routing, confidence scores. Toggled via dev mode. |
| `AgentRoutingIndicator` | `features/chat/components/AgentRoutingIndicator.tsx` | Visual indicator showing which agent is processing the request (icon + name + progress). |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `FloatingChat.tsx` | Add structured response handling, agent progress indicator, suggested follow-up actions. Message type expansion from `{role, content}` to `{role, content, type, agentType, data}`. |
| `ChatInterface.tsx` | Support for rich message rendering (AgentResponseCard), streaming-ready, action confirmations. |
| `api.ts` | Update `sendChatMessage()` return type to support structured responses: `{ answer: string, agentType?: string, actions?: Action[], data?: unknown }` |

### Wave 2: Transaction Mutation & Streaming (4 new + 2 modified)

**New Feature Folder**: None (enhances `features/chat/` and `features/transactions/`)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `StreamingMessage` | `features/chat/components/StreamingMessage.tsx` | Progressive text rendering with typing indicator animation for SSE-streamed agent responses. |
| `ConfirmationCard` | `features/chat/components/ConfirmationCard.tsx` | Action confirmation with before/after diff preview. User approves or rejects agent-proposed transaction mutations. |
| `AgentProgressBar` | `features/chat/components/AgentProgressBar.tsx` | Real-time agent progress (tool calls completed, current step name, estimated time). |
| `AuditTrailViewer` | `features/transactions/components/AuditTrailViewer.tsx` | Displays audit log of agent-initiated mutations. Shows who changed what, when, before/after values. |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `FloatingChat.tsx` | Streaming message display, confirmation dialog integration |
| `api.ts` | Add `streamChat()`, `confirmMutation()`, `rejectMutation()`, `fetchPendingMutations()`, `fetchAuditLog()` |

### Wave 3: Multi-User Cognee & Custom DataPoints (0 new components)

**This is a backend-only wave.** No new UI components. Minor modifications to existing components:

| Component | Modifications |
|-----------|---------------|
| `FloatingChat.tsx` | Pass `sessionId` to chat API for conversational memory |
| `api.ts` | Add `initCogneeUser()`, `getCogneeSession()`, `reindexCognee()` |

### Wave 4: Employee Management & Pay Structures (6 new)

**New Feature Folder**: `client/src/features/payroll/`

| Component | File Path | Description |
|-----------|-----------|-------------|
| `PayrollDashboard` | `features/payroll/components/PayrollDashboard.tsx` | Main payroll hub with internal sub-tabs (employees, pay-categories, pay-structures). Summary cards: total employees, total payroll cost, next pay date. |
| `EmployeeList` | `features/payroll/components/EmployeeList.tsx` | Searchable, filterable employee directory. Status badges (active/terminated/on_leave). Click → detail modal. |
| `EmployeeDetail` | `features/payroll/components/EmployeeDetail.tsx` | Full employee profile: personal info, bank details, super fund, tax declaration, documents, pay structure. Tabbed layout. |
| `EmployeeOnboarding` | `features/payroll/components/EmployeeOnboarding.tsx` | Step-by-step wizard for onboarding new employees (personal → bank → super → tax dec → pay structure → review). |
| `PayCategoryManager` | `features/payroll/components/PayCategoryManager.tsx` | CRUD interface for pay categories (ordinary, overtime, allowances, deductions, super, leave). Rate type selector. |
| `PayStructureEditor` | `features/payroll/components/PayStructureEditor.tsx` | Assign pay categories to an employee with rates, hours, effective dates. Inline editing with save. |

**New Tab**: `payroll` added to `TabId` union type in `BottomNavigation.tsx` and `App.tsx`
**Nav Icon**: `Users` from lucide-react
**Nav Label**: "Payroll"

### Wave 5: Pay Run Processing & Leave Management (6 new)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `PayRunWizard` | `features/payroll/components/PayRunWizard.tsx` | Multi-step pay run creation: select period → review employees → calculate → confirm → process. Progress stepper UI. |
| `PayRunDetail` | `features/payroll/components/PayRunDetail.tsx` | Detailed pay run view with per-employee breakdown (gross, tax, super, net). Expandable rows. Status: draft/processing/completed/reversed. |
| `PayRunHistory` | `features/payroll/components/PayRunHistory.tsx` | Historical pay runs list with date filtering, status badges, total amounts. Click → PayRunDetail. |
| `LeaveManagement` | `features/payroll/components/LeaveManagement.tsx` | Leave types configuration, balance overview per employee, pending requests. Sub-tabs: types, balances, requests. |
| `LeaveCalendar` | `features/payroll/components/LeaveCalendar.tsx` | Visual month/week calendar showing employee leave. Color-coded by leave type. |
| `LeaveRequestForm` | `features/payroll/components/LeaveRequestForm.tsx` | Submit/approve/reject leave requests. Employee selector, date range picker, leave type selector, balance display. |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `PayrollDashboard.tsx` | Add sub-tabs for pay-runs, leave, leave-calendar |
| `api.ts` | Add `payrollApi` object with ~15 methods (employee CRUD, pay run CRUD, leave CRUD) |

### Wave 6: STP Compliance & Payroll Reporting (7 new)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `STPDashboard` | `features/payroll/components/STPDashboard.tsx` | STP event list with status (draft/submitted/accepted/rejected), YTD employee totals, EOFY finalisation button. |
| `STPEventDetail` | `features/payroll/components/STPEventDetail.tsx` | Individual STP event with employee YTD breakdown, XML preview, submission status timeline. |
| `PayslipViewer` | `features/payroll/components/PayslipViewer.tsx` | View/download payslips for a pay run. Per-employee list with PDF download links. Bulk email send button. |
| `TimesheetEntry` | `features/payroll/components/TimesheetEntry.tsx` | Weekly timesheet grid: employee × days. Start/end time, break, total hours. Project allocation. Submit/approve workflow. |
| `TimesheetApproval` | `features/payroll/components/TimesheetApproval.tsx` | Manager approval interface: pending timesheets, approve/reject with comments, bulk approve. |
| `AwardManager` | `features/payroll/components/AwardManager.tsx` | Award/agreement management: create awards, define classifications/levels, set hourly rates, casual loading, overtime multipliers. |
| `PayrollReports` | `features/payroll/components/PayrollReports.tsx` | Tabbed reporting dashboard: PAYG Summary, Super Report, Leave Report, Payroll Cost Summary. Date range selectors, export to CSV/PDF. |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `PayrollDashboard.tsx` | Add sub-tabs for STP, payslips, timesheets, awards, reports |
| `api.ts` | Extend `payrollApi` with STP, payslip, timesheet, award, report methods (~18 new methods) |

### Wave 7: Customer Management & Invoice Generation (8 new)

**New Feature Folder**: `client/src/features/invoicing/`

| Component | File Path | Description |
|-----------|-----------|-------------|
| `InvoicingDashboard` | `features/invoicing/components/InvoicingDashboard.tsx` | Main invoicing hub with sub-tabs: customers, invoices, create. Summary cards: total outstanding, overdue count, revenue this month. |
| `CustomerList` | `features/invoicing/components/CustomerList.tsx` | Searchable customer directory with business name, contact, outstanding balance, status. Click → detail. |
| `CustomerDetail` | `features/invoicing/components/CustomerDetail.tsx` | Customer profile: contact info, invoice history, payment history, outstanding balance. |
| `CustomerForm` | `features/invoicing/components/CustomerForm.tsx` | Create/edit customer form: business name, ABN, contacts, payment terms, address, notes. |
| `InvoiceList` | `features/invoicing/components/InvoiceList.tsx` | Filterable invoice list: status filter (draft/sent/paid/overdue/void), date range, customer filter. Status badges. |
| `InvoiceEditor` | `features/invoicing/components/InvoiceEditor.tsx` | Full invoice creation/editing: customer selector, line items (description, qty, unit price, GST), totals, notes, terms. |
| `InvoicePreview` | `features/invoicing/components/InvoicePreview.tsx` | Live preview of invoice as it would appear in PDF. Side-by-side with editor. |
| `InvoicePDF` | `features/invoicing/components/InvoicePDF.tsx` | PDF generation wrapper: download button, email send, print. Uses server-side PDF generation. |

**New Tab**: `invoicing` added to `TabId` union type
**Nav Icon**: `FileText` or `Receipt` from lucide-react
**Nav Label**: "Invoicing"

### Wave 8: Recurring Invoices & Payment Processing (5 new)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `RecurringInvoiceManager` | `features/invoicing/components/RecurringInvoiceManager.tsx` | Create/manage recurring invoice schedules: frequency, customer, template, start/end dates. Active schedules list with next-generation dates. |
| `SubscriptionManager` | `features/invoicing/components/SubscriptionManager.tsx` | Customer subscription management: create subscriptions, view active/cancelled, link to recurring invoices. |
| `PaymentGatewaySetup` | `features/invoicing/components/PaymentGatewaySetup.tsx` | Configure payment gateways (Stripe/PayPal/bank transfer). Connection status, API key management. |
| `DunningManager` | `features/invoicing/components/DunningManager.tsx` | Payment reminder sequence builder: define steps (days after due, action type, email template). Preview and activate. |
| `PaymentHistory` | `features/invoicing/components/PaymentHistory.tsx` | Payment timeline per customer: all payments, methods, linked invoices, running balance. |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `InvoicingDashboard.tsx` | Add sub-tabs: recurring, subscriptions, payments, dunning |
| `api.ts` | Extend with recurring invoice, payment gateway, dunning, subscription API methods |

### Wave 9: AR Aging & Multi-Currency (7 new)

| Component | File Path | Description |
|-----------|-----------|-------------|
| `ARAgingReport` | `features/invoicing/components/ARAgingReport.tsx` | AR aging buckets visualization: current, 30, 60, 90, 120+ days. Bar chart + data table. Drill-down to customer level. |
| `CustomerStatement` | `features/invoicing/components/CustomerStatement.tsx` | Statement of account view: period selection, all transactions/invoices/payments, opening/closing balance. PDF download. |
| `MultiCurrencySelector` | `features/invoicing/components/MultiCurrencySelector.tsx` | Currency picker dropdown for invoices. Shows exchange rate to AUD. Updates line totals in real-time. |
| `ExchangeRateManager` | `features/invoicing/components/ExchangeRateManager.tsx` | View/update exchange rates. Refresh from external API. Historical rates timeline. |
| `InvoiceTemplateEditor` | `features/invoicing/components/InvoiceTemplateEditor.tsx` | WYSIWYG invoice template customization: header/footer, color scheme, field layout. Live preview. |
| `LogoUploader` | `features/invoicing/components/LogoUploader.tsx` | Business logo upload with crop/resize. Preview on invoice template. |
| `GSTSalesReport` | `features/invoicing/components/GSTSalesReport.tsx` | GST collected on sales report: by period, by customer, by tax code. Totals for BAS reporting. |

**Modified Components**:
| Component | Modifications |
|-----------|---------------|
| `InvoicingDashboard.tsx` | Add sub-tabs: aging, statements, currencies, templates |
| `InvoiceEditor.tsx` | Add currency selector, multi-currency line items |
| `api.ts` | Add AR aging, currency, template, statement API methods |

### Wave 10: Accounts Payable & Purchase Orders (11 new)

**New Feature Folder**: `client/src/features/ap/`

| Component | File Path | Description |
|-----------|-----------|-------------|
| `APDashboard` | `features/ap/components/APDashboard.tsx` | Main AP hub with sub-tabs: suppliers, bills, purchase orders, payments, aging. Summary cards: total payable, overdue, upcoming. |
| `SupplierList` | `features/ap/components/SupplierList.tsx` | Searchable supplier directory with business name, contact, ABN, outstanding balance. |
| `SupplierDetail` | `features/ap/components/SupplierDetail.tsx` | Supplier profile: contact info, bill history, PO history, bank details, payment terms. |
| `SupplierForm` | `features/ap/components/SupplierForm.tsx` | Create/edit supplier: business name, ABN, bank details, payment terms, address. |
| `BillEntry` | `features/ap/components/BillEntry.tsx` | Bill data entry: supplier selector, line items (description, qty, unit price, account code, GST), totals, due date. |
| `BillList` | `features/ap/components/BillList.tsx` | Filterable bill list: status (draft/awaiting/approved/paid/overdue/void), date range, supplier filter. |
| `BillApproval` | `features/ap/components/BillApproval.tsx` | Bill approval workflow: pending bills queue, approve/reject, add notes, batch approve. |
| `PurchaseOrderEditor` | `features/ap/components/PurchaseOrderEditor.tsx` | PO creation: supplier, line items, expected delivery, send to supplier. |
| `POList` | `features/ap/components/POList.tsx` | PO list with status filters (draft/sent/partially received/received/cancelled). |
| `POReceiving` | `features/ap/components/POReceiving.tsx` | Receive goods against PO: match PO lines, enter quantities received, note discrepancies, partial receiving. |
| `SupplierPaymentRun` | `features/ap/components/SupplierPaymentRun.tsx` | Batch payment run: select bills to pay, review totals per supplier, generate bank file/ABA, process. |
| `APAgingReport` | `features/ap/components/APAgingReport.tsx` | AP aging report: same structure as AR aging but for payables. Buckets: current, 30, 60, 90, 120+ days. |

**New Tab**: `ap` added to `TabId` union type
**Nav Icon**: `CreditCard` or `FileInput` from lucide-react
**Nav Label**: "AP / Bills"

---

## 3. Tab Navigation Plan

### New Tabs Required (Waves 1-10)
| Wave | Tab ID | Label | Icon | Feature Folder |
|------|--------|-------|------|----------------|
| 4 | `payroll` | Payroll | `Users` | `features/payroll/` |
| 7 | `invoicing` | Invoicing | `FileText` | `features/invoicing/` |
| 10 | `ap` | AP / Bills | `CreditCard` | `features/ap/` |

### Tab Count After Wave 10: 22 total
**This exceeds practical UX limits.** With 22 tabs, the desktop nav bar will overflow.

### Recommended Tab Grouping Strategy

Replace flat tab list with grouped/collapsible navigation:

```
── CORE
   Home | Ledger | Vaults | Insights

── COMPLIANCE
   GST | BAS | Tax

── OPERATIONS
   Payroll | Invoicing | AP / Bills | Transfers | Inventory

── ADVANCED
   Reconcile | Assets | Entities | Reports | Budgets

── AI & DATA
   Knowledge | Documents | Matching | Intelligence | Loans
```

**Implementation approach**:
1. Desktop: Two-tier navigation — top row shows groups, second row shows tabs within the active group
2. Mobile: Keep current "Menu" overlay panel (already works with any number of tabs) — just add new items
3. Add section headers within the mobile menu panel for grouping

### BottomNavigation Changes
The `BottomNavigation.tsx` currently only shows 4 quick-access tabs + Menu button. This design scales well — no changes needed to the bottom bar itself. New tabs are accessible through the "Menu" overlay.

**Required `TabId` type expansion**:
```typescript
export type TabId =
  // Core
  'dashboard' | 'transactions' | 'accounts' | 'analytics' |
  // Compliance
  'gst' | 'bas' | 'tax' |
  // Operations
  'payroll' | 'invoicing' | 'ap' | 'transfers' | 'inventory' |
  // Advanced
  'recon' | 'assets' | 'entities' | 'reports' | 'budgets' |
  // AI & Data
  'knowledge' | 'documents' | 'matching' | 'intelligence' | 'loans';
```

---

## 4. Shared Components

### Reusable Components to Create (Shared across Waves 4-10)

| Component | Path | Used By | Description |
|-----------|------|---------|-------------|
| `DataTable` | `components/shared/DataTable.tsx` | EmployeeList, CustomerList, SupplierList, InvoiceList, BillList, POList, PayRunHistory | Generic TanStack Table wrapper with search, sort, filter, pagination. Neumorphic styled. |
| `FormDialog` | `components/shared/FormDialog.tsx` | EmployeeOnboarding, CustomerForm, SupplierForm, BillEntry, InvoiceEditor | Modal dialog wrapper with form validation, save/cancel buttons, loading state. |
| `StatusBadge` | `components/shared/StatusBadge.tsx` | All list views | Reusable color-coded status badge. Config-driven: `{ label, color, bgColor }` map. |
| `StepWizard` | `components/shared/StepWizard.tsx` | PayRunWizard, EmployeeOnboarding | Multi-step wizard with progress indicator, back/next buttons, step validation. |
| `CurrencyInput` | `components/shared/CurrencyInput.tsx` | BillEntry, InvoiceEditor, PayStructureEditor | Formatted currency input (AUD cents internally, display as $X.XX). Supports multi-currency. |
| `DateRangePicker` | `components/shared/DateRangePicker.tsx` | PayRunHistory, InvoiceList, BillList, Reports | Date range selection with presets (This month, Last quarter, This FY). |
| `PDFDownloadButton` | `components/shared/PDFDownloadButton.tsx` | InvoicePDF, PayslipViewer, ARAgingReport, CustomerStatement | Fetch PDF from server and trigger browser download. Loading state. |
| `AddressForm` | `components/shared/AddressForm.tsx` | CustomerForm, SupplierForm, EmployeeDetail | Reusable Australian address form fields: address, city, state (dropdown), postcode. |
| `ABNInput` | `components/shared/ABNInput.tsx` | CustomerForm, SupplierForm | ABN input with validation (11-digit check) and optional ABR lookup. |
| `SummaryCards` | `components/shared/SummaryCards.tsx` | All Dashboard components | Grid of summary stat cards (extends existing StatCard pattern). |
| `EmptyState` | `components/shared/EmptyState.tsx` | All list views | "No data" empty state with icon, message, and optional action button. |
| `ConfirmDialog` | `components/shared/ConfirmDialog.tsx` | Delete operations, reversals, approvals | Reusable confirmation dialog with customizable message and action. |

**Total shared components: 12**

### Existing Shared Utilities to Leverage
- `cn()` from `@/lib/utils` — class name merging (clsx + tailwind-merge)
- `formatCurrency()` — defined inline in multiple places, should be extracted to `@/lib/format.ts`
- `getAuthHeaders()` from `@/api.ts`
- `Badge` from `@/components/ui/badge` — shadcn/ui component

### Recommended Shared Utility Extractions
```
lib/format.ts       → formatCurrency(), formatDate(), formatABN()
lib/validation.ts   → validateABN(), validateBSB(), validateEmail(), validateTFN()
lib/constants.ts    → AU_STATES, PAYMENT_TERMS, EMPLOYMENT_TYPES, PAY_FREQUENCIES
```

---

## 5. API Method Additions Per Wave

### Wave 1 — Chat Enhancement
```typescript
// Modified
api.sendChatMessage(query: string): Promise<ChatResponse>  // enhanced return type

// New types
interface ChatResponse {
  answer: string;
  agentType?: string;
  intentClassification?: { intent: string; confidence: number };
  actions?: Array<{ id: string; type: string; description: string; data: unknown }>;
  suggestedFollowups?: string[];
}
```

### Wave 2 — Mutation & Streaming
```typescript
api.streamChat(query: string): EventSource              // SSE streaming
api.confirmMutation(actionId: string): Promise<void>     // Confirm agent mutation
api.rejectMutation(actionId: string): Promise<void>      // Reject agent mutation
api.fetchPendingMutations(): Promise<PendingMutation[]>  // List pending
api.fetchAuditLog(options?: AuditLogOptions): Promise<AuditEntry[]>  // Audit trail
```

### Wave 3 — Cognee (No new client API methods — backend only)
```typescript
api.initCogneeUser(): Promise<void>        // Initialize Cognee for current user
api.getCogneeSession(): Promise<string>     // Get/create session ID
api.reindexCognee(): Promise<void>          // Trigger full reindex
```

### Wave 4 — Employee Management
```typescript
payrollApi = {
  // Employees
  listEmployees(): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee>
  createEmployee(data: CreateEmployeeInput): Promise<Employee>
  updateEmployee(id: string, data: Partial<Employee>): Promise<void>
  terminateEmployee(id: string, data: TerminationInput): Promise<void>
  // Bank Details
  getEmployeeBankDetails(empId: string): Promise<BankDetails[]>
  setEmployeeBankDetails(empId: string, data: BankDetailsInput): Promise<void>
  // Super
  getEmployeeSuper(empId: string): Promise<SuperFund>
  setEmployeeSuper(empId: string, data: SuperFundInput): Promise<void>
  // Tax Declaration
  getEmployeeTaxDec(empId: string): Promise<TaxDeclaration>
  submitTaxDec(empId: string, data: TaxDecInput): Promise<void>
  // Pay Categories
  listPayCategories(): Promise<PayCategory[]>
  createPayCategory(data: PayCategoryInput): Promise<PayCategory>
  // Pay Structures
  getPayStructure(empId: string): Promise<PayStructure[]>
  setPayStructure(empId: string, data: PayStructureInput): Promise<void>
}
```

### Wave 5 — Pay Runs & Leave
```typescript
// Extend payrollApi
payrollApi.listPayRuns(): Promise<PayRun[]>
payrollApi.getPayRun(id: string): Promise<PayRunDetail>
payrollApi.createPayRun(data: CreatePayRunInput): Promise<PayRun>
payrollApi.calculatePayRun(id: string): Promise<PayRunCalculation>
payrollApi.processPayRun(id: string): Promise<void>
payrollApi.reversePayRun(id: string): Promise<void>
payrollApi.getPayRunLines(id: string): Promise<PayRunLine[]>
// Leave
payrollApi.listLeaveTypes(): Promise<LeaveType[]>
payrollApi.createLeaveType(data: LeaveTypeInput): Promise<LeaveType>
payrollApi.getLeaveBalances(empId: string): Promise<LeaveBalance[]>
payrollApi.submitLeaveRequest(data: LeaveRequestInput): Promise<LeaveRequest>
payrollApi.approveLeave(id: string): Promise<void>
payrollApi.rejectLeave(id: string, reason: string): Promise<void>
payrollApi.getLeaveCalendar(month: string): Promise<LeaveCalendarData>
```

### Wave 6 — STP, Payslips, Timesheets
```typescript
// Extend payrollApi
payrollApi.generateSTPEvent(payRunId: string): Promise<STPEvent>
payrollApi.submitSTP(eventId: string): Promise<void>
payrollApi.listSTPEvents(): Promise<STPEvent[]>
payrollApi.getEmployeeYTD(empId: string): Promise<STPEmployeeYTD>
payrollApi.finaliseSTP(year: string): Promise<void>
payrollApi.getPayslips(payRunId: string): Promise<Payslip[]>
payrollApi.downloadPayslip(payRunId: string, empId: string): Promise<Blob>
payrollApi.sendPayslips(payRunId: string): Promise<void>
payrollApi.listAwards(): Promise<Award[]>
payrollApi.createAward(data: AwardInput): Promise<Award>
payrollApi.getAwardRates(awardId: string): Promise<AwardRate[]>
payrollApi.listTimesheets(filters?: TimesheetFilters): Promise<Timesheet[]>
payrollApi.submitTimesheet(data: TimesheetInput): Promise<Timesheet>
payrollApi.approveTimesheet(id: string): Promise<void>
// Reports
payrollApi.getPAYGSummary(year: string): Promise<PAYGSummary>
payrollApi.getSuperReport(period: string): Promise<SuperReport>
payrollApi.getLeaveReport(): Promise<LeaveReport>
payrollApi.getPayrollSummary(period: string): Promise<PayrollSummary>
```

### Wave 7 — Customers & Invoices
```typescript
invoicingApi = {
  // Customers
  listCustomers(): Promise<Customer[]>
  getCustomer(id: string): Promise<Customer>
  createCustomer(data: CreateCustomerInput): Promise<Customer>
  updateCustomer(id: string, data: Partial<Customer>): Promise<void>
  archiveCustomer(id: string): Promise<void>
  listContacts(custId: string): Promise<CustomerContact[]>
  addContact(custId: string, data: ContactInput): Promise<CustomerContact>
  // Invoices
  listInvoices(filters?: InvoiceFilters): Promise<Invoice[]>
  getInvoice(id: string): Promise<InvoiceDetail>
  createInvoice(data: CreateInvoiceInput): Promise<Invoice>
  updateInvoice(id: string, data: Partial<Invoice>): Promise<void>
  sendInvoice(id: string): Promise<void>
  voidInvoice(id: string): Promise<void>
  downloadInvoicePDF(id: string): Promise<Blob>
  recordPayment(invId: string, data: PaymentInput): Promise<void>
  createCreditNote(data: CreditNoteInput): Promise<Invoice>
  getNextInvoiceNumber(): Promise<string>
}
```

### Wave 8 — Recurring, Payments, Dunning
```typescript
// Extend invoicingApi
invoicingApi.listRecurringInvoices(): Promise<RecurringInvoice[]>
invoicingApi.createRecurringInvoice(data: RecurringInput): Promise<RecurringInvoice>
invoicingApi.updateRecurringInvoice(id: string, data: Partial<RecurringInput>): Promise<void>
invoicingApi.cancelRecurringInvoice(id: string): Promise<void>
invoicingApi.generateNextInvoice(id: string): Promise<Invoice>
invoicingApi.listPaymentGateways(): Promise<PaymentGateway[]>
invoicingApi.configureGateway(data: GatewayConfigInput): Promise<void>
invoicingApi.processPayment(invoiceId: string): Promise<PaymentResult>
invoicingApi.listDunningSequences(): Promise<DunningSequence[]>
invoicingApi.createDunningSequence(data: DunningInput): Promise<DunningSequence>
invoicingApi.sendReminders(): Promise<ReminderResult>
invoicingApi.listSubscriptions(custId: string): Promise<Subscription[]>
invoicingApi.createSubscription(custId: string, data: SubscriptionInput): Promise<Subscription>
```

### Wave 9 — AR Aging, Multi-Currency, Templates
```typescript
// Extend invoicingApi
invoicingApi.getARAgingReport(): Promise<ARAgingReport>
invoicingApi.getCustomerAging(custId: string): Promise<CustomerAging>
invoicingApi.getARSummary(): Promise<ARSummary>
invoicingApi.listCurrencies(): Promise<Currency[]>
invoicingApi.getExchangeRate(from: string, to: string): Promise<ExchangeRate>
invoicingApi.refreshExchangeRates(): Promise<void>
invoicingApi.listTemplates(): Promise<InvoiceTemplate[]>
invoicingApi.createTemplate(data: TemplateInput): Promise<InvoiceTemplate>
invoicingApi.updateTemplate(id: string, data: Partial<TemplateInput>): Promise<void>
invoicingApi.uploadLogo(templateId: string, file: File): Promise<string>
invoicingApi.generateStatement(custId: string, period: DateRange): Promise<Blob>
invoicingApi.getGSTSalesReport(period: DateRange): Promise<GSTSalesReport>
```

### Wave 10 — AP, Bills, Purchase Orders
```typescript
apApi = {
  // Suppliers
  listSuppliers(): Promise<Supplier[]>
  getSupplier(id: string): Promise<Supplier>
  createSupplier(data: CreateSupplierInput): Promise<Supplier>
  updateSupplier(id: string, data: Partial<Supplier>): Promise<void>
  archiveSupplier(id: string): Promise<void>
  // Bills
  listBills(filters?: BillFilters): Promise<Bill[]>
  getBill(id: string): Promise<BillDetail>
  createBill(data: CreateBillInput): Promise<Bill>
  updateBill(id: string, data: Partial<Bill>): Promise<void>
  approveBill(id: string): Promise<void>
  voidBill(id: string): Promise<void>
  recordBillPayment(billId: string, data: BillPaymentInput): Promise<void>
  // Purchase Orders
  listPOs(filters?: POFilters): Promise<PurchaseOrder[]>
  getPO(id: string): Promise<PODetail>
  createPO(data: CreatePOInput): Promise<PurchaseOrder>
  updatePO(id: string, data: Partial<PurchaseOrder>): Promise<void>
  sendPO(id: string): Promise<void>
  cancelPO(id: string): Promise<void>
  receivePO(id: string, data: POReceiptInput): Promise<void>
  // Payment Runs
  createPaymentRun(data: PaymentRunInput): Promise<PaymentRun>
  processPaymentRun(id: string): Promise<void>
  // Reports
  getAPAgingReport(): Promise<APAgingReport>
}
```

---

## 6. Total New Components Summary

| Wave | New Components | Modified Components | New Feature Folder |
|------|---------------|--------------------|--------------------|
| **Wave 1** | 3 | 3 | — |
| **Wave 2** | 4 | 2 | — |
| **Wave 3** | 0 | 2 | — |
| **Wave 4** | 6 | 2 (App.tsx, BottomNav) | `features/payroll/` |
| **Wave 5** | 6 | 2 | — |
| **Wave 6** | 7 | 2 | — |
| **Wave 7** | 8 | 2 (App.tsx, BottomNav) | `features/invoicing/` |
| **Wave 8** | 5 | 2 | — |
| **Wave 9** | 7 | 3 | — |
| **Wave 10** | 12 | 2 (App.tsx, BottomNav) | `features/ap/` |
| **Shared** | 12 | — | `components/shared/` |
| **TOTAL** | **70** | **22** | **4 new folders** |

### Summary by Category
- **Chat/Agent components** (Waves 1-2): 7 new
- **Payroll components** (Waves 4-6): 19 new
- **Invoicing components** (Waves 7-9): 20 new
- **AP/Bills components** (Wave 10): 12 new
- **Shared/reusable components**: 12 new
- **Total new components: 70**
- **Total modified components: 22**
- **New feature folders: 3** (`payroll/`, `invoicing/`, `ap/`)
- **New shared folder: 1** (`components/shared/`)
- **New navigation tabs: 3** (payroll, invoicing, ap)
- **New API objects: 3** (`payrollApi`, `invoicingApi`, `apApi`)
- **New API methods: ~120+**
- **New TypeScript interfaces: ~80+**

---

## 7. Component Implementation Priority

### Critical Path (blocks other components)
1. **Shared components** (Wave 0 or early Wave 4) — `DataTable`, `FormDialog`, `StepWizard`, `CurrencyInput` are used by nearly every feature
2. **Tab navigation grouping** (Wave 4) — needed before adding 3 more tabs
3. **Chat enhancements** (Waves 1-2) — `AgentResponseCard`, `StreamingMessage`, `ConfirmationCard`

### Parallel-Safe Components (can be built independently)
- All components within a single feature folder (e.g., all payroll components can be built in parallel once `PayrollDashboard` shell exists)
- `LogoUploader`, `ExchangeRateManager`, `ABNInput` — isolated utilities

### Dependency Chain
```
Shared Components → PayrollDashboard shell → Employee components → PayRun components → STP/Reports
Shared Components → InvoicingDashboard shell → Customer components → Invoice components → Recurring/AR
Shared Components → APDashboard shell → Supplier components → Bill/PO components
```
