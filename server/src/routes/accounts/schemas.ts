import { z } from 'zod';

export const createAccountSchema = z.object({
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
  accountType: z.string().min(1),
  bankName: z.string().optional(),
  interestRate: z.number().optional(),
  creditLimit: z.number().optional(),
  minimumPayment: z.number().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
});

export const updateAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  accountType: z.string().min(1).optional(),
  bankName: z.string().optional(),
  interestRate: z.number().optional(),
  creditLimit: z.number().optional(),
  minimumPayment: z.number().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  ownershipTag: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const resolveCategorizationSchema = z.object({
  action: z.enum(['approve', 'modify', 'reject']),
  category: z.string().optional(),
  gstApplicable: z.boolean().optional(),
});

export const createTransferSchema = z.object({
  sourceTransactionId: z.string().min(1),
  destinationTransactionId: z.string().min(1),
});

export const resolveAlertSchema = z.object({
  notes: z.string().optional(),
});

export const detectBankSchema = z.object({
  pdfText: z.string().min(1),
});

export const updateMerchantMemorySchema = z.object({
  category: z.string().optional(),
  gstApplicable: z.boolean().optional(),
  notes: z.string().optional(),
});
