# R07: Frontend & UI Architecture Research Report

**Agent**: R07 — Frontend & UI Architecture Researcher
**Date**: 2026-02-12
**Scope**: Complete mapping of client-side architecture, design system, API layer, chat, component patterns, and navigation scalability.

---

## 1. App Structure

### 1.1 Entry Point & Provider Tree

```
main.tsx
  └─ StrictMode
      └─ ErrorBoundary (class component, catches React errors, shows gold-themed error page)
          └─ SSEProvider (context-based real-time event system)
              └─ App
```

- **No router library** — the app uses a **tab-based SPA** with `useState<TabId>` in `App.tsx`.
- No React Router, no TanStack Router, no URL-based routing.
- All navigation is driven by `activeTab` state with type:
  ```ts
  type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans';
  ```
- **9 tabs total** — each rendered conditionally via `{activeTab === 'xxx' && <Component />}`.

### 1.2 Tab → Component Mapping

| Tab ID | Label | Primary Component | Feature Folder |
|--------|-------|-------------------|----------------|
| `dashboard` | Home | Inline in App.tsx (StatCards, PendingCategorizationReview, charts) | analytics, transactions |
| `transactions` | Ledger | `<LedgerPage>` | transactions |
| `accounts` | Vaults | `<AccountsOverview>` + `<StatementList>` + `<AccountSummaryCards>` + `<AccountBalanceTimeline>` + `<AccountManager>` + `<DebtReductionPlanner>` | accounts, statements, analytics |
| `analytics` | Insights | `<AnalyticsDashboard>` (9 sub-tabs) | analytics |
| `gst` | GST | `<GSTPage>` | gst |
| `bas` | BAS | `<BASPage>` | bas |
| `transfers` | Transfers | `<TransfersPage>` | transfers |
| `tax` | Tax | `<TaxDashboard>` (10 sub-tabs) | tax |
| `loans` | Loans | `<LoanDashboard>` | loans |

### 1.3 Global State Management

- **No state management library** (no Redux, Zustand, Jotai, etc.)
- All state lives in `App.tsx` via `useState`:
  - `transactions: Transaction[]`
  - `accounts: Account[]`
  - `stats: TransactionStats | null`
  - `loading: boolean`
  - `activeTab: TabId`
  - `lastUpdated: Date | null`
  - Auth state: `isAuthenticated`, `user`
  - UI state: `isSettingsOpen`, `isMerchantMemoryOpen`, `isAgentsPanelOpen`
- `refreshData()` fetches transactions + accounts in parallel, computes stats client-side
- `loadMoreTransactions()` appends paginated results
- Data is passed down as props to child components

### 1.4 Authentication

- JWT token stored in `localStorage` under key `'token'`
- `getToken()` / `getAuthHeaders()` helpers add `Authorization: Bearer <token>` to all API calls
- `<Auth>` component shown when `!isAuthenticated`
- Login/register via `/auth/login` and `/auth/register` endpoints

---

## 2. Design System

### 2.1 CSS Framework & Approach

- **Tailwind CSS v4.1.18** — utility-first with custom design tokens
- **CSS custom properties** defined in `index.css` (`:root {}`)
- **Custom utility classes** in `@layer utilities` — NOT shadcn-style component tokens
- **No Tailwind config file** — Tailwind v4 uses CSS-based configuration via `@import "tailwindcss"`

### 2.2 Design Tokens (CSS Variables)

| Category | Key Tokens |
|----------|-----------|
| **Brand Gold** | `--cba-gold: #FFCC00`, `--cba-gold-light: #FFE066`, `--cba-gold-dark: #E6B800`, `--cba-gold-glow: rgba(255,204,0,0.2)` |
| **Dark Surfaces** | `--dark-base: #0a0a0f`, `--dark-surface: #12121a`, `--dark-elevated: #1a1a24`, `--dark-card: #16161f` |
| **Neumorphic Shadows** | `--neu-shadow-dark`, `--neu-shadow-light`, `--neu-inset-dark`, `--neu-inset-light` |
| **Glass Effects** | `--glass-bg`, `--glass-border`, `--glass-highlight` |
| **Text** | `--text-primary: #f5f5f7`, `--text-secondary: #a1a1aa`, `--text-muted: #71717a` |
| **Status** | `--success: #22c55e`, `--danger: #ef4444`, `--info: #3b82f6` (each with `*-glow` variants) |

