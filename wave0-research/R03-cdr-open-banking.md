# R03: CDR Open Banking API Research
## Australian Consumer Data Right — Product Reference Data for Loan Comparison

**Researcher**: Agent R03
**Date**: 2026-02-12
**Status**: Complete

---

## 1. CDR Register API

### Overview
The CDR Register is maintained by the ACCC and provides a central directory of all Data Holders participating in the Consumer Data Right ecosystem. The key public endpoint for discovery is:

### GetDataHolderBrandsSummary (PUBLIC, Unauthenticated)

**Endpoint**: `GET https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary`

**Headers**:
| Header | Required | Description |
|--------|----------|-------------|
| `x-v` | Yes | Version of the API endpoint requested. Must be a positive integer. Current: `1` |

**Query Parameters**: None required for summary endpoint.

**Response Schema** (`ResponseRegisterDataHolderBrandList`):
```json
{
  "data": [
    {
      "dataHolderBrandId": "string (UUID)",
      "brandName": "string",
      "industries": ["banking"],
      "logoUri": "string (URL)",
      "legalEntity": {
        "legalEntityId": "string",
        "legalEntityName": "string",
        "registrationNumber": "string",
        "registrationDate": "string (date)",
        "status": "ACTIVE | INACTIVE | REMOVED"
      },
      "status": "ACTIVE | INACTIVE | REMOVED",
      "endpointDetail": {
        "version": "string",
        "publicBaseUri": "string (URL)",
        "resourceBaseUri": "string (URL)",
        "infosecBaseUri": "string (URL)",
        "extensionBaseUri": "string (URL)",
        "websiteUri": "string (URL)"
      },
      "authDetails": [
        {
          "registerUType": "SIGNED-JWT",
          "jwksEndpoint": "string (URL)"
        }
      ],
      "lastUpdated": "string (datetime)"
    }
  ],
  "links": {
    "self": "string",
    "first": "string",
    "prev": "string",
    "next": "string",
    "last": "string"
  },
  "meta": {
    "totalRecords": 0,
    "totalPages": 0
  }
}
```

**Key Field**: `endpointDetail.publicBaseUri` — this is the base URL used to construct PRD API calls.

### Known Major Bank Base URIs (from CDR Register)
| Bank | Base URI |
|------|----------|
| Commonwealth Bank (CBA) | `https://api.commbank.com.au/public/cds-au/v1` |
| ANZ | `https://api.anz/cds-au/v1` |
| Westpac | `https://digital-api.westpac.com.au/cds-au/v1` |
| NAB | `https://openbank.api.nab.com.au/cds-au/v1` |

**Total Data Holders**: 121+ Australian deposit-taking institutions are registered.

### Authenticated Endpoint (for ADRs only)
There is also an authenticated `GetDataHolderBrands` endpoint that provides additional details, but it requires Accredited Data Recipient (ADR) registration. For our use case (public PRD), the summary endpoint is sufficient.

---

## 2. PRD Endpoints

Product Reference Data (PRD) is **publicly available** from all CDR Data Holders. No authentication or ADR accreditation is required.

### Get Products

**Endpoint**: `GET {publicBaseUri}/banking/products`

**Example**: `GET https://api.commbank.com.au/public/cds-au/v1/banking/products`

**Headers**:
| Header | Required | Description |
|--------|----------|-------------|
| `x-v` | Yes | API version. Current version: `4` (returns BankingProductV4) |
| `x-min-v` | No | Minimum acceptable version. Holder responds with highest supported between x-min-v and x-v |

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product-category` | Enum | No | Filter by product category (see BankingProductCategory below) |
| `effective` | Enum | No | `CURRENT` (default), `FUTURE`, `ALL` |
| `updated-since` | DateTime | No | ISO 8601 format. Only products updated after this time |
| `brand` | String | No | Filter by brand name |
| `page` | Integer | No | Page number (1-indexed, default: 1) |
| `page-size` | Integer | No | Number of records per page (default: 25, max: 1000) |

**Response Schema** (`ResponseBankingProductListV3`):
```json
{
  "data": {
    "products": [
      {
        "productId": "string",
        "effectiveFrom": "string (datetime, optional)",
        "effectiveTo": "string (datetime, optional)",
        "lastUpdated": "string (datetime)",
        "productCategory": "BankingProductCategory enum",
        "name": "string",
        "description": "string",
        "brand": "string",
        "brandName": "string (optional)",
        "applicationUri": "string (URL, optional)",
        "isTailored": false,
        "additionalInformation": {
          "overviewUri": "string (optional)",
          "termsUri": "string (optional)",
          "eligibilityUri": "string (optional)",
          "feesAndPricingUri": "string (optional)",
          "bundleUri": "string (optional)"
        },
        "cardArt": [
          {
            "title": "string (optional)",
            "imageUri": "string (URL)"
          }
        ]
      }
    ]
  },
  "links": {
    "self": "string",
    "first": "string",
    "prev": "string",
    "next": "string",
    "last": "string"
  },
  "meta": {
    "totalRecords": 0,
    "totalPages": 0
  }
}
```

### Get Product Detail

**Endpoint**: `GET {publicBaseUri}/banking/products/{productId}`

**Example**: `GET https://api.commbank.com.au/public/cds-au/v1/banking/products/{productId}`

**Headers**:
| Header | Required | Description |
|--------|----------|-------------|
| `x-v` | Yes | API version. Current version: `4` (returns BankingProductDetailV4) |
| `x-min-v` | No | Minimum acceptable version |

**Response**: Returns full `BankingProductDetailV4` (see Section 3).

