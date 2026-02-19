/**
 * Authentication validation schemas
 */

import { z } from 'zod';
import { emailSchema } from './common.js';

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

export const registerSchema = loginSchema.extend({
  email: emailSchema.optional(),
  tenantName: z.string().min(1).max(100).optional(),
  tenantSlug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export const loginWithTenantSchema = loginSchema.extend({
  tenantId: z.string().uuid().optional(),
});

export const refreshSchema = z.object({
  tenantId: z.string().uuid().optional(),
  refreshToken: z.string().min(1).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
    ),
});

export const mfaSetupSchema = z.object({
  totpCode: z
    .string()
    .length(6, 'TOTP code must be 6 digits')
    .regex(/^\d+$/, 'TOTP code must contain only digits'),
});

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .min(6, 'Code must be at least 6 characters')
    .max(20, 'Code cannot exceed 20 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginWithTenantInput = z.infer<typeof loginWithTenantSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
