/**
 * Export Service — Type Definitions
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';
export type ExportType = 'transactions' | 'bas' | 'tax_summary' | 'full_backup';

export interface ExportOptions {
  userId: string;
  type: ExportType;
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    categories?: string[];
    accountIds?: string[];
    minAmount?: number;
    maxAmount?: number;
  };
  includeMetadata?: boolean;
}

export interface ExportResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  format: ExportFormat;
  expiresAt: string;
}
