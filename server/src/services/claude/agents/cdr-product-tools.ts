/**
 * CDR Product Agent tool definitions — Anthropic tool schemas and system prompt.
 *
 * Extracted from cdr-product-agent.ts to comply with the 300-line enterprise standard.
 */

import Anthropic from '@anthropic-ai/sdk';

export const CDR_PRODUCT_SYSTEM_PROMPT = `You are an Australian banking product specialist with deep knowledge of Consumer Data Right (CDR) Open Banking data. You help users find the best banking products, compare rates, model loan scenarios, and identify savings opportunities.

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

export const CDR_PRODUCT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
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
        searchText: { type: 'string', description: 'Free-text search in product names' },
        maxRate: {
          type: 'number',
          description: 'Maximum interest rate (decimal, e.g. 0.065 for 6.5%)',
        },
        minRate: { type: 'number', description: 'Minimum interest rate (decimal)' },
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
        limit: { type: 'number', description: 'Max results to return (default: 20)' },
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
          enum: ['home_loan', 'personal_loan', 'business_loan', 'refinance', 'borrowing_capacity'],
          description: 'Type of loan scenario to calculate',
        },
        principal: { type: 'number', description: 'Loan amount in cents' },
        annualRate: {
          type: 'number',
          description: 'Annual interest rate as decimal (e.g. 0.0625 for 6.25%)',
        },
        termMonths: { type: 'number', description: 'Loan term in months (e.g. 360 for 30 years)' },
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
        currentRate: { type: 'number', description: 'Current loan rate (refinance only)' },
        currentRemainingMonths: {
          type: 'number',
          description: 'Remaining months on current loan (refinance only)',
        },
        newRate: { type: 'number', description: 'New loan rate (refinance only)' },
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
        currentBalance: { type: 'number', description: 'Current loan balance in cents' },
        remainingTermMonths: { type: 'number', description: 'Remaining loan term in months' },
        switchingCosts: {
          type: 'number',
          description: 'Expected switching costs in cents (default: 0)',
        },
        productCategory: {
          type: 'string',
          description: 'Product category (default: RESIDENTIAL_MORTGAGES)',
        },
        topN: { type: 'number', description: 'Number of alternatives to return (default: 5)' },
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
