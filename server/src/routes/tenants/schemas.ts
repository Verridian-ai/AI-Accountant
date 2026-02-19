import { z } from 'zod';

export const createTenantSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/),
  })
  .passthrough();

export const updateTenantSchema = z
  .object({
    name: z.string().min(1).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const tenantRoleEnum = z.enum(['owner', 'admin', 'accountant', 'bookkeeper', 'viewer']);

export const addTenantMemberSchema = z.object({
  userId: z.string().min(1),
  role: tenantRoleEnum,
});

export const updateMemberRoleSchema = z.object({
  role: tenantRoleEnum,
});

export const createTenantInvitationSchema = z.object({
  email: z.string().email(),
  role: tenantRoleEnum,
});

export const createSubscriptionSchema = z.object({
  planName: z.string().min(1),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
});

export const changePlanSchema = z.object({
  newPlanName: z.string().min(1),
});
