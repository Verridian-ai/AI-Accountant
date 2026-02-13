# Agent R03: CDR Open Banking API Researcher

## Role

Research the Australian Consumer Data Right (CDR) Open Banking APIs for loan and banking product data. Document the API structure, authentication, data schemas, and integration approach for GoldLedger.

## Phase: A (Research — Start Immediately, Parallel with R01-R02, R04-R10)

## Research Tasks

### 1. CDR Register API

- [ ] Document the CDR Register endpoint: `https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary`
- [ ] Document response schema: data holder brands with base URIs, status, industry
- [ ] Note: This is PUBLIC, unauthenticated — no API key needed
- [ ] Document the `x-v` header requirement (version header)
- [ ] Estimate total number of Australian financial institutions in the register

### 2. Banking Product Reference Data (PRD) Endpoints

- [ ] Document the PRD list endpoint: `{baseUri}/cds-au/v1/banking/products`
- [ ] Document the PRD detail endpoint: `{baseUri}/cds-au/v1/banking/products/{productId}`
- [ ] Document query parameters: product-category filter, effective date, page-size
- [ ] Note: These are PUBLIC, unauthenticated endpoints (no consumer consent needed)
- [ ] Document product categories relevant to GoldLedger:
  - `RESIDENTIAL_MORTGAGES` — Home loans
  - `PERS_LOANS` — Personal loans
  - `BUSINESS_LOANS` — Business lending
  - `TRANS_AND_SAVINGS_ACCOUNTS` — Transaction/savings accounts
  - `TERM_DEPOSITS` — Term deposits

### 3. Product Data Schema

- [ ] Document the BankingProductV4 schema fields: productId, name, description, brand, brandName, applicationUri, isTailored, effectiveFrom, effectiveTo, lastUpdated
- [ ] Document BankingProductDetailV4 additional fields: features[], constraints[], eligibility[], fees[], depositRates[], lendingRates[]
- [ ] Document BankingProductLendingRateV2: lendingRateType (FIXED/VARIABLE/INTRODUCTORY/DISCOUNT/PENALTY/FLOATING/MARKET_LINKED/CASH_ADVANCE/PURCHASE/BUNDLE_DISCOUNT_FIXED/BUNDLE_DISCOUNT_VARIABLE), rate, comparisonRate, calculationFrequency, applicationFrequency, interestPaymentDue, repaymentType, loanPurpose, tiers[]
- [ ] Document BankingProductFeeV2: name, feeType, amount, balanceRate, transactionRate, accruedRate, accrualFrequency, currency, additionalValue, additionalInfo

### 4. Integration Architecture

- [ ] Design the CDR PRD Harvester service: scheduled crawl → normalize → cache in database
- [ ] Propose database tables: `cdr_data_holders`, `cdr_products`, `cdr_lending_rates`, `cdr_fees`, `cdr_features`
- [ ] Propose crawl schedule: daily for rates, weekly for product catalog
- [ ] Propose Cognee integration: index products for "Find cheapest home loan under 6%"
- [ ] Document rate limiting considerations (CDR has rate limits per data holder)

### 5. Comparison Engine Design

- [ ] Design loan comparison logic: user's current loan vs CDR products
- [ ] Propose comparison criteria: interest rate, comparison rate, fees, features, eligibility
- [ ] Design savings calculator: potential savings from switching products

## Output Format

Write findings to `wave0-research/R03-cdr-open-banking.md` with these sections:

1. **CDR Register API** — Endpoint, auth, response format, data holder count
2. **PRD Endpoints** — List and detail endpoints, query params, product categories
3. **Data Schema** — Complete field documentation for products, rates, fees
4. **Integration Design** — Harvester architecture, database tables, crawl schedule
5. **Comparison Engine** — Comparison logic, savings calculator design
6. **Rate Limiting & Error Handling** — CDR-specific constraints
7. **Sample API Responses** — Example JSON for key endpoints

## Completion

- [ ] All sections populated with actual API documentation
- [ ] Create marker file: `.agent-done-R03`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **REST API Research** | Analyze API documentation, endpoints, auth flows, rate limits | Expert |
| **JSON Schema Analysis** | Parse complex nested data schemas (BankingProductV4, rates, fees) | Expert |
| **Australian Financial Regulation** | Understand CDR framework, ACCC requirements, data holder obligations | Advanced |
| **Data Harvester Design** | Design scheduled crawlers with rate limiting, error handling, caching | Advanced |
| **Database Schema Design** | Propose normalized table structures for complex product data | Advanced |
| **Comparison Engine Logic** | Design multi-criteria comparison algorithms for financial products | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel API research | Advanced |

## Sub-Agent Delegation Plan

```
R03 (CDR Open Banking Researcher):
├── Sub-agent A: CDR Register & API Documentation
│   ├── Fetch and analyze CDR Register API structure
│   ├── Document all public endpoints (no auth needed)
│   ├── Document x-v header versioning requirements
│   └── Output: wave0-research/.scratch-R03-api.md
│
├── Sub-agent B: Product Data Schema Deep Dive
│   ├── Document BankingProductV4 and BankingProductDetailV4 schemas
│   ├── Document all rate types (lending, deposit) and fee types
│   ├── Document tier structures and eligibility criteria
│   └── Output: wave0-research/.scratch-R03-schema.md
│
├── Sub-agent C: Integration & Comparison Design
│   ├── Design harvester service architecture
│   ├── Propose database tables for CDR data
│   ├── Design comparison engine logic
│   └── Output: wave0-research/.scratch-R03-design.md
│
└── R03 Parent: Merge and produce complete CDR research
    ├── Read all .scratch-R03-*.md files
    ├── Add sample API responses and rate limit documentation
    ├── Write final wave0-research/R03-cdr-open-banking.md
    └── Delete scratch files
```

### Delegation Rules for R03

- Sub-agents write ONLY to `wave0-research/.scratch-R03-*.md` files
- Sub-agent A should include actual API URLs and example curl commands
- Sub-agent B should include example JSON for each schema type

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
- **External research**: May need to fetch CDR documentation from <https://consumerdatastandardsaustralia.github.io/standards/>
