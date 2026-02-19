import { CheckCircle2, Clock, AlertCircle, Loader2, Files, Ban } from 'lucide-react';
import type { Statement } from '@/api';
import type { UploadStatus } from './types.js';

export function getActionableSuggestion(errorType?: string | null): string {
  switch (errorType) {
    case 'PDF_READ_ERROR':
      return "Try flattening the PDF or ensuring it's not password-protected. If it's a scanned image, try a higher resolution scan.";
    case 'AI_PARSE_ERROR':
      return "The AI couldn't find a standard CBA format. Ensure you're uploading a 'Smart Access' or 'Transaction' statement.";
    case 'EMPTY_STATEMENT':
      return 'No transactions found. This page might only contain summary info or be an bank info page.';
    case 'CRITICAL_ERROR':
      return 'A system error occurred. Please try again or contact support if the issue persists.';
    default:
      return 'Check the file format and try uploading again.';
  }
}

export function getStatusIcon(status: Statement['parsingStatus']) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'PROCESSING':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'FAILED':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-zinc-600" />;
  }
}

export function getUploadStatusIcon(status: UploadStatus) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'uploading':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-cba-gold animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'duplicate':
      return <Files className="h-4 w-4 text-amber-500" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-muted" />;
    default:
      return <Clock className="h-4 w-4 text-zinc-600" />;
  }
}

export function getUploadStatusColor(status: UploadStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'uploading':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'processing':
      return 'bg-cba-gold/10 text-cba-gold border border-cba-gold/20';
    case 'failed':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    case 'duplicate':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'cancelled':
      return 'bg-zinc-800 text-muted border border-zinc-700';
    default:
      return 'bg-zinc-900 text-muted border border-zinc-800';
  }
}

export function getUploadStatusLabel(status: UploadStatus): string {
  switch (status) {
    case 'processing':
      return 'Parsing';
    case 'duplicate':
      return 'Duplicate';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
