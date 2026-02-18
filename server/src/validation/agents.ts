/**
 * Validation schemas for AI agent execution routes
 */

import { z } from 'zod';

/** POST /agents/:type/run — query is required */
export const agentRunSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000),
});

/** POST /agents/code/execute — code is required */
export const codeExecuteSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50000),
  context: z.record(z.unknown()).optional(),
  includeTransactions: z.boolean().optional(),
});

/** POST /agents/analyze-finances and /agents/reconcile — all optional */
export const agentAnalyzeSchema = z.object({
  query: z.string().max(2000).optional(),
});

/** POST /agents/calculate-bas */
export const agentBASSchema = z.object({
  query: z.string().max(2000).optional(),
  quarter: z.string().max(20).optional(),
});

/** POST /agents/calculate-tax */
export const agentTaxSchema = z.object({
  query: z.string().max(2000).optional(),
  grossIncome: z.number().optional(),
  taxWithheld: z.number().optional(),
});
