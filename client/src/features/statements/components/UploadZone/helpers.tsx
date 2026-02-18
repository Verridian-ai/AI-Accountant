import { FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import type { ReactElement } from 'react';

export const ACCEPTED_EXTENSIONS = '.pdf,.csv,.ofx,.qif';

export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function getFileIcon(filename: string): ReactElement {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-400" />;
    case 'csv':
      return <FileSpreadsheet className="h-4 w-4 text-emerald-400" />;
    case 'ofx':
    case 'qif':
      return <FileCode className="h-4 w-4 text-blue-400" />;
    default:
      return <FileText className="h-4 w-4 text-zinc-500" />;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
