/**
 * Personal Tax Claims Agent
 *
 * Scans transactions to identify eligible personal tax deductions,
 * checks substantiation requirements, and calculates claim amounts
 * according to ATO rules. Uses Haiku for cost-effective batch processing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAgent } from '../../base-agent.js';
import { cogneeTools } from '../../cognee-tools.js';
import { DEDUCTION_RATES } from '../../../tax-return.js';
import type { PersonalTaxClaimsInput, PersonalTaxClaimsOutput } from '../../types.js';

/** Patterns that indicate potentially claimable expenses by category */
const CLAIM_PATTERNS: Array<{
  claimType: PersonalTaxClaimsOutput['claims'][number]['claimType'];
  patterns: RegExp[];
  categories: string[];
}> = [
  {
    claimType: 'wfh',
    patterns: [/\bINTERNET\b/i, /\bELECTRICITY\b/i, /\bOFFICE\s*WORKS\b/i, /\bSTATIONERY\b/i],
    categories: ['Communication & Internet', 'Utilities', 'Office Supplies'],
  },
  {
    claimType: 'motor_vehicle',
    patterns: [
      /\bFUEL\b/i,
      /\bPETROL\b/i,
      /\bSHELL\b/i,
      /\bBP\b/i,
      /\bCALTEX\b/i,
      /\bAMPOL\b/i,
      /\bREGO\b/i,
      /\bINSURANCE.*CAR\b/i,
    ],
    categories: ['Motor Vehicle Expenses'],
  },
  {
    claimType: 'tools',
    patterns: [
      /\bBUNNINGS\b/i,
      /\bTOOL\b/i,
      /\bSOFTWARE\b/i,
      /\bADOBE\b/i,
      /\bMICROSOFT\b/i,
      /\bAPPLE\b/i,
    ],
    categories: ['Equipment & Tools', 'Subscriptions'],
  },
  {
    claimType: 'uniforms',
    patterns: [/\bUNIFORM\b/i, /\bPROTECTIVE\b/i, /\bSAFETY\b/i, /\bWORKWEAR\b/i, /\bLAUNDRY\b/i],
    categories: [],
  },
  {
    claimType: 'self_education',
    patterns: [
      /\bCOURSE\b/i,
      /\bTRAINING\b/i,
      /\bUDEMY\b/i,
      /\bCOURSERA\b/i,
      /\bTEXTBOOK\b/i,
      /\bCONFERENCE\b/i,
    ],
    categories: ['Education & Training'],
  },
  {
    claimType: 'travel',
    patterns: [
      /\bFLIGHT\b/i,
      /\bQANTAS\b/i,
      /\bVIRGIN\b/i,
      /\bJETSTAR\b/i,
      /\bHOTEL\b/i,
      /\bACCOM\b/i,
      /\bAIRBNB\b/i,
    ],
    categories: ['Travel & Accommodation'],
  },
  {
    claimType: 'phone_internet',
    patterns: [
      /\bTELSTRA\b/i,
      /\bOPTUS\b/i,
      /\bVODAFONE\b/i,
      /\bTPG\b/i,
      /\bNBN\b/i,
      /\bPHONE\b/i,
      /\bMOBILE\b/i,
    ],
    categories: ['Communication & Internet'],
  },
];

export class PersonalTaxClaimsAgent extends ClaudeAgent<
  PersonalTaxClaimsInput,
  PersonalTaxClaimsOutput