### 2.3 Core Utility Classes

| Class | Purpose |
|-------|---------|
| `.neu-raised` | Primary card/surface — raised neumorphic with dark card bg |
| `.neu-raised-sm` | Small raised buttons/elements — lighter shadow |
| `.neu-inset` | Pressed/recessed elements — input fields, toggles |
| `.neu-float` | Hover state — extra lift with translateY(-2px) |
| `.glass` | Glassmorphism — frosted blur effect for header/overlays |
| `.glass-card` | Glass card variant with stronger blur |
| `.glass-intense` | Maximum blur for modals |
| `.cba-gold-gradient` | Gold gradient background (135deg) |
| `.cba-gold-glow` | Box-shadow glow around gold elements |
| `.cba-gold-text` | Gold text color |
| `.cba-gold-border` | Gold border with glow |
| `.cba-gold-bg` | Solid gold background |
| `.cba-shimmer` | Animated shimmer effect |
| `.text-gradient-gold` | Gold gradient text (used for headings) |
| `.btn-press` | Button press animation |
| `.focus-gold` | Gold focus ring for inputs |
| `.touch-target` | Mobile-friendly 44px min touch target |

### 2.4 Animations

| Animation | Effect |
|-----------|--------|
| `.animate-spring` | Spring-like bounce on transform |
| `.animate-elastic` | Elastic ease for all properties |
| `.animate-float` | Gentle 6s float up/down |
| `.animate-pulse-glow` | Pulsing gold glow |
| `.animate-breathe` | Subtle 4s scale breathing |
| `.animate-slide-up` | Slide up from bottom (for modals) |
| `.ripple` | Click ripple effect |
| `animate-in fade-in slide-in-from-bottom-4` | Tailwind animation utilities for tab transitions |

### 2.5 Icon Library

- **lucide-react v0.562.0** — tree-shakeable, consistent 24x24 SVG icons
- Used heavily across all components (40+ unique icons imported in App.tsx alone)
- Custom brand images: `/cba-logo.svg` (header), `/CEBA LOGO.png` (chat avatar)

### 2.6 shadcn/ui Components

The app uses **Radix UI primitives wrapped in shadcn/ui-style components**:

| Component | Radix Primitive | Location |
|-----------|----------------|----------|
| `Badge` | — (custom) | `components/ui/badge.tsx` |
| `Button` | Slot | `components/ui/button.tsx` |
| `Card` | — (custom) | `components/ui/card.tsx` |
| `Input` | — (custom) | `components/ui/input.tsx` |
| `Label` | `@radix-ui/react-label` | `components/ui/label.tsx` |
| `Progress` | `@radix-ui/react-progress` | `components/ui/progress.tsx` |
| `Select` | `@radix-ui/react-select` | `components/ui/select.tsx` |
| `Skeleton` | — (custom) | `components/ui/skeleton.tsx` |
| `Switch` | `@radix-ui/react-switch` | `components/ui/switch.tsx` |
| `Tabs` | `@radix-ui/react-tabs` | `components/ui/tabs.tsx` |

**Missing shadcn/ui components** (may need for future waves):
- Dialog/Modal (currently using custom overlays)
- Tooltip
- Dropdown Menu
- Popover
- Accordion
- Table (using TanStack Table directly)
- Checkbox
- Textarea
- AlertDialog
- Command (for command palettes)
- Sheet (sidebar drawer)
- Avatar
- Separator
- Breadcrumb

### 2.7 Responsive Approach