### Version Negotiation
The holder responds with the highest supported version between `x-min-v` and `x-v`. If the value of `x-min-v` >= `x-v`, then `x-min-v` is treated as absent. If no supported versions match, the holder returns **406 Not Acceptable**.

### Product Category Enum (`BankingProductCategory`)
| Value | Description | Loan-Relevant |
|-------|-------------|---------------|
| `RESIDENTIAL_MORTGAGES` | Home loans, investment property loans | **YES** |
| `PERS_LOANS` | Personal loans, car loans | **YES** |
| `BUSINESS_LOANS` | Business lending products | **YES** |
| `CRED_AND_CHRG_CARDS` | Credit cards, charge cards | Partial |
| `TRANS_AND_SAVINGS_ACCOUNTS` | Transaction & savings accounts | No |
| `TERM_DEPOSITS` | Term deposits | No |
| `TRAVEL_CARDS` | Travel money cards | No |
| `REGULATED_TRUST_ACCOUNTS` | Trust accounts | No |
| `MARGIN_LOANS` | Margin lending | Partial |
| `LEASES` | Equipment/vehicle leases | **YES** |
| `TRADE_FINANCE` | Trade finance facilities | Partial |
| `OVERDRAFTS` | Overdraft facilities | Partial |

**For GoldLedger loan comparison, primary categories**: `RESIDENTIAL_MORTGAGES`, `PERS_LOANS`, `BUSINESS_LOANS`, `LEASES`

---

## 3. Data Schema

### BankingProductV4 (Summary — returned in list endpoint)

```typescript
interface BankingProductV4 {
  productId: string;                    // Unique ID within the data holder
  effectiveFrom?: string;               // ISO 8601 datetime
  effectiveTo?: string;                 // ISO 8601 datetime
  lastUpdated: string;                  // ISO 8601 datetime
  productCategory: BankingProductCategory;
  name: string;                         // Display name
  description: string;                  // Marketing description
  brand: string;                        // Brand code
  brandName?: string;                   // Display brand name
  applicationUri?: string;              // URL to apply
  isTailored: boolean;                  // If true, rates may vary
  additionalInformation?: {
    overviewUri?: string;
    termsUri?: string;
    eligibilityUri?: string;
    feesAndPricingUri?: string;
    bundleUri?: string;
  };
  cardArt?: Array<{
    title?: string;
    imageUri: string;
  }>;
}
```

### BankingProductDetailV4 (Full — returned in detail endpoint)

Extends BankingProductV4 with:

```typescript
interface BankingProductDetailV4 extends BankingProductV4 {
  bundles?: BankingProductBundle[];
  features?: BankingProductFeatureV2[];
  constraints?: BankingProductConstraint[];
  eligibility?: BankingProductEligibility[];
  fees?: BankingProductFeeV2[];
  depositRates?: BankingProductDepositRate[];
  lendingRates?: BankingProductLendingRateV2[];
}
```

### BankingProductLendingRateV2

This is the **most critical schema for loan comparison**.

```typescript
interface BankingProductLendingRateV2 {
  lendingRateType: LendingRateType;       // Enum (see below)
  rate: string;                           // Rate as decimal string e.g. "0.0599"
  comparisonRate?: string;                // Comparison rate (includes fees)
  calculationFrequency?: string;          // ISO 8601 duration e.g. "P1D"
  applicationFrequency?: string;          // How often rate applied e.g. "P1M"
  interestPaymentDue?: InterestPaymentDue;
  repaymentType?: RepaymentType;
  loanPurpose?: LoanPurpose;
  tiers?: BankingProductRateTierV3[];
  additionalValue?: string;              // Meaning depends on lendingRateType
  additionalInfo?: string;               // Display text
  additionalInfoUri?: string;            // URL for more info
}
```

**LendingRateType Enum**:
| Value | Description | additionalValue |
|-------|-------------|-----------------|
| `FIXED` | Fixed rate for a period | ISO 8601 duration (e.g. "P2Y" for 2yr fixed) |
| `VARIABLE` | Standard variable rate | N/A |
| `INTRODUCTORY` | Intro rate for limited period | ISO 8601 duration |
| `DISCOUNT` | Discount from standard rate | Description of discount condition |
| `PENALTY` | Penalty rate | Description of penalty trigger |
| `FLOATING` | Floating rate (non-standard variable) | N/A |
| `MARKET_LINKED` | Rate linked to market index | Name of index |
| `CASH_ADVANCE` | Rate for cash advances (cards) | N/A |
| `PURCHASE` | Rate for purchases (cards) | N/A |
| `BUNDLE_DISCOUNT_FIXED` | Bundle discount on fixed rate | Bundle name |
| `BUNDLE_DISCOUNT_VARIABLE` | Bundle discount on variable rate | Bundle name |

**InterestPaymentDue Enum**: `IN_ARREARS`, `IN_ADVANCE`

**RepaymentType Enum**: `INTEREST_ONLY`, `PRINCIPAL_AND_INTEREST`

**LoanPurpose Enum**: `OWNER_OCCUPIED`, `INVESTMENT`

### BankingProductRateTierV3 (Rate Tiers)

```typescript
interface BankingProductRateTierV3 {
  name: string;                    // Display name e.g. "Tier 1"
  unitOfMeasure: UnitOfMeasure;    // DOLLAR, PERCENT, MONTH, DAY
  minimumValue: number;            // Minimum threshold for this tier
  maximumValue?: number;           // Maximum threshold
  rateApplicationMethod?: string;  // WHOLE_BALANCE or PER_TIER
  applicabilityConditions?: {
    additionalInfo?: string;
    additionalInfoUri?: string;
  };
  subTier?: BankingProductRateSubTier;
}
```

### BankingProductFeeV2

