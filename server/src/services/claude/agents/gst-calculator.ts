/**
 * GSTCalculator Agent
 *
 * Calculates GST obligations, generates BAS labels, and identifies
 * GST-relevant transaction categories per ATO rules.
 *
 * Enhanced with comprehensive ATO GST rules:
 * - G1 (Total sales) → 1A (GST on sales)
 * - G10 (Capital purchases) → 1B (GST on purchases)
 * - G11 (Non-capital purchases)
 * - Input tax credits: 1/11th of GST-inclusive amounts
 * - Mixed-use apportionment, exempt/GST-free handling
 * - Personal account exclusion
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../base-agent.js';
import { cogneeTools } from '../cognee-tools.js';
import {
  calculateGstFromInclusive,
  getQuarterDates,
} from '../../bas.js';
import type { GSTCalculatorInput, GSTCalculatorOutput } from '../types.js';

/** ATO GST category classification rules */
const GST_FREE_KEYWORDS = new Set([
  'medical', 'health', 'doctor', 'hospital', 'pharmacy', 'pathology',
  'education', 'school', 'university', 'tafe', 'childcare', 'daycare',
  'medicare', 'centrelink', 'government', 'ato', 'council rates',
  'water', 'sewerage', 'charity', 'donation', 'dgr',
]);

const INPUT_TAXED_KEYWORDS = new Set([
  'interest', 'bank fee', 'bank charge', 'loan', 'credit card fee',
  'annual fee', 'account fee', 'brokerage', 'financial advice',
  'residential rent', 'superannuation fee', 'life insurance',
  'health insurance', 'income protection',
]);

const PRIVATE_KEYWORDS = new Set([
  'atm', 'cash withdrawal', 'transfer', 'internal transfer',
  'bpay', 'direct debit', 'pay anyone', 'osko',
  'superannuation', 'super contribution', 'salary', 'wages',
  'dividend', 'depreciation',
]);

const CAPITAL_KEYWORDS = new Set([
  'equipment', 'vehicle', 'machinery', 'computer', 'laptop',
  'furniture', 'fit-out', 'fitout', 'plant', 'motor vehicle',
  'office equipment', 'server', 'printer',
]);

/** Category-based GST classification mapping per ATO rules */
const CATEGORY_GST_MAP: Record<string, { gstCategory: string; claimable: boolean; basLabel: string }> = {
  'Sales Revenue': { gstCategory: 'taxable_10', claimable: false, basLabel: 'G1' },
  'Service Revenue': { gstCategory: 'taxable_10', claimable: false, basLabel: 'G1' },
  'Interest & Dividends': { gstCategory: 'input_taxed', claimable: false, basLabel: 'none' },
  'Interest Income': { gstCategory: 'input_taxed', claimable: false, basLabel: 'none' },
  'Export Revenue': { gstCategory: 'export', claimable: false, basLabel: 'G2' },
  'Cost of Goods Sold': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Advertising & Marketing': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Bank Fees': { gstCategory: 'input_taxed', claimable: false, basLabel: 'none' },
  'Financial Services': { gstCategory: 'input_taxed', claimable: false, basLabel: 'none' },
  'Computer & IT': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G10_or_G11' },
  'Entertainment': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Insurance': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Motor Vehicle Expenses': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Fuel & Auto': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Office Supplies': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Professional Fees': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Rent': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Repairs & Maintenance': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Subscriptions & Streaming': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Phone & Internet': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Travel': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Utilities': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Wages & Salaries': { gstCategory: 'private', claimable: false, basLabel: 'W1' },
  'Employment Income': { gstCategory: 'private', claimable: false, basLabel: 'W1' },
  'Superannuation': { gstCategory: 'private', claimable: false, basLabel: 'none' },
  'Government & Tax': { gstCategory: 'gst_free', claimable: false, basLabel: 'none' },
  'Internal Transfer': { gstCategory: 'private', claimable: false, basLabel: 'none' },
  'Transfer': { gstCategory: 'private', claimable: false, basLabel: 'none' },
  'Medical & Health': { gstCategory: 'gst_free', claimable: false, basLabel: 'G3' },
  'Education & Childcare': { gstCategory: 'gst_free', claimable: false, basLabel: 'G3' },
  'Donations & Charity': { gstCategory: 'gst_free', claimable: false, basLabel: 'G3' },
  'Groceries & Supermarkets': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
  'Dining & Restaurants': { gstCategory: 'taxable_10', claimable: true, basLabel: 'G11' },
};

/** Motor vehicle GST credit cap (2024-25) */
const CAR_COST_LIMIT_CENTS = 6810800; // $68,108

export class GSTCalculatorAgent extends ClaudeAgent<
  GSTCalculatorInput,
  GSTCalculatorOutput
