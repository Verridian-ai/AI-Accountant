# Agent 4: Award Interpreter

## Role
Build the Modern Award interpretation service that manages award definitions, rate lookups by classification/level, and applies casual loading and overtime multipliers according to Australian Fair Work standards.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payroll/award-service.ts`
**Purpose**: Modern Award rate management and interpretation

**Class**: `AwardService`
**Constructor**: `constructor(private db: any)`

**Interfaces**:

```typescript
interface AwardInput {
  userId: string;
  name: string;
  code?: string;
  effectiveDate: string;
  expiryDate?: string;
}

interface AwardRateInput {
  awardId: string;
  classification: string;
  level: string;
  hourlyRate: number;        // cents
  casualLoading?: number;    // decimal, default 0.25 (25%)
  overtimeMultiplier?: number; // decimal, default 1.5
  effectiveDate: string;
}

interface RateLookupResult {
  awardName: string;
  classification: string;
  level: string;
  baseRateCents: number;     // base hourly rate in cents
  casualRateCents: number;   // base × (1 + casualLoading)
  overtime1Cents: number;    // base × overtimeMultiplier (first 2 hours)
  overtime2Cents: number;    // base × 2.0 (after 2 hours)
  effectiveDate: string;
}

interface CalculatePayInput {
  awardId: string;
  classification: string;
  level: string;
  ordinaryHours: number;
  overtimeHours1?: number;  // first 2 hours overtime
  overtimeHours2?: number;  // overtime beyond 2 hours
  isCasual: boolean;
  effectiveDate?: string;   // for historical rate lookups
}

interface CalculatePayResult {
  ordinaryPayCents: number;
  casualLoadingCents: number;
  overtime1Cents: number;
  overtime2Cents: number;
  totalCents: number;
  breakdown: Array<{
    category: string;
    hours: number;
    rateCents: number;
    amountCents: number;
  }>;
}
```

**Methods**:

- [ ] **`createAward(input: AwardInput): Promise<Award>`**
  - Inserts new award record
  - Generates UUID for ID
  - Returns created award

- [ ] **`listAwards(userId: string): Promise<Award[]>`**
  - Returns all awards for user, ordered by name
  - Only active awards (isActive = 1)

- [ ] **`getAwardRates(awardId: string): Promise<AwardRate[]>`**
  - Returns all rates for an award, ordered by classification then level

- [ ] **`addAwardRate(input: AwardRateInput): Promise<AwardRate>`**
  - Inserts new rate for an award
  - Validates hourlyRate > 0
  - Default casualLoading: 0.25 (25%)
  - Default overtimeMultiplier: 1.5
  - Returns created rate

- [ ] **`lookupRate(awardId: string, classification: string, level: string, effectiveDate?: string): Promise<RateLookupResult>`**
  - Finds the applicable rate for the classification/level
  - If effectiveDate provided, finds the rate effective on that date (most recent effectiveDate <= target)
  - Calculates derived rates:
    - `casualRateCents = baseRateCents × (1 + casualLoading)` — e.g., $25.00 × 1.25 = $31.25
    - `overtime1Cents = baseRateCents × overtimeMultiplier` — e.g., $25.00 × 1.5 = $37.50
    - `overtime2Cents = baseRateCents × 2.0` — always double time after 2 hours
  - Throws if no matching rate found

- [ ] **`calculatePay(input: CalculatePayInput): Promise<CalculatePayResult>`**
  - Looks up applicable rate
  - Calculates pay for each component:
    - Ordinary: `ordinaryHours × baseRate` (or `casualRate` if isCasual)
    - Casual loading: separately calculated as `ordinaryHours × (casualRate - baseRate)` (only if isCasual)
    - Overtime Tier 1: `overtimeHours1 × overtime1Rate`
    - Overtime Tier 2: `overtimeHours2 × overtime2Rate`
  - All amounts in cents (INTEGER arithmetic, round to nearest cent)
  - Returns total and breakdown

- [ ] **`seedDefaultAwards(userId: string): Promise<void>`**
  - Seeds 3 common Modern Awards if none exist for user:
    1. **Clerks-Private Sector Award 2020** (MA000002)
       - Level 1: $24.73/hr, Level 2: $25.35/hr, Level 3: $26.37/hr, Level 4: $27.17/hr, Level 5: $28.25/hr
    2. **General Retail Industry Award 2020** (MA000004)
       - Level 1: $24.73/hr, Level 2: $25.35/hr, Level 3: $26.37/hr
    3. **Manufacturing and Associated Industries Award 2020** (MA000010)
       - C14: $24.73/hr, C13: $25.35/hr, C12: $26.37/hr, C11: $27.17/hr, C10: $28.25/hr
  - All rates with casualLoading: 0.25, overtimeMultiplier: 1.5
  - Effective date: 2024-07-01

## Verification
- [ ] Casual loading correctly applies 25% on top of base rate
- [ ] Overtime multipliers: 1.5x for first 2 hours, 2.0x thereafter
- [ ] Rate lookup respects effective dates (most recent applicable rate)
- [ ] All monetary calculations use INTEGER cents arithmetic
- [ ] Seed data creates 3 awards with correct rate structures
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-04`

## Dependencies
- **Agent 1**: Schema tables must exist (awards, award_rates)
- **Coordination rule**: Only Agent 4 creates this service file
