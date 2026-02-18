/**
 * GSTCalculator Agent — Tool Handler Implementations
 *
 * Handler functions for GST classification, input tax credits,
 * BAS label generation, capital purchase identification, PAYG withholding,
 * and Cognee GST ruling lookup.
 */

import { cogneeTools } from '../../cognee-tools.js';
import { calculateGstFromInclusive, getQuarterDates } from '../../../bas.js';
import type { MutationTools } from '../../mutation-tools.js';
import {
  GST_FREE_KEYWORDS,
  INPUT_TAXED_KEYWORDS,
  PRIVATE_KEYWORDS,
  CAPITAL_KEYWORDS,
  CATEGORY_GST_MAP,
  CAR_COST_LIMIT_CENTS,
} from './constants.js';

export function buildGstHandlers(
  getMutationTools: () => MutationTools | undefined,
  getSessionId: () => string | undefined,
): Map<string, (input: Record<string, unknown>) => Promise<unknown>> {
  return new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
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

        const classifications = transactions.map((tx) => {
          if (tx.isPersonalAccount) {
            return {
              id: tx.id,
              gstCategory: 'private',
              gstAmount: 0,
              claimable: false,
              basLabel: 'none',
            };
          }

          const desc = tx.description.toLowerCase();
          const cat = (tx.category || '').trim();

          // 1. Check category-based mapping first (most reliable)
          if (cat && CATEGORY_GST_MAP[cat]) {
            const mapping = CATEGORY_GST_MAP[cat];
            if (mapping.gstCategory === 'private' || mapping.gstCategory === 'input_taxed') {
              return {
                id: tx.id,
                gstCategory: mapping.gstCategory,
                gstAmount: 0,
                claimable: false,
                basLabel: mapping.basLabel,
              };
            }
            if (mapping.gstCategory === 'gst_free') {
              return {
                id: tx.id,
                gstCategory: 'gst_free',
                gstAmount: 0,
                claimable: false,
                basLabel: mapping.basLabel,
              };
            }
            if (mapping.gstCategory === 'export') {
              return {
                id: tx.id,
                gstCategory: 'export',
                gstAmount: 0,
                claimable: false,
                basLabel: 'G2',
              };
            }
          }

          // 2. Keyword-based classification
          for (const kw of PRIVATE_KEYWORDS) {
            if (desc.includes(kw)) {
              return {
                id: tx.id,
                gstCategory: 'private',
                gstAmount: 0,
                claimable: false,
                basLabel: 'none',
              };
            }
          }

          for (const kw of INPUT_TAXED_KEYWORDS) {
            if (desc.includes(kw)) {
              return {
                id: tx.id,
                gstCategory: 'input_taxed',
                gstAmount: 0,
                claimable: false,
                basLabel: 'none',
              };
            }
          }

          for (const kw of GST_FREE_KEYWORDS) {
            if (desc.includes(kw)) {
              return {
                id: tx.id,
                gstCategory: 'gst_free',
                gstAmount: 0,
                claimable: false,
                basLabel: tx.amount > 0 ? 'G3' : 'none',
              };
            }
          }

          // 3. Capital acquisition check
          const absAmount = Math.abs(tx.amount);
          const gstExclusive = Math.round((absAmount * 10) / 11);
          let isCapital = false;

          if (gstExclusive >= 100000) {
            for (const kw of CAPITAL_KEYWORDS) {
              if (desc.includes(kw)) {
                isCapital = true;
                break;
              }
            }
          }
          if (absAmount >= 2_000_000) {
            isCapital = true;
          }

          if (isCapital && tx.amount < 0) {
            const gst = calculateGstFromInclusive(tx.amount);
            return {
              id: tx.id,
              gstCategory: 'capital',
              gstAmount: gst,
              claimable: true,
              basLabel: 'G10',
              isCapital: true,
            };
          }

          // 4. Default: taxable at 10%
          const gst = calculateGstFromInclusive(tx.amount);
          return {
            id: tx.id,
            gstCategory: 'taxable_10',
            gstAmount: gst,
            claimable: tx.amount < 0,
            basLabel: tx.amount > 0 ? 'G1' : 'G11',
          };
        });

        // Propose GST mutations for classified transactions
        const mutationTools = getMutationTools();
        if (mutationTools) {
          const classifiedWithGst = classifications.filter(
            (c) => c.gstCategory !== 'private' && c.gstAmount !== 0,
          );
          if (classifiedWithGst.length > 0) {
            try {
              const proposals = classifiedWithGst.map((c) => ({
                agentType: 'gst_calculator' as const,
                mutationType: 'update' as const,
                targetTable: 'transactions',
                targetId: String(c.id),
                beforeState: { gst_amount: 0, gst_category: null },
                afterState: { gst_amount: c.gstAmount, gst_category: c.gstCategory },
                description: `Set GST for transaction ${c.id}: ${(c.gstAmount / 100).toFixed(2)} (${c.gstCategory})`,
                confidence: 0.85,
                requiresConfirmation: true,
              }));
              await mutationTools.batchProposeMutations(proposals);
            } catch (err) {
              console.warn('[GSTCalculator] GST mutation proposal failed:', err);
            }
          }
        }

        return classifications;
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

        if (['input_taxed', 'private', 'gst_free'].includes(gstCategory)) {
          return { creditAmount: 0, reason: `No input tax credit for ${gstCategory} supplies` };
        }

        let gstCredit = calculateGstFromInclusive(amount);

        if (isMotorVehicle && amount > CAR_COST_LIMIT_CENTS) {
          gstCredit = calculateGstFromInclusive(CAR_COST_LIMIT_CENTS);
        }

        if (isEntertainment) {
          gstCredit = Math.round(gstCredit * 0.5);
        }

        if (businessUsePercent < 100) {
          gstCredit = Math.round((gstCredit * businessUsePercent) / 100);
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
          G1: 0,
          G2: 0,
          G3: 0,
          G10: 0,
          G11: 0,
          '1A': 0,
          '1B': 0,
          W1: 0,
          W2: 0,
          '5A': 0,
          '7C': 0,
          '7D': 0,
        };

        for (const tx of transactions) {
          const amount = tx.amount;
          const gst = tx.gstAmount || 0;

          if (tx.isWages) {
            if (amount < 0) {
              labels.W1 += Math.abs(amount);
              labels.W2 += Math.round(Math.abs(amount) * 0.3);
            }
            continue;
          }

          if (tx.isFuelCredit) {
            labels['7C'] += Math.abs(gst);
            continue;
          }

          if (amount > 0) {
            switch (tx.gstCategory) {
              case 'export':
                labels.G2 += amount;
                break;
              case 'gst_free':
                labels.G3 += amount;
                break;
              case 'input_taxed':
              case 'private':
                break;
              default:
                labels.G1 += amount;
                labels['1A'] += gst;
            }
          } else {
            const abs = Math.abs(amount);
            switch (tx.gstCategory) {
              case 'capital':
                labels.G10 += abs;
                labels['1B'] += gst;
                break;
              case 'input_taxed':
              case 'private':
              case 'gst_free':
                break;
              default:
                labels.G11 += abs;
                labels['1B'] += gst;
            }
          }
        }

        // Propose BAS calculation mutation
        const mutationTools = getMutationTools();
        if (mutationTools) {
          const quarter = input.quarter as { year: number; quarter: number } | undefined;
          if (quarter) {
            try {
              const period = `Q${quarter.quarter}-${quarter.year}`;
              await mutationTools.proposeMutation({
                agentType: 'gst_calculator',
                mutationType: 'create',
                targetTable: 'bas_calculations',
                afterState: { ...labels, period, status: 'draft' },
                description: `Generate BAS calculation for ${period}`,
                confidence: 0.9,
                requiresConfirmation: true,
              });
            } catch (err) {
              console.warn('[GSTCalculator] BAS mutation proposal failed:', err);
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
          const gstExclusive = Math.round((abs * 10) / 11);
          const desc = tx.description.toLowerCase();
          const cat = (tx.category || '').toLowerCase();

          if (gstExclusive >= 100000) {
            for (const kw of CAPITAL_KEYWORDS) {
              if (desc.includes(kw) || cat.includes(kw)) return true;
            }
          }

          if (abs >= 2_000_000) return true;

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
        let rate = 0.325;
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
        return cogneeTools.search(query, 'gst_rules', 'GRAPH_COMPLETION', getSessionId());
      },
    ],
  ]);
}
