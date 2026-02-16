import { z } from 'zod';
import { amountCentsSchema, emailSchema, uuidSchema } from '../index.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0.01),
  unitPrice: z.number().int().min(0),
  gstRate: z.number().min(0).max(1).default(0.1),
  accountCode: z.string().optional(),
});

export const createCustomerSchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().optional(),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default('AU'),
  abn: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).default(14),
  notes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createContactSchema = z.object({
  name: z.string().min(2),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const createInvoiceSchema = z.object({
  customerId: uuidSchema,
  invoiceNumber: z.string().min(1),
  issueDate: z.string(), // ISO date
  dueDate: z.string(), // ISO date
  items: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  currency: z.string().default('AUD'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().omit({ invoiceNumber: true });

export const recordPaymentSchema = z.object({
  amount: amountCentsSchema,
  date: z.string(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const createCreditNoteSchema = z.object({
  customerId: uuidSchema,
  originalInvoiceId: uuidSchema.optional(),
  creditNoteNumber: z.string().min(1),
  issueDate: z.string(),
  items: z.array(lineItemSchema).min(1),
  reason: z.string().optional(),
});
