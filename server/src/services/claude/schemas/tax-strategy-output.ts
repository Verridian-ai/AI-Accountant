/**
 * Zod schema for TaxStrategy agent output.
 * Matches TaxStrategyOutput from types.ts.
 */
import { z } from 'zod';

export const CurrentTaxPositionSchema = z.object({
  grossIncomeCents: z.number(),
  deductionsCents: z.number(),
  taxableIncomeCents: z.number(),
  estimatedTaxCents: z.number(),
  effectiveRate: z.number(),
});

export const TaxStrategyItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  estimatedSavingCents: z.number(),
  confidence: z.number().min(0).max(1),
  atoRulingRef: z.string().optional(),
  applicableEntities: z.array(z.string()),
  implementationSteps: z.array(z.string()),
});

export const TaxStrategyOutputSchema = z.object({
  entityType: z.string(),
  financialYear: z.string(),
  currentTaxPosition: CurrentTaxPositionSchema,
  strategies: z.array(TaxStrategyItemSchema),
  warnings: z.array(z.string()),
  summary: z.string(),
});

export type TaxStrategyOutputValidated = z.infer<typeof TaxStrategyOutputSchema>;
