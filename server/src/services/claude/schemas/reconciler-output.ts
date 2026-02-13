/**
 * Zod schema for AccountReconciler agent output.
 * Matches ReconcilerOutput from types.ts.
 */
import { z } from 'zod';

export const DuplicateSchema = z.object({
  transaction1Id: z.number(),
  transaction2Id: z.number(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const BalanceContinuityGapSchema = z.object({
  afterStatement: z.number(),
  expectedOpening: z.number(),
  actualOpening: z.number(),
});

export const BalanceContinuitySchema = z.object({
  isContiguous: z.boolean(),
  gaps: z.array(BalanceContinuityGapSchema),
});

export const TransferMatchSchema = z.object({
  sourceTransactionId: z.number(),
  targetTransactionId: z.number(),
  amount: z.number(),
  confidence: z.number().min(0).max(1),
  matchReasons: z.array(z.string()),
});

export const UnmatchedTransactionSchema = z.object({
  id: z.number(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
});

export const RunningBalanceErrorSchema = z.object({
  transactionId: z.number(),
  expected: z.number(),
  actual: z.number(),
});

export const ReconcilerOutputSchema = z.object({
  status: z.enum(['clean', 'warnings', 'errors']),
  duplicates: z.array(DuplicateSchema),
  balanceContinuity: BalanceContinuitySchema,
  transferMatches: z.array(TransferMatchSchema),
  unmatchedTransactions: z.array(UnmatchedTransactionSchema),
  runningBalanceErrors: z.array(RunningBalanceErrorSchema),
  summary: z.string(),
});

export type ReconcilerOutputValidated = z.infer<typeof ReconcilerOutputSchema>;
