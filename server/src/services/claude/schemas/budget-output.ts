/**
 * Zod schema for BudgetAnalyzer agent output.
 * Matches BudgetAnalyzerOutput from types.ts.
 */
import { z } from 'zod';

export const BudgetInsightSchema = z.object({
  type: z.enum(['spending', 'income', 'savings', 'warning', 'opportunity']),
  title: z.string(),
  description: z.string(),
  amount: z.number().optional(),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  confidence: z.number().min(0).max(1),
});

export const CategoryBreakdownSchema = z.object({
  category: z.string(),
  total: z.number(),
  percentage: z.number(),
  monthOverMonth: z.number(),
});

export const RecurringExpenseSchema = z.object({
  description: z.string(),
  amount: z.number(),
  frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual']),
  nextExpected: z.string(),
});

export const ProjectionSchema = z.object({
  month: z.string(),
  projectedBalance: z.number(),
  confidence: z.number().min(0).max(1),
});

export const BudgetAnalyzerOutputSchema = z.object({
  insights: z.array(BudgetInsightSchema),
  categoryBreakdown: z.array(CategoryBreakdownSchema),
  recurringExpenses: z.array(RecurringExpenseSchema),
  projections: z.array(ProjectionSchema).optional(),
  savingsRate: z.number(),
  summary: z.string(),
});

export type BudgetAnalyzerOutputValidated = z.infer<typeof BudgetAnalyzerOutputSchema>;
