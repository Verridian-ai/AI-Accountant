export interface Supplier {
  id: string;
  userId: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
  address?: string;
  paymentTermsDays: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
  isActive: boolean;
  totalSpent: number;
  outstandingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  gstAmount: number;
}

export interface Bill {
  id: string;
  userId: string;
  supplierId: string;
  supplierName?: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'overdue' | 'paid' | 'void';
  subtotal: number;
  gstTotal: number;
  total: number;
  purchaseOrderId?: string;
  notes?: string;
  lineItems: BillLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface POLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  userId: string;
  supplierId: string;
  supplierName?: string;
  poNumber: string;
  issueDate: string;
  expectedDate?: string;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  subtotal: number;
  gstTotal: number;
  total: number;
  receivedPercentage?: number;
  notes?: string;
  lineItems: POLineItem[];
  billId?: string;
  purchaseOrderId?: string;
  receipts?: Array<{
    id: string;
    receiptDate: string;
    receivedBy?: string;
    lines: Array<{ lineId: string; quantity: number }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRun {
  id: string;
  userId: string;
  paymentDate: string;
  status: 'draft' | 'processing' | 'completed';
  bankReference?: string;
  totalAmount: number;
  billCount: number;
  billIds: string[];
  createdAt: string;
}

export interface APAgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface APAgingReport {
  asOfDate: string;
  totalOutstanding: number;
  buckets: APAgingBucket[];
  supplierBreakdown: Array<{
    supplierId: string;
    supplierName: string;
    current: number;
    thirtyDays: number;
    sixtyDays: number;
    ninetyDays: number;
    overNinety: number;
    total: number;
  }>;
}

