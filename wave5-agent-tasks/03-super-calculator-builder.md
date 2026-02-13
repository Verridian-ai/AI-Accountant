# Agent 3: Super Calculator Builder

## Role
Build the superannuation guarantee calculator implementing the 11.5% SG rate on ordinary time earnings (OTE), maximum super base, and salary sacrifice support.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/payroll/super-calculator.ts`
**Purpose**: Standalone superannuation guarantee calculator for FY2024-25
**Pattern**: Pure calculation service — no DB dependencies, fully unit-testable

```typescript
/**
 * Australian Superannuation Guarantee Calculator (FY2024-25)
 *
 * SG Rate: 11.5% of ordinary time earnings (OTE)
 * Maximum quarterly super base: $65,070 (annual: $260,280)
 * Minimum payment threshold: $0 (removed 1 July 2022 — all employees eligible)
 *
 * All monetary values in CENTS (integers).
 */

export interface SuperInput {
  ordinaryTimeEarningsCents: number;  // OTE for the period (cents)
  payFrequency: 'weekly' | 'fortnightly' | 'monthly';
  salarySacrificeCents?: number;      // Pre-tax salary sacrifice (cents)
  employmentType: 'full_time' | 'part_time' | 'casual' | 'contractor';
  isUnder18?: boolean;                // Under 18 with <30hrs/week → exempt
  hoursPerWeek?: number;              // Needed for under-18 check
}

export interface SuperResult {
  sgAmountCents: number;              // Employer SG contribution (cents)
  sgRate: number;                     // Current SG rate (0.115)
  salarySacrificeCents: number;       // Employee salary sacrifice (cents)
  totalSuperCents: number;            // SG + salary sacrifice (cents)
  oteCappedCents: number;             // OTE after max base cap
  wasOTECapped: boolean;              // True if OTE exceeded max base
  maxQuarterlyBaseCents: number;      // $65,070 in cents
  isExempt: boolean;                  // True if exempt from SG
  exemptReason?: string;              // Reason for exemption
}
```

**Implementation requirements:**

- [ ] **SG Rate**: 11.5% (FY2024-25, effective 1 July 2024)
  - Previous year was 11% (FY2023-24)
  - Rate increases 0.5% annually until reaching 12% in FY2025-26

- [ ] **Ordinary Time Earnings (OTE)** definition:
  - Includes: base salary, shift loading, commissions, paid leave, allowances
  - Excludes: overtime, one-off bonuses, termination payments
  - The `ordinaryTimeEarningsCents` input should already have OTE calculated

- [ ] **Maximum Super Contribution Base**:
  - Quarterly maximum: $65,070 (FY2024-25)
  - Annual maximum: $260,280
  - If OTE exceeds quarterly cap, SG is calculated on the cap only
  - Convert quarterly cap to period amount for weekly/fortnightly/monthly comparison

- [ ] **Exemptions**:
  - Under 18 years old AND works fewer than 30 hours per week → exempt
  - Contractors (ABN invoicing) → exempt (but flag for awareness)
  - Minimum $450/month threshold was **removed** from 1 July 2022 — all employees eligible regardless of earnings

- [ ] **Salary Sacrifice**:
  - Salary sacrifice reduces gross pay but does NOT reduce OTE for SG purposes
  - SG is still calculated on pre-sacrifice OTE
  - Total super = SG amount + salary sacrifice amount
  - Salary sacrifice counts toward the concessional contributions cap ($30,000/year FY2024-25)

- [ ] **Export functions**:
  - `calculateSuper(input: SuperInput): SuperResult`
  - `getQuarterlyMaxBase(financialYear?: string): number` — returns max base in cents
  - `getSGRate(financialYear?: string): number` — returns rate as decimal
  - `isExemptFromSG(employmentType: string, isUnder18: boolean, hoursPerWeek: number): { exempt: boolean; reason?: string }`
  - `periodToQuarterlyOTE(periodCents: number, frequency: PayFrequency): number`

- [ ] **Test cases**:
  - $80,000 OTE annual → SG = $9,200/year ($80,000 × 11.5%)
  - $300,000 OTE annual → SG = $29,958 (capped at $260,280 × 11.5%)
  - $30,000 OTE + $5,000 salary sacrifice → SG = $3,450 (on $30,000, not $25,000)
  - Under 18, 20hrs/week → exempt, SG = $0
  - Under 18, 35hrs/week → NOT exempt, SG calculated normally

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] SG rate is exactly 11.5% (0.115)
- [ ] $80,000 OTE → $9,200 super (within $1 rounding)
- [ ] OTE cap correctly limits SG when earnings exceed $65,070/quarter
- [ ] Salary sacrifice does not reduce OTE for SG calculation
- [ ] Under-18 exemption logic works correctly (both exempt and non-exempt cases)
- [ ] All monetary values are INTEGER cents
- [ ] Create marker file: `.agent-done-W05-03`

## Dependencies
- **None** — pure calculation module, can start immediately
- **No DB access** — takes input, returns output
