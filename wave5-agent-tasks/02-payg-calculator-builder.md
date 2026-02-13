# Agent 2: PAYG Calculator Builder

## Role
Build the PAYG withholding calculation engine implementing ATO FY2024-25 tax tables for resident, non-resident, and working holiday maker employees.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/payroll/payg-calculator.ts`
**Purpose**: Standalone PAYG withholding calculator implementing ATO Schedule 1 FY2024-25 tax tables
**Pattern**: Pure calculation service — no DB dependencies, fully unit-testable

```typescript
/**
 * ATO FY2024-25 PAYG Withholding Calculator
 *
 * Implements Schedule 1 — Statement of formulas for calculating amounts
 * to be withheld from weekly, fortnightly, and monthly payments.
 *
 * All monetary values are in CENTS (integers) to avoid floating-point errors.
 */

export interface PAYGInput {
  grossEarningsCents: number;       // Gross pay for the period (cents)
  payFrequency: 'weekly' | 'fortnightly' | 'monthly';
  residencyStatus: 'resident' | 'non_resident' | 'working_holiday';
  claimTaxFreeThreshold: boolean;   // From TFN declaration
  hasHELPDebt: boolean;             // HECS-HELP/VET-FEE-HELP
  hasSFSSDebt: boolean;             // Student Financial Supplement Scheme
  medicareLevyExemption: 'none' | 'full' | 'half';
  taxOffsetClaimed?: number;        // Annual tax offset in cents (e.g., seniors)
}

