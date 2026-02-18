/**
 * Account validation schemas
 */

import { z } from 'zod';
import { amountCentsSchema } from './common.js';

export const accountTypeEnum = z.enum([
  'checking',
  'savings',
  'credit_card',
  'loan',
  'investment',
  'mortgage',
  'other',
]);

export const createAccountSchema = z.object({
  accountNumber: z
    .string()
    .min(4, 'Account number must be at least 4 characters')
    .max(20, 'Account number too long'),
  accountName: z.string().min(1, 'Account name required').max(100, 'Account name too long'),
  accountType: accountTypeEnum,
  bankName: z.string().max(100).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  creditLimit: amountCentsSchema.optional(),
  minimumPayment: amountCentsSchema.optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccount = z.infer<typeof createAccountSchema>;