```typescript
interface BankingProductFeeV2 {
  name: string;                     // Fee display name
  feeType: FeeType;                // Enum (see below)
  amount?: string;                 // Dollar amount (string)
  balanceRate?: string;            // Rate applied to balance
  transactionRate?: string;        // Rate applied to transaction
  accruedRate?: string;            // Rate for accrual
  accrualFrequency?: string;       // ISO 8601 duration
  currency?: string;               // ISO 4217 currency code
  additionalValue?: string;        // Meaning depends on feeType
  additionalInfo?: string;
  additionalInfoUri?: string;
  discounts?: BankingProductDiscount[];
}
```

**FeeType Enum**:
| Value | Description | additionalValue |
|-------|-------------|-----------------|
| `PERIODIC` | Regular recurring fee | ISO 8601 duration (e.g. "P1M" monthly) |
| `TRANSACTION` | Per-transaction fee | N/A |
| `WITHDRAWAL` | Per-withdrawal fee | N/A |
| `DEPOSIT` | Per-deposit fee | N/A |
| `PAYMENT` | Payment processing fee | N/A |
| `PURCHASE` | Purchase fee | N/A |
| `EVENT` | Event-triggered fee | Description of event |
| `UPFRONT` | One-time setup/application fee | N/A |
| `EXIT` | Fee for exiting the product early | N/A |
| `VARIABLE` | Fee that varies | Description of variation |

### BankingProductFeatureV2

```typescript
interface BankingProductFeatureV2 {
  featureType: FeatureType;        // Enum (see below)
  additionalValue?: string;        // Meaning depends on featureType
  additionalInfo?: string;
  additionalInfoUri?: string;
}
```

**FeatureType Enum** (key values for loan comparison):
| Value | Description | additionalValue |
|-------|-------------|-----------------|
| `OFFSET` | Offset account available | N/A |
| `REDRAW` | Redraw facility available | N/A |
| `EXTRA_REPAYMENTS` | Extra repayments allowed | N/A |
| `DIGITAL_BANKING` | Digital banking access | N/A |
| `CARD_ACCESS` | Card access (debit/credit) | Card scheme name |
| `FREE_TXNS` | Free transactions included | Number of free transactions |
| `FREE_TXNS_ALLOWANCE` | Free transaction dollar allowance | Dollar amount |
| `ADDITIONAL_CARDS` | Additional cards available | Max number of cards |
| `BALANCE_TRANSFERS` | Balance transfer available | N/A |
| `BONUS_REWARDS` | Bonus rewards | Points amount |
| `INSURANCE` | Insurance included | Type of insurance |
| `LOYALTY_PROGRAM` | Linked to loyalty program | Program name |
| `NOTIFICATIONS` | Notifications available | Description |
| `NPP_PAYID` | NPP PayID support | N/A |
| `NPP_ENABLED` | NPP enabled | N/A |
| `BILL_PAYMENT` | Bill payment facilities | Description |
| `COMPLEMENTARY_PRODUCT_DISCOUNTS` | Discounts on related products | Description |
| `OTHER` | Other feature | Description |

### BankingProductEligibility

```typescript
interface BankingProductEligibility {
  eligibilityType: EligibilityType;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}
```

**EligibilityType Enum**: `BUSINESS`, `PENSION_RECIPIENT`, `MIN_AGE`, `MAX_AGE`, `MIN_INCOME`, `MIN_TURNOVER`, `STAFF`, `STUDENT`, `EMPLOYMENT_STATUS`, `RESIDENCY_STATUS`, `NATURAL_PERSON`, `OTHER`

### BankingProductConstraint

```typescript
interface BankingProductConstraint {
  constraintType: ConstraintType;
  additionalValue?: string;
  additionalInfo?: string;
  additionalInfoUri?: string;
}
```

**ConstraintType Enum**: `MIN_BALANCE`, `MAX_BALANCE`, `OPENING_BALANCE`, `MAX_LIMIT`, `MIN_LIMIT`

---

## 4. Integration Design

### CDR PRD Harvester Service

#### Architecture

