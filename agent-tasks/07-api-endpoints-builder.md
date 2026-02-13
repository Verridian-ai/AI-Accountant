# Agent 7: API Endpoints Builder

## Role
Wire ~28 new API routes in server/src/index.ts for all new backend services.

## Priority: WAVE 3 (After Agents 1, 5, 6 complete)

## Wait Condition
Check for `.agent-done-01`, `.agent-done-05`, `.agent-done-06` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: 4,300 lines, existing tax routes at lines 2905-3300, BAS routes at lines 2082-2756
**Insert location**: After line 4284 (after cash flow forecast route), before line 4286 (claude-agents mount)

- [ ] Add imports for 6 new services after existing imports (~line 2070):
  ```typescript
  import { TaxReturnService } from './services/tax-return.js';
  import { TaxOptimizerService } from './services/tax-optimizer.js';
  import { OwnerEquityService } from './services/owner-equity.js';
  import { LoanCalculatorService } from './services/loan-calculator.js';
  import { EconomicDataService } from './services/economic-data.js';
  import { EnhancedBudgetService } from './services/budget-enhanced.js';
  ```

- [ ] Instantiate 6 services after existing service instantiation:
  ```typescript
  const taxReturnService = new TaxReturnService();
  const taxOptimizerService = new TaxOptimizerService();
  const ownerEquityService = new OwnerEquityService();
  const loanCalculatorService = new LoanCalculatorService();
  const economicDataService = new EconomicDataService();
  const enhancedBudgetService = new EnhancedBudgetService();
  ```

- [ ] Add 6 Tax Return routes (GET): `/api/tax/return/sole-trader/:year`, `/personal/:year`, `/company/:year`, `/trust/:year`, `/smsf/:year`, `/summary/:year` — each calls corresponding taxReturnService method

- [ ] Add 3 Tax Optimizer routes: `POST /api/tax/strategies/generate/:year`, `GET /api/tax/strategies/:year`, `PATCH /api/tax/strategies/:id/status`

- [ ] Add 4 Owner Equity routes: `POST /api/tax/equity/scan/:year`, `GET /api/tax/equity/:year`, `PATCH /api/tax/equity/:id/confirm`, `POST /api/tax/equity/event`

- [ ] Add 5 Loan Calculator routes (POST): `/api/loans/calculate/home`, `/calculate/car`, `/calculate/personal`, `/refinance-savings`, `/borrowing-capacity`

- [ ] Add 3 Economic Data routes (GET): `/api/economic/rates`, `/cpi`, `/indicators`

- [ ] Add 6 Enhanced Budget routes: `POST /api/analytics/budget/generate`, `GET /api/analytics/bills`, `POST /api/analytics/projections/revenue`, `/projections/expenses`, `/wealth-projection`, `/debt-strategies`

### Route Pattern (follow existing pattern from line 2905):
```typescript
app.get('/api/tax/return/sole-trader/:year', async (c) => {
    try {
        const year = c.req.param('year');
        const userId = c.req.query('userId') || 'default';
        const result = await taxReturnService.calculateSoleTraderReturn(userId, year);
        return c.json(result);
    } catch (err) {
        console.error('Sole trader return failed:', err);
        return c.json({ error: 'Failed to calculate sole trader return' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 28 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes
- [ ] Create marker file: `.agent-done-07`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-01`), Agent 5 (`.agent-done-05`), Agent 6 (`.agent-done-06`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts
