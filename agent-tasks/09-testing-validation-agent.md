# Agent 9: Testing & Validation Agent

## Role
Run the full 20-point verification plan from `docs/Curretn Claudecode plan.md` lines 977-998.

## Priority: WAVE 5 (After ALL agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-01` through `.agent-done-08` before starting.

## Verification Tasks

- [ ] **Compilation**: Run `cd server && npx tsc --noEmit` (zero errors), `cd client && npx tsc --noEmit` (zero errors), `docker compose config` (validates)

- [ ] **Schema**: Run migration against DB (`docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/09-tax-return-platform.sql`), verify 5 new tables exist (`\dt owner_equity_events` etc.), verify transactions has claim_type/claim_amount/claim_method/substantiation_status columns

- [ ] **Tax Returns**: Test all 4 entity endpoints with curl — sole-trader (verify SBITO, net business income), personal (verify PAYG withheld, HELP), company (verify 25% rate, franking credits), trust (verify distributions, Section 100A warning)

- [ ] **Tax Optimizer**: `curl -X POST localhost:3501/api/tax/strategies/generate/2024-25` — verify at least 3 strategies with estimated savings and ATO ruling references

- [ ] **Owner Equity**: `curl -X POST localhost:3501/api/tax/equity/scan/2024-25` — verify contributions >$1,000 detected with account numbers

- [ ] **Loan Calculators**: Test home loan ($500k at 6.25% for 30yr monthly = ~$3,078.59/month), refinance (verify break-even period), borrowing capacity (verify APRA 3% buffer), car finance (compare chattel mortgage vs novated lease)

- [ ] **Economic Data**: `curl localhost:3501/api/economic/rates` — verify RBA cash rate data returned

- [ ] **Budget & Analytics**: Verify budget projections (trend detection, confidence bands), bill alerts (next-due-date predictions, missed payment flagging)

- [ ] **Agent Registration**: Verify 3 new agents in types.ts (`tax_strategy`, `personal_tax_claims`, `financial_planner`), 3 entries in config.ts AGENT_TOKEN_BUDGETS, 3 entries in AGENT_MODELS

- [ ] **Frontend**: Navigate all entity tabs in Tax Dashboard, navigate to /loans, verify styling matches existing components, `cd client && npx tsc --noEmit` passes

- [ ] **Generate Verification Report**:
```
GOLDLEDGER VERIFICATION REPORT
==============================
Date: [timestamp]
Schema:     [PASS/FAIL] - [details]
Tax Return: [PASS/FAIL] - [details]
Optimizer:  [PASS/FAIL] - [details]
Equity:     [PASS/FAIL] - [details]
Loans:      [PASS/FAIL] - [details]
Economic:   [PASS/FAIL] - [details]
Budget:     [PASS/FAIL] - [details]
Agents:     [PASS/FAIL] - [details]
Frontend:   [PASS/FAIL] - [details]
Build:      [PASS/FAIL] - [details]
```

- [ ] Create marker file: `.agent-done-09`

## Dependencies
- **Requires**: ALL agents (`.agent-done-01` through `.agent-done-08`)
- **Docker must be running**: `docker compose up -d`
