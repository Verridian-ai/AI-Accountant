/**
 * Zod schema for TransactionCategorizer agent output.
 * Matches CategorizerOutput from types.ts.
 */
import { z } from 'zod';

export const CategorizerResultSchema = z.object({
  transactionId: z.number(),
  category: z.string(),
  subCategory: z.string().optional(),
  confidence: z.number().min(0).max(1),
  gstCategory: z.string(),
  gstAmount: z.number().optional(),
  aiReasoningNotes: z.string(),
  merchantKey: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

export const CategorizerOutputSchema = z.object({
  results: z.array(CategorizerResultSchema),
  lowConfidenceIds: z.array(z.number()),
});

export type CategorizerOutputValidated = z.infer<typeof CategorizerOutputSchema>;
