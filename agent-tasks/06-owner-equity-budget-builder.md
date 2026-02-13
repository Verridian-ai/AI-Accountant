# Agent 6: Owner Equity & Budget Builder

## Role
Build owner equity tracking service and enhanced budgeting service.

## Priority: WAVE 2 (After Agent 2 completes schema)

## Wait Condition
Check for `.agent-done-02` marker file before starting.

## Files to CREATE

### 1. `server/src/services/owner-equity.ts`
**Purpose**: Track owner contributions and drawings for sole trader/partnership entities
**Reference**: `docs/Curretn Claudecode plan.md` lines 475-496

Tasks:
- [ ] Create `OwnerEquityService` class
- [ ] Method `scanForContributions(userId, financialYear)`:
  - Import `TransferDetector` from `server/src/services/transfers/detector.ts` (line 92)
  - Call `detectOwnerContributions()` (line 407) to find personal→business transfers
  - Filter by financial year date range using `getFinancialYearDates()` from `server/src/services/tax.ts`
  - Return detected contributions with: transactionId, amount, date, sourceAccount, description
  - Threshold: flag transfers > $1,000 as potential contributions
- [ ] Method `scanForDrawings(userId, financialYear)`:
  - Reverse of contributions: business→personal transfers
  - Also detect ATM withdrawals from business accounts
  - Also detect personal expense payments from business accounts (category-based)
- [ ] Method `confirmEquityEvent(eventId, confirmed)`:
  - Update `owner_equity_events` table (created by Agent 2)
  - Set `confirmed = true/false`
- [ ] Method `getEquitySummary(userId, financialYear)`:
  - Sum confirmed contributions and drawings
  - Return: totalContributions, totalDrawings, netEquityChange, monthlyBreakdown
- [ ] Method `createEquityEvent(params)`:
  - Insert into `owner_equity_events` table
  - Params: userId, accountId, transactionId, eventType, amount, financialYear, notes

### 2. `server/src/services/budget-enhanced.ts`
**Purpose**: Smart budgeting with entity awareness, projections, and wealth modeling
**Reference**: `docs/Curretn Claudecode plan.md` lines 498-570

Tasks:
- [ ] Create `EnhancedBudgetService` class
- [ ] Method `generateSmartBudget(userId, entityType, months)`:
  - Analyze last N months of transactions by category
  - Calculate average, median, min, max per category
  - Apply seasonal adjustments (Q4 typically higher spending)
  - Return budget template with recommended amounts per category
- [ ] Method `detectBillPatterns(userId)`:
  - Find recurring transactions (same merchant, similar amount, regular interval)
  - Predict next due date based on pattern
  - Flag overdue bills (expected but not seen)
  - Flag amount changes (>10% deviation from average)
  - Return: array of `{ merchant, amount, frequency, nextDueDate, status }`
- [ ] Method `projectRevenue(userId, entityType, months)`:
  - Analyze income transaction trends
  - Linear regression on monthly totals
  - Return: projected monthly revenue with confidence bands (±1 std dev)
- [ ] Method `projectExpenses(userId, entityType, months)`:
  - Same as revenue but for expense categories
  - Separate fixed vs variable expenses
- [ ] Method `calculateWealthProjection(params)`:
  - Compound growth model: `FV = PV * (1 + r/n)^(nt) + PMT * ((1 + r/n)^(nt) - 1) / (r/n)`
  - 4 risk profiles: conservative (4%), balanced (6%), growth (8%), aggressive (10%)
  - Project over 5, 10, 20, 30 years
  - Include inflation adjustment (use CPI from economic-data.ts if available, else 3% default)
- [ ] Method `compareDebtStrategies(debts)`:
  - Avalanche: pay highest interest rate first
  - Snowball: pay smallest balance first
  - Calculate total interest paid and payoff timeline for each strategy
  - Input: array of `{ name, balance, rate, minPayment }`
  - Extra monthly payment to allocate

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] OwnerEquityService.scanForContributions() compiles with correct TransferDetector import
- [ ] EnhancedBudgetService.calculateWealthProjection() returns correct compound growth
  - Test: $10,000 PV, $500/month, 7% return, 10 years = ~$96,715
- [ ] Create marker file: `.agent-done-06`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-02`) — needs `owner_equity_events` table in schema
- **Reuses**: transfers/detector.ts, tax.ts (getFinancialYearDates)
