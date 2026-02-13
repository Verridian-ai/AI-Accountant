/**
 * Zod schema for MerchantIntelligence agent output.
 * Matches MerchantIntelligenceOutput from types.ts.
 */
import { z } from 'zod';

export const MerchantResultSchema = z.object({
  transactionId: z.number(),
  abbreviatedName: z.string(),
  canonicalName: z.string(),
  abn: z.string().optional(),
  gstRegistered: z.boolean(),
  industry: z.string().optional(),
  defaultCategory: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['cognee', 'online', 'pattern', 'unknown']),
});

export const NewMappingSchema = z.object({
  abbreviatedName: z.string(),
  canonicalName: z.string(),
  abn: z.string().optional(),
  gstRegistered: z.boolean(),
  industry: z.string().optional(),
  defaultCategory: z.string(),
});

export const MerchantIntelligenceOutputSchema = z.object({
  results: z.array(MerchantResultSchema),
  newMappings: z.array(NewMappingSchema),
  summary: z.string(),
});

export type MerchantIntelligenceOutputValidated = z.infer<typeof MerchantIntelligenceOutputSchema>;