```
┌─────────────────────────────────────────────────┐
│               CDR PRD Harvester                  │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ CDR Register  │    │  Product Crawler       │  │
│  │ Discovery     │───▶│  (per Data Holder)     │  │
│  └──────────────┘    └───────────┬───────────┘  │
│                                  │               │
│  ┌──────────────┐    ┌───────────▼───────────┐  │
│  │ Rate          │    │  Normalizer &          │  │
│  │ Normalizer    │◀───│  Schema Mapper         │  │
│  └──────┬───────┘    └───────────────────────┘  │
│         │                                        │
│  ┌──────▼───────┐    ┌───────────────────────┐  │
│  │ PostgreSQL    │    │  Cognee Indexer        │  │
│  │ Cache         │───▶│  (for AI queries)      │  │
│  └──────────────┘    └───────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### Crawl Pipeline

1. **Discovery Phase** (daily)
   - Fetch `GetDataHolderBrandsSummary` from CDR Register
   - Upsert data holder records into `cdr_data_holders` table
   - Track new/removed/changed data holders

2. **Product Catalog Phase** (weekly)
   - For each active data holder:
     - `GET {publicBaseUri}/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=1000`
     - Repeat for `PERS_LOANS`, `BUSINESS_LOANS`, `LEASES`
     - Paginate through all results
   - Upsert product summaries into `cdr_products` table

3. **Product Detail Phase** (daily for rates, weekly for full)
   - For products that changed (`updated-since` filter):
     - `GET {publicBaseUri}/banking/products/{productId}`
   - Extract and normalize: lendingRates, fees, features, eligibility
   - Upsert into normalized tables

4. **Cognee Indexing Phase** (after crawl)
   - Format product data as structured text documents
   - Index via Cognee `add` endpoint with dataset `cdr-products`
   - Run `cognify` with financial product extraction prompt

#### Proposed Database Tables

```sql
-- Data Holders (from CDR Register)
CREATE TABLE cdr_data_holders (
  id SERIAL PRIMARY KEY,
  data_holder_brand_id TEXT UNIQUE NOT NULL,
  brand_name TEXT NOT NULL,
  legal_entity_name TEXT,
  public_base_uri TEXT NOT NULL,
  website_uri TEXT,
  logo_uri TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (from Get Products)
CREATE TABLE cdr_products (
  id SERIAL PRIMARY KEY,
  data_holder_id INTEGER REFERENCES cdr_data_holders(id),
  product_id TEXT NOT NULL,                          -- DH's product ID
  product_category TEXT NOT NULL,                    -- BankingProductCategory enum
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  brand_name TEXT,
  application_uri TEXT,
  is_tailored BOOLEAN DEFAULT FALSE,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL,
  overview_uri TEXT,
  terms_uri TEXT,
  fees_and_pricing_uri TEXT,
  last_detail_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(data_holder_id, product_id)
);

-- Lending Rates (from Product Detail)
CREATE TABLE cdr_lending_rates (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES cdr_products(id) ON DELETE CASCADE,
  lending_rate_type TEXT NOT NULL,                   -- LendingRateType enum
  rate DECIMAL(10, 6) NOT NULL,                     -- e.g. 0.0599 = 5.99%
  comparison_rate DECIMAL(10, 6),
  calculation_frequency TEXT,                        -- ISO 8601 duration
  application_frequency TEXT,
  interest_payment_due TEXT,                         -- IN_ARREARS | IN_ADVANCE
  repayment_type TEXT,                              -- INTEREST_ONLY | PRINCIPAL_AND_INTEREST
  loan_purpose TEXT,                                -- OWNER_OCCUPIED | INVESTMENT
  additional_value TEXT,                            -- Depends on rate type
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Tiers (for tiered lending rates)
CREATE TABLE cdr_rate_tiers (
  id SERIAL PRIMARY KEY,
  lending_rate_id INTEGER REFERENCES cdr_lending_rates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL,                    -- DOLLAR | PERCENT | MONTH | DAY
  minimum_value DECIMAL(15, 2) NOT NULL,
  maximum_value DECIMAL(15, 2),
  rate_application_method TEXT,                     -- WHOLE_BALANCE | PER_TIER
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees (from Product Detail)
CREATE TABLE cdr_fees (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES cdr_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee_type TEXT NOT NULL,                           -- FeeType enum
  amount DECIMAL(10, 2),
  balance_rate DECIMAL(10, 6),
  transaction_rate DECIMAL(10, 6),
  accrued_rate DECIMAL(10, 6),
  accrual_frequency TEXT,                           -- ISO 8601 duration
  currency TEXT DEFAULT 'AUD',
  additional_value TEXT,
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Features (from Product Detail)
CREATE TABLE cdr_features (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES cdr_products(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL,                       -- FeatureType enum
  additional_value TEXT,
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eligibility (from Product Detail)
CREATE TABLE cdr_eligibility (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES cdr_products(id) ON DELETE CASCADE,
  eligibility_type TEXT NOT NULL,                   -- EligibilityType enum
  additional_value TEXT,
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints (from Product Detail)
CREATE TABLE cdr_constraints (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES cdr_products(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL,                    -- ConstraintType enum
  additional_value TEXT,
  additional_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawl Log (for tracking sync state)
CREATE TABLE cdr_crawl_log (
  id SERIAL PRIMARY KEY,
  crawl_type TEXT NOT NULL,                         -- 'register' | 'catalog' | 'detail'
  data_holder_id INTEGER REFERENCES cdr_data_holders(id),
  status TEXT NOT NULL,                             -- 'started' | 'completed' | 'failed'
  products_synced INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for query performance
CREATE INDEX idx_cdr_products_category ON cdr_products(product_category);
CREATE INDEX idx_cdr_products_data_holder ON cdr_products(data_holder_id);
CREATE INDEX idx_cdr_lending_rates_product ON cdr_lending_rates(product_id);
CREATE INDEX idx_cdr_lending_rates_type ON cdr_lending_rates(lending_rate_type);
CREATE INDEX idx_cdr_lending_rates_purpose ON cdr_lending_rates(loan_purpose);
CREATE INDEX idx_cdr_fees_product ON cdr_fees(product_id);
CREATE INDEX idx_cdr_features_product ON cdr_features(product_id);
```

#### Crawl Schedule

| Phase | Frequency | Scope | Est. API Calls |
|-------|-----------|-------|----------------|
| Register Discovery | Daily 02:00 AEST | 1 call to CDR Register | 1 |
| Product Catalog | Weekly Sunday 03:00 | 121 data holders × 4 categories | ~500 |
| Rate Refresh | Daily 04:00 | Changed products only (updated-since) | ~200-500 |
| Full Detail Sync | Weekly Sunday 05:00 | All loan products (~2000) | ~2000 |
| Cognee Re-index | After each crawl | Changed products | Variable |

#### Crawl Implementation (TypeScript service)

```typescript
// server/src/services/cdr-harvester.ts

interface CrawlConfig {
  registerEndpoint: string;
  productCategories: BankingProductCategory[];
  rateRefreshInterval: number;  // ms
  catalogRefreshInterval: number;
  maxConcurrency: number;       // parallel DH requests
  requestDelay: number;         // ms between requests to same DH
  apiVersion: number;           // x-v header value
}

const DEFAULT_CONFIG: CrawlConfig = {
  registerEndpoint: 'https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary',
  productCategories: [
    'RESIDENTIAL_MORTGAGES',
    'PERS_LOANS',
    'BUSINESS_LOANS',
    'LEASES'
  ],
  rateRefreshInterval: 24 * 60 * 60 * 1000,  // daily
  catalogRefreshInterval: 7 * 24 * 60 * 60 * 1000,  // weekly
  maxConcurrency: 5,
  requestDelay: 200,  // 200ms between requests per DH
  apiVersion: 4
};
```

#### Cognee Integration

After crawl completes, index product data into Cognee for AI-powered queries:

```typescript
// Index format for Cognee
const productDocument = `
PRODUCT: ${product.name}
BANK: ${dataHolder.brandName}
CATEGORY: ${product.productCategory}
RATES:
${lendingRates.map(r =>
  `  ${r.lendingRateType}: ${(parseFloat(r.rate) * 100).toFixed(2)}%` +
  (r.comparisonRate ? ` (comparison: ${(parseFloat(r.comparisonRate) * 100).toFixed(2)}%)` : '') +
  (r.loanPurpose ? ` [${r.loanPurpose}]` : '') +
  (r.repaymentType ? ` [${r.repaymentType}]` : '')
).join('\n')}
FEES:
${fees.map(f =>
  `  ${f.feeType}: ${f.name} ${f.amount ? '$' + f.amount : ''}`
).join('\n')}
FEATURES: ${features.map(f => f.featureType).join(', ')}
`;

// Add to Cognee
await cogneeClient.add(productDocument, 'cdr-products');
await cogneeClient.cognify({
  datasets: ['cdr-products'],
  custom_prompt: 'Extract financial product entities: bank name, product name, interest rates, fees, loan features (offset, redraw, extra repayments), loan purposes, and eligibility criteria.',
  run_in_background: true
});
```

**Search Types for CDR data**:
- `CHUNKS` — fast vector search for similar products by rate/features
- `CHUNKS_LEXICAL` — keyword search for specific bank/product names
- `GRAPH_COMPLETION` — LLM reasoning for "which loan is best for..."
- `RAG_COMPLETION` — comprehensive product comparison answers

---

## 5. Comparison Engine Design

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Loan Comparison Engine                 │
│                                                       │
│  ┌─────────────────┐   ┌──────────────────────────┐ │
│  │ User's Current   │   │  CDR Product Database     │ │
│  │ Loan Details     │   │  (from Harvester)         │ │
│  │ - Rate           │   │  - 121+ banks             │ │
│  │ - Balance        │   │  - ~2000+ loan products   │ │
│  │ - Repayment      │   │  - Daily rate updates     │ │
│  │ - Features       │   │                           │ │
│  └────────┬────────┘   └───────────┬──────────────┘ │
│           │                         │                 │
│  ┌────────▼─────────────────────────▼──────────────┐ │
│  │              Comparison Logic                     │ │
│  │  1. Filter by category & loan purpose            │ │
│  │  2. Match repayment type & interest type         │ │
│  │  3. Apply LVR/balance tier matching              │ │
│  │  4. Calculate total cost of lending              │ │
│  │  5. Rank by savings potential                    │ │
│  └────────┬────────────────────────────────────────┘ │
│           │                                           │
│  ┌────────▼────────────────────────────────────────┐ │
│  │              Comparison Results                   │ │
│  │  - Monthly repayment difference                  │ │
│  │  - Total interest savings over term              │ │
│  │  - Feature comparison matrix                     │ │
│  │  - Fee comparison                                │ │
│  │  - Switching cost analysis                       │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Comparison Criteria

#### Primary Metrics (Rate-based)
| Metric | Formula | Weight |
|--------|---------|--------|
| Interest Rate | Direct rate comparison | High |
| Comparison Rate | Includes standard fees — better overall metric | **Highest** |
| Monthly Repayment | `PMT(rate/12, months, -balance)` | High |
| Total Interest | Sum of interest over remaining term | High |
| Annual Savings | `(currentRepayment - newRepayment) * 12` | High |

#### Secondary Metrics (Feature-based)
| Metric | Source | Weight |
|--------|--------|--------|
| Offset Account | `features[].featureType == 'OFFSET'` | Medium |
| Redraw Facility | `features[].featureType == 'REDRAW'` | Medium |
| Extra Repayments | `features[].featureType == 'EXTRA_REPAYMENTS'` | Medium |
| Fixed vs Variable | `lendingRates[].lendingRateType` | Medium |
| Online Management | `features[].featureType == 'DIGITAL_BANKING'` | Low |

#### Fee Impact Analysis
| Fee Type | Impact |
|----------|--------|
| `UPFRONT` / Application fees | One-time switching cost |
| `EXIT` / Break costs | Current loan exit cost |
| `PERIODIC` / Annual fees | Ongoing cost (reduce savings) |
| `TRANSACTION` fees | Usage-dependent |

### Comparison Algorithm

```typescript
interface UserLoan {
  balance: number;
  currentRate: number;        // as decimal e.g. 0.0599
  remainingTermMonths: number;
  repaymentType: 'PRINCIPAL_AND_INTEREST' | 'INTEREST_ONLY';
  loanPurpose: 'OWNER_OCCUPIED' | 'INVESTMENT';
  currentFeatures: string[];  // e.g. ['OFFSET', 'REDRAW']
  propertyValue?: number;     // for LVR calculation
}

interface ComparisonResult {
  product: CdrProduct;
  dataHolder: CdrDataHolder;
  matchedRate: CdrLendingRate;
  comparisonRate: number;
  monthlyRepayment: number;
  monthlyRepaymentDiff: number;  // negative = savings
  totalInterestSaved: number;
  annualSavings: number;
  switchingCosts: number;        // exit fees + upfront fees
  breakEvenMonths: number;       // switchingCosts / monthlySavings
  featureMatch: {
    gained: string[];            // features in new product not in current
    lost: string[];              // features in current not in new product
    common: string[];            // shared features
  };
  score: number;                 // weighted composite score
}

function compareLoan(userLoan: UserLoan): ComparisonResult[] {
  // 1. Query CDR products matching category & purpose
  const products = await db.query(`
    SELECT p.*, dh.brand_name, dh.website_uri
    FROM cdr_products p
    JOIN cdr_data_holders dh ON p.data_holder_id = dh.id
    WHERE p.product_category = $1
      AND p.effective_from <= NOW()
      AND (p.effective_to IS NULL OR p.effective_to > NOW())
  `, [getCategoryForPurpose(userLoan.loanPurpose)]);

  // 2. For each product, find best matching rate
  // 3. Apply tier logic (LVR, balance ranges)
  // 4. Calculate savings
  // 5. Rank by composite score

  return results.sort((a, b) => b.score - a.score);
}
```

### LVR Tier Matching

Many loan products have tiered rates based on Loan-to-Value Ratio (LVR). Rate tiers use:
- `unitOfMeasure: 'PERCENT'` for LVR-based tiers
- `minimumValue` / `maximumValue` define the LVR band
- `rateApplicationMethod: 'WHOLE_BALANCE'` (most common for mortgages)

```typescript
function findApplicableRate(
  rates: CdrLendingRate[],
  lvr: number,
  purpose: string,
  repaymentType: string
): CdrLendingRate | null {
  return rates.find(rate => {
    // Match purpose and repayment type
    if (rate.loanPurpose && rate.loanPurpose !== purpose) return false;
    if (rate.repaymentType && rate.repaymentType !== repaymentType) return false;

    // Match LVR tier
    if (rate.tiers?.length) {
      const lvrTier = rate.tiers.find(t => t.unitOfMeasure === 'PERCENT');
      if (lvrTier) {
        if (lvr < lvrTier.minimumValue) return false;
        if (lvrTier.maximumValue && lvr > lvrTier.maximumValue) return false;
      }
    }

    // Prefer non-discount, non-introductory rates for fair comparison
    if (['DISCOUNT', 'INTRODUCTORY', 'BUNDLE_DISCOUNT_FIXED', 'BUNDLE_DISCOUNT_VARIABLE'].includes(rate.lendingRateType)) {
      return false;
    }

    return true;
  });
}
```

---

## 6. Rate Limiting & Error Handling

### CDR Traffic Thresholds

The CDR standards define traffic thresholds that Data Holders may enforce. Exceeding these results in HTTP 429 responses.

#### Public (Unauthenticated) Endpoints — PRD, Status, Outages

| Metric | Threshold |
|--------|-----------|
| Total TPS (all consumers) | **300 TPS** (~25.9M calls/day) |
| Session concept | N/A (no auth tokens) |

This is generous for our use case. Even crawling all 121 banks with 4 categories and 1000 products each = ~2,500 total requests, well within limits.

#### Authenticated Endpoints (not needed for PRD, but documented)

| Traffic Type | Sessions/Day | Calls/Session | TPS/Session | TPS/DR |
|-------------|-------------|---------------|-------------|--------|
| Customer Present | Unlimited | N/A | 10/customer | 50/DR |
| Unattended | 20/customer/DR | 100 | 5 | 50/DR |

#### Our Crawl Rate Strategy

Given we only use unauthenticated public endpoints:

```typescript
const RATE_LIMIT_CONFIG = {
  // Per data holder
  maxRequestsPerSecond: 2,        // Conservative: 2 req/s per DH
  delayBetweenRequests: 500,      // 500ms between requests to same DH

  // Global
  maxConcurrentDataHolders: 5,    // Crawl 5 DHs in parallel
  maxGlobalTPS: 10,               // Never exceed 10 req/s total

  // Retry
  maxRetries: 3,
  retryBackoff: [1000, 5000, 15000],  // Exponential backoff ms

  // Circuit breaker per DH
  failureThreshold: 5,
  circuitResetTimeout: 300000,    // 5 minutes
};
```

### Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Process response |
| 304 | Not Modified | Skip (use cached data) |
| 400 | Bad Request | Log error, skip this DH |
| 404 | Not Found | Product removed, mark inactive |
| 406 | Not Acceptable | Version not supported, try lower x-v |
| 429 | Too Many Requests | Back off, respect `Retry-After` header |
| 500+ | Server Error | Retry with backoff, then skip |

### Version Fallback Strategy

```typescript
async function fetchWithVersionFallback(url: string): Promise<Response> {
  // Try latest version first
  for (const version of [4, 3, 2]) {
    const response = await fetch(url, {
      headers: { 'x-v': String(version) }
    });

    if (response.status === 406) continue;  // Version not supported
    return response;
  }
  throw new Error('No supported API version found');
}
```

### Monitoring & Alerting

Track crawl health with:
- Success rate per data holder
- Average response time per DH
- Number of 429 responses (rate limiting hits)
- Stale data alerts (product not updated > 30 days)
- New/removed data holder alerts

---

## 7. Sample API Responses

### Sample: CDR Register Summary Response

```bash
curl -X GET "https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary" \
  -H "x-v: 1"
```

```json
{
  "data": [
    {
      "dataHolderBrandId": "8a6da5e1-4f1e-eb11-a822-000d3a884a20",
      "brandName": "Commonwealth Bank of Australia",
      "industries": ["banking"],
      "logoUri": "https://www.commbank.com.au/content/dam/commbank/images/logo.svg",
      "legalEntity": {
        "legalEntityId": "18a5da6e-4f1e-eb11-a822-000d3a884a20",
        "legalEntityName": "COMMONWEALTH BANK OF AUSTRALIA",
        "registrationNumber": "123456789",
        "status": "ACTIVE"
      },
      "status": "ACTIVE",
      "endpointDetail": {
        "version": "1",
        "publicBaseUri": "https://api.commbank.com.au/public/cds-au/v1",
        "resourceBaseUri": "https://api.commbank.com.au/cds-au/v1",
        "infosecBaseUri": "https://api.commbank.com.au",
        "websiteUri": "https://www.commbank.com.au"
      },
      "authDetails": [
        {
          "registerUType": "SIGNED-JWT",
          "jwksEndpoint": "https://api.commbank.com.au/jwks"
        }
      ],
      "lastUpdated": "2026-01-15T00:00:00+11:00"
    }
  ],
  "links": {
    "self": "https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary"
  },
  "meta": {
    "totalRecords": 121,
    "totalPages": 1
  }
}
```

### Sample: Get Products (Residential Mortgages)

```bash
curl -X GET "https://api.commbank.com.au/public/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25" \
  -H "x-v: 4"
```

```json
{
  "data": {
    "products": [
      {
        "productId": "3302205e-05a0-4977-8bca-bcf0099bfbb8",
        "lastUpdated": "2026-02-10T14:30:00+11:00",
        "productCategory": "RESIDENTIAL_MORTGAGES",
        "name": "Standard Variable Rate Home Loan",
        "description": "Our standard variable rate home loan with flexible repayment options.",
        "brand": "CBA",
        "brandName": "Commonwealth Bank of Australia",
        "applicationUri": "https://www.commbank.com.au/home-loans/apply.html",
        "isTailored": false,
        "additionalInformation": {
          "overviewUri": "https://www.commbank.com.au/home-loans/standard-variable-rate.html",
          "termsUri": "https://www.commbank.com.au/home-loans/terms.html",
          "feesAndPricingUri": "https://www.commbank.com.au/home-loans/fees.html"
        }
      },
      {
        "productId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "lastUpdated": "2026-02-08T09:00:00+11:00",
        "productCategory": "RESIDENTIAL_MORTGAGES",
        "name": "Fixed Rate Home Loan",
        "description": "Lock in your rate for certainty of repayments.",
        "brand": "CBA",
        "brandName": "Commonwealth Bank of Australia",
        "applicationUri": "https://www.commbank.com.au/home-loans/apply.html",
        "isTailored": false,
        "additionalInformation": {
          "overviewUri": "https://www.commbank.com.au/home-loans/fixed-rate.html",
          "feesAndPricingUri": "https://www.commbank.com.au/home-loans/fees.html"
        }
      }
    ]
  },
  "links": {
    "self": "https://api.commbank.com.au/public/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25&page=1",
    "first": "https://api.commbank.com.au/public/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25&page=1",
    "last": "https://api.commbank.com.au/public/cds-au/v1/banking/products?product-category=RESIDENTIAL_MORTGAGES&page-size=25&page=1"
  },
  "meta": {
    "totalRecords": 12,
    "totalPages": 1
  }
}
```

### Sample: Get Product Detail (Home Loan)

```bash
curl -X GET "https://api.commbank.com.au/public/cds-au/v1/banking/products/3302205e-05a0-4977-8bca-bcf0099bfbb8" \
  -H "x-v: 4"
```

```json
{
  "data": {
    "productId": "3302205e-05a0-4977-8bca-bcf0099bfbb8",
    "lastUpdated": "2026-02-10T14:30:00+11:00",
    "productCategory": "RESIDENTIAL_MORTGAGES",
    "name": "Standard Variable Rate Home Loan",
    "description": "Our standard variable rate home loan with flexible repayment options.",
    "brand": "CBA",
    "brandName": "Commonwealth Bank of Australia",
    "applicationUri": "https://www.commbank.com.au/home-loans/apply.html",
    "isTailored": false,
    "additionalInformation": {
      "overviewUri": "https://www.commbank.com.au/home-loans/standard-variable-rate.html",
      "termsUri": "https://www.commbank.com.au/home-loans/terms.html",
      "feesAndPricingUri": "https://www.commbank.com.au/home-loans/fees.html"
    },
    "features": [
      { "featureType": "OFFSET", "additionalInfo": "100% offset account available" },
      { "featureType": "REDRAW", "additionalInfo": "Free redraw facility" },
      { "featureType": "EXTRA_REPAYMENTS", "additionalInfo": "Unlimited extra repayments" },
      { "featureType": "DIGITAL_BANKING", "additionalInfo": "Manage via CommBank app" },
      { "featureType": "NPP_ENABLED" }
    ],
    "constraints": [
      { "constraintType": "MIN_LIMIT", "additionalValue": "10000" },
      { "constraintType": "MAX_LIMIT", "additionalValue": "5000000" }
    ],
    "eligibility": [
      { "eligibilityType": "NATURAL_PERSON" },
      { "eligibilityType": "RESIDENCY_STATUS", "additionalValue": "Australian citizen or permanent resident" },
      { "eligibilityType": "MIN_AGE", "additionalValue": "18" }
    ],
    "fees": [
      {
        "name": "Establishment Fee",
        "feeType": "UPFRONT",
        "amount": "600.00",
        "currency": "AUD"
      },
      {
        "name": "Monthly Service Fee",
        "feeType": "PERIODIC",
        "amount": "10.00",
        "additionalValue": "P1M",
        "currency": "AUD"
      },
      {
        "name": "Settlement Fee",
        "feeType": "EVENT",
        "amount": "200.00",
        "additionalInfo": "Payable at settlement",
        "currency": "AUD"
      }
    ],
    "lendingRates": [
      {
        "lendingRateType": "VARIABLE",
        "rate": "0.0619",
        "comparisonRate": "0.0632",
        "calculationFrequency": "P1D",
        "applicationFrequency": "P1M",
        "interestPaymentDue": "IN_ARREARS",
        "repaymentType": "PRINCIPAL_AND_INTEREST",
        "loanPurpose": "OWNER_OCCUPIED",
        "tiers": [
          {
            "name": "LVR up to 60%",
            "unitOfMeasure": "PERCENT",
            "minimumValue": 0,
            "maximumValue": 60,
            "rateApplicationMethod": "WHOLE_BALANCE"
          }
        ],
        "additionalInfo": "Owner-occupied, P&I, LVR <= 60%"
      },
      {
        "lendingRateType": "VARIABLE",
        "rate": "0.0649",
        "comparisonRate": "0.0662",
        "calculationFrequency": "P1D",
        "applicationFrequency": "P1M",
        "interestPaymentDue": "IN_ARREARS",
        "repaymentType": "PRINCIPAL_AND_INTEREST",
        "loanPurpose": "OWNER_OCCUPIED",
        "tiers": [
          {
            "name": "LVR 60.01% to 80%",
            "unitOfMeasure": "PERCENT",
            "minimumValue": 60.01,
            "maximumValue": 80,
            "rateApplicationMethod": "WHOLE_BALANCE"
          }
        ],
        "additionalInfo": "Owner-occupied, P&I, LVR 60-80%"
      },
      {
        "lendingRateType": "VARIABLE",
        "rate": "0.0699",
        "comparisonRate": "0.0712",
        "calculationFrequency": "P1D",
        "applicationFrequency": "P1M",
        "interestPaymentDue": "IN_ARREARS",
        "repaymentType": "INTEREST_ONLY",
        "loanPurpose": "INVESTMENT",
        "additionalInfo": "Investment, interest only"
      },
      {
        "lendingRateType": "DISCOUNT",
        "rate": "0.0130",
        "repaymentType": "PRINCIPAL_AND_INTEREST",
        "loanPurpose": "OWNER_OCCUPIED",
        "additionalValue": "Package discount with Wealth Package",
        "additionalInfo": "1.30% discount when bundled with Wealth Package ($395/year)"
      }
    ]
  },
  "links": {
    "self": "https://api.commbank.com.au/public/cds-au/v1/banking/products/3302205e-05a0-4977-8bca-bcf0099bfbb8"
  }
}
```

---

## 8. Key Implementation Notes for GoldLedger

### 1. No Authentication Required
All Product Reference Data endpoints are **public and unauthenticated**. No CDR accreditation, OAuth tokens, or API keys are needed. Just set the `x-v` header.

### 2. Comparison Rate is Critical
The `comparisonRate` field includes standard fees and provides a more accurate picture than the advertised rate. Always prefer comparison rate for rankings.

### 3. Discount Rates Need Special Handling
Products may list both a base VARIABLE rate and a DISCOUNT rate. The discount rate shows the amount to subtract, not the final rate. The effective rate = base rate - discount rate.

### 4. LVR Tiers Require User Input
Most mortgage products have different rates for different LVR bands. The comparison engine needs the user's property value and loan balance to calculate LVR and select the right tier.

### 5. Loan Purpose Splits Rates
Owner-occupied and investment loans almost always have different rates. Must ask the user for loan purpose.

### 6. isTailored Flag
Some products are marked `isTailored: true`, meaning rates may vary per customer (negotiated). These should be flagged in comparison results but not excluded.

### 7. Non-bank Lenders Coming July 2026
CDR Rules Version 8 extends the CDR to non-bank lenders from July 2026. This will significantly expand the product universe for comparison.

### 8. Data Freshness
Data holders update rates frequently (some daily). The `lastUpdated` field on products and the `updated-since` query parameter allow efficient incremental sync.

### 9. 121+ Banks = Rich Comparison
With 121+ data holders, comparisons can include major banks, regional banks, credit unions, building societies, and neobanks — providing genuinely comprehensive market coverage.

---

## Sources

- [CDR Data Standards](https://consumerdatastandardsaustralia.github.io/standards/)
- [CDR Register Design Reference](https://consumerdatastandardsaustralia.github.io/register/)
- [CDR Product Reference Data Guidance](https://cdr-support.zendesk.com/hc/en-us/articles/900004104506-Product-Reference-Data)
- [CDR Lending Rate Guidance](https://cdr-support.zendesk.com/hc/en-us/articles/6888732070159-Guidance-on-BankingProductLendingRateV2-fields)
- [CDR Traffic Thresholds](https://cdr-support.zendesk.com/hc/en-us/articles/360004493255-Traffic-thresholds)
- [CDR Banking API OpenAPI Spec](https://consumerdatastandardsaustralia.github.io/standards/includes/swagger/cds_banking.yaml)
- [Australian Open Banking Data Database](https://github.com/LukePrior/Australian-Open-Banking-Data-Database)
- [CDR Rollout Timeline](https://www.cdr.gov.au/rollout)
- [Kong CDR API Gateway Guide](https://konghq.com/blog/enterprise/australia-consumer-data-rights)
- [Fiskil CDR PRD Compliance](https://blog.fiskil.com/cdr-product-reference-data)
- [CDR Endpoints & APIs Guide](https://cdr-support.zendesk.com/hc/en-us/articles/360004135055-Endpoints-and-APIs)
- [CDR NFR Requirements](https://cdr-support.zendesk.com/hc/en-us/articles/360004221255-Non-Functional-Requirements-NFRs-performance-accessibility-traffic-limits)