- **Mobile-first** with Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- **Bottom navigation** on mobile (`md:hidden`), **top nav bar** on desktop (`hidden md:block`)
- Mobile gets 4 tabs in bottom nav + floating center "Menu" button for remaining 5 tabs
- Chat popup responsive: `w-[calc(100vw-2rem)] md:w-[380px]`
- Grid layouts: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Safe area padding: `safe-area-bottom` class for iOS
- `pb-24 md:pb-0` on body for bottom nav clearance

---

## 3. API Layer

### 3.1 API Client Architecture

- **Single `api.ts` file** exports 6 API objects:
  1. `api` — Core CRUD (transactions, statements, accounts, chat, auth, settings, merchant memory, transfers, reconciliation, debt)
  2. `basApi` — BAS quarters, calculation, saving, history, tax codes, GST categorization
  3. `taxApi` — Tax calculation, brackets, deductions, CGT, depreciation, summaries, returns (4 entity types), strategies, equity
  4. `gstApi` — GST review queue, classification, summary, BAS calculation, input tax credits, comparison, drill-down
  5. `analyticsApi` — Transfer matches, money flow, net position, category breakdown, recurring payments, spending trends, budgets, anomalies, cash flow forecast, smart budget, bill alerts, projections, wealth, debt strategies
  6. `loanApi` — Home loan, car finance, personal loan, refinance, borrowing capacity
  7. `multiBankApi` — Supported banks, bank detection, consolidated summary, auto-detect transfers, bulk link, consolidated report
  8. `economicApi` — RBA rates, CPI, indicators

- **Pattern**: Plain `fetch()` with `getAuthHeaders()`, error thrown on `!res.ok`
- **No request caching** or deduplication
- **No retry logic** on the client side
- **No request cancellation** (AbortController)
- **`BASE_URL`** from `VITE_API_URL` env var (empty in Docker → relative URLs via nginx)

### 3.2 API Method Count

| API Object | Method Count | Notes |
|------------|-------------|-------|
| `api` | 22 | Core CRUD, auth, chat |
| `basApi` | 6 | BAS lifecycle |
| `taxApi` | 17 | Tax returns, CGT, depreciation, equity |
| `gstApi` | 9 | GST review, BAS calc, ITC |
| `analyticsApi` | 16 | Analytics, budgets, projections |
| `loanApi` | 5 | Loan calculators |
| `multiBankApi` | 6 | Multi-bank, transfers |
| `economicApi` | 3 | Economic data |
| **TOTAL** | **84** | |

### 3.3 Type Exports

The `api.ts` file exports **~50 TypeScript interfaces/types** covering:
- Core entities: `Transaction`, `Statement`, `Account`, `MerchantMemory`, `TransferLink`
- Tax: `TaxReturnResult`, `TaxCalculationResult`, `TaxSummary`, `Deduction`, `CGTAsset`, `CGTEvent`, `DepreciableAsset`
- BAS: `BASQuarter`, `BASCalculation`, `BASComparisonData`
- Loans: `HomeLoanParams/Result`, `CarFinanceParams/Comparison`, `PersonalLoanParams/Result`, `RefinanceParams/Result`, `BorrowingCapacityParams/Result`
- Analytics: `SmartBudget`, `RecurringBill`, `ProjectionResult`, `WealthProjectionParams/Result`, `DebtStrategyComparison`
- Economic: `CashRateData`, `LendingRateData`, `CPIData`, `EconomicSnapshot`

### 3.4 Real-Time: SSE System

- **SSEProvider** wraps entire app, connects to `/api/events?token=<jwt>`
- **21 typed event types** defined in `SSEEventMap`:
  - Pipeline: `batch_progress`, `parsing_complete`, `pipeline_error`
  - Data updates: `transactions_updated`, `accounts_updated`, `bas_updated`, `tax_updated`, `statement_updated`, `statement_added`
  - Features: `transfer_detected`, `enrichment_status`, `vision_verification`, `merchant_memory_updated`
  - Setup: `account_setup_needed`
- **Two hook patterns**:
  - `useSSE(callback)` — fires on legacy `'update'` events → triggers data refresh
  - `useSSEEvent('event_name', handler)` — typed listener for specific event types
