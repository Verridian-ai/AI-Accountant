import type { OCRDocumentRecord, OCRLineItemRecord } from './types.js';

export function mimeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return '.pdf';
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

export function toDocumentRecord(raw: Record<string, unknown>): OCRDocumentRecord {
  return {
    id: raw.id as string,
    userId: (raw.userId ?? raw.user_id) as string,
    accountId: (raw.accountId ?? raw.account_id ?? null) as string | null,
    fileName: (raw.fileName ?? raw.file_name) as string,
    filePath: (raw.filePath ?? raw.file_path) as string,
    fileSize: (raw.fileSize ?? raw.file_size) as number,
    mimeType: (raw.mimeType ?? raw.mime_type) as string,
    documentType: (raw.documentType ?? raw.document_type ?? 'unknown') as string,
    documentNumber: (raw.documentNumber ?? raw.document_number ?? null) as string | null,
    vendorName: (raw.vendorName ?? raw.vendor_name ?? null) as string | null,
    vendorAbn: (raw.vendorAbn ?? raw.vendor_abn ?? null) as string | null,
    documentDate: (raw.documentDate ?? raw.document_date ?? null) as string | null,
    dueDate: (raw.dueDate ?? raw.due_date ?? null) as string | null,
    subtotal: (raw.subtotal ?? null) as number | null,
    gstAmount: (raw.gstAmount ?? raw.gst_amount ?? null) as number | null,
    totalAmount: (raw.totalAmount ?? raw.total_amount ?? null) as number | null,
    currency: (raw.currency ?? 'AUD') as string,
    extractedData: (raw.extractedData ?? raw.extracted_data ?? undefined) as
      | Record<string, unknown>
      | undefined,
    confidenceScore: (raw.confidenceScore ?? raw.confidence_score ?? 0) as number,
    status: (raw.status ?? 'pending') as string,
    errorMessage: (raw.errorMessage ?? raw.error_message ?? null) as string | null,
    processedAt: (raw.processedAt ?? raw.processed_at ?? null) as string | null,
    createdAt: (raw.createdAt ?? raw.created_at ?? new Date().toISOString()) as string,
  };
}

export function toLineItemRecord(raw: Record<string, unknown>): OCRLineItemRecord {
  return {
    id: raw.id as string,
    documentId: (raw.documentId ?? raw.document_id) as string,
    lineNumber: (raw.lineNumber ?? raw.line_number) as number,
    description: raw.description as string,
    quantity: (raw.quantity ?? 1) as number,
    unitPrice: (raw.unitPrice ?? raw.unit_price ?? null) as number | null,
    amount: raw.amount as number,
    gstAmount: (raw.gstAmount ?? raw.gst_amount ?? 0) as number,
    gstInclusive: (raw.gstInclusive ?? raw.gst_inclusive ?? true) as boolean,
    category: (raw.category ?? null) as string | null,
    accountCode: (raw.accountCode ?? raw.account_code ?? null) as string | null,
    confidenceScore: (raw.confidenceScore ?? raw.confidence_score ?? 0) as number,
  };
}
