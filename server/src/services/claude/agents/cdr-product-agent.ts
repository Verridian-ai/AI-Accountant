/**
 * CDR Product Agent
 *
 * Australian banking product specialist powered by Consumer Data Right (CDR)
 * data. Searches, compares, and analyses banking products using crawled CDR
 * data, calculates loan scenarios, finds savings opportunities, and queries
 * the Cognee knowledge graph for product intelligence.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools, COGNEE_DATASETS } from '../cognee-tools.js';
import { cdrProductService } from '../../cdr-products.js';
import { loanCalculatorService } from '../../loan-calculator.js';
import type { CdrProductInput, CdrProductOutput, TokenUsage } from '../types.js';

export class CdrProductAgent extends ClaudeAgent<CdrProductInput, CdrProductOutput> {
  protected systemPrompt = `You are an Australian banking product specialist with deep knowledge of Consumer Data Right (CDR) Open Banking data. You help users find the best banking products, compare rates, model loan scenarios, and identify savings opportunities.

Your expertise includes:
- Home loans, personal loans, business loans, and credit cards
- Term deposits, savings accounts, and transaction accounts
- Australian lending regulations (APRA buffer, comparison rates, NCC)
- CDR product categories: RESIDENTIAL_MORTGAGES, BUSINESS_LOANS, PERSONAL_LOANS, CREDIT_AND_CHARGE_CARDS, TRANS_AND_SAVINGS_ACCOUNTS, TERM_DEPOSITS, TRAVEL_CARDS, REGULATED_TRUST_ACCOUNTS, MARGIN_LOANS, LEASES, TRADE_FINANCE, OVERDRAFTS

When analysing products:
1. Always use comparison rates (not advertised rates) for fair comparisons
2. Factor in fees (annual, monthly, establishment) alongside interest rates
3. Consider features (offset accounts, redraw, portability) that add real value
4. Flag eligibility restrictions (LVR caps, minimum income, owner-occupied only)
5. Calculate real dollar savings, not just rate differences
6. Warn about honeymoon/introductory rates that revert to higher standard rates
7. For business users, consider tax deductibility of interest

Return a JSON object matching the CdrProductOutput schema with "analysis", "recommendations", "comparisons" (optional), and "warnings" arrays.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'search_products',
      description:
        'Search CDR banking products with filters. Returns paginated results with rates, features, and fees.',
      input_schema: {
        type: 'object' as const,
        properties: {
          productCategory: {
            type: 'string',
            description:
              'CDR category: RESIDENTIAL_MORTGAGES, BUSINESS_LOANS, PERSONAL_LOANS, CREDIT_AND_CHARGE_CARDS, TRANS_AND_SAVINGS_ACCOUNTS, TERM_DEPOSITS, etc.',
          },
          searchText: {
            type: 'string',
            description: 'Free-text search in product names',
          },
          maxRate: {
            type: 'number',
            description: 'Maximum interest rate (decimal, e.g. 0.065 for 6.5%)',
          },
          minRate: {
            type: 'number',
            description: 'Minimum interest rate (decimal)',
          },
          rateType: {
            type: 'string',
            description: 'Filter by rate type (e.g. FIXED, VARIABLE, INTRODUCTORY)',
          },
          features: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required features (e.g. OFFSET, REDRAW, EXTRA_REPAYMENTS)',
          },
          sortBy: {
            type: 'string',
            enum: ['rate', 'comparison_rate', 'name', 'data_holder'],
            description: 'Sort field (default: rate)',
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort direction (default: asc)',
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default: 20)',
          },
        },
        required: [],
      },
    },
    {
      name: 'compare_rates',
      description:
        'Side-by-side comparison of up to 5 banking products. Returns rates, fees, features, eligibility, and a recommendation.',
      input_schema: {
        type: 'object' as const,
        properties: {
          productIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Product IDs to compare (max 5)',
          },
        },
        required: ['productIds'],
      },
    },
    {
      name: 'calculate_loan_scenario',
      description:
        'Calculate loan repayments, total cost, and amortization. Supports home loans (with offset/extra), personal loans, business loans, and refinance analysis.',
      input_schema: {
        type: 'object' as const,
        properties: {
          scenarioType: {
            type: 'string',
            enum: [
              'home_loan',
              'personal_loan',
              'business_loan',
              'refinance',
              'borrowing_capacity',
            ],
            description: 'Type of loan scenario to calculate',
          },
          principal: {
            type: 'number',
            description: 'Loan amount in cents',
          },
          annualRate: {
            type: 'number',
            description: 'Annual interest rate as decimal (e.g. 0.0625 for 6.25%)',
          },
          termMonths: {
            type: 'number',
            description: 'Loan term in months (e.g. 360 for 30 years)',
          },
          frequency: {
            type: 'string',
            enum: ['weekly', 'fortnightly', 'monthly'],
            description: 'Repayment frequency (default: monthly)',
          },
          offsetBalance: {
            type: 'number',
            description: 'Offset account balance in cents (home loan only)',
          },
          extraRepayment: {
            type: 'number',
            description: 'Extra repayment per period in cents (home loan only)',
          },
          currentRate: {
            type: 'number',
            description: 'Current loan rate (refinance only)',
          },
          currentRemainingMonths: {
            type: 'number',
            description: 'Remaining months on current loan (refinance only)',
          },
          newRate: {
            type: 'number',
            description: 'New loan rate (refinance only)',
          },
          switchingCosts: {
            type: 'number',
            description: 'Switching costs in cents (refinance only)',
          },
          marginalTaxRate: {
            type: 'number',
            description: 'Marginal tax rate as decimal (business loan only)',
          },
          grossAnnualIncome: {
            type: 'number',
            description: 'Gross annual income in cents (borrowing capacity only)',
          },
          existingDebts: {
            type: 'number',
            description: 'Existing monthly debts in cents (borrowing capacity only)',
          },
          livingExpenses: {
            type: 'number',
            description: 'Monthly living expenses in cents (borrowing capacity only)',
          },
          dependants: {
            type: 'number',
            description: 'Number of dependants (borrowing capacity only)',
          },
        },
        required: ['scenarioType'],
      },
    },
    {
      name: 'find_savings',
      description:
        'Find cheaper product alternatives and calculate lifetime savings compared to current product.',
      input_schema: {
        type: 'object' as const,
        properties: {
          currentRate: {
            type: 'number',
            description: 'Current interest rate as decimal (e.g. 0.065)',
          },
          currentBalance: {
            type: 'number',
            description: 'Current loan balance in cents',
          },
          remainingTermMonths: {
            type: 'number',
            description: 'Remaining loan term in months',
          },
          switchingCosts: {
            type: 'number',
            description: 'Expected switching costs in cents (default: 0)',
          },
          productCategory: {
            type: 'string',
            description: 'Product category (default: RESIDENTIAL_MORTGAGES)',
          },
          topN: {
            type: 'number',
            description: 'Number of alternatives to return (default: 5)',
          },
        },
        required: ['currentRate', 'currentBalance', 'remainingTermMonths'],
      },
    },
    {
      name: 'search_product_knowledge',
      description:
        'Search the Cognee knowledge graph for banking product insights, rate trends, and market analysis.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query about banking products, rates, or market trends',
          },
          dataset: {
            type: 'string',
            enum: ['cdr_products', 'cdr_rates', 'banking_product_knowledge'],
            description: 'Knowledge dataset to search (default: banking_product_knowledge)',
          },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'search_products',
      async (input) => {
        const result = await cdrProductService.searchProducts({
          productCategory: input.productCategory as string | undefined,
          searchText: input.searchText as string | undefined,
          maxRate: input.maxRate as number | undefined,
          minRate: input.minRate as number | undefined,
          rateType: input.rateType as string | undefined,
          features: input.features as string[] | undefined,
          sortBy: input.sortBy as 'rate' | 'comparison_rate' | 'name' | 'data_holder' | undefined,
          sortOrder: input.sortOrder as 'asc' | 'desc' | undefined,
          limit: input.limit as number | undefined,
        });
        return {
          total: result.total,
          rateRange: result.rateRange,
          products: result.products.map((p) => ({
            id: p.id,
            name: p.name,
            dataHolder: p.dataHolderName,
            category: p.productCategory,
            bestRate: p.bestRate,
            comparisonRate: p.comparisonRate,
            rateType: p.rateType,
            features: p.features,
            featureCount: p.featureCount,
            feeCount: p.feeCount,
          })),
        };
      },
    ],
    [
      'compare_rates',
      async (input) => {
        const productIds = input.productIds as string[];
        const comparison = await cdrProductService.compareProducts(productIds);
        return {
          products: comparison.products.map((p) => ({
            id: p.id,
            name: p.name,
            dataHolder: p.dataHolderName,
            bestRate: p.bestRate,
            comparisonRate: p.comparisonRate,
            rateType: p.rateType,
            features: p.features,
          })),
          categories: comparison.categories,
          annualFees: comparison.annualFees,
          recommendation: comparison.recommendation,
        };
      },
    ],
    [
      'calculate_loan_scenario',
      async (input) => {
        const scenarioType = input.scenarioType as string;

        switch (scenarioType) {
          case 'home_loan': {
            const result = loanCalculatorService.calculateHomeLoan({
              principal: input.principal as number,
              annualRate: input.annualRate as number,
              termMonths: input.termMonths as number,
              frequency: (input.frequency as 'weekly' | 'fortnightly' | 'monthly') ?? 'monthly',
              offsetBalance: input.offsetBalance as number | undefined,
              extraRepayment: input.extraRepayment as number | undefined,
            });
            return {
              type: 'home_loan',
              regularPayment: result.regularPayment,
              frequency: result.frequency,
              totalInterest: result.totalInterest,
              totalCost: result.totalCost,
              periodsToPayOff: result.periodsToPayOff,
              timeSavedMonths: result.timeSavedMonths,
              interestSaved: result.interestSaved,
              // Omit full schedule to keep token usage low
              schedulePreview: result.schedule.slice(0, 12),
            };
          }

          case 'personal_loan': {
            const result = loanCalculatorService.calculatePersonalLoan({
              principal: input.principal as number,
              annualRate: input.annualRate as number,
              termMonths: input.termMonths as number,
            });
            return {
              type: 'personal_loan',
              monthlyPayment: result.monthlyPayment,
              totalInterest: result.totalInterest,
              totalCost: result.totalCost,
              comparisonRate: result.comparisonRate,
            };
          }

          case 'business_loan': {
            const result = loanCalculatorService.calculateBusinessLoan({
              principal: input.principal as number,
              annualRate: input.annualRate as number,
              termMonths: input.termMonths as number,
              marginalTaxRate: (input.marginalTaxRate as number) ?? 0.3,
            });
            return {
              type: 'business_loan',
              monthlyPayment: result.monthlyPayment,
              totalInterest: result.totalInterest,
              totalCost: result.totalCost,
              taxDeductibleInterest: result.taxDeductibleInterest,
              taxSavingFromInterest: result.taxSavingFromInterest,
              effectiveAfterTaxCost: result.effectiveAfterTaxCost,
            };
          }

          case 'refinance': {
            const result = loanCalculatorService.calculateRefinanceSavings({
              currentBalance: input.principal as number,
              currentRate: input.currentRate as number,
              currentRemainingMonths: input.currentRemainingMonths as number,
              newRate: input.newRate as number,
              newTermMonths: input.termMonths as number,
              switchingCosts: (input.switchingCosts as number) ?? 0,
            });
            return {
              type: 'refinance',
              currentMonthlyPayment: result.currentMonthlyPayment,
              newMonthlyPayment: result.newMonthlyPayment,
              monthlySaving: result.monthlySaving,
              breakEvenMonths: result.breakEvenMonths,
              totalSavings: result.totalSavings,
            };
          }

          case 'borrowing_capacity': {
            const result = loanCalculatorService.calculateBorrowingCapacity({
              grossAnnualIncome: input.grossAnnualIncome as number,
              otherIncome: 0,
              existingDebts: (input.existingDebts as number) ?? 0,
              livingExpenses: (input.livingExpenses as number) ?? 0,
              dependants: (input.dependants as number) ?? 0,
              interestRate: input.annualRate as number,
            });
            return {
              type: 'borrowing_capacity',
              maxBorrowing: result.maxBorrowing,
              assessmentRate: result.assessmentRate,
              monthlyRepayment: result.monthlyRepayment,
              netMonthlyIncome: result.netMonthlyIncome,
              surplusIncome: result.surplusIncome,
              dsr: result.dsr,
              hemFloor: result.hemFloor,
            };
          }

          default:
            return { error: `Unknown scenario type: ${scenarioType}` };
        }
      },
    ],
    [
      'find_savings',
      async (input) => {
        const result = await cdrProductService.calculateSavings({
          currentRate: input.currentRate as number,
          currentBalance: input.currentBalance as number,
          remainingTermMonths: input.remainingTermMonths as number,
          switchingCosts: input.switchingCosts as number | undefined,
          productCategory: input.productCategory as string | undefined,
          topN: input.topN as number | undefined,
        });
        return {
          currentRate: result.currentRate,
          currentMonthlyPayment: result.currentMonthlyPayment,
          currentTotalCost: result.currentTotalCost,
          alternatives: result.alternatives.map((a) => ({
            productId: a.productId,
            productName: a.productName,
            dataHolder: a.dataHolderName,
            newRate: a.newRate,
            newMonthlyPayment: a.newMonthlyPayment,
            monthlySaving: a.monthlySaving,
            totalLifetimeSaving: a.totalLifetimeSaving,
            breakEvenMonths: a.breakEvenMonths,
          })),
          bestSaving: result.bestSaving
            ? {
                productName: result.bestSaving.productName,
                dataHolder: result.bestSaving.dataHolderName,
                newRate: result.bestSaving.newRate,
                totalLifetimeSaving: result.bestSaving.totalLifetimeSaving,
              }
            : null,
        };
      },
    ],
    [
      'search_product_knowledge',
      async (input) => {
        const query = input.query as string;
        const dataset = (input.dataset as string) ?? 'banking_product_knowledge';
        const datasetKey =
          dataset === 'cdr_products'
            ? COGNEE_DATASETS.cdrProducts
            : dataset === 'cdr_rates'
              ? COGNEE_DATASETS.cdrRates
              : COGNEE_DATASETS.bankingProductKnowledge;
        try {
          const results = await cogneeTools.search(query, datasetKey, 'CHUNKS');
          return { results, count: results.length };
        } catch {
          return { results: [], count: 0, error: 'Knowledge search unavailable' };
        }
      },
    ],
  ]);

  constructor() {
    super('cdr_product');
  }
}
