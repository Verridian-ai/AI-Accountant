# Wave 18 — CDR Open Banking & Loan Comparison — Orchestration Prompt

You are the **Team Lead** for Wave 18: CDR Open Banking & Loan Comparison. You coordinate 10 specialized agents to integrate Australia's Consumer Data Right (CDR) Product Reference Data API for real-time loan/product comparison across 121+ data holders.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **CDR research**: `wave0-research/R03-cdr-open-banking.md`
- **External data research**: `wave0-research/R10-external-data-sources.md`
- **Existing loan calculator**: `server/src/services/loan-calculator.ts`

## Current State (After Wave 17)
- 23 Claude agents
- Loan calculator exists but uses hardcoded rates
- No CDR integration
- 19 migrations (0009–0029) applied

## Dependencies
- **Requires**: Wave 13 (financial reports for loan impact analysis)
- **Estimated Complexity**: HIGH (external API integration)

## CDR API Overview (from R03 research)
- **CDR Register**: `GET https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary` (public, unauthenticated)
- **PRD Products**: `GET {publicBaseUri}/banking/products` (public, unauthenticated, per data holder)
- **PRD Product Detail**: `GET {publicBaseUri}/banking/products/{productId}` (public)
- **Rate Limiting**: 300 TPS public limit, conservative 2 req/s per data holder
- **Total Data Holders**: 121+ Australian deposit-taking institutions

## Database Schema Changes

### New Tables (9 tables)
| Table | Columns |
|-------|---------|
| `cdr_data_holders` | id, dataHolderBrandId (UUID), brandName, logoUri, publicBaseUri, status (active/inactive), industries (JSON), lastCrawled, lastUpdated |
| `cdr_products` | id, dataHolderId, productId, name, description, brand, productCategory (RESIDENTIAL_MORTGAGES/BUSINESS_LOANS/PERSONAL_LOANS/TERM_DEPOSITS/etc), isTailored, effectiveFrom, effectiveTo, applicationUri, additionalInformation (JSON), lastUpdated |
| `cdr_lending_rates` | id, productId, lendingRateType (FIXED/VARIABLE/INTRODUCTORY/DISCOUNT/PENALTY/CASH_ADVANCE/PURCHASE), rate, comparisonRate, calculationFrequency, applicationFrequency, interestPaymentDue, repaymentType, loanPurpose, tiers (JSON), additionalInfo |
| `cdr_deposit_rates` | id, productId, depositRateType (FIXED/VARIABLE/BONUS/INTRODUCTORY), rate, calculationFrequency, applicationFrequency, tiers (JSON), additionalInfo |
| `cdr_fees` | id, productId, name, feeType (PERIODIC/TRANSACTION/WITHDRAWAL/DEPOSIT/PAYMENT/PURCHASE/EVENT/EXIT/UPFRONT), amount, balanceRate, transactionRate, accruedRate, accrualFrequency, currency |
| `cdr_features` | id, productId, featureType, additionalValue, additionalInfo |
| `cdr_eligibility` | id, productId, eligibilityType, additionalValue, additionalInfo |
| `cdr_crawl_log` | id, dataHolderId, crawlType (discovery/catalog/detail), status (started/completed/failed), productsFound, productsUpdated, errorMessage, startedAt, completedAt |
| `cdr_rate_alerts` | id, userId, alertType (rate_drop/new_product/fee_change), productCategory, currentRate, targetRate, isActive, lastTriggered |

**Migration**: `docker/migrations/0030_cdr_open_banking.sql`

## API Endpoints (20 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cdr/data-holders | List registered data holders |
| POST | /api/cdr/crawl/discovery | Crawl CDR Register for data holders |
| POST | /api/cdr/crawl/catalog/:dataHolderId | Crawl products from data holder |
| POST | /api/cdr/crawl/detail/:productId | Fetch product detail |
| POST | /api/cdr/crawl/full | Full crawl pipeline (all data holders) |
| GET | /api/cdr/crawl/status | Crawl pipeline status |
| GET | /api/cdr/products | Search/filter products |
| GET | /api/cdr/products/:id | Product detail with rates/fees |
| GET | /api/cdr/compare | Compare products side-by-side |
| GET | /api/cdr/rates/lending | Search lending rates |
| GET | /api/cdr/rates/deposit | Search deposit rates |
| GET | /api/cdr/best-rates | Best rates by product category |
| POST | /api/cdr/loan-comparison | Compare loans with scenarios |
| GET | /api/cdr/alerts | List rate alerts |
| POST | /api/cdr/alerts | Create rate alert |
| PATCH | /api/cdr/alerts/:id | Update alert |
| DELETE | /api/cdr/alerts/:id | Delete alert |
| GET | /api/cdr/stats | CDR data statistics |
| POST | /api/cdr/index-cognee | Index products to Cognee |
| GET | /api/cdr/savings-opportunity | Calculate potential savings vs current products |