export interface PAYGResult {
  grossEarningsCents: number;
  taxWithheldCents: number;
  medicareLevyCents: number;
  helpRepaymentCents: number;
  sfssRepaymentCents: number;
  totalWithheldCents: number;
  effectiveRate: number;            // As decimal (e.g., 0.325 = 32.5%)
  annualisedGrossCents: number;
  breakdown: {
    baseTaxCents: number;
    marginalRate: number;
    bracket: string;
  };
}
```

**Implementation requirements:**

> **REVISION NOTE (D02 COMP-03, D01 DC-08):** Tax tables MUST NOT be hardcoded in source code.
> Instead, define tax brackets as a **configurable data structure** loaded from a `tax-tables.ts`
> configuration file (or database table in a future wave). The calculator must accept a
> `financialYear` parameter and select the correct bracket set. Store brackets as an array of
> `{ min: number, max: number, baseTax: number, rate: number }` objects keyed by FY string
> (e.g., `'2024-25'`). This allows updating rates each July without code changes.
> Super guarantee rate must also be configurable (not hardcoded 11.5%) — import from config.
> Default FY should be determined from the pay date, not the build date.

- [ ] **Resident tax brackets (FY2024-25)**:
  | Annual Taxable Income | Base Tax | Marginal Rate |
  |---|---|---|
  | $0 – $18,200 | $0 | 0% |
  | $18,201 – $45,000 | $0 | 16% |
  | $45,001 – $135,000 | $4,288 | 30% |
  | $135,001 – $190,000 | $31,288 | 37% |
  | $190,001+ | $51,638 | 45% |

- [ ] **Medicare Levy**: 2% of taxable income above $24,276 threshold (phase-in from $24,276 to $30,345)
  - Full exemption: $0
  - Half exemption: 1% instead of 2%
  - Phase-in rate: 10% of excess over $24,276 (until reaching 2% of total)

- [ ] **HELP/HECS repayment rates (FY2024-25)**:
  | Repayment Income | Rate |
  |---|---|
  | Below $51,550 | 0% |
  | $51,550 – $59,518 | 1% |
  | $59,519 – $63,089 | 2% |
  | $63,090 – $66,875 | 2.5% |
  | $66,876 – $70,888 | 3% |
  | $70,889 – $75,140 | 3.5% |
  | $75,141 – $79,649 | 4% |
  | $79,650 – $84,429 | 4.5% |
  | $84,430 – $89,494 | 5% |
  | $89,495 – $94,865 | 5.5% |
  | $94,866 – $100,557 | 6% |
  | $100,558 – $106,590 | 6.5% |
  | $106,591 – $112,985 | 7% |
  | $112,986 – $119,764 | 7.5% |
  | $119,765 – $126,950 | 8% |
  | $126,951 – $134,568 | 8.5% |
  | $134,569 – $142,642 | 9% |
  | $142,643 – $151,200 | 9.5% |
  | $151,201+ | 10% |

- [ ] **Non-resident tax brackets (no tax-free threshold)**:
  | Annual Taxable Income | Base Tax | Marginal Rate |
  |---|---|---|
  | $0 – $135,000 | $0 | 30% |
  | $135,001 – $190,000 | $40,500 | 37% |
  | $190,001+ | $60,850 | 45% |

- [ ] **Working holiday maker (Subclass 417/462)**:
  | Annual Taxable Income | Rate |
  |---|---|
  | $0 – $45,000 | 15% |
  | $45,001 – $135,000 | 30% |
  | $135,001 – $190,000 | 37% |
  | $190,001+ | 45% |

- [ ] **Annualisation logic**: Convert period earnings to annual for bracket lookup, then convert result back to period amount. Round to nearest cent.

- [ ] **Export functions**:
  - `calculatePAYG(input: PAYGInput): PAYGResult`
  - `annualiseEarnings(periodCents: number, frequency: PayFrequency): number`
  - `deannualiseAmount(annualCents: number, frequency: PayFrequency): number`
  - `calculateMedicareLevy(annualIncomeCents: number, exemption: MedicareLevyExemption): number`
  - `calculateHELPRepayment(annualIncomeCents: number): number`
  - `getTaxBrackets(financialYear: string, residencyStatus: string): TaxBracket[]` — Load brackets from config
  - `getSuperRate(financialYear: string): number` — Load super rate from config (11.5% for FY2024-25, 12% for FY2025-26)

- [ ] **Configurable Tax Tables file** — Create `server/src/services/payroll/tax-tables.ts`:
  - Export `TAX_BRACKETS: Record<string, Record<ResidencyStatus, TaxBracket[]>>`
  - Export `SUPER_RATES: Record<string, number>` (e.g., `{ '2024-25': 0.115, '2025-26': 0.12 }`)
  - Export `MEDICARE_THRESHOLDS: Record<string, { low: number, high: number }>`
  - Export `HELP_REPAYMENT_RATES: Record<string, { min: number, rate: number }[]>`
  - Include FY2024-25 data as default; structure supports easy addition of future FYs
  - **REVISION NOTE**: This file is the single source of truth for tax rates. To update for a new FY, add a new key — no calculator logic changes needed.

- [ ] **Test cases embedded as comments**:
  - $80,000 annual salary, fortnightly: Tax = ~$14,788 + Medicare $1,600 = ~$16,388/year → ~$630.31/fortnight
  - $50,000 annual, resident, tax-free: Tax = ~$768 + Medicare $1,000 = $1,768/year
  - $200,000 annual: Tax = ~$56,138 + Medicare $4,000 = ~$60,138/year

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] PAYG calculation for $80,000 salary matches ATO tables (within $1 rounding)
- [ ] Medicare levy correctly applies phase-in for incomes $24,276–$30,345
- [ ] HELP repayment rates match ATO FY2024-25 schedule
- [ ] Non-resident rates apply correctly (no tax-free threshold, no Medicare)
- [ ] Working holiday maker rates apply correctly (15% flat to $45k)
- [ ] All monetary values are INTEGER cents — no floating point math for money
- [ ] Create marker file: `.agent-done-W05-02`

## Files to CREATE (additional)

### 2. `server/src/services/payroll/tax-tables.ts`
**Purpose**: Configurable FY-keyed tax bracket and rate data (REVISION NOTE: D02 COMP-03)

## Dependencies
- **None** — pure calculation module, can start immediately
- **No DB access** — takes input, returns output
- **No external imports** beyond TypeScript types
