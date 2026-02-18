/**
 * Validation schemas for miscellaneous operations:
 * account-misc, merchant-ops, members, transfers, bills
 */

import { z } from 'zod';

/** POST /statements/detect-bank */
export const detectBankSchema = z.object({
  pdfText: z.string().min(1),
});

/** POST /reconciliation-alerts/:id/resolve */
export const resolveAlertSchema = z.object({
  notes: z.string().max(1000).optional(),
});

/** PATCH /merchant-memory/:id */
export const updateMerchantMemorySchema = z.object({
  category: z.string().max(100).optional(),
  gstApplicable: z.boolean().optional(),
  merchantDisplayName: z.string().max(255).optional(),
});

/** POST /pending-categorizations/:id/resolve */
export const resolvePendingSchema = z.object({
  action: z.enum(['approve', 'modify', 'reject']),
  category: z.string().max(100).optional(),
  gstApplicable: z.boolean().optional(),
});

/** POST /transfers (manual link) */
export const linkTransferSchema = z.object({
  sourceTransactionId: z.string().min(1),
  destinationTransactionId: z.string().min(1),
});

/** POST /transfers/auto-detect */
export const autoDetectTransfersSchema = z.object({
  persist: z.boolean().optional(),
});

/** POST /transfers/bulk-link */
export const bulkLinkTransfersSchema = z.object({
  pairs: z
    .array(
      z.object({
        sourceTransactionId: z.string().min(1),
        destinationTransactionId: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** POST /invitations/accept */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  userId: z.string().optional(),
});

/** POST /:tenantId/invitations — all 5 tenant roles */
export const inviteTenantMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'accountant', 'bookkeeper', 'viewer']),
});

/** POST /admin/ingest-knowledge */
export const ingestKnowledgeSchema = z.object({
  datasetName: z.string().min(1).max(100).optional(),
});

/** POST /:id/approve — optional reason */
export const approveReasonSchema = z.object({
  reason: z.string().max(500).optional(),
});
