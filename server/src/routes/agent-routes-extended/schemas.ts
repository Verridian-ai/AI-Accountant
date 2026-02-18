import { z } from 'zod';

export const parseSchema = z.object({
  statementId: z.number().optional(),
  extractedText: z.string().optional(),
  fileName: z.string().optional(),
  bankName: z.string().optional(),
});

export const categorizeSchema = z.object({
  transactionIds: z.array(z.number()).optional(),
  transactions: z
    .array(
      z.object({
        id: z.number(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        accountId: z.number().optional(),
        bankId: z.string().optional(),
      }),
    )
    .optional(),
  userId: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const merchantIntelSchema = z.object({
  merchantName: z.string(),
  transactionId: z.number().optional(),
  merchants: z
    .array(
      z.object({
        transactionId: z.number(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
      }),
    )
    .optional(),
});

export const payrollSchema = z.object({
  action: z.enum(['detect_wages', 'calculate_payg', 'analyze_payroll']),
  transactionIds: z.array(z.string()).optional(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  userId: z.string().optional(),
  period: z.string().optional(),
  financialYear: z.string().optional(),
  quarter: z.number().optional(),
});

export const taxStrategySchema = z.object({
  userId: z.string().optional(),
  taxYear: z.string().optional(),
  financialYear: z.string().optional(),
  entityType: z.enum(['sole_trader', 'personal', 'company', 'trust', 'smsf']).optional(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
        gstCategory: z.string().optional(),
      }),
    )
    .optional(),
});

export const taxClaimsSchema = z.object({
  userId: z.string().optional(),
  taxYear: z.string().optional(),
  financialYear: z.string().optional(),
  claimTypes: z.array(z.string()).optional(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  occupation: z.string().optional(),
  hasHomeOffice: z.boolean().optional(),
  motorVehicleKm: z.number().optional(),
});

export const financialPlanSchema = z.object({
  userId: z.string().optional(),
  goal: z.string().optional(),
  timeframeMonths: z.number().optional(),
  financialYear: z.string().optional(),
  transactions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  riskProfile: z.enum(['conservative', 'balanced', 'growth', 'aggressive']).optional(),
  goals: z.array(z.string()).optional(),
});
