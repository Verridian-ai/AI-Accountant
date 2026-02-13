/**
 * Zod schema for FinancialPlanner agent output.
 * Matches FinancialPlannerOutput from types.ts.
 */
import { z } from 'zod';

export const TopCategorySchema = z.object({
  category: z.string(),
  totalCents: z.number(),
  percentOfIncome: z.number(),
});

export const SpendingAnalysisSchema = z.object({
  totalIncomeCents: z.number(),
  totalExpensesCents: z.number(),
  savingsRatePercent: z.number(),
  topCategories: z.array(TopCategorySchema),
});

export const MonthlyTargetSchema = z.object({
  category: z.string(),
  currentCents: z.number(),
  recommendedCents: z.number(),
});

export const BudgetRecommendationSchema = z.object({
  needs: z.number(),
  wants: z.number(),
  savings: z.number(),
  monthlyTargets: z.array(MonthlyTargetSchema),
});

export const WealthProjectionSchema = z.object({
  year: z.number(),
  projectedNetWorthCents: z.number(),
  assumptions: z.string(),
});

export const DebtPayoffItemSchema = z.object({
  debtName: z.string(),
  payoffMonth: z.number(),
});

export const DebtStrategySchema = z.object({
  method: z.enum(['avalanche', 'snowball']),
  totalInterestSavedCents: z.number(),
  payoffMonths: z.number(),
  order: z.array(DebtPayoffItemSchema),
});

export const FinancialPlannerOutputSchema = z.object({
  spendingAnalysis: SpendingAnalysisSchema,
  budgetRecommendation: BudgetRecommendationSchema,
  wealthProjection: z.array(WealthProjectionSchema),
  debtStrategy: DebtStrategySchema.optional(),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export type FinancialPlannerOutputValidated = z.infer<typeof FinancialPlannerOutputSchema>;
