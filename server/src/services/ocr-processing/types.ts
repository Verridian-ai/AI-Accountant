/**
 * OCR Processing Module — Type Definitions and Constants
 */

export interface OCRDocumentRecord {
  id: string;
  userId: string;
  accountId?: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  documentNumber?: string | null;
  vendorName?: string | null;
  vendorAbn?: string | null;
  documentDate?: string | null;
  dueDate?: string | null;
  subtotal?: number | null;
  gstAmount?: number | null;
  totalAmount?: number | null;
  currency: string;
  extractedData?: any;
  confidenceScore: number;
  status: string;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface OCRLineItemRecord {
  id: string;
  documentId: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number | null;
  amount: number;
  gstAmount: number;
  gstInclusive: boolean;
  category?: string | null;
  accountCode?: string | null;
  confidenceScore: number;
}

export interface OCRExtractionResult {
  documentType: string;
  documentNumber?: string;
  vendorName?: string;
  vendorAbn?: string;
  documentDate?: string;
  dueDate?: string;
  subtotal?: number;
  gstAmount?: number;
  totalAmount: number;
  currency: string;
  lineItems: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount: number;
    gstAmount?: number;
    gstInclusive: boolean;
  }>;
  confidence: number;
}

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const VALID_DOCUMENT_TYPES = new Set([
  'invoice',
  'receipt',
  'bill',
  'credit_note',
  'statement',
  'quote',
  'purchase_order',
  'unknown',
]);

/** Keyword to category mapping for line item classification */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Office Supplies': [
    'stationery',
    'paper',
    'pen',
    'ink',
    'toner',
    'cartridge',
    'folder',
    'office',
  ],
  'Computer & IT': [
    'software',
    'license',
    'hosting',
    'domain',
    'computer',
    'laptop',
    'monitor',
    'keyboard',
    'mouse',
    'ssd',
    'ram',
    'server',
  ],
  Utilities: ['electricity', 'gas', 'water', 'power', 'energy', 'utility'],
  Telecommunications: [
    'phone',
    'mobile',
    'internet',
    'broadband',
    'nbn',
    'telstra',
    'optus',
    'vodafone',
    'sim',
  ],
  'Rent & Occupancy': ['rent', 'lease', 'occupancy', 'tenancy'],
  Insurance: ['insurance', 'premium', 'indemnity', 'liability cover'],
  'Motor Vehicle': [
    'fuel',
    'petrol',
    'diesel',
    'rego',
    'registration',
    'car',
    'vehicle',
    'parking',
    'toll',
  ],
  'Travel & Accommodation': [
    'flight',
    'airfare',
    'hotel',
    'motel',
    'accommodation',
    'taxi',
    'uber',
    'travel',
  ],
  'Meals & Entertainment': [
    'meal',
    'lunch',
    'dinner',
    'breakfast',
    'coffee',
    'catering',
    'restaurant',
  ],
  'Professional Services': [
    'accounting',
    'legal',
    'consulting',
    'advisory',
    'audit',
    'bookkeeping',
  ],
  'Advertising & Marketing': [
    'advertising',
    'marketing',
    'promotion',
    'ad spend',
    'google ads',
    'facebook ads',
    'seo',
  ],
  'Repairs & Maintenance': ['repair', 'maintenance', 'service', 'fix', 'plumber', 'electrician'],
  Cleaning: ['cleaning', 'cleaner', 'janitorial', 'sanitation'],
  'Postage & Freight': [
    'postage',
    'freight',
    'courier',
    'shipping',
    'delivery',
    'auspost',
    'sendle',
  ],
  'Training & Education': ['training', 'course', 'workshop', 'seminar', 'webinar', 'education'],
  Subscriptions: ['subscription', 'membership', 'annual fee', 'monthly fee'],
  'Materials & Supplies': ['material', 'supply', 'raw material', 'component', 'parts'],
  Equipment: ['equipment', 'tool', 'machinery', 'plant'],
};
