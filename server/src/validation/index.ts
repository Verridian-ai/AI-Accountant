/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for all API inputs.
 * Provides type-safe request validation with detailed error messages.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Date validation (ISO 8601)
export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD or full ISO string)',
});

// Optional date schema
export const optionalDateSchema = dateSchema.optional().nullable();

// Amount in cents (integer)
export const amountCentsSchema = z
  .number()
  .int('Amount must be an integer (cents)')
  .min(-100000000000, 'Amount too small') // -$1 billion
  .max(100000000000, 'Amount too large'); // $1 billion

// Percentage (0-100)
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage cannot exceed 100');

// Positive integer
export const positiveIntSchema = z.number().int('Must be an integer').positive('Must be positive');

// Non-negative integer
export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .nonnegative('Cannot be negative');

// Email validation
export const emailSchema = z.string().email('Invalid email address').max(255, 'Email too long');

// URL validation
export const urlSchema = z.string().url('Invalid URL').max(2048, 'URL too long');

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

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

// ============================================================================
// TRANSACTION SCHEMAS
// ============================================================================

export const transactionUpdateSchema = z.object({
  category: z.string().max(100, 'Category too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  amount: amountCentsSchema.optional(),
  gstApplicable: z.boolean().optional(),
  gstAmount: amountCentsSchema.optional(),
  gstCategory: z.enum(['taxable_10', 'gst_free', 'input_taxed', 'export', 'capital']).optional(),
  isTransfer: z.boolean().optional(),
  merchantNormalized: z.string().max(200, 'Merchant name too long').optional(),
  aiReasoningNotes: z.string().max(2000, 'Notes too long').optional(),
});

export const transactionSplitSchema = z.object({
  splits: z
    .array(
      z.object({
        category: z.string().min(1, 'Category required').max(100),
        amount: amountCentsSchema,
        description: z.string().max(500).optional(),
        gst: z.boolean().default(false),
      }),
    )
    .min(2, 'At least 2 splits required')
    .max(10, 'Maximum 10 splits allowed'),
});

export const gstCategorizeSchema = z.object({
  updates: z
    .array(
      z.object({
        transactionId: uuidSchema,
        gstCategory: z.enum(['taxable_10', 'gst_free', 'input_taxed', 'export', 'capital']),
        gstAmount: amountCentsSchema,
      }),
    )
    .min(1)
    .max(100, 'Maximum 100 updates per request'),
});

// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================

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

// ============================================================================
// TRANSFER SCHEMAS
// ============================================================================

export const createTransferLinkSchema = z.object({
  sourceTransactionId: uuidSchema,
  destinationTransactionId: uuidSchema,
});

export const bulkLinkTransfersSchema = z.object({
  pairs: z
    .array(
      z.object({
        sourceTransactionId: uuidSchema,
        destinationTransactionId: uuidSchema,
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(50, 'Maximum 50 pairs per request'),
});

// ============================================================================
// BAS & TAX SCHEMAS
// ============================================================================

export const basCalculateSchema = z.object({
  quarter: z
    .string()
    .regex(/^Q[1-4]-\d{4}-\d{2}$/, 'Invalid quarter format. Use Q1-2024-25 format'),
  method: z.enum(['accrual', 'cash']).default('accrual'),
});

export const basSaveSchema = z.object({
  quarter: z.string(),
  labelG1: amountCentsSchema.optional(),
  labelG2: amountCentsSchema.optional(),
  labelG3: amountCentsSchema.optional(),
  labelG10: amountCentsSchema.optional(),
  labelG11: amountCentsSchema.optional(),
  label1A: amountCentsSchema.optional(),
  label1B: amountCentsSchema.optional(),
  labelW1: amountCentsSchema.optional(),
  labelW2: amountCentsSchema.optional(),
  label5A: amountCentsSchema.optional(),
  label7C: amountCentsSchema.optional(),
  label7D: amountCentsSchema.optional(),
});

export const taxCalculateSchema = z.object({
  year: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid tax year format. Use 2024-25 format'),
  grossIncome: amountCentsSchema,
  entityType: z.enum(['individual', 'company', 'trust', 'partnership']).default('individual'),
  hasPrivateHealth: z.boolean().default(false),
});

export const addDeductionSchema = z.object({
  taxYear: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  description: z.string().min(1).max(500),
  amount: amountCentsSchema,
  calculationMethod: z.string().max(100).optional(),
  calculationDetails: z.string().max(2000).optional(),
  linkedTransactionIds: z.array(uuidSchema).optional(),
});

// ============================================================================
// CGT SCHEMAS
// ============================================================================

export const assetTypeEnum = z.enum(['shares', 'property', 'crypto', 'collectables', 'other']);

export const addCgtAssetSchema = z.object({
  assetName: z.string().min(1).max(200),
  assetType: assetTypeEnum,
  acquisitionDate: dateSchema,
  acquisitionCost: amountCentsSchema,
  acquisitionCostsIncidental: amountCentsSchema.optional(),
  improvementsCost: amountCentsSchema.optional(),
  quantity: z.number().positive().default(1),
  unitCost: amountCentsSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const recordDisposalSchema = z.object({
  assetId: uuidSchema,
  acquisitionDate: dateSchema,
  acquisitionCostCents: amountCentsSchema,
  disposalDate: dateSchema,
  disposalProceedsCents: amountCentsSchema,
  disposalCostsCents: amountCentsSchema.optional(),
  quantityDisposed: z.number().positive().optional(),
  carriedForwardLossesCents: amountCentsSchema.optional(),
});

// ============================================================================
// DEPRECIATION SCHEMAS
// ============================================================================

export const depreciationMethodEnum = z.enum([
  'diminishing',
  'prime_cost',
  'low_value_pool',
  'instant_write_off',
]);

export const addDepreciableAssetSchema = z.object({
  assetName: z.string().min(1).max(200),
  assetCategory: z.string().min(1).max(100),
  purchaseDate: dateSchema,
  purchaseCost: amountCentsSchema,
  effectiveLifeYears: z.number().positive().max(50),
  depreciationMethod: depreciationMethodEnum.default('diminishing'),
  businessUsePercentage: percentageSchema.default(100),
  openingWrittenDownValue: amountCentsSchema.optional(),
  linkedTransactionId: uuidSchema.optional(),
  notes: z.string().max(2000).optional(),
});

// ============================================================================
// CHAT & AGENT SCHEMAS
// ============================================================================

export const chatMessageSchema = z.object({
  query: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  context: z
    .object({
      transactionIds: z.array(uuidSchema).optional(),
      accountIds: z.array(uuidSchema).optional(),
      dateRange: z
        .object({
          start: dateSchema,
          end: dateSchema,
        })
        .optional(),
    })
    .optional(),
  sessionId: z.string().max(200).optional(), // Wave 3: Cognee session tracking
});

export const agentRequestSchema = z.object({
  agentType: z.enum(['financial-analyst', 'bas', 'tax', 'reconciliation']),
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  skipCache: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const modelSettingsSchema = z.object({
  modelParsingText: z.string().max(100).optional(),
  modelParsingVision: z.string().max(100).optional(),
  modelCategorization: z.string().max(100).optional(),
  modelChat: z.string().max(100).optional(),
  modelEmbedding: z.string().max(100).optional(),
});

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

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

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

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

// ============================================================================
// TEAM SCHEMAS
// ============================================================================

export const teamRoleEnum = z.enum(['owner', 'admin', 'accountant', 'viewer']);

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: emailSchema,
  role: teamRoleEnum,
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    throw new ValidationError('Validation failed', errors);
  }

  return result.data;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  errors: Array<{ path: string; message: string }>;

  constructor(message: string, errors: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type TransactionSplit = z.infer<typeof transactionSplitSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
