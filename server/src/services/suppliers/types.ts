/**
 * Supplier Management Service — Type Definitions
 */

export interface Supplier {
  id: string;
  userId: string;
  name?: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
  paymentTerms?: string | null;
  paymentTermsDays: number;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  tenantId?: string | null;
}

export interface CreateSupplierInput {
  name?: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTerms?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTerms?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

export interface SupplierDetail extends Supplier {
  recentBills: Array<{
    id: string;
    billNumber: string;
    totalAmountCents: number;
    status: string;
    dueDate: string;
  }>;
  totalOutstandingCents: number;
  averageDaysToPayment: number;
  totalSpendCents: number;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'totalSpend';
  sortOrder?: 'asc' | 'desc';
}