- Auto-reconnect after 5s on error
- Token-gated connection (no SSE without auth)

---

## 4. Chat Architecture

### 4.1 Current Implementation

Two chat components exist:

1. **`FloatingChat`** (used in App.tsx) — floating FAB with popup window
   - Fixed position bottom-right, above bottom nav on mobile
   - Open/minimize/close states
   - Unread count badge
   - Uses CEBA AI branding with custom logo (`/CEBA LOGO.png`)
   - 380px wide, 550px tall max

2. **`ChatInterface`** (unused) — embedded inline chat panel
   - Same functionality but designed for inline embedding
   - Uses `Cpu` icon instead of CEBA logo

### 4.2 Chat Data Flow

```
User input → api.sendChatMessage(query) → POST /api/chat → { answer: string }
```

- Simple request/response, no streaming
- Messages stored in local `useState` array — lost on refresh
- No conversation persistence/history
- No message IDs, timestamps, or metadata
- No markdown rendering in messages
- Hardcoded "Latency: 12ms" display (not real)

### 4.3 What's Missing for Agent-Controlled Chat

| Gap | Description |
|-----|-------------|
| **Streaming** | No SSE/WebSocket streaming for incremental responses |
| **Message persistence** | Messages lost on refresh; no backend storage |
| **Conversation history** | No conversation ID, no history endpoint |
| **Rich content** | No markdown/code block rendering |
| **Tool use display** | No way to show agent tool calls or thinking steps |
| **Structured actions** | No action buttons, forms, or interactive elements in messages |
| **Multi-turn context** | Server only sees single query, no conversation context passed |
| **File attachments** | No file upload in chat |
| **Agent selection** | No way to pick which agent to talk to |
| **Status indicators** | No real latency display, no typing indicator from server |
| **Suggested prompts** | No quick-action buttons or prompt suggestions |

---

## 5. Component Patterns

### 5.1 Feature Folder Structure

```
features/
  <feature>/
    components/       ← React components
    types.ts          ← TypeScript interfaces (optional)
    index.ts          ← Barrel exports (optional)
    hooks/            ← Feature-specific hooks (only in transactions)
    constants/        ← Constants (only in transactions)
```

**14 feature folders** with component counts:

| Feature | Components | Types File | Index | Notes |
|---------|-----------|-----------|-------|-------|
| **accounts** | 7 | types.ts | index.ts | AccountManager, Overview, Summary, Timeline, Setup, Hover, Switcher |
| **admin** | 5 + Dashboard | — | index.ts | UserMgmt, SystemMetrics, Subscriptions, ParserHealth, FeedbackQueue |
| **analytics** | 11 | types.ts | index.ts | Dashboard + 9 sub-components + StatCard |
| **auth** | 1 | — | — | Auth (login/register) |
| **bas** | 5 | — | — | Page, Dashboard, Comparison, PeriodSelector, PreFillReport |
| **chat** | 2 | — | — | FloatingChat (active), ChatInterface (unused) |
| **gst** | 4 | types.ts | index.ts | Page, ReviewQueue, Summary, InputTaxCredits |
| **loans** | 4 | — | — | Dashboard, HomeLoan, CarFinance, PersonalLoan, ComparisonPanel |
| **onboarding** | 7 | types.ts | index.ts | Wizard + 6 steps (Welcome, Business, Tax, Category, Goals, Statement, Completion) |
| **settings** | 1 | — | — | SettingsModal |
| **statements** | 4 | — | — | StatementList, FileUpload, UploadZone, ParseErrorBanner |
| **tax** | 8 | (in client types) | — | Dashboard + 4 entity returns + Optimizer + Equity + ReturnSummaryCard |
| **transactions** | 14 | types/ledger.ts | — | LedgerPage + Table + Columns + Filters + Card views + Split + MerchantMemory etc. |
| **transfers** | 4 | types.ts | index.ts | Page, MoneyFlowDiagram, NetPositionCalc, TransferConfirmation |

**Total: ~80+ components across 14 features**