> {
  protected systemPrompt = `You are an Australian personal tax deduction specialist AI agent. Your job is to:

1. Scan bank transactions to identify potentially claimable tax deductions
2. Check substantiation requirements for each claim type
3. Calculate the correct claim amount using ATO-approved methods
4. Flag items that need receipts, logbooks, or other evidence

Key ATO deduction rules:
- WFH: $0.67/hour fixed rate method (PCG 2023/1). Requires record of hours worked from home.
- Motor vehicle: 85 cents/km up to 5,000 km (no logbook needed). OR logbook method for actual costs.
- Tools & equipment: Under $300 = immediate deduction. Over $300 = depreciate.
- Self-education: Must be related to current employment. $250 reduction for first expenses claimed.
- Uniforms: Only occupation-specific or compulsory employer uniforms. Laundry $1/load max $150 without receipts.
- Phone/internet: Must apportion business vs personal use. ATO expects 4-week diary to establish pattern.
- Travel: Must be for work purposes, not ordinary commute.

Substantiation rules:
- Under $300 total in a category: No receipt needed (but must have been spent).
- Over $300: Must have written evidence (receipt/invoice).
- WFH: Need a record of all hours worked from home.
- Car: Need odometer readings at start/end of year if using logbook method.

All amounts are in CENTS (integer). Return a JSON object matching the PersonalTaxClaimsOutput schema.`;

  protected tools: Anthropic.Tool[] = [
    {
      name: 'scan_transactions_for_claims',
      description: 'Scan a list of transactions to identify potentially claimable tax deductions.',
      input_schema: {
        type: 'object' as const,
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                date: { type: 'string' },
                description: { type: 'string' },
                amount: { type: 'number' },
                category: { type: 'string' },
              },
              required: ['id', 'description', 'amount'],
            },
          },
          occupation: { type: 'string' },
        },
        required: ['transactions'],
      },
    },
    {
      name: 'check_substantiation',
      description: 'Check what substantiation (receipts, logs) is required for a claim.',
      input_schema: {
        type: 'object' as const,
        properties: {
          claimType: {
            type: 'string',
            enum: [
              'wfh',
              'motor_vehicle',
              'tools',
              'uniforms',
              'self_education',
              'travel',
              'phone_internet',
              'other',
            ],
          },
          totalAmountCents: { type: 'number' },
        },
        required: ['claimType', 'totalAmountCents'],
      },
    },
    {
      name: 'calculate_claim_amount',
      description: 'Calculate the deductible amount for a specific claim type.',
      input_schema: {
        type: 'object' as const,
        properties: {
          claimType: { type: 'string' },
          amountCents: { type: 'number' },
          method: {
            type: 'string',
            description: 'Calculation method (e.g., fixed_rate, actual_cost, cents_per_km)',
          },
          parameters: {
            type: 'object',
            properties: {
              hoursPerWeek: { type: 'number' },
              weeksWorked: { type: 'number' },
              kilometres: { type: 'number' },
              businessUsePercent: { type: 'number' },
            },
          },
        },
        required: ['claimType', 'amountCents'],
      },
    },
    {
      name: 'search_ato_rulings',
      description: 'Search for ATO rulings and guidelines related to a specific deduction type.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  ];

  protected toolHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>([
    [
      'scan_transactions_for_claims',
      async (input) => {
        const txns = input.transactions as Array<{
          id: string;
          date: string;
          description: string;
          amount: number;
          category?: string;
        }>;

        const claims: Array<{
          transactionId: string;
          claimType: string;
          amountCents: number;
          description: string;
          matchedBy: string;
        }> = [];

        for (const tx of txns) {
          // Only look at expenses (negative amounts)
          if (tx.amount >= 0) continue;

          for (const claimDef of CLAIM_PATTERNS) {
            // Match by category
            if (tx.category && claimDef.categories.includes(tx.category)) {
              claims.push({
                transactionId: tx.id,
                claimType: claimDef.claimType,
                amountCents: Math.abs(tx.amount),
                description: tx.description,
                matchedBy: `category:${tx.category}`,
              });
              break;
            }

            // Match by description pattern
            const matched = claimDef.patterns.some((p) => p.test(tx.description));
            if (matched) {
              claims.push({
                transactionId: tx.id,
                claimType: claimDef.claimType,
                amountCents: Math.abs(tx.amount),
                description: tx.description,
                matchedBy: 'description_pattern',
              });
              break;
            }
          }
        }

        return {
          totalScanned: txns.length,
          claimsFound: claims.length,
          claims,
        };
      },
    ],
    [
      'check_substantiation',
      async (input) => {
        const claimType = input.claimType as string;
        const totalCents = input.totalAmountCents as number;
        const totalDollars = totalCents / 100;

        const requirements: Record<
          string,
          {
            status: string;
            requirements: string[];
          }
        > = {
          wfh: {
            status: 'needs_log',
            requirements: [
              'Record of all hours worked from home (timesheet, roster, diary)',
              'A dedicated workspace at home',
              'No separate claims for phone, internet, or electricity if using fixed rate',
            ],
          },
          motor_vehicle: {
            status: totalDollars > 425 ? 'needs_log' : 'substantiated',
            requirements: [
              'Cents per km: Reasonable estimate of work km (max 5,000)',
              'Logbook method: 12-week logbook + all receipts for running costs',
              'Odometer readings at start and end of claim period',
            ],
          },
          tools: {
            status: totalDollars > 300 ? 'needs_receipt' : 'substantiated',
            requirements:
              totalDollars > 300
                ? [
                    'Receipt or invoice for each item over $300',
                    'Items over $300 must be depreciated',
                  ]
                : ['No receipt needed for items under $300 each'],
          },
          uniforms: {
            status: totalDollars > 150 ? 'needs_receipt' : 'substantiated',
            requirements: [
              'Must be occupation-specific, protective, or compulsory employer uniform',
              totalDollars > 150
                ? 'Receipts required for laundry claims over $150'
                : 'Can claim $1/load without receipts up to $150',
            ],
          },
          self_education: {
            status: 'needs_receipt',
            requirements: [
              'Must relate to current employment (not a new career)',
              'First $250 is non-deductible',
              'Receipts for all course fees, textbooks, travel',
            ],
          },
          travel: {
            status: 'needs_receipt',
            requirements: [
              'Must be for work purposes (not ordinary commute)',
              'Travel diary required for trips of 6+ nights',
              'Receipts for all expenses',
            ],
          },
          phone_internet: {
            status: 'needs_log',
            requirements: [
              'Must apportion business vs personal use',
              '4-week diary to establish usage pattern',
              'Phone bills showing total amounts',
            ],
          },
        };

        return (
          requirements[claimType] ?? {
            status: totalDollars > 300 ? 'needs_receipt' : 'substantiated',
            requirements: ['Keep receipts for claims over $300'],
          }
        );
      },
    ],
    [
      'calculate_claim_amount',
      async (input) => {
        const claimType = input.claimType as string;
        const amountCents = input.amountCents as number;
        const method = (input.method as string) ?? 'actual_cost';
        const params = (input.parameters as Record<string, number>) ?? {};

        let claimableCents = amountCents;

        switch (claimType) {
          case 'wfh': {
            const hours = (params.hoursPerWeek ?? 20) * (params.weeksWorked ?? 48);
            claimableCents = Math.round(hours * DEDUCTION_RATES.wfhHourlyRate);
            break;
          }
          case 'motor_vehicle': {
            if (method === 'cents_per_km') {
              const km = Math.min(params.kilometres ?? 0, DEDUCTION_RATES.motorVehicleMaxKm);
              claimableCents = km * DEDUCTION_RATES.motorVehicleCentsPerKm;
            } else {
              // Actual cost method — apply business use %
              const bizPercent = (params.businessUsePercent ?? 50) / 100;
              claimableCents = Math.round(amountCents * bizPercent);
            }
            break;
          }
          case 'phone_internet': {
            const bizPercent = (params.businessUsePercent ?? 50) / 100;
            claimableCents = Math.round(amountCents * bizPercent);
            break;
          }
          case 'self_education': {
            // $250 reduction
            claimableCents = Math.max(0, amountCents - 25_000);
            break;
          }
          default:
            claimableCents = amountCents;
        }

        return {
          claimType,
          originalAmountCents: amountCents,
          claimableAmountCents: claimableCents,
          method,
        };
      },
    ],
    [
      'search_ato_rulings',
      async (input) => {
        const query = input.query as string;
        try {
          const results = await cogneeTools.search(query, 'tax_rulings', 'CHUNKS_LEXICAL');
          return { found: results.length > 0, results };
        } catch {
          return { found: false, results: [], error: 'Cognee search unavailable' };
        }
      },
    ],
  ]);

  constructor() {
    super('personal_tax_claims');
  }
}
