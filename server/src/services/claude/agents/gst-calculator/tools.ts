/**
 * GSTCalculator Agent — Tool Definitions
 *
 * Anthropic tool schemas for GST classification, input tax credits,
 * BAS label generation, capital purchase identification, and PAYG withholding.
 */

import type Anthropic from '@anthropic-ai/sdk';

export const gstCalculatorTools: Anthropic.Tool[] = [
  {
    name: 'classify_gst_supply',
    description:
      'Classify transactions by GST treatment per ATO rules. Handles taxable (10%), GST-free, input-taxed, capital, export, and private categories.',
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
    description:
      'Calculate the claimable GST input tax credit (1/11th) for eligible business purchases. Handles mixed-use apportionment, motor vehicle limits, and entertainment 50% rule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'GST-inclusive amount in cents' },
        gstCategory: { type: 'string', description: 'GST category of the supply' },
        businessUsePercent: {
          type: 'number',
          description: 'Business use percentage (0-100). Default 100.',
        },
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
    description:
      'Compile BAS label amounts from classified transactions. Generates G1-G11, 1A, 1B, W1-W2, 5A, 7C-7D.',
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
    description:
      'Identify capital acquisitions — business assets over $1,000 GST-exclusive or asset-type transactions. These go to G10 instead of G11.',
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