### 5.2 Common UI Patterns

**Dashboard Pattern** (analytics, tax, gst, bas, loans):
```tsx
<div className="space-y-6">
  <div> {/* Header: title + description */} </div>
  <Tabs defaultValue="first-tab" className="space-y-4">
    <TabsList className="flex-wrap h-auto gap-1">
      <TabsTrigger value="x"><Icon /> Label</TabsTrigger>
      ...
    </TabsList>
    <TabsContent value="x"><SubComponent /></TabsContent>
    ...
  </Tabs>
</div>
```

**Card/Metric Pattern** (StatCard, tax cards, account summaries):
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium">Title</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground">Subtitle</p>
  </CardContent>
</Card>
```

**List/Table Pattern** (transactions, deductions, CGT events):
```tsx
<div className="space-y-2">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div>primary info</div>
      <div className="text-right">amounts + badges</div>
    </div>
  ))}
</div>
```

**Empty State Pattern**:
```tsx
<p className="text-muted-foreground text-center py-8">
  No data recorded for {period}
</p>
```

### 5.3 Chart Library

- **NO chart library installed** (no Recharts, Chart.js, Nivo, etc.)
- Charts are **hand-built with CSS/HTML**:
  - `MonthlyTrendChart` — custom CSS bars with `MonthlyTrendChart.css`
  - `CategoryChart` — likely CSS-based pie/donut
- Some components import chart-style icons (PieChart, LineChart, BarChart3) from lucide but use them as tab icons, not actual charts

**This is a significant gap** — no proper charting for analytics, forecasts, etc.

### 5.4 Data Fetching Patterns

- **Top-level fetch in App.tsx**: `refreshData()` → transactions + accounts
- **Component-level fetch via `useEffect`**: Each dashboard tab component fetches its own data on mount
- **No query caching**: Re-fetches on every tab switch
- **No TanStack Query / SWR** — all manual `useState` + `useEffect` patterns
- **SSE for real-time updates**: `useSSE(refreshData)` in App triggers refetch on server events

### 5.5 Form Handling

- **No form library** (no React Hook Form, Formik, etc.)
- All forms use controlled components with `useState`
- Validation is minimal/ad-hoc
- Tax calculator, loan calculators, settings — all use direct state

### 5.6 Notification System

- **sonner v2.0.7** — Toast notifications
- `<Toaster theme="dark" position="bottom-right" />` in App.tsx
- Used sparingly in current codebase

---

## 6. Navigation Scalability Assessment

### 6.1 Current Navigation

| Platform | Type | Visible Tabs | Hidden |
|----------|------|-------------|--------|
| **Desktop** | Horizontal button row in header | 9 tabs (all visible) | None |
| **Mobile** | Bottom nav bar + floating menu | 4 tabs (Home, Ledger, Vaults, Insights) | 5 in popup menu (GST, BAS, Transfers, Tax, Loans) |

### 6.2 Scalability Analysis

**Current 9 tabs → Projected 15+ tabs for Waves 11-24:**

New tabs needed:
- Inventory Management
- Invoicing / Accounts Receivable
- Accounts Payable / Bills
- Payroll
- Admin / Settings (expanded)
- Reports / Export
- (Potentially) Budget Planning, Compliance, Audit Trail

**Problems at 15+ tabs:**

| Issue | Impact |
|-------|--------|
| **Desktop horizontal overflow** | 15 tabs won't fit in a single row at 1024px. Already tight at 9. |
| **Mobile menu explosion** | Popup menu would have 11+ items — needs categorization |
| **No URL routing** | Can't deep-link to tabs, no browser back/forward, no bookmarks |
| **Tab switching resets state** | Each tab unmounts → re-fetches all data |
| **No nesting** | Can't organize related features (e.g., Tax → Deductions → CGT) |

### 6.3 Recommended Solutions

| Solution | Priority | Description |
|----------|----------|-------------|
| **Sidebar navigation** | HIGH | Replace horizontal tabs with collapsible sidebar (like Linear, Notion). Groups: Dashboard, Accounting (Ledger, Accounts, Transfers), Tax (GST, BAS, Tax, Returns), Analytics (Insights, Loans), Admin. |
| **URL-based routing** | HIGH | Add TanStack Router or React Router. Enables deep-linking, browser navigation, code splitting. |
| **Nested routes** | MEDIUM | `/tax/deductions`, `/analytics/forecast` etc. Reduces top-level tab count. |
| **Lazy loading** | MEDIUM | Code-split feature folders with `React.lazy()`. Currently ALL code loads upfront. |
| **Persistent state** | MEDIUM | Add TanStack Query for data caching across tab switches. |

---

## 7. New Feature Folder Template

For new Waves (11-24), each new feature should follow this template:

```
client/src/features/<feature-name>/
├── components/
│   ├── <Feature>Page.tsx         ← Main page (tab-level entry point)
│   ├── <Feature>Dashboard.tsx    ← If tab has sub-tabs
│   └── <Sub>Component.tsx        ← Individual sub-features
├── types.ts                      ← Feature-specific TypeScript types
├── index.ts                      ← Barrel exports
├── hooks/                        ← Optional: feature-specific hooks
│   └── use<Feature>.ts
└── constants/                    ← Optional: feature constants
    └── <constants>.ts
