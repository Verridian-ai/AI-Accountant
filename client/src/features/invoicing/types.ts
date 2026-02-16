export interface Customer {
  id: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  paymentTermsDays?: number;
  notes?: string;
  outstandingBalance?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
