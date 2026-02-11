# GST & Merchant Intelligence System

> Architecture and implementation details for the GST optimization engine, merchant intelligence agent, and Cognee-powered merchant memory.

---

## 1. Architecture Overview

```
Statement Upload → Pipeline Processing
                        ↓
              Enrichment Pipeline
                        ↓
    ┌───────────────────┼───────────────────┐
    │                   │                   │
Merchant        Transaction           GST Calculator
Intelligence    Categorizer            Agent
Agent               Agent
    │                   │                   │
    └───────────────────┼───────────────────┘
                        ↓
              Cognee Knowledge Graph
              (Merchant Memory + GST Rulings)
```

### Components

| Component | File | Model | Purpose |
|-----------|------|-------|---------|
| GST Calculator Agent | `agents/gst-calculator.ts` | Sonnet | Comprehensive GST classification per ATO rules |
| Merchant Intelligence Agent | `agents/merchant-intelligence.ts` | Haiku | Resolve abbreviated merchant names, lookup ABN/GST |
| Cognee Client | `cognee_client.ts` | N/A | REST API client for merchant memory storage/lookup |
| Enrichment Service | `enrichment.ts` | N/A | Orchestrates the 3-stage enrichment pipeline |
| BAS Service | `bas.ts` | N/A | BAS calculation engine with all labels |

---

## 2. GST Optimization Engine

### ATO GST Rules Implemented

The GST Calculator Agent implements comprehensive ATO GST rules from `GST_BAS_RULES.md`:

#### GST Categories
- **Taxable (10%)**: Standard business transactions — G1 (sales), G11 (purchases)
- **GST-Free (0%)**: Medical, education, childcare, fresh food, exports — G2/G3
- **Input-Taxed**: Bank fees, interest, residential rent — no GST credit
- **Capital (G10)**: Business assets > $1,000 GST-exclusive
- **Private/Out-of-scope**: Wages, super, transfers, ATM — not on BAS

#### BAS Label Mapping
```
Sales:
  G1 (Total sales) → 1A = GST on sales (G1 / 11)
  G2 (Exports) → GST-free
  G3 (Other GST-free) → No GST

Purchases:
  G10 (Capital) → 1B += GST credits
  G11 (Non-capital) → 1B += GST credits

Net GST: G20 = 1A - 1B
PAYG: W1 (wages), W2 (withheld), 5A (instalment)
Other: 7C (fuel credits), 7D (wine equalisation)
```

#### Special Rules
- **Motor vehicle cap**: GST credit limited to $68,108 / 11 = $6,191.64
- **Entertainment**: Only 50% of meal costs claimable
- **Mixed-use**: Apportioned by business use percentage
- **Supermarket**: Treated as 50/50 mixed if no breakdown available
- **Tax invoice threshold**: Required for purchases > $82.50 incl. GST

### Classification Priority
1. Category-based mapping (most reliable — from `CATEGORY_GST_MAP`)
2. Keyword-based detection (description text matching)
3. Capital acquisition check (amount + asset keywords)
4. Default: taxable at 10%

### Tools Available
| Tool | Purpose |
|------|---------|
| `classify_gst_supply` | Classify transactions by ATO GST treatment |
| `calculate_input_tax_credit` | Calculate claimable GST with adjustments |
| `calculate_gst_from_inclusive` | 1/11th formula for GST-inclusive amounts |
| `generate_bas_labels` | Compile final BAS figures from classified data |
| `identify_capital_purchases` | Find assets > $1,000 GST-exclusive |
| `lookup_gst_ruling` | Search Cognee for ATO guidance |

---

## 3. Merchant Intelligence Agent

### Purpose
Resolves abbreviated bank statement merchant descriptions (e.g., "SQ *COFFEE", "STRIPE MERCHANT") into canonical business names with GST status.

### Resolution Pipeline
```
Unknown Merchant
    ↓
1. Check Cognee memory (previous mappings)
    ↓ Not found
2. Pattern matching (known merchants database)
    ↓ Not matched
3. Strip payment processor prefixes (SQ *, STRIPE, PAYPAL *)
    ↓
4. ABN lookup (heuristic GST registration check)
    ↓
5. Category inference (industry + amount based)
    ↓
6. Store mapping in Cognee + local DB
```

### Known Merchants Database
Pre-loaded mappings for common Australian merchants:
- Woolworths, Coles, ALDI (Grocery)
- Bunnings, Kmart, Target (Retail)
- Telstra, Optus (Telco)
- Netflix, Spotify (Streaming)
- Shell, BP, Caltex/Ampol (Fuel)
- And more...

