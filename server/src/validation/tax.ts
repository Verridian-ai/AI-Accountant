/**
 * Tax, BAS, CGT, and Depreciation validation schemas
 */

import { z } from 'zod';
import { amountCentsSchema, dateSchema, percentageSchema, uuidSchema } from './common.js';

export const basCalculateSchema = z.object({
  quarter: z
    .string()
    .regex(/^Q[1-4]-\d{4}-\d{2}$/, 'Invalid quarter format. Use Q1-2024-25 format'),
  method: z.enum(['accrual', 'cash']).default('accrual'),
});

export const basSaveSchema = z.object({
  quarter: z.string(),
  labelG1: amountCentsSchema.optional(),
  labelG2: amountCentsSchema.optional(),
  labelG3: amountCentsSchema.optional(),
  labelG10: amountCentsSchema.optional(),
  labelG11: amountCentsSchema.optional(),
  label1A: amountCentsSchema.optional(),
  label1B: amountCentsSchema.optional(),
  labelW1: amountCentsSchema.optional(),
  labelW2: amountCentsSchema.optional(),
  label5A: amountCentsSchema.optional(),
  label7C: amountCentsSchema.optional(),
  label7D: amountCentsSchema.optional(),
});

export const taxCalculateSchema = z.object({
  year: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid tax year format. Use 2024-25 format'),
  grossIncome: amountCentsSchema,
  entityType: z.enum(['individual', 'company', 'trust', 'partnership']).default('individual'),
  hasPrivateHealth: z.boolean().default(false),
});

export const addDeductionSchema = z.object({
  taxYear: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  description: z.string().min(1).max(500),
  amount: amountCentsSchema,
  calculationMethod: z.string().max(100).optional(),
  calculationDetails: z.string().max(2000).optional(),
  linkedTransactionIds: z.array(uuidSchema).optional(),
});

export const assetTypeEnum = z.enum(['shares', 'property', 'crypto', 'collectables', 'other']);

export const addCgtAssetSchema = z.object({
  assetName: z.string().min(1).max(200),
  assetType: assetTypeEnum,
  acquisitionDate: dateSchema,
  acquisitionCost: amountCentsSchema,
  acquisitionCostsIncidental: amountCentsSchema.optional(),
  improvementsCost: amountCentsSchema.optional(),
  quantity: z.number().positive().default(1),
  unitCost: amountCentsSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const recordDisposalSchema = z.object({
  assetId: uuidSchema,
  acquisitionDate: dateSchema,
  acquisitionCostCents: amountCentsSchema,
  disposalDate: dateSchema,
  disposalProceedsCents: amountCentsSchema,
  disposalCostsCents: amountCentsSchema.optional(),
  quantityDisposed: z.number().positive().optional(),
  carriedForwardLossesCents: amountCentsSchema.optional(),
});

export const depreciationMethodEnum = z.enum([
  'diminishing',
  'prime_cost',
  'low_value_pool',
  'instant_write_off',
]);

export const addDepreciableAssetSchema = z.object({
  assetName: z.string().min(1).max(200),
  assetCategory: z.string().min(1).max(100),
  purchaseDate: dateSchema,
  purchaseCost: amountCentsSchema,
  effectiveLifeYears: z.number().positive().max(50),
  depreciationMethod: depreciationMethodEnum.default('diminishing'),
  businessUsePercentage: percentageSchema.default(100),
  openingWrittenDownValue: amountCentsSchema.optional(),
  linkedTransactionId: uuidSchema.optional(),
  notes: z.string().max(2000).optional(),
});