```

**Naming conventions observed:**
- Page components: `<Feature>Page.tsx` (e.g., `GSTPage`, `TransfersPage`, `BASPage`)
- Dashboard containers: `<Feature>Dashboard.tsx` (e.g., `AnalyticsDashboard`, `TaxDashboard`, `LoanDashboard`)
- Sub-features: Descriptive names (e.g., `CategoryBreakdown`, `SpendingTrends`, `HomeLoanCalculator`)
- Types: `types.ts` at feature root
- Hooks: `use<Name>.ts` in `hooks/` folder

**API additions** should be added to `api.ts` as new named export objects following the pattern:
```ts
export const newFeatureApi = {
  fetchSomething: async (): Promise<ResponseType> => {
    const res = await fetch(`${API_URL}/new-feature/endpoint`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  },
};
```

---

## 8. Critical Gaps Summary

| Gap | Severity | Impact on Waves 11-24 |
|-----|---------|----------------------|
| **No router** | CRITICAL | Can't deep-link, no code splitting, no URL state |
| **No chart library** | HIGH | Analytics, forecasts, reports all need real charts |
| **No state management** | HIGH | Data re-fetched on every tab switch, no caching |
| **No form library** | MEDIUM | Complex forms (invoicing, payroll) will need validation |
| **Flat navigation** | HIGH | 15+ tabs won't fit — need sidebar |
| **No lazy loading** | MEDIUM | Bundle size will grow significantly |
| **Chat is primitive** | HIGH | Agent-controlled chat needs streaming, persistence, rich content |
| **No data grid** | LOW | TanStack Table is used but only for transactions — need reusable pattern |
| **Missing shadcn components** | LOW | Need Dialog, Tooltip, DropdownMenu, Sheet for new features |

---

## 9. Dependency Summary

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.0 | UI framework |
| react-dom | 19.2.0 | DOM rendering |
| tailwindcss | 4.1.18 | CSS utility framework |
| @tanstack/react-table | 8.21.3 | Data tables (transactions) |
| @tanstack/react-virtual | 3.13.18 | Virtual scrolling |
| @radix-ui/react-* | various | Primitive UI components (6 packages) |
| lucide-react | 0.562.0 | Icon library |
| class-variance-authority | 0.7.1 | Component variant management |
| clsx + tailwind-merge | latest | Conditional className merging |
| sonner | 2.0.7 | Toast notifications |
| vite | 7.2.4 | Build tool |
| typescript | 5.9.3 | Type checking |
| vitest | 4.0.17 | Testing (dev, no test files found) |
| eslint + prettier | latest | Linting + formatting |
| husky + lint-staged | latest | Git hooks |

---

*End of R07 Frontend Architecture Report*