## UI Components
### `client/src/features/banking-products/` — New feature folder
- ProductExplorer.tsx — Searchable product catalog with filters (category, rate type, data holder)
- ProductComparison.tsx — Side-by-side product comparison table
- LoanComparison.tsx — Enhanced loan calculator with CDR real rates
- RateTracker.tsx — Rate trends over time (historical crawl data)
- BestRates.tsx — Top rates by category with data holder logos
- DataHolderDirectory.tsx — 121+ data holder listing with crawl status
- RateAlertManager.tsx — Create/manage rate change alerts
- SavingsCalculator.tsx — "Could you save?" calculator vs current products

### `client/src/features/loans/` — Enhanced
- LoanScenarioBuilder.tsx — (update existing) Wire to CDR real rates

**Navigation**: Add `banking-products` to TabId type

## New Claude Agents (1)
1. **`cdr_product_agent`** — Searches CDR product database, compares rates, calculates loan scenarios with real data, suggests refinancing opportunities. Tools: `search_products`, `compare_rates`, `calculate_loan_scenario`, `find_savings`, `search_product_knowledge`.

## Cognee Integration
- **New datasets**: `cdr_products`, `cdr_rates`, `banking_product_knowledge`
- Index product descriptions for "Find me a variable home loan under 6%"
- Index rate data for "Which bank has the best business loan rate?"
- Index features for "Find a home loan with offset account and redraw"
- Use `CHUNKS` for product similarity search
- Use `CHUNKS_LEXICAL` for feature/eligibility matching
- Nightly re-index after full crawl

## Testing Criteria
- [ ] CDR Register crawl discovers 100+ data holders
- [ ] Product crawl from CBA returns 50+ products
- [ ] Lending rates parsed correctly for FIXED and VARIABLE types
- [ ] Product comparison shows side-by-side with all rate tiers
- [ ] Loan scenario calculator uses real CDR rates
- [ ] Rate alert triggers when target rate is met
- [ ] Full crawl pipeline completes without rate limit violations (2 req/s)
- [ ] Cognee search returns relevant products for natural language queries
- [ ] Chat answers "What's the best variable home loan rate right now?"
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: cdr-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave18-agent-tasks/01-cdr-schema-builder.md`

### Agent 2: cdr-crawler-builder [PRIORITY: WAVE 1]
**Task file**: `wave18-agent-tasks/02-cdr-crawler-builder.md`
**Creates**: server/src/services/cdr-crawler.ts

### Agent 3: cdr-product-service-builder [PRIORITY: WAVE 1]
**Task file**: `wave18-agent-tasks/03-cdr-product-service-builder.md`
**Creates**: server/src/services/cdr-products.ts

### Agent 4: cdr-agent-builder [DEPENDS ON: Agent 3]
**Task file**: `wave18-agent-tasks/04-cdr-agent-builder.md`
**Creates**: server/src/services/claude/agents/cdr-product-agent.ts

### Agent 5: cdr-loan-comparison-builder [DEPENDS ON: Agent 3]
**Task file**: `wave18-agent-tasks/05-cdr-loan-comparison-builder.md`
**Modifies**: server/src/services/loan-calculator.ts (wire to CDR data)

### Agent 6: cognee-cdr-indexer [DEPENDS ON: Agents 2, 3]
**Task file**: `wave18-agent-tasks/06-cognee-cdr-indexer.md`
**Modifies**: cognee-tools.ts, cognee_client.ts

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Task file**: `wave18-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-products-builder [DEPENDS ON: Agent 7]
**Task file**: `wave18-agent-tasks/08-ui-products-builder.md`
**Creates**: 8 new .tsx components

### Agent 9: ui-loans-upgrader [DEPENDS ON: Agent 7]
**Task file**: `wave18-agent-tasks/09-ui-loans-upgrader.md`
**Modifies**: Existing loan UI to use CDR data

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave18-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave18-agent-tasks/`.