### Payment Processor Prefixes
- `SQ *` → Square POS merchant (small business)
- `STRIPE` → Stripe online payment
- `PAYPAL *` → PayPal transaction

### Tools Available
| Tool | Purpose |
|------|---------|
| `search_cognee_merchant` | Check Cognee for known mappings |
| `resolve_merchant_name` | Pattern match + prefix stripping |
| `lookup_abn` | Check GST registration heuristics |
| `infer_category` | Determine category from name/industry/amount |
| `store_merchant_mapping` | Save to Cognee for future reference |
| `batch_resolve` | Batch process multiple merchants |

---

## 4. Cognee Merchant Memory

### Storage Methods

```typescript
// Store a new mapping
await cogneeClient.storeMerchantMapping(
  'SQ *COFFEE BEAN',        // abbreviated
  'The Coffee Bean Pty Ltd', // canonical
  '12345678901',             // ABN
  true,                      // GST registered
  'Food & Beverage',         // industry
  'Dining & Restaurants'     // category
);

// Look up a merchant
const result = await cogneeClient.lookupMerchant('SQ *COFFEE BEAN');
// → { found: true, canonical: 'The Coffee Bean Pty Ltd', gstRegistered: true, ... }

// Learn from user corrections
await cogneeClient.updateMerchantFromCorrection(
  'tx-123',
  'SQ *COFFEE BEAN',
  'Dining & Restaurants',
  'The Coffee Bean'
);

// Batch lookup
const results = await cogneeClient.batchLookupMerchants([
  'WOOLWORTHS', 'SQ *MYSTERY SHOP', 'STRIPE MERCHANT'
]);
```

### Datasets
- `merchant_mappings` — Canonical merchant name mappings
- `merchant_corrections` — User correction history for learning

### Continuous Learning
1. High-confidence categorizations (>= 0.8) automatically stored
2. User corrections update both local DB and Cognee
3. Re-categorization uses Cognee first for instant lookup

---

## 5. Transaction Enrichment Pipeline

### Flow
```
After Statement Parsing
    ↓
enrichmentService.enrichTransactions(transactionIds, userId)
    ↓
Stage 1: Merchant Intelligence
  - Resolve merchant names
  - Determine ABN/GST status
  - Store new mappings
    ↓
Stage 2: Category Application
  - Apply merchant-derived category
  - Fall back to memory pattern matching
    ↓
Stage 3: GST Calculation
  - Determine GST category per ATO rules
  - Calculate GST amount (1/11th)
  - Handle exemptions and exclusions
    ↓
Update transaction records
Emit SSE event: enrichment_complete
```

### Integration Point
The enrichment service integrates into `pipeline.ts` after transaction insertion. It can also be triggered manually via `enrichmentService.enrichUncategorized(userId)` for batch processing.

### Enrichment Status
- **enriched**: All 3 stages completed successfully
- **pending**: Awaiting processing
- **failed**: One or more stages failed
- **unknown**: Merchant not resolvable

---

## 6. BAS Dashboard Enhancement

### New Features
- **GST Breakdown Tab**: Visual bar charts showing GST distribution across G1, G2, G3, G10, G11
- **1A vs 1B Comparison**: Side-by-side GST collected vs credits with progress bars
- **BAS Pre-Fill Summary**: Compact summary ready for lodgement review
- **Net GST Indicator**: Header badge showing refund/payable status
- **Gold neumorphic design**: Consistent with app theme

### BAS Categories Displayed
| Label | Description | Color |
|-------|-------------|-------|
| G1 | Taxable Sales | Gold (#FFCC00) |
| G2 | Export Sales | Blue (#60A5FA) |
| G3 | GST-Free Sales | Green (#34D399) |
| G10 | Capital Purchases | Pink (#F472B6) |
| G11 | Non-Capital Purchases | Purple (#A78BFA) |

---

## 7. Configuration

### Agent Models
```typescript
// config.ts
AGENT_MODELS = {
  gst_calculator: 'claude-sonnet-4-5-20250929',    // Accuracy-critical
  merchant_intelligence: 'claude-haiku-4-5-20251001', // Speed-optimized
  transaction_categorizer: 'claude-haiku-4-5-20251001',
};
```

### Token Budgets
```typescript
AGENT_TOKEN_BUDGETS = {
  gst_calculator: { maxInputTokens: 30000, maxOutputTokens: 4000, maxToolCalls: 8 },
  merchant_intelligence: { maxInputTokens: 50000, maxOutputTokens: 8000, maxToolCalls: 15 },
};
```

### Feature Flags
```env
USE_CLAUDE_AGENTS=true
AGENT_MERCHANT_INTELLIGENCE=true
AGENT_GST_CALCULATOR=true
```

---

*Last updated: February 2026*
