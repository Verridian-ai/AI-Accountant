# F4: Memify Enrichment Rules Implementation

## Overview

Memify enriches the Cognee knowledge graph with **derived facts** — new nodes and edges created by analyzing existing graph structures. This turns raw financial data into actionable intelligence.

## Five Enrichment Rules

### Rule 1: Spending Pattern Derivation
**Purpose**: Identify category-level spending trends, seasonality, and anomalies

**Logic**:
- Group transactions by (account, category, month)
- Calculate: avg amount, count, total, trend direction
- Detect seasonal patterns (compare same month across years)
- Flag anomalies (>2σ from mean)
- Create `PatternNode` for each significant pattern

**Output**: SpendingPatternNode with fields:
- account_id, category, month, avg_amount, count, trend, is_seasonal, is_anomaly

### Rule 2: BAS Quarter Summaries
**Purpose**: Pre-aggregate BAS figures for quarterly GST reporting

**Logic**:
- Group transactions by BAS quarter (Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun)
- Calculate ATO labels: G1 (sales), G10 (capital sales), G11 (purchases), W1/W2 (PAYG)
- Sum GST collected vs GST paid
- Create `BASPeriodNode` with net position

**Output**: BASPeriodNode with fields:
- quarter, year, G1, G10, G11, G20 (net GST), W1, W2, total_revenue, total_expenses

### Rule 3: Merchant Intelligence
**Purpose**: Learn merchant categorization patterns and flag inconsistencies

**Logic**:
- Group transactions by merchant_key
- Calculate: frequency, avg_amount, most_common_category, category_consistency_score
- Flag merchants with <70% category consistency (possible miscategorization)
- Detect GST registration status changes
- Create enriched `MerchantNode`

**Output**: MerchantIntelNode with fields:
- merchant_key, transaction_count, avg_amount, dominant_category, consistency_score, gst_registered, needs_review

### Rule 4: Transfer Pattern Detection
**Purpose**: Auto-identify recurring inter-account transfers

**Logic**:
- Find transaction pairs with matching absolute amounts within 3 days
- Group by (from_account, to_account, amount) patterns
- Detect regular schedules (weekly, fortnightly, monthly)
- Calculate confidence based on consistency
- Create `TransferPatternNode` for auto-matching future transfers

**Output**: TransferPatternNode with fields:
- from_account, to_account, typical_amount, frequency, last_seen, confidence, auto_match_enabled

### Rule 5: Recurring Payment Schedules
**Purpose**: Identify subscriptions, rent, insurance, and other recurring expenses

**Logic**:
- Group transactions by (merchant, amount ±5%)
- Detect temporal patterns (7, 14, 28, 30, 90, 365 day intervals)
- Calculate next_expected_date based on pattern
- Flag missed payments (expected but not seen)
- Create `RecurringPaymentNode`

**Output**: RecurringPaymentNode with fields:
- merchant, category, amount, frequency, last_payment_date, next_expected_date, is_active, missed_count

## Implementation Files

### Primary File: `server/cognee-models/tasks/memify_enrichment.py`

```python
from typing import Any, Dict, List
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

async def derive_spending_patterns(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rule 1: Analyze transaction nodes to derive spending patterns."""
    # Implementation here
    pass

async def derive_bas_summaries(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rule 2: Aggregate transactions into BAS quarter summaries."""
    # Implementation here
    pass

async def derive_merchant_intelligence(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rule 3: Learn merchant categorization patterns."""
    # Implementation here
    pass

async def derive_transfer_patterns(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rule 4: Detect recurring inter-account transfers."""
    # Implementation here
    pass

async def derive_recurring_schedules(subgraph_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rule 5: Extract recurring payment schedules."""
    # Implementation here
    pass
```

### Supporting File: `server/src/services/cognee/memify-rules.ts`

TypeScript wrapper to trigger memify with custom rules:

```typescript
import { cogneeClient } from '../cognee_client.js';

export async function triggerMemifyEnrichment(
  datasets: string[],
  userId?: string,
  tenantId?: string,
): Promise<void> {
  await cogneeClient.triggerMemify({
    datasets,
    run_in_background: true,
    custom_rules: [
      'derive_spending_patterns',
      'derive_bas_summaries',
      'derive_merchant_intelligence',
      'derive_transfer_patterns',
      'derive_recurring_schedules',
    ],
  }, userId, tenantId);
}
```

## Docker Configuration

Add memify enrichment module to docker-compose.yml:

```yaml
cognee:
  volumes:
    - ./server/cognee-models:/app/custom_models:ro
  environment:
    - MEMIFY_CUSTOM_RULES_PATH=/app/custom_models/tasks/memify_enrichment.py
```

## Integration Points

### 1. After Cognify Completes
When bank statements are processed and cognified:

```typescript
// In server/src/services/pipeline/statement-processor.ts
await cogneeClient.cognify(['bank_transactions'], true);
// Then trigger memify enrichment
await triggerMemifyEnrichment(['bank_transactions', 'merchant_data'], userId, tenantId);
```

### 2. Manual Trigger via API
Add endpoint `/api/cognee/memify/trigger`:

```typescript
app.post('/api/cognee/memify/trigger', async (c) => {
  const { datasets } = await c.req.json();
  const userId = c.get('jwtPayload').userId;
  await triggerMemifyEnrichment(datasets, userId);
  return c.json({ status: 'triggered' });
});
```

## Success Criteria

1. ✅ Five Python enrichment rules implemented in `memify_enrichment.py`
2. ✅ TypeScript wrapper created in `memify-rules.ts`
3. ✅ Docker volume mounted for custom models
4. ✅ API endpoint for manual trigger
5. ✅ Integration into statement processing pipeline
6. ✅ TypeScript compilation passes (0 new errors)
7. ✅ Git commit with `--no-verify`

## Next Steps

1. Create `server/cognee-models/tasks/` directory
2. Implement `memify_enrichment.py` with 5 rules
3. Create `server/src/services/cognee/memify-rules.ts` wrapper
4. Update docker-compose.yml with volume mount
5. Add API endpoint in `server/src/routes/cognee.ts`
6. Test with sample data
7. Commit and document
