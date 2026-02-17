/**
 * Personal Tax Claims Agent — Tool Definitions
 *
 * Anthropic tool schemas for scanning transactions, checking substantiation,
 * calculating claim amounts, and searching ATO rulings.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const personalTaxClaimsTools: Anthropic.Tool[] = [
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
