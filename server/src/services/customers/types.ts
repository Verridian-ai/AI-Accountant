/**
 * Customer Service — Type Definitions
 */

// Re-export the Drizzle-inferred types for external consumers
import type { Customer, CustomerContact } from '../../schema.js';
export type { Customer, CustomerContact };

// ---------------------------------------------------------------------------
// Input / Output interfaces
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  paymentTermsDays?: number;
  notes?: string;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface CustomerWithBalance {
  customer: Customer;
  outstandingBalanceCents: number;
  overdueBalanceCents: number;
  invoiceCount: number;
}
