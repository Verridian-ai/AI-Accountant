/**
 * Zod schema for GSTCalculator agent output.
 * Matches GSTCalculatorOutput from types.ts.
 */
import { z } from 'zod';

export const BASLabelsSchema = z.object({
  G1: z.number(),
  G2: z.number(),
  G3: z.number(),
  G10: z.number(),
  G11: z.number(),
  '1A': z.number(),
  '1B': z.number(),
  W1: z.number(),
  W2: z.number(),
  '5A': z.number(),
  '7C': z.number(),
  '7D': z.number(),
});

export const TransactionBreakdownSchema = z.object({
  gstApplicable: z.number(),
  gstFree: z.number(),
  inputTaxed: z.number(),
  capitalAcquisitions: z.number(),
  outOfScope: z.number(),
});

export const GSTCalculatorOutputSchema = z.object({
  basLabels: BASLabelsSchema,
  gstPayable: z.number(),
  totalPayable: z.number(),
  transactionBreakdown: TransactionBreakdownSchema,
  warnings: z.array(z.string()),
});

export type GSTCalculatorOutputValidated = z.infer<typeof GSTCalculatorOutputSchema>;
