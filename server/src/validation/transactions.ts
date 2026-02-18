/**
 * Transaction and transfer validation schemas
 */

import { z } from 'zod';
import { amountCentsSchema, uuidSchema } from './common.js';

export const transactionUpdateSchema = z.object({
  category: z.string().max(100, 'Category too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  amount: amountCentsSchema.optional(),
  gstApplicable: z.boolean().optional(),
  gstAmount: amountCentsSchema.optional(),
  gstCategory: z.enum(['taxable_10', 'gst_free', 'input_taxed', 'export', 'capital']).optional(),
  isTransfer: z.boolean().optional(),
  merchantNormalized: z.string().max(200, 'Merchant name too long').optional(),
  aiReasoningNotes: z.string().max(2000, 'Notes too long').optional(),
});

export const transactionSplitSchema = z.object({
  splits: z
    .array(
      z.object({
        category: z.string().min(1, 'Category required').max(100),
        amount: amountCentsSchema,
        description: z.string().max(500).optional(),
        gst: z.boolean().default(false),
      }),
    )
    .min(2, 'At least 2 splits required')
    .max(10, 'Maximum 10 splits allowed'),
});

export const gstCategorizeSchema = z.object({
  updates: z
    .array(
      z.object({
        transactionId: uuidSchema,
        gstCategory: z.enum(['taxable_10', 'gst_free', 'input_taxed', 'export', 'capital']),
        gstAmount: amountCentsSchema,
      }),
    )
    .min(1)
    .max(100, 'Maximum 100 updates per request'),
});

export const createTransferLinkSchema = z.object({
  sourceTransactionId: uuidSchema,
  destinationTransactionId: uuidSchema,
});

export const bulkLinkTransfersSchema = z.object({
  pairs: z
    .array(
      z.object({
        sourceTransactionId: uuidSchema,
        destinationTransactionId: uuidSchema,
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(50, 'Maximum 50 pairs per request'),
});

export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type TransactionSplit = z.infer<typeof transactionSplitSchema>;
