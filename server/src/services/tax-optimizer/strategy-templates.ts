/**
 * Tax Optimizer — Strategy Template Definitions
 * 10 built-in strategy templates for Australian tax minimization.
 */

import { DEDUCTION_RATES } from '../tax-return.js';
import type { EntityType, StrategyContext } from './types.js';

/** Strategy template definitions */
export const STRATEGY_TEMPLATES: Array<{
  name: string;
  description: string;
  atoRulingRef?: string;
  applicableEntities: EntityType[];
  evaluate: (
    ctx: StrategyContext,
  ) => { savingCents: number; confidence: number; steps: string[] } | null;
}> = [
  {
    name: 'Prepay Deductible Expenses',
    description:
      'Bring forward up to 12 months of deductible expenses (rent, insurance, subscriptions) into the current financial year to reduce taxable income.',
    atoRulingRef: 'TR 93/31',
    applicableEntities: ['sole_trader', 'personal', 'company', 'trust'],
    evaluate: (ctx) => {
      const prepayableCents = Math.round(ctx.taxReturn.totalDeductionsCents * 0.05);
      if (prepayableCents < 50_000) return null;
      const savingCents = Math.round(prepayableCents * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.7,
        steps: [
          'Identify recurring expenses due in July-September (rent, insurance, subscriptions)',
          'Arrange payment before June 30 for up to 12 months ahead',
          'Ensure each prepayment is under $1,000 or applies to a period <= 12 months',
        ],
      };
    },
  },
  {
    name: 'Superannuation Top-Up',
    description:
      'Make a personal concessional super contribution up to the $27,500 cap. Contributions are taxed at 15% inside super instead of your marginal rate.',
    atoRulingRef: 'SIS Act s.291-20',
    applicableEntities: ['sole_trader', 'personal'],
    evaluate: (ctx) => {
      if (ctx.marginalRate <= 0.16) return null;
      const estimatedEmployerSuperCents = Math.round(ctx.taxReturn.grossIncomeCents * 0.115);
      const remainingCapCents = Math.max(
        0,
        DEDUCTION_RATES.superContributionCapCents - estimatedEmployerSuperCents,
      );
      if (remainingCapCents < 100_000) return null;
      const taxSavedCents = Math.round(remainingCapCents * (ctx.marginalRate - 0.15));
      return {
        savingCents: taxSavedCents,
        confidence: 0.85,
        steps: [
          "Check your super fund's year-to-date contributions",
          `Contribute up to $${(remainingCapCents / 100).toLocaleString()} as a personal concessional contribution`,
          'Submit a Notice of Intent to claim to your super fund before lodging your return',
          'Receive acknowledgement from fund before claiming the deduction',
        ],
      };
    },
  },
  {
    name: 'Instant Asset Write-Off',
    description:
      'Immediately deduct the cost of business assets under $20,000 instead of depreciating over time.',
    atoRulingRef: 'ITAA97 s.328-180',
    applicableEntities: ['sole_trader', 'company', 'trust'],
    evaluate: (ctx) => {
      if (ctx.entityType === 'personal' || ctx.entityType === 'smsf') return null;
      const equipmentCents = Math.abs(ctx.taxReturn.breakdown['Equipment & Tools'] ?? 0);
      if (equipmentCents < 10_000) return null;
      const eligibleCents = Math.min(equipmentCents, DEDUCTION_RATES.instantWriteOffThreshold);
      const savingCents = Math.round(eligibleCents * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.6,
        steps: [
          'Identify business assets purchased for under $20,000 each',
          'Ensure assets are installed and ready for use before June 30',
          'Claim the full cost as a deduction in the current year',
        ],
      };
    },
  },
  {
    name: 'Income Splitting via Trust',
    description:
      'Distribute trust income to beneficiaries in lower tax brackets to reduce the overall family tax burden.',
    applicableEntities: ['trust'],
    evaluate: (ctx) => {
      if (ctx.entityType !== 'trust') return null;
      if (ctx.taxReturn.taxableIncomeCents < 4_500_000) return null;
      const savingCents = Math.round(ctx.taxReturn.taxableIncomeCents * 0.14 * 0.5);
      return {
        savingCents,
        confidence: 0.5,
        steps: [
          'Review trust deed for distribution powers',
          'Ensure beneficiaries are adults with lower marginal rates',
          'Make distribution resolution before June 30',
          'Ensure distributions are genuine (Section 100A compliance)',
        ],
      };
    },
  },
  {
    name: 'Motor Vehicle Deduction (Cents/km)',
    description:
      'Claim 85 cents per km for work-related travel, up to 5,000 km per year ($4,250 max deduction).',
    atoRulingRef: 'TD 2024/4',
    applicableEntities: ['sole_trader', 'personal'],
    evaluate: (ctx) => {
      const existingMotor = Math.abs(ctx.taxReturn.breakdown['Motor Vehicle Expenses'] ?? 0);
      if (existingMotor > 0) return null;
      const maxDeductionCents =
        DEDUCTION_RATES.motorVehicleMaxKm * DEDUCTION_RATES.motorVehicleCentsPerKm;
      const savingCents = Math.round(maxDeductionCents * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.4,
        steps: [
          'Track work-related kilometres driven (up to 5,000 km)',
          'Keep a logbook or records of work trips',
          'Claim at 85 cents per kilometre on your tax return',
        ],
      };
    },
  },
  {
    name: 'Work From Home Deduction',
    description:
      'Claim $0.67 per hour for working from home. Requires a record of hours worked from home.',
    atoRulingRef: 'PCG 2023/1',
    applicableEntities: ['personal', 'sole_trader'],
    evaluate: (ctx) => {
      const existingWfh = Math.abs(ctx.taxReturn.breakdown['_wfhDeductionCents'] ?? 0);
      if (existingWfh > 0) return null;
      const estimatedHours = 20 * 48;
      const deductionCents = estimatedHours * DEDUCTION_RATES.wfhHourlyRate;
      const savingCents = Math.round(deductionCents * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.5,
        steps: [
          'Maintain a timesheet or diary of hours worked from home',
          'Ensure you have a dedicated workspace',
          `Claim $0.67/hour x estimated ${estimatedHours} hours = $${(deductionCents / 100).toFixed(2)}`,
        ],
      };
    },
  },
  {
    name: 'Salary Sacrifice to Super',
    description:
      'Arrange with employer to sacrifice pre-tax salary into super, reducing taxable income. Contributions taxed at 15% in super.',
    applicableEntities: ['personal'],
    evaluate: (ctx) => {
      if (ctx.entityType !== 'personal') return null;
      if (ctx.marginalRate <= 0.16) return null;
      const sacrificeAmountCents = Math.min(500_000, ctx.taxReturn.grossIncomeCents * 0.1);
      const savingCents = Math.round(sacrificeAmountCents * (ctx.marginalRate - 0.15));
      if (savingCents < 10_000) return null;
      return {
        savingCents,
        confidence: 0.75,
        steps: [
          'Check total super contributions YTD (employer + personal) against $27,500 cap',
          'Arrange salary sacrifice with employer via payroll',
          'Ensure arrangement is documented before income is earned',
        ],
      };
    },
  },
  {
    name: 'CGT 50% Discount',
    description:
      'Hold capital assets for more than 12 months to qualify for a 50% CGT discount on gains.',
    atoRulingRef: 'ITAA97 Div.115',
    applicableEntities: ['sole_trader', 'personal', 'trust'],
    evaluate: (ctx) => {
      if (ctx.entityType === 'company' || ctx.entityType === 'smsf') return null;
      const dividendCents = Math.abs(ctx.taxReturn.breakdown['Dividend Income'] ?? 0);
      if (dividendCents < 100_000) return null;
      const savingCents = Math.round(dividendCents * 0.5 * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.4,
        steps: [
          'Review portfolio for assets held less than 12 months',
          'Consider deferring sales until the 12-month holding period is met',
          'The 50% discount applies automatically for eligible assets',
        ],
      };
    },
  },
  {
    name: 'Negative Gearing',
    description: 'Offset investment property losses against other income to reduce taxable income.',
    applicableEntities: ['personal', 'sole_trader', 'trust'],
    evaluate: (ctx) => {
      const rentalIncome = ctx.taxReturn.breakdown['Rental Income'] ?? 0;
      const interestExpense = Math.abs(ctx.taxReturn.breakdown['Interest Expense'] ?? 0);
      if (rentalIncome <= 0 || interestExpense <= 0) return null;
      if (interestExpense <= rentalIncome) return null;
      const lossOffsetCents = interestExpense - rentalIncome;
      const savingCents = Math.round(lossOffsetCents * ctx.marginalRate);
      return {
        savingCents,
        confidence: 0.65,
        steps: [
          'Ensure all property expenses are claimed (interest, depreciation, repairs)',
          'Net rental loss offsets other income (salary, business)',
          'Keep detailed records of all property income and expenses',
        ],
      };
    },
  },
  {
    name: 'HELP Debt Minimization',
    description:
      'Manage income to stay below HELP repayment thresholds, or make voluntary repayments to reduce compulsory amounts.',
    atoRulingRef: 'HTAA s.154-10',
    applicableEntities: ['personal'],
    evaluate: (ctx) => {
      if (ctx.entityType !== 'personal') return null;
      const taxableIncomeDollars = ctx.taxReturn.taxableIncomeCents / 100;
      if (taxableIncomeDollars < 49_435 || taxableIncomeDollars > 170_000) return null;
      const savingCents = Math.round(200_000 * 0.01);
      if (savingCents < 5_000) return null;
      return {
        savingCents,
        confidence: 0.35,
        steps: [
          'Check your HELP balance via myGov',
          'Consider salary sacrificing to reduce repayment income',
          'Voluntary repayments of $500+ receive no benefit but reduce balance faster',
        ],
      };
    },
  },
];
