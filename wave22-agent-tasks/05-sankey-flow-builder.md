# Agent 5: Sankey Flow Builder

## Role
Build an interactive money flow Sankey diagram showing income sources flowing through accounts into spending categories. This is the centerpiece visualization of the analytics suite.

## Priority: WAVE 22 (After Agent 1)

## Wait Condition
Check for `.agent-done-W22-01` marker file before starting.

## Files to CREATE

### 1. `client/src/features/analytics/components/MoneyFlowSankey.tsx`
**Purpose**: Full-page Sankey diagram showing money flow: Income Sources -> Accounts -> Spending Categories
**Pattern**: Neumorphic dark theme, gold accent flows

- [ ] Three column flow:
  - **Left (Sources)**: Salary, Business Income, Interest, Dividends, Government, Other Income
  - **Center (Accounts)**: All user accounts from accounts API
  - **Right (Destinations)**: Top spending categories from categories.ts
- [ ] Use `<Sankey>` from `components/charts/Sankey.tsx`
- [ ] Build nodes and links dynamically from transaction data:
  ```typescript
  // Aggregate transactions by: source category -> account -> destination category
  const nodes = [...incomeSources, ...accounts, ...expenseCategories];
  const links = transactions.reduce((acc, tx) => {
    // Income: source -> account
    // Expense: account -> category
  }, []);
  ```
- [ ] Color coding:
  - Income flows: gold gradient
  - Expense flows: color by category from `categoryColors.ts`
  - Transfer flows: gray/neutral
- [ ] Interactive features:
  - Hover: highlight full flow path from source to destination
  - Click node: show detail panel with transaction list
  - Click link: show transactions that make up that flow
- [ ] Period selector: month, quarter, year
- [ ] Filter: include/exclude transfers, minimum flow amount threshold

### 2. `client/src/features/analytics/components/MoneyFlowDetail.tsx`
**Purpose**: Side panel showing transaction details for selected Sankey node/link

- [ ] Props: `selectedNode?: SankeyNode`, `selectedLink?: SankeyLink`, `onClose: () => void`
- [ ] Slide-in panel from right (neu-raised background)
- [ ] Show: node/link name, total amount, transaction count
- [ ] Transaction list: date, description, amount (sorted by amount descending)
- [ ] Gold header bar with close button

### 3. `client/src/features/analytics/components/FlowSummaryCards.tsx`
**Purpose**: Summary KPI cards above the Sankey diagram

- [ ] 6 cards in a responsive grid:
  - Total Income (green, with sparkline)
  - Total Expenses (red, with sparkline)
  - Net Cash Flow (gold, with sparkline)
  - Largest Income Source (name + amount)
  - Largest Expense Category (name + amount)
  - Savings Rate (percentage with circular progress)
- [ ] Each card uses `neu-raised` class
- [ ] Sparklines from `<Sparkline>` component showing 6-month trend

### 4. `client/src/features/analytics/hooks/useMoneyFlow.ts`
**Purpose**: React hook to compute Sankey data from transactions

- [ ] `useMoneyFlow(period: string)` returns:
  - `nodes: SankeyNode[]`
  - `links: SankeyLink[]`
  - `summary: FlowSummary`
  - `loading: boolean`
  - `error: string | null`
- [ ] Fetch transactions for period from existing API
- [ ] Aggregate into source -> account -> category flows
- [ ] Filter out flows below minimum threshold (default $10)
- [ ] Memoize computation with `useMemo`

## Files to MODIFY

### 5. `client/src/App.tsx`
- [ ] Add import for `MoneyFlowSankey`
- [ ] Wire into navigation as "Money Flow" tab/route under Analytics

### 6. `client/src/api.ts`
- [ ] Add `fetchMoneyFlowData(period: string)` if needed (may reuse existing transaction fetch)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] Sankey diagram renders with at least 3 source nodes, account nodes, and category nodes
- [ ] Hover highlights full flow path
- [ ] Click on node opens detail panel with correct transactions
- [ ] Period selector changes the data and re-renders diagram
- [ ] Summary cards show correct aggregated totals
- [ ] Responsive: diagram scrollable horizontally on mobile, full-width on desktop
- [ ] Create marker file: `.agent-done-W22-05`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W22-01`) for Sankey and Sparkline components
- **Reuses**: Existing transaction API, categories.ts, categoryColors.ts, accounts API
