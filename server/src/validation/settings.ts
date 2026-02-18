/**
 * Pagination, date ranges, export, and team validation schemas
 */

import { z } from 'zod';
import { amountCentsSchema, uuidSchema, dateSchema, emailSchema } from './common.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z
  .object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be before or equal to end date' },
  );

export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf', 'json']),
  type: z.enum(['transactions', 'bas', 'tax_summary', 'full_backup']),
  dateRange: dateRangeSchema.optional(),
  filters: z
    .object({
      categories: z.array(z.string()).optional(),
      accountIds: z.array(uuidSchema).optional(),
      minAmount: amountCentsSchema.optional(),
      maxAmount: amountCentsSchema.optional(),
    })
    .optional(),
});

export const teamRoleEnum = z.enum(['owner', 'admin', 'accountant', 'viewer']);

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: emailSchema,
  role: teamRoleEnum,
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
