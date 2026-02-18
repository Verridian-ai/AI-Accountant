/**
 * Common primitive validation schemas used across all domains
 */

import { z } from 'zod';

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD or full ISO string)',
});

export const optionalDateSchema = dateSchema.optional().nullable();

export const amountCentsSchema = z
  .number()
  .int('Amount must be an integer (cents)')
  .min(-100000000000, 'Amount too small')
  .max(100000000000, 'Amount too large');

export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage cannot exceed 100');

export const positiveIntSchema = z.number().int('Must be an integer').positive('Must be positive');

export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .nonnegative('Cannot be negative');

export const emailSchema = z.string().email('Invalid email address').max(255, 'Email too long');

export const urlSchema = z.string().url('Invalid URL').max(2048, 'URL too long');