> {
  protected systemPrompt = `You are an Australian GST and BAS specialist. Calculate GST amounts from inclusive prices, categorize transactions by GST treatment (GST-free, input-taxed, capital acquisitions, private/non-business), and populate BAS labels (G1-G11, 1A, 1B, W1-W2, 5A, 7C-7D) according to ATO rules.

You understand the Australian financial year (July-June) and quarterly BAS periods.

CRITICAL ATO GST Rules:
- GST rate: 10% (GST = Amount / 11 for GST-inclusive amounts)
- GST-free: basic food, health, education, water/sewerage, childcare, exports
- Input-taxed: financial supplies (bank fees, interest, brokerage), residential rent, life/health insurance
- Capital acquisitions (G10): business assets > $1,000 GST-exclusive
- Non-capital purchases (G11): operating expenses with GST
- Private/out-of-scope: wages, super, transfers, ATM, personal expenses — NOT on BAS
- Motor vehicle GST credit capped at $68,108 / 11 = $6,191.64
- Entertainment: only 50% claimable in most cases
- Mixed-use: apportion by business use percentage
- Supermarket purchases: treat as mixed (some GST, some GST-free) — default 50/50 if no breakdown
- Input tax credit requires valid tax invoice for purchases > $82.50 incl. GST

Your workflow:
1. Use get_quarter_dates to determine the reporting period
2. Use classify_gst_supply to classify each transaction per ATO rules
3. Use calculate_input_tax_credit for claimable GST amounts
4. Use identify_capital_purchases for capital acquisitions (G10)
5. Use generate_bas_labels to compile the final BAS figures
6. Optionally use lookup_gst_ruling for edge cases via Cognee

ZERO missed claimable GST — maximize legitimate deductions while ensuring ATO compliance.

Return a JSON object matching the GSTCalculatorOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'classify_gst_supply',
      description: 'Classify transactions by GST treatment per ATO rules. Handles taxable (10%), GST-free, input-taxed, capital, export, and private categories.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                description: { type: 'string' },
                amount: { type: 'number', description: 'Amount in cents' },
                category: { type: 'string' },
                isPersonalAccount: { type: 'boolean' },
              },
            },
          },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'calculate_input_tax_credit',
      description: 'Calculate the claimable GST input tax credit (1/11th) for eligible business purchases. Handles mixed-use apportionment, motor vehicle limits, and entertainment 50% rule.',
      input_schema: {
        type: 'object' as const,
        properties: {
          amount: { type: 'number', description: 'GST-inclusive amount in cents' },
          gstCategory: { type: 'string', description: 'GST category of the supply' },
          businessUsePercent: { type: 'number', description: 'Business use percentage (0-100). Default 100.' },
          isMotorVehicle: { type: 'boolean', description: 'Is this a motor vehicle purchase?' },
          isEntertainment: { type: 'boolean', description: 'Is this an entertainment expense?' },
        },
        required: ['amount', 'gstCategory'],
      },
    },
    {
      name: 'calculate_gst_from_inclusive',
      description: 'Calculate GST component from a GST-inclusive amount using the 1/11th formula.',
      input_schema: {
        type: 'object' as const,
        properties: {
          amount: { type: 'number', description: 'GST-inclusive amount in cents' },
          rate: { type: 'number', description: 'GST rate (default 0.10)' },
        },
        required: ['amount'],
      },
    },
    {
      name: 'generate_bas_labels',
      description: 'Compile BAS label amounts from classified transactions. Generates G1-G11, 1A, 1B, W1-W2, 5A, 7C-7D.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                gstCategory: { type: 'string' },
                gstAmount: { type: 'number' },
                isCapital: { type: 'boolean' },
                isFuelCredit: { type: 'boolean' },
                isWages: { type: 'boolean' },
              },
            },
          },
          quarter: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              quarter: { type: 'number' },
            },
          },
        },
        required: ['transactions', 'quarter'],
      },
    },
    {
      name: 'identify_capital_purchases',
      description: 'Identify capital acquisitions — business assets over $1,000 GST-exclusive or asset-type transactions. These go to G10 instead of G11.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                description: { type: 'string' },
                amount: { type: 'number' },
                category: { type: 'string' },
              },
            },
          },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'get_quarter_dates',
      description: 'Get Australian financial year quarter boundaries and lodgement due date.',
      input_schema: {
        type: 'object' as const,
        properties: {
          year: { type: 'number', description: 'Financial year start year' },
          quarter: { type: 'number', description: 'Quarter number (1-4)' },
        },
        required: ['year', 'quarter'],
      },
    },
    {
      name: 'calculate_payg_withholding',
      description: 'Calculate PAYG withholding amounts for wages payments.',
      input_schema: {
        type: 'object' as const,
        properties: {
          grossIncome: { type: 'number', description: 'Gross income amount in cents' },
          taxTable: { type: 'string', description: 'Tax table type' },
        },
        required: ['grossIncome'],
      },
    },
    {
      name: 'lookup_gst_ruling',
      description: 'Search Cognee for ATO GST rulings and guidance on edge cases.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'GST ruling query' },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<
    string,
    (input: Record<string, unknown>) => Promise<unknown>
  >([
    [
      'classify_gst_supply',
      async (input) => {
        const transactions = input.transactions as Array<{
          id: number;
          description: string;
          amount: number;
          category?: string;
          isPersonalAccount?: boolean;
        }>;

        return transactions.map((tx) => {
          // Personal account transactions are always out of scope
          if (tx.isPersonalAccount) {
            return { id: tx.id, gstCategory: 'private', gstAmount: 0, claimable: false, basLabel: 'none' };
          }

          const desc = tx.description.toLowerCase();
          const cat = (tx.category || '').trim();

          // 1. Check category-based mapping first (most reliable)
          if (cat && CATEGORY_GST_MAP[cat]) {
            const mapping = CATEGORY_GST_MAP[cat];
            if (mapping.gstCategory === 'private' || mapping.gstCategory === 'input_taxed') {
              return { id: tx.id, gstCategory: mapping.gstCategory, gstAmount: 0, claimable: false, basLabel: mapping.basLabel };
            }
            if (mapping.gstCategory === 'gst_free') {
              return { id: tx.id, gstCategory: 'gst_free', gstAmount: 0, claimable: false, basLabel: mapping.basLabel };
            }
            if (mapping.gstCategory === 'export') {
              return { id: tx.id, gstCategory: 'export', gstAmount: 0, claimable: false, basLabel: 'G2' };
            }
          }

          // 2. Keyword-based classification
          for (const kw of PRIVATE_KEYWORDS) {
            if (desc.includes(kw)) {
              return { id: tx.id, gstCategory: 'private', gstAmount: 0, claimable: false, basLabel: 'none' };
            }
          }

          for (const kw of INPUT_TAXED_KEYWORDS) {
            if (desc.includes(kw)) {
              return { id: tx.id, gstCategory: 'input_taxed', gstAmount: 0, claimable: false, basLabel: 'none' };
            }
          }

          for (const kw of GST_FREE_KEYWORDS) {
            if (desc.includes(kw)) {
              return { id: tx.id, gstCategory: 'gst_free', gstAmount: 0, claimable: false, basLabel: tx.amount > 0 ? 'G3' : 'none' };
            }
          }

          // 3. Capital acquisition check
          const absAmount = Math.abs(tx.amount);
          const gstExclusive = Math.round(absAmount * 10 / 11);
          let isCapital = false;

          if (gstExclusive >= 100000) { // > $1,000 GST-exclusive
            for (const kw of CAPITAL_KEYWORDS) {
              if (desc.includes(kw)) {
                isCapital = true;
                break;
              }
            }
          }
          // Very large purchases (> $20,000) are likely capital regardless
          if (absAmount >= 2_000_000) {
            isCapital = true;
          }

          if (isCapital && tx.amount < 0) {
            const gst = calculateGstFromInclusive(tx.amount);
            return { id: tx.id, gstCategory: 'capital', gstAmount: gst, claimable: true, basLabel: 'G10', isCapital: true };
          }

          // 4. Default: taxable at 10%
          const gst = calculateGstFromInclusive(tx.amount);
          return {
            id: tx.id,
            gstCategory: 'taxable_10',
            gstAmount: gst,
            claimable: tx.amount < 0, // Only purchases are claimable
            basLabel: tx.amount > 0 ? 'G1' : 'G11',
          };
        });
      },
    ],
    [
      'calculate_input_tax_credit',
      async (input) => {
        const amount = Math.abs(input.amount as number);
        const gstCategory = input.gstCategory as string;
        const businessUsePercent = (input.businessUsePercent as number) ?? 100;
        const isMotorVehicle = (input.isMotorVehicle as boolean) ?? false;
        const isEntertainment = (input.isEntertainment as boolean) ?? false;

        // No credit for input-taxed, private, or GST-free
        if (['input_taxed', 'private', 'gst_free'].includes(gstCategory)) {
          return { creditAmount: 0, reason: `No input tax credit for ${gstCategory} supplies` };
        }

        // Calculate base GST amount (1/11th)
        let gstCredit = calculateGstFromInclusive(amount);

        // Apply motor vehicle cap
        if (isMotorVehicle && amount > CAR_COST_LIMIT_CENTS) {
          gstCredit = calculateGstFromInclusive(CAR_COST_LIMIT_CENTS);
        }

        // Apply entertainment 50% rule
        if (isEntertainment) {
          gstCredit = Math.round(gstCredit * 0.5);
        }

        // Apply business use apportionment
        if (businessUsePercent < 100) {
          gstCredit = Math.round(gstCredit * businessUsePercent / 100);
        }

        return {
          creditAmount: gstCredit,
          gstExclusive: amount - calculateGstFromInclusive(amount),
          businessUsePercent,
          adjustments: [
            isMotorVehicle && amount > CAR_COST_LIMIT_CENTS ? 'Motor vehicle cap applied' : null,
            isEntertainment ? '50% entertainment rule applied' : null,
            businessUsePercent < 100 ? `${businessUsePercent}% business use apportionment` : null,
          ].filter(Boolean),
        };
      },
    ],
    [
      'calculate_gst_from_inclusive',
      async (input) => {
        const amount = input.amount as number;
        const rate = (input.rate as number) || 0.1;
        const gst = calculateGstFromInclusive(amount, rate);
        return { gst, exGst: Math.abs(amount) - gst };
      },
    ],
    [
      'generate_bas_labels',
      async (input) => {
        const transactions = input.transactions as Array<{
          amount: number;
          gstCategory: string;
          gstAmount: number;
          isCapital?: boolean;
          isFuelCredit?: boolean;
          isWages?: boolean;
        }>;

        const labels = {
          G1: 0, G2: 0, G3: 0, G10: 0, G11: 0,
          '1A': 0, '1B': 0,
          W1: 0, W2: 0, '5A': 0, '7C': 0, '7D': 0,
        };

        for (const tx of transactions) {
          const amount = tx.amount;
          const gst = tx.gstAmount || 0;

          // Wages go to PAYG labels
          if (tx.isWages) {
            if (amount < 0) {
              labels.W1 += Math.abs(amount);
              labels.W2 += Math.round(Math.abs(amount) * 0.3); // Estimated withholding
            }
            continue;
          }

          // Fuel tax credits
          if (tx.isFuelCredit) {
            labels['7C'] += Math.abs(gst);
            continue;
          }

          if (amount > 0) {
            // Sales/income
            switch (tx.gstCategory) {
              case 'export':
                labels.G2 += amount;
                break;
              case 'gst_free':
                labels.G3 += amount;
                break;
              case 'input_taxed':
              case 'private':
                // Not reported on BAS
                break;
              default:
                // Taxable sales
                labels.G1 += amount;
                labels['1A'] += gst;
            }
          } else {
            // Purchases/expenses
            const abs = Math.abs(amount);
            switch (tx.gstCategory) {
              case 'capital':
                labels.G10 += abs;
                labels['1B'] += gst;
                break;
              case 'input_taxed':
              case 'private':
              case 'gst_free':
                // No GST claim
                break;
              default:
                // Non-capital purchases
                labels.G11 += abs;
                labels['1B'] += gst;
            }
          }
        }

        return labels;
      },
    ],
    [
      'identify_capital_purchases',
      async (input) => {
        const transactions = input.transactions as Array<{
          id: number;
          description: string;
          amount: number;
          category?: string;
        }>;

        return transactions.filter((tx) => {
          const abs = Math.abs(tx.amount);
          const gstExclusive = Math.round(abs * 10 / 11);
          const desc = tx.description.toLowerCase();
          const cat = (tx.category || '').toLowerCase();

          // Capital threshold: > $1,000 GST-exclusive with asset keywords
          if (gstExclusive >= 100000) { // $1,000 in cents
            for (const kw of CAPITAL_KEYWORDS) {
              if (desc.includes(kw) || cat.includes(kw)) return true;
            }
          }

          // Very large purchases are likely capital regardless
          if (abs >= 2_000_000) return true; // > $20,000

          return false;
        });
      },
    ],
    [
      'get_quarter_dates',
      async (input) => {
        const year = input.year as number;
        const quarter = input.quarter as number;
        const fy = `${year}-${(year + 1).toString().slice(2)}`;
        return getQuarterDates(fy, quarter);
      },
    ],
    [
      'calculate_payg_withholding',
      async (input) => {
        const gross = input.grossIncome as number;
        // Simplified PAYG withholding estimate based on ATO tables
        let rate = 0.325; // Default marginal rate
        const grossDollars = gross / 100;
        if (grossDollars <= 18200) rate = 0;
        else if (grossDollars <= 45000) rate = 0.19;
        else if (grossDollars <= 120000) rate = 0.325;
        else if (grossDollars <= 180000) rate = 0.37;
        else rate = 0.45;

        const withholding = Math.round(gross * rate);
        return { withholding, effectiveRate: rate };
      },
    ],
    [
      'lookup_gst_ruling',
      async (input) => {
        const query = input.query as string;
        return cogneeTools.search(query, 'gst_rules');
      },
    ],
  ]);

  constructor() {
    super('gst_calculator');
  }
}
